// Sample Wordlist Modal

import { FN } from '../scripts/api-base.js';

// Scoped styles for this modal to avoid interference from global .mode-btn rules
let __wlModalStylesInjected = false;
function ensureWordlistModalStyles() {
  if (__wlModalStylesInjected) return;
  __wlModalStylesInjected = true;
  const style = document.createElement('style');
  style.id = 'wl-modal-scoped-styles';
  style.textContent = `
    #sampleWordlistModal .wl-btn,
    #sampleWordlistModal .mode-btn {
      display: flex !important;
      flex-direction: row !important;
      align-items: center !important;
  justify-content: space-between !important;
      gap: 12px !important;
      width: 100% !important;
      height: auto !important;
      /* add ~30% more vertical space between items */
      margin: 8px 0 !important;
      padding: 12px 18px !important;
      background: none !important;
      border: none !important;
      box-shadow: none !important;
      border-radius: 0px !important;
    }
    /* Modal container 3px border */
    #sampleWordlistModal > div {
      border: 3px solid #27c5ca !important;
    }
    /* subtle separators between stacked buttons */
    #sampleWordlistModal .wl-btn + .wl-btn,
    #sampleWordlistModal .mode-btn + .mode-btn {
      border-top: 1px solid #b0e2e4ff !important;
    }
    /* Hide any decorative pseudo elements from global styles */
    #sampleWordlistModal .wl-btn::before,
    #sampleWordlistModal .wl-btn::after,
    #sampleWordlistModal .mode-btn::before,
    #sampleWordlistModal .mode-btn::after { display: none !important; content: none !important; }

    /* Segmented progress bar (blue outline + yellow blocks) */
    #sampleWordlistModal .wl-bar {
      width: 100%;
      height: 16px;
      border-radius: 9999px;
      border: 2px solid #27c5caff; /* light blue outline */
      background: #ffffff; /* white interior */
      overflow: hidden;
    }
    #sampleWordlistModal .wl-bar-fill {
      height: 100%;
      width: 0%;
      border-radius: inherit;
      /* stripes layer (12 segments with 2px gap) over warm yellow gradient base */
      background-image:
        linear-gradient(to right,
          #ffc107 0,
          #ffc107 calc(100%/12 - 2px),
          transparent calc(100%/12 - 2px),
          transparent calc(100%/12)
        ),
        linear-gradient(90deg, #ffe082, #ffb300);
      background-size: calc(100%/12) 100%, 100% 100%;
      background-repeat: repeat-x, no-repeat;
      transition: width .3s ease;
    }
    #sampleWordlistModal .wl-bar-fill.loading {
      width: 100% !important;
      background: linear-gradient(90deg, 
        #b0e2e4 0%, 
        #7fc5ca 25%,
        #c0e8eb 50%,
        #7fc5ca 75%,
        #b0e2e4 100%);
      background-size: 200% 100%;
      animation: wlBarGlow 1.5s ease-in-out infinite;
    }
    @keyframes wlBarGlow {
      0%, 100% { background-position: 200% 0; opacity: 0.7; }
      50% { background-position: 0% 0; opacity: 1; }
    }
    }
  `;
  document.head.appendChild(style);
}

export function showSampleWordlistModal({ onChoose }) {
  ensureWordlistModalStyles();
  try { console.info('[WA sample lists] showSampleWordlistModal start'); } catch {}
  // Modal overlay
  let modal = document.getElementById('sampleWordlistModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'sampleWordlistModal';
    modal.style = `
      position:fixed;top:0;left:0;width:100vw;height:100vh;
      background: linear-gradient(120deg, rgba(25,119,126,0.22) 0%, rgba(255,255,255,0.18) 100%);
      backdrop-filter: blur(12px) saturate(1.2);
      -webkit-backdrop-filter: blur(12px) saturate(1.2);
      z-index:1000;display:flex;align-items:center;justify-content:center;
    `;
    document.body.appendChild(modal);
  }

  // Flat list of all word lists (no categories, except Long U excluded)
  const allLists = [
    { label: 'Easy Animals', file: 'EasyAnimals.json', emoji: '🐯' },
    { label: 'More Animals', file: 'Animals2.json', emoji: '🐼' },
    { label: 'Fruits & Veggies', file: 'Food1.json', emoji: '🍎' },
    { label: 'Meals & Snacks', file: 'Food2.json', emoji: '🍔' },
    { label: 'World Foods', file: 'Food3.json', emoji: '🍣' },
    { label: 'Jobs (Easy)', file: 'EasyJobs.json', emoji: '👩‍🔧' },
    { label: 'Getting Around', file: 'Transportation.json', emoji: '🚗' },
    { label: 'Hobbies (Easy)', file: 'EasyHobbies.json', emoji: '🎨' },
    { label: 'Sports', file: 'Sports.json', emoji: '🏀' },
    { label: 'School Things', file: 'SchoolSupplies.json', emoji: '✏️' },
    { label: 'Action Words (Easy)', file: 'EasyVerbs.json', emoji: '🏃‍♂️' },
    { label: 'Feelings & Emotions', file: 'Feelings.json', emoji: '😊' }
  ];

  // Render flat list immediately with 0% skeleton
  modal.innerHTML = `
    <div style="width:95vw;max-width:420px;max-height:85vh;background:#fff;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,0.25);overflow:hidden;display:flex;flex-direction:column;font-family:'Poppins',Arial,sans-serif;border:3px solid #27c5ca;">
      <div style="position:sticky;top:0;background:#f6feff;border-bottom:2px solid #a9d6e9;display:flex;align-items:center;justify-content:space-between;padding:10px 12px;z-index:1;">
        <span style="font-size:1.3em;color:#19777e;font-weight:700;">Level 1: Word Lists</span>
        <button id="closeSampleWordlistModalX" style="cursor:pointer;border:none;background:transparent;color:#19777e;font-size:20px;font-weight:700;">✕</button>
      </div>
      <div id="sampleWordlistList" style="padding:12px 0;overflow:auto;flex:1;">
        ${allLists.map((item, idx) => `
          <button class="wl-btn" data-idx="${idx}" data-file="${item.file}" style="width:100%;height:auto;margin:0;background:none;border:none;font-size:1.1rem;cursor:pointer;font-family:'Poppins',Arial,sans-serif;color:#19777e;padding:12px 18px;border-radius:0px;position:relative;display:flex;align-items:center;justify-content:space-between;">
            <span style="font-size:2em;flex-shrink:0;">${item.emoji}</span>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex:1;min-width:0;">
              <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
                <span style="font-weight:600;min-width:0;text-align:right;">${item.label}</span>
                <span class="wl-percent" style="font-size:0.95em;color:#19777e;font-weight:500;text-align:right;">0%</span>
              </div>
              <div class="wl-bar" style="margin-top:7px;">
                <div class="wl-bar-fill loading" data-final="false"></div>
              </div>
            </div>
          </button>
        `).join('')}
      </div>
      <div style="padding:12px 18px;display:flex;justify-content:flex-end;gap:8px;border-top:1px solid #e0f2f4;">
        <button id="closeSampleWordlistModal" style="padding:8px 18px;border-radius:8px;border:none;font-weight:700;cursor:pointer;background:#eceff1;color:#19777e;box-shadow:0 2px 8px rgba(60,60,80,0.08);">Cancel</button>
      </div>
    </div>
  `;

  modal.style.display = 'flex';
  modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
  document.getElementById('closeSampleWordlistModalX').onclick = () => { modal.style.display = 'none'; };
  document.getElementById('closeSampleWordlistModal').onclick = () => { modal.style.display = 'none'; };

  // Bind list item clicks
  const list = document.getElementById('sampleWordlistList');
  Array.from(list.children).forEach((btn) => {
    btn.onclick = () => {
      modal.style.display = 'none';
      if (onChoose) onChoose(allLists[Number(btn.getAttribute('data-idx'))].file);
    };
  });

  // Fetch and update progress for all lists
  (async () => {
    const modeIds = ['meaning', 'listening', 'multi_choice', 'listen_and_spell', 'sentence', 'level_up'];
    const canonicalMode = (raw) => {
      const m = (raw || 'unknown').toString().toLowerCase();
      if (m === 'sentence' || m.includes('sentence')) return 'sentence';
      if (m === 'matching' || m.startsWith('matching_') || m === 'meaning') return 'meaning';
      if (m === 'phonics_listening' || m === 'listen' || m === 'listening' || (m.startsWith('listening_') && !m.includes('spell'))) return 'listening';
      if (m.includes('listen') && m.includes('spell')) return 'listen_and_spell';
      if (m === 'multi_choice' || m.includes('multi_choice') || m.includes('picture_multi_choice') || m === 'easy_picture' || m === 'picture' || m === 'picture_mode' || m.includes('read')) return 'multi_choice';
      if (m === 'spelling' || m === 'missing_letter' || (m.includes('spell') && !m.includes('listen'))) return 'spelling';
      if (m.includes('level_up')) return 'level_up';
      return m;
    };
    const norm = (v) => (v||'').toString().trim().toLowerCase();
    const stripExt = (v) => v.replace(/\.json$/i, '');

    async function fetchSessionsFor(listFile) {
      const urlBase = new URL(FN('progress_summary'), window.location.origin);
      urlBase.searchParams.set('section', 'sessions');
      const scoped = new URL(urlBase.toString());
      scoped.searchParams.set('list_name', listFile);
      let res = await fetch(scoped.toString(), { cache: 'no-store', credentials: 'include' });
      let data = [];
      if (res.ok) data = await res.json();
      if (!data || !data.length) {
        res = await fetch(urlBase.toString(), { cache: 'no-store', credentials: 'include' });
        if (res.ok) data = await res.json();
      }
      return Array.isArray(data) ? data : [];
    }

    function matchesListName(listFile, rowName) {
      const target = norm(listFile);
      const targetNoExt = stripExt(target);
      const n = norm(rowName);
      return (n === target || n === targetNoExt || stripExt(n) === targetNoExt);
    }

    async function computePercent(listFile) {
      const sessions = await fetchSessionsFor(listFile);
      if (!sessions.length) return 0;
      const bestByMode = {};
      sessions.forEach(s => {
        if (!s) return;
        if (!matchesListName(listFile, s.list_name) && !matchesListName(listFile, s.summary && (s.summary.list_name || s.summary.listName))) return;
        let sum = s.summary; try { if (typeof sum === 'string') sum = JSON.parse(sum); } catch {}
        const key = canonicalMode(s.mode);
        let pct = null;
        if (sum && typeof sum.score === 'number' && typeof sum.total === 'number' && sum.total > 0) {
          pct = Math.round((sum.score / sum.total) * 100);
        } else if (sum && typeof sum.score === 'number' && typeof sum.max === 'number' && sum.max > 0) {
          pct = Math.round((sum.score / sum.max) * 100);
        } else if (sum && typeof sum.accuracy === 'number') {
          pct = Math.round((sum.accuracy || 0) * 100);
        } else if (typeof s.correct === 'number' && typeof s.total === 'number' && s.total > 0) {
          pct = Math.round((s.correct / s.total) * 100);
        } else if (typeof s.accuracy === 'number') {
          pct = Math.round((s.accuracy || 0) * 100);
        }
        if (pct != null) {
          if (!(key in bestByMode) || (bestByMode[key].pct ?? -1) < pct) bestByMode[key] = { pct };
        }
      });
      let total = 0;
      modeIds.forEach(m => { const v = bestByMode[m]; if (v && typeof v.pct === 'number') total += v.pct; });
      return Math.round(total / modeIds.length);
    }

    const percents = await Promise.all(allLists.map(l => computePercent(l.file).catch(() => 0)));

    // Re-render with actual percentages
    const container = document.getElementById('sampleWordlistList');
    container.innerHTML = allLists.map((item, idx) => {
      const pct = Math.max(0, Math.min(100, percents[idx] || 0));
      return `<button class="wl-btn" data-idx="${idx}" data-file="${item.file}" style="width:100%;height:auto;margin:0;background:none;border:none;font-size:1.1rem;cursor:pointer;font-family:'Poppins',Arial,sans-serif;color:#19777e;padding:12px 18px;border-radius:0px;position:relative;display:flex;align-items:center;justify-content:space-between;">
        <span style="font-size:2em;flex-shrink:0;">${item.emoji}</span>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex:1;min-width:0;">
          <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
            <span style="font-weight:600;min-width:0;text-align:right;">${item.label}</span>
            <span class="wl-percent" style="font-size:0.95em;color:#19777e;font-weight:500;text-align:right;">${pct}%</span>
          </div>
          <div class="wl-bar" style="margin-top:7px;">
            <div class="wl-bar-fill" data-final="true" style="width:${pct}%;"></div>
          </div>
        </div>
      </button>`;
    }).join('');

    // Re-bind click handlers
    Array.from(container.children).forEach((btn) => {
      btn.onclick = () => {
        modal.style.display = 'none';
        if (onChoose) onChoose(allLists[Number(btn.getAttribute('data-idx'))].file);
      };
    });
  })();
}
