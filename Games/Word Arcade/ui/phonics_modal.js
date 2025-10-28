// Phonics Learning Modal
// Matches the sample wordlist style with progress bars

import { FN } from '../scripts/api-base.js';
import { showModeModal } from './mode_modal.js';
import { progressCache } from '../utils/progress-cache.js';

let __phonicsModalStylesInjected = false;
function ensurePhonicsModalStyles() {
  if (__phonicsModalStylesInjected) return;
  __phonicsModalStylesInjected = true;
  const style = document.createElement('style');
  style.id = 'phonics-modal-scoped-styles';
  style.textContent = `
    #phonicsModal .phonics-btn {
      display: flex !important;
      flex-direction: row !important;
      align-items: center !important;
      justify-content: space-between !important;
      gap: 12px !important;
      width: 100% !important;
      height: auto !important;
      margin: 8px 0 !important;
      padding: 12px 18px !important;
      background: none !important;
      border: none !important;
      box-shadow: none !important;
      border-radius: 0px !important;
      cursor: pointer !important;
      font-family: 'Poppins', Arial, sans-serif !important;
      color: #19777e !important;
    }
    #phonicsModal .phonics-btn:hover {
      background-color: #f0f9fa !important;
    }
    #phonicsModal .phonics-btn + .phonics-btn {
      border-top: 1px solid #b0e2e4ff !important;
    }
    #phonicsModal .phonics-btn::before,
    #phonicsModal .phonics-btn::after {
      display: none !important;
      content: none !important;
    }

    /* Progress bar styling */
    #phonicsModal .phonics-bar {
      width: 100%;
      height: 16px;
      border-radius: 9999px;
      border: 2px solid #27c5caff;
      background: #ffffff;
      overflow: hidden;
    }
    #phonicsModal .phonics-bar-fill {
      height: 100%;
      width: 0%;
      border-radius: inherit;
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
    #phonicsModal .phonics-bar-fill.loading {
      width: 100% !important;
      background: linear-gradient(90deg, 
        #b0e2e4 0%, 
        #7fc5ca 25%,
        #c0e8eb 50%,
        #7fc5ca 75%,
        #b0e2e4 100%);
      background-size: 200% 100%;
      animation: phonicsBarGlow 1.5s ease-in-out infinite;
    }
    @keyframes phonicsBarGlow {
      0%, 100% { background-position: 200% 0; opacity: 0.7; }
      50% { background-position: 0% 0; opacity: 1; }
    }
  `;
  document.head.appendChild(style);
}

export function showPhonicsModal({ onChoose, onClose }) {
  ensurePhonicsModalStyles();

  const phonicsLists = [
    // Short Vowels
    { label: 'Short A Sound', file: 'phonics-lists/short-vowels/short-a.json', emoji: '🐱', progressKey: 'Phonics - Short A Sound' },
    { label: 'Short E Sound', file: 'phonics-lists/short-vowels/short-e.json', emoji: '🥚', progressKey: 'Phonics - Short E Sound' },
    { label: 'Short I Sound', file: 'phonics-lists/short-vowels/short-i.json', emoji: '🏠', progressKey: 'Phonics - Short I Sound' },
    { label: 'Short O Sound', file: 'phonics-lists/short-vowels/short-o.json', emoji: '🐕', progressKey: 'Phonics - Short O Sound' },
    { label: 'Short U Sound', file: 'phonics-lists/short-vowels/short-u.json', emoji: '☀️', progressKey: 'Phonics - Short U Sound' },
    // Long Vowels
    { label: 'Long A Sound', file: 'phonics-lists/long-vowels/long-a.json', emoji: '🍰', progressKey: 'Phonics - Long A Sound' },
    { label: 'Long E Sound', file: 'phonics-lists/long-vowels/long-e.json', emoji: '🐝', progressKey: 'Phonics - Long E Sound' },
    { label: 'Long I Sound', file: 'phonics-lists/long-vowels/long-i.json', emoji: '🍦', progressKey: 'Phonics - Long I Sound' },
    { label: 'Long O Sound', file: 'phonics-lists/long-vowels/long-o.json', emoji: '🌊', progressKey: 'Phonics - Long O Sound' },
    { label: 'Long U Sound', file: 'phonics-lists/long-vowels/long-u.json', emoji: '🐮', progressKey: 'Phonics - Long U Sound' },
    { label: 'Long A: AI, AY', file: 'phonics-lists/long-vowels/long-a-ai-ay.json', emoji: '☔', progressKey: 'Phonics - Long A: AI, AY' },
    { label: 'Long O: OA, OE', file: 'phonics-lists/long-vowels/long-o-oa-oe.json', emoji: '⛵', progressKey: 'Phonics - Long O: OA, OE' },
    // Consonant Blends
    { label: 'Blend: BL, BR', file: 'phonics-lists/consonant-blends/blend-br-bl.json', emoji: '🎈', progressKey: 'Phonics - Blend: BL, BR' },
    { label: 'Blend: CL, CR', file: 'phonics-lists/consonant-blends/blend-cr-cl.json', emoji: '☁️', progressKey: 'Phonics - Blend: CL, CR' },
    { label: 'Blend: DR, FL, FR', file: 'phonics-lists/consonant-blends/blend-dr-fl-fr.json', emoji: '🌸', progressKey: 'Phonics - Blend: DR, FL, FR' },
    { label: 'Blend: GL, GR', file: 'phonics-lists/consonant-blends/blend-gr-gl.json', emoji: '🍇', progressKey: 'Phonics - Blend: GL, GR' },
    { label: 'Blend: PL, PR', file: 'phonics-lists/consonant-blends/blend-pl-pr-sc.json', emoji: '🌳', progressKey: 'Phonics - Blend: PL, PR' },
    { label: 'Blend: SK, SL, SM, SN, SP, ST, SW', file: 'phonics-lists/consonant-blends/blend-sk-sl-sm-sn-sp-st-sw.json', emoji: '⭐', progressKey: 'Phonics - Blend: SK, SL, SM, SN, SP, ST, SW' },
    { label: 'Blend: TR, TW', file: 'phonics-lists/consonant-blends/blend-tr-tw.json', emoji: '🎄', progressKey: 'Phonics - Blend: TR, TW' },
    // More Patterns
    { label: 'CH, SH Words', file: 'phonics-lists/more/ch-sh.json', emoji: '🪑', progressKey: 'Phonics - CH, SH Words' },
    { label: 'TH, WH Words', file: 'phonics-lists/more/th-wh.json', emoji: '⚡', progressKey: 'Phonics - TH, WH Words' },
    { label: 'CK, NG, MP Endings', file: 'phonics-lists/more/ck-ng-mp.json', emoji: '🎵', progressKey: 'Phonics - CK, NG, MP Endings' }
  ];

  let modal = document.getElementById('phonicsModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'phonicsModal';
    modal.style.cssText = `position:fixed;top:0;left:0;width:100vw;height:100vh;background:linear-gradient(120deg, rgba(25,119,126,0.22) 0%, rgba(255,255,255,0.18) 100%);backdrop-filter:blur(12px) saturate(1.2);-webkit-backdrop-filter:blur(12px) saturate(1.2);z-index:1000;display:flex;align-items:center;justify-content:center;`;
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div style="width:95vw;max-width:420px;max-height:85vh;background:#fff;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,0.25);overflow:hidden;display:flex;flex-direction:column;font-family:'Poppins',Arial,sans-serif;border:3px solid #27c5ca;">
      <div style="position:sticky;top:0;background:#f6feff;border-bottom:2px solid #a9d6e9;display:flex;align-items:center;justify-content:space-between;padding:10px 12px;z-index:1;">
        <span style="font-size:1.3em;color:#19777e;font-weight:700;">Phonics Levels</span>
        <button id="closePhonicsModalX" style="cursor:pointer;border:none;background:transparent;color:#19777e;font-size:20px;font-weight:700;">✕</button>
      </div>
      <div id="phonicsListContainer" style="padding:12px 0;overflow:auto;flex:1;">
        ${phonicsLists.map((item, idx) => `
          <button class="phonics-btn" data-idx="${idx}" data-file="${item.file}" data-label="${item.label}" data-progress="${item.progressKey}" style="width:100%;height:auto;margin:0;background:none;border:none;font-size:1.1rem;cursor:pointer;font-family:'Poppins',Arial,sans-serif;color:#19777e;padding:12px 18px;border-radius:0px;position:relative;display:flex;align-items:center;justify-content:space-between;">
            <span style="font-size:2em;flex-shrink:0;">${item.emoji}</span>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex:1;min-width:0;">
              <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
                <span style="font-weight:600;min-width:0;text-align:right;">${item.label}</span>
                <span class="phonics-percent" style="font-size:0.95em;color:#19777e;font-weight:500;text-align:right;">0%</span>
              </div>
              <div class="phonics-bar" style="margin-top:7px;">
                <div class="phonics-bar-fill loading" data-final="false"></div>
              </div>
            </div>
          </button>
        `).join('')}
      </div>
      <div style="padding:12px 18px;display:flex;justify-content:flex-end;gap:8px;border-top:1px solid #e0f2f4;">
        <button id="closePhonicsModal" style="padding:8px 18px;border-radius:8px;border:none;font-weight:700;cursor:pointer;background:#eceff1;color:#19777e;box-shadow:0 2px 8px rgba(60,60,80,0.08);">Cancel</button>
      </div>
    </div>
  `;

  modal.style.display = 'flex';

  document.getElementById('closePhonicsModalX').onclick = () => {
    modal.style.display = 'none';
    if (onClose) onClose();
  };
  document.getElementById('closePhonicsModal').onclick = () => {
    modal.style.display = 'none';
    if (onClose) onClose();
  };
  modal.onclick = (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
      if (onClose) onClose();
    }
  };

  document.querySelectorAll('.phonics-btn').forEach(btn => {
    btn.onclick = () => {
      const file = btn.getAttribute('data-file');
      const label = btn.getAttribute('data-label');
      const progressKey = btn.getAttribute('data-progress') || label;
      modal.style.display = 'none';
      // Use progressKey to ensure consistency with progress tracking
      if (onChoose) onChoose({ listFile: file, listName: progressKey, progressKey });
    };
    btn.onmouseenter = () => btn.style.backgroundColor = '#f0f9fa';
    btn.onmouseleave = () => btn.style.backgroundColor = '';
  });

  // Helper to render progress bars
  const renderProgressBars = (percents) => {
    const container = document.getElementById('phonicsListContainer');
    if (!container) return;
    
    container.innerHTML = phonicsLists.map((item, idx) => {
      const pct = Math.max(0, Math.min(100, percents[idx] || 0));
      return `<button class="phonics-btn" data-idx="${idx}" data-file="${item.file}" data-label="${item.label}" data-progress="${item.progressKey}" style="width:100%;height:auto;margin:0;background:none;border:none;font-size:1.1rem;cursor:pointer;font-family:'Poppins',Arial,sans-serif;color:#19777e;padding:12px 18px;border-radius:0px;position:relative;display:flex;align-items:center;justify-content:space-between;">
        <span style="font-size:2em;flex-shrink:0;">${item.emoji}</span>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex:1;min-width:0;">
          <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
            <span style="font-weight:600;min-width:0;text-align:right;">${item.label}</span>
            <span class="phonics-percent" style="font-size:0.95em;color:#19777e;font-weight:500;text-align:right;">${pct}%</span>
          </div>
          <div class="phonics-bar" style="margin-top:7px;">
            <div class="phonics-bar-fill" data-final="true" style="width:${pct}%;"></div>
          </div>
        </div>
      </button>`;
    }).join('');

    // Re-bind click handlers
    container.querySelectorAll('.phonics-btn').forEach(btn => {
      btn.onclick = () => {
        const file = btn.getAttribute('data-file');
        const label = btn.getAttribute('data-label');
        const progressKey = btn.getAttribute('data-progress') || label;
        modal.style.display = 'none';
        if (onChoose) onChoose({ listFile: file, listName: progressKey, progressKey });
      };
      btn.onmouseenter = () => btn.style.backgroundColor = '#f0f9fa';
      btn.onmouseleave = () => btn.style.backgroundColor = '';
    });
  };

  // Compute and render progress like Level 2 modal (WITH CACHING)
  (async () => {
    // Phonics only has 4 modes: Listen & Pick, Missing Letter, Read & Find, Spell It Out
    const modeIds = ['listening', 'spelling', 'multi_choice', 'listen_and_spell'];
    const canonicalMode = (raw) => {
      const m = (raw || 'unknown').toString().toLowerCase();
      if (m === 'matching' || m.startsWith('matching_') || m === 'meaning') return 'meaning';
      if (m === 'phonics_listening' || m === 'listen' || m === 'listening' || (m.startsWith('listening_') && !m.includes('spell'))) return 'listening';
      if (m.includes('listen') && m.includes('spell')) return 'listen_and_spell';
      if (m === 'multi_choice' || m.includes('multi_choice') || m.includes('picture_multi_choice') || m === 'easy_picture' || m === 'picture' || m === 'picture_mode' || m.includes('read')) return 'multi_choice';
      if (m === 'spelling' || m === 'missing_letter' || (m.includes('spell') && !m.includes('listen'))) return 'spelling';
      if (m.includes('level_up')) return 'level_up';
      return m;
    };
    const norm = (v) => (v||'').toString().trim().toLowerCase();

    async function fetchSessionsFor(item) {
      const urlBase = new URL(FN('progress_summary'), window.location.origin);
      urlBase.searchParams.set('section', 'sessions');
      // Try progressKey first (fast path)
      let scoped = new URL(urlBase.toString());
      scoped.searchParams.set('list_name', item.progressKey);
      try {
        let res = await fetch(scoped.toString(), { cache: 'no-store', credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length) return data;
        }
      } catch {}
      // Fallback: fetch all and filter client-side
      try {
        const res = await fetch(urlBase.toString(), { cache: 'no-store', credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          return Array.isArray(data) ? data : [];
        }
      } catch {}
      return [];
    }

    function matchesListName(item, rowName) {
      const targets = [
        norm(item.progressKey),
        norm(item.label),
        norm(item.file)
      ];
      const n = norm(rowName);
      if (!n) return false;
      return targets.some(t => n === t);
    }

    async function computePercent(item) {
      const sessions = await fetchSessionsFor(item);
      if (!sessions.length) return 0;
      const bestByMode = {};
      sessions.forEach(s => {
        if (!s) return;
        if (!matchesListName(item, s.list_name) && !matchesListName(item, s.summary && (s.summary.list_name || s.summary.listName))) return;
        let sum = s.summary; try { if (typeof sum === 'string') sum = JSON.parse(sum); } catch {}
        const key = canonicalMode(s.mode);
        let pct = null; let pts = null;
        if (sum && typeof sum.score === 'number' && typeof sum.total === 'number' && sum.total > 0) {
          pct = Math.round((sum.score / sum.total) * 100);
        } else if (sum && typeof sum.score === 'number' && typeof sum.max === 'number' && sum.max > 0) {
          pct = Math.round((sum.score / sum.max) * 100);
        } else if (sum && typeof sum.accuracy === 'number') {
          pct = Math.round((sum.accuracy || 0) * 100);
        } else if (sum && typeof sum.score === 'number') {
          pts = Math.round(sum.score);
        } else if (typeof s.correct === 'number' && typeof s.total === 'number' && s.total > 0) {
          pct = Math.round((s.correct / s.total) * 100);
        } else if (typeof s.accuracy === 'number') {
          pct = Math.round((s.accuracy || 0) * 100);
        }
        if (pct != null) {
          if (!(key in bestByMode) || (bestByMode[key].pct ?? -1) < pct) bestByMode[key] = { pct };
        } else if (pts != null) {
          if (!(key in bestByMode) || (bestByMode[key].pts ?? -1) < pts) bestByMode[key] = { pts };
        }
      });
      let total = 0;
      modeIds.forEach(m => { const v = bestByMode[m]; if (v && typeof v.pct === 'number') total += v.pct; });
      // Phonics has 4 modes, so divide by 4
      return Math.round(total / 4);
    }

    const fetchAllProgress = async () => {
      return await Promise.all(phonicsLists.map(l => computePercent(l).catch(() => 0)));
    };

    try {
      const { data: percents, fromCache } = await progressCache.fetchWithCache(
        'phonics_progress',
        fetchAllProgress
      );

      renderProgressBars(percents);

      if (fromCache) {
        const unsubscribe = progressCache.onUpdate('phonics_progress', (freshPercents) => {
          renderProgressBars(freshPercents);
          unsubscribe();
        });
      }
    } catch (e) {
      console.error('[phonics_modal] Failed to load progress:', e);
      renderProgressBars(phonicsLists.map(() => 0));
    }
  })();
}
