import './ui/star_overlay.js?v=20260329a';
import { LEVEL1_LISTS, LEVEL2_LISTS, LEVEL3_LISTS, LEVEL4_LISTS } from './utils/level-lists.js?v=20251214a';
import { playTTSVariant, preloadAllAudio } from './tts.js?v=20251214a';
import { playSFX } from './sfx.js?v=20251214a';
import { startSession, logAttempt, endSession } from '../../students/records.js';
import { initPointsClient } from '../../students/scripts/points-client.js';

const GRID_CONFIG = {
  '3x4': { columns: 3, rows: 4, cards: 12, pairs: 6 },
};

const DIFFICULTY_CONFIG = {
  easy: { label: 'Easy', pool: LEVEL1_LISTS },
  medium: { label: 'Medium', pool: LEVEL2_LISTS },
  hard: { label: 'Hard', pool: LEVEL3_LISTS },
  expert: { label: 'Expert', pool: LEVEL4_LISTS },
};

const STAR_THRESHOLDS = {
  '3x4': { 5: 10, 4: 12, 3: 14, 2: 16, 1: 20 },
};

const CARD_PALETTE = [
  { accent: '#df8a2f', fill: 'rgba(223, 138, 47, 0.05)', fillStrong: 'rgba(223, 138, 47, 0.11)' },
  { accent: '#6fd7de', fill: 'rgba(111, 215, 222, 0.05)', fillStrong: 'rgba(111, 215, 222, 0.11)' },
  { accent: '#8eb9e6', fill: 'rgba(142, 185, 230, 0.05)', fillStrong: 'rgba(142, 185, 230, 0.11)' },
  { accent: '#19777e', fill: 'rgba(25, 119, 126, 0.05)', fillStrong: 'rgba(25, 119, 126, 0.11)' },
  { accent: '#f3a9c3', fill: 'rgba(243, 169, 195, 0.05)', fillStrong: 'rgba(243, 169, 195, 0.11)' },
  { accent: '#ef4b93', fill: 'rgba(239, 75, 147, 0.05)', fillStrong: 'rgba(239, 75, 147, 0.11)' },
];

const PAGE_THEMES = ['gradient', 'white', 'pink-stars', 'rainbow-clouds'];
const BORDER_THEMES = ['cyan', 'pink'];

const emojiSupportCache = new Map();

const state = {
  difficulty: readDifficultyFromQuery(),
  grid: '3x4',
  cards: [],
  selectedIds: [],
  matchedPairs: 0,
  moves: 0,
  points: 0,
  lockBoard: false,
  currentListMeta: null,
  currentWords: [],
  attemptedLists: new Set(),
  loading: false,
  sessionId: null,
  gameActive: false,
  nextWordAudioAt: 0,
  audioWarmupId: 0,
};

const elements = {
  setupScreen: document.getElementById('setupScreen'),
  gameScreen: document.getElementById('gameScreen'),
  difficultySelect: document.getElementById('difficultySelect'),
  setupMessage: document.getElementById('setupMessage'),
  startGameBtn: document.getElementById('startGameBtn'),
  exitGameBtn: document.getElementById('exitGameBtn'),
  gameDifficultyValue: document.getElementById('gameDifficultyValue'),
  gameListValue: document.getElementById('gameListValue'),
  pointsValue: document.getElementById('pointsValue'),
  movesValue: document.getElementById('movesValue'),
  matchesValue: document.getElementById('matchesValue'),
  starTargetValue: document.getElementById('starTargetValue'),
  boardGrid: document.getElementById('boardGrid'),
  loadingState: document.getElementById('loadingState'),
  loadingText: document.getElementById('loadingText'),
};

bootstrap();

function bootstrap() {
  applyPageTheme();
  initPointsClient();
  elements.difficultySelect.value = state.difficulty;
  updateSetupSummary();
  wireControls();
  renderStats();

  const params = new URLSearchParams(window.location.search || '');
  if (params.get('autostart') === '1') {
    startNewGame();
  }
}

function readDifficultyFromQuery() {
  const params = new URLSearchParams(window.location.search || '');
  const requested = String(params.get('difficulty') || '').toLowerCase();
  return DIFFICULTY_CONFIG[requested] ? requested : 'easy';
}

function wireControls() {
  elements.difficultySelect.addEventListener('change', () => {
    state.difficulty = elements.difficultySelect.value;
    updateSetupSummary();
    syncUrlState();
  });

  elements.startGameBtn.addEventListener('click', () => startNewGame());
  elements.exitGameBtn.addEventListener('click', () => handleExitGame());
}

async function startNewGame() {
  if (state.loading) return;
  state.loading = true;
  state.difficulty = elements.difficultySelect.value;
  resetRoundState();
  syncUrlState();
  setSetupMessage('');
  showGameScreen();
  showLoading(`Building a ${DIFFICULTY_CONFIG[state.difficulty].label.toLowerCase()} board…`);

  try {
    const result = await resolveRandomBoard(state.difficulty, state.grid);
    state.currentListMeta = result.meta;
    state.currentWords = result.words;
    state.cards = buildDeck(result.words);
    state.sessionId = startSession({
      mode: 'memory_match',
      wordList: result.words,
      listName: null,
      meta: {
        difficulty: state.difficulty,
        grid: state.grid,
        source: 'memory_match',
        source_list_label: result.meta.label,
        source_list_file: result.meta.file,
      },
    });
    state.gameActive = true;

    renderStats();
    renderBoard();
    hideLoading();
    scheduleRoundAudioWarmup(result.words);
  } catch (error) {
    hideLoading();
    state.gameActive = false;
    setSetupMessage(error.message || 'Could not build a playable board.', true);
    exitToSetup({ keepMessage: true });
  } finally {
    state.loading = false;
  }
}

function resetRoundState() {
  state.audioWarmupId += 1;
  state.cards = [];
  state.selectedIds = [];
  state.matchedPairs = 0;
  state.moves = 0;
  state.points = 0;
  state.lockBoard = false;
  state.currentListMeta = null;
  state.currentWords = [];
  state.sessionId = null;
  state.gameActive = false;
  elements.boardGrid.replaceChildren();
  renderStats();
}

function showGameScreen() {
  elements.setupScreen.hidden = true;
  elements.gameScreen.hidden = false;
}

function exitToSetup({ keepMessage = false } = {}) {
  state.loading = false;
  state.lockBoard = false;
  state.selectedIds = [];
  state.cards = [];
  state.sessionId = null;
  state.gameActive = false;
  elements.boardGrid.replaceChildren();
  elements.setupScreen.hidden = false;
  elements.gameScreen.hidden = true;
  hideLoading();
  updateSetupSummary();
}

async function handleExitGame() {
  if (state.sessionId && state.gameActive) {
    await closePartialSession();
  }
  exitToSetup();
}

async function resolveRandomBoard(difficultyKey, gridKey) {
  const config = DIFFICULTY_CONFIG[difficultyKey];
  const gridConfig = GRID_CONFIG[gridKey];
  const shuffledPool = shuffleArray([...config.pool]);
  const mixedEntries = [];
  const mixedEntryKeys = new Set();
  const mixedSourceLabels = [];

  for (const meta of shuffledPool) {
    const cacheKey = `${difficultyKey}:${gridKey}:${meta.file}`;
    if (state.attemptedLists.has(cacheKey)) continue;
    state.attemptedLists.add(cacheKey);
    const entries = await tryPlayableEntries(meta);
    if (entries.length >= gridConfig.pairs) {
      return {
        meta,
        words: shuffleArray(entries).slice(0, gridConfig.pairs),
      };
    }

    if (!entries.length) continue;
    mixedSourceLabels.push(meta.label);
    for (const entry of shuffleArray(entries)) {
      const entryKey = `${entry.eng.toLowerCase()}::${entry.matchType}::${String(entry.matchValue).toLowerCase()}`;
      if (mixedEntryKeys.has(entryKey)) continue;
      mixedEntryKeys.add(entryKey);
      mixedEntries.push(entry);
      if (mixedEntries.length >= gridConfig.pairs) {
        return {
          meta: {
            label: `Mixed ${config.label} Lists`,
            file: `mixed:${difficultyKey}`,
            sourceLabels: [...mixedSourceLabels],
          },
          words: shuffleArray(mixedEntries).slice(0, gridConfig.pairs),
        };
      }
    }
  }

  state.attemptedLists.clear();
  throw new Error(`Could not build a ${gridKey} ${config.label.toLowerCase()} board. Try another level or smaller grid.`);
}

async function tryPlayableEntries(meta) {
  try {
    return await fetchPlayableEntries(meta);
  } catch {
    return [];
  }
}

async function fetchPlayableEntries(meta) {
  const filePath = meta.file.includes('/') ? `./${meta.file}` : `./sample-wordlists/${meta.file}`;
  const response = await fetch(filePath, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Failed to load ${meta.label}.`);

  const raw = await response.json();
  const uniqueWord = new Set();
  const uniqueMatch = new Set();
  const playable = [];

  for (const item of Array.isArray(raw) ? raw : []) {
    const eng = String(item?.eng || '').trim();
    const emoji = String(item?.emoji || '').trim();
    const kor = String(item?.kor || '').trim();
    const hasSupportedEmoji = emoji && supportsEmojiGlyph(emoji);
    const secondaryValue = hasSupportedEmoji ? emoji : kor;
    const secondaryType = hasSupportedEmoji ? 'emoji' : 'korean';
    if (!eng || !secondaryValue) continue;

    const wordKey = eng.toLowerCase();
    const matchKey = `${secondaryType}:${secondaryValue.toLowerCase()}`;
    if (uniqueWord.has(wordKey) || uniqueMatch.has(matchKey)) continue;

    uniqueWord.add(wordKey);
    uniqueMatch.add(matchKey);
    playable.push({
      pairId: `${meta.file}:${wordKey}`,
      eng,
      matchValue: secondaryValue,
      matchType: secondaryType,
      listLabel: meta.label,
    });
  }

  return playable;
}

function buildDeck(words) {
  const deck = [];
  const roundColor = pickRoundColor();
  for (const word of words) {
    deck.push({
      id: `${word.pairId}:word`,
      pairId: word.pairId,
      faceType: 'word',
      matchType: word.matchType,
      spokenWord: word.eng,
      value: word.eng,
      accentColor: roundColor.accent,
      fillColor: roundColor.fill,
      fillStrongColor: roundColor.fillStrong,
      matched: false,
      mismatched: false,
    });
    deck.push({
      id: `${word.pairId}:match`,
      pairId: word.pairId,
      faceType: 'match',
      matchType: word.matchType,
      spokenWord: word.eng,
      value: word.matchValue,
      accentColor: roundColor.accent,
      fillColor: roundColor.fill,
      fillStrongColor: roundColor.fillStrong,
      matched: false,
      mismatched: false,
    });
  }
  return shuffleArray(deck);
}

function renderBoard() {
  const gridConfig = GRID_CONFIG[state.grid];
  elements.boardGrid.dataset.rows = String(gridConfig.rows);
  elements.boardGrid.dataset.grid = state.grid;
  const fragment = document.createDocumentFragment();

  for (const card of state.cards) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = buildCardClass(card);
    button.dataset.cardId = card.id;
    button.dataset.matchType = card.matchType;
    button.style.setProperty('--card-accent', card.accentColor || '#19777e');
    button.style.setProperty('--card-fill', card.fillColor || 'rgba(25, 119, 126, 0.05)');
    button.style.setProperty('--card-fill-strong', card.fillStrongColor || 'rgba(25, 119, 126, 0.11)');
    button.innerHTML = `
      <span class="card-face-wrap">
        <span class="card-face card-back" aria-hidden="true"></span>
        <span class="card-face card-front ${card.faceType}-front">
          <span class="card-value">${escapeHtml(card.value)}</span>
        </span>
      </span>
    `;
    button.addEventListener('click', () => handleCardClick(card.id));
    fragment.appendChild(button);
  }

  elements.boardGrid.replaceChildren(fragment);
}

function buildCardClass(card) {
  return [
    'match-card',
    (state.selectedIds.includes(card.id) || card.matched) ? 'is-revealed' : '',
    card.matched ? 'is-matched' : '',
    card.mismatched ? 'is-mismatched' : '',
    state.lockBoard && !card.matched ? 'is-disabled' : '',
  ].filter(Boolean).join(' ');
}

function handleCardClick(cardId) {
  if (state.lockBoard || !state.gameActive) return;
  const card = state.cards.find((entry) => entry.id === cardId);
  if (!card || card.matched || state.selectedIds.includes(cardId)) return;

  state.selectedIds.push(cardId);
  if (state.selectedIds.length === 1) {
    playCardAudio(card);
  }
  renderBoard();
  if (state.selectedIds.length < 2) return;

  const [firstId, secondId] = state.selectedIds;
  const firstCard = state.cards.find((entry) => entry.id === firstId);
  const secondCard = state.cards.find((entry) => entry.id === secondId);
  if (!firstCard || !secondCard) return;

  state.moves += 1;
  const isMatch = firstCard.pairId === secondCard.pairId && firstCard.faceType !== secondCard.faceType;
  if (isMatch) {
    firstCard.matched = true;
    secondCard.matched = true;
    state.selectedIds = [];
    state.matchedPairs += 1;
    state.points += 1;
    triggerMatchFeedback(firstCard.pairId);
    logPairAttempt(firstCard, secondCard, true);
    renderStats();
    renderBoard();
    if (state.matchedPairs === GRID_CONFIG[state.grid].pairs) {
      finishRound();
    }
    return;
  }

  logPairAttempt(firstCard, secondCard, false);
  firstCard.mismatched = true;
  secondCard.mismatched = true;
  state.lockBoard = true;
  renderStats();
  renderBoard();

  window.setTimeout(() => {
    firstCard.mismatched = false;
    secondCard.mismatched = false;
    state.selectedIds = [];
    state.lockBoard = false;
    renderBoard();
  }, 760);
}

function logPairAttempt(firstCard, secondCard, isCorrect) {
  if (!state.sessionId) return;
  const promptCard = firstCard.faceType === 'word' ? secondCard : firstCard;
  logAttempt({
    session_id: state.sessionId,
    mode: 'memory_match',
    word: firstCard.spokenWord,
    is_correct: isCorrect,
    answer: `${firstCard.value} + ${secondCard.value}`,
    correct_answer: promptCard.value,
    points: isCorrect ? 1 : 0,
    extra: {
      difficulty: state.difficulty,
      grid: state.grid,
      pair_type: promptCard.matchType,
      moves: state.moves,
      matched_pairs: state.matchedPairs,
    },
  });
}

async function finishRound() {
  state.gameActive = false;
  const pairs = GRID_CONFIG[state.grid].pairs;
  const efficiencyPct = Math.max(0, Math.min(100, Math.round((pairs / Math.max(state.moves, pairs)) * 100)));
  const starCount = movesToStars(state.moves, state.grid);

  if (state.sessionId) {
    await endSession(state.sessionId, {
      mode: 'memory_match',
      listName: state.currentListMeta?.label || null,
      wordList: state.currentWords,
      summary: {
        score: efficiencyPct,
        total: 100,
        completed: true,
        points_earned: state.points,
        matches: state.matchedPairs,
        moves: state.moves,
        difficulty: state.difficulty,
        grid: state.grid,
        stars_preview: starCount,
      },
    });
  }

  try {
    if (typeof window.showRoundStars === 'function') {
      window.showRoundStars({
        correct: pairs,
        total: Math.max(state.moves, pairs),
        stars: starCount,
        subtitle: `${state.moves} moves`,
      });
    }
  } catch {}
  refreshHeaderOverview();
}

async function closePartialSession() {
  try {
    const pairs = GRID_CONFIG[state.grid].pairs;
    const efficiencyPct = state.moves > 0
      ? Math.max(0, Math.min(100, Math.round((state.matchedPairs / Math.max(state.moves, state.matchedPairs || 1)) * 100)))
      : 0;
    await endSession(state.sessionId, {
      mode: 'memory_match',
      listName: state.currentListMeta?.label || null,
      wordList: state.currentWords,
      summary: {
        score: efficiencyPct,
        total: 100,
        completed: false,
        points_earned: state.points,
        matches: state.matchedPairs,
        target_pairs: pairs,
        moves: state.moves,
        difficulty: state.difficulty,
        grid: state.grid,
      },
    });
  } catch {}
}

function playCardAudio(card) {
  if (card.faceType !== 'word') return;
  const now = Date.now();
  if (now < state.nextWordAudioAt) return;
  state.nextWordAudioAt = now + 900;
  try {
    playTTSVariant(card.spokenWord, 'itself');
  } catch {}
}

async function preloadRoundAudio(words) {
  try {
    await preloadAllAudio(words);
  } catch {}
}

function scheduleRoundAudioWarmup(words) {
  const warmupId = state.audioWarmupId + 1;
  state.audioWarmupId = warmupId;
  const runWarmup = async () => {
    if (warmupId !== state.audioWarmupId || !state.gameActive) return;
    await preloadRoundAudio(words);
  };

  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(() => {
      void runWarmup();
    }, { timeout: 1200 });
    return;
  }

  window.setTimeout(() => {
    void runWarmup();
  }, 180);
}

function triggerMatchFeedback(pairId) {
  try {
    playSFX('correct');
  } catch {}

  const selector = `[data-card-id^="${cssEscape(pairId)}:"]`;
  const matchingCards = Array.from(elements.boardGrid.querySelectorAll(selector));
  for (const cardEl of matchingCards) {
    cardEl.classList.remove('just-matched');
    void cardEl.offsetWidth;
    cardEl.classList.add('just-matched');
    createSparkles(cardEl);
    window.setTimeout(() => cardEl.classList.remove('just-matched'), 700);
  }
}

function createSparkles(cardEl) {
  if (!cardEl) return;
  for (let index = 0; index < 5; index += 1) {
    const sparkle = document.createElement('span');
    sparkle.className = 'match-sparkle';
    sparkle.style.left = `${18 + Math.random() * 64}%`;
    sparkle.style.top = `${18 + Math.random() * 64}%`;
    sparkle.style.animationDelay = `${index * 40}ms`;
    sparkle.style.setProperty('--sparkle-dx', `${(Math.random() - 0.5) * 24}px`);
    sparkle.style.setProperty('--sparkle-dy', `${-12 - Math.random() * 18}px`);
    cardEl.appendChild(sparkle);
    window.setTimeout(() => sparkle.remove(), 720);
  }
}

function renderStats() {
  const gridConfig = GRID_CONFIG[state.grid];
  const difficultyLabel = DIFFICULTY_CONFIG[state.difficulty].label;
  elements.gameDifficultyValue.textContent = difficultyLabel;
  elements.gameListValue.textContent = state.currentListMeta?.label || 'Loading…';
  elements.pointsValue.textContent = String(state.points);
  elements.movesValue.textContent = String(state.moves);
  elements.matchesValue.textContent = `${state.matchedPairs} / ${gridConfig.pairs}`;
  elements.starTargetValue.textContent = getPerfectMovesLabel();
}

function updateSetupSummary() {}

function applyPageTheme() {
  const pageTheme = pickNextTheme('memoryMatch.pageTheme', PAGE_THEMES);
  const borderTheme = pickNextTheme('memoryMatch.borderTheme', BORDER_THEMES);
  document.body.dataset.pageTheme = pageTheme;
  document.body.dataset.borderTheme = borderTheme;
  document.documentElement.style.setProperty('--chrome-border-angle', `${Math.floor(Math.random() * 360)}deg`);
}

function pickNextTheme(storageKey, options) {
  let lastValue = '';
  try {
    lastValue = sessionStorage.getItem(storageKey) || '';
  } catch {}

  const pool = options.filter((option) => option !== lastValue);
  const available = pool.length ? pool : options;
  const nextValue = available[Math.floor(Math.random() * available.length)];

  try {
    sessionStorage.setItem(storageKey, nextValue);
  } catch {}

  return nextValue;
}

function getPerfectMovesLabel() {
  return `${getStarThresholds(state.grid)[5]} moves`;
}

function showLoading(message) {
  elements.loadingText.textContent = message;
  elements.loadingState.hidden = false;
  elements.startGameBtn.disabled = true;
  elements.exitGameBtn.disabled = true;
}

function hideLoading() {
  elements.loadingState.hidden = true;
  elements.startGameBtn.disabled = false;
  elements.exitGameBtn.disabled = false;
}

function setSetupMessage(message, isError = false) {
  elements.setupMessage.textContent = message;
  elements.setupMessage.classList.toggle('is-error', isError);
}

function syncUrlState() {
  const url = new URL(window.location.href);
  url.searchParams.set('difficulty', state.difficulty);
  url.searchParams.delete('grid');
  window.history.replaceState({}, '', url.toString());
}

function refreshHeaderOverview() {
  try {
    const header = document.querySelector('student-header');
    if (header && typeof header._fetchOverview === 'function') {
      header._fetchOverview();
    }
  } catch {}
}

function movesToStars(moves, gridKey = state.grid) {
  const thresholds = getStarThresholds(gridKey);
  if (moves <= thresholds[5]) return 5;
  if (moves <= thresholds[4]) return 4;
  if (moves <= thresholds[3]) return 3;
  if (moves <= thresholds[2]) return 2;
  if (moves <= thresholds[1]) return 1;
  return 0;
}

function getStarThresholds(gridKey) {
  if (STAR_THRESHOLDS[gridKey]) {
    return STAR_THRESHOLDS[gridKey];
  }

  const pairs = GRID_CONFIG[gridKey]?.pairs || 6;
  return {
    5: pairs + 2,
    4: pairs + 3,
    3: pairs + 4,
    2: pairs + 5,
    1: pairs + 6,
  };
}

function shuffleArray(list) {
  const copy = [...list];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function pickRoundColor() {
  const index = Math.floor(Math.random() * CARD_PALETTE.length);
  return CARD_PALETTE[index];
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function cssEscape(value) {
  if (typeof window !== 'undefined' && window.CSS && typeof window.CSS.escape === 'function') {
    return window.CSS.escape(value);
  }
  return String(value).replaceAll('"', '\\"');
}

function supportsEmojiGlyph(emoji) {
  if (!emoji) return false;
  if (emojiSupportCache.has(emoji)) {
    return emojiSupportCache.get(emoji);
  }

  try {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      emojiSupportCache.set(emoji, true);
      return true;
    }

    const drawPixels = (text) => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.textBaseline = 'top';
      context.font = '28px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
      context.fillText(text, 0, 0);
      return context.getImageData(0, 0, canvas.width, canvas.height).data;
    };

    const emojiPixels = drawPixels(emoji);
    const tofuPixels = drawPixels('\u25a1');
    const replacementPixels = drawPixels('\ufffd');
    let hasInk = false;
    let tofuDiff = 0;
    let replacementDiff = 0;

    for (let index = 0; index < emojiPixels.length; index += 4) {
      if (emojiPixels[index + 3] > 0) hasInk = true;
      tofuDiff += Math.abs(emojiPixels[index] - tofuPixels[index]);
      tofuDiff += Math.abs(emojiPixels[index + 1] - tofuPixels[index + 1]);
      tofuDiff += Math.abs(emojiPixels[index + 2] - tofuPixels[index + 2]);
      replacementDiff += Math.abs(emojiPixels[index] - replacementPixels[index]);
      replacementDiff += Math.abs(emojiPixels[index + 1] - replacementPixels[index + 1]);
      replacementDiff += Math.abs(emojiPixels[index + 2] - replacementPixels[index + 2]);
    }

    const supported = hasInk && tofuDiff > 1200 && replacementDiff > 1200;
    emojiSupportCache.set(emoji, supported);
    return supported;
  } catch {
    emojiSupportCache.set(emoji, true);
    return true;
  }
}