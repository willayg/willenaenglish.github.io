// Grammar Lesson Runner ??Contractions with the Be verb
// Simple multi-step lesson with sliders that show how words combine into contractions.

import { startSession, endSession } from '../../../../students/records.js';

export async function runGrammarLessonContractionsBe(ctx = {}) {
  const { grammarFile, grammarName } = ctx;
  const root = document.getElementById('gameArea');
  if (!root) return;

  ensureBaseStyles();
  ensureContractionsStyles();

  let items = [];
  try {
    if (!grammarFile) throw new Error('No grammar file provided');
    const res = await fetch(grammarFile, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to load ${grammarFile}`);
    const data = await res.json();
    if (Array.isArray(data)) items = data;
  } catch (err) {
    console.warn('[lesson-contractions] failed to load list', err);
  }

  if (!items.length) items = fallbackItems.map((entry) => ({ ...entry }));

  const sessionWords = items.map((it) => it?.word).filter(Boolean).slice(0, 25);
  let sessionId = null;
  let sessionClosed = false;
  try {
    sessionId = startSession({
      mode: 'grammar_lesson_contractions_be',
      wordList: sessionWords,
      listName: grammarFile || grammarName || 'Contractions (Be)',
      meta: { category: 'grammar', file: grammarFile || 'contractions_be.json', lesson: grammarName || 'Contractions (Be)', level: 'Level 1 Grammar' }
    });
  } catch (err) {
    console.debug('[ContractionsLesson] startSession failed', err?.message);
  }

  let lang = detectLang();
  lang = (lang === 'ko' || lang === 'kr') ? 'ko' : 'en';
  const TOTAL_STEPS = 5; // number of instructional steps (language pick excluded)
  let stepIndex = 0; // 0 = language, then 1..TOTAL_STEPS

  const formatStepLabel = (stepValue) => {
    const current = Math.max(1, Math.min(stepValue, TOTAL_STEPS));
    const label = lang === 'ko' ? '단계' : 'Step';
    return `${label} ${current} / ${TOTAL_STEPS}`;
  };

  render();

  function render() {
    root.innerHTML = '';

    const quitBtn = document.createElement('button');
    quitBtn.className = 'wa-quit-btn';
    quitBtn.setAttribute('aria-label', 'Quit lesson');
    quitBtn.innerHTML = `<img class="wa-quit-icon" src="assets/Images/icons/quit-game.svg" alt="" /><span class="wa-sr-only">Quit</span>`;
    quitBtn.style.cssText = 'opacity:0; transition:opacity 0.3s ease 0.5s;';
    quitBtn.onclick = () => {
      if (window.WordArcade?.startGrammarModeSelector) {
        window.WordArcade.startGrammarModeSelector();
      } else if (window.WordArcade?.quitToOpening) {
        window.WordArcade.quitToOpening(true);
      }
    };
    root.appendChild(quitBtn);
    requestAnimationFrame(() => { quitBtn.style.opacity = '1'; });

    const stage = document.createElement('div');
    stage.className = 'lesson-stage contractions-lesson';

    const topbar = document.createElement('div');
    topbar.className = 'lesson-topbar';
    const title = document.createElement('div');
    title.className = 'lesson-title';
    title.textContent = grammarName || (lang === 'ko' ? 'Be 동사 축약' : 'Contractions (Be)');
    const progress = document.createElement('div');
    progress.className = 'lesson-progress';
  progress.textContent = stepIndex === 0 ? '' : formatStepLabel(stepIndex);
    topbar.appendChild(title);
    topbar.appendChild(progress);

    const stepEl = document.createElement('div');
    stepEl.className = 'lesson-step';
    const nav = document.createElement('div');
    nav.className = 'lesson-nav';

  if (stepIndex === 0) renderLanguageStep(stepEl, nav, progress);
  else if (stepIndex === 1) renderIntroStep(stepEl, nav, progress);
  else if (stepIndex === 2) renderSlidersStep(stepEl, nav, progress);
  else if (stepIndex === 3) renderExamplesStep(stepEl, nav, progress);
  else if (stepIndex === 4) renderMatchingStep(stepEl, nav, progress);
  else renderFinishStep(stepEl, nav, progress);

    stage.appendChild(topbar);
    stage.appendChild(stepEl);
    stage.appendChild(nav);
    root.appendChild(stage);

    requestAnimationFrame(() => stepEl.classList.add('enter'));
  }

  function renderLanguageStep(stepEl, nav, progress) {
    progress.textContent = '';
    nav.style.display = 'none';
    stepEl.style.cssText = 'display:flex;align-items:center;justify-content:center;';

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:40px;text-align:center;width:90%;max-width:320px;';

    const label = document.createElement('div');
    label.style.cssText = 'font-size:clamp(1.4rem,4.5vmin,2rem);font-weight:800;color:#19777e;';
    label.textContent = lang === 'ko' ? '언어를 선택하세요' : 'Choose your language';

    const buildBtn = (text, onClick) => {
      const btn = document.createElement('button');
      btn.textContent = text;
      btn.style.cssText = 'width:100%;border:3px solid #21b3be;background:#fff;color:#ff6fb0;border-radius:14px;padding:14px 28px;font-weight:800;cursor:pointer;font-size:1.25rem;box-shadow:0 2px 8px rgba(0,0,0,.06);transition:transform .15s ease,box-shadow .15s ease;';
      btn.onmouseenter = () => {
        btn.style.transform = 'translateY(-2px)';
        btn.style.boxShadow = '0 6px 16px rgba(33,181,192,0.2)';
      };
      btn.onmouseleave = () => {
        btn.style.transform = 'translateY(0)';
        btn.style.boxShadow = '0 2px 8px rgba(0,0,0,.06)';
      };
      btn.onclick = onClick;
      return btn;
    };

    const enBtn = buildBtn('English', () => {
      lang = 'en';
      stepIndex = 1;
      render();
    });
    const koBtn = buildBtn('한국어', () => {
      lang = 'ko';
      stepIndex = 1;
      render();
    });

    wrapper.appendChild(label);
    wrapper.appendChild(enBtn);
    wrapper.appendChild(koBtn);
    stepEl.appendChild(wrapper);
  }

  function renderIntroStep(stepEl, nav, progress) {
  progress.textContent = formatStepLabel(stepIndex);
    nav.style.display = '';
    nav.innerHTML = '';

    const body = document.createElement('div');
    body.className = 'lesson-body';
    body.innerHTML = lang === 'ko'
      ? '<b>수축(Contractions)</b>는 두 단어를 하나로 줄여 말하는 방법입니다. 예: <b>I am → I\'m</b>'
      : '<b>Contractions</b> push two words together to make one word! Example: <b>I am → I\'m</b>.';
    stepEl.appendChild(body);

    nav.appendChild(makeNavButton('back', lang, prevStep));
    nav.appendChild(makeNavButton('next', lang, nextStep));
  }

  function renderSlidersStep(stepEl, nav, progress) {
  progress.textContent = formatStepLabel(stepIndex);
    nav.style.display = '';
    nav.innerHTML = '';

    const body = document.createElement('div');
    body.className = 'lesson-body';
    body.textContent = lang === 'ko'
      ? '슬라이더를 움직여 단어들을 합쳐보세요!'
      : 'Drag each slider to push the words together!';
    stepEl.appendChild(body);

    const sliderData = buildSliderData(items);
    const container = document.createElement('div');
    container.className = 'slider-demo-container';
    sliderData.forEach((row) => container.appendChild(makeSlider(row)));
    stepEl.appendChild(container);

    nav.appendChild(makeNavButton('back', lang, prevStep));
    nav.appendChild(makeNavButton('next', lang, nextStep));
  }

  function renderExamplesStep(stepEl, nav, progress) {
  progress.textContent = formatStepLabel(stepIndex);
    nav.style.display = '';
    nav.innerHTML = '';

    const body = document.createElement('div');
    body.className = 'lesson-body';
    body.textContent = lang === 'ko'
      ? '수축 예문을 확인하세요:'
      : 'Check out a few contraction sentences:';
    stepEl.appendChild(body);

    const grid = document.createElement('div');
    grid.className = 'lesson-examples';
    items.slice(0, 6).forEach((item) => {
      const card = document.createElement('div');
      card.className = 'lesson-example';

      const title = document.createElement('div');
      title.style.cssText = 'font-size:0.95rem;color:#7d8a97;margin-bottom:8px;font-weight:700;';
      title.textContent = `${item.pronoun || item.word || ''} ${item.fullForm || ''}`.trim() + ` → ${item.contraction || ''}`;

      const sentence = document.createElement('div');
      sentence.style.cssText = 'font-size:1rem;color:#27323a;font-weight:600;';
      sentence.textContent = item.exampleSentence || '';

      const sentenceKo = document.createElement('div');
      sentenceKo.style.cssText = 'font-size:0.92rem;color:#6b7c87;margin-top:4px;';
      sentenceKo.textContent = item.exampleSentenceKo || '';

      card.appendChild(title);
      card.appendChild(sentence);
      if (sentenceKo.textContent) card.appendChild(sentenceKo);
      grid.appendChild(card);
    });
    stepEl.appendChild(grid);

    nav.appendChild(makeNavButton('back', lang, prevStep));
    nav.appendChild(makeNavButton('next', lang, nextStep));
  }

  function renderMatchingStep(stepEl, nav, progress) {
  progress.textContent = formatStepLabel(stepIndex);
    nav.style.display = '';
    nav.innerHTML = '';

    const body = document.createElement('div');
    body.className = 'lesson-body';
    body.textContent = lang === 'ko'
      ? "'s, 're, 'm 중에서 알맞은 것을 고르세요."
      : "Choose 's, 're, or 'm to finish each contraction!";
    stepEl.appendChild(body);

    const status = document.createElement('div');
    status.className = 'match-status';
    const basePrompt = lang === 'ko'
      ? "주어를 탭한 다음, 알맞은 축약형을 고르세요."
      : "Tap a subject, then choose the contraction ending.";
    status.textContent = basePrompt;
    stepEl.appendChild(status);

    const container = document.createElement('div');
    container.className = 'contractions-match';

    const pronounColumn = document.createElement('div');
    pronounColumn.className = 'match-column pronouns';
    const pronounTitle = document.createElement('h4');
    pronounTitle.textContent = lang === 'ko' ? '주어' : 'Subjects';
    pronounColumn.appendChild(pronounTitle);
    const pronounList = document.createElement('div');
    pronounList.className = 'match-list';
    pronounColumn.appendChild(pronounList);

    const contractionColumn = document.createElement('div');
    contractionColumn.className = 'match-column contractions';
    const contractionTitle = document.createElement('h4');
    contractionTitle.textContent = lang === 'ko' ? '끝부분 선택' : 'Choose Ending';
    contractionColumn.appendChild(contractionTitle);
    const optionList = document.createElement('div');
    optionList.className = 'match-list option-list';
    contractionColumn.appendChild(optionList);

    container.appendChild(pronounColumn);
    container.appendChild(contractionColumn);
    stepEl.appendChild(container);

    const determineSuffix = (pair) => {
      const contraction = (pair.contraction || '').trim();
      const apostropheIndex = contraction.indexOf("'");
      if (apostropheIndex >= 0) {
        return contraction.slice(apostropheIndex);
      }
      const fullForm = (pair.fullForm || '').toLowerCase();
      if (fullForm.startsWith('am')) return "'m";
      if (fullForm.startsWith('are')) return "'re";
      return "'s";
    };

    const enrichedPairs = buildMatchingPairs(items).map((pair) => ({
      ...pair,
      answer: determineSuffix(pair)
    }));
    const pronounOrder = shuffle(enrichedPairs);

    let activePronoun = null;
    let solvedCount = 0;
    const totalPairs = pronounOrder.length;

    const backBtn = makeNavButton('back', lang, prevStep);
    const nextBtn = makeNavButton('next', lang, nextStep);
    if (totalPairs === 0) {
      nextBtn.disabled = false;
      nextBtn.classList.remove('disabled');
    } else {
      nextBtn.disabled = true;
      nextBtn.classList.add('disabled');
    }
    nav.appendChild(backBtn);
    nav.appendChild(nextBtn);

    const setStatus = (message, state = null) => {
      status.textContent = message;
      status.classList.remove('success', 'error');
      if (state) status.classList.add(state);
    };

    const handlePronounClick = (btn) => {
      if (btn.disabled) return;
      if (btn === activePronoun) {
        btn.classList.remove('active');
        activePronoun = null;
        setStatus(basePrompt);
        return;
      }
      if (activePronoun) activePronoun.classList.remove('active');
      activePronoun = btn;
      btn.classList.add('active');
      setStatus(lang === 'ko' ? '이제 끝부분을 선택하세요!' : 'Now pick the ending!');
    };

    const handleOptionClick = (btn) => {
      if (btn.disabled) return;
      if (!activePronoun) {
        setStatus(lang === 'ko' ? '먼저 주어를 선택하세요.' : 'Pick a subject first.', 'error');
        return;
      }

      const expected = activePronoun.dataset.answer;
      const chosen = btn.dataset.key;
      if (chosen === expected) {
        const index = Number(activePronoun.dataset.index);
        const pair = pronounOrder[index];
        activePronoun.classList.remove('active');
        activePronoun.classList.remove('wrong');
        activePronoun.classList.add('matched');
        activePronoun.disabled = true;
        if (pair) {
          activePronoun.textContent = `${pair.pronoun} → ${pair.contraction}`;
        }
        solvedCount += 1;
        const successMsg = pair
          ? (lang === 'ko'
            ? `${pair.pronoun} + ${pair.fullForm} → ${pair.contraction}! 잘했어요!`
            : `${pair.pronoun} + ${pair.fullForm} → ${pair.contraction}! Great!`)
          : (lang === 'ko' ? '잘했어요!' : 'Nice!');
        setStatus(successMsg, 'success');
        activePronoun = null;
        if (solvedCount === totalPairs) {
          const completeMsg = lang === 'ko'
            ? '모든 축약형을 해결했어요!'
            : 'All contractions solved!';
          setStatus(completeMsg, 'success');
          nextBtn.disabled = false;
          nextBtn.classList.remove('disabled');
        }
      } else {
        activePronoun.classList.add('wrong');
        btn.classList.add('wrong');
        setStatus(lang === 'ko' ? '다시 시도해보세요!' : 'Oops, try again!', 'error');
        setTimeout(() => {
          btn.classList.remove('wrong');
          activePronoun?.classList.remove('wrong');
        }, 600);
      }
    };

    pronounOrder.forEach((pair, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'match-chip';
      btn.textContent = pair.pronoun;
      btn.dataset.index = String(idx);
      btn.dataset.answer = pair.answer;
      btn.addEventListener('click', () => handlePronounClick(btn));
      pronounList.appendChild(btn);
    });

    const suffixLabel = (suffix) => {
      return suffix;
    };

    ["'s", "'re", "'m"].forEach((suffix) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'match-chip option-chip';
      btn.textContent = suffixLabel(suffix);
      btn.dataset.key = suffix;
      btn.addEventListener('click', () => handleOptionClick(btn));
      optionList.appendChild(btn);
    });
  }

  function renderFinishStep(stepEl, nav, progress) {
  progress.textContent = formatStepLabel(stepIndex);
    nav.style.display = '';
    nav.innerHTML = '';

    finishSession();

    const body = document.createElement('div');
    body.className = 'lesson-body';
    body.style.display = 'flex';
    body.style.flexDirection = 'column';
    body.style.alignItems = 'center';
    body.style.gap = '18px';
    body.innerHTML = lang === 'ko'
      ? '<div style="font-weight:800;color:#19777e">축하합니다! 축약형을 마스터했어요!</div><div class="stars">⭐⭐⭐⭐⭐</div>'
      : '<div style="font-weight:800;color:#19777e">You mastered be-verb contractions!</div><div class="stars">⭐⭐⭐⭐⭐</div>';
    stepEl.appendChild(body);

    const backBtn = makeNavButton('back', lang, prevStep);
    const menuBtn = makeNavButton('menu', lang, () => {
      finishSession();
      if (window.WordArcade?.startGrammarModeSelector) {
        window.WordArcade.startGrammarModeSelector();
      } else if (window.WordArcade?.quitToOpening) {
        window.WordArcade.quitToOpening(true);
      }
    });
    nav.appendChild(backBtn);
    nav.appendChild(menuBtn);
  }

  function makeNavButton(kind, currentLang, onClick) {
    const btn = document.createElement('button');
    btn.className = 'lesson-btn';
    if (kind === 'back') {
      btn.textContent = currentLang === 'ko' ? '뒤로' : 'Back';
      btn.onclick = () => {
        onClick();
      };
    } else if (kind === 'next') {
      btn.textContent = currentLang === 'ko' ? '다음' : 'Next';
      btn.onclick = () => {
        onClick();
      };
    } else if (kind === 'menu') {
      btn.textContent = currentLang === 'ko' ? '메인 메뉴' : 'Main Menu';
      btn.onclick = () => {
        onClick();
      };
    } else if (kind === 'play') {
      btn.textContent = currentLang === 'ko' ? '시작하기' : "Let's Play";
      btn.onclick = () => {
        onClick();
      };
    } else {
      btn.textContent = currentLang === 'ko' ? '시작하기' : "Let's Play";
      btn.onclick = () => {
        onClick();
      };
    }
    return btn;
  }

  function nextStep() {
    stepIndex = Math.min(stepIndex + 1, TOTAL_STEPS);
    render();
  }

  function prevStep() {
    stepIndex = Math.max(stepIndex - 1, 0);
    render();
  }

  function finishSession() {
    if (sessionClosed) return;
    sessionClosed = true;

    const summaryPayload = {
      mode: 'grammar_lesson_contractions_be',
      summary: {
        score: 1,
        total: 1,
        correct: 1,
        pct: 100,
        accuracy: 100,
        category: 'grammar',
        context: 'lesson',
        grammarName: grammarName || 'Contractions (Be)',
      },
      listName: grammarFile || grammarName || null,
      wordList: sessionWords,
    };

    try {
      if (sessionId) endSession(sessionId, summaryPayload);
    } catch (err) {
      console.debug('[ContractionsLesson] endSession failed', err?.message);
    }

    try {
      const ev = new CustomEvent('wa:session-ended', { detail: { summary: summaryPayload.summary } });
      window.dispatchEvent(ev);
    } catch {}
  }

  function makeSlider(row) {
    const item = document.createElement('div');
    item.className = 'slider-demo-item';

    const label = document.createElement('div');
    label.className = 'slider-demo-label';
    label.textContent = lang === 'ko'
      ? `${row.pronoun} + ${row.fullForm} 결합`
      : `Combine ${row.pronoun} + ${row.fullForm}`;

    const display = document.createElement('div');
    display.className = 'slider-demo-display';

    const partsWrap = document.createElement('div');
    partsWrap.className = 'slider-push';

    const pronounSpan = document.createElement('span');
    pronounSpan.className = 'slider-part pronoun';
    pronounSpan.textContent = row.pronoun;

    const verbSpan = document.createElement('span');
    verbSpan.className = 'slider-part verb';
    verbSpan.textContent = row.fullForm;

    partsWrap.appendChild(pronounSpan);
    partsWrap.appendChild(verbSpan);

  const arrow = document.createElement('span');
  arrow.className = 'slider-separator';
  arrow.textContent = '→';

    const contractionSpan = document.createElement('span');
  contractionSpan.className = 'slider-contraction';
  contractionSpan.textContent = row.contraction;
  contractionSpan.style.opacity = '0';
  contractionSpan.style.transform = 'scale(0.9)';

    display.appendChild(partsWrap);
    display.appendChild(arrow);
    display.appendChild(contractionSpan);

    const sliderWrap = document.createElement('div');
    sliderWrap.className = 'slider-range-wrap';
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '100';
    slider.value = '0';
    slider.step = '1';
    slider.className = 'slider-range';
    slider.setAttribute('aria-label', `${row.pronoun} ${row.fullForm}`);

    const swallow = (evt) => {
      evt.stopPropagation();
    };
    sliderWrap.addEventListener('pointerdown', swallow);
    sliderWrap.addEventListener('pointerup', swallow);
    slider.addEventListener('pointerdown', swallow);
    slider.addEventListener('pointerup', swallow);
    ['touchstart', 'touchmove', 'touchend'].forEach((eventName) => {
      sliderWrap.addEventListener(eventName, swallow, { passive: true });
      slider.addEventListener(eventName, swallow, { passive: true });
    });

    const tip = document.createElement('div');
    tip.className = 'slider-tip';
    tip.textContent = lang === 'ko'
      ? `슬라이드하여 ${row.contraction}를 보세요`
      : `Slide to reveal ${row.contraction}`;

    const update = (value) => {
      const pct = Math.max(0, Math.min(100, Number(value) || 0));
      const progress = pct / 100;
      const gapPx = Math.max(4, 28 - pct * 0.22);
      partsWrap.style.gap = gapPx + 'px';

      const fadeOut = Math.max(0, 1 - progress * 1.2);
      const fadeIn = Math.min(1, progress * 1.2);
      pronounSpan.style.opacity = fadeOut.toFixed(2);
      verbSpan.style.opacity = fadeOut.toFixed(2);
      arrow.style.opacity = fadeOut.toFixed(2);
      partsWrap.style.opacity = fadeOut.toFixed(2);

      contractionSpan.style.opacity = fadeIn.toFixed(2);
      contractionSpan.style.transform = `translateX(-50%) scale(${(0.9 + progress * 0.1).toFixed(2)})`;

      slider.style.background = `linear-gradient(90deg,#21b3be 0%,#21b3be ${pct}%,#e0e0e0 ${pct}%,#e0e0e0 100%)`;
    };

    slider.addEventListener('input', (evt) => update(evt.target.value));
    update(slider.value);

    sliderWrap.appendChild(slider);
    item.appendChild(label);
    item.appendChild(display);
    item.appendChild(sliderWrap);
    if (tip.textContent) item.appendChild(tip);
    return item;
  }

  function buildMatchingPairs(list) {
    const map = new Map();
    const source = [...list, ...fallbackItems];
    source.forEach((entry) => {
      if (!entry) return;
      const pronounRaw = (entry.pronoun || entry.word || '').trim();
      const contraction = (entry.contraction || '').trim();
      if (!pronounRaw || !contraction) return;
      const key = pronounRaw.toLowerCase();
      if (map.has(key)) return;
      const fullForm = (entry.fullForm || '').trim();
      const pronoun = pronounRaw.replace(/^\s+|\s+$/g, '');
      map.set(key, {
        key,
        pronoun,
        contraction,
        fullForm: fullForm || (key === 'i' ? 'am' : key === 'you' || key === 'we' || key === 'they' ? 'are' : 'is')
      });
    });
    const pairs = Array.from(map.values());
    if (!pairs.length) return [];
    return shuffle(pairs).slice(0, Math.min(5, pairs.length));
  }

  function shuffle(source) {
    const arr = source.slice();
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function buildSliderData(list) {
    const findEntry = (pronoun) => {
      const target = list.find((it) => (it.pronoun || it.word || '').toLowerCase() === pronoun.toLowerCase());
      if (!target) return null;
      return {
        pronoun: target.pronoun || target.word || pronoun,
        fullForm: target.fullForm || 'is',
        contraction: target.contraction || `${target.pronoun || pronoun}'s`,
        tip: lang === 'ko' ? `${target.pronoun || pronoun} + ${target.fullForm || ''} ??${target.contraction || ''}` : `${target.pronoun || pronoun} + ${target.fullForm || ''} ??${target.contraction || ''}`
      };
    };

    const base = [
      { pronoun: 'I', fallbackFull: 'am', fallbackContract: "I'm" },
      { pronoun: 'You', fallbackFull: 'are', fallbackContract: "You're" },
      { pronoun: 'She', fallbackFull: 'is', fallbackContract: "She's" }
    ];

    return base.map((row) => {
      const match = findEntry(row.pronoun);
      if (match) return match;
      return {
        pronoun: row.pronoun,
        fullForm: row.fallbackFull,
        contraction: row.fallbackContract,
        tip: lang === 'ko'
          ? `${row.pronoun} + ${row.fallbackFull} ??${row.fallbackContract}`
          : `${row.pronoun} + ${row.fallbackFull} ??${row.fallbackContract}`
      };
    });
  }
}

const fallbackItems = [
  { id: 'i_am', word: 'I', pronoun: 'I', fullForm: 'am', contraction: "I'm", exampleSentence: "I'm ready to go!", exampleSentenceKo: "저는 갈 준비가 되었어요!", explanation: "I am becomes I'm." },
  { id: 'you_are', word: 'You', pronoun: 'You', fullForm: 'are', contraction: "You're", exampleSentence: "You're a great friend.", exampleSentenceKo: "당신은 훌륭한 친구예요.", explanation: "You are becomes You're." },
  { id: 'she_is', word: 'She', pronoun: 'She', fullForm: 'is', contraction: "She's", exampleSentence: "She's playing piano.", exampleSentenceKo: "그녀는 피아노를 연주하고 있어요.", explanation: "She is becomes She's." },
  { id: 'he_is', word: 'He', pronoun: 'He', fullForm: 'is', contraction: "He's", exampleSentence: "He's my teacher.", exampleSentenceKo: "그는 제 선생님이에요.", explanation: "He is becomes He's." },
  { id: 'it_is', word: 'It', pronoun: 'It', fullForm: 'is', contraction: "It's", exampleSentence: "It's sunny outside.", exampleSentenceKo: "밖이 화창해요.", explanation: "It is becomes It's." },
  { id: 'we_are', word: 'We', pronoun: 'We', fullForm: 'are', contraction: "We're", exampleSentence: "We're ready to learn.", exampleSentenceKo: "우리는 배울 준비가 되었어요.", explanation: "We are becomes We're." },
  { id: 'they_are', word: 'They', pronoun: 'They', fullForm: 'are', contraction: "They're", exampleSentence: "They're playing soccer.", exampleSentenceKo: "그들은 축구를 하고 있어요.", explanation: "They are becomes They're." }
];

function detectLang() {
  try {
    const stored = localStorage.getItem('userLang');
    if (stored) return stored.toLowerCase();
  } catch {}
  const navLang = (navigator.language || navigator.userLanguage || 'en').toLowerCase();
  return navLang.slice(0, 2);
}

function ensureBaseStyles() {
  if (document.getElementById('wa-lesson-base-styles')) return;
  const st = document.createElement('style');
  st.id = 'wa-lesson-base-styles';
  st.textContent = `
    #gameArea .lesson-stage{display:flex;flex-direction:column;align-items:center;gap:clamp(12px,3.5vmin,28px);padding:clamp(14px,3.6vmin,28px);max-width:820px;margin:0 auto;height:100%;box-sizing:border-box;background:linear-gradient(180deg,#f8feff 0%,#ffffff 60%);font-family:'Poppins','Noto Sans KR','Nanum Gothic','Apple SD Gothic Neo','Malgun Gothic',system-ui,Arial,sans-serif}
    #gameArea .lesson-topbar{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px}
    #gameArea .lesson-title{font-weight:800;color:#19777e;font-size:clamp(1.2rem,3.6vmin,1.8rem)}
    #gameArea .lesson-progress{font-size:.95rem;color:#6b7c87;font-weight:600}
    #gameArea .lesson-step{opacity:0;transform:translateY(8px);transition:opacity .22s ease,transform .22s ease;width:100%}
    #gameArea .lesson-step.enter{opacity:1;transform:translateY(0)}
    #gameArea .lesson-body{text-align:center;font-size:clamp(1.05rem,3.2vmin,1.22rem);line-height:1.5;color:#28323b;margin-bottom:18px}
    #gameArea .lesson-nav{margin-top:18px;display:flex;justify-content:center;gap:12px;flex-wrap:wrap}
    #gameArea .lesson-btn{appearance:none;border:2px solid #21b3be;background:#fff;color:#21b3be;border-radius:12px;padding:10px 18px;font-weight:800;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,.06);transition:transform .15s ease, box-shadow .15s ease}
    #gameArea .lesson-btn:hover{transform:translateY(-2px);box-shadow:0 6px 16px rgba(33,181,192,0.18)}
    #gameArea .lesson-btn.primary{background:#21b3be;color:#fff;border-color:#21b3be}
    #gameArea .lesson-examples{display:grid;grid-template-columns:1fr;gap:12px;width:100%;max-width:620px;margin:10px auto}
    @media (min-width:660px){#gameArea .lesson-examples{grid-template-columns:1fr 1fr}}
    #gameArea .lesson-example{border:2px solid #d1e6f0;border-radius:14px;padding:12px;background:#fff;box-shadow:0 2px 6px rgba(0,0,0,.05)}
    #gameArea .lesson-example strong{color:#19777e}
  `;
  document.head.appendChild(st);
}

function ensureContractionsStyles() {
  if (document.getElementById('wa-lesson-contractions-styles')) return;
  const st = document.createElement('style');
  st.id = 'wa-lesson-contractions-styles';
  st.textContent = `
    #gameArea .contractions-lesson .lesson-btn{color:#ff6fb0;border-color:#21b3be;background:#fff}
    #gameArea .contractions-lesson .lesson-btn.primary{color:#ffffff;background:#21b3be}
    #gameArea .slider-demo-container{display:flex;flex-direction:column;gap:26px;width:100%;max-width:720px;margin:0 auto}
    #gameArea .slider-demo-item{display:flex;flex-direction:column;gap:16px;border:2px solid rgba(33,179,190,0.24);border-radius:16px;padding:20px;background:linear-gradient(180deg,#fbffff 0%,#ffffff 100%);box-shadow:0 2px 8px rgba(0,0,0,.05)}
    #gameArea .slider-demo-label{font-size:1.1rem;font-weight:800;color:#19777e;text-align:center}
    #gameArea .slider-demo-display{display:flex;align-items:center;justify-content:center;gap:18px;font-size:1.3rem;font-weight:800;color:#27323a;position:relative;min-height:80px}
    #gameArea .slider-push{display:flex;align-items:center;gap:28px;transition:gap .12s ease,opacity .2s ease}
    #gameArea .slider-part{display:inline-flex;align-items:center;justify-content:center;padding:6px 16px;border-radius:999px;border:2px solid #21b3be;color:#21b3be;background:#fff;font-size:1.1rem;font-weight:700;min-width:54px;text-transform:none;transition:opacity .2s ease}
    #gameArea .slider-part.verb{color:#ff6fb0;border-color:#ff8cbf}
    #gameArea .slider-separator{color:#b0bcc8;font-size:1.5rem;transition:opacity .2s ease}
    #gameArea .slider-contraction{position:absolute;left:50%;transform:translateX(-50%) scale(0.9);color:#ff6fb0;font-size:1.4rem;font-weight:800;transition:opacity .2s ease,transform .2s ease}
    #gameArea .slider-range-wrap{width:100%}
    #gameArea .slider-range{width:100%;-webkit-appearance:none;height:12px;border-radius:999px;background:linear-gradient(90deg,#21b3be 0%,#e0e0e0 0%,#e0e0e0 100%);outline:none;border:2px solid #21b3be;cursor:pointer;transition:box-shadow .15s ease}
    #gameArea .slider-range:hover{box-shadow:0 6px 16px rgba(33,179,190,0.2)}
    #gameArea .slider-range::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:26px;height:26px;border-radius:50%;background:#ff6fb0;border:3px solid #ffffff;box-shadow:0 4px 12px rgba(255,111,176,0.35);cursor:pointer}
    #gameArea .slider-range::-moz-range-thumb{width:26px;height:26px;border-radius:50%;background:#ff6fb0;border:3px solid #ffffff;box-shadow:0 4px 12px rgba(255,111,176,0.35);cursor:pointer}
    #gameArea .slider-tip{font-size:0.95rem;color:#6b7c87;text-align:center}
    #gameArea .match-status{font-size:clamp(0.95rem,3vmin,1.08rem);color:#6b7c87;font-weight:600;text-align:center;margin-bottom:16px;transition:color .18s ease,transform .18s ease}
    #gameArea .match-status.success{color:#21b3be;transform:scale(1.02)}
    #gameArea .match-status.error{color:#e53935;transform:scale(1.02)}
    #gameArea .contractions-match{display:flex;flex-direction:column;gap:18px;width:100%;max-width:720px;margin:0 auto}
    @media (min-width:680px){#gameArea .contractions-match{flex-direction:row;align-items:flex-start;gap:22px}}
    #gameArea .match-column{flex:1;border:2px solid rgba(33,179,190,0.24);border-radius:16px;padding:16px;background:#ffffff;box-shadow:0 2px 8px rgba(0,0,0,0.05);display:flex;flex-direction:column;gap:12px}
    #gameArea .match-column h4{margin:0;font-size:1.05rem;color:#19777e;text-align:center}
  #gameArea .match-list{display:flex;flex-direction:row;flex-wrap:wrap;gap:10px;justify-content:center}
    #gameArea .match-chip{appearance:none;border:2px solid #21b3be;background:#fff;color:#ff6fb0;font-weight:800;font-size:1.05rem;padding:10px 14px;border-radius:999px;cursor:pointer;transition:transform .15s ease,box-shadow .15s ease,background .15s ease}
    #gameArea .match-chip:hover{transform:translateY(-2px);box-shadow:0 6px 16px rgba(33,179,190,0.2)}
    #gameArea .match-chip.active{background:#21b3be;color:#ffffff;box-shadow:0 10px 22px rgba(33,179,190,0.26)}
    #gameArea .match-chip.matched{background:#e8f5e9;color:#2e7d32;border-color:#4caf50;cursor:default;box-shadow:none}
    #gameArea .match-chip.wrong{background:#ffebee;color:#c62828;border-color:#e53935}
    #gameArea .lesson-nav .lesson-btn.disabled{opacity:0.45;pointer-events:none}
  `;
  document.head.appendChild(st);
}
