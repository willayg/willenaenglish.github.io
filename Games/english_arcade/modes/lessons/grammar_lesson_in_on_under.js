// Grammar Lesson Runner ??In / On / Under (Prepositions of location)
// Teaches positional prepositions with visual scenes and sorting activities.
// Updated: Cache buster v2

import { startSession, endSession } from '../../../../students/records.js';

export async function runGrammarLessonInOnUnder(ctx = {}) {
  const { grammarFile, grammarName, playSFX, inlineToast } = ctx;
  const root = document.getElementById('gameArea');
  if (!root) return;

  ensureBaseStyles();
  ensureInOnUnderStyles();

  let items = [];
  try {
    if (!grammarFile) throw new Error('No grammar file provided');
    const res = await fetch(grammarFile, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to load ${grammarFile}`);
    const data = await res.json();
    if (Array.isArray(data)) items = data;
  } catch (err) {
    console.warn('[lesson-in-on-under] failed to load grammar list', err);
  }

  const sessionWords = (items || [])
    .map((it) => (it && typeof it.word === 'string' ? it.word : null))
    .filter(Boolean)
    .slice(0, 25);

  let sessionId = null;
  let sessionClosed = false;
  try {
    sessionId = startSession({
      mode: 'grammar_lesson_in_on_under',
      wordList: sessionWords,
      listName: grammarFile || grammarName || null,
      meta: { category: 'grammar', file: grammarFile, lesson: grammarName || 'In vs On vs Under' },
    });
  } catch (err) {
    console.debug('[InOnUnderLesson] startSession failed', err?.message);
  }

  const inList = normalizeList(items.filter((it) => (it?.article || '').toLowerCase() === 'in'), fallbackIn);
  const onList = normalizeList(items.filter((it) => (it?.article || '').toLowerCase() === 'on'), fallbackOn);
  const underList = normalizeList(items.filter((it) => (it?.article || '').toLowerCase() === 'under'), fallbackUnder);

  let lang = detectLang();
  if (lang !== 'ko') lang = 'en';
  let stepIndex = 0;

  const activityPool = buildActivityPool(inList, onList, underList);

  function renderLanguageStep(stage, prog, stepEl) {
    prog.textContent = '';
    stepEl.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:36px;text-align:center;width:90%;max-width:320px;';
    const title = document.createElement('div');
    title.style.cssText = 'font-size:clamp(1.4rem,4.5vmin,2rem);font-weight:800;color:#19777e;';
    title.textContent = lang === 'ko' ? '언어를 선택하세요' : 'Choose your language';
    const enBtn = buildLanguageButton('English');
    enBtn.onclick = () => { lang = 'en'; nextStep(); };
    const koBtn = buildLanguageButton('한국어');
    koBtn.onclick = () => { lang = 'ko'; nextStep(); };
    wrap.appendChild(title);
    wrap.appendChild(enBtn);
    wrap.appendChild(koBtn);
    stepEl.appendChild(wrap);
  }

  function renderIntroStep(stage, prog, stepEl) {
    prog.textContent = displayStep(1);
    stepEl.innerHTML = '';

    const intro = document.createElement('div');
    intro.className = 'lesson-body';
    intro.innerHTML = lang === 'ko'
      ? "<b>in</b>은 무언가의 안에 있을 때, <b>on</b>은 위에 있을 때, <b>under</b>는 아래에 있을 때 씁니다. 버튼을 탭해서 차이를 확인하세요!"
      : "We use <b>in</b>, <b>on</b>, or <b>under</b> to describe where something is. Tap each button to see the difference!";

    const subjectRow = document.createElement('div');
    subjectRow.className = 'iou-subject-row';

    const cardDisplay = document.createElement('div');
    cardDisplay.className = 'iou-highlight-card';

    const prepositionSets = buildPrepositionSets(inList, onList, underList);
    let current = null;
    
    // Animal rotation with English and Korean names
    const animals = [
      { emoji: '🐱', en: 'cat', ko: '고양이' },
      { emoji: '🐶', en: 'dog', ko: '강아지' },
      { emoji: '🐵', en: 'monkey', ko: '원숭이' },
      { emoji: '🐰', en: 'rabbit', ko: '토끼' },
      { emoji: '🐻', en: 'bear', ko: '곰' }
    ];
    let currentAnimalIndex = 0;

    const renderCard = (set) => {
      if (!set) return;
      current = set;
      subjectRow.querySelectorAll('button').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.id === set.id);
      });
      
      const animal = animals[currentAnimalIndex];
      
      // Create visual scene with the rotating emoji
      const sceneHTML = buildVisualScene(set.prep, animal.emoji);
      
      // Generate dynamic sentence with animal name
      const sentenceEn = `The ${animal.en} is ${set.prep} the box.`;
      const sentenceKo = `${animal.ko}는 상자 ${set.prep === 'in' ? '안에' : set.prep === 'on' ? '위에' : '아래에'} 있어요.`;

      cardDisplay.innerHTML = `
        <div class="prep-label">${set.prep.toUpperCase()}</div>
        <div class="prep-scene" id="prep-scene-clickable" style="cursor:pointer;">${sceneHTML}</div>
        <div class="prep-sentence">${escapeHtml(sentenceEn)}</div>
        <div class="prep-sentence-ko">${escapeHtml(sentenceKo)}</div>
        <div class="prep-tip">${escapeHtml(lang === 'ko' ? set.tipKo : set.tipEn)}</div>
      `;
      
      // Add click handler to scene to rotate animals
      const sceneEl = cardDisplay.querySelector('#prep-scene-clickable');
      if (sceneEl) {
        sceneEl.addEventListener('click', () => {
          currentAnimalIndex = (currentAnimalIndex + 1) % animals.length;
          renderCard(current);
        });
      }
    };

    prepositionSets.forEach((set) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.id = set.id;
      btn.textContent = set.label;
      btn.onclick = () => {
        playSFX?.('click');
        renderCard(set);
      };
      subjectRow.appendChild(btn);
    });

    intro.appendChild(subjectRow);
    intro.appendChild(cardDisplay);
    stepEl.appendChild(intro);

    renderCard(prepositionSets[0]);

    const controls = buildNavRow(() => { stepIndex = Math.max(0, stepIndex - 1); render(); }, nextStep, lang);
    stepEl.appendChild(controls);
  }

  function renderExamplesStep(stage, prog, stepEl) {
    prog.textContent = displayStep(2);
    stepEl.innerHTML = '';

    const intro = document.createElement('div');
    intro.className = 'lesson-body';
    intro.innerHTML = lang === 'ko'
      ? "예: <b>in</b>은 물건이 안에 있을 때, <b>on</b>은 위에 있을 때, <b>under</b>은 아래에 있을 때 씁니다. 소리내어 읽어보세요!"
      : "Examples for <b>in</b>, <b>on</b>, and <b>under</b>. Try reading them out loud!";
    stepEl.appendChild(intro);

    const grid = document.createElement('div');
    grid.className = 'iou-example-grid';
    grid.appendChild(buildExampleColumnWithScene('in', inList, lang));
    grid.appendChild(buildExampleColumnWithScene('on', onList, lang));
    grid.appendChild(buildExampleColumnWithScene('under', underList, lang));
    stepEl.appendChild(grid);

    const controls = buildNavRow(() => { stepIndex = Math.max(0, stepIndex - 1); render(); }, nextStep, lang);
    stepEl.appendChild(controls);
  }

  function renderSortingStep(stage, prog, stepEl) {
    prog.textContent = displayStep(3);
    stepEl.innerHTML = '';

    const body = document.createElement('div');
    body.className = 'lesson-body';
    body.innerHTML = lang === 'ko'
      ? '카드를 탭하여 상자 주변의 올바른 위치에 놓으세요.'
      : 'Tap a card and place it in the correct position around the box.';
    stepEl.appendChild(body);

    // Main container for the sorting activity
    const sortingContainer = document.createElement('div');
    sortingContainer.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:40px;width:100%;margin:30px 0;';

    // Create positions layout - box in center with IN/ON/UNDER positions around it
    const layoutContainer = document.createElement('div');
    layoutContainer.style.cssText = 'position:relative;width:280px;height:280px;margin:0 auto;';

    // ON position (top of box visually - on top of)
    const onPos = document.createElement('div');
    onPos.dataset.position = 'on';
    onPos.style.cssText = 'position:absolute;top:0;left:50%;transform:translateX(-50%);width:80px;height:60px;border:2px solid #ccc;border-radius:8px;background:#ffffff;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .2s ease;';
    const onLabel = document.createElement('span');
    onLabel.style.cssText = 'font-weight:700;color:#999;font-size:1rem;';
    onPos.appendChild(onLabel);

    // IN position (center of box)
    const inPos = document.createElement('div');
    inPos.dataset.position = 'in';
    inPos.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:100px;height:100px;border:3px solid #333;border-radius:12px;background:#ffffff;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .2s ease;';
    const inLabel = document.createElement('span');
    inLabel.style.cssText = 'font-weight:700;color:#999;font-size:1rem;';
    inPos.appendChild(inLabel);

    // UNDER position (bottom of box visually - under/below)
    const underPos = document.createElement('div');
    underPos.dataset.position = 'under';
    underPos.style.cssText = 'position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:80px;height:60px;border:2px solid #ccc;border-radius:8px;background:#ffffff;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .2s ease;';
    const underLabel = document.createElement('span');
    underLabel.style.cssText = 'font-weight:700;color:#999;font-size:1rem;';
    underPos.appendChild(underLabel);

    layoutContainer.appendChild(onPos);
    layoutContainer.appendChild(inPos);
    layoutContainer.appendChild(underPos);
    sortingContainer.appendChild(layoutContainer);

    // Card pool at bottom
    const poolLabel = document.createElement('div');
    poolLabel.style.cssText = 'font-weight:700;color:#19777e;text-align:center;margin-top:20px;';
    poolLabel.textContent = lang === 'ko' ? '카드' : 'Cards';
    sortingContainer.appendChild(poolLabel);

    const cardPool = document.createElement('div');
    cardPool.style.cssText = 'display:flex;gap:16px;justify-content:center;flex-wrap:wrap;width:100%;max-width:400px;margin:0 auto;';

    const placements = { in: null, on: null, under: null };
    let selectedCard = null;

    // Create position-tracking objects with actual DOM references
    const positions = {
      in: { element: inPos, label: inLabel },
      on: { element: onPos, label: onLabel },
      under: { element: underPos, label: underLabel }
    };

    // Create cards for in, on, under
    ['in', 'on', 'under'].forEach((prep) => {
      const card = document.createElement('div');
      card.dataset.prep = prep;
      card.style.cssText = 'border:3px solid #21b3be;background:#ffffff;color:#19777e;border-radius:10px;padding:14px 20px;font-weight:800;cursor:pointer;font-size:1.2rem;text-align:center;min-width:70px;box-shadow:0 2px 8px rgba(0,0,0,.08);transition:all .15s ease;user-select:none;';
      card.textContent = prep.toUpperCase();

      card.onmouseenter = () => {
        card.style.transform = 'translateY(-3px)';
        card.style.boxShadow = '0 6px 16px rgba(33,181,192,0.2)';
      };
      card.onmouseleave = () => {
        card.style.transform = 'translateY(0)';
        card.style.boxShadow = '0 2px 8px rgba(0,0,0,.08)';
      };

      card.onclick = () => {
        if (selectedCard === card) {
          card.style.outline = 'none';
          card.style.borderColor = '#21b3be';
          card.style.background = '#ffffff';
          selectedCard = null;
        } else {
          if (selectedCard) {
            selectedCard.style.outline = 'none';
            selectedCard.style.borderColor = '#21b3be';
            selectedCard.style.background = '#ffffff';
          }
          card.style.outline = '3px solid #ff6fb0';
          card.style.borderColor = '#ff6fb0';
          card.style.background = '#ffe8f1';
          selectedCard = card;
          playSFX?.('click');
        }
      };

      cardPool.appendChild(card);
    });

    sortingContainer.appendChild(cardPool);
    stepEl.appendChild(sortingContainer);

    // Add click handlers to positions
    ['in', 'on', 'under'].forEach((prep) => {
      positions[prep].element.onclick = () => {
        console.log('Position clicked:', prep, 'Selected card:', selectedCard?.dataset.prep);
        if (!selectedCard) {
          console.log('No card selected');
          return;
        }
        const selectedPrep = selectedCard.dataset.prep;
        console.log('Selected prep:', selectedPrep, 'Position prep:', prep, 'Match:', selectedPrep === prep);
        if (selectedPrep !== prep) {
          console.log('Wrong position for this card');
          return; // Only place in correct position
        }

        // Remove from any previous position
        ['in', 'on', 'under'].forEach((p) => {
          if (placements[p] === selectedPrep) {
            placements[p] = null;
            positions[p].label.textContent = '';
            positions[p].element.style.background = '#ffffff';
            positions[p].element.style.borderColor = '#ccc';
          }
        });

        // Place card
        placements[prep] = selectedPrep;
        positions[prep].label.textContent = selectedPrep.toUpperCase();
        positions[prep].element.style.background = '#e8f5e9';
        positions[prep].element.style.borderColor = '#4caf50';

        selectedCard.style.outline = 'none';
        selectedCard.style.borderColor = '#21b3be';
        selectedCard.style.background = '#ffffff';
        selectedCard = null;
        playSFX?.('click');

        // Check if all placed
        const allPlaced = ['in', 'on', 'under'].every((p) => placements[p] === p);
        console.log('All placed:', allPlaced);
        if (allPlaced) {
          checkAnswers();
        }
      };
    });

    const checkAnswers = () => {
      playSFX?.('correct');
      
      const message = document.createElement('div');
      message.className = 'completion-message';
      message.style.cssText = 'background:#e8f5e9;border:2px solid #4caf50;border-radius:12px;padding:14px 16px;text-align:center;color:#256029;font-weight:800;margin-top:20px;font-size:1.05rem;';
      message.textContent = lang === 'ko' ? '완벽해요! in, on, under의 차이를 잘 이해했어요!' : 'Perfect! You understand in, on, and under!';
      sortingContainer.appendChild(message);

      const nav = document.createElement('div');
      nav.className = 'lesson-nav';
      nav.style.marginTop = '20px';
      const continueBtn = buildPrimaryButton(lang === 'ko' ? '다음' : 'Next');
      continueBtn.style.background = '#fff';
      continueBtn.style.color = '#ff6fb0';
      continueBtn.style.borderColor = '#ff6fb0';
      continueBtn.onclick = () => nextStep();
      nav.appendChild(continueBtn);
      stepEl.appendChild(nav);

      // Disable interactions
      cardPool.style.pointerEvents = 'none';
      cardPool.style.opacity = '0.6';
    };

    const nav = document.createElement('div');
    nav.className = 'lesson-nav';
    nav.style.marginTop = '20px';
    const backBtn = buildPrimaryButton(lang === 'ko' ? '뒤로' : 'Back');
    backBtn.style.background = '#fff';
    backBtn.style.color = '#ff6fb0';
    backBtn.style.borderColor = '#ff6fb0';
    backBtn.onclick = () => { stepIndex = Math.max(0, stepIndex - 1); render(); };
    nav.appendChild(backBtn);
    stepEl.appendChild(nav);
  }

  function renderFinishStep(stage, prog, stepEl) {
    prog.textContent = '';
    stepEl.innerHTML = '';
    stepEl.style.display = 'flex';
    stepEl.style.flexDirection = 'column';
    stepEl.style.gap = '30px';

    const body = document.createElement('div');
    body.className = 'lesson-body';
    body.style.display = 'flex';
    body.style.flexDirection = 'column';
    body.style.alignItems = 'center';
    body.style.gap = '30px';
    body.innerHTML = (lang === 'ko')
      ? '<div style="font-weight:800;color:#19777e">축하합니다! 이제 in, on, under를 어떻게 사용하는지 알게 되었어요!</div><div class="stars">⭐⭐⭐⭐⭐</div>'
      : '<div style="font-weight:800;color:#19777e">Now you know how to use in, on, and under!</div><div class="stars">⭐⭐⭐⭐⭐</div>';
    stepEl.appendChild(body);

    const nav = document.createElement('div');
    nav.className = 'lesson-nav';
    const backBtn = buildPrimaryButton(lang === 'ko' ? '모드로 돌아가기' : 'Back to Modes');
    backBtn.onclick = () => {
      try {
        if (window.WordArcade?.startGrammarModeSelector) {
          window.WordArcade.startGrammarModeSelector();
        } else if (window.WordArcade?.quitToOpening) {
          window.WordArcade.quitToOpening(true);
        }
      } catch {}
    };
    nav.appendChild(backBtn);
    stepEl.appendChild(nav);

    if (!sessionClosed) {
      sessionClosed = true;
      try {
        endSession(sessionId, {
          mode: 'grammar_lesson_in_on_under',
          summary: {
            score: 1,
            total: 1,
            correct: 1,
            pct: 100,
            accuracy: 100,
            category: 'grammar',
            context: 'lesson',
            grammarName: grammarName || 'In vs On vs Under'
          },
          listName: grammarFile || grammarName || null,
          wordList: sessionWords
        });
      } catch (err) {
        console.debug('[InOnUnderLesson] endSession failed', err?.message);
      }
      try {
        const ev = new CustomEvent('wa:session-ended', { detail: { summary: { correct: 1, total: 1, grammarName: grammarName || 'In vs On vs Under', category: 'grammar' } } });
        window.dispatchEvent(ev);
      } catch {}
    }
  }

  function render() {
    root.innerHTML = '';
    const stage = document.createElement('div');
    stage.className = 'lesson-stage';

    const quitBtn = document.createElement('button');
    quitBtn.className = 'wa-quit-btn';
    quitBtn.setAttribute('aria-label', 'Quit lesson');
    quitBtn.innerHTML = `<img class="wa-quit-icon" src="assets/Images/icons/quit-game.svg" alt="" /><span class="wa-sr-only">Quit</span>`;
    quitBtn.style.cssText = 'opacity:0; transition:opacity 0.3s ease 0.5s;';
    quitBtn.onclick = () => {
      playSFX?.('click');
      if (window.WordArcade?.startGrammarModeSelector) {
        window.WordArcade.startGrammarModeSelector();
      } else if (window.WordArcade?.quitToOpening) {
        window.WordArcade.quitToOpening(true);
      }
    };
    root.appendChild(quitBtn);
    requestAnimationFrame(() => { quitBtn.style.opacity = '1'; });

    const top = document.createElement('div');
    top.className = 'lesson-topbar';
    const title = document.createElement('div');
    title.className = 'lesson-title';
    title.textContent = grammarName || 'In vs On vs Under';
    const prog = document.createElement('div');
    prog.className = 'lesson-progress';
    const stepEl = document.createElement('div');
    stepEl.className = 'lesson-step';

    top.appendChild(title);
    top.appendChild(prog);
    stage.appendChild(top);
    stage.appendChild(stepEl);
    root.appendChild(stage);

    const renderStep = () => {
      stepEl.classList.remove('enter');
      if (stepIndex === 0) renderLanguageStep(stage, prog, stepEl);
      else if (stepIndex === 1) renderIntroStep(stage, prog, stepEl);
      else if (stepIndex === 2) renderExamplesStep(stage, prog, stepEl);
      else if (stepIndex === 3) renderSortingStep(stage, prog, stepEl);
      else renderFinishStep(stage, prog, stepEl);
      requestAnimationFrame(() => stepEl.classList.add('enter'));
    };

    renderStep();
  }

  function nextStep() {
    stepIndex = Math.min(stepIndex + 1, 4);
    render();
  }

  render();
}

const fallbackIn = [
  { id: 'fb_in_box', word: 'cat', article: 'in', emoji: '🐱', exampleSentence: 'The cat is in the box.', exampleSentenceKo: '고양이는 상자 안에 있어요.' },
  { id: 'fb_in_bag', word: 'pencils', article: 'in', emoji: '✏️', exampleSentence: 'The pencils are in the bag.', exampleSentenceKo: '연필들은 가방 안에 있어요.' },
  { id: 'fb_in_cup', word: 'juice', article: 'in', emoji: '🥤', exampleSentence: 'The juice is in the cup.', exampleSentenceKo: '주스가 컵 안에 있어요.' }
];

const fallbackOn = [
  { id: 'fb_on_table', word: 'book', article: 'on', emoji: '📚', exampleSentence: 'The book is on the table.', exampleSentenceKo: '책이 탁자 위에 있어요.' },
  { id: 'fb_on_plate', word: 'cookie', article: 'on', emoji: '🍪', exampleSentence: 'The cookie is on the plate.', exampleSentenceKo: '쿠키가 접시 위에 있어요.' },
  { id: 'fb_on_head', word: 'hat', article: 'on', emoji: '🎩', exampleSentence: 'The hat is on my head.', exampleSentenceKo: '모자가 내 머리 위에 있어요.' }
];

const fallbackUnder = [
  { id: 'fb_under_bed', word: 'dog', article: 'under', emoji: '🐶', exampleSentence: 'The dog is under the bed.', exampleSentenceKo: '개가 침대 밑에 있어요.' },
  { id: 'fb_under_table', word: 'ball', article: 'under', emoji: '⚽', exampleSentence: 'The ball is under the table.', exampleSentenceKo: '공이 탁자 아래에 있어요.' },
  { id: 'fb_under_tree', word: 'child', article: 'under', emoji: '🧒', exampleSentence: 'The child is under the tree.', exampleSentenceKo: '아이가 나무 아래에 있어요.' }
];

function normalizeList(list, fallback) {
  const source = list && list.length ? list : fallback;
  return source.map((item, idx) => ({
    id: item.id || `fb_${idx}`,
    word: item.word || 'item',
    article: item.article || 'in',
    emoji: item.emoji || '❓',
    exampleSentence: item.exampleSentence || 'Example sentence',
    exampleSentenceKo: item.exampleSentenceKo || '예시 문장',
  }));
}

function buildActivityPool(inList, onList, underList) {
  const sampleIn = shuffle(inList).slice(0, 2);
  const sampleOn = shuffle(onList).slice(0, 2);
  const sampleUnder = shuffle(underList).slice(0, 2);
  return shuffle([...sampleIn, ...sampleOn, ...sampleUnder]);
}

function buildPrepositionSets(inList, onList, underList) {
  const inSample = inList[0] || fallbackIn[0];
  const onSample = onList[0] || fallbackOn[0];
  const underSample = underList[0] || fallbackUnder[0];

  return [
    {
      id: 'in',
      prep: 'in',
      label: 'In',
      emoji: inSample.emoji,
      sentenceEn: inSample.exampleSentence,
      tipEn: 'Use "in" for things inside or surrounded by something.',
      tipKo: '"in"은 어떤 것이 내부에 있을 때 사용합니다.'
    },
    {
      id: 'on',
      prep: 'on',
      label: 'On',
      emoji: onSample.emoji,
      sentenceEn: onSample.exampleSentence,
      tipEn: 'Use "on" when something is on top of something.',
      tipKo: '"on"은 어떤 것이 다른 것의 위에 있을 때 사용합니다.'
    },
    {
      id: 'under',
      prep: 'under',
      label: 'Under',
      emoji: underSample.emoji,
      sentenceEn: underSample.exampleSentence,
      tipEn: 'Use "under" when something is below something.',
      tipKo: '"under"은 어떤 것이 다른 것의 아래에 있을 때 사용합니다.'
    }
  ];
}

function makeChip(item) {
  const chip = document.createElement('div');
  chip.className = 'chip';
  chip.dataset.id = item.id;
  chip.dataset.article = item.article;
  chip.textContent = `${item.emoji} ${item.exampleSentence}`;
  return chip;
}

function buildVisualScene(prep, emoji) {
  // Create visual representation based on preposition
  let sceneHTML = '';
  
  if (prep === 'in') {
    // Large bordered box with emoji centered inside
    sceneHTML = `
      <div style="width:140px;height:140px;border:3px solid #333;border-radius:12px;background:#ffffff;display:flex;align-items:center;justify-content:center;margin:0 auto;font-size:70px;">
        ${emoji}
      </div>
    `;
  } else if (prep === 'on') {
    // Emoji on top of bordered box
    sceneHTML = `
      <div style="text-align:center;margin:0 auto;width:fit-content;">
        <div style="font-size:70px;margin-bottom:-10px;position:relative;z-index:2;">${emoji}</div>
        <div style="width:140px;height:110px;border:3px solid #333;border-radius:12px;background:#ffffff;position:relative;z-index:1;margin:0 auto;"></div>
      </div>
    `;
  } else if (prep === 'under') {
    // Bordered box on top, emoji below
    sceneHTML = `
      <div style="text-align:center;margin:0 auto;width:fit-content;">
        <div style="width:140px;height:110px;border:3px solid #333;border-radius:12px;background:#ffffff;position:relative;z-index:2;margin:0 auto;margin-bottom:-10px;"></div>
        <div style="font-size:70px;position:relative;z-index:1;margin-top:0;">${emoji}</div>
      </div>
    `;
  }
  
  return sceneHTML;
}

function buildExampleColumnWithScene(label, list, lang) {
  const wrap = document.createElement('div');
  wrap.className = 'lesson-example-column';
  const header = document.createElement('div');
  header.className = 'iou-column-header';
  header.textContent = label.toUpperCase();
  wrap.appendChild(header);
  
  list.slice(0, 3).forEach((item) => {
    const en = highlightSentence(item.exampleSentence, 'en', label);
    const ko = highlightSentence(item.exampleSentenceKo, 'ko', label);
    const card = document.createElement('div');
    card.className = 'lesson-example lesson-example-with-scene';
    
    const sceneHTML = buildVisualScene(label, item.emoji);
    
    card.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;gap:12px;">
        <div style="width:100%;text-align:center;">
          ${sceneHTML}
        </div>
        <div>
          <div style="font-weight:800;color:#19777e;font-size:1.05rem;line-height:1.3;">${en}</div>
          <div style="font-size:0.95rem;color:#5f6b75;margin-top:8px;font-weight:700;">${ko}</div>
        </div>
      </div>
    `;
    wrap.appendChild(card);
  });
  return wrap;
}

function buildNavRow(onBack, onNext, lang) {
  const nav = document.createElement('div');
  nav.className = 'lesson-nav';
  const back = buildPrimaryButton(lang === 'ko' ? '뒤로' : 'Back');
  back.style.background = '#fff';
  back.style.color = '#ff6fb0';
  back.style.borderColor = '#ff6fb0';
  back.onclick = onBack;
  const next = buildPrimaryButton(lang === 'ko' ? '다음' : 'Next');
  next.style.background = '#fff';
  next.style.color = '#ff6fb0';
  next.style.borderColor = '#ff6fb0';
  next.onclick = onNext;
  nav.appendChild(back);
  nav.appendChild(next);
  return nav;
}

function buildPrimaryButton(label) {
  const btn = document.createElement('button');
  btn.className = 'lesson-btn primary';
  btn.textContent = label;
  return btn;
}

function buildLanguageButton(label) {
  const btn = document.createElement('button');
  btn.className = 'lesson-btn';
  btn.style.border = '3px solid #21b3be';
  btn.style.color = '#ff6fb0';
  btn.style.background = '#fff';
  btn.style.padding = '16px 28px';
  btn.style.fontSize = '1.15rem';
  btn.style.minWidth = '200px';
  btn.style.borderRadius = '14px';
  btn.textContent = label;
  btn.onmouseenter = () => { btn.style.transform = 'translateY(-2px)'; btn.style.boxShadow = '0 6px 16px rgba(33,181,192,0.2)'; };
  btn.onmouseleave = () => { btn.style.transform = 'translateY(0)'; btn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'; };
  return btn;
}

function makeBucket(key, label) {
  const wrap = document.createElement('div');
  wrap.className = 'bucket';
  if (key === 'pool') wrap.classList.add('pool');
  const title = document.createElement('h4');
  title.textContent = label;
  const body = document.createElement('div');
  body.className = 'bucket-body';
  body.dataset.bucket = key;
  wrap.appendChild(title);
  wrap.appendChild(body);
  return { wrap, body };
}

function displayStep(idx) {
  if (idx === 1) return 'Step 1 of 3';
  if (idx === 2) return 'Step 2 of 3';
  if (idx === 3) return 'Step 3 of 3';
  return '';
}

function ensureBaseStyles() {
  if (document.getElementById('wa-lesson-styles')) return;
  const st = document.createElement('style');
  st.id = 'wa-lesson-styles';
  st.textContent = `
    #gameArea .lesson-stage{display:flex;flex-direction:column;align-items:center;justify-content:flex-start;height:100%;gap:clamp(10px,3vmin,24px);padding:clamp(12px,3.2vmin,26px);max-width:820px;width:100%;box-sizing:border-box;margin:0 auto;font-family:'Poppins','Noto Sans KR','Nanum Gothic','Apple SD Gothic Neo','Malgun Gothic',system-ui,Arial,sans-serif;background:#ffffff}
    #gameArea .lesson-topbar{width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px}
    #gameArea .lesson-title{font-weight:800;color:#19777e;font-size:clamp(1.15rem,3.8vmin,1.7rem)}
    #gameArea .lesson-progress{font-size:.95rem;color:#666;font-weight:600}
    #gameArea .lesson-step{opacity:0;transform:translateY(8px);transition:opacity .22s ease,transform .22s ease;width:100%}
    #gameArea .lesson-step.enter{opacity:1;transform:translateY(0)}
    #gameArea .lesson-body{text-align:center;font-size:clamp(1.02rem,3.3vmin,1.22rem);line-height:1.45;color:#27323a}
    #gameArea .lesson-nav{margin-top:auto;display:flex;gap:10px;align-items:center;justify-content:center;width:100%}
    #gameArea .lesson-btn{appearance:none;border:2px solid #21b3be;background:#21b3be;color:#fff;border-radius:12px;padding:10px 16px;font-weight:800;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,.06);transition:transform .15s ease, box-shadow .15s ease}
    #gameArea .lesson-btn:hover{transform:translateY(-1px);box-shadow:0 6px 16px rgba(33,181,192,0.18)}
    #gameArea .lesson-btn.primary{background:#21b3be;color:#fff;border-color:#21b3be}
    #gameArea .lesson-examples{display:grid;grid-template-columns:1fr 1fr;gap:12px;width:100%;max-width:620px;margin:10px auto}
    @media (max-width:620px){#gameArea .lesson-examples{grid-template-columns:1fr}}
    #gameArea .lesson-example{border:2px solid #d1e6f0;border-radius:14px;padding:14px;background:#fff;box-shadow:0 2px 6px rgba(0,0,0,.05)}
    #gameArea .lesson-example strong{color:#19777e}
    #gameArea .buckets{display:grid;grid-template-columns:1fr;gap:14px;margin-top:12px;width:100%;max-width:820px}
    @media (min-width:720px){#gameArea .buckets{grid-template-columns:1fr 1fr}}
    #gameArea .bucket{border:2px dashed #b0e2e4;border-radius:16px;min-height:120px;background:linear-gradient(180deg,#fbffff 0%,#ffffff 100%);padding:10px;display:flex;flex-direction:column;gap:8px;box-shadow:0 2px 10px rgba(0,0,0,.04);cursor:pointer}
    #gameArea .bucket h4{margin:0;font-size:1.05rem;color:#19777e}
    #gameArea .bucket .bucket-body{display:flex;flex-wrap:wrap;gap:8px;cursor:pointer}
    #gameArea .bucket.pool{border-color:#e6e6e6;background:#fff}
    #gameArea .chip{user-select:none;border:2px solid #93cbcf;background:#ffffff;color:#19777e;border-radius:9999px;padding:10px 12px;font-weight:700;cursor:pointer;text-align:center;box-shadow:0 2px 6px rgba(0,0,0,.06);transition:transform .12s ease, box-shadow .12s ease}
    #gameArea .chip:hover{transform:scale(1.04);box-shadow:0 6px 16px rgba(0,0,0,.12)}
    #gameArea .chip.selected{outline:3px solid #21b3be;border-color:#21b3be}
    #gameArea .chip.bad{border-color:#f44336;color:#c62828;background:#ffebee}
    #gameArea .chip.good{border-color:#4caf50;color:#2e7d32;background:#e8f5e9}
    #gameArea .stars{font-size:clamp(1.6rem,6vmin,2.2rem);line-height:1}
  `;
  document.head.appendChild(st);
}

function ensureInOnUnderStyles() {
  if (document.getElementById('wa-lesson-in-on-under-styles')) return;
  const st = document.createElement('style');
  st.id = 'wa-lesson-in-on-under-styles';
  st.textContent = `
    #gameArea .iou-subject-row{display:flex;gap:8px;margin:16px 0;justify-content:center;flex-wrap:wrap}
    #gameArea .iou-subject-row button{appearance:none;border:3px solid #21b3be;background:#fff;color:#21b3be;border-radius:12px;padding:12px 16px;font-weight:800;cursor:pointer;transition:all .15s ease;min-width:80px}
    #gameArea .iou-subject-row button:hover{transform:translateY(-2px);box-shadow:0 4px 12px rgba(33,181,192,0.2)}
    #gameArea .iou-subject-row button.active{background:#21b3be;color:#fff;box-shadow:0 4px 12px rgba(33,181,192,0.3)}
    #gameArea .iou-highlight-card{border:3px solid #21b3be;border-radius:16px;background:#f0f9fb;padding:20px;text-align:center;margin:16px auto;max-width:400px;min-height:240px;display:flex;flex-direction:column;justify-content:center;gap:12px}
    #gameArea .prep-label{font-weight:800;color:#ff6fb0;font-size:1.6rem;text-transform:uppercase}
    #gameArea .prep-scene{font-size:2.5rem;margin:12px 0;min-height:150px;display:flex;align-items:center;justify-content:center;transition:transform .2s ease}
    #gameArea .prep-scene:hover{transform:scale(1.05)}
    #gameArea .prep-sentence{font-size:1.15rem;font-weight:700;color:#19777e;line-height:1.4}
    #gameArea .prep-sentence-ko{font-size:1rem;color:#999;font-weight:600;margin-top:4px}
    #gameArea .prep-tip{font-size:0.95rem;color:#5f6b75;font-weight:600;font-style:italic}
    #gameArea .iou-example-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;width:100%;max-width:820px;margin:10px auto}
    @media (max-width:820px){#gameArea .iou-example-grid{grid-template-columns:1fr}}
    #gameArea .lesson-example-with-scene{padding:16px;display:flex;flex-direction:column;align-items:center;gap:12px;}
    #gameArea .lesson-example-with-scene > div:first-child{min-height:140px;display:flex;align-items:center;justify-content:center;width:100%;}
    #gameArea .iou-column-header{font-weight:800;color:#19777e;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.05em;font-size:1rem}
    #gameArea .buckets-three{grid-template-columns:1fr 1fr 1fr}
    @media (max-width:900px){#gameArea .buckets-three{grid-template-columns:1fr}}
  `;
  document.head.appendChild(st);
}

function highlightSentence(text, lang, prep) {
  if (!text) return '';
  const clean = String(text);
  const prepWords = { in: 'in', on: 'on', under: 'under' };
  const target = prepWords[prep] || prep;
  const regex = new RegExp(`\\b${target}\\b`, 'gi');
  return clean.replace(regex, `<span style="color:#ff6fb0;font-weight:800;">$&</span>`);
}

function detectLang() {
  try {
    if (window.StudentLang && typeof window.StudentLang.getLang === 'function') {
      const v = window.StudentLang.getLang();
      if (typeof v === 'string') return v.toLowerCase();
    }
    const h = document.documentElement.getAttribute('lang');
    if (h) return h.toLowerCase();
  } catch {}
  return 'en';
}

function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text || '').replace(/[&<>"']/g, (m) => map[m]);
}

function shuffle(arr) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
