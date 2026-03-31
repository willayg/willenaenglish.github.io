import { LEVEL1_LISTS, LEVEL2_LISTS, LEVEL3_LISTS, LEVEL4_LISTS } from './utils/level-lists.js?v=20251214a';

const DIFFICULTY_CONFIG = {
  easy: {
    label: 'Easy',
    subtitle: 'Level 1 sample lists with familiar everyday words.',
    color: '#0ea5a4',
    pool: LEVEL1_LISTS,
  },
  medium: {
    label: 'Medium',
    subtitle: 'Level 2 sample lists with broader vocabulary and trickier choices.',
    color: '#f59e0b',
    pool: LEVEL2_LISTS,
  },
  hard: {
    label: 'Hard',
    subtitle: 'Level 3 lists with less common words and tighter matching pressure.',
    color: '#ef6a3b',
    pool: LEVEL3_LISTS,
  },
  expert: {
    label: 'Expert',
    subtitle: 'Level 4 lists for the toughest standalone rounds.',
    color: '#ff4f87',
    pool: LEVEL4_LISTS,
  },
};

const state = {
  difficulty: readDifficultyFromQuery(),
  cards: [],
  selectedIds: [],
  matchedPairs: 0,
  moves: 0,
  lockBoard: false,
  timerId: null,
  startedAt: 0,
  secondsElapsed: 0,
  currentListMeta: null,
  currentWords: [],
  attemptedLists: new Set(),
  loading: false,
};

const elements = {
  difficultyList: document.getElementById('difficultyList'),
  difficultyValue: document.getElementById('difficultyValue'),
  movesValue: document.getElementById('movesValue'),
  matchesValue: document.getElementById('matchesValue'),
  timeValue: document.getElementById('timeValue'),
  currentListLabel: document.getElementById('currentListLabel'),
  currentListHint: document.getElementById('currentListHint'),
  messageBanner: document.getElementById('messageBanner'),
  boardGrid: document.getElementById('boardGrid'),
  emptyState: document.getElementById('emptyState'),
  loadingState: document.getElementById('loadingState'),
  loadingText: document.getElementById('loadingText'),
  startBoardBtn: document.getElementById('startBoardBtn'),
  nextBoardBtn: document.getElementById('nextBoardBtn'),
  winModal: document.getElementById('winModal'),
  winTitle: document.getElementById('winTitle'),
  winSummary: document.getElementById('winSummary'),
  playSameLevelBtn: document.getElementById('playSameLevelBtn'),
  closeWinBtn: document.getElementById('closeWinBtn'),
};

bootstrap();

function bootstrap() {
  renderDifficultyButtons();
  wireControls();
  renderStats();
  updateDifficultyPanel();

  const params = new URLSearchParams(window.location.search || '');
  if (params.get('autostart') === '1') {
    loadRandomBoard();
  }
}

function readDifficultyFromQuery() {
  const params = new URLSearchParams(window.location.search || '');
  const requested = String(params.get('difficulty') || '').toLowerCase();
  return DIFFICULTY_CONFIG[requested] ? requested : 'easy';
}

function renderDifficultyButtons() {
  const fragment = document.createDocumentFragment();
  for (const [key, config] of Object.entries(DIFFICULTY_CONFIG)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `difficulty-btn${state.difficulty === key ? ' is-active' : ''}`;
    button.dataset.difficulty = key;
    button.setAttribute('role', 'radio');
    button.setAttribute('aria-checked', state.difficulty === key ? 'true' : 'false');
    button.innerHTML = `
      <span class="difficulty-title">${config.label}</span>
      <span class="difficulty-desc">${config.subtitle}</span>
    `;
    button.addEventListener('click', () => setDifficulty(key));
    fragment.appendChild(button);
  }

  elements.difficultyList.replaceChildren(fragment);
}

function wireControls() {
  elements.startBoardBtn.addEventListener('click', () => loadRandomBoard());
  elements.nextBoardBtn.addEventListener('click', () => loadRandomBoard());
  elements.playSameLevelBtn.addEventListener('click', () => {
    hideWinModal();
    loadRandomBoard();
  });
  elements.closeWinBtn.addEventListener('click', () => hideWinModal());
}

function setDifficulty(key) {
  if (!DIFFICULTY_CONFIG[key] || state.loading) return;
  const changedWhileBoardVisible = state.cards.length > 0 && state.currentListMeta;
  state.difficulty = key;
  state.attemptedLists.clear();
  renderDifficultyButtons();
  updateDifficultyPanel();
  setMessage(changedWhileBoardVisible
    ? `${DIFFICULTY_CONFIG[key].label} selected. Start a new board to switch this round over.`
    : `${DIFFICULTY_CONFIG[key].label} selected. Build a fresh random board when ready.`);
  const url = new URL(window.location.href);
  url.searchParams.set('difficulty', key);
  window.history.replaceState({}, '', url.toString());
}

async function loadRandomBoard() {
  if (state.loading) return;
  state.loading = true;
  hideWinModal();
  showLoading(`Finding a ${DIFFICULTY_CONFIG[state.difficulty].label.toLowerCase()} board…`);
  setMessage('');
  stopTimer();

  try {
    const result = await resolveRandomBoard(state.difficulty);
    state.currentListMeta = result.meta;
    state.currentWords = result.words;
    state.cards = buildDeck(result.words);
    state.selectedIds = [];
    state.matchedPairs = 0;
    state.moves = 0;
    state.lockBoard = false;
    state.secondsElapsed = 0;
    state.startedAt = Date.now();

    updateDifficultyPanel();
    renderStats();
    renderBoard();
    hideLoading();
    startTimer();
    setMessage(`Loaded ${result.meta.label}. Match each word with its emoji.`);
  } catch (error) {
    hideLoading();
    setMessage(error.message || 'Could not build a playable board.', true);
  } finally {
    state.loading = false;
  }
}

async function resolveRandomBoard(difficultyKey) {
  const config = DIFFICULTY_CONFIG[difficultyKey];
  const shuffledPool = shuffleArray([...config.pool]);

  for (const meta of shuffledPool) {
    const cacheKey = `${difficultyKey}:${meta.file}`;
    if (state.attemptedLists.has(cacheKey)) continue;
    state.attemptedLists.add(cacheKey);

    let entries = [];
    try {
      entries = await fetchPlayableEntries(meta);
    } catch {
      continue;
    }
    if (entries.length >= 8) {
      return {
        meta,
        words: shuffleArray(entries).slice(0, 8),
      };
    }
  }

  state.attemptedLists.clear();
  for (const meta of shuffledPool) {
    let entries = [];
    try {
      entries = await fetchPlayableEntries(meta);
    } catch {
      continue;
    }
    if (entries.length >= 8) {
      return {
        meta,
        words: shuffleArray(entries).slice(0, 8),
      };
    }
  }

  throw new Error(`No playable ${config.label.toLowerCase()} lists were found with 8 unique emoji pairs.`);
}

async function fetchPlayableEntries(meta) {
  const filePath = meta.file.includes('/') ? `./${meta.file}` : `./sample-wordlists/${meta.file}`;
  const response = await fetch(filePath, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to load ${meta.label}.`);
  }

  const raw = await response.json();
  const uniqueByEmoji = new Set();
  const uniqueByWord = new Set();
  const playable = [];

  for (const item of Array.isArray(raw) ? raw : []) {
    const eng = String(item?.eng || '').trim();
    const emoji = String(item?.emoji || '').trim();
    if (!eng || !emoji) continue;

    const wordKey = eng.toLowerCase();
    if (uniqueByEmoji.has(emoji) || uniqueByWord.has(wordKey)) continue;

    uniqueByEmoji.add(emoji);
    uniqueByWord.add(wordKey);
    playable.push({
      pairId: `${meta.file}:${wordKey}`,
      eng,
      emoji,
      listLabel: meta.label,
    });
  }

  return playable;
}

function buildDeck(words) {
  const cards = [];
  for (const word of words) {
    cards.push({
      id: `${word.pairId}:word`,
      pairId: word.pairId,
      type: 'word',
      value: word.eng,
      matched: false,
    });
    cards.push({
      id: `${word.pairId}:emoji`,
      pairId: word.pairId,
      type: 'emoji',
      value: word.emoji,
      matched: false,
    });
  }

  return shuffleArray(cards);
}

function renderBoard() {
  elements.emptyState.hidden = true;
  const fragment = document.createDocumentFragment();

  for (const card of state.cards) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = buildCardClass(card);
    button.dataset.cardId = card.id;
    button.setAttribute('aria-label', card.matched ? `${card.type} matched` : `${card.type} hidden card`);
    button.innerHTML = `
      <span class="card-face-wrap">
        <span class="card-face card-back" aria-hidden="true">✦</span>
        <span class="card-face card-front ${card.type}-front">
          <span class="card-type">${card.type}</span>
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
  const selected = state.selectedIds.includes(card.id);
  const mismatched = Boolean(card.mismatched);
  return [
    'match-card',
    (selected || card.matched) ? 'is-revealed' : '',
    card.matched ? 'is-matched' : '',
    mismatched ? 'is-mismatched' : '',
    state.lockBoard && !card.matched ? 'is-disabled' : '',
  ].filter(Boolean).join(' ');
}

function handleCardClick(cardId) {
  if (state.lockBoard) return;
  const card = state.cards.find((entry) => entry.id === cardId);
  if (!card || card.matched || state.selectedIds.includes(cardId)) return;

  state.selectedIds.push(cardId);
  if (card.type === 'word') {
    speak(card.value);
  }

  renderBoard();

  if (state.selectedIds.length < 2) return;

  const [firstId, secondId] = state.selectedIds;
  const firstCard = state.cards.find((entry) => entry.id === firstId);
  const secondCard = state.cards.find((entry) => entry.id === secondId);
  if (!firstCard || !secondCard) return;

  state.moves += 1;
  const isMatch = firstCard.pairId === secondCard.pairId && firstCard.type !== secondCard.type;
  renderStats();

  if (isMatch) {
    firstCard.matched = true;
    secondCard.matched = true;
    state.selectedIds = [];
    state.matchedPairs += 1;
    renderStats();
    renderBoard();

    if (state.matchedPairs === 8) {
      stopTimer();
      showWinModal();
    }
    return;
  }

  state.lockBoard = true;
  firstCard.mismatched = true;
  secondCard.mismatched = true;
  renderBoard();

  window.setTimeout(() => {
    firstCard.mismatched = false;
    secondCard.mismatched = false;
    state.selectedIds = [];
    state.lockBoard = false;
    renderBoard();
  }, 780);
}

function renderStats() {
  elements.difficultyValue.textContent = DIFFICULTY_CONFIG[state.difficulty].label;
  elements.movesValue.textContent = String(state.moves);
  elements.matchesValue.textContent = `${state.matchedPairs} / 8`;
  elements.timeValue.textContent = formatSeconds(state.secondsElapsed);
  elements.nextBoardBtn.disabled = state.loading;
}

function updateDifficultyPanel() {
  const config = DIFFICULTY_CONFIG[state.difficulty];
  elements.difficultyValue.textContent = config.label;
  if (state.currentListMeta) {
    elements.currentListLabel.textContent = state.currentListMeta.label;
    elements.currentListHint.textContent = `${config.label} mode is active. This board came from a random eligible list in that difficulty pool.`;
  } else {
    elements.currentListLabel.textContent = 'Pick a difficulty to begin';
    elements.currentListHint.textContent = config.subtitle;
  }
}

function startTimer() {
  stopTimer();
  state.timerId = window.setInterval(() => {
    state.secondsElapsed = Math.floor((Date.now() - state.startedAt) / 1000);
    renderStats();
  }, 1000);
}

function stopTimer() {
  if (state.timerId) {
    window.clearInterval(state.timerId);
    state.timerId = null;
  }
}

function showLoading(message) {
  elements.loadingText.textContent = message;
  elements.loadingState.hidden = false;
  elements.startBoardBtn.disabled = true;
  elements.nextBoardBtn.disabled = true;
}

function hideLoading() {
  elements.loadingState.hidden = true;
  elements.startBoardBtn.disabled = false;
  elements.nextBoardBtn.disabled = false;
}

function setMessage(message, isError = false) {
  elements.messageBanner.textContent = message;
  elements.messageBanner.classList.toggle('is-error', isError);
}

function showWinModal() {
  const difficultyLabel = DIFFICULTY_CONFIG[state.difficulty].label;
  const rating = getRoundRating();
  elements.winTitle.textContent = `${rating} ${difficultyLabel} round.`;
  elements.winSummary.textContent = `You cleared ${state.currentListMeta?.label || 'this list'} in ${state.moves} moves and ${formatSeconds(state.secondsElapsed)}.`;
  elements.winModal.hidden = false;
}

function hideWinModal() {
  elements.winModal.hidden = true;
}

function getRoundRating() {
  if (state.moves <= 10) return 'Brilliant';
  if (state.moves <= 12) return 'Sharp';
  if (state.moves <= 15) return 'Strong';
  return 'Finished';
}

function shuffleArray(list) {
  const copy = [...list];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function formatSeconds(seconds) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

function speak(text) {
  if (!('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.92;
    utterance.pitch = 1.02;
    window.speechSynthesis.speak(utterance);
  } catch {}
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}