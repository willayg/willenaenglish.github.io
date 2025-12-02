#!/usr/bin/env node
/**
 * scan_legacy_image_keys.js
 *
 * Utility to scan saved game_data JSON exports or a provided directory of JSON files
 * and report any image URLs/keys that still use legacy prefixes like images/words/ or images/cover/.
 *
 * Usage:
 *   node scripts/scan_legacy_image_keys.js ./exported_games
 *   node scripts/scan_legacy_image_keys.js file1.json file2.json
 *
 * For each file it will:
 *  - Parse JSON (either a single object or array). Accepts objects with a `data` array too.
 *  - Extract any fields named image_url, image, gameImage.
 *  - Normalize to key form (strip protocol + domain + bucket if present).
 *  - Flag if key starts with images/words or images/cover.
 *
 * Output: summary list + suggested normalized key.
 */
const fs = require('fs');
const path = require('path');

function collectJsonFiles(inputs){
  const out = [];
  for(const inp of inputs){
    const stat = fs.statSync(inp);
    if(stat.isDirectory()){
      for(const entry of fs.readdirSync(inp)){
        if(/\.json$/i.test(entry)) out.push(path.join(inp, entry));
      }
    } else if(stat.isFile() && /\.json$/i.test(inp)) {
      out.push(inp);
    }
  }
  return out;
}

function extractPossibleUrls(obj){
  const urls = [];
  function recur(o){
    if(!o || typeof o !== 'object') return;
    for(const [k,v] of Object.entries(o)){
      if(typeof v === 'string' && /image/i.test(k)){
        urls.push(v);
      } else if(Array.isArray(v)){
        v.forEach(recur);
      } else if(v && typeof v === 'object'){
        recur(v);
      }
    }
  }
  recur(obj);
  return urls;
}

function toKey(u){
  if(!u) return '';
  // data URIs irrelevant
  if(/^data:/i.test(u)) return '';
  // If already proxy format
  const mProxy = u.match(/image_proxy\?key=([^&]+)/);
  if(mProxy){
    try { return decodeURIComponent(mProxy[1]); } catch { return mProxy[1]; }
  }
  // Attempt to strip protocol+domain+bucket
  const m = u.match(/^https?:\/\/[^/]+\/(?:[^/]+)\/(.+)$/);
  if(m) return m[1];
  return u.replace(/^\/?+/,'');
}

function normalizeKey(k){
  return k.replace(/^(?:images\/)+/i,'').replace(/^(?:public\/)+/i,'');
}

function run(files){
  const legacy = [];
  for(const f of files){
    let js;
    try { js = JSON.parse(fs.readFileSync(f,'utf8')); } catch(e){ console.warn('Failed parse', f, e.message); continue; }
    const coll = Array.isArray(js) ? js : (Array.isArray(js.data) ? js.data : [js]);
    coll.forEach(rec => {
      const urls = extractPossibleUrls(rec);
      urls.forEach(u => {
        const key = toKey(u);
        if(!key) return;
        if(/^(images\/)+(words|cover)\//i.test(key)){
          legacy.push({ file:f, original:u, key, normalized: normalizeKey(key) });
        }
      });
    });
  }
  if(!legacy.length){
    console.log('No legacy image prefixes found.');
    return;
  }
  console.log('Legacy image keys found:');
  legacy.forEach((r,i)=>{
    console.log(`${i+1}. file=${r.file}\n   original=${r.original}\n   key=${r.key}\n   -> normalized=${r.normalized}`);
  });
  console.log(`\nTotal legacy references: ${legacy.length}`);
  console.log('\nSuggested fix: update stored JSON replacing leading "images/" with "" (empty) for those keys.');
}

const args = process.argv.slice(2);
if(!args.length){
  console.log('Usage: node scripts/scan_legacy_image_keys.js <dir-or-json-files...>');
  process.exit(1);
}
run(collectJsonFiles(args));
