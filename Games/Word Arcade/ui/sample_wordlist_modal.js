// Sample Wordlist Modal

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
      justify-content: flex-start !important;
      gap: 12px !important;
      width: 100% !important;
      height: auto !important;
      margin: 0 !important;
      padding: 12px 18px !important;
      background: none !important;
      border: none !important;
      box-shadow: none !important;
      text-align: left !important;
    }
    /* Hide any decorative pseudo elements from global styles */
    #sampleWordlistModal .wl-btn::before,
    #sampleWordlistModal .wl-btn::after,
    #sampleWordlistModal .mode-btn::before,
    #sampleWordlistModal .mode-btn::after { display: none !important; content: none !important; }
  `;
  document.head.appendChild(style);
}

export function showSampleWordlistModal({ onChoose }) {
  ensureWordlistModalStyles();
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
  // Category mapping
  const categories = [
    { label: 'Animals', lists: [
      { label: 'Easy Animals', file: 'EasyAnimals.json' },
      { label: 'More Animals', file: 'Animals2.json' }
    ]},
    { label: 'Food', lists: [
      { label: 'Fruits & Veggies', file: 'Food1.json' },
      { label: 'Meals & Snacks', file: 'Food2.json' },
      { label: 'World Foods', file: 'Food3.json' }
    ]},
    { label: 'Lifestyle & Activities', lists: [
      { label: 'Jobs (Easy)', file: 'EasyJobs.json' },
      { label: 'Getting Around', file: 'Transportation.json' },
      { label: 'Hobbies (Easy)', file: 'EasyHobbies.json' },
      { label: 'Sports', file: 'Sports.json' },
      { label: 'School Things', file: 'SchoolSupplies.json' },
      // Basic Words at the bottom
      { label: 'Mixed Words (All)', file: 'sample-wordlist.json' },
      { label: 'Mixed Words (15)', file: 'sample-wordlist-15.json' }
    ]},
    { label: 'Verbs & Adjectives', lists: [
      { label: 'Action Words (Easy)', file: 'EasyVerbs.json' },
      { label: 'Feelings & Emotions', file: 'Feelings.json' }
    ]},
    { label: 'Phonics', lists: [
      { label: 'Long U (Phonics)', file: 'LongU.json' }
    ]}
  ];

  // Emoji for each category
  const categoryEmojis = {
    'Animals': '🐶',
    'Food': '🍎',
    'Lifestyle & Activities': '🏃',
    'Verbs & Adjectives': '💬',
    'Phonics': '🔤'
  };
  function renderCategoryMenu() {
    modal.innerHTML = `
      <div style="width:80vw;max-width:420px;max-height:85vh;background:#fff;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,0.25);overflow:hidden;display:flex;flex-direction:column;font-family:'Poppins',Arial,sans-serif;position:relative;">
        <div id="wa-browse-header" style="position:sticky;top:0;background:#f6feff;border-bottom:2px solid #a9d6e9;z-index:1;">
          <div style="display:flex;align-items:center;gap:8px;justify-content:space-between;padding:10px 12px;">
            <span style="font-size:1.3em;color:#19777e;font-weight:700;">Choose a Category</span>
            <button id="closeSampleWordlistModalX" title="Close" style="margin-left:auto;cursor:pointer;border:none;background:transparent;color:#19777e;font-size:20px;font-weight:700;">✕</button>
          </div>
        </div>
        <div id="sampleCategoryList" style="padding:12px 0;overflow:auto;"></div>
        <button id="closeSampleWordlistModal" style="margin:12px 18px 12px 18px;padding:8px 18px;border-radius:8px;background:#93cbcf;color:#fff;font-weight:700;border:none;box-shadow:0 2px 8px rgba(60,60,80,0.08);cursor:pointer;">Cancel</button>
      </div>
    `;
    modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
    document.getElementById('closeSampleWordlistModal').onclick = () => { modal.style.display = 'none'; };
    document.getElementById('closeSampleWordlistModalX').onclick = () => { modal.style.display = 'none'; };
  const list = document.getElementById('sampleCategoryList');
    list.className = '';
    list.style.gridTemplateColumns = '';
    list.innerHTML = categories.map((cat, i) => `
      <button class="wl-btn" data-idx="${i}" style="display:flex;align-items:center;justify-content:flex-start;gap:12px;width:100%;height:auto;margin:0;background:none;border:none;font-size:1.1rem;cursor:pointer;font-family:'Poppins',Arial,sans-serif;color:#19777e;padding:12px 18px;border-radius:10px;">
        <span style="font-size:2em;">${categoryEmojis[cat.label] || '📚'}</span>
        <span style="font-weight:600;">${cat.label}</span>
      </button>
    `).join('');
    Array.from(list.children).forEach((btn) => {
      btn.onclick = () => {
        renderListMenu(categories[Number(btn.getAttribute('data-idx'))]);
      };
    });
    modal.style.display = 'flex';
  }

  function renderListMenu(category) {
    modal.innerHTML = `
      <div style="width:80vw;max-width:420px;max-height:85vh;background:#fff;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,0.25);overflow:hidden;display:flex;flex-direction:column;font-family:'Poppins',Arial,sans-serif;position:relative;">
        <div id="wa-browse-header" style="position:sticky;top:0;background:#f6feff;border-bottom:2px solid #a9d6e9;z-index:1;">
          <div style="display:flex;align-items:center;gap:8px;justify-content:space-between;padding:10px 12px;">
            <span style="font-size:1.3em;color:#19777e;font-weight:700;">${category.label}</span>
            <button id="closeSampleWordlistModalX" title="Close" style="margin-left:auto;cursor:pointer;border:none;background:transparent;color:#19777e;font-size:20px;font-weight:700;">✕</button>
          </div>
        </div>
        <div id="sampleWordlistList" style="padding:12px 0;overflow:auto;"></div>
        <div style="display:flex;gap:8px;justify-content:flex-end;padding:0 18px 12px 18px;">
          <button id="backToCategories" style="padding:8px 18px;border-radius:8px;background:#eceff1;color:#19777e;font-weight:700;border:none;box-shadow:0 2px 8px rgba(60,60,80,0.08);cursor:pointer;">Back</button>
          <button id="closeSampleWordlistModal" style="padding:8px 18px;border-radius:8px;background:#93cbcf;color:#fff;font-weight:700;border:none;box-shadow:0 2px 8px rgba(60,60,80,0.08);cursor:pointer;">Cancel</button>
        </div>
      </div>
    `;
    modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
    document.getElementById('closeSampleWordlistModal').onclick = () => { modal.style.display = 'none'; };
    document.getElementById('closeSampleWordlistModalX').onclick = () => { modal.style.display = 'none'; };
    document.getElementById('backToCategories').onclick = () => renderCategoryMenu();
  const list = document.getElementById('sampleWordlistList');
  list.className = '';
  list.style.gridTemplateColumns = '';
  // Emoji per sub-list
    const listEmojis = {
      'EasyAnimals.json': '🐯',
      'Animals2.json': '🐼',
      'Food1.json': '🍎',
      'Food2.json': '🍔',
      'Food3.json': '🍣',
      'EasyJobs.json': '👩‍🔧',
      'Transportation.json': '🚗',
      'EasyHobbies.json': '🎨',
      'Sports.json': '🏀',
      'SchoolSupplies.json': '✏️',
      'sample-wordlist.json': '📚',
      'sample-wordlist-15.json': '📝',
      'EasyVerbs.json': '🏃‍♂️',
      'Feelings.json': '😊',
      'LongU.json': '🦄'
    };
    // 1) Render 0% skeleton buttons immediately
    list.innerHTML = category.lists.map((it, i) => {
      const emoji = listEmojis[it.file] || categoryEmojis[category.label] || '📚';
      return `<button class="wl-btn" data-idx="${i}" data-file="${it.file}" style="width:100%;height:auto;margin:0;background:none;border:none;font-size:1.1rem;cursor:pointer;font-family:'Poppins',Arial,sans-serif;color:#19777e;padding:12px 18px;border-radius:10px;position:relative;">
        <span style="font-size:2em; margin-right:12px;">${emoji}</span>
        <div style="display:flex;flex-direction:column;gap:6px;flex:1;min-width:0;">
          <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;">
            <span style="font-weight:600;min-width:0;">${it.label}</span>
            <span class="wl-percent" style='font-size:0.95em;color:#19777e;font-weight:500;'>0%</span>
          </div>
          <div class="wl-bar" style="width:100%;height:7px;background:#e0e7ef;border-radius:4px;overflow:hidden;margin-top:7px;">
            <div class="wl-bar-fill" style="height:100%;width:0%;background:linear-gradient(90deg,#93cbcf,#19777e);transition:width .3s ease;"></div>
          </div>
        </div>
      </button>`;
    }).join('');
    Array.from(list.children).forEach((btn) => {
      btn.onclick = () => {
        modal.style.display = 'none';
        if (onChoose) onChoose(category.lists[Number(btn.getAttribute('data-idx'))].file);
      };
    });
    modal.style.display = 'flex';

    // 2) Fetch sessions once and compute combined percent per list
    (async () => {
      // Normalizer for matching list_name to filename/label
      const norm = (s) => String(s || '')
        .toLowerCase()
        .replace(/\.(json|csv|txt)$/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
      const isMatch = (a, b) => {
        const na = norm(a), nb = norm(b);
        if (!na || !nb) return false;
        return na === nb || na.includes(nb) || nb.includes(na);
      };

      let sessions = [];
      try {
        const url = new URL('/.netlify/functions/progress_summary', window.location.origin);
        url.searchParams.set('section', 'sessions');
        // Try to include Supabase access token if available
        let headers = {};
        try {
          const supa = window.__supabase;
          if (supa && supa.auth && typeof supa.auth.getSession === 'function') {
            const { data: { session } } = await supa.auth.getSession();
            if (session?.access_token) headers = { Authorization: `Bearer ${session.access_token}` };
          }
        } catch {}
        const res = await fetch(url.toString(), { cache: 'no-store', headers });
        if (res.ok) sessions = await res.json();
      } catch {}

      const tracked = ['meaning','listening','multi_choice','listen_and_spell','spelling','level_up'];

      const percents = category.lists.map((it) => {
        const bestByMode = {};
        (Array.isArray(sessions) ? sessions : []).forEach(s => {
          if (!s) return;
          const ln = s.list_name != null ? String(s.list_name) : '';
          if (!(isMatch(ln, it.file) || isMatch(ln, it.label))) return;
          let sum = s.summary; try { if (typeof sum === 'string') sum = JSON.parse(sum); } catch {}
          let pct = 0;
          if (sum && typeof sum.total === 'number' && typeof sum.score === 'number' && sum.total > 0) {
            pct = Math.round((sum.score / sum.total) * 100);
          } else if (sum && typeof sum.max === 'number' && typeof sum.score === 'number' && sum.max > 0) {
            pct = Math.round((sum.score / sum.max) * 100);
          } else if (sum && typeof sum.accuracy === 'number') {
            pct = Math.round(Math.max(0, Math.min(1, sum.accuracy)) * 100);
          }
          const modeKey = String(s.mode || '').toLowerCase();
          if (!bestByMode[modeKey] || bestByMode[modeKey] < pct) bestByMode[modeKey] = pct;
        });
        let sumPct = 0, count = 0;
        tracked.forEach(m => { if (typeof bestByMode[m] === 'number') { sumPct += bestByMode[m]; count++; } });
        return count ? Math.round(sumPct / count) : 0;
      });

      // 3) Re-render with actual percents
      list.innerHTML = category.lists.map((it, i) => {
        const emoji = listEmojis[it.file] || categoryEmojis[category.label] || '📚';
        const pct = Math.max(0, Math.min(100, percents[i] || 0));
        return `<button class="wl-btn" data-idx="${i}" data-file="${it.file}" style="width:100%;height:auto;margin:0;background:none;border:none;font-size:1.1rem;cursor:pointer;font-family:'Poppins',Arial,sans-serif;color:#19777e;padding:12px 18px;border-radius:10px;position:relative;">
          <span style="font-size:2em; margin-right:12px;">${emoji}</span>
          <div style="display:flex;flex-direction:column;gap:6px;flex:1;min-width:0;">
            <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;">
              <span style="font-weight:600;min-width:0;">${it.label}</span>
              <span class="wl-percent" style='font-size:0.95em;color:#19777e;font-weight:500;'>${pct}%</span>
            </div>
            <div class="wl-bar" style="width:100%;height:7px;background:#e0e7ef;border-radius:4px;overflow:hidden;margin-top:7px;">
              <div class="wl-bar-fill" style="height:100%;width:${pct}%;background:linear-gradient(90deg,#93cbcf,#19777e);transition:width .3s ease;"></div>
            </div>
          </div>
        </button>`;
      }).join('');

      Array.from(list.children).forEach((btn) => {
        btn.onclick = () => {
          modal.style.display = 'none';
          if (onChoose) onChoose(category.lists[Number(btn.getAttribute('data-idx'))].file);
        };
      });
    })();
  }

  renderCategoryMenu();
}
