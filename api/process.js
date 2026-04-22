const cronParser = require('cron-parser');

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-License-Key');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { expression, timezone = 'UTC' } = req.body;

    if (!expression) {
      return res.status(400).json({ error: 'Missing expression field' });
    }

    // Validate cron expression
    const parts = expression.trim().split(/\s+/);
    if (parts.length !== 5) {
      return res.status(400).json({
        error: 'Invalid cron expression',
        message: 'Cron expression must have exactly 5 parts: minute hour day month weekday'
      });
    }

    // Parse with cron-parser
    const interval = cronParser.parseExpression(expression, {
      utc: timezone === 'UTC',
      tz: timezone !== 'UTC' ? timezone : undefined
    });

    // Get next 10 executions
    const nextRuns = [];
    for (let i = 0; i < 10; i++) {
      try {
        const next = interval.next();
        nextRuns.push({
          date: next.toISOString(),
          formatted: next.toLocaleString('en-US', { timeZone: timezone })
        });
      } catch (e) {
        break;
      }
    }

    // Generate human readable description
    const [min, hour, day, month, weekday] = parts;
    const description = generateDescription(parts);

    return res.status(200).json({
      success: true,
      expression,
      parts: {
        minute: min,
        hour: hour,
        dayOfMonth: day,
        month: month,
        dayOfWeek: weekday
      },
      description,
      nextRuns,
      timezone,
      isValid: true
    });

  } catch (error) {
    return res.status(400).json({
      error: 'Failed to parse cron expression',
      message: error.message,
      isValid: false
    });
  }
};

function generateDescription(parts) {
  const [min, hour, day, month, weekday] = parts;
  const desc = [];

  // Minute description
  if (min === '*') desc.push('Every minute');
  else if (min.includes('/')) {
    const step = min.split('/')[1];
    desc.push(`Every ${step} minutes`);
  } else if (min.includes(',')) {
    desc.push(`At minutes ${min}`);
  } else if (min.includes('-')) {
    const [start, end] = min.split('-');
    desc.push(`Every minute from ${start} through ${end}`);
  } else {
    desc.push(`At minute ${min}`);
  }

  // Hour description
  if (hour === '*') {
    if (min === '*') desc.push('of every hour');
  } else if (hour.includes('/')) {
    const step = hour.split('/')[1];
    desc.push(`past every ${step}th hour`);
  } else if (hour.includes(',')) {
    desc.push(`past hours ${hour}`);
  } else {
    desc.push(`past hour ${hour}`);
  }

  // Day of week
  const weekdays = { '0': 'Sunday', '1': 'Monday', '2': 'Tuesday', '3': 'Wednesday', '4': 'Thursday', '5': 'Friday', '6': 'Saturday' };
  if (weekday === '*') {
    // Every day
  } else if (weekday === '1-5') {
    desc.push('Monday through Friday');
  } else if (weekday === '0,6' || weekday === '6,0') {
    desc.push('on weekends');
  } else if (weekday in weekdays) {
    desc.push(`on ${weekdays[weekday]}`);
  } else if (weekday.includes(',')) {
    const days = weekday.split(',').map(d => weekdays[d] || d).join(', ');
    desc.push(`on ${days}`);
  }

  // Day of month
  if (day !== '*') {
    if (day === 'L') desc.push('on the last day of the month');
    else desc.push(`on day ${day} of the month`);
  }

  // Month
  const months = { '1': 'January', '2': 'February', '3': 'March', '4': 'April', '5': 'May', '6': 'June',
                   '7': 'July', '8': 'August', '9': 'September', '10': 'October', '11': 'November', '12': 'December' };
  if (month !== '*') {
    if (month in months) desc.push(`in ${months[month]}`);
    else desc.push(`in month ${month}`);
  }

  return desc.join(', ');
}
