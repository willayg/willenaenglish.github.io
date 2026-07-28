import assert from 'node:assert/strict';
import test from 'node:test';
import { webcrypto } from 'node:crypto';
import { __test } from './index.js';

if (!globalThis.crypto) globalThis.crypto = webcrypto;
if (!globalThis.atob) globalThis.atob = value => Buffer.from(value, 'base64').toString('binary');

const PNG_1X1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

function request(headers = {}) {
  return new Request('https://api.example.com/api/worksheet-assets', { headers });
}

test('reads access token from cookie and bearer header', () => {
  assert.equal(__test.getAccessToken(request({ Cookie: 'sb_access=abc.def.ghi' })), 'abc.def.ghi');
  assert.equal(__test.getAccessToken(request({ Authorization: 'Bearer token-value' })), 'token-value');
});

test('creates a stable SHA-256 asset key', async () => {
  const first = await __test.inspectImageValue(PNG_1X1);
  const second = await __test.inspectImageValue(PNG_1X1);
  assert.equal(first.sha256, second.sha256);
  assert.equal(first.assetKey, second.assetKey);
  assert.match(first.assetKey, /^worksheets\/assets\/sha256\/[0-9a-f]{2}\/[0-9a-f]{64}\.png$/);
});

test('word test transformation removes embedded image and preserves emoji', async () => {
  const worksheet = {
    worksheet_type: 'wordtest',
    images: JSON.stringify({
      ant_0: { src: PNG_1X1, word: 'ant', index: 0 },
      bee_1: { src: 'emoji', emoji: '🐝', word: 'bee', index: 1 },
    }),
    settings: JSON.stringify({ fontSize: 18 }),
  };
  const env = { R2_PUBLIC_BASE: 'https://assets.example.com' };
  const result = await __test.transformWorksheet(worksheet, env);
  const images = JSON.parse(result.worksheet.images);
  assert.equal(result.uploads.length, 1);
  assert.match(images.ant_0.src, /^https:\/\/assets\.example\.com\/worksheets\/assets\//);
  assert.equal(images.bee_1.src, 'emoji');
  assert.equal(__test.containsEmbeddedImage(result.worksheet.images), false);
});

test('dry run deduplicates and makes no R2 request', async () => {
  const inspected = await __test.inspectImageValue(PNG_1X1);
  let touched = false;
  const env = {
    R2_PUBLIC_BASE: 'https://assets.example.com',
    WORKSHEET_ASSETS: {
      head: async () => { touched = true; return null; },
      put: async () => { touched = true; },
    },
  };
  const assets = await __test.persistAssets(env, [inspected], true);
  assert.equal(touched, false);
  assert.equal(assets.length, 1);
  assert.equal(assets[0].dry_run, true);
});

test('live mode reuses an existing R2 object', async () => {
  const inspected = await __test.inspectImageValue(PNG_1X1);
  let puts = 0;
  const env = {
    R2_PUBLIC_BASE: 'https://assets.example.com',
    WORKSHEET_ASSETS: {
      head: async () => ({ key: inspected.assetKey }),
      put: async () => { puts += 1; },
    },
  };
  const assets = await __test.persistAssets(env, [inspected], false);
  assert.equal(puts, 0);
  assert.equal(assets[0].created, false);
});
