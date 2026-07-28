#!/usr/bin/env node
'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const {
  parseArgs,
  selectCandidates,
  buildPatch,
  makeReportEntry,
  callWorker,
  patchWorksheet,
  fetchAllWorksheets
} = require('./migration');

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const supabaseUrl = process.env.SUPABASE_URL || 'https://fiieuiktlsivwfgyivai.supabase.co';
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const migrationSecret = process.env.WORKSHEET_MIGRATION_SECRET || serviceRoleKey;
  const workerUrl = process.env.WORKSHEET_ASSETS_URL || 'https://worksheet-assets.willenaenglish.com';
  const startedAt = new Date().toISOString();
  const runId = startedAt.replace(/[:.]/g, '-');
  const runDir = path.resolve(options.output, runId);
  const reports = [];

  console.log(`[phase7] mode=${options.apply ? 'APPLY' : 'DRY RUN'}`);
  const rows = await fetchAllWorksheets({ supabaseUrl, serviceRoleKey });
  const candidates = selectCandidates(rows, options);
  console.log(`[phase7] selected ${candidates.length} legacy rows from ${rows.length} total rows`);

  for (const [index, original] of candidates.entries()) {
    const id = String(original.user_id);
    console.log(`[phase7] ${index + 1}/${candidates.length} ${original.worksheet_type} ${id}`);
    const entry = { worksheet_id: id, title: original.title || '', worksheet_type: original.worksheet_type };
    try {
      if (options.apply) await writeJson(path.join(runDir, 'backups', `${id}.json`), original);
      const workerResult = await callWorker({
        workerUrl,
        migrationSecret,
        worksheet: original,
        dryRun: !options.apply
      });
      const transformed = workerResult.worksheet;
      const patch = buildPatch(original, transformed);
      const report = makeReportEntry(original, transformed, patch, workerResult, options.apply ? 'apply' : 'dry-run');

      if (options.apply) {
        await patchWorksheet({ supabaseUrl, serviceRoleKey, original, patch });
        report.database_updated = true;
      } else {
        report.database_updated = false;
      }
      report.status = 'success';
      reports.push(report);
    } catch (error) {
      reports.push({ ...entry, mode: options.apply ? 'apply' : 'dry-run', status: 'failed', error: error.message });
      console.error(`[phase7] FAILED ${id}: ${error.message}`);
      if (options.apply) break;
    }
  }

  const summary = {
    phase: '7C',
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    mode: options.apply ? 'apply' : 'dry-run',
    filters: { type: options.type || null, ids: options.ids, limit: options.limit || null },
    total_rows_scanned: rows.length,
    selected_rows: candidates.length,
    successful_rows: reports.filter(row => row.status === 'success').length,
    failed_rows: reports.filter(row => row.status === 'failed').length,
    database_rows_updated: reports.filter(row => row.database_updated).length,
    reports
  };
  await fs.mkdir(runDir, { recursive: true });
  await fs.writeFile(path.join(runDir, 'report.json'), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(`[phase7] report: ${path.join(runDir, 'report.json')}`);
  if (summary.failed_rows) process.exitCode = 1;
}

main().catch(error => {
  console.error(`[phase7] fatal: ${error.message}`);
  process.exitCode = 1;
});
