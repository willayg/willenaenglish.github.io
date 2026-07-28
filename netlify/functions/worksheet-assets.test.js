'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const crypto = require('node:crypto');
const { inspectImageValue } = require('../../scripts/worksheet-storage/transformers');
const { _test } = require('./worksheet-assets');

const PNG_1X1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

test('parses cookies and resolves access-token cookie', () => {
  const cookies = _test.parseCookies('foo=bar; sb_access=abc.def.ghi; other=value');
  assert.equal(cookies.foo, 'bar');
  assert.equal(cookies.sb_access, 'abc.def.ghi');
  assert.equal(_test.getAccessToken({ headers: { cookie: 'sb_access=abc.def.ghi' } }), 'abc.def.ghi');
});

test('falls back to bearer token', () => {
  assert.equal(
    _test.getAccessToken({ headers: { authorization: 'Bearer token-value' } }),
    'token-value'
  );
});

test('validates upload hash and asset key', () => {
  const inspected = inspectImageValue(PNG_1X1);
  const decoded = _test.decodeUpload({
    data_url: PNG_1X1,
    sha256: inspected.sha256,
    asset_key: inspected.assetKey
  });
  assert.equal(decoded.sha256, inspected.sha256);
  assert.equal(decoded.assetKey, inspected.assetKey);
});

test('rejects upload with altered hash', () => {
  assert.throws(
    () => _test.decodeUpload({ data_url: PNG_1X1, sha256: crypto.randomBytes(32).toString('hex') }),
    /hash mismatch/
  );
});

test('dry run deduplicates identical uploads and makes no S3 request', async () => {
  const inspected = inspectImageValue(PNG_1X1);
  const config = {
    publicBaseUrl: 'https://assets.example.com',
    bucket: 'unused-in-dry-run'
  };
  const assets = await _test.persistAssets([
    { data_url: PNG_1X1, sha256: inspected.sha256, asset_key: inspected.assetKey },
    { data_url: PNG_1X1, sha256: inspected.sha256, asset_key: inspected.assetKey }
  ], config, { dryRun: true });

  assert.equal(assets.length, 1);
  assert.equal(assets[0].dry_run, true);
  assert.equal(assets[0].created, false);
  assert.equal(assets[0].url, `https://assets.example.com/${inspected.assetKey}`);
});
