// Test Input grid module
// MVP goals: class filter, load students, dynamic columns, multi-cell paste, keyboard nav, totals by maxima, save/load via Netlify function

const API = '/.netlify/functions/test_admin';
const STUDENT_API = '/.netlify/functions/teacher_admin';

// Default columns for the sample provided (no hard-coded maxima; show 0 in UI when unset)
const DEFAULT_COLUMNS = [
  { key: 'phonics', label: 'Phonics (P)', type: 'number' },
  { key: 'listening', label: 'Listening (L)', type: 'number' },
  { key: 'vocab', label: 'Vocab (V)', type: 'number' },
  { key: 'grammar', label: 'Grammar (G)', type: 'number' },
  { key: 'gw', label: 'Grammar/Write (GW)', type: 'number' },
  { key: 'write', label: 'Write (W)', type: 'number' },
  { key: 'reading', label: 'Reading (R)', type: 'number' },
  { key: 'speaking', label: 'Speaking (S)', type: 'number' },
  { key: 'total', label: 'Total', type: 'computed-total' },
  { key: 'final_est', label: 'Final Score Est', type: 'computed-percent' }
];

// Fixed class ordering (case-insensitive); unspecified classes fall back after these in alpha order
const CLASS_ORDER = [
  'brown','stanford','manchester','melbourne','new york','hawaii','boston','paris','sydney','berkeley','chicago','london','cambridge','yale','trinity','washington','princeton','mit','harvard'
];

// Consistent class name ordering helper
function compareClasses(a, b) {
  const A = String(a||'').toLowerCase();
  const B = String(b||'').toLowerCase();
  const ai = CLASS_ORDER.indexOf(A);
  const bi = CLASS_ORDER.indexOf(B);
  if (ai !== -1 || bi !== -1) {
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  }
  return String(a||'').localeCompare(String(b||''));
}
function sortClassesList(list) {
  const arr = (list||[]).slice();
  arr.sort(compareClasses);
  return arr;
}

// State
let currentTest = null; // { id, name, date, columns }
let students = []; // [{id, username, name, korean_name, class}]
let rows = []; // [{ user_id, data: { key: value } }]

// Elements
const el = (id) => document.getElementById(id);
const classFilter = null; // removed left class filter
const search = el('search');
const gridHead = el('gridHead');
const gridBody = el('gridBody');
const gridFoot = el('gridFoot');
const testPicker = el('testPicker'); // deprecated in UI; kept for compatibility if present
const testName = el('testName');
const testDate = el('testDate');
// Term period inputs (month range)
const termFrom = el('termFrom');
const termTo = el('termTo');
const testMeta = el('testMeta');
const msg = el('msg');
const testMonthFilter = el('testMonthFilter');
const gridMenu = document.getElementById('gridMenu');
const saveBtn = el('saveBtn');
const addColumnBtn = el('addColumnBtn');
const exportCsvBtn = el('exportCsvBtn');
const testClassFilter = el('testClassFilter');
const computedIndicator = el('computedIndicator');
// Load modal elements
const openLoadBtn = document.getElementById('openLoadBtn');
const loadModalBg = document.getElementById('loadModalBg');
const loadCloseBtn = document.getElementById('loadCloseBtn');
const loadSearch = document.getElementById('loadSearch');
const loadList = document.getElementById('loadList');
const loadMsg = document.getElementById('loadMsg');
// Import modal elements
const importModalBg = document.getElementById('importModalBg');
const importTableBtn = document.getElementById('importTableBtn');
const pasteTableInput = document.getElementById('pasteTableInput');
const importTestName = document.getElementById('importTestName');
const importTestDate = document.getElementById('importTestDate');
const perClassSwitch = document.getElementById('perClassSwitch');
const importSummary = document.getElementById('importSummary');
const importPreviewWrap = document.getElementById('importPreviewWrap');
const importPreview = document.getElementById('importPreview');
const importCancel = document.getElementById('importCancel');
const importParse = document.getElementById('importParse');
const importConfirm = document.getElementById('importConfirm');
const importMsg = document.getElementById('importMsg');
const strictTsvSwitch = document.getElementById('strictTsvSwitch');
const importBusy = document.getElementById('importBusy');
// Grouped test picker state
let testGroups = {}; // key `${name}||${date}` -> { name, date, items: [{ id, class }] }
let activeTestGroupKey = null;
// Remember the most recent import's group and created tests so we can limit UI to only what was imported
let lastImported = { groupKey: null, tests: [] }; // tests: [{id, class}]
let selection = null; // kind: 'body'|'foot'; body: {startRow,startCol,endRow,endCol} | foot: {startCol,endCol}
let computedLocked = true; // allow unlock via context menu
// Live autosave batching
const dirty = new Map(); // user_id -> true (changed)
let saveTimer = null;
const refreshBtn = el('refreshBtn');
const campaignModalBg = document.getElementById('campaignModalBg');
const campaignName = document.getElementById('campaignName');
const campaignDate = document.getElementById('campaignDate');
const campaignClassList = document.getElementById('campaignClassList');
const campaignSelectAll = document.getElementById('campaignSelectAll');
const campaignClear = document.getElementById('campaignClear');
const campaignCancel = document.getElementById('campaignCancel');
const campaignCreate = document.getElementById('campaignCreate');
const campaignMsg = document.getElementById('campaignMsg');
const colMenu = document.getElementById('colMenu');
let colMenuIndex = null;
let metaTimer = null;
// Per-class comments (not persisted server-side yet; stored in test metadata via a special column on save)
const classComments = new Map(); // key: class or '' -> comment text
let commentSaveTimer = null;

// Stable alphabetical sort for students (by name, then korean_name, then username, then id)
function sortStudents(arr) {
  const safe = (v) => (v==null ? '' : String(v));
  return (arr||[]).slice().sort((a,b)=>{
    const an = safe(a.name).toLowerCase();
    const bn = safe(b.name).toLowerCase();
    if (an !== bn) return an.localeCompare(bn);
    const ak = safe(a.korean_name).toLowerCase();
    const bk = safe(b.korean_name).toLowerCase();
    if (ak !== bk) return ak.localeCompare(bk);
    const au = safe(a.username).toLowerCase();
    const bu = safe(b.username).toLowerCase();
    if (au !== bu) return au.localeCompare(bu);
    const ai = safe(a.id);
    const bi = safe(b.id);
    return String(ai).localeCompare(String(bi));
  });
}

// --- Lightweight metadata carrier for class comments ---
// We persist class comments inside the test.columns array on one existing column object
// (prefer the computed-total column). We attach a plain object property `_classComments`
// shaped as: { "<classNameOrBlank>": "comment text", ... }
function getMetaCarrierColumn(cols) {
  if (!Array.isArray(cols) || !cols.length) return null;
  // Prefer computed-total, then computed-percent, else first column
  let c = cols.find(x => x && x.type === 'computed-total')
       || cols.find(x => x && x.type === 'computed-percent')
       || cols[0];
  return c || null;
}
function loadCommentsFromColumns(test) {
  const cols = columnsFor(test);
  const carrier = getMetaCarrierColumn(cols);
  const key = (test && (test.class || '')) || '';
  // Preferred: per-test single comment
  if (carrier && carrier._comment !== undefined) {
    classComments.set(key, String(carrier._comment || ''));
  }
  // Term period (month range) metadata embedded in carrier
  if (carrier && (carrier._term_from || carrier._term_to)) {
    if (carrier._term_from) test.term_from = String(carrier._term_from);
    if (carrier._term_to) test.term_to = String(carrier._term_to);
  }
  // Backward-compat: if legacy map exists, merge as fallback
  const map = carrier && carrier._classComments;
  if (map && typeof map === 'object') {
    for (const [k, v] of Object.entries(map)) {
      if (!classComments.has(k)) classComments.set(k, String(v || ''));
    }
  }
}
function persistCommentsToColumns(test) {
  const cols = columnsFor(test);
  const carrier = getMetaCarrierColumn(cols);
  if (!carrier) return cols; // nothing to do
  const key = (test && (test.class || '')) || '';
  const val = classComments.get(key) || '';
  carrier._comment = String(val);
  // Persist term period month range in carrier
  try {
    const tf = (typeof document !== 'undefined' && document.getElementById) ? (document.getElementById('termFrom')?.value || '') : (test.term_from || '');
    const tt = (typeof document !== 'undefined' && document.getElementById) ? (document.getElementById('termTo')?.value || '') : (test.term_to || '');
    if (tf) carrier._term_from = tf; else if (carrier._term_from) delete carrier._term_from;
    if (tt) carrier._term_to = tt; else if (carrier._term_to) delete carrier._term_to;
  } catch {}
  if (carrier._classComments) delete carrier._classComments; // stop writing legacy structure
  if (test && test.columns && test.columns !== cols) test.columns = cols;
  return cols;
}

// ---------- Import Modal + Parser ----------
function openImportModal() {
  importMsg.textContent = '';
  importSummary.textContent = '';
  importPreviewWrap.style.display = 'none';
  importPreview.innerHTML = '';
  pasteTableInput.value = '';
  importTestName.value = testName.value || `Test ${new Date().toISOString().slice(0,10)}`;
  importTestDate.value = (testDate && testDate.value) || new Date().toISOString().slice(0,10);
  importConfirm.disabled = true;
  importModalBg.style.display = 'flex';
}
function closeImportModal() { importModalBg.style.display = 'none'; }

// Heuristics to map header labels to keys
const HEADER_MAP = [
  // Library grade (text) columns first so they don't get misinterpreted as numeric maxima
  { re: /독서|book\s*reading|reading\s*grade/i, key: 'lib_reading', label: '독서', type: 'text' },
  { re: /raz[-\s]*kids|raz\b/i, key: 'lib_raz', label: 'Raz-kids', type: 'text' },
  { re: /시간엄수|punctual|time\s*keeping/i, key: 'lib_punctuality', label: '시간엄수', type: 'text' },
  // Test numeric columns
  { re: /phonics|^p\b/i, key: 'phonics', label: 'Phonics (P)', type: 'number' },
  { re: /listen|^l\b/i, key: 'listening', label: 'Listening (L)', type: 'number' },
  { re: /vocab|^v\b/i, key: 'vocab', label: 'Vocab (V)', type: 'number' },
  { re: /grammar\b(?!\/write)|\bg\b/i, key: 'grammar', label: 'Grammar (G)', type: 'number' },
  { re: /grammar\s*\/\s*write|gw\b/i, key: 'gw', label: 'Grammar/Write (GW)', type: 'number' },
  { re: /write\b|\bw\b/i, key: 'write', label: 'Write (W)', type: 'number' },
  { re: /read|\br\b/i, key: 'reading', label: 'Reading (R)', type: 'number' },
  { re: /speak|\bs\b/i, key: 'speaking', label: 'Speaking (S)', type: 'number' },
  { re: /final|estimate|percent/i, key: 'final_est', label: 'Final Score Est', type: 'computed-percent' }
];
const IGNORE_TOTAL_RE = /total|sum|final|estimate|percent/i;

const ALLOWED_GRADES = new Set(['A+','A','A-','B+','B','B-','C+','C','C-','D+','D','D-','F']);
function normalizeGrade(val) {
  if (!val) return '';
  let t = String(val).trim().toUpperCase();
  t = t.replace(/[^A-F+\-]/g,'');
  // Collapse multiple plus/minus
  t = t.replace(/([+\-]){2,}/g,'$1');
  if (!ALLOWED_GRADES.has(t)) return '';
  return t;
}

function normalizeCell(s) {
  if (s == null) return '';
  const t = String(s).trim();
  if (t === '' || t === '-') return '';
  if (/^#?error!?$/i.test(t)) return '';
  return t;
}
function parseNumber(val) {
  if (val == null || val === '') return '';
  const m = String(val).match(/-?[0-9]+(?:\.[0-9]+)?/);
  if (!m) return '';
  const num = Number(m[0]);
  return Number.isFinite(num) ? num : '';
}

function splitRows(text) {
  return (text || '')
    .replace(/\r\n?/g, '\n')
    .split(/\n+/)
    .filter(l => l.trim().length);
}

function splitCols(line) {
  // Strict mode: only split on tabs to preserve blanks between tab cells
  const strict = !!strictTsvSwitch?.checked;
  if (strict || line.includes('\t')) return line.split('\t');
  // Fallback: CSV or runs of >=2 spaces
  return line.split(/,|\s{2,}/);
}

function detectHeaderAndCols(lines, splitter = splitCols) {
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    let parts = splitter(lines[i] || '');
    if (parts.length === 1 && typeof parts[0] === 'string' && parts[0].includes('\t')) parts = parts[0].split('\t');
    const joined = parts.join(' ');
    const hit = HEADER_MAP.filter(h => h.re.test(joined)).length;
    if (hit >= 3 || /name|이름/i.test(joined)) {
      return { headerIndex: i, headerCols: parts };
    }
  }
  let parts0 = splitter(lines[0] || '');
  if (parts0.length === 1 && typeof parts0[0] === 'string' && parts0[0].includes('\t')) parts0 = parts0[0].split('\t');
  return { headerIndex: 0, headerCols: parts0 };
}

function buildColumnDefsFromHeaderCols(headerCols) {
  // Build index map: header cell -> def or ignore
  const indexToDef = new Map();
  for (let i = 0; i < headerCols.length; i++) {
    const t = (headerCols[i] || '').toString().trim();
    if (!t) continue;
    if (IGNORE_TOTAL_RE.test(t)) { indexToDef.set(i, { type: 'ignore' }); continue; }
    const m = HEADER_MAP.find(h => h.re.test(t));
    if (m) indexToDef.set(i, { ...m });
  }
  // Preserve order based on appearance; include text (library) columns before numeric totals
  const cols = [];
  [...indexToDef.entries()].forEach(([i, def]) => {
    if (def.type === 'number' || def.type === 'text') cols.push({ key: def.key, label: def.label, type: def.type });
  });
  if (cols.some(c => c.type === 'number')) {
    if (!cols.some(c => c.type === 'computed-total')) cols.push({ key: 'total', label: 'Total', type: 'computed-total' });
    if (!cols.some(c => c.key === 'final_est')) cols.push({ key: 'final_est', label: 'Final Score Est', type: 'computed-percent' });
  }
  return { cols: (cols.length ? cols : DEFAULT_COLUMNS.slice()), indexToDef };
}

function parsePastedTable(text) {
  const lines = splitRows(text);
  if (!lines.length) throw new Error('Nothing to parse');
  const forceTab = lines.some(l => l && l.includes('\t'));
  const splitter = (line) => {
    if (forceTab) return (line || '').split('\t');
    return splitCols(line || '');
  };
  const { headerIndex, headerCols } = detectHeaderAndCols(lines, splitter);
  const built = buildColumnDefsFromHeaderCols(headerCols);
  const cols = built.cols;
  const indexToDef = built.indexToDef;
  const scoreCols = cols.filter(c => c.type === 'number');
  const headerNumericIdx = [...indexToDef.entries()].filter(([,d])=> d && d.type==='number').map(([i])=> i);
  const useFallbackR2L = headerNumericIdx.length < 3; // if we didn't detect enough numeric columns from header
  const outRows = [];
  const classMaxima = new Map(); // class -> { key->max }
  let currentClass = '';
  let lastClassSeen = '';
  const pendingClasses = new Set(); // contiguous classes since last maxima

  const hasHangul = (s) => /[\u3131-\uD79D\uAC00-\uD7AF]/.test(String(s));

  // Determine core meta column indexes dynamically
  const nameIdx = headerCols.findIndex(h => /name/i.test(h));
  const koreanIdx = headerCols.findIndex(h => /이름/.test(h));
  const classIdx = headerCols.findIndex(h => /(^|\b)(class|반)(\b|$)/i.test(h) && !/다음/.test(h));
  const nextClassIdx = headerCols.findIndex(h => /다음반|next\s*class|next\b/i.test(h));
  // Library text column indices for normalization
  const libColInfo = [];
  headerCols.forEach((h, idx) => {
    const def = indexToDef.get(idx);
    if (def && def.type === 'text' && /^lib_/.test(def.key)) libColInfo.push({ idx, key: def.key });
  });

  for (let i = headerIndex + 1; i < lines.length; i++) {
  let parts = splitter(lines[i] || '');
  if (parts.length === 1 && typeof parts[0] === 'string' && parts[0].includes('\t')) parts = parts[0].split('\t');
    const joined = parts.join(' ').trim();
    if (!joined) continue;

  // Class banners: exactly one non-empty, alphabetic token; rest blank
  const nonEmptyCells = parts.map(normalizeCell).filter(Boolean);
  const isBanner = nonEmptyCells.length === 1 && /^[A-Za-z][A-Za-z\s-]*$/.test(nonEmptyCells[0]) && !/name|phonics|listening|vocab|grammar|write|reading|speaking/i.test(nonEmptyCells[0]);
  if (isBanner) { currentClass = joined; pendingClasses.clear(); continue; }

    // Meta columns
  const name = normalizeCell(parts[nameIdx >=0 ? nameIdx : 0] || '');
  const korean = normalizeCell(parts[koreanIdx >=0 ? koreanIdx : 1] || '');
  const klass = normalizeCell(parts[classIdx >=0 ? classIdx : 2] || '') || currentClass || '';
  const nextClass = normalizeCell(parts[nextClassIdx >=0 ? nextClassIdx : -1] || '');

    // Treat empty-name numeric rows as maxima rows for the class
    if (!name) {
      if (!useFallbackR2L) {
        const numsCount = parts.reduce((n, c, idx) => {
          const def = indexToDef.get(idx);
          if (!def || def.type !== 'number') return n;
          const v = parseNumber(normalizeCell(c));
          return n + (v === '' ? 0 : 1);
        }, 0);
        if (numsCount >= Math.max(3, Math.floor(scoreCols.length / 2))) {
          const m = {};
          for (let ci = 0; ci < parts.length; ci++) {
            const def = indexToDef.get(ci);
            if (!def || def.type !== 'number') continue; // skip totals/percent/ignored
            const v = parseNumber(normalizeCell(parts[ci]));
            if (v !== '') m[def.key] = v;
          }
          if (pendingClasses.size) {
            pendingClasses.forEach(cls => { classMaxima.set(cls, m); });
          } else {
            const assoc = klass || currentClass || lastClassSeen || '';
            classMaxima.set(assoc, m);
          }
          pendingClasses.clear();
          continue;
        }
      } else {
        // Fallback maxima: right-align numeric tokens to score columns
        const nums = parts.map(c=> parseNumber(normalizeCell(c))).filter(v=> v!=='' && Number.isFinite(v));
        if (nums.length >= Math.max(3, Math.floor(scoreCols.length / 2))) {
          const m = {};
          const take = Math.min(nums.length, scoreCols.length);
          for (let k=0; k<take; k++) {
            const c = scoreCols[scoreCols.length-1-k];
            const v = nums[nums.length-1-k];
            m[c.key] = v;
          }
          if (pendingClasses.size) {
            pendingClasses.forEach(cls => { classMaxima.set(cls, m); });
          } else {
            const assoc = klass || currentClass || lastClassSeen || '';
            classMaxima.set(assoc, m);
          }
          pendingClasses.clear();
          continue;
        }
      }
    }

    // Student row mapping
    const data = {};
    if (!useFallbackR2L) {
      // Respect blanks per column index; ignore totals
      for (let ci = 0; ci < parts.length; ci++) {
        const def = indexToDef.get(ci);
        if (!def) continue;
        if (def.type === 'number') {
          const v = parseNumber(normalizeCell(parts[ci]));
          if (v !== '') data[def.key] = v; else data[def.key] = '';
        }
      }
    } else {
      // Fallback: right-align numeric tokens (preserves late columns, can't preserve internal blanks)
      const nums = parts.map(c=> parseNumber(normalizeCell(c))).filter(v=> v!=='' && Number.isFinite(v));
      // Ignore trailing two totals if count is obviously larger than score columns
      const trimmed = nums.length >= scoreCols.length + 2 ? nums.slice(0, nums.length - 2) : nums;
      const take = Math.min(trimmed.length, scoreCols.length);
      for (let k=0; k<take; k++) {
        const c = scoreCols[scoreCols.length-1-k];
        const v = trimmed[trimmed.length-1-k];
        data[c.key] = v;
      }
    }
    // derived
    data.total = computeTotal(data, cols);
    data.final_est = computePercent(data, cols);

    // Skip obvious header repeats
    if (/name/i.test(name)) continue;
    // Skip rows with no meta and no numeric data
    const valCount = Object.values(data).filter(v => v !== '' && v != null).length;
    if (!name && valCount === 0) continue;

  // Normalize any library grade text values
  libColInfo.forEach(info => {
    const raw = normalizeCell(parts[info.idx] || '');
    const g = normalizeGrade(raw);
    if (g) data[info.key] = g; else if (raw) data[info.key] = ''; // keep blanks for unrecognized
  });

  outRows.push({ meta: { name: (name || '').trim(), korean_name: korean || '', class: klass, next_class: nextClass }, data });
  if (klass) { lastClassSeen = klass; pendingClasses.add(klass); }
  }

  // Determine a reasonable global maxima:
  // - If a blank-class key ('') exists, use that (sheet without explicit class banners)
  // - Else, if exactly one class has maxima, use that as global (common case: single-class paste)
  // - Else, if multiple classes share identical maxima shapes/values, use one of them
  let globalMaxima = null;
  const entries = Array.from(classMaxima.entries()).filter(([k])=> true);
  const emptyKey = classMaxima.get('');
  if (emptyKey) {
    globalMaxima = emptyKey;
  } else if (entries.length === 1) {
    globalMaxima = entries[0][1];
  } else if (entries.length > 1) {
    const serialized = entries.map(([,m]) => JSON.stringify(m)).filter(Boolean);
    const uniq = Array.from(new Set(serialized));
    if (uniq.length === 1) globalMaxima = JSON.parse(uniq[0]);
  }
  if (globalMaxima) cols.forEach(c => { if (c.type === 'number' && globalMaxima[c.key] != null) c.max = globalMaxima[c.key]; });

  // Group by class and attach group maxima (if present)
  const groups = new Map();
  for (const r of outRows) {
    const key = (r.meta.class || '').trim();
    const bucket = groups.get(key) || { rows: [], maxima: classMaxima.get(key) || null };
    bucket.rows.push(r);
    groups.set(key, bucket);
  }
  return { columns: cols, rows: outRows, groups, headerCols, globalMaxima };
}

function renderImportPreview(parsed) {
  const cols = parsed.columns;
  const head = `<thead><tr>${['Name','Korean','Class','Next Class', ...cols.map(c=>c.label)].map(h=>`<th>${h}</th>`).join('')}</tr></thead>`;
  const bodyRows = parsed.rows.slice(0, 100).map(r => {
    const vals = cols.map(c => r.data[c.key] ?? '');
    return `<tr><td>${r.meta.name||''}</td><td>${r.meta.korean_name||''}</td><td>${r.meta.class||''}</td><td>${r.meta.next_class||''}</td>${vals.map(v=>`<td>${v}</td>`).join('')}</tr>`;
  }).join('');
  const body = `<tbody>${bodyRows}</tbody>`;
  importPreview.innerHTML = head + body;
  importPreviewWrap.style.display = 'block';
}

let lastParsed = null;
async function handleParseClick() {
  importMsg.style.color = '#334155'; importMsg.textContent = 'Parsing…';
  try {
    const parsed = parsePastedTable(pasteTableInput.value || '');
    lastParsed = parsed;
    renderImportPreview(parsed);
    const classes = Array.from(parsed.groups.keys()).filter(Boolean);
    const total = parsed.rows.length;
    // Diagnostics: show recognized header mapping and whether strict mode is on
    const diagCols = parsed.columns.filter(c => c.type === 'number').map(c => c.label).join(' • ');
    const hdrCount = (parsed.headerCols || []).length;
    const sampleRow = (pasteTableInput.value || '').split(/\r?\n/).find(l=> l && !/name|이름/i.test(l)) || '';
    const sampleCount = (sampleRow && sampleRow.includes('\t')) ? sampleRow.split('\t').length : sampleRow.split(/,|\s{2,}/).length;
    // Detected maxima summary
    const fmtMax = (m) => {
      if (!m) return '(none)';
      const keys = parsed.columns.filter(c=>c.type==='number').map(c=>c.key);
      return keys.map(k=> (m[k]??'')).filter(v=> v!=='' && v!=null).join(', ');
    };
    const perClassMax = Array.from(parsed.groups.entries())
      .map(([k,b])=> ({ k: k||'(no class)', m: b.maxima }))
      .filter(x=> !!x.m)
      .map(x=> `${x.k}: ${fmtMax(x.m)}`)
      .join(' • ');
    const globalMax = parsed.globalMaxima ? fmtMax(parsed.globalMaxima) : '';
    importSummary.innerHTML = `Detected <b>${classes.length || 1}</b> class(es) • <b>${total}</b> student rows.<br/>` +
      `Strict TSV: <b>${strictTsvSwitch?.checked ? 'On' : 'Off'}</b><br/>` +
      `Header cells: ${hdrCount} • Sample row cells: ${sampleCount}<br/>` +
      `Score columns: ${diagCols || '(none)'}<br/>` +
      (perClassMax ? `Per-class maxima: ${perClassMax}<br/>` : '') +
      (globalMax && !perClassMax ? `Global maxima: ${globalMax}<br/>` : '');
    importConfirm.disabled = false;
    importMsg.textContent = '';
  } catch (e) {
    importMsg.style.color = '#b91c1c'; importMsg.textContent = e.message || 'Parse failed';
    importConfirm.disabled = true;
  }
}

async function handleImportConfirm() {
  if (!lastParsed) return;
  importMsg.style.color = '#334155'; importMsg.textContent = 'Importing…';
  // Busy UI on
  if (importBusy) { importBusy.style.display = 'flex'; }
  importConfirm.disabled = true; importCancel.disabled = true; importParse.disabled = true;
  const name = (importTestName.value || 'Imported Test').trim();
  const date = importTestDate.value || getDesiredTestDate();

  // Strategy: create a test per class if switch is on, else one test with class blank
  const perClass = !!perClassSwitch?.checked;
  const groups = perClass ? lastParsed.groups : new Map([[ '', lastParsed.rows ]]);
  let createdCount = 0, upsertedTotal = 0, failed = 0;
  const createdItems = []; // [{id, class}]

  // Prefetch global students with a higher limit to avoid 100-row cap
  let allStudents = [];
  try {
    const url = new URL(`${STUDENT_API}`, location.origin);
    url.searchParams.set('action', 'list_students');
    url.searchParams.set('limit', '500');
    const sRes = await fetch(url.toString(), { credentials: 'include', cache: 'no-store' });
    const sData = await sRes.json();
    if (sRes.ok && sData.success && Array.isArray(sData.students)) allStudents = sData.students;
  } catch {}
  // Build tolerant name indexes (allow multiple entries per name)
  const korMap = new Map(); // lower(korean) -> [students]
  const engMap = new Map(); // lower(english) -> [students]
  const pushMap = (map, key, val) => { const k = (key||'').toString().trim().toLowerCase(); if (!k) return; const arr = map.get(k) || []; arr.push(val); map.set(k, arr); };
  allStudents.forEach(s => { pushMap(korMap, s.korean_name, s); pushMap(engMap, s.name, s); });
  let unmatchedTotal = 0;
  let unmatchedByClass = [];
  for (const [klass, bucket] of groups.entries()) {
    const arr = Array.isArray(bucket?.rows) ? bucket.rows : bucket;
    try {
      // Clone columns per class so we can inject per-class maxima if available
      const classCols = JSON.parse(JSON.stringify(lastParsed.columns));
      const gMax = bucket?.maxima || lastParsed.globalMaxima || null;
      if (gMax) classCols.forEach(c => { if (c.type === 'number' && gMax[c.key] != null) c.max = gMax[c.key]; });
      // Embed term metadata into columns for persistence
      (function embedTerm(cols){ const carrier = getMetaCarrierColumn(cols); if (!carrier) return; const tf = (termFrom && termFrom.value) || ''; const tt = (termTo && termTo.value) || ''; if (tf) carrier._term_from = tf; if (tt) carrier._term_to = tt; })(classCols);
      const payload = { name, date, class: perClass ? (klass || null) : (testClassFilter && testClassFilter.value) || null, columns: classCols,
        term_from: (termFrom && termFrom.value) || null,
        term_to: (termTo && termTo.value) || null
      };
      const crt = await api('create_test', payload);
  const test = crt.test;
  createdItems.push({ id: test.id, class: payload.class || '' });
      // Name matching using global index, prefer same class if available
      const entries = arr.map(r => {
        const wantClass = payload.class || r.meta.class || '';
        const korList = r.meta.korean_name ? (korMap.get(String(r.meta.korean_name).trim().toLowerCase()) || []) : [];
        const engList = (!korList.length && r.meta.name) ? (engMap.get(String(r.meta.name).trim().toLowerCase()) || []) : [];
        const pickSameClass = (arr) => arr.find(s => (s.class||'').toLowerCase() === (wantClass||'').toLowerCase()) || arr[0];
        const chosen = korList.length ? pickSameClass(korList) : (engList.length ? pickSameClass(engList) : null);
        const user = chosen || {};
        const snapshot = {
          __snap_username: user.username || '',
          __snap_name: r.meta.name || user.name || '',
          __snap_korean: r.meta.korean_name || user.korean_name || '',
          __snap_class: payload.class || r.meta.class || user.class || '',
          __snap_next_class: r.meta.next_class || ''
        };
        const data = { ...r.data };
        // Clamp numbers to maxima if defined
        classCols.forEach(c => {
          if (c.type === 'number' && typeof c.max === 'number') {
            const v = Number(data[c.key]);
            if (!isNaN(v)) data[c.key] = Math.max(0, Math.min(v, c.max));
          }
        });
        // Recompute derived for consistency
        data.total = computeTotal(data, classCols);
        data.final_est = computePercent(data, classCols);
        return { user_id: user.id || null, data: { ...data, ...snapshot }, _meta: r.meta };
      });
      const matched = entries.filter(e => !!e.user_id).map(({_meta, ...rest}) => rest);
      const unmatched = entries.filter(e => !e.user_id).map(e => e._meta);
      if (unmatched.length) {
        unmatchedTotal += unmatched.length;
        unmatchedByClass.push({ class: payload.class || '(no class)', count: unmatched.length, samples: unmatched.slice(0,3) });
      }
      if (matched.length === 0) {
        // No matches for this class; skip upsert to avoid 400
        continue;
      }

      const res = await api('upsert_entries', { test_id: test.id, entries: matched });
      createdCount += 1; upsertedTotal += (res?.upserted || 0); failed += (res?.failed || 0);
    } catch (e) {
      failed += 1;
    }
  }
  importMsg.style.color = '#065f46';
  let extra = '';
  if (unmatchedTotal) {
    const clsTxt = unmatchedByClass.map(c => `${c.class}: ${c.count}`).join(', ');
    extra = ` Unmatched: ${unmatchedTotal} (${clsTxt}).`;
  }
  importMsg.textContent = `Imported ${createdCount} test(s), ${upsertedTotal} entry(ies).` + (failed ? ` Failed groups: ${failed}.` : '') + extra;
  // Busy UI off and close modal on success
  if (importBusy) { importBusy.style.display = 'none'; }
  importCancel.disabled = false; importParse.disabled = false; // leave confirm disabled
  // If at least one test created or upserted, close the modal
  if (createdCount > 0 || upsertedTotal > 0) {
    try { closeImportModal(); } catch {}
  }
  // Optionally load the first created group's test into the grid: if per-class off, we created 1
  try {
    await loadTests();
    // Prefer showing only the classes from this import session
    const groupKey = `${name}||${date}`;
    if (createdItems.length && testGroups[groupKey]) {
      lastImported = { groupKey, tests: createdItems.slice() };
      activeTestGroupKey = groupKey;
      if (testPicker) testPicker.value = groupKey;
  const classes = sortClassesList(Array.from(new Set(createdItems.map(it=> it.class).filter(Boolean))));
      if (testClassFilter) {
        testClassFilter.disabled = false;
        testClassFilter.innerHTML = classes.length ? classes.map(c=>`<option value="${c}">${c}</option>`).join('') : '<option value="">(no class)</option>';
      }
      // Load the first created test explicitly
      await loadTestById(createdItems[0].id);
    } else {
      // Fallback to newest group behavior if nothing created (shouldn't happen)
      const keys = Object.keys(testGroups||{});
      if (keys.length) {
        const firstKey = keys[0];
        activeTestGroupKey = firstKey;
        if (testPicker) testPicker.value = firstKey;
        const items = (testGroups[firstKey]?.items||[]);
        const firstItem = items[0];
        if (firstItem?.id) await loadTestById(firstItem.id);
      }
    }
  } catch {
    // On failure, keep the modal open and show message
  } finally {
    if (importBusy) { importBusy.style.display = 'none'; }
    importCancel.disabled = false; importParse.disabled = false;
  }
}

function sumMax(columns) {
  return columns.filter(c => c.type === 'number').reduce((acc,c)=> acc + (Number(c.max)||0), 0);
}

function computeTotal(data, columns) {
  let t = 0;
  for (const c of columns) {
    if (c.type !== 'number') continue;
    const v = Number(data[c.key]);
    if (!isNaN(v)) t += v;
  }
  return t;
}

function computePercent(data, columns) {
  const t = computeTotal(data, columns);
  const max = sumMax(columns);
  if (!max) return 0;
  return Math.round((t / max) * 1000) / 10; // 1 decimal place
}

function columnsFor(test) {
  return (test?.columns && Array.isArray(test.columns) && test.columns.length)
    ? test.columns
    : DEFAULT_COLUMNS;
}

function renderHead(cols) {
  const fixed = ['Name','Korean Name','Class'];
  const thFixed = fixed.map(t=>`<th class="id-col">${t}</th>`).join('');
  const thDyn = cols.map((c, idx)=>`<th data-col="${idx}" class="col-head">${c.label}</th>`).join('');
  gridHead.innerHTML = `<tr>${thFixed}${thDyn}</tr>`;
}

function renderFoot(cols) {
  const maxCells = cols.map((c, i)=>{
    if (c.type === 'number') {
      const display = (typeof c.max === 'number') ? c.max : 0;
      return `<td class="max-cell" data-col="${i}" contenteditable="true">${display}</td>`;
    }
    if (c.type === 'computed-total') return `<td class="max-sum">${sumMax(cols)}</td>`;
    if (c.type === 'computed-percent') return `<td class="max-100">100.00</td>`;
    return '<td></td>';
  }).join('');
  gridFoot.innerHTML = `<tr class="sum-row"><td class="id-col"></td><td class="id-col"></td><td class="id-col"></td>${maxCells}</tr>`;
}

function ensureRow(user_id) {
  let r = rows.find(r=>r.user_id===user_id);
  if (!r) { r = { user_id, data: {} }; rows.push(r); }
  return r;
}

function cellValue(r, key) {
  return r?.data?.[key] ?? '';
}

function setCellValue(r, key, val, cols) {
  const col = cols.find(c=>c.key===key);
  let out = val;
  if (col?.type === 'number') {
    const num = Number(String(val).replace(/[^0-9.\-]/g, ''));
    if (!isNaN(num)) {
      out = num;
      if (typeof col.max === 'number' && num > col.max) out = col.max;
      if (num < 0) out = 0;
    } else {
      out = '';
    }
  }
  r.data[key] = out;
  // Recompute derived fields
  const totalCol = cols.find(c=>c.type==='computed-total');
  const pctCol = cols.find(c=>c.type==='computed-percent');
  if (totalCol) r.data[totalCol.key] = computeTotal(r.data, cols);
  if (pctCol) r.data[pctCol.key] = computePercent(r.data, cols);
  // mark row as dirty for autosave
  markDirtyByRow(r);
}

function renderBody(cols) {
  const filterClass = (testClassFilter && testClassFilter.value) || '';
  const rowsHtml = students
    .filter(s=>{
      // Class filter first
      if (filterClass && String(s.class||'').toLowerCase() !== String(filterClass).toLowerCase()) return false;
      // Then search filter
      const q = search.value.trim().toLowerCase();
      if (!q) return true;
      return (s.name||'').toLowerCase().includes(q) || (s.korean_name||'').includes(q);
    })
    .map((s, idx)=>{
      const r = ensureRow(s.id);
      const idTds = [
        `<td class=\"id-col\">${s.name||''}</td>`,
        `<td class=\"id-col\">${s.korean_name||''}</td>`,
        `<td class=\"id-col\">${s.class||''}</td>`
      ].join('');
      const dynTds = cols.map((c, cIdx)=>{
        const val = cellValue(r, c.key);
        if (c.type === 'computed-total' || c.type === 'computed-percent') {
          const ce = computedLocked ? '' : ' contenteditable=\"true\"';
          return `<td data-row=\"${idx}\" data-col=\"${cIdx}\" data-uid=\"${s.id}\" data-key=\"${c.key}\"${ce}>${val!==''?val:''}</td>`;
        }
        // Text (library grade) columns are editable like numeric
        return `<td contenteditable=\"true\" data-row=\"${idx}\" data-col=\"${cIdx}\" data-uid=\"${s.id}\" data-key=\"${c.key}\">${val!==''?val:''}</td>`;
      }).join('');
      return `<tr>${idTds}${dynTds}</tr>`;
    }).join('');
  if (!rowsHtml) {
    // Keep body empty until a test is selected
    if (!currentTest || !currentTest.id) gridBody.innerHTML = '';
  else gridBody.innerHTML = '<tr><td class="id-col" colspan="6">No students</td></tr>';
  } else {
    gridBody.innerHTML = rowsHtml;
  }
}

function activeColumns() { return columnsFor(currentTest); }

function refreshGrid() {
  const cols = activeColumns();
  renderHead(cols);
  renderBody(cols);
  renderFoot(cols);
}

// Keyboard navigation and paste handling
function onCellInput(e) {
  const td = e.target.closest('td[contenteditable="true"]');
  if (!td) return;
  const uid = td.dataset.uid; const key = td.dataset.key;
  const r = ensureRow(uid);
  setCellValue(r, key, td.textContent, activeColumns());
  // Update computed cells
  const cols = activeColumns();
  const totalCol = cols.find(c=>c.type==='computed-total');
  const pctCol = cols.find(c=>c.type==='computed-percent');
  if (totalCol) {
    const cell = gridBody.querySelector(`td[data-uid="${uid}"][data-key="${totalCol.key}"]`);
    if (cell) cell.textContent = r.data[totalCol.key] ?? '';
  }
  if (pctCol) {
    const cell = gridBody.querySelector(`td[data-uid="${uid}"][data-key="${pctCol.key}"]`);
    if (cell) cell.textContent = r.data[pctCol.key] ?? '';
  }
}

function onCellKeydown(e) {
  const td = e.target.closest('td[contenteditable="true"]');
  if (!td) return;
  const tr = td.parentElement;
  const tds = Array.from(tr.children);
  const colIdx = tds.indexOf(td);
  const trs = Array.from(gridBody.children);
  const rowIdx = trs.indexOf(tr);
  const dataCol = Number(td.getAttribute('data-col'));
  const dataRow = Number(td.getAttribute('data-row'));
  // Spreadsheet-style shortcuts
  // Shift+Arrow to extend selection
  if (e.shiftKey && ['ArrowRight','ArrowLeft','ArrowDown','ArrowUp'].includes(e.key)) {
    e.preventDefault();
    // Initialize selection if missing
    if (!selection || selection.kind !== 'body') {
      selection = { kind: 'body', startRow: dataRow, startCol: dataCol, endRow: dataRow, endCol: dataCol };
    }
    let { startRow, startCol, endRow, endCol } = selection;
    if (e.key === 'ArrowRight') endCol = dataCol + 1;
    if (e.key === 'ArrowLeft') endCol = dataCol - 1;
    if (e.key === 'ArrowDown') endRow = dataRow + 1;
    if (e.key === 'ArrowUp') endRow = dataRow - 1;
    selection.endRow = Math.max(0, Math.min(trs.length - 1, endRow));
    const colsCount = tds.length; // includes id columns; selection indices are dynamic columns only by dataset col
    // Use data-col if available to constrain endCol
    const maxCol = activeColumns().length - 1;
    if (!isNaN(dataCol)) {
      selection.endCol = Math.max(0, Math.min(maxCol, endCol));
    } else {
      selection.endCol = endCol;
    }
    clearSelectionStyles(); applySelectionStyles();
    return;
  }
  // Copy selection
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
    if (selection) { e.preventDefault(); copySelectionToClipboard(); return; }
  }
  // Paste into selection (body)
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
    if (selection && selection.kind === 'body') {
      e.preventDefault();
      navigator.clipboard.readText().then(text => {
        pasteTextIntoBodySelection(text, td);
      }).catch(()=>{/* fallback: do nothing */});
      return;
    }
  }
  // Delete selection
  if ((e.key === 'Delete' || e.key === 'Backspace') && selection && selection.kind === 'body') {
    // If multiple cells selected, clear them; otherwise let default within cell
    const norm = normalizeSel(selection);
    if (!(norm.startRow === norm.endRow && norm.startCol === norm.endCol)) {
      e.preventDefault();
      deleteSelection();
      return;
    }
  }
  const move = (r, c, wrapRow=false, wrapCol=false) => {
    const trsCount = trs.length;
    // find next editable cell obeying wrap rules
    let nr = r, nc = c;
    // clamp row
    if (nr < 0) nr = 0; if (nr >= trsCount) nr = trsCount - 1;
    // clamp col based on current row length
    const colsCount = trs[nr]?.children?.length || 0;
    if (wrapCol) {
      if (nc < 0) { nc = colsCount - 1; nr = Math.max(0, nr - 1); }
      if (nc >= colsCount) { nc = 0; nr = Math.min(trsCount - 1, nr + 1); }
    } else {
      if (nc < 0) nc = 0; if (nc >= colsCount) nc = colsCount - 1;
    }
    if (wrapRow) {
      if (nr < 0) nr = trsCount - 1;
      if (nr >= trsCount) nr = 0;
    } else {
      if (nr < 0) nr = 0; if (nr >= trsCount) nr = trsCount - 1;
    }
    const selector = `tr:nth-child(${nr+1}) td:nth-child(${nc+1})[contenteditable="true"]`;
    const next = gridBody.querySelector(selector);
    if (next) { next.focus(); placeCaretAtEnd(next); }
  };
  if (e.key === 'Enter') { e.preventDefault(); move(rowIdx+1, colIdx); }
  if (e.key === 'Tab') { e.preventDefault(); move(rowIdx, colIdx+1, false, true); }
  if (e.key === 'ArrowRight') { e.preventDefault(); move(rowIdx, colIdx+1, false, true); }
  if (e.key === 'ArrowLeft') { e.preventDefault(); move(rowIdx, colIdx-1, false, true); }
  if (e.key === 'ArrowDown') { e.preventDefault(); move(rowIdx+1, colIdx, true, false); }
  if (e.key === 'ArrowUp') { e.preventDefault(); move(rowIdx-1, colIdx, true, false); }
}

function placeCaretAtEnd(el) {
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges(); sel.addRange(range);
}

function onGridPaste(e) {
  const target = e.target.closest('td[contenteditable=\"true\"]');
  if (!target) return;
  e.preventDefault();
  const text = (e.clipboardData || window.clipboardData).getData('text');
  pasteTextIntoBodySelection(text, target);
}

// Paste helper: supports multi-cell paste into current selection or from the focused cell
function pasteTextIntoBodySelection(text, targetCell) {
  const rowsTxt = (text||'').split(/[\r\n]+/).filter(l=>l.length);
  const cols = activeColumns();
  // Determine anchor: prefer top-left of selection if selection exists, else target cell
  let startRowIdx = Number(targetCell.getAttribute('data-row'));
  let startColIdx = Number(targetCell.getAttribute('data-col'));
  let limit = null;
  if (selection && selection.kind === 'body') {
    const { startRow, endRow, startCol, endCol } = normalizeSel(selection);
    startRowIdx = startRow; startColIdx = startCol;
    limit = { endRow, endCol };
  }
  for (let rOff=0; rOff<rowsTxt.length; rOff++) {
    const parts = rowsTxt[rOff].split(/\t|,|\s{2,}/);
    const s = students[startRowIdx + rOff]; if (!s) break;
    const endColLimit = limit ? limit.endCol : Infinity;
    for (let cOff=0; cOff<parts.length; cOff++) {
      const cIdx = startColIdx + cOff; if (cIdx > endColLimit) break;
      const col = cols[cIdx]; if (!col) break;
      if (col.type === 'computed-total' || col.type === 'computed-percent') continue;
      const r = ensureRow(s.id);
      setCellValue(r, col.key, parts[cOff], cols);
    }
    if (limit && (startRowIdx + rOff) >= limit.endRow) break;
  }
  // If single value and there is a selection, fill entire selection with that value
  if (selection && selection.kind === 'body' && rowsTxt.length === 1 && !/[\t,]/.test(rowsTxt[0])) {
    const single = rowsTxt[0].trim();
    const { startRow, endRow, startCol, endCol } = normalizeSel(selection);
    for (let r=startRow; r<=endRow; r++) {
      const s = students[r]; if (!s) break;
      const rec = ensureRow(s.id);
      for (let c=startCol; c<=endCol; c++) {
        const col = cols[c]; if (!col || col.type.startsWith('computed')) continue;
        setCellValue(rec, col.key, single, cols);
      }
    }
  }
  refreshGrid();
}

// Global keyboard shortcuts for selection when focus isn’t inside a cell
function isTextInputTarget(el) {
  const tag = (el && el.tagName || '').toLowerCase();
  return tag === 'input' || tag === 'textarea' || (el && el.isContentEditable);
}

document.addEventListener('keydown', (e)=>{
  if (isTextInputTarget(e.target)) return; // don't hijack normal typing
  if (!selection) return;
  // Copy
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
    e.preventDefault(); copySelectionToClipboard();
  }
  // Paste
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
    e.preventDefault();
    navigator.clipboard.readText().then(text=>{
      if (selection.kind === 'body') {
        // paste starting at top-left selection cell
        const cell = gridBody.querySelector(`td[data-row="${Math.min(selection.startRow, selection.endRow)}"][data-col="${Math.min(selection.startCol, selection.endCol)}"]`);
        if (cell) pasteTextIntoBodySelection(text, cell);
      } else if (selection.kind === 'foot') {
        pasteTextIntoFooter(text);
      }
    }).catch(()=>{});
  }
  // Delete
  if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault(); deleteSelection();
  }
});

function pasteTextIntoFooter(text) {
  const start = Math.min(selection.startCol, selection.endCol);
  const end = Math.max(selection.startCol, selection.endCol);
  const cols = activeColumns().slice();
  let changed = false;
  const rowsTxt = (text||'').split(/[\r\n]+/).filter(l=>l.length);
  if (rowsTxt.length <= 1) {
    // Single line: split by delimiters or fill single value
    const parts = (rowsTxt[0]||'').split(/\t|,|\s{2,}/);
    if (parts.length <= 1) {
      // Single value: fill entire selection
      const single = parts[0] || '';
      const num = Number(String(single).replace(/[^0-9.\-]/g, ''));
      for (let c=start; c<=end; c++) {
        const col = cols[c]; if (!col || col.type !== 'number') continue;
        if (Number.isFinite(num) && num >= 0) { col.max = num; changed = true; }
      }
    } else {
      for (let i=0; i<parts.length; i++) {
        const cIdx = start + i; if (cIdx > end) break;
        const col = cols[cIdx]; if (!col || col.type !== 'number') continue;
        const parsed = Number(String(parts[i]).replace(/[^0-9.\-]/g, ''));
        if (Number.isFinite(parsed) && parsed >= 0) { col.max = parsed; changed = true; }
      }
    }
  } else {
    // Multiple lines: treat like horizontal fill using the first non-empty line
    const firstLine = rowsTxt.find(l=>l && l.trim().length) || '';
    const parts = firstLine.split(/\t|,|\s{2,}/);
    for (let i=0; i<parts.length; i++) {
      const cIdx = start + i; if (cIdx > end) break;
      const col = cols[cIdx]; if (!col || col.type !== 'number') continue;
      const parsed = Number(String(parts[i]).replace(/[^0-9.\-]/g, ''));
      if (Number.isFinite(parsed) && parsed >= 0) { col.max = parsed; changed = true; }
    }
  }
  if (!currentTest) currentTest = { id:null, name:testName.value||'Untitled Test', date:(testDate&&testDate.value)||null, columns: cols };
  else currentTest.columns = cols;
  if (changed) { refreshGrid(); if (metaTimer) clearTimeout(metaTimer); metaTimer = setTimeout(()=> saveTestMeta(), 400); }
}

// Selection helpers
function clearSelectionStyles() {
  gridBody.querySelectorAll('td.cell-selected').forEach(td=> td.classList.remove('cell-selected'));
  gridFoot.querySelectorAll('td.cell-selected').forEach(td=> td.classList.remove('cell-selected'));
}
function applySelectionStyles() {
  if (!selection) return;
  const cols = activeColumns();
  if (selection.kind === 'body') {
    const { startRow, startCol, endRow, endCol } = normalizeSel(selection);
    for (let r=startRow; r<=endRow; r++) {
      for (let c=startCol; c<=endCol; c++) {
        const col = cols[c]; if (!col) continue;
        const td = gridBody.querySelector(`td[data-row=\"${r}\"][data-col=\"${c}\"]`);
        if (td && td.getAttribute('contenteditable')==='true') td.classList.add('cell-selected');
      }
    }
  } else if (selection.kind === 'foot') {
    const start = Math.min(selection.startCol, selection.endCol);
    const end = Math.max(selection.startCol, selection.endCol);
    for (let c=start; c<=end; c++) {
      const td = gridFoot.querySelector(`td.max-cell[data-col=\"${c}\"]`);
      if (td) td.classList.add('cell-selected');
    }
  }
}
function normalizeSel(sel) {
  const startRow = Math.min(sel.startRow, sel.endRow);
  const endRow = Math.max(sel.startRow, sel.endRow);
  const startCol = Math.min(sel.startCol, sel.endCol);
  const endCol = Math.max(sel.startCol, sel.endCol);
  return { startRow, endRow, startCol, endCol };
}

function startSelection(e) {
  // Body cell selection
  let td = e.target.closest('td[data-row][data-col]');
  if (td) {
    selection = { kind: 'body', startRow: +td.dataset.row, startCol: +td.dataset.col, endRow: +td.dataset.row, endCol: +td.dataset.col };
    clearSelectionStyles(); applySelectionStyles();
    return;
  }
  // Footer max cell selection
  td = e.target.closest('td.max-cell[data-col]');
  if (td) {
    selection = { kind: 'foot', startCol: +td.dataset.col, endCol: +td.dataset.col };
    clearSelectionStyles(); applySelectionStyles();
  }
}
function extendSelection(e) {
  if (!selection) return;
  if (selection.kind === 'body') {
    const td = e.target.closest('td[data-row][data-col]'); if (!td) return;
    selection.endRow = +td.dataset.row; selection.endCol = +td.dataset.col;
  } else if (selection.kind === 'foot') {
    const td = e.target.closest('td.max-cell[data-col]'); if (!td) return;
    selection.endCol = +td.dataset.col;
  }
  clearSelectionStyles(); applySelectionStyles();
}
function endSelection() {}

function copySelectionToClipboard() {
  if (!selection) return;
  const cols = activeColumns();
  if (selection.kind === 'body') {
    const { startRow, endRow, startCol, endCol } = normalizeSel(selection);
    const out = [];
    for (let r=startRow; r<=endRow; r++) {
      const s = students[r]; if (!s) break;
      const rec = ensureRow(s.id);
      const arr = [];
      for (let c=startCol; c<=endCol; c++) {
        const col = cols[c]; if (!col) continue;
        const v = rec.data[col.key] ?? '';
        arr.push(v);
      }
      out.push(arr.join('\t'));
    }
    navigator.clipboard.writeText(out.join('\n')).catch(()=>{});
  } else if (selection.kind === 'foot') {
    const start = Math.min(selection.startCol, selection.endCol);
    const end = Math.max(selection.startCol, selection.endCol);
    const arr = [];
    for (let c=start; c<=end; c++) {
      const col = cols[c]; if (!col) continue;
      let val = '';
      if (col.type === 'number') val = col.max ?? '';
      if (col.type === 'computed-total') val = String(sumMax(cols));
      if (col.type === 'computed-percent') val = '100.00';
      arr.push(val);
    }
    navigator.clipboard.writeText(arr.join('\t')).catch(()=>{});
  }
}

function deleteSelection() {
  if (!selection) return;
  const cols = activeColumns();
  if (selection.kind === 'body') {
    const { startRow, endRow, startCol, endCol } = normalizeSel(selection);
    for (let r=startRow; r<=endRow; r++) {
      const s = students[r]; if (!s) break;
      const rec = ensureRow(s.id);
      for (let c=startCol; c<=endCol; c++) {
        const col = cols[c]; if (!col || col.type.startsWith('computed')) continue;
        rec.data[col.key] = '';
      }
    }
    refreshGrid();
  } else if (selection.kind === 'foot') {
    const start = Math.min(selection.startCol, selection.endCol);
    const end = Math.max(selection.startCol, selection.endCol);
    let changed = false;
    for (let c=start; c<=end; c++) {
      const col = cols[c]; if (!col) continue;
      if (col.type === 'number') { col.max = undefined; changed = true; }
    }
    if (changed) { refreshGrid(); if (metaTimer) clearTimeout(metaTimer); metaTimer = setTimeout(()=> saveTestMeta(), 400); }
  }
}

function fillDownSelection() {
  if (!selection) return;
  const cols = activeColumns();
  if (selection.kind === 'body') {
    const { startRow, endRow, startCol, endCol } = normalizeSel(selection);
    // Take first row as source
    const srcRow = students[startRow]; if (!srcRow) return;
    const srcRec = ensureRow(srcRow.id);
    for (let r=startRow+1; r<=endRow; r++) {
      const s = students[r]; if (!s) break;
      const rec = ensureRow(s.id);
      for (let c=startCol; c<=endCol; c++) {
        const col = cols[c]; if (!col || col.type.startsWith('computed')) continue;
        const val = srcRec.data[col.key] ?? '';
        setCellValue(rec, col.key, val, cols);
      }
    }
    refreshGrid();
  } else if (selection.kind === 'foot') {
    const start = Math.min(selection.startCol, selection.endCol);
    const end = Math.max(selection.startCol, selection.endCol);
    const srcCol = activeColumns()[start];
    const srcVal = srcCol && srcCol.type === 'number' ? srcCol.max : undefined;
    let changed = false;
    for (let c=start+1; c<=end; c++) {
      const col = cols[c]; if (!col || col.type !== 'number') continue;
      col.max = srcVal;
      changed = true;
    }
    if (changed) { refreshGrid(); if (metaTimer) clearTimeout(metaTimer); metaTimer = setTimeout(()=> saveTestMeta(), 400); }
  }
}

function showMenu(x, y) {
  gridMenu.style.left = x + 'px';
  gridMenu.style.top = y + 'px';
  gridMenu.style.display = 'block';
}
function hideMenu() { gridMenu.style.display = 'none'; }

function showColMenu(x,y,idx) { colMenuIndex = idx; colMenu.style.left=x+'px'; colMenu.style.top=y+'px'; colMenu.style.display='block'; }
function hideColMenu() { colMenu.style.display='none'; colMenuIndex=null; }

gridBody.addEventListener('mousedown', (e)=>{ if (e.button===0) startSelection(e); });
gridBody.addEventListener('mousemove', (e)=>{ if (e.buttons===1) extendSelection(e); });
gridBody.addEventListener('mouseup', endSelection);
gridBody.addEventListener('contextmenu', (e)=>{ e.preventDefault(); startSelection(e); showMenu(e.clientX, e.clientY); });
// Footer selection & menu
gridFoot.addEventListener('mousedown', (e)=>{ if (e.button===0) startSelection(e); });
gridFoot.addEventListener('mousemove', (e)=>{ if (e.buttons===1) extendSelection(e); });
gridFoot.addEventListener('contextmenu', (e)=>{ e.preventDefault(); startSelection(e); showMenu(e.clientX, e.clientY); });
document.addEventListener('click', (e)=>{ if (!gridMenu.contains(e.target)) hideMenu(); });
// Wire editing and paste handlers for live recompute and autosave
gridBody.addEventListener('input', onCellInput);
gridBody.addEventListener('keydown', onCellKeydown);
gridBody.addEventListener('paste', onGridPaste);
// Paste into footer maxima row to set multiple max values
gridFoot.addEventListener('paste', (e)=>{
  const td = e.target.closest('td.max-cell[contenteditable="true"]');
  if (!td) return;
  e.preventDefault();
  const text = (e.clipboardData || window.clipboardData).getData('text') || '';
  const parts = text.split(/\t|,|\r?\n|\s{2,}/).filter(Boolean);
  const startColIdx = Number(td.getAttribute('data-col'));
  const cols = activeColumns().slice();
  let changed = false;
  for (let i=0; i<parts.length; i++) {
    const cIdx = startColIdx + i;
    const col = cols[cIdx]; if (!col) break;
    if (col.type !== 'number') continue;
    const parsed = Number(String(parts[i]).replace(/[^0-9.\-]/g, ''));
    if (Number.isFinite(parsed) && parsed >= 0) { col.max = parsed; changed = true; }
  }
  if (!currentTest) currentTest = { id:null, name:testName.value||'Untitled Test', date:(testDate&&testDate.value)||null, columns: cols };
  else currentTest.columns = cols;
  if (changed) { refreshGrid(); if (metaTimer) clearTimeout(metaTimer); metaTimer = setTimeout(()=> saveTestMeta(), 400); }
});

// Footer maxima editing handlers
gridFoot.addEventListener('keydown', (e)=>{
  if (e.key === 'Enter') {
    e.preventDefault();
    const td = e.target.closest('td.max-cell[contenteditable="true"]');
    if (td) applyMaxEdit(td);
  }
});
gridFoot.addEventListener('blur', (e)=>{
  const td = e.target.closest('td.max-cell[contenteditable="true"]');
  if (td) applyMaxEdit(td);
}, true);

function applyMaxEdit(cell) {
  if (!cell) return;
  const colIdx = Number(cell.getAttribute('data-col'));
  const cols = activeColumns().slice();
  const col = cols[colIdx]; if (!col || col.type !== 'number') return;
  const raw = String(cell.textContent||'').trim();
  const parsed = Number(raw.replace(/[^0-9.\-]/g, ''));
  if (raw === '') col.max = undefined;
  else if (Number.isFinite(parsed) && parsed >= 0) col.max = parsed;
  else return;
  // Persist in current test object
  if (!currentTest) currentTest = { id:null, name:testName.value||'Untitled Test', date:(testDate&&testDate.value)||null, columns: cols };
  else currentTest.columns = cols;
  // Recompute derived
  const tCols = activeColumns();
  const totalCol = tCols.find(c=>c.type==='computed-total');
  const pctCol = tCols.find(c=>c.type==='computed-percent');
  if (totalCol || pctCol) {
    for (const r of rows) {
      if (totalCol) r.data[totalCol.key] = computeTotal(r.data, tCols);
      if (pctCol) r.data[pctCol.key] = computePercent(r.data, tCols);
    }
  }
  refreshGrid();
  if (metaTimer) clearTimeout(metaTimer);
  metaTimer = setTimeout(()=>{ saveTestMeta(); }, 500);
}

gridHead.addEventListener('contextmenu', (e)=>{
  const th = e.target.closest('th.col-head');
  if (!th) return;
  e.preventDefault();
  const idx = Number(th.getAttribute('data-col'));
  showColMenu(e.clientX, e.clientY, idx);
});

document.addEventListener('click', (e)=>{ if (!colMenu.contains(e.target)) hideColMenu(); });

// Grid context menu actions
gridMenu.addEventListener('click', (e)=>{
  const act = e.target.getAttribute('data-act'); if (!act) return;
  if (act==='copy') copySelectionToClipboard();
  if (act==='paste') {
    navigator.clipboard.readText().then(txt=>{
      const fakeEvt = { target: gridBody.querySelector('td[data-row][data-col]'), clipboardData: { getData: ()=>txt }, preventDefault: ()=>{} };
      onGridPaste(fakeEvt);
    }).catch(()=>{});
  }
  if (act==='delete') deleteSelection();
  if (act==='filldown') fillDownSelection();
  if (act==='toggle-computed') {
    computedLocked = !computedLocked;
    if (computedIndicator) computedIndicator.textContent = `Computed: ${computedLocked ? 'Locked' : 'Unlocked'}`;
    refreshGrid();
  }
  hideMenu();
});

// Column header context menu actions
colMenu.addEventListener('click', (e)=>{
  const act = e.target.getAttribute('data-act'); if (!act) return;
  const cols = activeColumns().slice();
  const i = colMenuIndex; if (i==null || i<0 || i>=cols.length) { hideColMenu(); return; }
  if (act==='rename') {
    const name = prompt('Column label', cols[i].label || ''); if (name) cols[i].label = name;
  } else if (act==='setmax') {
    if (cols[i].type!=='number') { alert('Only number columns have max'); hideColMenu(); return; }
    const m = Number(prompt('Max score', String(cols[i].max??'')));
    if (!Number.isNaN(m)) cols[i].max = m;
  } else if (act==='moveleft') {
    if (i>0) { const [c] = cols.splice(i,1); cols.splice(i-1,0,c); }
  } else if (act==='moveright') {
    if (i<cols.length-1) { const [c] = cols.splice(i,1); cols.splice(i+1,0,c); }
  } else if (act==='delete') {
    if (!confirm('Delete this column?')) { hideColMenu(); return; }
    cols.splice(i,1);
  }
  // persist new columns into current test (unsaved until autosave or explicit save)
  if (!currentTest) currentTest = { id:null, name:testName.value||'Untitled Test', date:(testDate&&testDate.value)||null, columns: cols };
  else currentTest.columns = cols;
  hideColMenu();
  refreshGrid();
  // Save test metadata so maxima/labels persist
  saveTestMeta();
});

// Load tests and group by name+date so only one option is shown per group
async function loadTests() {
  const params = new URLSearchParams({ action:'list_tests' });
  const res = await fetch(`${API}?${params.toString()}`, { credentials:'include', cache:'no-store' });
  const data = await res.json();
  const arr = (data.tests || []).slice();
  // newest first
  arr.sort((a,b)=> (new Date(b.created_at||0)) - (new Date(a.created_at||0)));
  const map = new Map();
  for (const t of arr) {
    const key = `${t.name||''}||${t.date||''}`;
    if (!map.has(key)) map.set(key, { name: t.name||'', date: t.date||'', items: [] });
    map.get(key).items.push({ id: t.id, class: t.class||'' });
  }
  testGroups = Object.fromEntries(map.entries());
  // If legacy dropdown exists, populate it (not visible in new UI)
  if (testPicker) {
    const opts = ['<option value="">Load Test…</option>'];
    for (const [key, g] of map.entries()) {
      const label = `${g.name}${g.date?` ${g.date}`:''}`;
      opts.push(`<option value="${key}">${label}</option>`);
    }
    testPicker.innerHTML = opts.join('');
  }
  // Also (re)build the modal list if it's open
  if (loadModalBg && loadModalBg.style.display === 'flex') buildLoadList();
  if (testClassFilter) {
    testClassFilter.disabled = true;
    testClassFilter.innerHTML = '<option value="">Class…</option>';
  }
}

if (testMonthFilter) testMonthFilter.addEventListener('change', loadTests);

async function loadTestById(id) {
  if (!id) return;
  const res = await fetch(`${API}?action=get_test&test_id=${encodeURIComponent(id)}`, { credentials:'include', cache:'no-store' });
  const data = await res.json();
  if (!data?.success) { msg.style.color='#b91c1c'; msg.textContent=data.error||'Load failed'; return; }
  currentTest = data.test;
  const entries = Array.isArray(data.entries) ? data.entries : [];
  // Reset grid state for fresh load
  rows = [];
  // Restore per-class comments from test metadata (if present)
  loadCommentsFromColumns(currentTest);
  testName.value = currentTest.name || '';
  if (testDate) testDate.value = currentTest.date || '';
  // Restore term period inputs if present
  if (termFrom) termFrom.value = currentTest.term_from ? String(currentTest.term_from).slice(0,7) : '';
  if (termTo) termTo.value = currentTest.term_to ? String(currentTest.term_to).slice(0,7) : '';
  if (testClassFilter) {
    // Try to reflect the loaded class in the class switcher if present
    const val = currentTest.class || '';
    if (val) {
      const opt = Array.from(testClassFilter.options||[]).find(o=>o.value===val);
      if (opt) testClassFilter.value = val;
    }
  }
  rows = entries.map(e=>({ user_id: e.user_id, data: e.data || {} }));
  if (entries.length > 0) {
    students = sortStudents(entries.map(e => ({
      id: e.user_id,
      username: e.data?.__snap_username || '',
      name: e.data?.__snap_name || '',
      korean_name: e.data?.__snap_korean || '',
      class: e.data?.__snap_class || (currentTest.class || '')
    })));
  } else {
    try {
      const url = `${STUDENT_API}?action=list_students&class=${encodeURIComponent(currentTest.class||'')}`;
      const sRes = await fetch(url, { credentials:'include', cache:'no-store' });
      const sData = await sRes.json();
      if (sRes.ok && sData.success) students = sortStudents(sData.students || []); else students = [];
    } catch { students = []; }
  }
  testMeta.textContent = `${currentTest.name} — ${students.length} students`;
  // Restore class comment for the active class key
  const activeClass = currentTest.class || '';
  const cEl = document.getElementById('classComment');
  if (cEl) cEl.value = classComments.get(activeClass) || '';
  refreshGrid();
}

if (testPicker) testPicker.addEventListener('change', async ()=>{
  const key = testPicker.value; if (!key) return;
  activeTestGroupKey = key;
  const group = testGroups[key];
  // If this group is the last imported one, only show the classes created in that import
  if (lastImported.groupKey === key && lastImported.tests.length) {
    const classes = Array.from(new Set(lastImported.tests.map(it=> it.class).filter(Boolean)));
    if (testClassFilter) {
      testClassFilter.disabled = false;
      testClassFilter.innerHTML = classes.length ? classes.map(c=>`<option value="${c}">${c}</option>`).join('') : '<option value="">(no class)</option>';
    }
    await loadTestById(lastImported.tests[0].id);
  } else {
    // Deduplicate classes within the group (multiple imports with same name/date)
  const classes = sortClassesList(Array.from(new Set((group?.items||[]).map(it=> it.class).filter(Boolean))));
    if (testClassFilter) {
      testClassFilter.disabled = false;
      testClassFilter.innerHTML = classes.length ? classes.map(c=>`<option value="${c}">${c}</option>`).join('') : '<option value="">(no class)</option>';
    }
    const first = group?.items?.[0];
    await loadTestById(first?.id);
  }
});

if (testClassFilter) testClassFilter.addEventListener('change', async ()=>{
  const prevClass = (currentTest && currentTest.class) || '';
  // Persist current comment for previous class before switching
  const classCommentEl = document.getElementById('classComment');
  if (classCommentEl) {
    const val = classCommentEl.value || '';
    if (prevClass != null) classComments.set(prevClass, val);
  // Fire-and-forget save to avoid blocking UI on class switch
  try { saveTestMeta({ captureActive: false }); } catch {}
  }
  const klass = testClassFilter.value;
  // Ensure we have an active group; if missing, attempt to derive from currentTest
  if (!activeTestGroupKey && currentTest) {
    const k = `${currentTest.name||''}||${currentTest.date||''}`;
    if (testGroups && testGroups[k]) activeTestGroupKey = k;
  }
  const group = testGroups[activeTestGroupKey];
  if (!group) return; // nothing to switch within
  // Try strict match first, then case-insensitive
  let item = (group.items||[]).find(it=> it.class === klass);
  if (!item && klass) {
    const low = String(klass).toLowerCase();
    item = (group.items||[]).find(it=> String(it.class||'').toLowerCase() === low);
  }
  if (!item) {
    // No matching class in this group; keep current test but update message
    msg.style.color = '#64748b';
    msg.textContent = 'Selected class not found in this test group.';
    return;
  }
  await loadTestById(item.id);
  // After load, populate textarea with stored comment for the new class (if any)
  if (classCommentEl) {
    const newClass = testClassFilter.value || (currentTest && currentTest.class) || '';
  classCommentEl.value = classComments.get(newClass) || '';
  }
});

async function saveCurrent() {
  const prevName = currentTest ? (currentTest.name || '') : '';
  if (!currentTest) {
  // No test yet: create one. Comments (if any) will be saved on subsequent metadata save.
  // Persist term/comment metadata into columns before create
  const preCols = persistCommentsToColumns({ columns: activeColumns(), class: (testClassFilter && testClassFilter.value) || null, term_from: (termFrom && termFrom.value) || null, term_to: (termTo && termTo.value) || null });
  const payload = { name: (testName.value||'Untitled Test').trim(), date: (testDate && testDate.value) || null, columns: preCols, class: (testClassFilter && testClassFilter.value) || null,
    term_from: (termFrom && termFrom.value) || null,
    term_to: (termTo && termTo.value) || null
  };
    const data = await api('create_test', payload);
    currentTest = data.test;
  } else if (currentTest && currentTest.id) {
    // Persist any metadata changes (name/date/class/columns)
  // Make sure class comments are embedded into columns before saving
  const colsWithMeta = persistCommentsToColumns(currentTest);
  const up = { test_id: currentTest.id, name: (testName.value||currentTest.name||'').trim(), columns: colsWithMeta,
    term_from: (termFrom && termFrom.value) || currentTest.term_from || null,
    term_to: (termTo && termTo.value) || currentTest.term_to || null
  };
    try { const upd = await api('update_test', up); currentTest = upd.test || currentTest; } catch {}
  }
  // Build entries using snapshot identity to preserve historical class/name
  const targetClass = (testClassFilter && testClassFilter.value) || currentTest.class || '';
  const entries = students
    .filter(s=> !targetClass || String(s.class||'').toLowerCase() === String(targetClass).toLowerCase())
    .map(s=>{
    const r = ensureRow(s.id);
    const data = { ...r.data,
      __snap_username: s.username||'',
      __snap_name: s.name||'',
      __snap_korean: s.korean_name||'',
      __snap_class: s.class||'',
      __snap_next_class: s.next_class||''
    };
    return { user_id: s.id, data };
  });
  const res = await api('upsert_entries', { test_id: currentTest.id, entries });
  msg.style.color = '#065f46';
  const t = new Date();
  const hh = String(t.getHours()).padStart(2,'0');
  const mm = String(t.getMinutes()).padStart(2,'0');
  const ss = String(t.getSeconds()).padStart(2,'0');
  msg.textContent = `Saved ${res?.upserted ?? entries.length} row(s) at ${hh}:${mm}:${ss}`;
  testMeta.textContent = `${currentTest.name} — ${students.length} students`;

  // If the test name changed, propagate across the group to keep sheets together
  const newName = (testName.value || '').trim();
  if (newName && newName !== prevName) {
    try { await propagateGroupRename(newName, { oldName: prevName }); } catch {}
  }
}

// Minimal autosave to approximate live updates
function markDirtyByRow(r) {
  dirty.set(r.user_id, true);
  scheduleSave();
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(runAutosave, 800); // debounce
}

async function ensureTestCreated() {
  if (currentTest && currentTest.id) return;
  const payload = { name: (testName.value||'Untitled Test').trim() || 'Untitled Test', date: (testDate && testDate.value) || null, columns: activeColumns(), class: (testClassFilter && testClassFilter.value) || null,
    term_from: (termFrom && termFrom.value) || null,
    term_to: (termTo && termTo.value) || null
  };
  const data = await api('create_test', payload);
  currentTest = data.test;
}

async function runAutosave() {
  saveTimer = null;
  if (!dirty.size) return;
  try {
    await ensureTestCreated();
  } catch (e) {
    msg.style.color = '#b91c1c';
    msg.textContent = e.message || 'Could not create test for autosave.';
    return;
  }
  const changedIds = Array.from(dirty.keys());
  const entries = changedIds.map(uid => {
    const s = students.find(x=>x.id===uid) || {}; // fallback
    const r = ensureRow(uid);
    const data = { ...r.data,
      __snap_username: s.username||'',
      __snap_name: s.name||'',
      __snap_korean: s.korean_name||'',
      __snap_class: s.class||'',
      __snap_next_class: s.next_class||''
    };
    return { user_id: uid, data };
  });
  try {
    msg.style.color = '#334155';
    msg.textContent = 'Saving…';
    const res = await api('upsert_entries', { test_id: currentTest.id, entries });
    changedIds.forEach(id=> dirty.delete(id));
    const t = new Date();
    const hh = String(t.getHours()).padStart(2,'0');
    const mm = String(t.getMinutes()).padStart(2,'0');
    const ss = String(t.getSeconds()).padStart(2,'0');
    msg.style.color = '#065f46';
    msg.textContent = `Saved ${res?.upserted ?? entries.length} row(s) at ${hh}:${mm}:${ss}`;
  } catch (e) {
    msg.style.color = '#b91c1c';
    msg.textContent = e.message || 'Autosave failed';
  }
}

// Choose a sensible date for new tests so they show up under the month filter
function getDesiredTestDate() {
  const direct = (testDate && testDate.value || '').trim();
  if (direct) return direct; // explicit date chosen
  const month = (testMonthFilter && testMonthFilter.value || '').trim(); // YYYY-MM
  if (/^\d{4}-\d{2}$/.test(month)) return `${month}-01`;
  // fallback to today
  return new Date().toISOString().slice(0,10);
}

// Persist test metadata (columns/name/date/class) when available
async function saveTestMeta(opts={ captureActive: true }) {
  if (!currentTest || !currentTest.id) return;
  const prevName = currentTest.name || '';
  const prevTf = currentTest.term_from || '';
  const prevTt = currentTest.term_to || '';
  // Optionally capture the current textarea into the active class slot
  if (opts.captureActive) {
    const activeClass = (testClassFilter && testClassFilter.value) || currentTest.class || '';
    const comment = document.getElementById('classComment')?.value || '';
    if (activeClass != null) classComments.set(activeClass, comment);
  }
  // Persist into columns on a carrier column without adding visible columns
  const cols = persistCommentsToColumns(currentTest);
  const tf = (termFrom && termFrom.value) || currentTest.term_from || '';
  const tt = (termTo && termTo.value) || currentTest.term_to || '';
  const up = { test_id: currentTest.id, name: (testName.value||currentTest.name||'').trim(), columns: cols,
    term_from: tf || null,
    term_to: tt || null
  };
  try { const upd = await api('update_test', up); currentTest = upd.test || currentTest; msg.style.color = '#0369a1'; msg.textContent = 'Updated test settings.'; } catch {}
  // Ensure in-memory fields reflect the UI (backend may ignore top-level fields)
  currentTest.term_from = tf; currentTest.term_to = tt;

  // Propagate a name change to all class tests in the same group
  const newName = (testName.value || '').trim();
  if (newName && newName !== prevName) {
    try { await propagateGroupRename(newName, { oldName: prevName }); } catch {}
  }
  if ((tf !== prevTf) || (tt !== prevTt)) {
    try { await propagateGroupTermRange(tf, tt); } catch {}
  }
}

// Helper: find the test group that contains a given test id
function _findGroupByTestId(id) {
  for (const [key, g] of Object.entries(testGroups||{})) {
    if ((g.items||[]).some(it=> it.id === id)) return { key, group: g };
  }
  return { key: null, group: null };
}

// Rename helper: apply new name to all tests in the same (name+date) group
async function propagateGroupRename(newName, opts={}) {
  if (!currentTest) return;
  const date = currentTest.date || '';
  const oldName = (opts && opts.oldName) ? String(opts.oldName) : (currentTest.name||'');
  const expectedKey = `${oldName}||${date}`;
  // Try explicit key, then active, then by membership
  let group = testGroups[expectedKey] || testGroups[activeTestGroupKey] || null;
  let oldKey = testGroups[expectedKey] ? expectedKey : activeTestGroupKey;
  if (!group) { const found = _findGroupByTestId(currentTest.id); oldKey = found.key; group = found.group; }
  if (!group || !Array.isArray(group.items) || !group.items.length) return;
  // Batch update all tests in the group
  for (const it of group.items) {
    try { await api('update_test', { test_id: it.id, name: newName }); } catch {}
  }
  // Refresh groups and keep active selection
  await loadTests();
  const newKey = `${newName}||${date}`;
  activeTestGroupKey = newKey;
  if (lastImported && lastImported.groupKey === oldKey) lastImported.groupKey = newKey;
  // Update UI label and in-memory name
  currentTest.name = newName;
  testMeta.textContent = `${currentTest.name} — ${students.length} students`;
  msg.style.color = '#0369a1';
  msg.textContent = `Renamed group to “${newName}”.`;
}

// Apply term period month range to all tests in the current (name+date) group
async function propagateGroupTermRange(term_from, term_to) {
  if (!currentTest) return;
  const date = currentTest.date || '';
  const oldKey = `${(currentTest.name||'')}||${date}`;
  const group = testGroups[oldKey] || testGroups[activeTestGroupKey] || null;
  if (!group || !Array.isArray(group.items) || !group.items.length) return;
  const applyToColumns = (cols) => {
    const c = getMetaCarrierColumn(cols) || null; if (!c) return cols;
    if (term_from) c._term_from = term_from; else if (c._term_from) delete c._term_from;
    if (term_to) c._term_to = term_to; else if (c._term_to) delete c._term_to;
    return cols;
  };
  for (const it of group.items) {
    try {
      // Fetch current columns for each class test, then update carrier fields
      const resp = await fetch(`${API}?action=get_test&test_id=${encodeURIComponent(it.id)}`, { credentials:'include', cache:'no-store' });
      const data = await resp.json();
      if (!data?.success) continue;
      const cols = Array.isArray(data.test?.columns) ? JSON.parse(JSON.stringify(data.test.columns)) : [];
      const patched = applyToColumns(cols);
      await api('update_test', { test_id: it.id, columns: patched });
    } catch {}
  }
  msg.style.color = '#0369a1';
  msg.textContent = `Applied term period to ${group.items.length} class test(s).`;
}

// API helpers and student loading (restored)
async function api(action, body, method = 'POST') {
  const url = `${API}?action=${encodeURIComponent(action)}`;
  const res = await fetch(url, { method, credentials:'include', headers:{ 'Content-Type':'application/json' }, body: body ? JSON.stringify(body) : undefined, cache:'no-store' });
  const data = await res.json().catch(()=>({}));
  if (!res.ok || data.success === false) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function listStudents() {
  const q = search.value.trim();
  const klass = '';
  const params = new URLSearchParams({ action:'list_students' });
  if (q) params.set('search', q);
  if (klass) params.set('class', klass);
  const url = `${STUDENT_API}?${params.toString()}`;
  const res = await fetch(url, { credentials:'include', cache:'no-store' });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load students');
  students = data.students || [];
  students = sortStudents(students);
}

async function populateClassFilter() { /* no-op: left class filter removed */ }

// Init
(async function init(){
  try {
    // Try whoami, then attempt a refresh if needed, then retry whoami
    let whoResp = await fetch('/.netlify/functions/supabase_auth?action=whoami', { credentials:'include', cache:'no-store' });
    let who = await whoResp.json().catch(()=>({}));
    if (!whoResp.ok || !who?.success) {
      await fetch('/.netlify/functions/supabase_auth?action=refresh', { credentials:'include', cache:'no-store' }).catch(()=>{});
      whoResp = await fetch('/.netlify/functions/supabase_auth?action=whoami', { credentials:'include', cache:'no-store' });
      who = await whoResp.json().catch(()=>({}));
      if (!whoResp.ok || !who?.success) throw new Error('not signed in');
    }
  } catch {
    msg.style.color = '#b91c1c';
    msg.innerHTML = 'Not signed in. <a href="/Teachers/login.html" style="color:#2563eb; text-decoration:underline;">Sign in</a> and return.';
    return;
  }
  await populateClassFilter();
  currentTest = { id:null, name:'', date:null, columns:[...DEFAULT_COLUMNS] };
  // Pre-select current month for filter
  const d = new Date(); const mm = String(d.getMonth()+1).padStart(2,'0'); if (testMonthFilter) testMonthFilter.value = `${d.getFullYear()}-${mm}`;
  if (computedIndicator) computedIndicator.textContent = `Computed: ${computedLocked ? 'Locked' : 'Unlocked'}`;
  await loadTests();
  await populateTestClassFilter();
  refreshGrid();
})();

// UI event wiring
if (refreshBtn) refreshBtn.addEventListener('click', async ()=>{
  if (currentTest && currentTest.id) {
    // Preserve original set for loaded tests; just re-render
    refreshGrid();
  } else {
    // Keep grid empty until a test is chosen
  }
});

// left class filter removed

if (search) search.addEventListener('input', ()=>{ refreshGrid(); });

function uniqueClassesFromStudents(all) {
  const raw = Array.from(new Set((all||[]).map(s=>s.class).filter(Boolean)));
  raw.sort((a,b)=>{
    const ai = CLASS_ORDER.indexOf(String(a).toLowerCase());
    const bi = CLASS_ORDER.indexOf(String(b).toLowerCase());
    if (ai !== -1 || bi !== -1) {
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    }
    return String(a).localeCompare(String(b));
  });
  return raw;
}

// Populate test class filter using all classes from students endpoint
async function populateTestClassFilter() {
  if (!testClassFilter) return;
  try {
    const res = await fetch(`${STUDENT_API}?action=list_students`, { credentials:'include', cache:'no-store' });
    const data = await res.json();
    if (res.ok && data.success) {
      const classes = uniqueClassesFromStudents(data.students||[]);
      testClassFilter.innerHTML = '<option value="">All Classes</option>' + classes.map(c=>`<option value="${c}">${c}</option>`).join('');
    }
  } catch {}
}

// ---------- Load Test Modal ----------
function buildLoadList(filter='') {
  if (!loadList) return;
  const q = (filter||'').trim().toLowerCase();
  const items = [];
  for (const [key, g] of Object.entries(testGroups||{})) {
    const classes = Array.from(new Set((g.items||[]).map(it=> it.class).filter(Boolean)));
    const label = `${g.name}${g.date?` ${g.date}`:''}`;
    const matches = !q || label.toLowerCase().includes(q) || classes.some(c=> String(c).toLowerCase().includes(q));
    if (!matches) continue;
    items.push({ key, label, classes, firstId: (g.items&&g.items[0]&&g.items[0].id)||null, count: (g.items||[]).length });
  }
  if (!items.length) {
    loadList.innerHTML = '<div class="note">No tests found.</div>';
    return;
  }
  loadList.innerHTML = items.map(it => `
    <div class="load-item" data-item-key="${it.key}" style="display:flex; align-items:center; gap:10px; border:1px solid #e5e7eb; border-radius:8px; padding:10px;">
      <div style="flex:1 1 auto; min-width:0;">
        <div style="font-weight:600; color:#0f172a;">${it.label}</div>
        <div class="note">${(it.classes||[]).join(', ') || '(no class)'} • ${it.count} class test(s)</div>
      </div>
      <div class="actions" style="display:flex; gap:8px; align-items:center;">
        <div class="countdown" data-countdown style="display:none; gap:8px; align-items:center;">
          <span class="note" data-ttl>Deleting in 5…</span>
          <button data-cancel-del class="clear-btn">Cancel</button>
        </div>
        <button data-del-key="${it.key}" class="clear-btn" title="Delete this test group" style="color:#b91c1c; border-color:#ef4444;">Delete</button>
        <button data-load-key="${it.key}" class="layout-btn">Open</button>
      </div>
    </div>
  `).join('');
}

function openLoadModal() {
  if (!loadModalBg) return;
  loadMsg.textContent = '';
  loadSearch.value = '';
  buildLoadList('');
  loadModalBg.style.display = 'flex';
}
function closeLoadModal(){ if (loadModalBg) loadModalBg.style.display = 'none'; }

if (openLoadBtn) openLoadBtn.addEventListener('click', openLoadModal);
if (loadCloseBtn) loadCloseBtn.addEventListener('click', closeLoadModal);
if (loadModalBg) loadModalBg.addEventListener('click', (e)=>{ if (e.target === loadModalBg) closeLoadModal(); });
if (loadSearch) loadSearch.addEventListener('input', ()=> buildLoadList(loadSearch.value||''));
if (loadList) loadList.addEventListener('click', async (e)=>{
  const openBtn = e.target.closest('button[data-load-key]');
  const delBtn = e.target.closest('button[data-del-key]');
  const cancelBtn = e.target.closest('button[data-cancel-del]');
  // Countdown state cache on element
  const getItemRow = (from)=> from.closest('.load-item');
  if (openBtn) {
    const key = openBtn.getAttribute('data-load-key'); if (!key) return;
    activeTestGroupKey = key;
    const group = testGroups[key];
  const classes = sortClassesList(Array.from(new Set((group?.items||[]).map(it=> it.class).filter(Boolean))));
    if (testClassFilter) {
      testClassFilter.disabled = false;
      testClassFilter.innerHTML = classes.length ? classes.map(c=>`<option value="${c}">${c}</option>`).join('') : '<option value="">(no class)</option>';
    }
    const first = group?.items?.[0];
    // Reflect the chosen class in the selector
    if (testClassFilter && first?.class) {
      const opt = Array.from(testClassFilter.options||[]).find(o=>o.value===first.class);
      if (opt) testClassFilter.value = first.class;
    }
    await loadTestById(first?.id);
    closeLoadModal();
    return;
  }
  if (delBtn) {
    const key = delBtn.getAttribute('data-del-key'); if (!key) return;
    const row = getItemRow(delBtn);
    if (!row) return;
    const cd = row.querySelector('[data-countdown]');
    const ttlEl = row.querySelector('[data-ttl]');
    const delButton = delBtn;
    let ttl = 5;
    // show countdown UI
    if (cd) cd.style.display = 'flex';
    if (ttlEl) ttlEl.textContent = `Deleting in ${ttl}…`;
    delButton.style.display = 'none';
    // store timer handle on row to allow cancel
    const tick = async () => {
      ttl -= 1;
      if (ttlEl) ttlEl.textContent = `Deleting in ${ttl}…`;
      if (ttl <= 0) {
        // time to delete
        clearInterval(timerId);
        const group = testGroups[key]; if (!group) { reset(); return; }
        const ids = (group.items||[]).map(it=> it.id).filter(Boolean);
        if (!ids.length) { reset(); return; }
        loadMsg.style.color = '#334155';
        loadMsg.textContent = 'Deleting…';
        let ok = 0, fail = 0;
        for (const id of ids) {
          try { await api('delete_test', { test_id: id }); ok++; }
          catch (e) { fail++; }
        }
        if (currentTest && currentTest.id && ids.includes(currentTest.id)) {
          currentTest = { id:null, name:'', date:null, columns:[...DEFAULT_COLUMNS] };
          students = []; rows = []; refreshGrid();
          testMeta.textContent = 'No test loaded';
        }
        await loadTests();
        buildLoadList(loadSearch ? loadSearch.value||'' : '');
        if (fail === 0) { loadMsg.style.color = '#065f46'; loadMsg.textContent = `Deleted ${ok} item(s).`; }
        else { loadMsg.style.color = '#b91c1c'; loadMsg.textContent = `Deleted ${ok}, failed ${fail}. You may need admin permissions.`; }
      }
    };
    function reset() {
      if (cd) cd.style.display = 'none';
      if (ttlEl) ttlEl.textContent = '';
      delButton.style.display = '';
    }
    const timerId = setInterval(tick, 1000);
    row._delTimer = timerId;
    row._delKey = key;
    return;
  }
  if (cancelBtn) {
    const row = getItemRow(cancelBtn);
    if (!row) return;
    const cd = row.querySelector('[data-countdown]');
    const delButton = row.querySelector('button[data-del-key]');
    if (row._delTimer) { clearInterval(row._delTimer); row._delTimer = null; }
    if (cd) cd.style.display = 'none';
    if (delButton) delButton.style.display = '';
    loadMsg.style.color = '#64748b';
    loadMsg.textContent = 'Deletion cancelled.';
    return;
  }
});

async function openCampaignModal() {
  campaignMsg.textContent = '';
  campaignName.value = testName.value || `Test ${new Date().toISOString().slice(0,10)}`;
  campaignDate.value = (testDate && testDate.value) || new Date().toISOString().slice(0,10);
  // populate classes by querying all students once
  let all = [];
  try {
    const res = await fetch(`${STUDENT_API}?action=list_students`, { credentials:'include', cache:'no-store' });
    const data = await res.json();
    if (res.ok && data.success) all = data.students || [];
  } catch {}
  const classes = uniqueClassesFromStudents(all);
  campaignClassList.innerHTML = classes.map(c=>`<label style=\"display:flex; gap:8px; align-items:center;\"><input type=\"checkbox\" value=\"${c}\" checked /> <span>${c}</span></label>`).join('') || '<div class=\"note\">No classes found.</div>';
  campaignModalBg.style.display = 'flex';
}

function closeCampaignModal(){ campaignModalBg.style.display = 'none'; }

if (campaignCancel) campaignCancel.addEventListener('click', closeCampaignModal);
if (campaignSelectAll) campaignSelectAll.addEventListener('click', ()=>{
  campaignClassList.querySelectorAll('input[type=checkbox]').forEach(cb=> cb.checked = true);
});
if (campaignClear) campaignClear.addEventListener('click', ()=>{
  campaignClassList.querySelectorAll('input[type=checkbox]').forEach(cb=> cb.checked = false);
});

// Override New Test button: open campaign modal
const newTestBtn = el('newTestBtn');
if (newTestBtn) newTestBtn.addEventListener('click', openCampaignModal);

if (campaignCreate) campaignCreate.addEventListener('click', async ()=>{
  campaignMsg.textContent = '';
  const name = campaignName.value.trim() || 'Untitled Test';
  const date = campaignDate.value || null;
  const selected = Array.from(campaignClassList.querySelectorAll('input[type=checkbox]:checked')).map(cb=> cb.value);
  if (!selected.length) { campaignMsg.textContent = 'Select at least one class.'; return; }
  // Create a test per class with its own columns (starting from current columns; you can edit maxima per class afterwards)
  let created = [];
  for (const klass of selected) {
    try {
      // Embed term metadata into columns
      const cols = persistCommentsToColumns({ columns: activeColumns(), class: klass, term_from: (termFrom && termFrom.value) || null, term_to: (termTo && termTo.value) || null });
      const payload = { name, date, class: klass, columns: cols,
        term_from: (termFrom && termFrom.value) || null,
        term_to: (termTo && termTo.value) || null
      };
      const data = await api('create_test', payload);
      created.push(data.test);
    } catch (e) {
      // continue others
    }
  }
  if (!created.length) { campaignMsg.textContent = 'Failed to create tests.'; return; }
  closeCampaignModal();
  // Load the first created test into the grid and reflect class in the switcher
  const first = created[0];
  if (testClassFilter && first?.class) {
    // Ensure the switcher shows this class if present
    const opt = Array.from(testClassFilter.options||[]).find(o=>o.value===first.class);
    if (opt) testClassFilter.value = first.class;
  }
  await loadTestById(first?.id);
  msg.style.color = '#065f46';
  msg.textContent = `Created ${created.length} test(s). Now editing ${first?.class || ''}.`;
});

// Wire Save button
if (saveBtn) saveBtn.addEventListener('click', async ()=>{
  await saveCurrent();
});

// Rename-on-change: when title input changes, rename group so all class sheets stay together
if (testName) {
  let lastTitle = testName.value || '';
  testName.addEventListener('change', async ()=>{
    const newTitle = (testName.value || '').trim();
    if (!currentTest || !currentTest.id) { lastTitle = newTitle; return; }
    if (!newTitle || newTitle === (currentTest.name || '')) return;
    try {
      // Update current test
      await api('update_test', { test_id: currentTest.id, name: newTitle });
      currentTest.name = newTitle;
      // Propagate to group mates
      await propagateGroupRename(newTitle, { oldName: lastTitle || undefined });
    } catch {}
    lastTitle = newTitle;
  });
}

// Wire Add Column button
if (addColumnBtn) addColumnBtn.addEventListener('click', async ()=>{
  const cols = activeColumns().slice();
  // Insert a simple number column before computed totals, else at end
  const idx = cols.findIndex(c=> c.type && c.type.startsWith('computed'));
  const insertAt = idx === -1 ? cols.length : idx;
  const key = `c${Date.now().toString(36)}`;
  cols.splice(insertAt, 0, { key, label: 'New Column', type: 'number', max: 10 });
  if (!currentTest) currentTest = { id:null, name:testName.value||'Untitled Test', date:getDesiredTestDate(), columns: cols, class: (testClassFilter && testClassFilter.value) || null };
  else currentTest.columns = cols;
  refreshGrid();
  await saveTestMeta();
});

// Export CSV
function exportCsv() {
  const cols = activeColumns();
  const headers = ['Name','Korean Name','Class', ...cols.map(c=>c.label||c.key)];
  const lines = [headers.join(',')];
  for (const s of students) {
    const r = ensureRow(s.id);
    const vals = cols.map(c=> r.data[c.key] ?? '');
    const row = [s.name||'', s.korean_name||'', s.class||'', ...vals].map(v=>
      typeof v === 'string' && (v.includes(',') || v.includes('"')) ? '"'+v.replace(/"/g,'""')+'"' : v
    );
    lines.push(row.join(','));
  }
  const blob = new Blob([lines.join('\n')], { type:'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${(testName.value||'test').replace(/[^a-z0-9_-]+/gi,'_')}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
if (exportCsvBtn) exportCsvBtn.addEventListener('click', exportCsv);

// Import modal wiring
if (importTableBtn) importTableBtn.addEventListener('click', openImportModal);
if (importCancel) importCancel.addEventListener('click', closeImportModal);
if (importParse) importParse.addEventListener('click', handleParseClick);
if (importConfirm) importConfirm.addEventListener('click', handleImportConfirm);
const importCloseX = document.getElementById('importCloseX');
if (importCloseX) importCloseX.addEventListener('click', closeImportModal);
// Class comment autosave debounce
const classCommentEl = document.getElementById('classComment');
if (classCommentEl) {
  classCommentEl.addEventListener('input', () => {
    if (commentSaveTimer) clearTimeout(commentSaveTimer);
    commentSaveTimer = setTimeout(()=>{ saveTestMeta(); }, 1200);
  });
}
// Persist term period when month inputs change
if (typeof termFrom !== 'undefined' && termFrom) {
  termFrom.addEventListener('change', ()=>{ if (commentSaveTimer) clearTimeout(commentSaveTimer); commentSaveTimer = setTimeout(()=> saveTestMeta(), 400); });
}
if (typeof termTo !== 'undefined' && termTo) {
  termTo.addEventListener('change', ()=>{ if (commentSaveTimer) clearTimeout(commentSaveTimer); commentSaveTimer = setTimeout(()=> saveTestMeta(), 400); });
}

// Report Cards Modal logic
(function(){
  const openBtn = document.getElementById('openReportCardsBtn');
  const modalBg = document.getElementById('rcModalBg');
  const closeBtn = document.getElementById('rcCloseBtn');
  const printBtn = document.getElementById('rcPrintBtn');
  const pdfBtn = document.getElementById('rcPdfBtn');
  const cardsWrap = document.getElementById('rcCardsWrap');
  const cardsContainer = document.getElementById('rcCardsContainer');
  const rcStatus = document.getElementById('rcStatus');
  if (!openBtn || !modalBg) return;

  function esc(s=''){ return String(s).replace(/[&<>"'`]/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;","`":"&#96;"}[m]||m)); }
  function fmtDate(dateStr){ if(!dateStr) return ''; const d=new Date(dateStr); if(Number.isNaN(d)) return String(dateStr); return d.toLocaleDateString(undefined,{ year:'numeric', month:'long', day:'numeric' }); }
  // Month-Year only (e.g., October 2025). Accepts 'YYYY-MM' or full ISO.
  function fmtMonthYear(dateStr){ if(!dateStr) return ''; let src = String(dateStr); if(/^\d{4}-\d{2}$/.test(src)) src = src + '-01'; const d=new Date(src); if(Number.isNaN(d)) return String(dateStr); return d.toLocaleDateString(undefined,{ year:'numeric', month:'long' }); }
  function parseNumber(v){ if(v===null||v===undefined) return null; if(typeof v==='number' && Number.isFinite(v)) return v; if(typeof v==='string'){ const m=v.trim().match(/-?[0-9]+(?:\.[0-9]+)?/); if(!m) return null; const n=Number(m[0]); return Number.isFinite(n)?n:null; } return null; }
  function formatNumber(v,{decimals=0}={}){ if(v===null||v===undefined||Number.isNaN(v)) return '—'; const opts={minimumFractionDigits:decimals, maximumFractionDigits:decimals}; if(!Number.isFinite(v)) return '—'; if(decimals===0 && Math.abs(v-Math.round(v))>0.0001){ return v.toLocaleString(undefined,{minimumFractionDigits:1, maximumFractionDigits:1}); } return v.toLocaleString(undefined,opts); }
  const formatPercent = (v)=> (v===null||v===undefined||Number.isNaN(v)) ? '—' : `${formatNumber(v,{decimals:1})}%`;

  function barsPercent(score, max){ const s=parseNumber(score), m=parseNumber(max); if(!Number.isFinite(s) || !Number.isFinite(m) || m<=0) return 0; return Math.max(0, Math.min(100, (s/m)*100)); }

  function visibleStudents() {
    const trs = Array.from(document.getElementById('gridBody')?.querySelectorAll('tr')||[]);
    const out = [];
    trs.forEach(tr => {
      const tds = tr.children; if (!tds || tds.length < 2) return;
  const name = tds[0]?.textContent?.trim() || '';
  const korean = tds[1]?.textContent?.trim() || '';
  const klass = tds[2]?.textContent?.trim() || '';
  const row = { username:'', name, korean_name: korean, class: klass, data: {} };
      const cols = activeColumns();
      for (let i = 2; i < tds.length; i++) {
        const td = tds[i];
        const key = td.getAttribute('data-key');
        if (!key) continue;
        const text = td.textContent || '';
        const col = cols.find(c=> c.key === key) || {};
        if (col.type === 'number') {
          const num = parseNumber(text);
          if (num !== null) row.data[key] = num;
        } else if (col.type === 'text') {
          row.data[key] = text.trim();
        }
      }
      out.push(row);
    });
    return out;
  }

  function currentTestMeta() {
    const name = document.getElementById('testName')?.value || '';
    // Prefer explicit input if present; otherwise use the loaded test's date
    const inputDate = document.getElementById('testDate')?.value || '';
    const date = inputDate || (window.currentTest && currentTest.date) || '';
    // Month range
    const tfEl = document.getElementById('termFrom');
    const ttEl = document.getElementById('termTo');
    const term_from = (tfEl && tfEl.value) || (window.currentTest && currentTest.term_from) || '';
    const term_to = (ttEl && ttEl.value) || (window.currentTest && currentTest.term_to) || '';
    const cols = activeColumns();
    return { name, date, term_from, term_to, columns: cols };
  }

  // Korean skill labels mapping
  const KOREAN_LABELS = {
    'phonics': '파닉스',
    'listening': '듣기',
    'vocab': '어휘',
    'grammar': '문법',
    'gw': '문법/쓰기',
    'write': '쓰기',
    'reading': '읽기',
    'speaking': '말하기'
  };

  function getKoreanLabel(col) {
    // Try to match by key first
    if (KOREAN_LABELS[col.key]) return KOREAN_LABELS[col.key];
    // Try to match by label patterns
    const label = (col.label || '').toLowerCase();
    if (/listening|듣기/.test(label)) return '듣기';
    if (/vocab|어휘/.test(label)) return '어휘';
    if (/grammar(?!.*write)|문법(?!.*쓰기)/.test(label)) return '문법';
    if (/write|쓰기/.test(label)) return '쓰기';
    if (/reading|읽기/.test(label)) return '읽기';
    if (/speaking|말하기/.test(label)) return '말하기';
    if (/phonics|파닉스/.test(label)) return '파닉스';
    // Fallback to original label
    return col.label || col.key;
  }

  function renderCard({ student, test, notes }) {
    const cols = Array.isArray(test.columns) ? test.columns : [];
    const numberCols = cols.filter(c=>c.type==='number');

  const scores = [];
    let t=0, m=0;
    for (const c of numberCols) {
      const val = parseNumber(student.data[c.key]);
      const max = parseNumber(c.max);
      if (val===null) continue;
      t += Number.isFinite(val) ? val : 0;
      m += Number.isFinite(max) ? max : 0;
      scores.push({ label: getKoreanLabel(c), score:val, max, pct: barsPercent(val, max) });
    }
  const percent = (m>0) ? Math.round((t/m)*1000)/10 : null;
  const totalSum = `${formatNumber(t)}/${formatNumber(m)}`;

    // Library grades (text) if available
    const libReading = student.data['lib_reading'] || student.data['LIB_READING'] || '';
    const libRaz = student.data['lib_raz'] || student.data['LIB_RAZ'] || '';
    const libPunctuality = student.data['lib_punctuality'] || student.data['LIB_PUNCTUALITY'] || '';

    // Grade to radial percent mapping per spec
    function gradeToPercent(g) {
      if (!g) return 0;
      const t = String(g).trim().toUpperCase();
      const map = { 'A+':100, 'A':90, 'A-':80, 'B+':65, 'B':50, 'B-':35, 'C+':10, 'C':1 };
      return map[t] ?? 0;
    }
    // Semicircle gauge SVG (pathLength=100 for easy stroke-dasharray)
    function renderGauge(grade) {
      const pct = Math.max(0, Math.min(100, gradeToPercent(grade)));
      console.log('[RC] renderGauge called:', grade, '-> pct:', pct);
      // Path is a half-circle arc from left to right using a 50x50 viewBox centered at (50,50), radius 40
      // We draw only the top half (y from 50 to 10) and use pathLength=100 so dasharray=pct shows progress.
      return `
        <div class="rc-gauge" aria-label="${esc(grade||'')} gauge">
          <svg viewBox="0 0 100 60" preserveAspectRatio="xMidYMid meet">
            <path class="arc-track" d="M10,50 A40,40 0 0 1 90,50" pathLength="100"
              fill="none" stroke="var(--rc-accent-2)" stroke-width="6" stroke-linecap="round"></path>
            <path class="arc-fill"  d="M10,50 A40,40 0 0 1 90,50" pathLength="100"
              fill="none" stroke="var(--rc-accent)" stroke-width="6" stroke-linecap="round" stroke-dasharray="${pct} 100"></path>
          </svg>
          <div class="grade-text">${esc(grade||'—')}</div>
        </div>`;
    }

    const skillRows = scores.map(s=>
      `<div class="rc-skill">
        <div class="rc-skill-label">${esc(s.label)}</div>
        <div class="rc-bar"><span style="width:${s.pct}%"><span class="rc-pct">${Math.round(s.pct)}</span></span></div>
        <div class="rc-score">${formatNumber(s.score)}${Number.isFinite(s.max)?`/${formatNumber(s.max)}`:''}</div>
      </div>`
    ).join('');

  const logo = '/Logo.png';
  // Prefer explicit student class; fall back to loaded test class
  const displayClass = (student && student.class) ? student.class : ((window.currentTest && currentTest.class) || '');
    // Compute term period display: prefer month range; fallback to test date
    function normMonth(s){ if(!s) return ''; const str=String(s); return /^\d{4}-\d{2}$/.test(str) ? (str+'-01') : str; }
    let termText = '';
    const tf = test.term_from || '';
    const tt = test.term_to || '';
    if (tf && tt) {
      const a = fmtMonthYear(normMonth(tf));
      const b = fmtMonthYear(normMonth(tt));
      termText = a && b ? (a===b ? a : `${a} – ${b}`) : (a||b);
    } else if (tf || tt) {
      termText = fmtMonthYear(normMonth(tf||tt));
    } else {
      termText = fmtMonthYear(test.date);
    }
    return `
      <section class="rc-page">
        <header class="rc-header">
          <img class="rc-logo" src="${logo}" alt="Willena" />
        </header>

        <div class="rc-info">
          <div class="rc-field"><span class="rc-label">Student Name:</span><div class="rc-line"><div class="rc-value">${esc(student.name||'')}</div></div></div>
          <div class="rc-field"><span class="rc-label">Korean Name:</span><div class="rc-line"><div class="rc-value">${esc(student.korean_name||'')}</div></div></div>
          <div class="rc-field"><span class="rc-label">Class:</span><div class="rc-line"><div class="rc-value">${esc(displayClass)}</div></div></div>
          <div class="rc-field"><span class="rc-label">Term Period:</span><div class="rc-line"><div class="rc-value">${esc(termText||'')}</div></div></div>
        </div>

        <div class="rc-columns">
          <div class="rc-titlebar rc-skills rc-col-title">Skills</div>
          <div class="rc-titlebar rc-library rc-col-title">Library</div>

          <div>
            ${skillRows}
            <div class="rc-total-wrap">
              <div class="rc-total-label">Total</div>
              <div class="rc-total">${formatPercent(percent)}</div>
              <div class="rc-total-sum">${totalSum}</div>
            </div>
          </div>

          <aside class="rc-library">
            <div class="rc-lib-item">
              ${renderGauge(libRaz)}
              <div class="rc-lib-text">
                <div class="rc-g-label">RAZ KIDS</div>
              </div>
            </div>
            <div class="rc-lib-item">
              ${renderGauge(libReading)}
              <div class="rc-lib-text">
                <div class="rc-g-label">BOOK READING</div>
              </div>
            </div>
            <div class="rc-lib-item">
              ${renderGauge(libPunctuality)}
              <div class="rc-lib-text">
                <div class="rc-g-label">PUNCTUALITY</div>
              </div>
            </div>
          </aside>

          <div class="rc-comments-head rc-span">Comments</div>
          <div class="rc-comments rc-span">${notes ? esc(notes) : 'Use this space to add personalised feedback before printing.'}</div>
        </div>
      </section>`;
  }

  function openModal() {
    console.log('[RC] openModal called - version rc3');
    // Ensure inline styles for gauge layout are present (defensive against other CSS overrides)
    (function ensureInlineGaugeStyles(){
      if (document.getElementById('rcInlineGaugeStyles')) return;
  const css = `#rcModal .rc-library{display:grid;gap:9mm;justify-items:center}#rcModal .rc-lib-item{display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center}#rcModal .rc-gauge{width:120px;height:90px;position:relative}#rcModal .rc-gauge svg{width:100%;height:100%;display:block}#rcModal .rc-gauge .grade-text{position:absolute;left:0;right:0;bottom:0;transform:none;font-weight:900;font-size:22px;color:var(--rc-text);text-align:center}`;
      const tag = document.createElement('style');
      tag.id = 'rcInlineGaugeStyles';
      tag.textContent = css;
      document.body.appendChild(tag);
      console.log('[RC] Injected inline gauge styles');
    })();
    const test = currentTestMeta();
    const students = visibleStudents();
    console.log('[RC] Rendering cards for', students.length, 'students');
    rcStatus.textContent = `Rendering ${students.length} report card${students.length===1?'':'s'}…`;
  const activeClass = (testClassFilter && testClassFilter.value) || currentTest.class || '';
  const notes = (classComments.get(activeClass) || document.getElementById('classComment')?.value || '').trim();
    const cards = students.map(s => renderCard({ student:s, test, notes }));
    cardsContainer.innerHTML = cards.join('');
    modalBg.style.display = 'flex';
    rcStatus.textContent = `Ready. ${students.length} card${students.length===1?'':'s'}.`;
  }

  function closeModal() { modalBg.style.display = 'none'; }
  openBtn.addEventListener('click', openModal);
  closeBtn?.addEventListener('click', closeModal);
  modalBg.addEventListener('click', (e)=>{ if (e.target === modalBg) closeModal(); });

  function printCardsStandalone() {
    try {
      const w = window.open('', '_blank');
      if (!w) { window.print(); return; }
      const html = `<!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>Report Cards</title>
            <link rel="preconnect" href="https://fonts.googleapis.com">
            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
            <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
            <link rel="stylesheet" href="/Teachers/tools/test_input/report-card.css?v=20251015-rc3" />
            <style>
              html, body { background:#fff; margin:0; }
              #mount { padding:0; margin:0; }
              @page { size: A4; margin: 0; }
              /* Inline gauge layout to ensure consistent print rendering */
              .rc-library{display:grid;gap:9mm;justify-items:center}
              .rc-lib-item{display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center}
              .rc-gauge{width:120px;height:72px;position:relative}
              .rc-gauge svg{width:100%;height:100%;display:block}
              .rc-gauge .grade-text{position:absolute;left:0;right:0;bottom:0;transform:none;font-weight:900;font-size:22px;color:var(--rc-text);text-align:center}
            </style>
          </head>
          <body>
            <div id="mount">${cardsContainer.innerHTML}</div>
            <script>
              (function(){
                function go(){ try { window.focus(); window.print(); } catch(e) { setTimeout(go, 100); } }
                if (document.readyState === 'complete') go(); else window.addEventListener('load', function(){ setTimeout(go, 150); });
              })();
            </script>
          </body>
        </html>`;
      w.document.open(); w.document.write(html); w.document.close();
    } catch { window.print(); }
  }

  printBtn?.addEventListener('click', ()=>{
    // Use standalone window to avoid visibility/overlay conflicts in print
    printCardsStandalone();
  });

  async function ensurePdfLibs() {
    if (window.jspdf && window.html2canvas) return;
    const inject = (src) => new Promise((resolve, reject)=>{ const s=document.createElement('script'); s.src=src; s.async=true; s.onload=resolve; s.onerror=reject; document.head.appendChild(s); });
    // Load html2canvas then jsPDF (UMD builds)
    if (!window.html2canvas) await inject('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js');
    if (!window.jspdf) await inject('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js');
  }

  async function exportCardsToPdf() {
    try {
      rcStatus.textContent = 'Rendering PDF…';
      await ensurePdfLibs();
      const { jsPDF } = window.jspdf;
      const pages = Array.from(cardsContainer.querySelectorAll('.rc-page'));
      if (!pages.length) { rcStatus.textContent = 'No cards to export.'; return; }
      // Emulate print CSS during rasterization
      const modalRoot = document.getElementById('rcModal');
      if (modalRoot) modalRoot.classList.add('rc-pdf');
      const pdf = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
      const pageW = 210, pageH = 297;
      for (let i=0; i<pages.length; i++) {
        const node = pages[i];
        // Ensure white background when rasterizing
        const canvas = await window.html2canvas(node, { scale:2, backgroundColor:'#ffffff', useCORS:true });
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const imgW = pageW, imgH = (canvas.height / canvas.width) * imgW;
        if (i>0) pdf.addPage('a4', 'portrait');
        pdf.addImage(imgData, 'JPEG', 0, Math.max(0, (pageH - imgH)/2), imgW, imgH);
      }
      const test = currentTestMeta();
      const title = (test.name || 'Report_Cards').replace(/[^a-z0-9_\-]+/gi,'_');
      // Prefer selected class, then loaded test class; else infer from visible students
      let cls = ((testClassFilter && testClassFilter.value) || (window.currentTest && currentTest.class) || '').trim();
      if (!cls) {
        try {
          const vs = (typeof visibleStudents === 'function') ? visibleStudents() : [];
          const set = Array.from(new Set((vs||[]).map(s=> (s.class||'').trim()).filter(Boolean)));
          if (set.length === 1) cls = set[0];
          else if (set.length > 1) cls = 'AllClasses';
        } catch {}
      }
      const safeClass = cls ? cls.replace(/[^a-z0-9_\-]+/gi,'_') : '';
      const filename = safeClass ? `${title}_${safeClass}.pdf` : `${title}.pdf`;
      pdf.save(filename);
      rcStatus.textContent = `Exported ${pages.length} page${pages.length===1?'':'s'} to PDF.`;
      if (modalRoot) modalRoot.classList.remove('rc-pdf');
    } catch (e) {
      rcStatus.textContent = 'PDF export failed.';
    }
  }

  pdfBtn?.addEventListener('click', exportCardsToPdf);
})();
