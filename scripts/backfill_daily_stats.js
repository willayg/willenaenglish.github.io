#!/usr/bin/env node
// Run: node scripts/backfill_daily_stats.js YYYY-MM-DD [YYYY-MM-DD]
// If only one date is provided, backfills that single date.

const path = require('path');

async function runForDate(dateStr) {
  console.log('\n>>> Backfilling', dateStr);
  try {
    const mod = require(path.resolve(__dirname, '..', 'netlify', 'functions', 'populate_daily_stats.js'));
    if (!mod || typeof mod.handler !== 'function') throw new Error('populate_daily_stats handler not found');

    // Set httpMethod so the function treats this as a manual HTTP run
    // (the handler uses absence of httpMethod to detect scheduled runs)
    const event = { httpMethod: 'GET', queryStringParameters: { date: dateStr } };
    const res = await mod.handler(event, {});
    console.log('Result:', res && res.body ? res.body : res);
  } catch (err) {
    console.error('Error running populate_daily_stats for', dateStr, err && err.message ? err.message : err);
    process.exitCode = 2;
  }
}

function parseDate(s) {
  const d = new Date(s + 'T00:00:00Z');
  if (isNaN(d)) return null;
  return d;
}

function formatDate(d) {
  return d.toISOString().split('T')[0];
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: node scripts/backfill_daily_stats.js START_DATE [END_DATE]');
    process.exit(1);
  }

  const start = parseDate(args[0]);
  if (!start) {
    console.error('Invalid start date:', args[0]);
    process.exit(1);
  }
  const end = args[1] ? parseDate(args[1]) : start;
  if (!end) {
    console.error('Invalid end date:', args[1]);
    process.exit(1);
  }
  if (end < start) {
    console.error('End date must be >= start date');
    process.exit(1);
  }

  // Confirm environment variables exist
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment. Set them before running.');
    process.exit(1);
  }

  // Loop dates inclusive
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const ds = formatDate(d);
    await runForDate(ds);
  }
}

main();
