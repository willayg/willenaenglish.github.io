// Grammar Lesson Runner ??Can vs Can't
// Interactive lesson teaching ability and inability with can/can't.

import { startSession, endSession } from '../../../../students/records.js';

export async function runGrammarLessonCanCant(ctx = {}) {
  const { grammarFile, grammarName, playSFX, inlineToast } = ctx;
  let root = document.getElementById('gameArea');
  console.debug('[CanCantLesson] start', { grammarFile, grammarName });
  if (!root) {
    console.error('[CanCantLesson] no #gameArea element found - creating fallback container for debugging');
    // Create a fallback container so users see an error message instead of a white screen
    try {
      const fallback = document.createElement('div');
      fallback.id = 'gameArea';
      fallback.style.cssText = 'padding:24px;font-family:Arial,Helvetica,sans-serif;color:#333;background:#fff';
      fallback.innerHTML = '<div style="max-width:720px;margin:20px auto;color:#b00020;font-weight:800;">Lesson failed to start: missing gameArea element. Check console for details.</div>';
      document.body.appendChild(fallback);
      // Re-acquire root reference
      root = document.getElementById('gameArea');
    } catch (err) {
      console.error('[CanCantLesson] creating fallback failed', err);
      return;
    }
  }

  ensureBaseStyles();
  ensureCanCantStyles();

  let items = [];
  try {
    if (!grammarFile) throw new Error('No grammar file provided');
    const res = await fetch(grammarFile, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to load ${grammarFile}`);
    const data = await res.json();
    if (Array.isArray(data)) items = data;
  } catch (err) {
    console.warn('[lesson-can-cant] failed to load list', err);
  }

  const canList = normalizeList(items.filter((it) => isAbility(it, 'can')), fallbackCan);
  const cantList = normalizeList(items.filter((it) => isAbility(it, "can't")), fallbackCant);
  const sortingPool = buildSortingPool(canList, cantList);

  const sessionWords = items.map((it) => it?.word).filter(Boolean).slice(0, 30);
  let sessionId = null;
  let sessionClosed = false;
  try {
    sessionId = startSession({
      mode: 'grammar_lesson_can_cant',
      wordList: sessionWords,
      listName: grammarFile || grammarName || null,
      meta: { category: 'grammar', file: grammarFile, lesson: grammarName || 'Can vs Can\'t', level: 'Level 1 Grammar' }
    });
  } catch (err) {
    console.debug('[CanCantLesson] startSession failed', err?.message);
  }

  let lang = detectLang();
  lang = (lang === 'ko' || lang === 'kr') ? 'ko' : 'en';
  let stepIndex = 0;

  try {
    render();
  } catch (err) {
    console.error('[CanCantLesson] render() threw', err);
    try {
      if (root) root.innerHTML = '<div style="padding:20px;color:#b00020;font-weight:800;">Lesson failed to render. See console for details.</div>';
      if (typeof inlineToast === 'function') inlineToast('Lesson failed to start. Check console.');
    } catch (e) { /* ignore */ }
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
    title.textContent = grammarName || 'Can vs Can\'t';
    const progress = document.createElement('div');
    progress.className = 'lesson-progress';
    progress.textContent = displayStep(stepIndex, lang);
    top.appendChild(title);
    top.appendChild(progress);

    const stepEl = document.createElement('div');
    stepEl.className = 'lesson-step';

    stage.appendChild(top);
    stage.appendChild(stepEl);
    root.appendChild(stage);

    if (stepIndex === 0) renderLanguageStep(stepEl, progress, stage);
    else if (stepIndex === 1) renderExplainStep(stepEl, progress);
    else if (stepIndex === 2) renderExamplesStep(stepEl, progress);
    else if (stepIndex === 3) renderSortingStep(stepEl, progress);
    else renderFinishStep(stepEl);

    requestAnimationFrame(() => stepEl.classList.add('enter'));
  }

  function renderLanguageStep(stepEl, progress, stage) {
    progress.textContent = '';
    stepEl.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:36px;text-align:center;width:90%;max-width:320px;';
    const heading = document.createElement('div');
    heading.style.cssText = 'font-size:clamp(1.4rem,4.5vmin,2rem);font-weight:800;color:#19777e;';
    heading.textContent = (lang === 'ko') ? '언어를 선택하세요' : 'Choose your language';
    const enBtn = buildLanguageButton('English');
    enBtn.onclick = () => { playSFX?.('click'); lang = 'en'; nextStep(); };
    const koBtn = buildLanguageButton('한국어');
    koBtn.onclick = () => { playSFX?.('click'); lang = 'ko'; nextStep(); };
    wrap.appendChild(heading);
    wrap.appendChild(enBtn);
    wrap.appendChild(koBtn);
    stepEl.appendChild(wrap);
  }

  function renderExplainStep(stepEl, progress) {
    progress.textContent = displayStep(1, lang);
    stepEl.innerHTML = '';

    const intro = document.createElement('div');
    intro.className = 'lesson-body';
    intro.innerHTML = lang === 'ko'
      ? "<b>can</b>은 어떤 것을 할 수 있음을 말할 때 사용하고, <b>can't</b>은 할 수 없음을 말할 때 사용합니다. 버튼을 눌러 예시를 보세요!"
      : "Use <b>can</b> to say you are able to do something, and <b>can't</b> to say you are not able. Tap each button to see examples!";

    const abilityRow = document.createElement('div');
    abilityRow.className = 'cancant-subject-row';

    const cardDisplay = document.createElement('div');
    cardDisplay.className = 'cancant-highlight-card';

    const abilitySets = buildAbilitySets(canList, cantList, lang);
    let current = null;
    let currentType = 'can';
    let canPointer = 0;
    let cantPointer = 0;

    const renderCard = (set, advance) => {
      if (!set) return;
      current = set;
      currentType = set.id;
      
      // Advance to next example if requested
      if (advance) {
        if (set.id === 'can') {
          canPointer = (canPointer + 1) % canList.length;
          const nextExample = canList[canPointer];
          set.sentenceEn = nextExample.exampleSentence || set.sentenceEn;
          set.sentenceKo = nextExample.exampleSentenceKo || set.sentenceKo;
          set.emoji = nextExample.emoji || set.emoji;
        } else {
          cantPointer = (cantPointer + 1) % cantList.length;
          const nextExample = cantList[cantPointer];
          set.sentenceEn = nextExample.exampleSentence || set.sentenceEn;
          set.sentenceKo = nextExample.exampleSentenceKo || set.sentenceKo;
          set.emoji = nextExample.emoji || set.emoji;
        }
      }
      
      abilityRow.querySelectorAll('button').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.id === set.id);
      });
      cardDisplay.innerHTML = `
        <div class="ability-label">${set.ability.toUpperCase()}</div>
        <div class="ability-emoji">${set.emoji}</div>
        <div class="ability-sentence">${escapeHtml(set.sentenceEn)}</div>
        ${lang === 'ko' ? `<div class="ability-sentence-ko">${escapeHtml(set.sentenceKo)}</div>` : ''}
        <div class="ability-tip">${escapeHtml(lang === 'ko' ? set.tipKo : set.tipEn)}</div>
      `;
    };

    abilitySets.forEach((set) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.id = set.id;
      btn.textContent = set.label;
      btn.onclick = () => {
        playSFX?.('click');
        renderCard(set, false);
      };
      abilityRow.appendChild(btn);
    });

    intro.appendChild(abilityRow);
    intro.appendChild(cardDisplay);
    stepEl.appendChild(intro);

    renderCard(abilitySets[0], false);

    // Add "Next Example" button
    const nextExampleBtn = buildSecondaryButton(lang === 'ko' ? '다음 예시' : 'Next Example');
    nextExampleBtn.style.marginTop = '18px';
    nextExampleBtn.style.display = 'block';
    nextExampleBtn.style.margin = '18px auto 0 auto';
    nextExampleBtn.onclick = () => {
      playSFX?.('click');
      const currentSet = abilitySets.find((s) => s.id === currentType);
      renderCard(currentSet, true);
    };
    stepEl.appendChild(nextExampleBtn);

    const controls = buildNavRow(() => prevStep(), () => nextStep(), lang);
    stepEl.appendChild(controls);
  }

  function renderExamplesStep(stepEl, progress) {
    progress.textContent = displayStep(2, lang);
    stepEl.innerHTML = '';

    const intro = document.createElement('div');
    intro.className = 'lesson-body';
    intro.innerHTML = lang === 'ko'
      ? "<b>Can</b>은 할 수 있는 것을 말하고<br/><b>Can't</b>은 할 수 없는 것을 말합니다.<br/>버튼을 눌러 더 많은 예시를 보세요!"
      : "<b>Can</b> shows ability.<br/><b>Can't</b> shows inability.<br/>Tap each button to see more examples!";

    const categoryRow = document.createElement('div');
    categoryRow.className = 'cancant-subject-row';

    const cardDisplay = document.createElement('div');
    cardDisplay.className = 'cancant-highlight-card';

    const categorySets = [
      {
        id: 'able',
        label: lang === 'ko' ? '할 수 있어요' : 'Can Do',
        examples: canList,
        pointer: 0,
        ability: 'CAN',
      },
      {
        id: 'unable',
        label: lang === 'ko' ? '할 수 없어요' : 'Cannot Do',
        examples: cantList,
        pointer: 0,
        ability: "CAN'T",
      }
    ];

    let currentCategory = 'able';
    let ablePointer = 0;
    let unablePointer = 0;

    const renderCard = (categoryId, advance) => {
      const set = categorySets.find((s) => s.id === categoryId);
      if (!set || !set.examples.length) return;
      
      currentCategory = categoryId;

      // Advance to next example if requested
      if (advance) {
        if (categoryId === 'able') {
          ablePointer = (ablePointer + 1) % set.examples.length;
        } else {
          unablePointer = (unablePointer + 1) % set.examples.length;
        }
      }

      const pointer = categoryId === 'able' ? ablePointer : unablePointer;
      const example = set.examples[pointer];

      categoryRow.querySelectorAll('button').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.id === categoryId);
      });

      cardDisplay.innerHTML = `
        <div class="ability-label">${set.ability}</div>
        <div class="ability-emoji">${example.emoji}</div>
        <div class="ability-sentence">${escapeHtml(example.exampleSentence)}</div>
        ${lang === 'ko' ? `<div class="ability-sentence-ko">${escapeHtml(example.exampleSentenceKo)}</div>` : ''}
        <div class="ability-tip">${escapeHtml(example.explanation || (lang === 'ko' ? example.explanationKo : example.explanation) || '')}</div>
      `;
    };

    categorySets.forEach((set) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.id = set.id;
      btn.textContent = set.label;
      btn.onclick = () => {
        playSFX?.('click');
        renderCard(set.id, false);
      };
      categoryRow.appendChild(btn);
    });

    intro.appendChild(categoryRow);
    intro.appendChild(cardDisplay);
    stepEl.appendChild(intro);

    renderCard('able', false);

    // Add "Next Example" button
    const nextExampleBtn = buildSecondaryButton(lang === 'ko' ? '다음 예시' : 'Next Example');
    nextExampleBtn.style.marginTop = '18px';
    nextExampleBtn.style.display = 'block';
    nextExampleBtn.style.margin = '18px auto 0 auto';
    nextExampleBtn.onclick = () => {
      playSFX?.('click');
      renderCard(currentCategory, true);
    };
    stepEl.appendChild(nextExampleBtn);

    const controls = buildNavRow(() => prevStep(), () => nextStep(), lang);
    stepEl.appendChild(controls);
  }

  function renderSortingStep(stepEl, progress) {
    progress.textContent = displayStep(3, lang);
    stepEl.innerHTML = '';

    const intro = document.createElement('div');
    intro.className = 'lesson-body';
    intro.innerHTML = (lang === 'ko')
      ? '각 동물을 눌러 <b>날 수 있어요</b> 또는 <b>날 수 없어요</b> 바구니로 옮기세요. 모두 맞히면 다음으로 진행합니다!'
      : 'Tap each animal and move it into the <b>Can Fly</b> or <b>Can\'t Fly</b> basket. Get them all correct to continue!';
    stepEl.appendChild(intro);

    const buckets = document.createElement('div');
    buckets.className = 'buckets buckets-two';
    const pool = makeBucket('pool', lang === 'ko' ? '동물' : 'Animals');
    const canBucket = makeBucket('can', lang === 'ko' ? '날 수 있어요' : 'Can Fly');
    const cantBucket = makeBucket('cant', lang === 'ko' ? '날 수 없어요' : 'Can\'t Fly');
    [pool.wrap, canBucket.wrap, cantBucket.wrap].forEach((wrap) => buckets.appendChild(wrap));
    stepEl.appendChild(buckets);

    sortingPool.forEach((item) => pool.body.appendChild(makeChip(item)));

    let selectedChip = null;
    const clearSelection = () => {
      stepEl.querySelectorAll('.chip.selected').forEach((chip) => chip.classList.remove('selected'));
      selectedChip = null;
    };

    stepEl.addEventListener('click', (evt) => {
      const chip = evt.target.closest('.chip');
      if (!chip) return;

      if (!pool.wrap.contains(chip)) {
        playSFX?.('click');
        chip.classList.remove('selected', 'good', 'bad');
        pool.body.appendChild(chip);
        clearSelection();
        return;
      }

      if (selectedChip === chip) {
        chip.classList.toggle('selected');
        selectedChip = chip.classList.contains('selected') ? chip : null;
      } else {
        clearSelection();
        chip.classList.add('selected');
        selectedChip = chip;
      }
    });

    [canBucket.wrap, cantBucket.wrap].forEach((wrap) => {
      wrap.addEventListener('click', (evt) => {
        if (evt.target.closest('.chip')) return;
        if (!selectedChip) return;
        wrap.querySelector('.bucket-body').appendChild(selectedChip);
        playSFX?.('click');
        clearSelection();
      });
    });

    const checkBtn = buildPrimaryButton(lang === 'ko' ? '정답 확인' : 'Check Answers');
    checkBtn.style.marginTop = '16px';
    stepEl.appendChild(checkBtn);

    const nav = document.createElement('div');
    nav.className = 'lesson-nav';
    const backBtn = buildSecondaryButton(lang === 'ko' ? '뒤로' : 'Back');
    backBtn.onclick = () => prevStep();
    nav.appendChild(backBtn);
    stepEl.appendChild(nav);

    let continueBtn = null;

    checkBtn.onclick = () => {
      const answers = {
        can: new Set(sortingPool.filter((item) => item.answer === 'can').map((item) => item.id)),
        cant: new Set(sortingPool.filter((item) => item.answer === 'cant').map((item) => item.id)),
      };

      stepEl.querySelectorAll('.chip').forEach((chip) => chip.classList.remove('good', 'bad'));

      const markBucket = (bucketBody, key) => {
        bucketBody.querySelectorAll('.chip').forEach((chip) => {
          const ok = answers[key].has(chip.dataset.id);
          chip.classList.add(ok ? 'good' : 'bad');
        });
      };

      markBucket(canBucket.body, 'can');
      markBucket(cantBucket.body, 'cant');

      const leftovers = pool.body.querySelectorAll('.chip').length;
      const wrong = stepEl.querySelectorAll('.chip.bad').length;
      const allPlaced = leftovers === 0;
      const allCorrect = wrong === 0 && allPlaced;

      // Remove any existing message
      const existingMsg = stepEl.querySelector('.completion-message');
      if (existingMsg) existingMsg.remove();

      if (allCorrect) {
        playSFX?.('correct');
        
        // Add message at top
        const message = document.createElement('div');
        message.className = 'completion-message';
        message.style.cssText = 'background:#e8f5e9;border:2px solid #4caf50;border-radius:12px;padding:14px 16px;text-align:center;color:#256029;font-weight:800;margin-bottom:16px;font-size:1.05rem;';
        message.textContent = lang === 'ko' ? '완벽해요! 올바르게 분류했어요.' : 'Perfect! You sorted the flying animals correctly.';
        stepEl.insertBefore(message, stepEl.firstChild);
        
        if (!continueBtn) {
          continueBtn = buildPrimaryButton(lang === 'ko' ? '다음 단계' : 'Next Step');
          continueBtn.onclick = () => nextStep();
          nav.appendChild(continueBtn);
        }
      } else {
        playSFX?.('wrong');
        
        // Add message at top
        const message = document.createElement('div');
        message.className = 'completion-message';
        message.style.cssText = 'background:#ffebee;border:2px solid #f44336;border-radius:12px;padding:14px 16px;text-align:center;color:#b71c1c;font-weight:800;margin-bottom:16px;font-size:1.05rem;';
        message.textContent = lang === 'ko' ? '다시 시도하세요! 빨간 동물들을 고치세요.' : 'Try again! Fix the red animals.';
        stepEl.insertBefore(message, stepEl.firstChild);
      }
    };
  }

  function renderFinishStep(stepEl) {
    stepEl.innerHTML = '';

    const body = document.createElement('div');
    body.className = 'lesson-body';
    body.innerHTML = (lang === 'ko')
      ? '<div style="font-weight:800;color:#19777e">이제 언제 can과 can\'t를 사용하는지 알게 되었어요!</div><div class="stars">⭐⭐⭐⭐⭐</div>'
      : '<div style="font-weight:800;color:#19777e">You now know when to use can or can\'t!</div><div class="stars">⭐⭐⭐⭐⭐</div>';
    stepEl.appendChild(body);

    const nav = document.createElement('div');
    nav.className = 'lesson-nav';
    const backBtn = buildPrimaryButton(lang === 'ko' ? '모드로 돌아가기' : 'Back to Modes');
    backBtn.onclick = () => {
      if (window.WordArcade?.startGrammarModeSelector) {
        window.WordArcade.startGrammarModeSelector();
      } else if (window.WordArcade?.quitToOpening) {
        window.WordArcade.quitToOpening(true);
      }
    };
    nav.appendChild(backBtn);
    stepEl.appendChild(nav);

    if (!sessionClosed) {
      sessionClosed = true;
      try {
        endSession(sessionId, {
          mode: 'grammar_lesson_can_cant',
          summary: {
            score: 1,
            total: 1,
            correct: 1,
            pct: 100,
            accuracy: 100,
            category: 'grammar',
            context: 'lesson',
            grammarName: grammarName || 'Can vs Can\'t',
          },
          listName: grammarFile || grammarName || null,
          wordList: sessionWords,
        });
      } catch (err) {
        console.debug('[CanCantLesson] endSession failed', err?.message);
      }

      try {
        const ev = new CustomEvent('wa:session-ended', { detail: { summary: { correct: 1, total: 1, grammarName: grammarName || 'Can vs Can\'t', category: 'grammar' } } });
        window.dispatchEvent(ev);
      } catch {}
    }
  }

  function nextStep() {
    stepIndex = Math.min(stepIndex + 1, 4);
    render();
  }

  function prevStep() {
    stepIndex = Math.max(stepIndex - 1, 0);
    render();
  }
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
    #gameArea .buckets{display:grid;grid-template-columns:1fr;gap:14px;margin-top:18px;width:100%;max-width:820px}
    @media (min-width:720px){#gameArea .buckets-two{grid-template-columns:1fr 1fr}}
    #gameArea .bucket{border:2px dashed #b0e2e4;border-radius:16px;min-height:120px;background:linear-gradient(180deg,#fbffff 0%,#ffffff 100%);padding:12px;display:flex;flex-direction:column;gap:10px;box-shadow:0 2px 10px rgba(0,0,0,.05)}
    #gameArea .bucket h4{margin:0;font-size:1.05rem;color:#19777e;text-transform:capitalize}
    #gameArea .bucket-body{display:flex;flex-wrap:wrap;gap:8px;min-height:52px}
    #gameArea .chip{user-select:none;border:2px solid #93cbcf;background:#ffffff;color:#ff6fb0;border-radius:9999px;padding:10px 12px;font-weight:800;cursor:pointer;text-align:center;box-shadow:0 2px 6px rgba(0,0,0,.06);transition:transform .12s ease, box-shadow .12s ease}
    #gameArea .chip:hover{transform:scale(1.04);box-shadow:0 6px 16px rgba(0,0,0,.12)}
    #gameArea .chip.selected{outline:3px solid #21b3be;border-color:#21b3be}
    #gameArea .chip.good{border-color:#4caf50;color:#256029;background:#e8f5e9}
    #gameArea .chip.bad{border-color:#f44336;color:#b71c1c;background:#ffebee}
    #gameArea .stars{font-size:clamp(1.6rem,6vmin,2.2rem);line-height:1;margin-top:18px}
  `;
  document.head.appendChild(st);
}

function ensureCanCantStyles() {
  if (document.getElementById('wa-lesson-cancant-styles')) return;
  const st = document.createElement('style');
  st.id = 'wa-lesson-cancant-styles';
  st.textContent = `
    #gameArea .cancant-subject-row{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin:24px 0 12px}
    #gameArea .cancant-subject-row button{border:2px solid #21b3be;background:#ffffff;color:#21b3be;font-weight:700;padding:10px 18px;border-radius:999px;cursor:pointer;transition:transform .15s ease, box-shadow .15s ease, background .15s ease}
    #gameArea .cancant-subject-row button:hover{transform:translateY(-2px);box-shadow:0 8px 16px rgba(33,179,190,0.22)}
    #gameArea .cancant-subject-row button.active{background:#21b3be;color:#ffffff;box-shadow:0 10px 22px rgba(33,179,190,0.28)}
    #gameArea .cancant-highlight-card{background:#f7feff;border:2px solid rgba(33,179,190,0.28);border-radius:18px;padding:22px 20px;display:flex;flex-direction:column;align-items:center;gap:12px;max-width:420px;margin:0 auto;box-shadow:0 14px 40px -22px rgba(20,126,130,0.45)}
    #gameArea .cancant-highlight-card .ability-label{font-size:0.95rem;font-weight:800;color:#19777e;letter-spacing:0.08em;text-transform:uppercase}
    #gameArea .cancant-highlight-card .ability-emoji{font-size:2.6rem}
    #gameArea .cancant-highlight-card .ability-sentence{font-size:1.12rem;line-height:1.6;color:#27323a;font-weight:600}
    #gameArea .cancant-highlight-card .ability-sentence-ko{font-size:1rem;color:#546070;margin-top:-4px}
    #gameArea .cancant-highlight-card .ability-tip{font-size:0.95rem;color:#546070}
    #gameArea .chip.animal-chip{font-size:2.2rem;padding:14px 18px;min-width:60px}
  `;
  document.head.appendChild(st);
}

function makeBucket(id, title) {
  const wrap = document.createElement('div');
  wrap.className = 'bucket';
  wrap.dataset.bucket = id;
  const header = document.createElement('h4');
  header.textContent = title;
  const body = document.createElement('div');
  body.className = 'bucket-body';
  wrap.appendChild(header);
  wrap.appendChild(body);
  return { wrap, body };
}

function makeChip(item) {
  const chip = document.createElement('div');
  chip.className = 'chip animal-chip';
  chip.dataset.id = item.id;
  chip.dataset.answer = item.answer;
  chip.textContent = item.text;
  chip.title = item.name || ''; // Show name on hover
  return chip;
}

function buildSortingPool(canList, cantList) {
  // Fixed animals - 4 that can fly, 4 that can't
  const flyingAnimals = [
    { id: 'bird', answer: 'can', text: '🐦', name: 'Bird' },
    { id: 'owl', answer: 'can', text: '🦉', name: 'Owl' },
    { id: 'eagle', answer: 'can', text: '🦅', name: 'Eagle' },
    { id: 'bat', answer: 'can', text: '🦇', name: 'Bat' }
  ];
  
  const nonFlyingAnimals = [
    { id: 'tiger', answer: 'cant', text: '🐯', name: 'Tiger' },
    { id: 'wolf', answer: 'cant', text: '🐺', name: 'Wolf' },
    { id: 'cat', answer: 'cant', text: '🐱', name: 'Cat' },
    { id: 'elephant', answer: 'cant', text: '🐘', name: 'Elephant' }
  ];
  
  return shuffle([...flyingAnimals, ...nonFlyingAnimals]);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildAbilitySets(canList, cantList, lang) {
  const pick = (arr, fallback) => arr.length ? arr[0] : fallback;
  const canExample = pick(canList, fallbackCan[0]);
  const cantExample = pick(cantList, fallbackCant[0]);
  return [
    {
      id: 'can',
      ability: 'can',
      emoji: canExample.emoji || '🏊‍♂️',
      sentenceEn: canExample.exampleSentence || 'I can swim.',
      sentenceKo: canExample.exampleSentenceKo || '저는 수영할 수 있어요.',
      tipEn: "Use 'can' to show ability.",
      tipKo: "'can'은 능력을 나타낼 때 사용합니다.",
      label: lang === 'ko' ? '할 수 있어요' : 'Can'
    },
    {
      id: 'cant',
      ability: 'can\'t',
      emoji: cantExample.emoji || '🦇',
      sentenceEn: cantExample.exampleSentence || 'I can\'t fly.',
      sentenceKo: cantExample.exampleSentenceKo || '저는 날 수 없어요.',
      tipEn: "Use 'can't' to show inability.",
      tipKo: "'can't'는 할 수 없음을 나타낼 때 사용합니다.",
      label: lang === 'ko' ? '할 수 없어요' : "Can't"
    }
  ];
}

function normalizeList(list, fallback) {
  if (!Array.isArray(list) || !list.length) return fallback;
  return list.map((item, idx) => ({
    id: item.id || `${item.word || 'entry'}_${idx}`,
    word: item.word || '',
    exampleSentence: item.exampleSentence || '',
    exampleSentenceKo: item.exampleSentenceKo || '',
    explanation: item.explanation || '',
    explanationKo: item.explanationKo || '',
    emoji: item.emoji || '?',
  })).filter((item) => item.exampleSentence);
}

function isAbility(item, target) {
  return String(item?.article || '').toLowerCase() === target.toLowerCase();
}

function buildLanguageButton(text) {
  const btn = document.createElement('button');
  btn.textContent = text;
  btn.style.cssText = 'width:100%;border:3px solid #21b3be;background:#fff;color:#ff6fb0;border-radius:14px;padding:14px 28px;font-weight:800;cursor:pointer;font-size:1.3rem;transition:transform .15s ease, box-shadow .15s ease;box-shadow:0 2px 8px rgba(0,0,0,.06);font-family:\'Poppins\', Arial, sans-serif;';
  btn.onmouseenter = () => { btn.style.transform = 'translateY(-2px)'; btn.style.boxShadow = '0 6px 16px rgba(33,181,192,0.2)'; };
  btn.onmouseleave = () => { btn.style.transform = 'translateY(0)'; btn.style.boxShadow = '0 2px 8px rgba(0,0,0,.06)'; };
  return btn;
}

function buildPrimaryButton(text) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'lesson-btn primary';
  btn.textContent = text;
  return btn;
}

function buildSecondaryButton(text) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'lesson-btn';
  btn.textContent = text;
  return btn;
}

function buildNavRow(onBack, onNext, lang) {
  const nav = document.createElement('div');
  nav.className = 'lesson-nav';
  const backBtn = buildSecondaryButton(lang === 'ko' ? '뒤로' : 'Back');
  backBtn.onclick = () => onBack();
  const nextBtn = buildPrimaryButton(lang === 'ko' ? '다음' : 'Next');
  nextBtn.onclick = () => onNext();
  nav.appendChild(backBtn);
  nav.appendChild(nextBtn);
  return nav;
}

function detectLang() {
  try {
    if (window.StudentLang && typeof window.StudentLang.getCurrentLang === 'function') {
      return window.StudentLang.getCurrentLang();
    }
    if (navigator.languages && navigator.languages.length) return navigator.languages[0];
    return navigator.language || 'en';
  } catch {
    return 'en';
  }
}

function displayStep(stepIndex, lang) {
  const stepsEn = ['Language', 'Step 1', 'Step 2', 'Step 3', 'Complete'];
  const stepsKo = ['언어', '1단계', '2단계', '3단계', '완료'];
  const list = (lang === 'ko') ? stepsKo : stepsEn;
  return list[stepIndex] || '';
}

function shuffle(list) {
  return [...(list || [])].sort(() => Math.random() - 0.5);
}

const fallbackCan = [
  { id: 'fb_can_swim', word: 'I', exampleSentence: 'I can swim.', exampleSentenceKo: '저는 수영할 수 있어요.', emoji: '🏊‍♀️' },
  { id: 'fb_can_read', word: 'You', exampleSentence: 'You can read.', exampleSentenceKo: '당신은 읽을 수 있어요.', emoji: '📖' },
  { id: 'fb_can_play', word: 'We', exampleSentence: 'We can play.', exampleSentenceKo: '우리는 놀 수 있어요.', emoji: '⚽' },
  { id: 'fb_can_help', word: 'He', exampleSentence: 'He can help.', exampleSentenceKo: '그는 도와줄 수 있어요.', emoji: '🤝' }
];

const fallbackCant = [
  { id: 'fb_cant_swim', word: 'He', exampleSentence: 'He can\'t swim.', exampleSentenceKo: '그는 수영할 수 없어요.', emoji: '🏊‍♂️' },
  { id: 'fb_cant_fly', word: 'I', exampleSentence: 'I can\'t fly.', exampleSentenceKo: '저는 날 수 없어요.', emoji: '✈️' },
  { id: 'fb_cant_drive', word: 'She', exampleSentence: 'She can\'t drive.', exampleSentenceKo: '그녀는 운전할 수 없어요.', emoji: '🚗' },
  { id: 'fb_cant_lift', word: 'They', exampleSentence: 'They can\'t lift it.', exampleSentenceKo: '그들은 그것을 들 수 없어요.', emoji: '🏋️' }
];
