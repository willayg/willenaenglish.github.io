// Willena report-card renderer reused from the current Teachers Test Input app.
// The report-card markup, skill bars and gauge styling are kept verbatim.
const esc=(s='')=>String(s).replace(/[&<>"'`]/g, ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','`':'&#96;'}[ch]||ch));
function parseNumber(v){if(v===null||v===undefined||v==='')return null;const n=Number(String(v).replace(/,/g,''));return Number.isFinite(n)?n:null}
function formatNumber(v,{decimals=0}={}){if(v===null||v===undefined||!Number.isFinite(v))return '—';return v.toLocaleString(undefined,{minimumFractionDigits:decimals,maximumFractionDigits:Math.max(decimals,1)})}
const formatPercent=(v)=>v===null||v===undefined||!Number.isFinite(v)?'—':formatNumber(v,{decimals:1})+'%';
function fmtMonthYear(input){if(!input)return '';const m=String(input).match(/^(\d{4})-(\d{2})/);if(!m)return String(input);return new Date(Number(m[1]),Number(m[2])-1,1).toLocaleDateString('en-US',{month:'long',year:'numeric'})}
function barsPercent(score,max){const s=parseNumber(score),m=parseNumber(max);return s===null||m===null||m<=0?0:Math.max(0,Math.min(100,100*s/m))}
function computeAveragePercent(data,cols){const percentages=cols.filter(c=>c.type==='number').map(c=>{const s=parseNumber(data[c.key]),m=parseNumber(c.max);return s!==null&&m!==null&&m>0?100*s/m:null}).filter(x=>x!==null);return percentages.length?percentages.reduce((a,b)=>a+b,0)/percentages.length:null}
const KOREAN_LABELS={phonics:'파닉스',listening:'듣기',vocab:'어휘',grammar:'문법',gw:'문법/쓰기',write:'쓰기',reading:'읽기',speaking:'말하기'};
const getKoreanLabel=(col)=>KOREAN_LABELS[col.key]||col.label||col.key;
export function renderCard({ student, test, notes='', totalMode='weighted' }) {
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
  const avgPercent = computeAveragePercent(student.data || {}, cols);
  const totalSum = `${formatNumber(t)}/${formatNumber(m)}`;
  const useAverageMode = totalMode === 'average';
  const shownPercent = useAverageMode ? avgPercent : percent;
  const totalLabel = useAverageMode ? 'Average' : 'Total';
  const totalSumHtml = useAverageMode ? '' : `<div class="rc-total-sum">${totalSum}</div>`;

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
  const displayClass = student?.class || test?.class || '';
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
              <div class="rc-total-label">${totalLabel}</div>
              <div class="rc-total">${formatPercent(shownPercent)}</div>
              ${totalSumHtml}
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

