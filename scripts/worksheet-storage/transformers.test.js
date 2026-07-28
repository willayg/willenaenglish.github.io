'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  inspectImageValue,
  transformWorksheet,
  validateTransformedWorksheet
} = require('./transformers');

const ONE_PIXEL_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const PUBLIC_BASE = 'https://assets.example.test';

test('inspectImageValue creates a stable content-addressed key', () => {
  const first = inspectImageValue(ONE_PIXEL_PNG);
  const second = inspectImageValue(ONE_PIXEL_PNG);

  assert.equal(first.kind, 'embedded');
  assert.equal(first.sha256, second.sha256);
  assert.match(first.assetKey, /^worksheets\/assets\/sha256\/[a-f0-9]{2}\/[a-f0-9]{64}\.png$/);
});

test('wordtest transformer preserves keys and replaces only embedded src values', () => {
  const source = {
    user_id: 'worksheet-1',
    worksheet_type: 'wordtest',
    words: ['ant, 개미'],
    images: JSON.stringify({
      ant_0: { src: ONE_PIXEL_PNG, word: 'ant', index: 0 },
      bee_1: { src: 'https://example.test/bee.png', word: 'bee', index: 1 },
      cat_2: { src: 'emoji', emoji: '🐈', word: 'cat', index: 2 }
    }),
    settings: JSON.stringify({ font: 'Poppins' })
  };

  const result = transformWorksheet(source, { publicBaseUrl: PUBLIC_BASE });
  const images = JSON.parse(result.worksheet.images);
  const settings = JSON.parse(result.worksheet.settings);

  assert.equal(result.uploads.length, 1);
  assert.match(images.ant_0.src, /^https:\/\/assets\.example\.test\/worksheets\/assets\//);
  assert.match(images.ant_0.asset_key, /^worksheets\/assets\//);
  assert.equal(images.ant_0.word, 'ant');
  assert.equal(images.ant_0.index, 0);
  assert.equal(images.bee_1.src, 'https://example.test/bee.png');
  assert.equal(images.cat_2.src, 'emoji');
  assert.equal(settings.storage_schema_version, 2);
  assert.deepEqual(validateTransformedWorksheet(result.worksheet), {
    valid: true,
    fields_with_embedded_images: []
  });
});

test('flashcard transformer deduplicates identical embedded assets across fields', () => {
  const source = {
    user_id: 'worksheet-2',
    worksheet_type: 'flashcard',
    images: JSON.stringify({
      cards: [{ word: 'apple', image: ONE_PIXEL_PNG }]
    }),
    settings: JSON.stringify({
      layout: '4-card',
      cards: [{ english: 'apple', imageUrl: ONE_PIXEL_PNG }]
    })
  };

  const result = transformWorksheet(source, { publicBaseUrl: PUBLIC_BASE });
  const images = JSON.parse(result.worksheet.images);
  const settings = JSON.parse(result.worksheet.settings);

  assert.equal(result.uploads.length, 1);
  assert.equal(images.cards[0].image, settings.cards[0].imageUrl);
  assert.match(images.cards[0].image, /^https:\/\/assets\.example\.test\/worksheets\/assets\//);
  assert.equal(settings.storage_schema_version, 2);
  assert.equal(result.validation.valid, true);
});

test('non-media worksheet is copied without transformation', () => {
  const source = {
    user_id: 'worksheet-3',
    worksheet_type: 'grammar',
    questions: ['Choose the answer.'],
    answers: ['A']
  };

  const result = transformWorksheet(source, { publicBaseUrl: PUBLIC_BASE });
  assert.deepEqual(result.worksheet, source);
  assert.notEqual(result.worksheet, source);
  assert.equal(result.uploads.length, 0);
});

test('unsupported embedded MIME types are rejected', () => {
  assert.throws(
    () => inspectImageValue('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='),
    /Unsupported worksheet image MIME type/
  );
});
