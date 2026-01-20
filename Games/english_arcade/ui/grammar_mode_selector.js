// Grammar Mode Selector - Shows available grammar game types for a level
// Uses EXACT same styling as word mode_selector.js
import { FN } from '../scripts/api-base.js?v=20251231a';
import { historyManager } from '../history-manager.js';
import { showGrammarL1Modal } from './level1_grammar_modal.js';
import { showGrammarL2Modal } from './level2_grammar_modal.js';
import { showGrammarChartModal } from './grammar_chart_modal.js';

const JIGSAW_SVG = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="200" zoomAndPan="magnify" viewBox="0 0 150 149.999998" height="200" preserveAspectRatio="xMidYMid meet" version="1.0"><defs><clipPath id="jigsawClip"><path d="M 15 20.390625 L 70 20.390625 L 70 75 L 15 75 Z M 15 20.390625 " clip-rule="nonzero"/></clipPath></defs><path fill="#ff66c4" d="M 88.007812 82.257812 L 103.347656 82.257812 C 103.417969 82.589844 103.4375 82.933594 103.4375 83.242188 C 103.4375 84.648438 102.765625 85.097656 101.964844 86.125 C 101.101562 87.242188 100.664062 88.363281 100.664062 89.789062 C 100.664062 93.539062 103.175781 96.136719 106.917969 96.136719 C 110.378906 96.136719 113.167969 93.230469 113.167969 89.789062 C 113.167969 88.652344 112.960938 87.558594 112.371094 86.574219 C 111.96875 85.898438 111.492188 85.441406 110.9375 84.90625 C 110.363281 84.351562 110.207031 84.074219 110.207031 83.242188 C 110.207031 82.925781 110.230469 82.585938 110.304688 82.257812 L 125.824219 82.257812 L 125.824219 97.996094 C 125.507812 98.058594 125.179688 98.078125 124.882812 98.078125 C 123.476562 98.078125 123.027344 97.40625 122 96.605469 C 120.882812 95.742188 119.761719 95.304688 118.335938 95.304688 C 114.585938 95.304688 111.988281 97.816406 111.988281 101.558594 C 111.988281 105.019531 114.894531 107.808594 118.335938 107.808594 C 119.472656 107.808594 120.566406 107.601562 121.550781 107.011719 C 122.226562 106.609375 122.683594 106.132812 123.21875 105.578125 C 123.773438 105.003906 124.050781 104.847656 124.882812 104.847656 C 125.183594 104.847656 125.511719 104.867188 125.824219 104.933594 L 125.824219 120.855469 L 109.496094 120.855469 C 108.792969 121.648438 108.527344 122.75 108.527344 123.96875 C 108.527344 127.429688 111.300781 127.519531 111.300781 130.519531 C 111.300781 133.515625 109.335938 134.996094 106.917969 134.996094 C 104.496094 134.996094 102.53125 132.9375 102.53125 130.519531 C 102.53125 126.6875 105.496094 127.550781 105.496094 123.96875 C 105.496094 122.75 105.207031 121.648438 104.507812 120.855469 L 88.007812 120.855469 L 88.007812 104.285156 C 87.207031 103.472656 86.039062 103.167969 84.738281 103.167969 C 81.277344 103.167969 81.1875 105.941406 78.1875 105.941406 C 75.191406 105.941406 73.710938 103.976562 73.710938 101.558594 C 73.710938 99.136719 75.765625 97.171875 78.1875 97.171875 C 82.015625 97.171875 81.15625 100.136719 84.738281 100.136719 C 86.039062 100.136719 87.207031 99.804688 88.007812 99.003906 Z" fill-opacity="1" fill-rule="evenodd"/><path fill="#fcca55" d="M 48.089844 82.257812 L 63.503906 82.257812 C 63.515625 82.40625 63.519531 82.554688 63.519531 82.691406 C 63.519531 84.097656 62.847656 84.546875 62.046875 85.574219 C 61.183594 86.691406 60.746094 87.8125 60.746094 89.238281 C 60.746094 92.988281 63.257812 95.585938 66.996094 95.585938 C 70.460938 95.585938 73.25 92.679688 73.25 89.238281 C 73.25 88.101562 73.042969 87.007812 72.453125 86.023438 C 72.050781 85.347656 71.574219 84.890625 71.019531 84.355469 C 70.445312 83.800781 70.289062 83.523438 70.289062 82.691406 C 70.289062 82.550781 70.292969 82.40625 70.304688 82.257812 L 85.90625 82.257812 L 85.90625 98.015625 C 85.621094 98.0625 85.328125 98.078125 85.0625 98.078125 C 83.65625 98.078125 83.207031 97.40625 82.179688 96.605469 C 81.0625 95.742188 79.941406 95.304688 78.511719 95.304688 C 74.765625 95.304688 72.167969 97.816406 72.167969 101.558594 C 72.167969 105.019531 75.074219 107.808594 78.511719 107.808594 C 79.652344 107.808594 80.742188 107.601562 81.730469 107.011719 C 82.40625 106.609375 82.859375 106.132812 83.398438 105.578125 C 83.953125 105.003906 84.230469 104.847656 85.0625 104.847656 C 85.332031 104.847656 85.621094 104.863281 85.90625 104.914062 L 85.90625 120.855469 L 70.371094 120.855469 C 70.308594 120.550781 70.289062 120.234375 70.289062 119.941406 C 70.289062 119.109375 70.445312 118.832031 71.019531 118.277344 C 71.574219 117.738281 72.050781 117.285156 72.453125 116.609375 C 73.042969 115.621094 73.25 114.53125 73.25 113.390625 C 73.25 109.949219 70.460938 107.046875 66.996094 107.046875 C 63.257812 107.046875 60.746094 109.644531 60.746094 113.390625 C 60.746094 114.820312 61.183594 115.941406 62.046875 117.058594 C 62.847656 118.085938 63.519531 118.535156 63.519531 119.941406 C 63.519531 120.226562 63.503906 120.546875 63.441406 120.855469 L 48.089844 120.855469 L 48.089844 104.824219 C 48.089844 103.25 46.109375 102.976562 44.816406 102.976562 C 41.238281 102.976562 42.097656 105.941406 38.269531 105.941406 C 35.847656 105.941406 33.792969 103.976562 33.792969 101.558594 C 33.792969 99.136719 35.269531 97.171875 38.269531 97.171875 C 41.269531 97.171875 41.359375 99.945312 44.816406 99.945312 C 46.152344 99.945312 48.089844 99.703125 48.089844 98.089844 Z" fill-opacity="1" fill-rule="evenodd"/><path fill="#34c2d4" d="M 88.007812 41.519531 L 103.347656 41.519531 C 103.417969 41.847656 103.4375 42.195312 103.4375 42.503906 C 103.4375 43.910156 102.765625 44.355469 101.964844 45.386719 C 101.101562 46.5 100.664062 47.625 100.664062 49.050781 C 100.664062 52.800781 103.175781 55.398438 106.917969 55.398438 C 110.378906 55.398438 113.167969 52.492188 113.167969 49.050781 C 113.167969 47.914062 112.960938 46.820312 112.371094 45.835938 C 111.96875 45.160156 111.492188 44.703125 110.9375 44.167969 C 110.363281 43.613281 110.207031 43.332031 110.207031 42.503906 C 110.207031 42.1875 110.230469 41.84375 110.304688 41.519531 L 125.824219 41.519531 L 125.824219 57.257812 C 125.507812 57.320312 125.179688 57.339844 124.882812 57.339844 C 123.476562 57.339844 123.027344 56.667969 122 55.867188 C 120.882812 55.003906 119.761719 54.566406 118.335938 54.566406 C 114.585938 54.566406 111.988281 57.078125 111.988281 60.816406 C 111.988281 64.28125 114.894531 67.070312 118.335938 67.070312 C 119.472656 67.070312 120.566406 66.863281 121.550781 66.273438 C 122.226562 65.871094 122.683594 65.394531 123.21875 64.839844 C 123.773438 64.265625 124.050781 64.109375 124.882812 64.109375 C 125.183594 64.109375 125.511719 64.128906 125.824219 64.195312 L 125.824219 80.117188 L 109.496094 80.117188 C 108.792969 80.910156 108.527344 82.011719 108.527344 83.230469 C 108.527344 86.691406 111.300781 86.78125 111.300781 89.777344 C 111.300781 92.777344 109.335938 94.257812 106.917969 94.257812 C 104.496094 94.257812 102.53125 92.199219 102.53125 89.777344 C 102.53125 85.949219 105.496094 86.8125 105.496094 83.230469 C 105.496094 82.011719 105.207031 80.910156 104.507812 80.117188 L 88.007812 80.117188 L 88.007812 63.546875 C 87.207031 62.734375 86.039062 62.429688 84.738281 62.429688 C 81.277344 62.429688 81.1875 65.203125 78.1875 65.203125 C 75.191406 65.203125 73.710938 63.238281 73.710938 60.816406 C 73.710938 58.398438 75.765625 56.433594 78.1875 56.433594 C 82.015625 56.433594 81.15625 59.398438 84.738281 59.398438 C 86.039062 59.398438 87.207031 59.066406 88.007812 58.265625 Z" fill-opacity="1" fill-rule="evenodd"/><g clip-path="url(#jigsawClip)"><path fill="#6285dc" d="M 15 47.132812 L 25.84375 36.289062 C 26.128906 36.472656 26.386719 36.703125 26.605469 36.921875 C 27.597656 37.914062 27.441406 38.707031 27.601562 40 C 27.78125 41.398438 28.265625 42.503906 29.273438 43.511719 C 31.925781 46.160156 35.539062 46.222656 38.183594 43.578125 C 40.632812 41.128906 40.550781 37.101562 38.117188 34.667969 C 37.3125 33.863281 36.390625 33.238281 35.277344 32.957031 C 34.515625 32.765625 33.855469 32.78125 33.085938 32.792969 C 32.289062 32.804688 31.976562 32.722656 31.390625 32.132812 C 31.167969 31.910156 30.941406 31.652344 30.765625 31.371094 L 41.738281 20.394531 L 52.867188 31.523438 C 52.6875 31.792969 52.46875 32.039062 52.257812 32.246094 C 51.265625 33.238281 50.472656 33.082031 49.179688 33.246094 C 47.78125 33.421875 46.675781 33.90625 45.667969 34.914062 C 43.019531 37.566406 42.957031 41.179688 45.601562 43.824219 C 48.050781 46.273438 52.078125 46.191406 54.511719 43.757812 C 55.316406 42.953125 55.941406 42.03125 56.222656 40.917969 C 56.414062 40.15625 56.398438 39.496094 56.386719 38.726562 C 56.375 37.929688 56.457031 37.621094 57.046875 37.03125 C 57.257812 36.820312 57.503906 36.601562 57.773438 36.429688 L 69.03125 47.6875 L 57.484375 59.230469 C 57.550781 60.289062 58.140625 61.257812 59.003906 62.121094 C 61.449219 64.566406 63.472656 62.667969 65.59375 64.789062 C 67.714844 66.910156 67.371094 69.34375 65.660156 71.054688 C 63.949219 72.765625 61.105469 72.699219 59.394531 70.988281 C 56.6875 68.28125 59.390625 66.796875 56.859375 64.265625 C 55.996094 63.402344 55.011719 62.828125 53.957031 62.757812 L 42.292969 74.425781 L 30.574219 62.710938 C 29.433594 62.703125 28.390625 63.3125 27.46875 64.234375 C 25.023438 66.679688 26.921875 68.703125 24.800781 70.824219 C 22.679688 72.945312 20.246094 72.601562 18.535156 70.890625 C 16.824219 69.179688 16.890625 66.335938 18.601562 64.625 C 21.308594 61.917969 22.796875 64.621094 25.328125 62.089844 C 26.246094 61.167969 26.839844 60.109375 26.839844 58.972656 Z" fill-opacity="1" fill-rule="evenodd"/></g></svg>`;
const JIGSAW_ICON_SRC = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(JIGSAW_SVG)}`;

export async function showGrammarModeSelector({ grammarFile, grammarName, grammarConfig, onModeChosen, onClose }) {
  const container = document.getElementById('gameArea');
  if (!container) return;

  const currentGrammarFile = grammarFile || 'data/grammar/level1/articles.json';
  // Prefer teacher-assigned name when provided. If grammarName looks like a file path or filename, sanitize it to a nicer label.
  const sanitizeName = (n) => {
    if (!n) return null;
    let s = String(n).trim();
    // If it looks like a path or filename, reduce to base name
    if (s.includes('/') || s.includes('\\') || s.toLowerCase().endsWith('.json') || /[\\/]/.test(s)) {
      s = s.split(/[/\\]/).pop();
      s = s.replace(/\.json$/i, '').replace(/[_-]+/g, ' ');
      s = s.replace(/([a-z])([A-Z])/g, '$1 $2');
      s = s.replace(/\s+/g, ' ').trim();
      s = s.split(' ').map(w => w ? w.charAt(0).toUpperCase() + w.slice(1) : '').join(' ');
      return s;
    }
    return s;
  };
  const currentGrammarConfig = grammarConfig || {};
  const displayTitleRaw = currentGrammarConfig.displayTitle || grammarName;
  const currentGrammarName = (displayTitleRaw && !/\b(grammar|level|sample-wordlists|data|\\|\/)\b/i.test(String(displayTitleRaw))) ? displayTitleRaw : (sanitizeName(displayTitleRaw) || 'Grammar List');
  const isLevel2Grammar = /\/level2\//i.test(String(currentGrammarFile));
  const isLevel1Grammar = /\/level1\//i.test(String(currentGrammarFile));
  const isLevel3Grammar = /\/level3\//i.test(String(currentGrammarFile));

  // Scroll to top when opening mode selector
  window.scrollTo(0, 0);
  if (container) container.scrollTop = 0;

  // Remove any active game view clutter before rendering selector
  container.innerHTML = '';
  // CRITICAL: Reset container styles that game modes may have set (e.g., min-height:100dvh)
  container.style.cssText = '';
  try { document.getElementById('wa-quit-btn')?.remove(); } catch {}
  try { document.getElementById('grammarQuitBtn')?.remove(); } catch {}
  try { document.getElementById('smQuitBtn')?.remove(); } catch {}
  try { document.getElementById('grammarL3QuitBtn')?.remove(); } catch {}
  try { document.getElementById('gfg-quit')?.remove(); } catch {}
  try { document.getElementById('gch-quit')?.remove(); } catch {}
  try { document.querySelectorAll('.wa-quit-btn').forEach(el => el.remove()); } catch {}

  try { window.__WA_IS_GRAMMAR__ = true; window.__WA_LAST_GRAMMAR__ = { grammarFile: currentGrammarFile, grammarName: currentGrammarName, grammarConfig: currentGrammarConfig }; } catch {}
  try {
    if (!historyManager.isBackNavigation) {
  historyManager.navigateToGrammarModeSelector({ grammar: { grammarFile: currentGrammarFile, grammarName: currentGrammarName, grammarConfig: currentGrammarConfig } });
    }
  } catch {}

  // Show the menu bar
  const menuBar = document.getElementById('menuBar');
  if (menuBar) {
    menuBar.style.display = 'flex';
    // Make in-app Back behave exactly like browser Back (HistoryManager handles restore)
    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
      backBtn.style.display = '';
      backBtn.onclick = () => {
        try {
          if (window.history && window.history.length > 1) {
            window.history.back();
            return;
          }
        } catch {}
        try { if (typeof onClose === 'function') onClose(); } catch {}
      };
    }

    // Wire up navigation
    const modeBtn = document.getElementById('modeBtn');
    if (modeBtn) modeBtn.style.color = '#93cbcf'; // Highlight current section
  }

  // Modes (styleMode borrows Word Arcade accent colors)
  const modes = [
    { mode: 'lesson', title: 'How To Win', svgPath: './assets/Images/icons/win.svg', styleMode: 'meaning', sessionMode: ['grammar_lesson', 'lesson', 'grammar_lesson_it_vs_they', 'grammar_lesson_am_are_is', 'grammar_lesson_this_that', 'grammar_lesson_these_those', 'grammar_lesson_in_on_under', 'grammar_lesson_plurals_s', 'grammar_lesson_plurals_es', 'grammar_lesson_plurals_ies', 'grammar_lesson_plurals_irregular', 'grammar_lesson_countable_uncountable'] },
    // New generic Sorting mode (for grammar lists like Short Questions 1)
    { mode: 'sorting', title: 'Sorting', svgPath: JIGSAW_ICON_SRC, styleMode: 'meaning', sessionMode: 'grammar_sorting' },
    // Include both legacy 'grammar_mode' and new Level 3 'grammar_choose' so stars aggregate across versions
    { mode: 'choose', title: 'Choose', svgPath: './assets/Images/icons/choose2.svg', styleMode: 'multi_choice', sessionMode: ['grammar_mode', 'grammar_choose'] },
    { mode: 'fill_gap', title: 'Fill the Gap', svgPath: './assets/Images/icons/fill.svg', styleMode: 'missing_letter', sessionMode: 'grammar_fill_gap' },
    { mode: 'unscramble', title: 'Unscramble', svgPath: './assets/Images/icons/unscramble.svg', styleMode: 'sentence', sessionMode: 'grammar_sentence_unscramble' },
    { mode: 'sentence_order', title: 'Sentence Order', svgPath: './assets/Images/icons/round-maze.svg', styleMode: 'meaning', sessionMode: 'grammar_sentence_order', level3Only: true },
    { mode: 'find_mistake', title: 'Find the Mistake', svgPath: './assets/Images/icons/x.svg', styleMode: 'multi_choice', sessionMode: 'grammar_find_mistake' },
    { mode: 'translation', title: 'Translation', svgPath: './assets/Images/icons/translate.svg', styleMode: 'multi_choice', sessionMode: 'grammar_translation_choice' }
  ];

  // For Level 2 lists, hide the Lesson card for now
  // For Level 1 lists, hide the Sorting and Translation cards
  let visibleModes = modes;
  if (isLevel2Grammar) visibleModes = visibleModes.filter(m => m.mode !== 'lesson' && !m.level3Only);
  // For Level 3 lists, hide Lesson and Sorting modes (not applicable)
  if (isLevel3Grammar) visibleModes = visibleModes.filter(m => m.mode !== 'sorting' && m.mode !== 'lesson');
  // Level 1: hide Sorting, Translation, Find the Mistake, and Level 3-only modes
  if (isLevel1Grammar) visibleModes = visibleModes.filter(m => m.mode !== 'sorting' && m.mode !== 'translation' && m.mode !== 'find_mistake' && !m.level3Only);
  
  // For preposition lists (Level 2 only), hide Sorting and Choose modes
  const isPrepositionList = /prepositions_/i.test(String(currentGrammarFile || ''));
  if (isLevel2Grammar && isPrepositionList) visibleModes = visibleModes.filter(m => m.mode !== 'sorting' && m.mode !== 'choose');
  
  // Hide Sorting mode for Present Simple WH Questions (not implemented for this list)
  const isWhQuestions = /present_simple_questions_wh\.json$/i.test(currentGrammarFile || '');
  if (isWhQuestions) visibleModes = visibleModes.filter(m => m.mode !== 'sorting');

  // Special micro-modes: WH Who & What, WH Where/When/What Time, and WH How/Why/Which lists should only show Fill Gap + Unscramble (plus Find/Translation)
  // Hide Sorting and Choose to avoid confusion (student should pick WH word via dedicated micro-modes we added)
  const isWhoWhatList = /wh_who_what\.json$/i.test(String(currentGrammarFile || ''));
  const isWhereWhenWhatTimeList = /wh_where_when_whattime\.json$/i.test(String(currentGrammarFile || ''));
  const isHowWhyWhichList = /wh_how_why_which\.json$/i.test(String(currentGrammarFile || ''));
  if (isWhoWhatList || isWhereWhenWhatTimeList || isHowWhyWhichList) {
    visibleModes = visibleModes.filter(m => m.mode !== 'sorting' && m.mode !== 'choose');
  }

  // Load grammar data to check what modes are compatible
  let grammarData = [];
  try {
    const response = await fetch(currentGrammarFile);
    if (response.ok) {
      grammarData = await response.json();
    }
  } catch (err) {
    console.debug('[GrammarModeSelector] Could not preload grammar data for mode filtering', err);
  }

  // Check data compatibility for each mode
  const hasFillGapCompatible = Array.isArray(grammarData) && grammarData.some(item => {
    if (!item) return false;
    // Classic fill-gap shapes (articles/contractions/endings or short questions)
    if (item.word && (item.article || item.contraction || item.ending)) return true;
    if (item.word && (item.answer_positive && item.answer_negative)) return true;
    // Generic sentence fallback: any sentence-like field present
    if (item.exampleSentence || item.example || item.sentence) return true;
    if (Array.isArray(item.sentences) && item.sentences.length) return true;
    return false;
  });
  const hasUnscrambleCompatible = Array.isArray(grammarData) && grammarData.some(item => {
    if (!item) return false;
    // Accept if any reasonable sentence field exists
    if (item.exampleSentence || item.example || item.sentence) return true;
    // Or if upgraded structure includes sentences array
    if (Array.isArray(item.sentences) && item.sentences.length) return true;
    return false;
  });
  const hasTranslationCompatible = Array.isArray(grammarData) && grammarData.some(item =>
    item && item.en && item.ko
  );
  const hasFindMistakeCompatible = Array.isArray(grammarData) && grammarData.some(item => (item && (item.en || item.exampleSentence)));

  // Hide modes that don't have compatible data
  if (!hasFillGapCompatible) visibleModes = visibleModes.filter(m => m.mode !== 'fill_gap');
  if (!hasUnscrambleCompatible) visibleModes = visibleModes.filter(m => m.mode !== 'unscramble');
  if (!hasTranslationCompatible) visibleModes = visibleModes.filter(m => m.mode !== 'translation');
  if (!hasFindMistakeCompatible) visibleModes = visibleModes.filter(m => m.mode !== 'find_mistake');

  const BORDER_COLORS = {
    meaning: '#40D4DE',
    sentence: '#7B9FFF',
    multi_choice: '#FFB84D',
    missing_letter: '#FF85D0',
    listen_and_spell: '#7B9FFF',
    listening: '#FF85D0',
  };

  // Inject header styles (scoped) if not present
  if (!document.getElementById('grammar-mode-selector-header-styles')) {
    const hs = document.createElement('style');
    hs.id = 'grammar-mode-selector-header-styles';
    hs.textContent = `
      /* Title button inside the card - no border, minimal padding */
      #gameArea .grammar-mode-selector-header { text-align:center; padding:0; margin:0; }
      #gameArea .grammar-mode-selector-header .grammar-rule-btn { 
        appearance: none; border:none; background:transparent; color:#ff66c4; cursor:pointer;
        font-family:'Poppins', Arial, sans-serif; font-weight:800; font-size:22px; padding:8px 16px;
        position:relative; display:inline-block;
        transition: transform .15s ease;
      }
      #gameArea .grammar-mode-selector-header .grammar-rule-btn:hover { transform: scale(1.02); }
      #gameArea .grammar-mode-selector-header .grammar-rule-btn:active { transform: scale(0.98); }
      /* Click here overlay on the title */
      #gameArea .grammar-mode-selector-header .grammar-rule-btn .click-overlay {
        position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);
        background:rgba(61,221,233,0.92); color:#fff; font-size:13px; font-weight:700;
        padding:6px 14px; border-radius:20px; white-space:nowrap;
        pointer-events:none; opacity:0;
        animation: clickOverlayPulse 3s ease-in-out forwards;
      }
      @keyframes clickOverlayPulse {
        0% { opacity:0; transform:translate(-50%,-50%) scale(0.8); }
        15% { opacity:1; transform:translate(-50%,-50%) scale(1); }
        85% { opacity:1; transform:translate(-50%,-50%) scale(1); }
        100% { opacity:0; transform:translate(-50%,-50%) scale(0.9); }
      }
      /* Slightly larger icons on grammar cards */
      #modeSelect .mode-btn .mode-icon img { width:88px !important; height:88px !important; }
      @media (min-width:600px){ #modeSelect .mode-btn .mode-icon img { width:96px !important; height:96px !important; } }
      @media (min-width:900px){ #modeSelect .mode-btn .mode-icon img { width:104px !important; height:104px !important; } }
      /* Rounder borders and larger vertical spacing on grammar buttons */
      #modeSelect .mode-btn { border-radius:28px !important; gap:20px !important; padding:20px 12px 24px !important; }
      #modeSelect .mode-btn .mode-content { gap:18px !important; }
      #modeSelect .mode-btn .mode-left { gap:12px !important; }
      /* Ensure all mode titles and text in grammar selector use grey color */
      #modeSelect .mode-btn .mode-title { color: #6b7280 !important; font-weight:700 !important; }
      #modeSelect .mode-btn { color: #6b7280 !important; }
    `;
    document.head.appendChild(hs);
  }

  // Create the card first, then add title inside it
  const cardDiv = document.createElement('div');
  cardDiv.className = 'wa-card';
  cardDiv.id = 'modeSelectCard';
  cardDiv.style.background = '#fbffff';
  container.appendChild(cardDiv);

  // Add title header INSIDE the card at the top
  const headerDiv = document.createElement('div');
  headerDiv.className = 'grammar-mode-selector-header';
  headerDiv.innerHTML = `
  <button type="button" class="grammar-rule-btn" aria-label="${currentGrammarName}: rules and tips">${currentGrammarName}<span class="click-overlay">Click for help!</span></button>
  `;
  cardDiv.appendChild(headerDiv);

  // Remove click overlay after animation ends
  setTimeout(() => {
    const overlay = headerDiv.querySelector('.click-overlay');
    if (overlay) overlay.remove();
  }, 3500);

  // Title click opens grammar chart modal with rules and examples
  try {
    headerDiv.querySelector('.grammar-rule-btn')?.addEventListener('click', async () => {
      try {
        // Load grammar data from JSON file
        const response = await fetch(currentGrammarFile);
        const grammarData = await response.json();
        
        // Show grammar chart modal with rules and examples
        showGrammarChartModal({
          grammarFile: currentGrammarFile,
          grammarName: currentGrammarName,
          grammarData: grammarData,
          onClose: () => {} // Modal handles its own closing
        });
      } catch (err) {
        console.error('Failed to load grammar chart:', err);
        const fallback = currentGrammarConfig?.ruleHint || 'Rules & tips';
        (window.WordArcade && window.WordArcade.inlineToast)
          ? window.WordArcade.inlineToast(fallback)
          : alert(fallback);
      }
    });
  } catch {}

  const modeSelectDiv = document.createElement('div');
  modeSelectDiv.id = 'modeSelect';
  modeSelectDiv.setAttribute('aria-label', 'Select a grammar game mode');
  cardDiv.appendChild(modeSelectDiv);

  const listContainer = modeSelectDiv;

  // Helpers to render star row (inline-colored SVGs to avoid external CSS dependency)
  const pctToStars = (pct) => {
    if (pct == null) return 0;
    if (pct >= 100) return 5;
    if (pct > 90) return 4;
    if (pct > 80) return 3;
    if (pct > 70) return 2;
    if (pct >= 60) return 1;
    return 0
  };
  const starSvg = (filled) => filled
    ? `<svg class="star-filled" viewBox="0 0 24 24" aria-hidden="true" width="16" height="16"><path fill="#ffd34d" stroke="#ffd34d" d="M12 .587l3.668 7.431L23.5 9.75l-5.667 5.527L19.335 24 12 19.897 4.665 24l1.502-8.723L.5 9.75l7.832-1.732z"/></svg>`
    : `<svg class="star-empty" viewBox="0 0 24 24" aria-hidden="true" width="16" height="16"><path fill="none" stroke="#e8d8a8" stroke-width="1.5" d="M12 .587l3.668 7.431L23.5 9.75l-5.667 5.527L19.335 24 12 19.897 4.665 24l1.502-8.723L.5 9.75l7.832-1.732z"/></svg>`;

  const renderStarsInto = (el, pct) => {
    if (!el) return;
    const filled = pctToStars(pct);
    let html = '';
    for (let i=0;i<5;i++) html += starSvg(i < filled);
    el.innerHTML = html;
  };

  // Build mode buttons with EXACT word mode selector styling
  visibleModes.forEach((m) => {
  const btn = document.createElement('button');
  btn.className = 'mode-btn mode-card';
  // Use a known data-mode so style.css applies Word selector accents
  btn.setAttribute('data-mode', m.styleMode || m.mode);
    btn.setAttribute('aria-label', m.title);

    // Build inner structure: mode-content > mode-left > mode-icon + mode-title
    const contentDiv = document.createElement('div');
    contentDiv.className = 'mode-content';

    const leftDiv = document.createElement('div');
    leftDiv.className = 'mode-left';

    const iconDiv = document.createElement('div');
    iconDiv.className = 'mode-icon';

    const img = document.createElement('img');
    img.src = m.svgPath;
    img.alt = m.title;
    // Make the Sentence Order icon larger — the provided SVO svg can be small inside its viewBox
    if (m.mode === 'sentence_order') {
      img.style.width = '140px';
      img.style.height = '140px';
      img.style.padding = '6px';
    } else {
      img.style.width = '96px';
      img.style.height = '96px';
    }
    img.style.objectFit = 'contain';
    img.style.display = 'block';
    img.style.margin = '0 auto';

    iconDiv.appendChild(img);

  const titleDiv = document.createElement('div');
  titleDiv.className = 'mode-title';
  titleDiv.setAttribute('data-i18n', m.title);
  titleDiv.textContent = m.title;

    leftDiv.appendChild(iconDiv);
    if (m.showStars !== false) {
      const starRow = document.createElement('div');
      starRow.className = 'star-row';
      starRow.id = `grammar-star-${m.mode}`;
      starRow.style.display = 'flex';
      starRow.style.justifyContent = 'center';
      starRow.style.gap = '4px';
      renderStarsInto(starRow, null);
      leftDiv.appendChild(starRow);
    }
    leftDiv.appendChild(titleDiv);
    contentDiv.appendChild(leftDiv);
    btn.appendChild(contentDiv);

    if (m.sessionMode) {
      try { btn.dataset.sessionMode = m.sessionMode; } catch {}
    }

    const borderKey = (m.styleMode || m.mode || '').toLowerCase();
    let borderColor = BORDER_COLORS[borderKey] || '#40D4DE';
    // If this is the 5th card and mode is 'find_mistake', set border to cyan
    if (m.mode === 'find_mistake') {
      borderColor = '#3ddde9ff';
    }
    btn.style.border = `3px solid ${borderColor}`;
    btn.style.boxShadow = '0 6px 14px rgba(166, 234, 246, 0.35)';

    btn.addEventListener('click', () => {
      if (onModeChosen) onModeChosen({ mode: m.mode, grammarFile: currentGrammarFile, grammarName: currentGrammarName, grammarConfig: currentGrammarConfig });
    });

    listContainer.appendChild(btn);
  });

  // After rendering buttons, fetch session history to compute stars per mode
  // Define as named function so we can re-run after session completes
  const refreshStars = async () => {
    try {
      // Fetch sessions (try list-scoped first for speed)
      const makeUrl = (scoped) => {
        const base = (window.WordArcade && window.WordArcade.FN) ? window.WordArcade.FN('progress_summary') : (typeof FN === 'function' ? FN('progress_summary') : '/.netlify/functions/progress_summary');
        // Fall back if FN not available in this scope
        const u = new URL(base, window.location.origin);
        u.searchParams.set('section', 'sessions');
        // Use grammarFile path (not display name) for list_name lookup since sessions store file paths
        if (scoped && currentGrammarFile) u.searchParams.set('list_name', currentGrammarFile);
        return u.toString();
      };
      let sessions = [];
      try {
        const res = await fetch(makeUrl(true), { cache: 'no-store', credentials: 'include' });
        if (res.ok) sessions = await res.json();
      } catch {}
      if (!Array.isArray(sessions) || !sessions.length) {
        try {
          const res = await fetch(makeUrl(false), { cache: 'no-store', credentials: 'include' });
          if (res.ok) sessions = await res.json();
        } catch {}
      }
      if (!Array.isArray(sessions) || !sessions.length) return;

      const canon = (s) => (s || '').toString().trim().toLowerCase();
      // Create a canonical key by normalizing to letters/digits and underscores
      const canonKey = (s) => canon(s).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
      const target = canon(currentGrammarName);
      const targetKey = canonKey(currentGrammarName);
      // Also extract just the file basename if grammarFile is available
      const fileBasename = currentGrammarFile ? canonKey(currentGrammarFile.split('/').pop().replace(/\.json$/i, '')) : '';
      const bestByMode = {};

      // Debug: log target matching info for Level 3
      if (isLevel3Grammar) {
        console.debug('[GrammarModeSelector L3] Matching sessions for:', { target, targetKey, fileBasename, sessionCount: sessions.length });
      }

      (sessions || []).forEach((session) => {
        if (!session) return;
        let summary = session.summary;
        if (typeof summary === 'string') {
          try { summary = JSON.parse(summary); } catch { summary = null; }
        }

        // Collect all possible list name sources
        const listCandidates = [];
        if (session.list_name) listCandidates.push(session.list_name);
        if (summary?.list_name) listCandidates.push(summary.list_name);
        if (summary?.list) listCandidates.push(summary.list);
        if (summary?.name) listCandidates.push(summary.name);
        if (summary?.grammarName) listCandidates.push(summary.grammarName);
        if (summary?.grammarFile) listCandidates.push(summary.grammarFile);

        let meta = session.meta || summary?.meta;
        if (typeof meta === 'string') {
          try { meta = JSON.parse(meta); } catch { meta = null; }
        }
        if (meta && typeof meta === 'object') {
          if (meta.grammarName) listCandidates.push(meta.grammarName);
          if (meta.listName) listCandidates.push(meta.listName);
          if (meta.list) listCandidates.push(meta.list);
          if (meta.name) listCandidates.push(meta.name);
          if (meta.grammarFile) listCandidates.push(meta.grammarFile);
        }

        // CRITICAL FIX: If session has NO list tracking at all, skip it entirely
        // This prevents old sessions from being counted for ALL lists
        if (listCandidates.length === 0) {
          if (isLevel3Grammar) {
            console.debug('[GrammarModeSelector L3] Skipping session with no list tracking:', session.mode);
          }
          return;
        }

        // Check if any candidate matches target (using both exact and canonical key matching)
        const matchesTarget = listCandidates.some(candidate => {
          const c = canon(candidate);
          const ck = canonKey(candidate);
          // Also extract file basename from paths
          const cFile = candidate && candidate.includes('/') ? canonKey(candidate.split('/').pop().replace(/\.json$/i, '')) : '';
          // Check for substring match as well (more lenient for grammar lists)
          const substringMatch = fileBasename && (ck.includes(fileBasename) || fileBasename.includes(ck) || cFile.includes(fileBasename) || fileBasename.includes(cFile));
          return c === target || ck === targetKey || (fileBasename && (ck === fileBasename || cFile === fileBasename)) || substringMatch;
        });

        // STRICT matching: Only include session if it matches the target list
        // Skip sessions that don't match
        if (!matchesTarget) {
          if (isLevel3Grammar) {
            console.debug('[GrammarModeSelector L3] Session does not match target:', { mode: session.mode, listCandidates, target, targetKey, fileBasename });
          }
          return;
        }

        if (isLevel3Grammar) {
          console.debug('[GrammarModeSelector L3] Session MATCHED:', { mode: session.mode, listCandidates, matched: true });
        }

        const modeKey = canon(session.mode);
        const category = canon(summary?.category || session.category);
        // More lenient grammar detection: check mode name for grammar prefix or category
        const isGrammar = category === 'grammar' || (modeKey && (modeKey.includes('grammar') || modeKey.startsWith('grammar_')));
        if (!isGrammar) return;

        let pct = null;
        if (summary && typeof summary.score === 'number' && typeof summary.total === 'number' && summary.total > 0) {
          pct = Math.round((summary.score / summary.total) * 100);
        } else if (summary && typeof summary.accuracy === 'number') {
          // accuracy is stored as decimal (0.0-1.0), so multiply by 100
          pct = summary.accuracy <= 1 ? Math.round(summary.accuracy * 100) : Math.round(summary.accuracy);
        } else if (typeof session.correct === 'number' && typeof session.total === 'number' && session.total > 0) {
          pct = Math.round((session.correct / session.total) * 100);
        }
        if (pct == null) return;

        if (!(modeKey in bestByMode) || bestByMode[modeKey] < pct) {
          bestByMode[modeKey] = pct;
        }
      });

      visibleModes.forEach((modeDef) => {
        if (modeDef.showStars === false) return;
        const starEl = document.getElementById(`grammar-star-${modeDef.mode}`);
        if (!starEl) return;
        if (!modeDef.sessionMode) {
          renderStarsInto(starEl, null);
          return;
        }
        const candidates = Array.isArray(modeDef.sessionMode) ? modeDef.sessionMode : [modeDef.sessionMode];
        let pct = null;
        
        // First try exact match
        candidates.forEach((modeName) => {
          const key = canon(modeName);
          if (!key) return;
          if (key in bestByMode) {
            const val = bestByMode[key];
            if (typeof val === 'number') {
              pct = pct == null ? val : Math.max(pct, val);
            }
          }
        });
        
        // If no exact match, try partial/fuzzy matching based on mode type
        if (pct == null) {
          const modeType = modeDef.mode;
          Object.entries(bestByMode).forEach(([sessionMode, val]) => {
            if (pct != null && pct >= val) return;
            if (typeof val !== 'number') return;
            
            // Match based on mode type keywords
            const sm = sessionMode.toLowerCase();
            let matches = false;
            
            if (modeType === 'lesson' && (sm.includes('lesson'))) matches = true;
            if (modeType === 'sorting' && (sm.includes('sorting') || sm.includes('sort'))) matches = true;
            if (modeType === 'choose' && (sm.includes('choose') || sm.includes('grammar_mode') || sm === 'grammar_mode')) matches = true;
            if (modeType === 'fill_gap' && (sm.includes('fill') || sm.includes('gap') || sm.includes('blank'))) matches = true;
            if (modeType === 'unscramble' && (sm.includes('unscramble') || sm.includes('scramble') || sm.includes('sentence_unscramble'))) matches = true;
            if (modeType === 'sentence_order' && (sm.includes('sentence_order') || sm.includes('order') || sm.includes('reorder'))) matches = true;
            if (modeType === 'find_mistake' && (sm.includes('mistake') || sm.includes('find_mistake') || sm.includes('error'))) matches = true;
            if (modeType === 'translation' && (sm.includes('translation') || sm.includes('translate'))) matches = true;
            
            if (matches) {
              pct = pct == null ? val : Math.max(pct, val);
            }
          });
        }
        
        renderStarsInto(starEl, pct);
      });
      
      // Debug: log what was found (can be removed after verification)
      console.debug('[GrammarModeSelector] Star matching complete:', { 
        grammarName: currentGrammarName, 
        grammarFile: currentGrammarFile,
        bestByMode, 
        visibleModeCount: visibleModes.length 
      });
    } catch (e) {
      console.warn('[GrammarModeSelector] Error loading stars:', e);
    }
  };
  
  // Initial star load
  refreshStars();
  
  // Listen for session completion and refresh stars after a short delay
  // (allows backend to process the new session data)
  const onSessionEnded = () => {
    setTimeout(() => {
      refreshStars();
      console.debug('[GrammarModeSelector] Stars refreshed after session ended');
    }, 800); // 800ms delay for backend processing
  };
  window.addEventListener('wa:session-ended', onSessionEnded);
  
  // Clean up event listener when mode selector is replaced
  // Use MutationObserver to detect when modeSelectDiv is removed from DOM
  const cleanupObserver = new MutationObserver((mutations) => {
    if (!document.body.contains(modeSelectDiv)) {
      window.removeEventListener('wa:session-ended', onSessionEnded);
      cleanupObserver.disconnect();
      console.debug('[GrammarModeSelector] Cleaned up session listener');
    }
  });
  cleanupObserver.observe(document.body, { childList: true, subtree: true });

  // Add Change Level button (below modes)
  const changeLevelBtn = document.createElement('button');
  changeLevelBtn.className = 'mode-btn mode-card';
  changeLevelBtn.style.cssText = `
    margin-top: 12px;
    grid-column: 1 / -1;
    background: #fff;
    color: #21b5c0;
    font-family: 'Poppins', Arial, sans-serif;
    font-weight: 700;
    font-size: 14px;
    padding: 8px 5px;
    height: 44px; max-height: 44px;
    display: flex; align-items: center; justify-content: center;
    border: 2px solid #21b5c0;
    border-radius: 10px;
    cursor: pointer;
    transition: transform .15s ease, box-shadow .15s ease;
    box-shadow: 0 2px 6px rgba(33, 181, 192, 0.1);
  `;
  changeLevelBtn.innerHTML = `<span data-i18n="Change Level">Change Level</span>`;
  changeLevelBtn.addEventListener('click', () => {
    // If current grammar is Level 3, open Level 3 modal; if Level 2, open Level 2; else default to Level 1
    const isL2 = /\/level2\//i.test(String(currentGrammarFile));
    const isL3 = /\/level3\//i.test(String(currentGrammarFile)) || !!isLevel3Grammar;

    if (isL3) {
      try { historyManager.navigateToModal('grammarL3Modal', 'grammar_mode_selector'); } catch {}
      import('./level3_grammar_modal.js').then(mod => {
        if (typeof mod.showGrammarL3Modal === 'function') {
          mod.showGrammarL3Modal({
            onChoose: (config) => {
              if (window.WordArcade?.loadGrammarGame) {
                window.WordArcade.loadGrammarGame(config);
              } else {
                import('../main.js').then(m => { if (typeof m.loadGrammarGame === 'function') m.loadGrammarGame(config); }).catch(() => {});
              }
            },
            onClose: () => {
              if (window.StudentLang?.applyTranslations) window.StudentLang.applyTranslations();
            }
          });
        }
      }).catch(() => {});
      return;
    }

    if (isL2) {
      try { historyManager.navigateToModal('grammarL2Modal', 'grammar_mode_selector'); } catch {}
      showGrammarL2Modal({
        onChoose: (config) => {
          if (window.WordArcade?.loadGrammarGame) {
            window.WordArcade.loadGrammarGame(config);
          } else {
            import('../main.js').then(mod => { if (typeof mod.loadGrammarGame === 'function') mod.loadGrammarGame(config); }).catch(() => {});
          }
        },
        onClose: () => {
          if (window.StudentLang?.applyTranslations) window.StudentLang.applyTranslations();
        }
      });
      return;
    }

    try { historyManager.navigateToModal('grammarL1Modal', 'grammar_mode_selector'); } catch {}
    showGrammarL1Modal({
      onChoose: (config) => {
        if (window.WordArcade?.loadGrammarGame) {
          window.WordArcade.loadGrammarGame(config);
        } else {
          import('../main.js').then(mod => { if (typeof mod.loadGrammarGame === 'function') mod.loadGrammarGame(config); }).catch(() => {});
        }
      },
      onClose: () => {
        if (window.StudentLang?.applyTranslations) window.StudentLang.applyTranslations();
      }
    });
  });

  // Add hover effects
  changeLevelBtn.addEventListener('mouseenter', () => {
    changeLevelBtn.style.transform = 'translateY(-2px)';
    changeLevelBtn.style.boxShadow = '0 6px 16px rgba(33, 181, 192, 0.25)';
  });
  changeLevelBtn.addEventListener('mouseleave', () => {
    changeLevelBtn.style.transform = 'translateY(0)';
    changeLevelBtn.style.boxShadow = '0 2px 6px rgba(33, 181, 192, 0.1)';
  });

  // Add Main Menu button at the bottom
  const mainMenuBtn = document.createElement('button');
  mainMenuBtn.className = 'mode-btn mode-card';
  mainMenuBtn.style.cssText = `
    margin-top: 0;
    grid-column: 1 / -1;
    background: #fff;
    color: #21b5c0ff;
    font-family: 'Poppins', Arial, sans-serif;
    font-weight: 700;
    font-size: 14px;
    padding: 8px 16px;
    height: 44px; max-height: 44px;
    display: flex; align-items: center; justify-content: center;
    border: 2px solid #1eb0bbff;
    border-radius: 10px;
    cursor: pointer;
    transition: transform .15s ease, box-shadow .15s ease;
    box-shadow: 0 2px 6px rgba(33, 181, 192, 0.1);
  `;
  mainMenuBtn.innerHTML = `<span data-i18n="Main Menu">Main Menu</span>`;
  mainMenuBtn.addEventListener('click', () => {
    try {
      const area = document.getElementById('gameArea');
      if (area) area.innerHTML = '';
      document.getElementById('wa-quit-btn')?.remove();
      document.getElementById('grammarQuitBtn')?.remove();
      document.getElementById('smQuitBtn')?.remove();
    } catch {}
    if (window.WordArcade && typeof window.WordArcade.showGrammarLevelsMenu === 'function') {
      window.WordArcade.showGrammarLevelsMenu();
    } else if (window.WordArcade && typeof window.WordArcade.quitToOpening === 'function') {
      window.WordArcade.quitToOpening(true);
    } else {
      try { location.hash = '#state-grammar-levels'; } catch {}
    }
  });

  // Add hover effects
  mainMenuBtn.addEventListener('mouseenter', () => {
    mainMenuBtn.style.transform = 'translateY(-2px)';
    mainMenuBtn.style.boxShadow = '0 6px 16px rgba(25, 119, 126, 0.25)';
  });
  mainMenuBtn.addEventListener('mouseleave', () => {
    mainMenuBtn.style.transform = 'translateY(0)';
    mainMenuBtn.style.boxShadow = '0 2px 6px rgba(33, 181, 192, 0.1)';
  });

  // Append buttons in a wrapper
  const buttonsWrapper = document.createElement('div');
  buttonsWrapper.style.cssText = `
    display: flex;
    gap: 12px;
    flex-direction: column;
    margin-top: 16px;
    padding: 0 12px;
  `;

  buttonsWrapper.appendChild(changeLevelBtn);
  buttonsWrapper.appendChild(mainMenuBtn);

  const cardContainer = document.getElementById('modeSelectCard');
  cardContainer.appendChild(buttonsWrapper);

  if (window.StudentLang && typeof window.StudentLang.applyTranslations === 'function') {
    window.StudentLang.applyTranslations();
  }
}
