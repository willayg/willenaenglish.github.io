// Grammar Level 1 Modal - Article game selector with progress bars
// Styled exactly like level4_modal.js

let __grammarL1ModalStylesInjected = false;
function ensureGrammarL1ModalStyles() {
  if (__grammarL1ModalStylesInjected) return;
  __grammarL1ModalStylesInjected = true;
  const style = document.createElement('style');
  style.id = 'grammar-l1-modal-scoped-styles';
  style.textContent = `
    #grammarL1Modal .gl1-btn {
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
    #grammarL1Modal .gl1-btn:hover { background-color: #f0f9fa !important; }
    #grammarL1Modal .gl1-btn + .gl1-btn { border-top: 1px solid #b0e2e4ff !important; }
    #grammarL1Modal .gl1-btn::before, #grammarL1Modal .gl1-btn::after { display: none !important; content: none !important; }

    #grammarL1Modal .gl1-bar { width: 100%; height: 16px; border-radius: 9999px; border: 2px solid #27c5ca; background: #fff; overflow: hidden; }
    #grammarL1Modal .gl1-bar-fill { height: 100%; width: 0%; border-radius: inherit; background-image: linear-gradient(90deg, #ffe082, #ffb300); transition: width .3s ease; }
    #grammarL1Modal .gl1-bar-fill.loading { width: 100% !important; background: linear-gradient(90deg, #b0e2e4 0%, #7fc5ca 50%, #b0e2e4 100%); background-size: 200% 100%; animation: gl1BarGlow 1.5s ease-in-out infinite; }
    @keyframes gl1BarGlow { 0%,100%{ background-position: 200% 0; opacity: .7;} 50%{ background-position: 0 0; opacity:1;} }
  `;
  document.head.appendChild(style);
}

export function showGrammarL1Modal({ onChoose, onClose }) {
  ensureGrammarL1ModalStyles();
  
  // Grammar games list for Level 1
  const grammarGames = [
    {
      id: 'articles',
      label: 'A vs An',
      emoji: '📝',
      file: 'data/grammar/level1/articles.json',
      config: {
        lessonModule: 'grammar_lesson',
        lessonId: 'articles',
        answerChoices: ['a', 'an'],
        bucketLabels: { a: 'a', an: 'an' }
      }
    },
    {
      id: 'it_vs_they',
      label: 'It vs They',
      emoji: '👥',
      file: 'data/grammar/level1/it_vs_they.json',
      config: {
        lessonModule: 'grammar_lesson_it_vs_they',
        lessonId: 'it_vs_they',
        answerChoices: ['it', 'they'],
        bucketLabels: { it: 'it', they: 'they' }
      }
    },
    {
      id: 'am_are_is',
      label: 'Am vs Are vs Is',
      emoji: '🗣️',
      file: 'data/grammar/level1/am_are_is.json',
      config: {
        lessonModule: 'grammar_lesson_am_are_is',
        lessonId: 'am_are_is',
        answerChoices: ['am', 'is', 'are'],
        bucketLabels: { am: 'am', is: 'is', are: 'are' },
        ruleHint: 'Use am with I, is with one person or thing, and are with many or you.'
      }
    }
  ];

  const encodeConfig = (config) => {
    try {
      return encodeURIComponent(JSON.stringify(config || {}));
    } catch {
      return encodeURIComponent('{}');
    }
  };

  const decodeConfig = (encoded) => {
    if (!encoded) return {};
    try {
      return JSON.parse(decodeURIComponent(encoded));
    } catch {
      return {};
    }
  };

  let modal = document.getElementById('grammarL1Modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'grammarL1Modal';
    modal.style.cssText = `position:fixed;top:0;left:0;width:100vw;height:100vh;background:linear-gradient(120deg, rgba(25,119,126,0.22) 0%, rgba(255,255,255,0.18) 100%);backdrop-filter:blur(12px) saturate(1.2);-webkit-backdrop-filter:blur(12px) saturate(1.2);z-index:1000;display:flex;align-items:center;justify-content:center;`;
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div style="width:95vw;max-width:420px;max-height:85vh;background:#fff;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,0.25);overflow:hidden;display:flex;flex-direction:column;font-family:'Poppins',Arial,sans-serif;border:3px solid #27c5ca;">
      <div style="position:sticky;top:0;background:#f6feff;border-bottom:2px solid #a9d6e9;display:flex;align-items:center;justify-content:space-between;padding:10px 12px;z-index:1;">
        <span style="font-size:1.3em;color:#19777e;font-weight:700;">Grammar Games</span>
        <button id="closeGrammarL1ModalX" style="cursor:pointer;border:none;background:transparent;color:#19777e;font-size:20px;font-weight:700;">✕</button>
      </div>
      <div id="grammarL1ListContainer" style="padding:12px 0;overflow:auto;flex:1;">
        ${grammarGames.map((item, idx) => `
          <button class="gl1-btn" data-idx="${idx}" data-file="${item.file}" data-label="${item.label}" data-config="${encodeConfig(item.config)}" style="width:100%;height:auto;margin:0;background:none;border:none;font-size:1.1rem;cursor:pointer;font-family:'Poppins',Arial,sans-serif;color:#19777e;padding:12px 18px;border-radius:0px;position:relative;display:flex;align-items:center;justify-content:space-between;">
            <span style="font-size:2em;flex-shrink:0;">${item.emoji}</span>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex:1;min-width:0;">
              <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
                <span style="font-weight:600;min-width:0;text-align:right;">${item.label}</span>
                <span class="gl1-percent" style="font-size:0.95em;color:#19777e;font-weight:500;text-align:right;">0%</span>
              </div>
              <div class="gl1-bar" style="margin-top:7px;">
                <div class="gl1-bar-fill loading" data-final="false"></div>
              </div>
            </div>
          </button>
        `).join('')}
      </div>
      <div style="padding:12px 18px;display:flex;justify-content:flex-end;gap:8px;border-top:1px solid #e0f2f4;">
        <button id="closeGrammarL1Modal" style="padding:8px 18px;border-radius:8px;border:none;font-weight:700;cursor:pointer;background:#eceff1;color:#19777e;box-shadow:0 2px 8px rgba(60,60,80,0.08);">Cancel</button>
      </div>
    </div>
  `;

  modal.style.display = 'flex';

  document.getElementById('closeGrammarL1ModalX').onclick = () => {
    modal.style.display = 'none';
    if (onClose) onClose();
  };
  document.getElementById('closeGrammarL1Modal').onclick = () => {
    modal.style.display = 'none';
    if (onClose) onClose();
  };
  modal.onclick = (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
      if (onClose) onClose();
    }
  };

  const bindButtons = () => {
    modal.querySelectorAll('.gl1-btn').forEach(btn => {
      btn.onclick = () => {
        const file = btn.getAttribute('data-file');
        const label = btn.getAttribute('data-label');
        const cfg = decodeConfig(btn.getAttribute('data-config'));
        modal.style.display = 'none';
        if (onChoose) onChoose({ grammarFile: file, grammarName: label, grammarConfig: cfg });
      };
      btn.onmouseenter = () => btn.style.backgroundColor = '#f0f9fa';
      btn.onmouseleave = () => btn.style.backgroundColor = '';
    });
  };

  bindButtons();

  const renderProgressBars = (percents) => {
    const container = document.getElementById('grammarL1ListContainer');
    if (!container) return;
    container.innerHTML = grammarGames.map((item, idx) => {
      const pct = Math.max(0, Math.min(100, percents[idx] || 0));
      return `<button class="gl1-btn" data-idx="${idx}" data-file="${item.file}" data-label="${item.label}" data-config="${encodeConfig(item.config)}" style="width:100%;height:auto;margin:0;background:none;border:none;font-size:1.1rem;cursor:pointer;font-family:'Poppins',Arial,sans-serif;color:#19777e;padding:12px 18px;border-radius:0px;position:relative;display:flex;align-items:center;justify-content:space-between;">
        <span style="font-size:2em;flex-shrink:0;">${item.emoji}</span>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex:1;min-width:0;">
          <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
            <span style="font-weight:600;min-width:0;text-align:right;">${item.label}</span>
            <span class="gl1-percent" style="font-size:0.95em;color:#19777e;font-weight:500;text-align:right;">${pct}%</span>
          </div>
          <div class="gl1-bar" style="margin-top:7px;">
            <div class="gl1-bar-fill" data-final="true" style="width:${pct}%;"></div>
          </div>
        </div>
      </button>`;
    }).join('');
    bindButtons();
  };

  // For now, render with 0% progress (grammar progress tracking can be added later)
  renderProgressBars(grammarGames.map(() => 0));
}
