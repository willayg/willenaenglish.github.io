// Level 3 Modal - Word list selector with progress bars
import { FN } from '../scripts/api-base.js';

let __l3ModalStylesInjected = false;
function ensureLevel3ModalStyles() {
  if (__l3ModalStylesInjected) return;
  __l3ModalStylesInjected = true;
  const style = document.createElement('style');
  style.id = 'l3-modal-scoped-styles';
  style.textContent = `
    #level3Modal .l3-btn {
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
    #level3Modal .l3-btn:hover { background-color: #f0f9fa !important; }
    #level3Modal .l3-btn + .l3-btn { border-top: 1px solid #b0e2e4ff !important; }
    #level3Modal .l3-btn::before, #level3Modal .l3-btn::after { display: none !important; content: none !important; }

    #level3Modal .l3-bar { width: 100%; height: 16px; border-radius: 9999px; border: 2px solid #27c5ca; background: #fff; overflow: hidden; }
    #level3Modal .l3-bar-fill { height: 100%; width: 0%; border-radius: inherit; background-image: linear-gradient(90deg, #ffe082, #ffb300); transition: width .3s ease; }
    #level3Modal .l3-bar-fill.loading { width: 100% !important; background: linear-gradient(90deg, #b0e2e4 0%, #7fc5ca 50%, #b0e2e4 100%); background-size: 200% 100%; animation: l3BarGlow 1.5s ease-in-out infinite; }
    @keyframes l3BarGlow { 0%,100%{ background-position: 200% 0; opacity: .7;} 50%{ background-position: 0 0; opacity:1;} }
  `;
  document.head.appendChild(style);
}

export function showLevel3Modal({ onChoose, onClose }) {
  ensureLevel3ModalStyles();
  const level3Lists = [
    // Verbs (5-8)
    { label: 'Verbs 5', file: 'sample-wordlists-level3/Verbs5.json', emoji: '🗣️', progressKey: 'Level 3 - Verbs 5' },
    { label: 'Verbs 6', file: 'sample-wordlists-level3/Verbs6.json', emoji: '💪', progressKey: 'Level 3 - Verbs 6' },
    { label: 'Verbs 7', file: 'sample-wordlists-level3/Verbs7.json', emoji: '🏃', progressKey: 'Level 3 - Verbs 7' },
    { label: 'Verbs 8', file: 'sample-wordlists-level3/Verbs8.json', emoji: '💬', progressKey: 'Level 3 - Verbs 8' },
    // Adjectives (4-6)
    { label: 'Adjectives 4', file: 'sample-wordlists-level3/Adjectives4.json', emoji: '✨', progressKey: 'Level 3 - Adjectives 4' },
    { label: 'Adjectives 5', file: 'sample-wordlists-level3/Adjectives5.json', emoji: '✨', progressKey: 'Level 3 - Adjectives 5' },
    { label: 'Adjectives 6', file: 'sample-wordlists-level3/Adjectives6.json', emoji: '✨', progressKey: 'Level 3 - Adjectives 6' },
  ];

  let modal = document.getElementById('level3Modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'level3Modal';
    modal.style.cssText = `position:fixed;top:0;left:0;width:100vw;height:100vh;background:linear-gradient(120deg, rgba(25,119,126,0.22) 0%, rgba(255,255,255,0.18) 100%);backdrop-filter:blur(12px) saturate(1.2);-webkit-backdrop-filter:blur(12px) saturate(1.2);z-index:1000;display:flex;align-items:center;justify-content:center;`;
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div style="width:95vw;max-width:420px;max-height:85vh;background:#fff;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,0.25);overflow:hidden;display:flex;flex-direction:column;font-family:'Poppins',Arial,sans-serif;border:3px solid #27c5ca;">
      <div style="position:sticky;top:0;background:#f6feff;border-bottom:2px solid #a9d6e9;display:flex;align-items:center;justify-content:space-between;padding:10px 12px;z-index:1;">
        <span style="font-size:1.3em;color:#19777e;font-weight:700;">Level 3 Word Lists</span>
        <button id="closeLevel3ModalX" style="cursor:pointer;border:none;background:transparent;color:#19777e;font-size:20px;font-weight:700;">✕</button>
      </div>
      <div id="level3ListContainer" style="padding:12px 0;overflow:auto;flex:1;">
        ${level3Lists.map((item, idx) => `
          <button class="l3-btn" data-idx="${idx}" data-file="${item.file}" data-label="${item.label}" data-progress="${item.progressKey}" style="width:100%;height:auto;margin:0;background:none;border:none;font-size:1.1rem;cursor:pointer;font-family:'Poppins',Arial,sans-serif;color:#19777e;padding:12px 18px;border-radius:0px;position:relative;display:flex;align-items:center;justify-content:space-between;">
            <span style="font-size:2em;flex-shrink:0;">${item.emoji}</span>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex:1;min-width:0;">
              <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
                <span style="font-weight:600;min-width:0;text-align:right;">${item.label}</span>
                <span class="l3-percent" style="font-size:0.95em;color:#19777e;font-weight:500;text-align:right;">0%</span>
              </div>
              <div class="l3-bar" style="margin-top:7px;">
                <div class="l3-bar-fill loading" data-final="false"></div>
              </div>
            </div>
          </button>
        `).join('')}
      </div>
      <div style="padding:12px 18px;display:flex;justify-content:flex-end;gap:8px;border-top:1px solid #e0f2f4;">
        <button id="closeLevel3Modal" style="padding:8px 18px;border-radius:8px;border:none;font-weight:700;cursor:pointer;background:#eceff1;color:#19777e;box-shadow:0 2px 8px rgba(60,60,80,0.08);">Cancel</button>
      </div>
    </div>
  `;

  modal.style.display = 'flex';

  document.getElementById('closeLevel3ModalX').onclick = () => {
    modal.style.display = 'none';
    if (onClose) onClose();
  };
  document.getElementById('closeLevel3Modal').onclick = () => {
    modal.style.display = 'none';
    if (onClose) onClose();
  };
  modal.onclick = (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
      if (onClose) onClose();
    }
  };

  document.querySelectorAll('.l3-btn').forEach(btn => {
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

  (async () => {
    const modeIds = ['meaning', 'listening', 'multi_choice', 'listen_and_spell', 'spelling', 'level_up'];
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
      let scoped = new URL(urlBase.toString());
      scoped.searchParams.set('list_name', item.progressKey);
      try {
        let res = await fetch(scoped.toString(), { cache: 'no-store', credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length) return data;
        }
      } catch {}
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
      const targets = [ norm(item.progressKey), norm(item.label), norm(item.file) ];
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
      return Math.round(total / 6);
    }

    const percents = await Promise.all(level3Lists.map(l => computePercent(l).catch(() => 0)));

    const container = document.getElementById('level3ListContainer');
    container.innerHTML = level3Lists.map((item, idx) => {
      const pct = Math.max(0, Math.min(100, percents[idx] || 0));
      return `<button class="l3-btn" data-idx="${idx}" data-file="${item.file}" data-label="${item.label}" data-progress="${item.progressKey}" style="width:100%;height:auto;margin:0;background:none;border:none;font-size:1.1rem;cursor:pointer;font-family:'Poppins',Arial,sans-serif;color:#19777e;padding:12px 18px;border-radius:0px;position:relative;display:flex;align-items:center;justify-content:space-between;">
        <span style="font-size:2em;flex-shrink:0;">${item.emoji}</span>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex:1;min-width:0;">
          <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
            <span style="font-weight:600;min-width:0;text-align:right;">${item.label}</span>
            <span class="l3-percent" style="font-size:0.95em;color:#19777e;font-weight:500;text-align:right;">${pct}%</span>
          </div>
          <div class="l3-bar" style="margin-top:7px;">
            <div class="l3-bar-fill" data-final="true" style="width:${pct}%;"></div>
          </div>
        </div>
      </button>`;
    }).join('');

    container.querySelectorAll('.l3-btn').forEach(btn => {
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
  })();
}
