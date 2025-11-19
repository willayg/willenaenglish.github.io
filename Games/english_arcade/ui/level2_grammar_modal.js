// Grammar Level 2 Modal - Level 2 grammar selector with progress bars
// Styled like level1_grammar_modal.js

import { loadGrammarLevel2Progress } from '../utils/progress-data-service.js';
import { progressCache } from '../utils/progress-cache.js';

let __grammarL2ModalStylesInjected = false;
function ensureGrammarL2ModalStyles() {
  if (__grammarL2ModalStylesInjected) return;
  __grammarL2ModalStylesInjected = true;
  const style = document.createElement('style');
  style.id = 'grammar-l2-modal-scoped-styles';
  style.textContent = `
    #grammarL2Modal .gl2-btn {
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
    #grammarL2Modal .gl2-btn:hover { background-color: rgba(39, 197, 202, 0.08) !important; box-shadow: 0 4px 12px rgba(39, 197, 202, 0.25) !important; }
    #grammarL2Modal .gl2-btn + .gl2-btn { border-top: 2px solid #27c5ca !important; margin-top: 8px !important; }
    #grammarL2Modal .gl2-btn::before, #grammarL2Modal .gl2-btn::after { display: none !important; content: none !important; }

    #grammarL2Modal .gl2-bar { width: 100%; height: 16px; border-radius: 9999px; border: 2px solid #27c5ca; background: #fff; overflow: hidden; }
  #grammarL2Modal .gl2-bar-fill { display:block; height: 100%; width: 0%; border-radius: inherit; background-image: linear-gradient(90deg, #ffe082, #ffb300); transition: width .3s ease; }
    #grammarL2Modal .gl2-bar-fill.loading { width: 100% !important; background: linear-gradient(90deg, #b0e2e4 0%, #7fc5ca 50%, #b0e2e4 100%); background-size: 200% 100%; animation: gl2BarGlow 1.5s ease-in-out infinite; }
    @keyframes gl2BarGlow { 0%,100%{ background-position: 200% 0; opacity: .7;} 50%{ background-position: 0 0; opacity:1;} }
  `;
  document.head.appendChild(style);
}

export function showGrammarL2Modal({ onChoose, onClose }) {
  ensureGrammarL2ModalStyles();
  const SCROLL_KEY = 'grammarL2Modal_scrollTop';

  let level2Lists = [
    { 
      id: 'some_vs_any', 
      label: 'Some vs Any', 
      emoji: '🧺', 
      file: 'data/grammar/level2/some_vs_any.json', 
      config: { 
        answerChoices: ['some', 'any'],
        ruleHint: 'Use some in positive sentences; use any in negatives and questions.',
        bucketLabels: { some: 'some', any: 'any' }
      } 
    },
    { 
      id: 'there_is_vs_there_are', 
      label: 'There is vs There are', 
      emoji: '👀', 
      file: 'data/grammar/level2/there_is_vs_there_are.json', 
      config: { 
  ruleHint: 'Use "There is" for singular, "There are" for plural.',
  answerChoices: ['there is', 'there are']
      } 
    },
    { 
      id: 'are_there_vs_is_there', 
      label: 'Is there vs Are there?', 
      emoji: '❓', 
      file: 'data/grammar/level2/are_there_vs_is_there.json', 
      config: { 
  ruleHint: 'Use "Is there" for singular questions, "Are there" for plural.',
  answerChoices: ['Is there', 'Are there']
      } 
    },
    { 
      id: 'wh_who_what', 
      label: 'WH: Who & What', 
      emoji: '👤', 
      file: 'data/grammar/level2/wh_who_what.json', 
      config: { 
        ruleHint: 'Use "Who" for people and "What" for things.',
        answerChoices: []
      } 
    },
    { 
      id: 'wh_where_when_whattime', 
      label: 'WH: Where, When & Time', 
      emoji: '📍', 
      file: 'data/grammar/level2/wh_where_when_whattime.json', 
      config: { 
        ruleHint: 'Use "Where" for places, "When" for time, "What time" for specific hours.',
        answerChoices: []
      } 
    },
    { 
      id: 'wh_how_why_which', 
      label: 'WH: How, Why & Which', 
      emoji: '🤔', 
      file: 'data/grammar/level2/wh_how_why_which.json', 
      config: { 
        ruleHint: 'Use "How" for methods, "Why" for reasons, "Which" for choices.',
        answerChoices: []
      } 
    },
    { 
      id: 'short_questions_1', 
      label: 'Short Questions 1', 
      emoji: '❔', 
      file: 'data/grammar/level2/short_questions_1.json', 
      config: { 
        ruleHint: 'Form and answer short questions correctly.',
        answerChoices: []
      } 
    },
    { 
      id: 'short_questions_2', 
      label: 'Short Questions 2', 
      emoji: '💬', 
      file: 'data/grammar/level2/short_questions_2.json', 
      config: { 
        ruleHint: 'Answer short questions with correct helping verbs.',
        answerChoices: []
      } 
    },
    { 
      id: 'present_simple_sentences', 
      label: 'Present Simple: Sentences', 
      emoji: '✍️', 
      file: 'data/grammar/level2/present_simple_sentences.json', 
      config: { 
        ruleHint: 'Use base verb or add -s/-es for he/she/it.',
        mode: 'present_simple_verb_choose',
        answerChoices: []
      } 
    },
    { 
      id: 'present_simple_negative', 
      label: 'Present Simple: Negative', 
      emoji: '�', 
      file: 'data/grammar/level2/present_simple_negative.json', 
      config: { 
        ruleHint: 'Use "don\'t" or "doesn\'t" + base verb.',
        answerChoices: []
      } 
    },
    { 
      id: 'present_simple_questions_yesno', 
      label: 'Present Simple: Yes/No Questions', 
      emoji: '❓', 
      file: 'data/grammar/level2/present_simple_questions_yesno.json', 
      config: { 
        ruleHint: 'Start with Do/Does + subject + base verb.',
        answerChoices: []
      } 
    },
    { 
      id: 'present_simple_questions_wh', 
      label: 'Present Simple: WH Questions', 
      emoji: '🔍', 
      file: 'data/grammar/level2/present_simple_questions_wh.json', 
      config: { 
        ruleHint: 'WH word + do/does + subject + base verb.',
        answerChoices: []
      } 
    },
    { 
      id: 'present_progressive', 
      label: 'Present Progressive', 
      emoji: '⏳', 
      file: 'data/grammar/level2/present_progressive.json', 
      config: { 
        ruleHint: 'Use am/is/are + verb-ing for actions happening now.',
        answerChoices: []
      } 
    },
    { 
      id: 'present_progressive_negative', 
      label: 'Present Progressive: Negative', 
      emoji: '⛔', 
      file: 'data/grammar/level2/present_progressive_negative.json', 
      config: { 
        ruleHint: 'Use am/is/are + not + verb-ing.',
        answerChoices: []
      } 
    },
    { 
      id: 'present_progressive_questions_yesno', 
      label: 'Present Progressive: Yes/No', 
      emoji: '❔', 
      file: 'data/grammar/level2/present_progressive_questions_yesno.json', 
      config: { 
        ruleHint: 'Start with Am/Is/Are + subject + verb-ing.',
        answerChoices: []
      } 
    },
    { 
      id: 'present_progressive_questions_wh', 
      label: 'Present Progressive: WH Questions', 
      emoji: '🔎', 
      file: 'data/grammar/level2/present_progressive_questions_wh.json', 
      config: { 
        ruleHint: 'WH word + am/is/are + subject + verb-ing.',
        answerChoices: []
      } 
    },
    { 
      id: 'present_simple_vs_progressive', 
      label: 'Simple vs Progressive', 
      emoji: '⚖️', 
      file: 'data/grammar/level2/present_simple_vs_progressive.json', 
      config: { 
        ruleHint: 'Simple for habits; Progressive for now.',
        answerChoices: []
      } 
    },
    { 
      id: 'prepositions_between_above_below', 
      label: 'Prepositions: Between, Above, Below', 
      emoji: '📦', 
      file: 'data/grammar/level2/prepositions_between_above_below.json', 
      config: { 
        ruleHint: 'Between shows middle position; Above/Below show height.',
        answerChoices: []
      } 
    },
    { 
      id: 'prepositions_next_to_behind_infront', 
      label: 'Prepositions: Next to, Behind, In front', 
      emoji: '🏠', 
      file: 'data/grammar/level2/prepositions_next_to_behind_infront.json', 
      config: { 
        ruleHint: 'Next to = beside; Behind = back; In front = forward.',
        answerChoices: []
      } 
    },
    { 
      id: 'prepositions_between_near_acrossfrom', 
      label: 'Prepositions: Near, Across from', 
      emoji: '🗺️', 
      file: 'data/grammar/level2/prepositions_between_near_acrossfrom.json', 
      config: { 
        ruleHint: 'Near = close; Across from = opposite side.',
        answerChoices: []
      } 
    },
    { 
      id: 'prepositions_review', 
      label: 'Prepositions: Review', 
      emoji: '📚', 
      file: 'data/grammar/level2/prepositions_review.json', 
      config: { 
        ruleHint: 'Practice all position prepositions.',
        answerChoices: []
      } 
    },
    { 
      id: 'in_on_at_time', 
      label: 'Time: In, On, At', 
      emoji: '🕐', 
      file: 'data/grammar/level2/in_on_at_time.json', 
      config: { 
        ruleHint: 'At for specific time; On for days; In for months/years.',
        answerChoices: []
      } 
    },
    { 
      id: 'how_many_is_that', 
      label: 'How Many & Counting', 
      emoji: '🔢', 
      file: 'data/grammar/level2/how_many_is_that.json', 
      config: { 
        ruleHint: 'Use "How many" for countable nouns.',
        answerChoices: []
      } 
    },
  ];

  let modal = document.getElementById('grammarL2Modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'grammarL2Modal';
    modal.style.cssText = `position:fixed;top:0;left:0;width:100vw;height:100vh;background:linear-gradient(120deg, rgba(25,119,126,0.22) 0%, rgba(255,255,255,0.18) 100%);backdrop-filter:blur(12px) saturate(1.2);-webkit-backdrop-filter:blur(12px) saturate(1.2);z-index:1000;display:flex;align-items:center;justify-content:center;`;
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div style="width:95vw;max-width:420px;max-height:85vh;background:#fff;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,0.25);overflow:hidden;display:flex;flex-direction:column;font-family:'Poppins',Arial,sans-serif;border:3px solid #27c5ca;">
      <div style="position:sticky;top:0;background:#f6feff;border-bottom:2px solid #a9d6e9;display:flex;align-items:center;justify-content:space-between;padding:10px 12px;z-index:1;">
        <span style="font-size:1.3em;color:#19777e;font-weight:700;">Grammar Level 2</span>
        <button id="closeGrammarL2ModalX" style="cursor:pointer;border:none;background:transparent;color:#19777e;font-size:20px;font-weight:700;">✕</button>
      </div>
      <div id="gl2ListContainer" style="padding:12px 0;overflow:auto;flex:1;"></div>
      <div style="padding:12px 18px;display:flex;justify-content:flex-end;gap:8px;border-top:1px solid #e0f2f4;">
        <button id="closeGrammarL2Modal" style="padding:8px 18px;border-radius:8px;border:none;font-weight:700;cursor:pointer;background:#eceff1;color:#19777e;box-shadow:0 2px 8px rgba(60,60,80,0.08);">Cancel</button>
      </div>
    </div>
  `;
  modal.style.display = 'flex';

  const listEl = modal.querySelector('#gl2ListContainer');
  listEl.innerHTML = '';

  // Restore/save scroll position like Level 1 modal
  const restoreScroll = () => {
    try {
      const saved = Number(localStorage.getItem(SCROLL_KEY)) || 0;
      const max = Math.max(0, listEl.scrollHeight - listEl.clientHeight);
      listEl.scrollTop = Math.max(0, Math.min(saved, max));
    } catch { /* ignore */ }
  };
  const saveScroll = () => {
    try { localStorage.setItem(SCROLL_KEY, String(listEl.scrollTop)); } catch { /* ignore */ }
  };
  // Don't restore yet; wait until items are appended so height exists

  // Show Coming Soon modal for disabled games
  function showComingSoonModal() {
    let csModal = document.getElementById('comingSoonModal');
    if (!csModal) {
      csModal = document.createElement('div');
      csModal.id = 'comingSoonModal';
      csModal.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(60,60,80,0.18);backdrop-filter:blur(4px);z-index:2000;display:flex;align-items:center;justify-content:center;';
      csModal.innerHTML = `
        <div style="background:#fff;border-radius:14px;box-shadow:0 6px 24px rgba(60,60,80,0.18);padding:32px 28px;max-width:320px;text-align:center;font-family:'Poppins',Arial,sans-serif;">
          <div style="font-size:2em;margin-bottom:12px;">🚧</div>
          <div style="font-size:1.2em;font-weight:700;color:#19777e;margin-bottom:18px;">Coming Soon!</div>
          <div style="color:#6b7280;font-size:1em;margin-bottom:18px;">This grammar game is not yet available. Please check back later!</div>
          <button id="closeComingSoonModal" style="padding:8px 18px;border-radius:8px;border:none;font-weight:700;cursor:pointer;background:#eceff1;color:#19777e;box-shadow:0 2px 8px rgba(60,60,80,0.08);">Close</button>
        </div>
      `;
      document.body.appendChild(csModal);
      csModal.querySelector('#closeComingSoonModal').onclick = () => { csModal.style.display = 'none'; };
    }
    csModal.style.display = 'flex';
  }

  // progressIds already declared above, remove duplicate

  const makeRow = (g) => {
    const isProgressGame = progressIds.includes(g.id);
    const btn = document.createElement('button');
    btn.className = 'gl2-btn';
    // Fetch first example sentence from grammar file (sync fallback, async update)
    let example = g.label;
    fetch(g.file).then(r => r.ok ? r.json() : []).then(list => {
      if (Array.isArray(list)) {
        const item = list.find(it => it && (it.en || it.exampleSentence));
        if (item) {
          example = item.en || item.exampleSentence;
          btn.querySelector('.gl2-example').textContent = example;
        }
      }
    }).catch(() => {});
    btn.innerHTML = `
      <span style="font-size:2em;flex-shrink:0;">${g.emoji || '📘'}</span>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex:1;min-width:0;">
        <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
          <span class="gl2-example" style="font-weight:600;min-width:0;text-align:right;">${example}</span>
          <span class="gl2-percent" id="gl2percent-${g.id}" style="font-size:0.95em;color:#ff66c4;font-weight:500;text-align:right;">0%</span>
        </div>
        <span class="gl2-bar"><span class="gl2-bar-fill loading" id="gl2bar-${g.id}"></span></span>
      </div>
    `;
    if (isProgressGame) {
      btn.addEventListener('click', () => {
        saveScroll();
        if (onChoose) onChoose({ grammarFile: g.file, grammarName: g.label, grammarConfig: g.config || {} });
        modal.style.display = 'none';
      });
      btn.onmouseenter = () => btn.style.backgroundColor = '#f0f9fa';
      btn.onmouseleave = () => btn.style.backgroundColor = '';
    } else {
      btn.style.opacity = '0.45';
      btn.style.pointerEvents = 'auto';
      btn.style.filter = 'grayscale(1)';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        showComingSoonModal();
      });
      btn.onmouseenter = () => btn.style.backgroundColor = '#f8f8f8';
      btn.onmouseleave = () => btn.style.backgroundColor = '';
    }
    return btn;
  };

  // Move games with progress to top
  const progressIds = [
    'some_vs_any',
    'there_is_vs_there_are',
    'are_there_vs_is_there',
    'short_questions_1',
    'short_questions_2',
    'present_simple_sentences',
    'present_simple_negative',
    'present_simple_questions_yesno',
    'present_simple_questions_wh',
    'present_progressive',
    'present_progressive_negative',
    'present_progressive_questions_yesno',
    'present_progressive_questions_wh',
    // NEW: make preposition games fully active
    'prepositions_between_above_below',
    'prepositions_next_to_behind_infront',
    'prepositions_between_near_acrossfrom',
    'prepositions_review',
  ];
  level2Lists = level2Lists.slice().sort((a, b) => {
    const aIdx = progressIds.indexOf(a.id);
    const bIdx = progressIds.indexOf(b.id);
    if (aIdx === -1 && bIdx === -1) return 0;
    if (aIdx === -1) return 1;
    if (bIdx === -1) return -1;
    return aIdx - bIdx;
  });
  level2Lists.forEach((g) => listEl.appendChild(makeRow(g)));
  // Now that items exist, restore the saved scroll position
  restoreScroll();
  modal.querySelector('#closeGrammarL2ModalX').onclick = () => { saveScroll(); modal.style.display = 'none'; if (onClose) onClose(); };
  modal.querySelector('#closeGrammarL2Modal').onclick = () => { saveScroll(); modal.style.display = 'none'; if (onClose) onClose(); };

  // Optional: clicking the dim background closes and saves scroll
  modal.onclick = (e) => {
    if (e.target === modal) { saveScroll(); modal.style.display = 'none'; if (onClose) onClose(); }
  };

  // Load progress bars and percents using exact same calculation as service
  const renderProgressBars = (percents) => {
    level2Lists.forEach((g, idx) => {
      const pct = Math.max(0, Math.min(100, percents[idx] || 0));
      const bar = document.getElementById(`gl2bar-${g.id}`);
      const pctEl = document.getElementById(`gl2percent-${g.id}`);
      if (bar) { bar.classList.remove('loading'); bar.style.width = pct + '%'; }
      if (pctEl) { pctEl.textContent = pct + '%'; }
    });
    // Ensure scroll restoration after layout settles
    requestAnimationFrame(() => restoreScroll());
  };

  (async () => {
    try {
      const { data, fromCache } = await loadGrammarLevel2Progress(level2Lists);
      if (data?.ready) {
        renderProgressBars(Array.isArray(data.values) ? data.values : level2Lists.map(() => 0));
      } else {
        renderProgressBars(level2Lists.map(() => 0));
      }

      if (fromCache) {
        const unsub = progressCache.onUpdate('grammar_level2_progress', (fresh) => {
          if (fresh?.ready && Array.isArray(fresh.values)) {
            renderProgressBars(fresh.values);
          }
          unsub();
        });
      }
    } catch (e) {
      console.info('[GrammarL2Modal] progress unavailable', e?.message || e);
      renderProgressBars(level2Lists.map(() => 0));
    }
  })();
}
