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
    updated_at: null,
    worksheet_type: 'wordtest',
    title: 'Test',
    words: ['cat'],
    images: JSON.stringify({ cat: DATA }),
    settings: { font: 'Arial' },
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

test('database patch verifies the current complete row before updating', async () => {
  const requests = [];
  const original = row();
  const fetchImpl = async (url, options = {}) => {
    requests.push({ url, options });
    if (!options.method) return { ok: true, status: 200, json: async () => [original] };
    return { ok: true, status: 200, json: async () => [{ user_id: original.user_id }] };
  };
  await patchWorksheet({
    fetchImpl,
    supabaseUrl: 'https://db.test',
    serviceRoleKey: 'secret',
    original,
    patch: { images: '{}' }
  });
  assert.equal(requests.length, 2);
  assert.match(requests[0].url, /select=\*/);
  assert.equal(requests[1].options.method, 'PATCH');
  assert.deepEqual(JSON.parse(requests[1].options.body), { images: '{}' });
});

test('database patch refuses a row changed since the migration read', async () => {
  const original = row();
  const fetchImpl = async () => ({ ok: true, status: 200, json: async () => [{ ...original, title: 'Changed live' }] });
  await assert.rejects(
    patchWorksheet({ fetchImpl, supabaseUrl: 'https://db.test', serviceRoleKey: 'secret', original, patch: { images: '{}' } }),
    /changed since migration read/
  );
});