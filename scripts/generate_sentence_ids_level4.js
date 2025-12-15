// generate_sentence_ids_level4.js
// Scans Games/english_arcade/sample-wordlists-level4/*.json and adds sentence_id (UUID) if missing
const fs = require('fs');
const path = require('path');
const DIR = path.join(process.cwd(), 'Games', 'english_arcade', 'sample-wordlists-level4');
if (!fs.existsSync(DIR)) {
  console.error('Directory not found:', DIR);
  process.exit(2);
}

function uuid() {
  if (typeof require('crypto').randomUUID === 'function') return require('crypto').randomUUID();
  // fallback: simple UUIDv4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const files = fs.readdirSync(DIR).filter(f => f.toLowerCase().endsWith('.json'));
let changed = 0;
for (const f of files) {
  const p = path.join(DIR, f);
  let raw;
  try { raw = fs.readFileSync(p, 'utf8'); } catch (e) { console.error('read error', p, e.message); continue; }
  let data;
  try { data = JSON.parse(raw); } catch (e) { console.error('invalid json', p, e.message); continue; }
  if (!Array.isArray(data)) { console.warn('not array, skipping', p); continue; }
  let modified = false;
  for (const item of data) {
    if (item && typeof item === 'object') {
      if (!item.hasOwnProperty('sentence_id') || !item.sentence_id) {
        item.sentence_id = uuid();
        modified = true;
      }
    }
  }
  if (modified) {
    fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
    console.log('Updated:', p);
    changed++;
  }
}
console.log('Done. Files updated:', changed);
process.exit(0);
