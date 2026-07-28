'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  APPLY_CONFIRMATION,
  containsEmbeddedImage,
  parseArgs,
  selectCandidates,
  buildPatch,
  callWorker,
  patchWorksheet
} = require('./migration');

const DATA = 'data:image/png;base64,aGVsbG8=';

function row(overrides = {}) {
  return {
    user_id: '11111111-1111-1111-1111-111111111111',
    updated_at: '2026-07-29T00:00:00.000Z',
    worksheet_type: 'wordtest',
    title: 'Test',
    words: ['cat'],
    images: JSON.stringify({ cat: DATA }),
    settings: JSON.stringify({ font: 'Arial' }),
    image_data: null,
    ...overrides
  };
}

test('apply mode requires the exact confirmation phrase', () => {
  assert.throws(() => parseArgs(['--apply']), /requires --confirm/);
  const parsed = parseArgs(['--apply', `--confirm=${APPLY_CONFIRMATION}`, '--limit=6', '--type=flashcard']);
  assert.equal(parsed.apply, true);
  assert.equal(parsed.limit, 6);
  assert.equal(parsed.type, 'flashcard');
});

test('candidate selection only includes affected supported worksheet types', () => {
  const rows = [row(), row({ user_id: '2', worksheet_type: 'flashcard' }), row({ user_id: '3', worksheet_type: 'reading' }), row({ user_id: '4', images: '{}' })];
  assert.deepEqual(selectCandidates(rows, {}).map(item => item.user_id), ['11111111-1111-1111-1111-111111111111', '2']);
  assert.deepEqual(selectCandidates(rows, { type: 'flashcard' }).map(item => item.user_id), ['2']);
});

test('buildPatch only changes image-bearing migration fields', () => {
  const original = row();
  const transformed = { ...original, images: JSON.stringify({ cat: 'https://worksheet-assets.willenaenglish.com/assets/a.png' }) };
  const patch = buildPatch(original, transformed);
  assert.deepEqual(Object.keys(patch), ['images']);
  assert.equal(containsEmbeddedImage(patch), false);
});

test('buildPatch rejects protected-field changes', () => {
  const original = row();
  const transformed = { ...original, title: 'Changed', images: '{}' };
  assert.throws(() => buildPatch(original, transformed), /protected worksheet field/);
});

test('dry-run worker request cannot write to Supabase', async () => {
  let request;
  const fetchImpl = async (url, options) => {
    request = { url, options };
    return { ok: true, status: 200, json: async () => ({ success: true, worksheet: { ...row(), images: '{}' }, stats: {} }) };
  };
  await callWorker({ fetchImpl, workerUrl: 'https://worker.test', accessToken: 'token', worksheet: row(), dryRun: true });
  const body = JSON.parse(request.options.body);
  assert.equal(body.dry_run, true);
  assert.equal(request.url, 'https://worker.test');
});

test('database patch uses optimistic updated_at filter and only supplied fields', async () => {
  let request;
  const fetchImpl = async (url, options) => {
    request = { url, options };
    return { ok: true, status: 200, json: async () => [{ user_id: row().user_id }] };
  };
  await patchWorksheet({
    fetchImpl,
    supabaseUrl: 'https://db.test',
    serviceRoleKey: 'secret',
    original: row(),
    patch: { images: '{}' }
  });
  assert.match(request.url, /user_id=eq\./);
  assert.match(request.url, /updated_at=eq\./);
  assert.deepEqual(JSON.parse(request.options.body), { images: '{}' });
});
