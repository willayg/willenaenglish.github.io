import './ui/star_overlay.js?v=20260329a';
import { LEVEL1_LISTS, LEVEL2_LISTS, LEVEL3_LISTS, LEVEL4_LISTS } from './utils/level-lists.js?v=20251214a';
import { playTTSVariant, preloadAllAudio } from './tts.js?v=20251214a';
import { playSFX } from './sfx.js?v=20251214a';
import { startSession, logAttempt, endSession } from '../../students/records.js';
import { initPointsClient } from '../../students/scripts/points-client.js';

const GRID_CONFIG = {
  '3x6': { columns: 3, rows: 6, cards: 18, pairs: 9 },
};

const DIFFICULTY_CONFIG = {
  easy: { label: 'Easy', pool: LEVEL1_LISTS },
  medium: { label: 'Medium', pool: LEVEL2_LISTS },
  hard: { label: 'Hard', pool: LEVEL3_LISTS },
  expert: { label: 'Expert', pool: LEVEL4_LISTS },
};

const state = {
  difficulty: readDifficultyFromQuery(),
  grid: '3x6',
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
  setupPairsValue: document.getElementById('setupPairsValue'),
  setupStarValue: document.getElementById('setupStarValue'),
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
    const secondaryValue = emoji || kor;
    const secondaryType = emoji ? 'emoji' : 'korean';
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
  for (const word of words) {
    deck.push({
      id: `${word.pairId}:word`,
      pairId: word.pairId,
      faceType: 'word',
      matchType: word.matchType,
      spokenWord: word.eng,
      value: word.eng,
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
    button.innerHTML = `
      <span class="card-face-wrap">
        <span class="card-face card-back" aria-hidden="true">
          <span class="card-back-mark"><span></span><span></span><span></span><span></span></span>
        </span>
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
  stopTimer();
  state.gameActive = false;
  const pairs = GRID_CONFIG[state.grid].pairs;
  const efficiencyPct = Math.max(0, Math.min(100, Math.round((pairs / Math.max(state.moves, pairs)) * 100)));
  const starCount = pctToStars(efficiencyPct);

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
      window.showRoundStars({ correct: pairs, total: Math.max(state.moves, pairs) });
    }
  } catch {}
  refreshHeaderOverview();
  setMessage(`Round complete. ${state.points} points earned.`);
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
  const perfectMoves = getPerfectMovesLabel();
  elements.starTargetValue.textContent = perfectMoves;
  elements.setupPairsValue.textContent = String(gridConfig.pairs);
  elements.setupStarValue.textContent = perfectMoves;
}

function updateSetupSummary() {
  const gridConfig = GRID_CONFIG[state.grid];
  elements.setupPairsValue.textContent = String(gridConfig.pairs);
  elements.setupStarValue.textContent = getPerfectMovesLabel();
}

function getPerfectMovesLabel() {
  return `${GRID_CONFIG[state.grid].pairs} moves`;
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

function pctToStars(pct) {
  if (pct >= 100) return 5;
  if (pct > 90) return 4;
  if (pct > 80) return 3;
  if (pct > 70) return 2;
  if (pct >= 60) return 1;
  return 0;
}

function shuffleArray(list) {
  const copy = [...list];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
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