// Grammar Sentence Unscramble Mode
// Reuses the core sentence mode engine but feeds it grammar example sentences
// and logs under a dedicated grammar mode name for progress tracking.

import { run as runSentenceMode } from './word_sentence_mode.js';

function shuffle(arr) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export async function runGrammarSentenceUnscramble(ctx) {
  const {
    grammarFile,
    grammarName,
    inlineToast,
    showOpeningButtons,
  } = ctx || {};

  if (!grammarFile) {
    inlineToast?.('Error: No grammar file selected');
    return;
  }

  let rawData = [];
  try {
    const res = await fetch(grammarFile);
    if (!res.ok) throw new Error(`Failed to load ${grammarFile}`);
    rawData = await res.json();
  } catch (err) {
    console.error('[GrammarUnscramble] Unable to load grammar data', err);
    inlineToast?.('Could not load grammar sentences');
    showOpeningButtons?.(true);
    return;
  }

  const candidates = Array.isArray(rawData)
    ? rawData.filter((item) => item && item.exampleSentence && item.word)
    : [];

  if (!candidates.length) {
    inlineToast?.('This grammar lesson has no sentences yet.');
    showOpeningButtons?.(true);
    return;
  }

  const mapped = candidates.map((item, index) => {
    const sentence = String(item.exampleSentence || '').trim();
    const translation = String(item.exampleSentenceKo || '').trim();
    const baseId = item.id || `${item.word || 'sentence'}_${index}`;
    const payload = {
      eng: item.word,
      sentence,
      sentence_kor: translation,
      article: item.article,
      grammarMeta: {
        article: item.article,
        word: item.word,
      },
    };
    if (sentence) {
      payload.sentences = [{ id: baseId, text: sentence, weight: 1, ko: translation }];
    }
    return payload;
  });

  const usable = shuffle(mapped).slice(0, 15);

  const layoutOverrides = {
    hideTitle: true,
    centerContent: true,
    showQuitButton: true,
    skipIntro: true,
    quitButtonId: 'grammarQuitBtn',
    quitButtonLabel: 'Quit Game',
  };

  const forwardedCtx = {
    ...ctx,
    wordList: usable,
    listName: grammarName || ctx?.listName || 'Grammar Sentences',
    sessionMode: 'grammar_sentence_unscramble',
    // Mount into the main game area so HistoryManager restores are visible
    gameArea: document.getElementById('gameArea') || ctx?.gameArea || document.getElementById('gameStage') || document.body,
    sentenceLayout: { ...(ctx?.sentenceLayout || {}), ...layoutOverrides },
    onSentenceQuit: () => {
      try {
        if (window.WordArcade?.startGrammarModeSelector) {
          window.WordArcade.startGrammarModeSelector();
          return;
        }
      } catch {}
      showOpeningButtons?.(true);
    },
  };

  runSentenceMode(forwardedCtx);
}
