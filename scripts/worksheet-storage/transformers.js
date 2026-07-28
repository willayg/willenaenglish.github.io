'use strict';

const crypto = require('node:crypto');

const DATA_URL_RE = /^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\r\n]+)$/i;
const HTTP_URL_RE = /^https?:\/\//i;

function parseJsonObject(value, fieldName) {
  if (value == null || value === '') return {};
  if (typeof value === 'object' && !Array.isArray(value)) return structuredClone(value);
  if (typeof value !== 'string') {
    throw new TypeError(`${fieldName} must be a JSON object or JSON string`);
  }
  const parsed = JSON.parse(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new TypeError(`${fieldName} must parse to an object`);
  }
  return parsed;
}

function extensionForMime(mimeType) {
  const map = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif'
  };
  const extension = map[String(mimeType || '').toLowerCase()];
  if (!extension) throw new Error(`Unsupported worksheet image MIME type: ${mimeType}`);
  return extension;
}

function inspectImageValue(value) {
  if (typeof value !== 'string') return { kind: 'other', value };
  if (value === 'emoji') return { kind: 'emoji', value };
  if (HTTP_URL_RE.test(value)) return { kind: 'url', url: value };

  const match = value.match(DATA_URL_RE);
  if (!match) return { kind: 'other', value };

  const mimeType = match[1].toLowerCase();
  const binary = Buffer.from(match[2].replace(/\s+/g, ''), 'base64');
  if (!binary.length) throw new Error('Embedded worksheet image is empty');

  const sha256 = crypto.createHash('sha256').update(binary).digest('hex');
  const extension = extensionForMime(mimeType);
  const assetKey = `worksheets/assets/sha256/${sha256.slice(0, 2)}/${sha256}.${extension}`;

  return {
    kind: 'embedded',
    mimeType,
    bytes: binary.length,
    sha256,
    extension,
    assetKey,
    binary,
    dataUrl: value
  };
}

function makeAssetReference(image, publicBaseUrl) {
  if (!image || image.kind !== 'embedded') {
    throw new TypeError('makeAssetReference requires an inspected embedded image');
  }
  const base = String(publicBaseUrl || '').replace(/\/$/, '');
  if (!base) throw new Error('publicBaseUrl is required');

  return {
    kind: 'asset',
    asset_key: image.assetKey,
    url: `${base}/${image.assetKey}`,
    sha256: image.sha256,
    mime_type: image.mimeType,
    bytes: image.bytes
  };
}

function addUpload(uploadMap, image) {
  if (!uploadMap.has(image.sha256)) {
    uploadMap.set(image.sha256, {
      asset_key: image.assetKey,
      sha256: image.sha256,
      mime_type: image.mimeType,
      bytes: image.bytes,
      data_url: image.dataUrl
    });
  }
}

function transformWordTest(worksheet, options) {
  const images = parseJsonObject(worksheet.images, 'images');
  const uploads = new Map();
  const publicBaseUrl = options && options.publicBaseUrl;

  for (const [key, entryValue] of Object.entries(images)) {
    if (!entryValue || typeof entryValue !== 'object' || Array.isArray(entryValue)) continue;
    const entry = { ...entryValue };
    const inspected = inspectImageValue(entry.src);

    if (inspected.kind === 'embedded') {
      const asset = makeAssetReference(inspected, publicBaseUrl);
      addUpload(uploads, inspected);
      entry.src = asset.url;
      entry.asset_key = asset.asset_key;
      entry.sha256 = asset.sha256;
      entry.mime_type = asset.mime_type;
      entry.bytes = asset.bytes;
      images[key] = entry;
    }
  }

  const settings = parseJsonObject(worksheet.settings, 'settings');
  settings.storage_schema_version = 2;

  return {
    worksheet: {
      ...worksheet,
      images: JSON.stringify(images),
      settings: JSON.stringify(settings)
    },
    uploads: Array.from(uploads.values()),
    stats: {
      worksheet_type: 'wordtest',
      unique_assets: uploads.size
    }
  };
}

function collectFlashcardCandidates(value, path = [], output = []) {
  if (typeof value === 'string') {
    const inspected = inspectImageValue(value);
    if (inspected.kind === 'embedded' || inspected.kind === 'url') {
      output.push({ path, inspected });
    }
    return output;
  }
  if (!value || typeof value !== 'object') return output;
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectFlashcardCandidates(item, [...path, index], output));
  } else {
    Object.entries(value).forEach(([key, item]) => collectFlashcardCandidates(item, [...path, key], output));
  }
  return output;
}

function getPathValue(root, path) {
  return path.reduce((value, part) => (value == null ? undefined : value[part]), root);
}

function setPathValue(root, path, nextValue) {
  if (!path.length) throw new Error('Cannot replace root worksheet field');
  let cursor = root;
  for (let i = 0; i < path.length - 1; i += 1) cursor = cursor[path[i]];
  cursor[path[path.length - 1]] = nextValue;
}

function transformFlashcard(worksheet, options) {
  const images = parseJsonObject(worksheet.images, 'images');
  const settings = parseJsonObject(worksheet.settings, 'settings');
  const publicBaseUrl = options && options.publicBaseUrl;
  const uploads = new Map();

  const roots = [
    { name: 'images', value: images },
    { name: 'settings', value: settings }
  ];

  for (const root of roots) {
    const candidates = collectFlashcardCandidates(root.value);
    for (const candidate of candidates) {
      if (candidate.inspected.kind !== 'embedded') continue;
      const asset = makeAssetReference(candidate.inspected, publicBaseUrl);
      addUpload(uploads, candidate.inspected);

      // Preserve the existing object shape for compatibility while replacing
      // the heavy data URL with a normal public URL.
      setPathValue(root.value, candidate.path, asset.url);
    }
  }

  settings.storage_schema_version = 2;

  return {
    worksheet: {
      ...worksheet,
      images: JSON.stringify(images),
      settings: JSON.stringify(settings)
    },
    uploads: Array.from(uploads.values()),
    stats: {
      worksheet_type: 'flashcard',
      unique_assets: uploads.size,
      image_candidates: collectFlashcardCandidates(images).length,
      settings_candidates: collectFlashcardCandidates(settings).length
    }
  };
}

function containsEmbeddedImage(value) {
  if (typeof value === 'string') {
    if (DATA_URL_RE.test(value)) return true;
    try {
      return containsEmbeddedImage(JSON.parse(value));
    } catch {
      return false;
    }
  }
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(containsEmbeddedImage);
  return Object.values(value).some(containsEmbeddedImage);
}

function validateTransformedWorksheet(worksheet) {
  const fields = ['images', 'settings', 'image_data'];
  const remaining = fields.filter(field => containsEmbeddedImage(worksheet[field]));
  return {
    valid: remaining.length === 0,
    fields_with_embedded_images: remaining
  };
}

function transformWorksheet(worksheet, options = {}) {
  if (!worksheet || typeof worksheet !== 'object') throw new TypeError('worksheet is required');
  let result;
  if (worksheet.worksheet_type === 'wordtest') result = transformWordTest(worksheet, options);
  else if (worksheet.worksheet_type === 'flashcard') result = transformFlashcard(worksheet, options);
  else {
    result = {
      worksheet: structuredClone(worksheet),
      uploads: [],
      stats: { worksheet_type: worksheet.worksheet_type || null, unique_assets: 0 }
    };
  }

  const validation = validateTransformedWorksheet(result.worksheet);
  if (!validation.valid) {
    throw new Error(`Transformation left embedded images in: ${validation.fields_with_embedded_images.join(', ')}`);
  }
  return { ...result, validation };
}

module.exports = {
  inspectImageValue,
  makeAssetReference,
  transformWordTest,
  transformFlashcard,
  transformWorksheet,
  validateTransformedWorksheet,
  containsEmbeddedImage,
  getPathValue
};
