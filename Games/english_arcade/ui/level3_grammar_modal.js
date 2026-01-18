// Grammar Level 3 Modal - simplified selector for Level 3 grammar topics
// Mirrors level2 modal structure but with a focused Level 3 list
import { progressCache } from '../utils/progress-cache.js';
import { loadGrammarLevel3Progress } from '../utils/progress-data-service.js';

let __grammarL3ModalStylesInjected = false;
function ensureGrammarL3ModalStyles() {
  if (__grammarL3ModalStylesInjected) return;
  __grammarL3ModalStylesInjected = true;
  const style = document.createElement('style');
  style.id = 'grammar-l3-modal-scoped-styles';
  style.textContent = `
    #grammarL3Modal .gl3-btn { display:flex !important; flex-direction:row !important; align-items:center !important; justify-content:space-between !important; gap:12px !important; width:100% !important; height:auto !important; margin:8px 0 !important; padding:12px 18px !important; background:none !important; border:none !important; box-shadow:none !important; border-radius:0px !important; cursor:pointer !important; font-family:'Poppins',Arial,sans-serif !important; color:#b35a00 !important; }
    #grammarL3Modal .gl3-btn:hover { background:#fffaf0 !important; }
    #grammarL3Modal .gl3-btn + .gl3-btn { border-top:1px solid #ffe0a6 !important; }
    #grammarL3Modal .gl3-bar { width:100%; height:14px; border-radius:9999px; border:2px solid #ffbd3b; background:#ffffff; overflow:hidden; }
    /* Use 6 segments for Level 3 (one per mode) */
    #grammarL3Modal .gl3-bar-fill { height:100%; width:0%; border-radius:inherit; background-image:
      linear-gradient(to right,
        #ffc107 0,
        #ffc107 calc(100%/6 - 2px),
        transparent calc(100%/6 - 2px),
        transparent calc(100%/6)
      ),
      linear-gradient(90deg,#ffe082,#ffb300);
      background-size:calc(100%/6) 100%, 100% 100%;
      background-repeat:repeat-x,no-repeat; transition:width .3s ease; }
    #grammarL3Modal .gl3-bar-fill.loading { width:100% !important; background:linear-gradient(90deg,#ffe0a6 0%, #ffcc5c 25%, #ffe9c9 50%, #ffcc5c 75%, #ffe0a6 100%); background-size:200% 100%; animation: gl3BarGlow 1.5s ease-in-out infinite; }
    @keyframes gl3BarGlow { 0%,100% { background-position:200% 0; opacity:.7;} 50% { background-position:0% 0; opacity:1; } }
  `;
  document.head.appendChild(style);
}

export function showGrammarL3Modal({ onChoose, onClose }) {
  ensureGrammarL3ModalStyles();
  const SCROLL_KEY = 'grammarL3Modal_scrollTop';

  // Level 3 grammar lists - 21 topics
  let level3Lists = [
    // === PAST TENSE ===
    {
      id: 'past_simple_irregular',
      label: 'Past Simple (Irregular)',
      emoji: '🦁',
      file: 'data/grammar/level3/past_simple_irregular.json',
      config: { ruleHint: 'Common irregular past-tense verbs', grammarType: 'past_irregular' }
    },
    {
      id: 'past_simple_regular',
      label: 'Past Simple (Regular)',
      emoji: '🚶',
      file: 'data/grammar/level3/past_simple_regular.json',
      config: { ruleHint: 'Regular past-tense verbs ending in -ed', grammarType: 'past_simple_regular' }
    },
    {
      id: 'past_tense_questions',
      label: 'Past Tense Questions',
      emoji: '❔',
      file: 'data/grammar/level3/past_tense_questions.json',
      config: { ruleHint: 'Questions in past tense', grammarType: 'past_tense_questions' }
    },
    // === FUTURE TENSE ===
    {
      id: 'be_going_to_future',
      label: 'Be Going To (Future)',
      emoji: '🚀',
      file: 'data/grammar/level3/be_going_to_future.json',
      config: { ruleHint: 'Future plans with "be going to"', grammarType: 'be_going_to' }
    },
    {
      id: 'be_going_to_questions',
      label: 'Be Going To (Questions)',
      emoji: '❓',
      file: 'data/grammar/level3/be_going_to_questions.json',
      config: { ruleHint: 'Questions with "be going to"', grammarType: 'be_going_to_questions' }
    },
    {
      id: 'will_future',
      label: 'Will (Future)',
      emoji: '🔮',
      file: 'data/grammar/level3/will_future.json',
      config: { ruleHint: 'Future predictions with "will"', grammarType: 'will_future' }
    },
    {
      id: 'will_questions',
      label: 'Will (Questions)',
      emoji: '🤔',
      file: 'data/grammar/level3/will_questions.json',
      config: { ruleHint: 'Questions with "will"', grammarType: 'will_questions' }
    },
    // === MIXED TENSES ===
    {
      id: 'past_vs_future',
      label: 'Past vs Future',
      emoji: '⏳',
      file: 'data/grammar/level3/past_vs_future.json',
      config: { ruleHint: 'Comparing past and future tenses', grammarType: 'past_vs_future' }
    },
    // === MODAL VERBS & EXPRESSIONS ===
    {
      id: 'have_to',
      label: 'Have To (Obligation)',
      emoji: '📋',
      file: 'data/grammar/level3/have_to.json',
      config: { ruleHint: 'Express obligation with "have to"', grammarType: 'have_to' }
    },
    {
      id: 'want_to',
      label: 'Want To (Desire)',
      emoji: '💫',
      file: 'data/grammar/level3/want_to.json',
      config: { ruleHint: 'Express desire with "want to"', grammarType: 'want_to' }
    },
    {
      id: 'like_to',
      label: 'Like To (Preference)',
      emoji: '💕',
      file: 'data/grammar/level3/like_to.json',
      config: { ruleHint: 'Express preferences with "like to"', grammarType: 'like_to' }
    },
    {
      id: 'like_to_vs_want_to_vs_have_to',
      label: 'Like vs Want vs Have To',
      emoji: '🎭',
      file: 'data/grammar/level3/like_to_vs_want_to_vs_have_to.json',
      config: { ruleHint: 'Compare like to, want to, and have to', grammarType: 'modal_comparison' }
    },
    {
      id: 'modal_verbs_intermediate',
      label: 'Modal Verbs (Must, Should, May)',
      emoji: '🎯',
      file: 'data/grammar/level3/modal_verbs_intermediate.json',
      config: { ruleHint: 'Must, should, may, might, could, would', grammarType: 'modal_verbs' }
    },
    // === IMPERATIVES & SUGGESTIONS ===
    {
      id: 'imperatives_suggestions',
      label: 'Imperatives & Suggestions',
      emoji: '📢',
      file: 'data/grammar/level3/imperatives_suggestions.json',
      config: { ruleHint: "Commands and suggestions: Let's, Please, Don't", grammarType: 'imperatives' }
    },
    // === PREPOSITIONS ===
    {
      id: 'prepositions_direction',
      label: 'Prepositions of Direction',
      emoji: '🧭',
      file: 'data/grammar/level3/prepositions_direction.json',
      config: { ruleHint: 'Up, down, through, across, around, along', grammarType: 'prepositions_direction' }
    },
    // === ADJECTIVES ===
    {
      id: 'adjectives_people',
      label: 'Adjectives (People)',
      emoji: '👤',
      file: 'data/grammar/level3/adjectives_people.json',
      config: { ruleHint: 'Describing personality and character', grammarType: 'adjectives_people' }
    },
    {
      id: 'adjectives_world',
      label: 'Adjectives (Places & Things)',
      emoji: '🌍',
      file: 'data/grammar/level3/adjectives_world.json',
      config: { ruleHint: 'Describing places and the world', grammarType: 'adjectives_world' }
    },
    // === COMPARATIVES & SUPERLATIVES ===
    {
      id: 'short_comparatives',
      label: 'Comparatives (-er than)',
      emoji: '📊',
      file: 'data/grammar/level3/short_comparatives.json',
      config: { ruleHint: 'Comparing two things: bigger, faster, better', grammarType: 'comparatives' }
    },
    {
      id: 'short_superlatives',
      label: 'Superlatives (the -est)',
      emoji: '🏆',
      file: 'data/grammar/level3/short_superlatives.json',
      config: { ruleHint: 'The most of all: biggest, fastest, best', grammarType: 'superlatives' }
    },
    // === QUANTIFIERS ===
    {
      id: 'a_few_vs_a_little',
      label: 'A Few vs A Little',
      emoji: '🔢',
      file: 'data/grammar/level3/a_few_vs_a_little.json',
      config: { ruleHint: 'Countable vs uncountable nouns', grammarType: 'quantifiers' }
    },
    // === MIXED TENSE QUESTIONS ===
    {
      id: 'mixed_tense_questions',
      label: 'Mixed Tense Questions',
      emoji: '🤷',
      file: 'data/grammar/level3/mixed_tense_questions.json',
      config: { ruleHint: 'Questions in past, present, and future', grammarType: 'mixed_questions' }
    }
  ];
  let modal = document.getElementById('grammarL3Modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'grammarL3Modal';
    modal.style.cssText = `position:fixed;top:0;left:0;width:100vw;height:100vh;background:linear-gradient(120deg, rgba(255,235,205,0.22) 0%, rgba(255,255,255,0.18) 100%);backdrop-filter:blur(8px);z-index:1000;display:flex;align-items:center;justify-content:center;`;
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div style="width:95vw;max-width:440px;max-height:85vh;background:#fff;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,0.25);overflow:hidden;display:flex;flex-direction:column;border:3px solid #ffb300;font-family:'Poppins',Arial,sans-serif;">
      <div style="position:sticky;top:0;background:#fff7e6;border-bottom:2px solid #ffe6b3;display:flex;align-items:center;justify-content:space-between;padding:10px 12px;z-index:1;">
        <span style="font-size:1.3em;color:#b35a00;font-weight:700;">Grammar Level 3</span>
        <button id="closeGrammarL3ModalX" style="cursor:pointer;border:none;background:transparent;color:#b35a00;font-size:20px;font-weight:700;">✕</button>
      </div>
      <div id="gl3ListContainer" style="padding:12px 0;overflow:auto;flex:1;"></div>
      <div style="padding:12px 18px;display:flex;justify-content:flex-end;gap:8px;border-top:1px solid #fff2df;">
        <button id="closeGrammarL3Modal" style="padding:8px 18px;border-radius:8px;border:none;font-weight:700;cursor:pointer;background:#fff3d9;color:#b35a00;box-shadow:0 2px 8px rgba(60,60,80,0.06);">Cancel</button>
      </div>
    </div>
  `;
  modal.style.display = 'flex';

  const listEl = modal.querySelector('#gl3ListContainer');
  listEl.innerHTML = '';

  const restoreScroll = () => {
    try { const saved = Number(localStorage.getItem(SCROLL_KEY)) || 0; const max = Math.max(0, listEl.scrollHeight - listEl.clientHeight); listEl.scrollTop = Math.max(0, Math.min(saved, max)); } catch {}
  };
  const saveScroll = () => { try { localStorage.setItem(SCROLL_KEY, String(listEl.scrollTop)); } catch {} };

  const makeRow = (g, pct, loading) => {
    const btn = document.createElement('button');
    btn.className = 'gl3-btn';
    const percentText = typeof pct === 'number' ? `${Math.max(0, Math.min(100, Math.round(pct)))}%` : '0%';
    btn.innerHTML = `
      <span style="font-size:2em;flex-shrink:0;">${g.emoji || '📘'}</span>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex:1;min-width:0;">
        <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
          <span style="font-weight:600;min-width:0;text-align:right;">${g.label}</span>
          <span class="gl3-percent" style="font-size:0.95em;color:#b35a00;font-weight:500;text-align:right;">${percentText}</span>
        </div>
        <div class="gl3-bar" style="margin-top:7px;">
          <div class="gl3-bar-fill ${loading ? 'loading' : ''}" data-final="${!loading}" style="width:${loading ? '100%' : percentText};"></div>
        </div>
      </div>
    `;
    btn.addEventListener('click', () => {
      saveScroll();
      if (onChoose) onChoose({ grammarFile: g.file, grammarName: g.label, grammarConfig: g.config || {} });
      modal.style.display = 'none';
    });
    btn.onmouseenter = () => btn.style.backgroundColor = '#fffaf0';
    btn.onmouseleave = () => btn.style.backgroundColor = '';
    return btn;
  };

  // Initial loading state render
  level3Lists.forEach((g) => listEl.appendChild(makeRow(g, 0, true)));
  restoreScroll();

  modal.querySelector('#closeGrammarL3ModalX').onclick = () => { saveScroll(); modal.style.display = 'none'; if (onClose) onClose(); };
  modal.querySelector('#closeGrammarL3Modal').onclick = () => { saveScroll(); modal.style.display = 'none'; if (onClose) onClose(); };
  modal.onclick = (e) => { if (e.target === modal) { saveScroll(); modal.style.display = 'none'; if (onClose) onClose(); } };

  // Progress render helper
  const renderProgressBars = (percents) => {
    listEl.innerHTML = '';
    level3Lists.forEach((g, idx) => {
      listEl.appendChild(makeRow(g, percents[idx] || 0, false));
    });
    // Re-bind hover (already on row)
  };

  (async () => {
    try {
      const { data, fromCache } = await loadGrammarLevel3Progress(level3Lists);
      if (data?.ready) renderProgressBars(data.values);
      if (fromCache) {
        const unsubscribe = progressCache.onUpdate('grammar_level3_progress', (fresh) => {
          if (fresh?.ready) renderProgressBars(fresh.values);
          unsubscribe();
        });
      }
    } catch (e) {
      console.error('[grammarL3Modal] Failed to load progress:', e);
      renderProgressBars(level3Lists.map(() => 0));
    }
  })();
}
