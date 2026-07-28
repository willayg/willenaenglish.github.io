#!/usr/bin/env node
'use strict';

/**
 * Read-only worksheet storage audit.
 *
 * Required environment variables:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY (preferred) or SUPABASE_KEY
 *
 * Optional:
 *   WORKSHEET_AUDIT_OUTPUT=./audit-output/worksheets
 *
 * This script performs SELECT queries only. It never updates, inserts or deletes.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const OUTPUT_DIR = process.env.WORKSHEET_AUDIT_OUTPUT || path.join(process.cwd(), 'audit-output', 'worksheets');
const PAGE_SIZE = 200;
const DATA_URL_RE = /^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,([A-Za-z0-9+/=\s]+)$/i;
const URL_RE = /^https?:\/\//i;
const BLOB_RE = /^blob:/i;
const ASSET_REF_SAMPLE = 'https://assets.willena.invalid/worksheets/assets/sha256-placeholder.webp';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_KEY).');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

function byteLength(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'string') return Buffer.byteLength(value, 'utf8');
  try {
    return Buffer.byteLength(JSON.stringify(value), 'utf8');
  } catch {
    return 0;
  }
}

function parseMaybeJson(value) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed || !['{', '['].includes(trimmed[0])) return value;
  try { return JSON.parse(trimmed); } catch { return value; }
}

function normaliseForScan(row) {
  const copy = { ...row };
  for (const key of ['images', 'settings', 'image_data', 'questions', 'answers']) {
    copy[key] = parseMaybeJson(copy[key]);
  }
  return copy;
}

function imageHashFromDataUrl(value) {
  const match = value.match(DATA_URL_RE);
  if (!match) return null;
  const base64 = match[2].replace(/\s+/g, '');
  try {
    const binary = Buffer.from(base64, 'base64');
    return {
      hash: crypto.createHash('sha256').update(binary).digest('hex'),
      mime: match[1] || 'application/octet-stream',
      binaryBytes: binary.length
    };
  } catch {
    return null;
  }
}

function scanValue(value, location, found, seenObjects = new WeakSet()) {
  if (value === null || value === undefined) return;

  if (typeof value === 'string') {
    const parsed = parseMaybeJson(value);
    if (parsed !== value) {
      scanValue(parsed, location, found, seenObjects);
      return;
    }

    if (value.startsWith('data:image/')) {
      const decoded = imageHashFromDataUrl(value);
      found.push({
        kind: decoded ? 'embedded_image' : 'malformed_data_image',
        location,
        storedBytes: byteLength(value),
        hash: decoded?.hash || null,
        mime: decoded?.mime || null,
        binaryBytes: decoded?.binaryBytes || null
      });
    } else if (BLOB_RE.test(value)) {
      found.push({ kind: 'blob_url', location, storedBytes: byteLength(value) });
    } else if (URL_RE.test(value) && /\.(png|jpe?g|gif|webp|svg)(?:[?#]|$)/i.test(value)) {
      found.push({ kind: 'image_url', location, storedBytes: byteLength(value), url: value });
    }
    return;
  }

  if (typeof value !== 'object') return;
  if (seenObjects.has(value)) return;
  seenObjects.add(value);

  if (Array.isArray(value)) {
    value.forEach((item, index) => scanValue(item, `${location}[${index}]`, found, seenObjects));
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    scanValue(child, location ? `${location}.${key}` : key, found, seenObjects);
  }
}

function replaceEmbeddedForEstimate(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    const parsed = parseMaybeJson(value);
    if (parsed !== value) return JSON.stringify(replaceEmbeddedForEstimate(parsed));
    if (value.startsWith('data:image/')) return ASSET_REF_SAMPLE;
    if (value.startsWith('blob:')) return null;
    return value;
  }
  if (Array.isArray(value)) return value.map(replaceEmbeddedForEstimate);
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, replaceEmbeddedForEstimate(v)]));
  }
  return value;
}

function classify(row, findings) {
  const type = row.worksheet_type || 'untyped';
  const embedded = findings.filter(x => x.kind === 'embedded_image');
  const malformed = findings.filter(x => x.kind === 'malformed_data_image');
  const blobs = findings.filter(x => x.kind === 'blob_url');

  if (malformed.length || blobs.length) return 'manual_review';
  if (!embedded.length) return 'no_media_migration';
  if (type === 'wordtest') return 'auto_wordtest';
  if (type === 'flashcard') return 'auto_flashcard_with_compatibility';
  return 'auto_generic_media';
}

function csvEscape(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function fetchAllWorksheets() {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('worksheets')
      .select('*')
      .order('user_id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

async function main() {
  const rows = await fetchAllWorksheets();
  const hashUsage = new Map();
  const reports = [];

  for (const row of rows) {
    const scanTarget = normaliseForScan(row);
    const findings = [];
    scanValue(scanTarget, '', findings);

    for (const item of findings) {
      if (!item.hash) continue;
      const usage = hashUsage.get(item.hash) || { count: 0, binaryBytes: item.binaryBytes || 0, worksheets: new Set() };
      usage.count += 1;
      usage.worksheets.add(row.user_id);
      hashUsage.set(item.hash, usage);
    }

    const currentBytes = byteLength(row);
    const estimatedRow = replaceEmbeddedForEstimate(row);
    const estimatedBytes = byteLength(estimatedRow);
    const embedded = findings.filter(x => x.kind === 'embedded_image');

    reports.push({
      worksheet_id: row.user_id,
      title: row.title || '',
      worksheet_type: row.worksheet_type || 'untyped',
      classification: classify(row, findings),
      current_bytes: currentBytes,
      estimated_post_migration_bytes: estimatedBytes,
      estimated_saving_bytes: Math.max(0, currentBytes - estimatedBytes),
      embedded_image_occurrences: embedded.length,
      unique_embedded_hashes: new Set(embedded.map(x => x.hash).filter(Boolean)).size,
      embedded_stored_bytes: embedded.reduce((sum, x) => sum + x.storedBytes, 0),
      embedded_binary_bytes: embedded.reduce((sum, x) => sum + (x.binaryBytes || 0), 0),
      image_url_count: findings.filter(x => x.kind === 'image_url').length,
      blob_url_count: findings.filter(x => x.kind === 'blob_url').length,
      malformed_data_image_count: findings.filter(x => x.kind === 'malformed_data_image').length,
      image_locations: findings.map(x => `${x.kind}:${x.location}`),
      fields_bytes: Object.fromEntries(Object.entries(row).map(([k, v]) => [k, byteLength(v)]))
    });
  }

  const duplicateAssets = [...hashUsage.entries()]
    .filter(([, usage]) => usage.count > 1)
    .map(([hash, usage]) => ({
      hash,
      occurrences: usage.count,
      worksheet_count: usage.worksheets.size,
      binary_bytes: usage.binaryBytes,
      estimated_duplicate_binary_bytes: Math.max(0, usage.count - 1) * usage.binaryBytes
    }))
    .sort((a, b) => b.estimated_duplicate_binary_bytes - a.estimated_duplicate_binary_bytes);

  const byType = {};
  const byClassification = {};
  for (const report of reports) {
    const type = byType[report.worksheet_type] ||= { rows: 0, current_bytes: 0, estimated_bytes: 0, saving_bytes: 0, embedded_images: 0 };
    type.rows += 1;
    type.current_bytes += report.current_bytes;
    type.estimated_bytes += report.estimated_post_migration_bytes;
    type.saving_bytes += report.estimated_saving_bytes;
    type.embedded_images += report.embedded_image_occurrences;

    byClassification[report.classification] = (byClassification[report.classification] || 0) + 1;
  }

  const summary = {
    generated_at: new Date().toISOString(),
    read_only: true,
    worksheet_count: reports.length,
    current_logical_bytes: reports.reduce((sum, r) => sum + r.current_bytes, 0),
    estimated_post_migration_logical_bytes: reports.reduce((sum, r) => sum + r.estimated_post_migration_bytes, 0),
    estimated_saving_bytes: reports.reduce((sum, r) => sum + r.estimated_saving_bytes, 0),
    embedded_image_occurrences: reports.reduce((sum, r) => sum + r.embedded_image_occurrences, 0),
    unique_embedded_assets: hashUsage.size,
    duplicate_asset_groups: duplicateAssets.length,
    estimated_duplicate_binary_bytes: duplicateAssets.reduce((sum, x) => sum + x.estimated_duplicate_binary_bytes, 0),
    by_type: byType,
    by_classification: byClassification,
    notes: [
      'Size estimates replace every embedded data image with a representative R2 URL.',
      'Actual Postgres disk recovery also depends on TOAST cleanup and VACUUM after a later migration.',
      'No database writes are performed by this script.'
    ]
  };

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUTPUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(OUTPUT_DIR, 'worksheets.json'), JSON.stringify(reports, null, 2));
  fs.writeFileSync(path.join(OUTPUT_DIR, 'duplicate-assets.json'), JSON.stringify(duplicateAssets, null, 2));

  const columns = [
    'worksheet_id', 'title', 'worksheet_type', 'classification', 'current_bytes',
    'estimated_post_migration_bytes', 'estimated_saving_bytes', 'embedded_image_occurrences',
    'unique_embedded_hashes', 'image_url_count', 'blob_url_count', 'malformed_data_image_count'
  ];
  const csv = [columns.join(',')]
    .concat(reports.map(row => columns.map(column => csvEscape(row[column])).join(',')))
    .join('\n');
  fs.writeFileSync(path.join(OUTPUT_DIR, 'worksheets.csv'), csv);

  console.log(JSON.stringify(summary, null, 2));
  console.log(`\nDetailed output written to ${OUTPUT_DIR}`);
}

main().catch(error => {
  console.error('Worksheet audit failed:', error?.message || error);
  process.exit(1);
});
