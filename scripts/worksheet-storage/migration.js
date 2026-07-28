'use strict';

const crypto = require('node:crypto');

const MUTABLE_FIELDS = ['images', 'settings', 'image_data'];
const APPLY_CONFIRMATION = 'MIGRATE_LEGACY_WORKSHEETS';

function containsEmbeddedImage(value) {
  if (typeof value === 'string') {
    if (/data:image\/(?:png|jpe?g|webp|gif);base64,/i.test(value)) return true;
    try { return containsEmbeddedImage(JSON.parse(value)); } catch { return false; }
  }
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(containsEmbeddedImage);
  return Object.values(value).some(containsEmbeddedImage);
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableValue(value[key])]));
  return value;
}

function checksum(value) { return crypto.createHash('sha256').update(JSON.stringify(stableValue(value))).digest('hex'); }

function parseArgs(argv) {
  const options = { apply: false, confirm: '', limit: 0, type: '', ids: [], output: 'migration-output/worksheet-storage' };
  for (const arg of argv) {
    if (arg === '--apply') options.apply = true;
    else if (arg.startsWith('--confirm=')) options.confirm = arg.slice(10);
    else if (arg.startsWith('--limit=')) options.limit = Number.parseInt(arg.slice(8), 10) || 0;
    else if (arg.startsWith('--type=')) options.type = arg.slice(7).trim();
    else if (arg.startsWith('--ids=')) options.ids = arg.slice(6).split(',').map(v => v.trim()).filter(Boolean);
    else if (arg.startsWith('--output=')) options.output = arg.slice(9).trim() || options.output;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (options.apply && options.confirm !== APPLY_CONFIRMATION) throw new Error(`Apply mode requires --confirm=${APPLY_CONFIRMATION}`);
  if (options.type && !['wordtest', 'flashcard'].includes(options.type)) throw new Error('--type must be wordtest or flashcard');
  return options;
}

function selectCandidates(rows, options = {}) {
  const ids = new Set(options.ids || []);
  let selected = rows.filter(row => {
    if (!['wordtest', 'flashcard'].includes(row.worksheet_type)) return false;
    if (options.type && row.worksheet_type !== options.type) return false;
    if (ids.size && !ids.has(String(row.user_id))) return false;
    return MUTABLE_FIELDS.some(field => containsEmbeddedImage(row[field]));
  });
  selected.sort((a, b) => String(a.user_id).localeCompare(String(b.user_id)));
  if (options.limit > 0) selected = selected.slice(0, options.limit);
  return selected;
}

function assertPreservedFields(original, transformed) {
  const ignored = new Set([...MUTABLE_FIELDS, 'updated_at']);
  const before = Object.fromEntries(Object.entries(original).filter(([key]) => !ignored.has(key)));
  const after = Object.fromEntries(Object.entries(transformed).filter(([key]) => !ignored.has(key)));
  if (checksum(before) !== checksum(after)) throw new Error('Transformer changed a protected worksheet field');
}

function buildPatch(original, transformed) {
  assertPreservedFields(original, transformed);
  const patch = {};
  for (const field of MUTABLE_FIELDS) {
    if (!containsEmbeddedImage(original[field])) continue;
    if (containsEmbeddedImage(transformed[field])) throw new Error(`Embedded image remains in ${field}`);
    patch[field] = transformed[field];
  }
  if (!Object.keys(patch).length) throw new Error('No migratable image field was changed');
  return patch;
}

function makeReportEntry(original, transformed, patch, workerResult, mode) {
  return {
    worksheet_id: original.user_id,
    title: original.title || '',
    worksheet_type: original.worksheet_type,
    mode,
    source_checksum: checksum(original),
    transformed_checksum: checksum(transformed),
    patch_checksum: checksum(patch),
    changed_fields: Object.keys(patch),
    unique_assets: Number(workerResult?.stats?.unique_assets || 0),
    uploaded_assets: Number(workerResult?.stats?.uploaded_assets || 0),
    reused_assets: Number(workerResult?.stats?.reused_assets || 0),
    total_asset_bytes: Number(workerResult?.stats?.total_asset_bytes || 0),
    remaining_base64: MUTABLE_FIELDS.filter(field => containsEmbeddedImage(transformed[field]))
  };
}

async function callWorker({ fetchImpl = fetch, workerUrl, migrationSecret, worksheet, dryRun }) {
  const response = await fetchImpl(workerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Worksheet-Migration-Secret': migrationSecret },
    body: JSON.stringify({ action: 'transform_worksheet', dry_run: dryRun, worksheet })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.success || !body.worksheet) throw new Error(body.error || `Worker returned HTTP ${response.status}`);
  return body;
}

async function fetchWorksheetById({ fetchImpl = fetch, supabaseUrl, serviceRoleKey, userId }) {
  const response = await fetchImpl(`${supabaseUrl}/rest/v1/worksheets?user_id=eq.${encodeURIComponent(userId)}&select=*`, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` }
  });
  const rows = await response.json().catch(() => []);
  if (!response.ok) throw new Error(rows?.message || `Supabase returned HTTP ${response.status}`);
  if (!Array.isArray(rows) || rows.length !== 1) throw new Error('Worksheet no longer exists or is not unique');
  return rows[0];
}

async function patchWorksheet({ fetchImpl = fetch, supabaseUrl, serviceRoleKey, original, patch }) {
  const live = await fetchWorksheetById({ fetchImpl, supabaseUrl, serviceRoleKey, userId: original.user_id });
  if (checksum(live) !== checksum(original)) throw new Error('Optimistic update failed: worksheet changed after migration started');
  const response = await fetchImpl(`${supabaseUrl}/rest/v1/worksheets?user_id=eq.${encodeURIComponent(original.user_id)}&select=user_id,updated_at`, {
    method: 'PATCH',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify(patch)
  });
  const rows = await response.json().catch(() => []);
  if (!response.ok) throw new Error(rows?.message || `Supabase returned HTTP ${response.status}`);
  if (!Array.isArray(rows) || rows.length !== 1) throw new Error('Optimistic update failed: worksheet changed or no longer exists');
  return rows[0];
}

async function fetchAllWorksheets({ fetchImpl = fetch, supabaseUrl, serviceRoleKey, pageSize = 200 }) {
  const output = [];
  for (let offset = 0; ; offset += pageSize) {
    const response = await fetchImpl(`${supabaseUrl}/rest/v1/worksheets?select=*&order=user_id.asc&limit=${pageSize}&offset=${offset}`, {
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` }
    });
    const rows = await response.json().catch(() => []);
    if (!response.ok) throw new Error(rows?.message || `Supabase returned HTTP ${response.status}`);
    output.push(...rows);
    if (rows.length < pageSize) break;
  }
  return output;
}

module.exports = {
  APPLY_CONFIRMATION,
  MUTABLE_FIELDS,
  containsEmbeddedImage,
  checksum,
  parseArgs,
  selectCandidates,
  assertPreservedFields,
  buildPatch,
  makeReportEntry,
  callWorker,
  fetchWorksheetById,
  patchWorksheet,
  fetchAllWorksheets
};
