// Grammar Lesson Runner – Have vs. Has
// Lightweight lesson that explains verb agreement for possession.

import { startSession, endSession } from '../../../students/records.js';
import { openNowLoadingSplash } from './unscramble_splash.js';

export async function runGrammarLessonHaveHas(ctx = {}) {
  const { grammarFile, grammarName, playSFX, inlineToast } = ctx;
  const root = document.getElementById('gameArea');
  if (!root) return;

  ensureBaseStyles();
  ensureHaveHasStyles();

  let items = [];
  // Show loading splash while fetching lesson data
  let splashController = null;
  try { splashController = openNowLoadingSplash(document.body, { text: (grammarName ? `${grammarName} — now loading` : 'now loading') }); if (splashController && splashController.readyPromise) await splashController.readyPromise; } catch(e){ console.debug('[HaveHasLesson] splash failed', e?.message); }

  try {
    if (!grammarFile) throw new Error('No grammar file provided');
    const res = await fetch(grammarFile, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to load ${grammarFile}`);
    const data = await res.json();
    if (Array.isArray(data)) items = data;
  } catch (err) {
    console.warn('[lesson-have-has] failed to load list', err);
    if (splashController && typeof splashController.hide === 'function') try { splashController.hide(); } catch {}
  }

  const haveList = normalizeList(items.filter((it) => isVerb(it, 'have')), fallbackHave);
  const hasList = normalizeList(items.filter((it) => isVerb(it, 'has')), fallbackHas);
  const sortingPool = buildSortingPool(haveList, hasList);

  const sessionWords = items.map((it) => it?.word).filter(Boolean).slice(0, 30);
  let sessionId = null;
  let sessionClosed = false;
  try {
    sessionId = startSession({
      mode: 'grammar_lesson_have_has',
      wordList: sessionWords,
      // Use grammarFile path for session tracking to match homework assignment list_key
      listName: grammarFile || grammarName || null,
      meta: { category: 'grammar', file: grammarFile, lesson: grammarName || 'Have vs Has', level: 'Level 1 Grammar' }
    });
  } catch (err) {
    console.debug('[HaveHasLesson] startSession failed', err?.message);
  }

  let lang = detectLang();
  lang = (lang === 'ko' || lang === 'kr') ? 'ko' : 'en';
  let stepIndex = 0;

  render();
  // Hide splash after initial render
  try { if (splashController && typeof splashController.hide === 'function') setTimeout(()=>{ try{ splashController.hide(); }catch{} }, 520); } catch(e){}

  function render() {
    root.innerHTML = '';
    const stage = document.createElement('div');
    stage.className = 'lesson-stage';

    const top = document.createElement('div');
    top.className = 'lesson-topbar';
    const title = document.createElement('div');
    title.className = 'lesson-title';
    title.textContent = grammarName || 'Have vs. Has';
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
      ? "주어에 따라 <b>have</b> (가지다), <b>has</b> (가지다)가 바뀌어요. 버튼을 눌러서 어떤 말을 쓰는지 확인해 보세요!"
      : "The verb <b>have</b> or <b>has</b> changes with the subject. Tap each button to see which one fits!";

    const subjectRow = document.createElement('div');
    subjectRow.className = 'amareis-subject-row';

    const cardDisplay = document.createElement('div');
    cardDisplay.className = 'amareis-highlight-card';

    const subjectSets = buildSubjectSets(haveList, hasList);
    let current = null;
    let currentPronoun = 'have';
    let havePointer = 0;
    let hasPointer = 0;

    const renderCard = (set, advance) => {
      if (!set) return;
      current = set;
      currentPronoun = set.id;
      
      // Advance to next example if requested
      if (advance) {
        if (set.id === 'have') {
          havePointer = (havePointer + 1) % haveList.length;
          const nextExample = haveList[havePointer];
          set.sentenceEn = nextExample.exampleSentence || set.sentenceEn;
          set.emoji = nextExample.emoji || set.emoji;
        } else {
          hasPointer = (hasPointer + 1) % hasList.length;
          const nextExample = hasList[hasPointer];
          set.sentenceEn = nextExample.exampleSentence || set.sentenceEn;
          set.emoji = nextExample.emoji || set.emoji;
        }
      }
      
      subjectRow.querySelectorAll('button').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.id === set.id);
      });
      cardDisplay.innerHTML = `
        <div class="verb-label">${set.verb.toUpperCase()}</div>
        <div class="verb-emoji">${set.emoji}</div>
        <div class="verb-sentence">${escapeHtml(set.sentenceEn)}</div>
        <div class="verb-tip">${escapeHtml(lang === 'ko' ? set.tipKo : set.tipEn)}</div>
      `;
    };

    subjectSets.forEach((set) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.id = set.id;
      btn.textContent = set.label;
      btn.onclick = () => {
        playSFX?.('click');
        renderCard(set, false);
      };
      subjectRow.appendChild(btn);
    });

    intro.appendChild(subjectRow);
    intro.appendChild(cardDisplay);
    stepEl.appendChild(intro);

    renderCard(subjectSets[0], false);

    // Add "Next Example" button
    const nextExampleBtn = buildSecondaryButton(lang === 'ko' ? '다음 예제' : 'Next Example');
    nextExampleBtn.style.marginTop = '18px';
    nextExampleBtn.style.display = 'block';
    nextExampleBtn.style.margin = '18px auto 0 auto';
    nextExampleBtn.onclick = () => {
      playSFX?.('click');
      const currentSet = subjectSets.find((s) => s.id === currentPronoun);
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
      ? "<b>한 명/한 물건</b>은 <b>has</b> (가지다)<br/><b>여러 명/여러 물건</b>은 <b>have</b> (가지다)<br/>버튼을 눌러서 예제를 확인해 보세요!"
      : "<b>One person/thing</b> uses <b>has</b><br/><b>More than one</b> uses <b>have</b><br/>Tap each button to see examples!";

    const typeRow = document.createElement('div');
    typeRow.className = 'amareis-subject-row';

    const cardDisplay = document.createElement('div');
    cardDisplay.className = 'amareis-highlight-card';

    // Filter for noun examples (excluding pronouns like I, you, we, they, he, she, it)
    const nounHasExamples = hasList.filter(item => {
      const word = String(item.word || '').toLowerCase();
      return !['i', 'you', 'we', 'they', 'he', 'she', 'it'].includes(word);
    });
    
    const nounHaveExamples = haveList.filter(item => {
      const word = String(item.word || '').toLowerCase();
      return !['i', 'you', 'we', 'they', 'he', 'she', 'it'].includes(word);
    });

    const exampleSets = [
      {
        id: 'singular',
        label: lang === 'ko' ? '한 개 (has)\n🐶' : 'One (has)\n🐶',
        examples: nounHasExamples.length ? nounHasExamples : hasList,
        pointer: 0,
      },
      {
        id: 'plural',
        label: lang === 'ko' ? '여러 개 (have)\n🐶🐶' : 'Many (have)\n🐶🐶',
        examples: nounHaveExamples.length ? nounHaveExamples : haveList,
        pointer: 0,
      }
    ];

    let currentType = 'singular';
    let singularPointer = 0;
    let pluralPointer = 0;

    const renderCard = (typeId, advance) => {
      const set = exampleSets.find((s) => s.id === typeId);
      if (!set || !set.examples.length) return;
      
      currentType = typeId;

      // Advance to next example if requested
      if (advance) {
        if (typeId === 'singular') {
          singularPointer = (singularPointer + 1) % set.examples.length;
        } else {
          pluralPointer = (pluralPointer + 1) % set.examples.length;
        }
      }

      const pointer = typeId === 'singular' ? singularPointer : pluralPointer;
      const example = set.examples[pointer];

      typeRow.querySelectorAll('button').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.id === typeId);
      });

      cardDisplay.innerHTML = `
        <div class="verb-label">${typeId === 'singular' ? 'HAS' : 'HAVE'}</div>
        <div class="verb-emoji">${example.emoji}</div>
        <div class="verb-sentence">${escapeHtml(example.exampleSentence)}</div>
        <div class="verb-tip">${escapeHtml(lang === 'ko' ? (typeId === 'singular' ? '한 명/한 물건에는 has' : '여러 명/여러 물건에는 have') : (typeId === 'singular' ? 'One person or thing uses has' : 'More than one uses have'))}</div>
      `;
    };

    exampleSets.forEach((set) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.id = set.id;
      btn.textContent = set.label;
      btn.onclick = () => {
        playSFX?.('click');
        renderCard(set.id, false);
      };
      typeRow.appendChild(btn);
    });

    intro.appendChild(typeRow);
    intro.appendChild(cardDisplay);
    stepEl.appendChild(intro);

    renderCard('singular', false);

    // Add "Next Example" button
    const nextExampleBtn = buildSecondaryButton(lang === 'ko' ? '다음 예제' : 'Next Example');
    nextExampleBtn.style.marginTop = '18px';
    nextExampleBtn.style.display = 'block';
    nextExampleBtn.style.margin = '18px auto 0 auto';
    nextExampleBtn.onclick = () => {
      playSFX?.('click');
      renderCard(currentType, true);
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
      ? '문장을 눌러 <b>have</b> 또는 <b>has</b> 바구니에 넣어 보세요. 모두 맞으면 다음 단계로 넘어갈 수 있어요.'
      : 'Tap each strip and move it into the <b>have</b> or <b>has</b> basket. Get them all correct to continue!';
    stepEl.appendChild(intro);

    const buckets = document.createElement('div');
    buckets.className = 'buckets buckets-two';
    const pool = makeBucket('pool', lang === 'ko' ? '문장 모음' : 'Sentence Pool');
    const haveBucket = makeBucket('have', 'have');
    const hasBucket = makeBucket('has', 'has');
    [pool.wrap, haveBucket.wrap, hasBucket.wrap].forEach((wrap) => buckets.appendChild(wrap));
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

    [haveBucket.wrap, hasBucket.wrap].forEach((wrap) => {
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
        have: new Set(sortingPool.filter((item) => item.answer === 'have').map((item) => item.id)),
        has: new Set(sortingPool.filter((item) => item.answer === 'has').map((item) => item.id)),
      };

      stepEl.querySelectorAll('.chip').forEach((chip) => chip.classList.remove('good', 'bad'));

      const markBucket = (bucketBody, key) => {
        bucketBody.querySelectorAll('.chip').forEach((chip) => {
          const ok = answers[key].has(chip.dataset.id);
          chip.classList.add(ok ? 'good' : 'bad');
        });
      };

      markBucket(haveBucket.body, 'have');
      markBucket(hasBucket.body, 'has');

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
        message.textContent = lang === 'ko' ? '완벽해요! have/has를 잘 골랐어요.' : 'Great! You used have/has correctly.';
        stepEl.insertBefore(message, stepEl.firstChild);
        
        if (!continueBtn) {
          continueBtn = buildPrimaryButton(lang === 'ko' ? '다음 단계로' : 'Next Step');
          continueBtn.onclick = () => nextStep();
          nav.appendChild(continueBtn);
        }
      } else {
        playSFX?.('wrong');
        
        // Add message at top
        const message = document.createElement('div');
        message.className = 'completion-message';
        message.style.cssText = 'background:#ffebee;border:2px solid #f44336;border-radius:12px;padding:14px 16px;text-align:center;color:#b71c1c;font-weight:800;margin-bottom:16px;font-size:1.05rem;';
        message.textContent = lang === 'ko' ? '빨간 문장을 다시 옮겨 보세요.' : 'Try again! Fix the red subjects.';
        stepEl.insertBefore(message, stepEl.firstChild);
      }
    };
  }

  function renderFinishStep(stepEl) {
    stepEl.innerHTML = '';

    const body = document.createElement('div');
    body.className = 'lesson-body';
    body.innerHTML = (lang === 'ko')
      ? '<div style="font-weight:800;color:#19777e">이제 have/has를 바르게 고를 수 있어요!</div><div class="stars">⭐⭐⭐⭐⭐</div>'
      : '<div style="font-weight:800;color:#19777e">You now know when to use have or has!</div><div class="stars">⭐⭐⭐⭐⭐</div>';
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
          mode: 'grammar_lesson_have_has',
          summary: {
            score: 1,
            total: 1,
            correct: 1,
            pct: 100,
            accuracy: 100,
            category: 'grammar',
            context: 'lesson',
            grammarName: grammarName || 'Have vs Has',
          },
          // Use grammarFile path for session tracking to match homework assignment list_key
          listName: grammarFile || grammarName || null,
          wordList: sessionWords,
        });
      } catch (err) {
        console.debug('[HaveHasLesson] endSession failed', err?.message);
      }

      try {
        const ev = new CustomEvent('wa:session-ended', { detail: { summary: { correct: 1, total: 1, grammarName: grammarName || 'Have vs Has', category: 'grammar' } } });
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
    #gameArea .lesson-note{font-size:1rem;color:#6b7c87;margin-top:12px}
    #gameArea .verb-columns{display:grid;grid-template-columns:1fr;gap:14px;margin:20px auto;max-width:680px;width:100%}
    @media (min-width:680px){#gameArea .verb-columns{grid-template-columns:1fr 1fr}}
    #gameArea .verb-column{border:2px solid #bde3e6;border-radius:16px;padding:18px;background:#fff;box-shadow:0 2px 10px rgba(0,0,0,.06);display:flex;flex-direction:column;gap:12px;align-items:center}
    #gameArea .verb-column h3{margin:0;font-size:1.2rem;color:#19777e}
    #gameArea .verb-example{display:flex;flex-direction:column;gap:4px;text-align:center;font-size:1.02rem;color:#374151}
    #gameArea .verb-example .emoji{font-size:2rem}
    #gameArea .verb-example .sentence{font-weight:600;color:#19777e}
    #gameArea .verb-example .sentence-ko{color:#67727d;font-size:.95rem}
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

function ensureHaveHasStyles() {
  if (document.getElementById('wa-lesson-havehas-styles')) return;
  const st = document.createElement('style');
  st.id = 'wa-lesson-havehas-styles';
  st.textContent = `
    #gameArea .verb-column.have{border-color:#6ad3d3}
    #gameArea .verb-column.has{border-color:#a3c7ff}
    #gameArea .verb-column.have h3{color:#1c8c8c}
    #gameArea .verb-column.has h3{color:#3d61c9}
    #gameArea .amareis-subject-row{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin:24px 0 12px}
    #gameArea .amareis-subject-row button{border:2px solid #21b3be;background:#ffffff;color:#21b3be;font-weight:700;padding:10px 18px;border-radius:999px;cursor:pointer;transition:transform .15s ease, box-shadow .15s ease, background .15s ease}
    #gameArea .amareis-subject-row button:hover{transform:translateY(-2px);box-shadow:0 8px 16px rgba(33,179,190,0.22)}
    #gameArea .amareis-subject-row button.active{background:#21b3be;color:#ffffff;box-shadow:0 10px 22px rgba(33,179,190,0.28)}
    #gameArea .amareis-highlight-card{background:#f7feff;border:2px solid rgba(33,179,190,0.28);border-radius:18px;padding:22px 20px;display:flex;flex-direction:column;align-items:center;gap:12px;max-width:420px;margin:0 auto;box-shadow:0 14px 40px -22px rgba(20,126,130,0.45)}
    #gameArea .amareis-highlight-card .verb-label{font-size:0.95rem;font-weight:800;color:#19777e;letter-spacing:0.08em;text-transform:uppercase}
    #gameArea .amareis-highlight-card .verb-emoji{font-size:2.6rem}
    #gameArea .amareis-highlight-card .verb-sentence{font-size:1.12rem;line-height:1.6;color:#27323a;font-weight:600}
    #gameArea .amareis-highlight-card .verb-tip{font-size:0.95rem;color:#546070}
  `;
  document.head.appendChild(st);
}

function buildExampleColumn(type, list, lang) {
  const column = document.createElement('div');
  column.className = `verb-column ${type}`;
  const heading = document.createElement('h3');
  heading.textContent = type.toUpperCase();
  column.appendChild(heading);

  const subjects = (type === 'have')
    ? (lang === 'ko' ? 'I / you / we / they / 복수 명사' : 'I / you / we / they / plural nouns')
    : (lang === 'ko' ? 'he / she / it / 단수 명사' : 'he / she / it / singular nouns');
  const subjectLine = document.createElement('div');
  subjectLine.style.cssText = 'font-size:.95rem;color:#6b7c87;text-align:center;';
  subjectLine.textContent = subjects;
  column.appendChild(subjectLine);

  list.slice(0, 4).forEach((item) => {
    const card = document.createElement('div');
    card.className = 'verb-example';
    const emoji = document.createElement('div');
    emoji.className = 'emoji';
    emoji.textContent = item.emoji || '✨';
    const sentence = document.createElement('div');
    sentence.className = 'sentence';
    sentence.textContent = item.exampleSentence || '';
    const sentenceKo = document.createElement('div');
    sentenceKo.className = 'sentence-ko';
    sentenceKo.textContent = item.exampleSentenceKo || '';
    card.appendChild(emoji);
    card.appendChild(sentence);
    if (sentenceKo.textContent) card.appendChild(sentenceKo);
    column.appendChild(card);
  });

  return column;
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

function buildSortingPool(haveList, hasList) {
  const havePool = shuffle(haveList).slice(0, 5).map((item, idx) => ({
    id: item.id || `have_${idx}`,
    answer: 'have',
    text: item.word || 'I',
  }));
  const hasPool = shuffle(hasList).slice(0, 5).map((item, idx) => ({
    id: item.id || `has_${idx}`,
    answer: 'has',
    text: item.word || 'He',
  }));
  return shuffle([...havePool, ...hasPool]);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildSubjectSets(haveList, hasList) {
  const pick = (arr, fallback) => arr.length ? arr[0] : fallback;
  const haveExample = pick(haveList, fallbackHave[0]);
  const hasExample = pick(hasList, fallbackHas[0]);
  return [
    {
      id: 'have',
      verb: 'have',
      emoji: haveExample.emoji || '✏️',
      sentenceEn: haveExample.exampleSentence || 'I have two pencils.',
      sentenceKo: haveExample.exampleSentenceKo || '나는 연필 두 자루를 가지고 있어요.',
      tipEn: "Use 'have' with I, you, we, they, or plural nouns.",
      tipKo: "I, you, we, they 그리고 복수 명사에 'have'를 써요.",
      label: 'I / You / We / They'
    },
    {
      id: 'has',
      verb: 'has',
      emoji: hasExample.emoji || '👧',
      sentenceEn: hasExample.exampleSentence || 'She has a red apple.',
      sentenceKo: hasExample.exampleSentenceKo || '그녀는 빨간 사과를 가지고 있어요.',
      tipEn: "Use 'has' with he, she, it, or one person or thing.",
      tipKo: "he, she, it 그리고 한 사람/한 물건에 'has'를 써요.",
      label: 'He / She / It'
    }
  ];
}

function normalizeList(list, fallback) {
  if (!Array.isArray(list) || !list.length) return fallback;
  return list.map((item, idx) => ({
    id: item.id || `${item.word || 'entry'}_${idx}`,
    word: item.word || '',
    prompt: item.prompt || '',
    exampleSentence: item.exampleSentence || '',
    exampleSentenceKo: item.exampleSentenceKo || '',
    emoji: item.emoji || '✨',
  })).filter((item) => item.exampleSentence || item.prompt);
}

function isVerb(item, target) {
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

const fallbackHave = [
  { id: 'fb_have_i', word: 'I', prompt: 'I ___ two pencils.', exampleSentence: 'I have two pencils.', exampleSentenceKo: '나는 연필 두 자루를 가지고 있어요.', emoji: '✏️' },
  { id: 'fb_have_we', word: 'We', prompt: 'We ___ music class.', exampleSentence: 'We have music class.', exampleSentenceKo: '우리는 음악 수업이 있어요.', emoji: '🎵' },
  { id: 'fb_have_they', word: 'They', prompt: 'They ___ a big house.', exampleSentence: 'They have a big house.', exampleSentenceKo: '그들은 큰 집이 있어요.', emoji: '🏠' },
  { id: 'fb_have_parents', word: 'My parents', prompt: 'My parents ___ a car.', exampleSentence: 'My parents have a car.', exampleSentenceKo: '우리 부모님은 차를 가지고 있어요.', emoji: '🚗' }
];

const fallbackHas = [
  { id: 'fb_has_he', word: 'He', prompt: 'He ___ a bike.', exampleSentence: 'He has a bike.', exampleSentenceKo: '그는 자전거를 가지고 있어요.', emoji: '🚲' },
  { id: 'fb_has_she', word: 'She', prompt: 'She ___ long hair.', exampleSentence: 'She has long hair.', exampleSentenceKo: '그녀는 긴 머리를 가지고 있어요.', emoji: '💇‍♀️' },
  { id: 'fb_has_it', word: 'It', prompt: 'It ___ four legs.', exampleSentence: 'It has four legs.', exampleSentenceKo: '그것은 다리가 네 개 있어요.', emoji: '🐕' },
  { id: 'fb_has_friend', word: 'My friend', prompt: 'My friend ___ a pencil case.', exampleSentence: 'My friend has a pencil case.', exampleSentenceKo: '내 친구는 필통이 있어요.', emoji: '🖍️' }
];