// Grammar Level 1 Modal - Article game selector with progress bars
// Styled exactly like level4_modal.js

import { loadGrammarLevelProgress } from '../utils/progress-data-service.js';
import { progressCache } from '../utils/progress-cache.js';

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
      background: transparent !important;
      border: 2px solid #27c5ca !important;
      border-radius: 8px !important;
      box-shadow: 0 2px 6px rgba(39, 197, 202, 0.15) !important;
      cursor: pointer !important;
      font-family: 'Poppins', Arial, sans-serif !important;
      color: #ff66c4 !important;
      font-weight: 600 !important;
    }
    #grammarL1Modal .gl1-btn:hover { background-color: rgba(39, 197, 202, 0.08) !important; box-shadow: 0 4px 12px rgba(39, 197, 202, 0.25) !important; }
    #grammarL1Modal .gl1-btn + .gl1-btn { border-top: 2px solid #27c5ca !important; margin-top: 8px !important; }
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
      aliases: ['articles', 'a_vs_an', 'a vs an'],
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
      aliases: ['it_vs_they', 'it vs they'],
      config: {
        lessonModule: 'grammar_lesson_it_vs_they',
        lessonId: 'it_vs_they',
        answerChoices: ['it', 'they'],
        bucketLabels: { it: 'it', they: 'they' }
      }
    },
    {
      id: 'this_vs_that',
      label: 'This vs That',
      emoji: '📍',
      file: 'data/grammar/level1/this_vs_that.json',
      aliases: ['this_vs_that', 'this vs that'],
      config: {
        lessonModule: 'grammar_lesson_this_that',
        lessonId: 'this_vs_that',
        answerChoices: ['this', 'that'],
        bucketLabels: { this: 'this (near)', that: 'that (far)' },
        ruleHint: 'Use this for things close to you, that for things far away.'
      }
    },
    {
      id: 'these_vs_those',
      label: 'These vs Those',
      emoji: '📍📍',
      file: 'data/grammar/level1/these_vs_those.json',
      aliases: ['these_vs_those', 'these vs those'],
      config: {
        lessonModule: 'grammar_lesson_these_those',
        lessonId: 'these_vs_those',
        answerChoices: ['these', 'those'],
        bucketLabels: { these: 'these (near)', those: 'those (far)' },
        ruleHint: 'Use these for things close to you, those for things far away. Plural forms of this and that.'
      }
    },
    {
      id: 'am_are_is',
      label: 'Am vs Are vs Is',
      emoji: '🗣️',
      file: 'data/grammar/level1/am_are_is.json',
      aliases: ['am_are_is', 'am vs are vs is', 'am are is'],
      config: {
        lessonModule: 'grammar_lesson_am_are_is',
        lessonId: 'am_are_is',
        answerChoices: ['am', 'is', 'are'],
        bucketLabels: { am: 'am', is: 'is', are: 'are' },
        ruleHint: 'Use am with I, is with one person or thing, and are with many or you.'
      }
    },
    {
      id: 'have_has',
      label: 'Have vs Has',
      emoji: '🤝',
      file: 'data/grammar/level1/have_vs_has.json',
      aliases: ['have_vs_has', 'have vs has', 'havehas'],
      config: {
        lessonModule: 'grammar_lesson_have_has',
        lessonId: 'have_vs_has',
        answerChoices: ['have', 'has'],
        bucketLabels: { have: 'have', has: 'has' },
        ruleHint: 'Use have with I, you, we, they, or plural nouns. Use has with he, she, it, or one noun.'
      }
    },
    {
      id: 'contractions_be',
      label: 'I am → I\'m',
      emoji: '🔀',
      file: 'data/grammar/level1/contractions_be.json',
      aliases: ['contractions_be', 'contractions be', 'be contractions'],
      config: {
        lessonModule: 'grammar_lesson_contractions_be',
        lessonId: 'contractions_be',
        answerChoices: ["'m", "'re", "'s"],
        bucketLabels: { contraction: 'contractions' },
        ruleHint: 'Choose the correct contraction ending.'
      }
    },
    {
      id: 'want_vs_wants',
      label: 'Want vs Wants',
      emoji: '🙏',
      file: 'data/grammar/level1/want_vs_wants.json',
      aliases: ['want_vs_wants', 'want vs wants', 'wantvswants'],
      config: {
        lessonModule: 'grammar_lesson_want_wants',
        lessonId: 'want_vs_wants',
        answerChoices: ['want', 'wants'],
        bucketLabels: { want: 'want', wants: 'wants' },
        ruleHint: 'Use want with I, you, we, they, or plural nouns. Use wants with he, she, it, or one noun.'
      }
    },
    {
      id: 'like_vs_likes',
      label: 'Like vs Likes',
      emoji: '❤️',
      file: 'data/grammar/level1/like_vs_likes.json',
      aliases: ['like_vs_likes', 'like vs likes', 'likesvslikes'],
      config: {
        lessonModule: 'grammar_lesson_like_likes',
        lessonId: 'like_vs_likes',
        answerChoices: ['like', 'likes'],
        bucketLabels: { like: 'like', likes: 'likes' },
        ruleHint: 'Use like with I, you, we, they, or plural nouns. Use likes with he, she, it, or one noun.'
      }
    },
    {
      id: 'in_on_under',
      label: 'In vs On vs Under',
      emoji: '📦',
      file: 'data/grammar/level1/in_on_under.json',
      aliases: ['in_on_under', 'in vs on vs under', 'prepositions location'],
      config: {
        lessonModule: 'grammar_lesson_in_on_under',
        lessonId: 'in_on_under',
        answerChoices: ['in', 'on', 'under'],
        bucketLabels: { in: 'in', on: 'on', under: 'under' },
        ruleHint: 'Use in for inside, on for on top of, and under for below something.'
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
          <button class="gl1-btn" data-idx="${idx}" data-file="${item.file}" data-label="${item.label}" data-config="${encodeConfig(item.config)}" style="width:100%;height:auto;margin:8px 0;background:transparent;border:2px solid #27c5ca;font-size:1.1rem;cursor:pointer;font-family:'Poppins',Arial,sans-serif;color:#ff66c4;padding:12px 18px;border-radius:8px;position:relative;display:flex;align-items:center;justify-content:space-between;box-shadow:0 2px 6px rgba(39,197,202,0.15);">
            <span style="font-size:2em;flex-shrink:0;">${item.emoji}</span>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex:1;min-width:0;">
              <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
                <span style="font-weight:600;min-width:0;text-align:right;">${item.label}</span>
                <span class="gl1-percent" style="font-size:0.95em;color:#ff66c4;font-weight:500;text-align:right;">0%</span>
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
      return `<button class="gl1-btn" data-idx="${idx}" data-file="${item.file}" data-label="${item.label}" data-config="${encodeConfig(item.config)}" style="width:100%;height:auto;margin:8px 0;background:transparent;border:2px solid #27c5ca;font-size:1.1rem;cursor:pointer;font-family:'Poppins',Arial,sans-serif;color:#ff66c4;padding:12px 18px;border-radius:8px;position:relative;display:flex;align-items:center;justify-content:space-between;box-shadow:0 2px 6px rgba(39,197,202,0.15);">
        <span style="font-size:2em;flex-shrink:0;">${item.emoji}</span>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex:1;min-width:0;">
          <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
            <span style="font-weight:600;min-width:0;text-align:right;">${item.label}</span>
            <span class="gl1-percent" style="font-size:0.95em;color:#ff66c4;font-weight:500;text-align:right;">${pct}%</span>
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
  (async () => {
    try {
      const { data, fromCache } = await loadGrammarLevelProgress(grammarGames);
      if (data?.ready) {
        renderProgressBars(Array.isArray(data.values) ? data.values : grammarGames.map(() => 0));
      } else {
        renderProgressBars(grammarGames.map(() => 0));
      }

      if (fromCache) {
        const unsubscribe = progressCache.onUpdate('grammar_level1_progress', (fresh) => {
          if (fresh?.ready && Array.isArray(fresh.values)) {
            renderProgressBars(fresh.values);
          }
          unsubscribe();
        });
      }
    } catch (error) {
      console.warn('[GrammarL1Modal] Failed to load progress', error);
      renderProgressBars(grammarGames.map(() => 0));
    }
  })();
}
