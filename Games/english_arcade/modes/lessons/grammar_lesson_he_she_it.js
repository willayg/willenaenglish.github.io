// Grammar Lesson Runner ??He vs She vs It
// Interactive lesson teaching pronoun usage for males, females, and objects/animals.

import { startSession, endSession } from '../../../../students/records.js';

export async function runGrammarLessonHeShelt(ctx = {}) {
  const { grammarFile, grammarName, playSFX, inlineToast } = ctx;
  const root = document.getElementById('gameArea');
  if (!root) return;

  ensureBaseStyles();
  ensureHeSheltStyles();

  let items = [];
  try {
    if (!grammarFile) throw new Error('No grammar file provided');
    const res = await fetch(grammarFile, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to load ${grammarFile}`);
    const data = await res.json();
    if (Array.isArray(data)) items = data;
  } catch (err) {
    console.warn('[lesson-he-she-it] failed to load list', err);
  }

  const heList = normalizeList(items.filter((it) => isPronoun(it, 'he')), fallbackHe);
  const sheList = normalizeList(items.filter((it) => isPronoun(it, 'she')), fallbackShe);
  const itList = normalizeList(items.filter((it) => isPronoun(it, 'it')), fallbackIt);
  const sortingPool = buildSortingPool(heList, sheList, itList);

  const sessionWords = items.map((it) => it?.word).filter(Boolean).slice(0, 30);
  let sessionId = null;
  let sessionClosed = false;
  try {
    sessionId = startSession({
      mode: 'grammar_lesson_he_she_it',
      wordList: sessionWords,
      listName: grammarFile || grammarName || null,
      meta: { category: 'grammar', file: grammarFile, lesson: grammarName || 'He vs She vs It', level: 'Level 1 Grammar' }
    });
  } catch (err) {
    console.debug('[HeSheltLesson] startSession failed', err?.message);
  }

  let lang = detectLang();
  lang = (lang === 'ko' || lang === 'kr') ? 'ko' : 'en';
  let stepIndex = 0;

  render();

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
    title.textContent = grammarName || 'He vs She vs It';
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
      ? "<b>He</b>는 남성을, <b>She</b>는 여성을, <b>It</b>는 동물이나 사물에 씁니다. 버튼을 탭해서 예문을 확인하세요!"
      : "Use <b>he</b> for males, <b>she</b> for females, and <b>it</b> for animals or objects. Tap each button to see examples!";

    const pronounRow = document.createElement('div');
    pronounRow.className = 'pronoun-subject-row';

    const cardDisplay = document.createElement('div');
    cardDisplay.className = 'pronoun-highlight-card';

    const pronounSets = buildPronounSets(heList, sheList, itList);
    let current = null;
    let currentPronoun = 'he';
    let hePointer = 0;
    let shePointer = 0;
    let itPointer = 0;

    const renderCard = (set, advance) => {
      if (!set) return;
      current = set;
      currentPronoun = set.id;
      
      // Advance to next example if requested
      if (advance) {
        if (set.id === 'he') {
          hePointer = (hePointer + 1) % heList.length;
          const nextExample = heList[hePointer];
          set.sentenceEn = nextExample.exampleSentence || set.sentenceEn;
          set.sentenceKo = nextExample.exampleSentenceKo || set.sentenceKo;
          set.emoji = nextExample.emoji || set.emoji;
        } else if (set.id === 'she') {
          shePointer = (shePointer + 1) % sheList.length;
          const nextExample = sheList[shePointer];
          set.sentenceEn = nextExample.exampleSentence || set.sentenceEn;
          set.sentenceKo = nextExample.exampleSentenceKo || set.sentenceKo;
          set.emoji = nextExample.emoji || set.emoji;
        } else if (set.id === 'it') {
          itPointer = (itPointer + 1) % itList.length;
          const nextExample = itList[itPointer];
          set.sentenceEn = nextExample.exampleSentence || set.sentenceEn;
          set.sentenceKo = nextExample.exampleSentenceKo || set.sentenceKo;
          set.emoji = nextExample.emoji || set.emoji;
        }
      }
      
      pronounRow.querySelectorAll('button').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.id === set.id);
      });
      cardDisplay.innerHTML = `
        <div class="pronoun-label">${set.pronoun.toUpperCase()}</div>
        <div class="pronoun-emoji">${set.emoji}</div>
        <div class="pronoun-sentence">${escapeHtml(set.sentenceEn)}</div>
        ${lang === 'ko' ? `<div class="pronoun-sentence-ko">${escapeHtml(set.sentenceKo)}</div>` : ''}
        <div class="pronoun-tip">${escapeHtml(lang === 'ko' ? set.tipKo : set.tipEn)}</div>
      `;
    };

    pronounSets.forEach((set) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.id = set.id;
      btn.textContent = set.label;
      btn.onclick = () => {
        playSFX?.('click');
        renderCard(set, false);
      };
      pronounRow.appendChild(btn);
    });

    intro.appendChild(pronounRow);
    intro.appendChild(cardDisplay);
    stepEl.appendChild(intro);

    renderCard(pronounSets[0], false);

    // Add "Next Example" button
    const nextExampleBtn = buildSecondaryButton(lang === 'ko' ? '다음 예시' : 'Next Example');
    nextExampleBtn.style.marginTop = '18px';
    nextExampleBtn.style.display = 'block';
    nextExampleBtn.style.margin = '18px auto 0 auto';
    nextExampleBtn.onclick = () => {
      playSFX?.('click');
      const currentSet = pronounSets.find((s) => s.id === currentPronoun);
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
      ? "<b>남성</b>은 <b>he</b>, <b>여성</b>은 <b>she</b>, <b>동물/사물</b>은 <b>it</b>입니다. 버튼을 탭해서 더 많은 예문을 확인하세요!"
      : "<b>Males</b> ??<b>he</b><br/><b>Females</b> ??<b>she</b><br/><b>Animals/Objects</b> ??<b>it</b><br/>Tap each button to see more examples!";

    const categoryRow = document.createElement('div');
    categoryRow.className = 'pronoun-subject-row';

    const cardDisplay = document.createElement('div');
    cardDisplay.className = 'pronoun-highlight-card';

    const categorySets = [
      {
        id: 'male',
        label: lang === 'ko' ? '남성' : 'Male',
        examples: heList,
        pointer: 0,
        pronoun: 'HE',
      },
      {
        id: 'female',
        label: lang === 'ko' ? '여성' : 'Female',
        examples: sheList,
        pointer: 0,
        pronoun: 'SHE',
      },
      {
        id: 'thing',
        label: lang === 'ko' ? '동물/사물' : 'Animal/Thing',
        examples: itList,
        pointer: 0,
        pronoun: 'IT',
      }
    ];

    let currentCategory = 'male';
    let malePointer = 0;
    let femalePointer = 0;
    let thingPointer = 0;

    const renderCard = (categoryId, advance) => {
      const set = categorySets.find((s) => s.id === categoryId);
      if (!set || !set.examples.length) return;
      
      currentCategory = categoryId;

      // Advance to next example if requested
      if (advance) {
        if (categoryId === 'male') {
          malePointer = (malePointer + 1) % set.examples.length;
        } else if (categoryId === 'female') {
          femalePointer = (femalePointer + 1) % set.examples.length;
        } else {
          thingPointer = (thingPointer + 1) % set.examples.length;
        }
      }

      let pointer;
      if (categoryId === 'male') pointer = malePointer;
      else if (categoryId === 'female') pointer = femalePointer;
      else pointer = thingPointer;

      const example = set.examples[pointer];

      categoryRow.querySelectorAll('button').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.id === categoryId);
      });

      cardDisplay.innerHTML = `
        <div class="pronoun-label">${set.pronoun}</div>
        <div class="pronoun-emoji">${example.emoji}</div>
        <div class="pronoun-sentence">${escapeHtml(example.exampleSentence)}</div>
        ${lang === 'ko' ? `<div class="pronoun-sentence-ko">${escapeHtml(example.exampleSentenceKo)}</div>` : ''}
        <div class="pronoun-tip">${escapeHtml(example.explanation || (lang === 'ko' ? example.explanationKo : example.explanation) || '')}</div>
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

    renderCard('male', false);

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
      ? '단어를 탭하여 올바른 바구니에 넣어보세요!'
      : 'Tap each word and place it in the correct basket!';
    stepEl.appendChild(intro);

    // Create chips container above buckets
    const chipsContainer = document.createElement('div');
    chipsContainer.className = 'sorting-chips-container';
    chipsContainer.style.cssText = 'display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin:20px 0;';
    
    const buckets = document.createElement('div');
    buckets.className = 'buckets buckets-three';
    const heBucket = makeBucket('he', lang === 'ko' ? '남성(he)' : 'He');
    const sheBucket = makeBucket('she', lang === 'ko' ? '여성(she)' : 'She');
    const itBucket = makeBucket('it', lang === 'ko' ? '동물/사물(it)' : 'It');
    [heBucket.wrap, sheBucket.wrap, itBucket.wrap].forEach((wrap) => buckets.appendChild(wrap));
    
    stepEl.appendChild(chipsContainer);
    stepEl.appendChild(buckets);

    sortingPool.forEach((item) => chipsContainer.appendChild(makeChip(item)));

    let selectedChip = null;
    const clearSelection = () => {
      stepEl.querySelectorAll('.chip.selected').forEach((chip) => chip.classList.remove('selected'));
      selectedChip = null;
    };

    stepEl.addEventListener('click', (evt) => {
      const chip = evt.target.closest('.chip');
      if (!chip) return;

      // If chip is in a bucket, return it to the chips container
      if (!chipsContainer.contains(chip)) {
        playSFX?.('click');
        chip.classList.remove('selected', 'good', 'bad');
        chipsContainer.appendChild(chip);
        clearSelection();
        return;
      }

      // Toggle selection for chips in the container
      if (selectedChip === chip) {
        chip.classList.toggle('selected');
        selectedChip = chip.classList.contains('selected') ? chip : null;
      } else {
        clearSelection();
        chip.classList.add('selected');
        selectedChip = chip;
      }
    });

    [heBucket.wrap, sheBucket.wrap, itBucket.wrap].forEach((wrap) => {
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
        he: new Set(sortingPool.filter((item) => item.answer === 'he').map((item) => item.id)),
        she: new Set(sortingPool.filter((item) => item.answer === 'she').map((item) => item.id)),
        it: new Set(sortingPool.filter((item) => item.answer === 'it').map((item) => item.id)),
      };

      stepEl.querySelectorAll('.chip').forEach((chip) => chip.classList.remove('good', 'bad'));

      const markBucket = (bucketBody, key) => {
        bucketBody.querySelectorAll('.chip').forEach((chip) => {
          const ok = answers[key].has(chip.dataset.id);
          chip.classList.add(ok ? 'good' : 'bad');
        });
      };

      markBucket(heBucket.body, 'he');
      markBucket(sheBucket.body, 'she');
      markBucket(itBucket.body, 'it');

      const leftovers = chipsContainer.querySelectorAll('.chip').length;
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
        message.textContent = lang === 'ko' ? '완벽해요! he/she/it을 올바르게 사용했어요.' : 'Perfect! You used he/she/it correctly.';
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
        message.textContent = lang === 'ko' ? '다시 시도하세요! 빨간 단어를 수정하세요.' : 'Try again! Fix the red words.';
        stepEl.insertBefore(message, stepEl.firstChild);
      }
    };
  }

  function renderFinishStep(stepEl) {
    stepEl.innerHTML = '';

    const body = document.createElement('div');
    body.className = 'lesson-body';
    body.innerHTML = (lang === 'ko')
      ? '<div style="font-weight:800;color:#19777e">축하합니다! 이제 he, she, it을 언제 쓰는지 알게 되었어요!</div><div class="stars">⭐⭐⭐⭐⭐</div>'
      : '<div style="font-weight:800;color:#19777e">You now know when to use he, she, or it!</div><div class="stars">⭐⭐⭐⭐⭐</div>';
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
          mode: 'grammar_lesson_he_she_it',
          summary: {
            score: 1,
            total: 1,
            correct: 1,
            pct: 100,
            accuracy: 100,
            category: 'grammar',
            context: 'lesson',
            grammarName: grammarName || 'He vs She vs It',
          },
          listName: grammarFile || grammarName || null,
          wordList: sessionWords,
        });
      } catch (err) {
        console.debug('[HeSheltLesson] endSession failed', err?.message);
      }

      try {
        const ev = new CustomEvent('wa:session-ended', { detail: { summary: { correct: 1, total: 1, grammarName: grammarName || 'He vs She vs It', category: 'grammar' } } });
        window.dispatchEvent(ev);
      } catch {}
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
    @media (min-width:620px){#gameArea .buckets-three{grid-template-columns:repeat(3,1fr)}}
    #gameArea .bucket{border:2px dashed #b0e2e4;border-radius:16px;min-height:120px;background:linear-gradient(180deg,#fbffff 0%,#ffffff 100%);padding:12px;display:flex;flex-direction:column;gap:10px;box-shadow:0 2px 10px rgba(0,0,0,.05)}
    #gameArea .bucket h4{margin:0;font-size:2.2rem;color:#19777e;text-transform:capitalize}
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

function ensureHeSheltStyles() {
  if (document.getElementById('wa-lesson-hesheit-styles')) return;
  const st = document.createElement('style');
  st.id = 'wa-lesson-hesheit-styles';
  st.textContent = `
    #gameArea .pronoun-subject-row{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin:24px 0 12px}
    #gameArea .pronoun-subject-row button{border:2px solid #21b3be;background:#ffffff;color:#21b3be;font-weight:700;padding:10px 18px;border-radius:999px;cursor:pointer;transition:transform .15s ease, box-shadow .15s ease, background .15s ease}
    #gameArea .pronoun-subject-row button:hover{transform:translateY(-2px);box-shadow:0 8px 16px rgba(33,179,190,0.22)}
    #gameArea .pronoun-subject-row button.active{background:#21b3be;color:#ffffff;box-shadow:0 10px 22px rgba(33,179,190,0.28)}
    #gameArea .pronoun-highlight-card{background:#f7feff;border:2px solid rgba(33,179,190,0.28);border-radius:18px;padding:22px 20px;display:flex;flex-direction:column;align-items:center;gap:12px;max-width:420px;margin:0 auto;box-shadow:0 14px 40px -22px rgba(20,126,130,0.45)}
    #gameArea .pronoun-highlight-card .pronoun-label{font-size:0.95rem;font-weight:800;color:#19777e;letter-spacing:0.08em;text-transform:uppercase}
    #gameArea .pronoun-highlight-card .pronoun-emoji{font-size:2.6rem}
    #gameArea .pronoun-highlight-card .pronoun-sentence{font-size:1.12rem;line-height:1.6;color:#27323a;font-weight:600}
    #gameArea .pronoun-highlight-card .pronoun-sentence-ko{font-size:1rem;color:#546070;margin-top:-4px}
    #gameArea .pronoun-highlight-card .pronoun-tip{font-size:0.95rem;color:#546070}
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
  chip.className = 'chip';
  chip.dataset.id = item.id;
  chip.dataset.answer = item.answer;
  chip.textContent = item.text;
  return chip;
}

function buildSortingPool(heList, sheList, itList) {
  // Just pick one example from each category - a boy, a girl, and a dog
  const hePool = shuffle(heList).slice(0, 1).map((item, idx) => ({
    id: item.id || `he_${idx}`,
    answer: 'he',
    text: item.word || 'boy',
  }));
  const shePool = shuffle(sheList).slice(0, 1).map((item, idx) => ({
    id: item.id || `she_${idx}`,
    answer: 'she',
    text: item.word || 'girl',
  }));
  const itPool = shuffle(itList).slice(0, 1).map((item, idx) => ({
    id: item.id || `it_${idx}`,
    answer: 'it',
    text: item.word || 'dog',
  }));
  return shuffle([...hePool, ...shePool, ...itPool]);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildPronounSets(heList, sheList, itList) {
  const pick = (arr, fallback) => arr.length ? arr[0] : fallback;
  const heExample = pick(heList, fallbackHe[0]);
  const sheExample = pick(sheList, fallbackShe[0]);
  const itExample = pick(itList, fallbackIt[0]);
  return [
    {
      id: 'he',
      pronoun: 'he',
      emoji: heExample.emoji || '?',
      sentenceEn: heExample.exampleSentence || 'He is my friend.',
      sentenceKo: heExample.exampleSentenceKo || '그는 내 친구예요.',
      tipEn: "Use 'he' for males (boys, men).",
      tipKo: "남자(소년, 남성)에게는 'he'를 사용해요.",
      label: '? He'
    },
    {
      id: 'she',
      pronoun: 'she',
      emoji: sheExample.emoji || '?',
      sentenceEn: sheExample.exampleSentence || 'She is my sister.',
      sentenceKo: sheExample.exampleSentenceKo || '그녀는 내 여동생이에요.',
      tipEn: "Use 'she' for females (girls, women).",
      tipKo: "여자(소녀, 여성)에게는 'she'를 사용해요.",
      label: '? She'
    },
    {
      id: 'it',
      pronoun: 'it',
      emoji: itExample.emoji || '?',
      sentenceEn: itExample.exampleSentence || 'It is a dog.',
      sentenceKo: itExample.exampleSentenceKo || '그것은 개예요.',
      tipEn: "Use 'it' for animals and objects.",
      tipKo: "동물이나 사물에는 'it'를 사용해요.",
      label: '? It'
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
    emoji: item.emoji || '❓',
  })).filter((item) => item.exampleSentence);
}

function isPronoun(item, target) {
  return String(item?.article || '').toLowerCase() === target;
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
  const stepsKo = ['언어 선택', '1단계', '2단계', '3단계', '완료'];
  const list = (lang === 'ko') ? stepsKo : stepsEn;
  return list[stepIndex] || '';
}

function shuffle(list) {
  return [...(list || [])].sort(() => Math.random() - 0.5);
}

const fallbackHe = [
  { id: 'fb_he_friend', word: 'he', exampleSentence: 'He is my friend.', exampleSentenceKo: '그는 제 친구예요.', emoji: '👦' },
  { id: 'fb_he_teacher', word: 'he', exampleSentence: 'He is a teacher.', exampleSentenceKo: '그는 선생님이에요.', emoji: '👨‍🏫' },
  { id: 'fb_he_brother', word: 'he', exampleSentence: 'He is my brother.', exampleSentenceKo: '그는 제 형이에요.', emoji: '👦' },
  { id: 'fb_he_dad', word: 'he', exampleSentence: 'He is my dad.', exampleSentenceKo: '그는 제 아빠예요.', emoji: '👨' }
];

const fallbackShe = [
  { id: 'fb_she_friend', word: 'she', exampleSentence: 'She is my sister.', exampleSentenceKo: '그녀는 제 언니예요.', emoji: '👧' },
  { id: 'fb_she_teacher', word: 'she', exampleSentence: 'She is a doctor.', exampleSentenceKo: '그녀는 의사예요.', emoji: '👩‍⚕️' },
  { id: 'fb_she_mom', word: 'she', exampleSentence: 'She is my mom.', exampleSentenceKo: '그녀는 제 엄마예요.', emoji: '👩' },
  { id: 'fb_she_like', word: 'she', exampleSentence: 'She likes ice cream.', exampleSentenceKo: '그녀는 아이스크림을 좋아해요.', emoji: '🍨' }
];

const fallbackIt = [
  { id: 'fb_it_dog', word: 'it', exampleSentence: 'It is a dog.', exampleSentenceKo: '그것은 개입니다.', emoji: '🐶' },
  { id: 'fb_it_car', word: 'it', exampleSentence: 'It is a red car.', exampleSentenceKo: '그것은 빨간 자동차예요.', emoji: '🚗' },
  { id: 'fb_it_weather', word: 'it', exampleSentence: 'It is sunny today.', exampleSentenceKo: '오늘은 맑아요.', emoji: '☀️' },
  { id: 'fb_it_phone', word: 'it', exampleSentence: 'It is my phone.', exampleSentenceKo: '그것은 제 전화예요.', emoji: '📱' }
];
}

