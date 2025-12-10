// Grammar Lesson Runner ??Isn't vs Aren't
// Interactive lesson teaching negative be-verb contractions with isn't/aren't.

import { startSession, endSession } from '../../../../students/records.js';

export async function runGrammarLessonIsntArent(ctx = {}) {
  const { grammarFile, grammarName, playSFX, inlineToast } = ctx;
  const root = document.getElementById('gameArea');
  if (!root) return;

  ensureBaseStyles();
  ensureIsntArentStyles();

  let items = [];
  try {
    if (!grammarFile) throw new Error('No grammar file provided');
    const res = await fetch(grammarFile, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to load ${grammarFile}`);
    const data = await res.json();
    if (Array.isArray(data)) items = data;
  } catch (err) {
    console.warn('[lesson-isnt-arent] failed to load list', err);
  }

  const isntList = normalizeList(items.filter((it) => isContraction(it, "isn't")), fallbackIsnt);
  const arentList = normalizeList(items.filter((it) => isContraction(it, "aren't")), fallbackArent);
  const sortingPool = buildSortingPool(isntList, arentList);

  const sessionWords = items.map((it) => it?.word).filter(Boolean).slice(0, 30);
  let sessionId = null;
  let sessionClosed = false;
  try {
    sessionId = startSession({
      mode: 'grammar_lesson_isnt_arent',
      wordList: sessionWords,
      listName: grammarFile || grammarName || null,
      meta: { category: 'grammar', file: grammarFile, lesson: grammarName || 'Isn\'t vs Aren\'t', level: 'Level 1 Grammar' }
    });
  } catch (err) {
    console.debug('[IsntArentLesson] startSession failed', err?.message);
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
    title.textContent = grammarName || 'Isn\'t vs Aren\'t';
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
      ? "부?�형 be?�사�?만들 ??<b>isn't</b> (he/she/it), <b>aren't</b> (you/we/they)�??�요. 버튼???�러???�제�??�인??보세??"
      : "Use <b>isn't</b> with he/she/it and <b>aren't</b> with you/we/they to make negative sentences with 'be'. Tap each button to see examples!";

    const negativeRow = document.createElement('div');
    negativeRow.className = 'isntarent-subject-row';

    const cardDisplay = document.createElement('div');
    cardDisplay.className = 'isntarent-highlight-card';

    const negativeSets = buildNegativeSets(isntList, arentList);
    let current = null;
    let currentType = 'isnt';
    let isntPointer = 0;
    let arentPointer = 0;

    const renderCard = (set, advance) => {
      if (!set) return;
      current = set;
      currentType = set.id;
      
      // Advance to next example if requested
      if (advance) {
        if (set.id === 'isnt') {
          isntPointer = (isntPointer + 1) % isntList.length;
          const nextExample = isntList[isntPointer];
          set.sentenceEn = nextExample.exampleSentence || set.sentenceEn;
          set.sentenceKo = nextExample.exampleSentenceKo || set.sentenceKo;
          set.emoji = nextExample.emoji || set.emoji;
        } else {
          arentPointer = (arentPointer + 1) % arentList.length;
          const nextExample = arentList[arentPointer];
          set.sentenceEn = nextExample.exampleSentence || set.sentenceEn;
          set.sentenceKo = nextExample.exampleSentenceKo || set.sentenceKo;
          set.emoji = nextExample.emoji || set.emoji;
        }
      }
      
      negativeRow.querySelectorAll('button').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.id === set.id);
      });
      cardDisplay.innerHTML = `
        <div class="negative-label">${set.negative.toUpperCase()}</div>
        <div class="negative-emoji">${set.emoji}</div>
        <div class="negative-sentence">${escapeHtml(set.sentenceEn)}</div>
        ${lang === 'ko' ? `<div class="negative-sentence-ko">${escapeHtml(set.sentenceKo)}</div>` : ''}
        <div class="negative-tip">${escapeHtml(lang === 'ko' ? set.tipKo : set.tipEn)}</div>
      `;
    };

    negativeSets.forEach((set) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.id = set.id;
      btn.textContent = set.label;
      btn.onclick = () => {
        playSFX?.('click');
        renderCard(set, false);
      };
      negativeRow.appendChild(btn);
    });

    intro.appendChild(negativeRow);
    intro.appendChild(cardDisplay);
    stepEl.appendChild(intro);

    renderCard(negativeSets[0], false);

    // Add "Next Example" button
    const nextExampleBtn = buildSecondaryButton(lang === 'ko' ? '?�음 ?�제' : 'Next Example');
    nextExampleBtn.style.marginTop = '18px';
    nextExampleBtn.style.display = 'block';
    nextExampleBtn.style.margin = '18px auto 0 auto';
    nextExampleBtn.onclick = () => {
      playSFX?.('click');
      const currentSet = negativeSets.find((s) => s.id === currentType);
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
      ? "<b>He/She/It</b> ??<b>Isn't</b><br/><b>You/We/They</b> ??<b>Aren't</b><br/>버튼???�러????많�? ?�제�??�인?�세??"
      : "<b>He/She/It</b> ??<b>Isn't</b><br/><b>You/We/They</b> ??<b>Aren't</b><br/>Tap each button to see more examples!";

    const categoryRow = document.createElement('div');
    categoryRow.className = 'isntarent-subject-row';

    const cardDisplay = document.createElement('div');
    cardDisplay.className = 'isntarent-highlight-card';

    const categorySets = [
      {
        id: 'singular',
        label: lang === 'ko' ? '?�� ?�수 주어' : '?�� Singular',
        examples: isntList,
        pointer: 0,
        negative: "ISN'T",
      },
      {
        id: 'plural',
        label: lang === 'ko' ? '?�� 복수 주어' : '?�� Plural',
        examples: arentList,
        pointer: 0,
        negative: "AREN'T",
      }
    ];

    let currentCategory = 'singular';
    let singularPointer = 0;
    let pluralPointer = 0;

    const renderCard = (categoryId, advance) => {
      const set = categorySets.find((s) => s.id === categoryId);
      if (!set || !set.examples.length) return;
      
      currentCategory = categoryId;

      // Advance to next example if requested
      if (advance) {
        if (categoryId === 'singular') {
          singularPointer = (singularPointer + 1) % set.examples.length;
        } else {
          pluralPointer = (pluralPointer + 1) % set.examples.length;
        }
      }

      const pointer = categoryId === 'singular' ? singularPointer : pluralPointer;
      const example = set.examples[pointer];

      categoryRow.querySelectorAll('button').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.id === categoryId);
      });

      cardDisplay.innerHTML = `
        <div class="negative-label">${set.negative}</div>
        <div class="negative-emoji">${example.emoji}</div>
        <div class="negative-sentence">${escapeHtml(example.exampleSentence)}</div>
        ${lang === 'ko' ? `<div class="negative-sentence-ko">${escapeHtml(example.exampleSentenceKo)}</div>` : ''}
        <div class="negative-tip">${escapeHtml(example.explanation || (lang === 'ko' ? example.explanationKo : example.explanation) || '')}</div>
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

    renderCard('singular', false);

    // Add "Next Example" button
    const nextExampleBtn = buildSecondaryButton(lang === 'ko' ? '?�음 ?�제' : 'Next Example');
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
      ? '주어�??�러 <b>Isn\'t</b> ?�는 <b>Aren\'t</b> 바구?�에 ?�어 보세?? 모두 맞으�??�음 ?�계�??�어�????�어??'
      : 'Tap each subject and move it into the <b>Isn\'t</b> or <b>Aren\'t</b> basket. Get them all correct to continue!';
    stepEl.appendChild(intro);

    const buckets = document.createElement('div');
    buckets.className = 'buckets buckets-two';
    const pool = makeBucket('pool', lang === 'ko' ? '주어 모음' : 'Subject Pool');
    const isntBucket = makeBucket('isnt', 'Isn\'t ?��');
    const arentBucket = makeBucket('arent', 'Aren\'t ?��');
    [pool.wrap, isntBucket.wrap, arentBucket.wrap].forEach((wrap) => buckets.appendChild(wrap));
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

    [isntBucket.wrap, arentBucket.wrap].forEach((wrap) => {
      wrap.addEventListener('click', (evt) => {
        if (evt.target.closest('.chip')) return;
        if (!selectedChip) return;
        wrap.querySelector('.bucket-body').appendChild(selectedChip);
        playSFX?.('click');
        clearSelection();
      });
    });

    const checkBtn = buildPrimaryButton(lang === 'ko' ? '?�답 ?�인' : 'Check Answers');
    checkBtn.style.marginTop = '16px';
    stepEl.appendChild(checkBtn);

    const nav = document.createElement('div');
    nav.className = 'lesson-nav';
    const backBtn = buildSecondaryButton(lang === 'ko' ? '?�로' : 'Back');
    backBtn.onclick = () => prevStep();
    nav.appendChild(backBtn);
    stepEl.appendChild(nav);

    let continueBtn = null;

    checkBtn.onclick = () => {
      const answers = {
        isnt: new Set(sortingPool.filter((item) => item.answer === 'isnt').map((item) => item.id)),
        arent: new Set(sortingPool.filter((item) => item.answer === 'arent').map((item) => item.id)),
      };

      stepEl.querySelectorAll('.chip').forEach((chip) => chip.classList.remove('good', 'bad'));

      const markBucket = (bucketBody, key) => {
        bucketBody.querySelectorAll('.chip').forEach((chip) => {
          const ok = answers[key].has(chip.dataset.id);
          chip.classList.add(ok ? 'good' : 'bad');
        });
      };

      markBucket(isntBucket.body, 'isnt');
      markBucket(arentBucket.body, 'arent');

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
        message.textContent = lang === 'ko' ? '?�벽?�요! isn\'t/aren\'t�???골랐?�요.' : 'Perfect! You used isn\'t/aren\'t correctly.';
        stepEl.insertBefore(message, stepEl.firstChild);
        
        if (!continueBtn) {
          continueBtn = buildPrimaryButton(lang === 'ko' ? '?�음 ?�계�? : 'Next Step');
          continueBtn.onclick = () => nextStep();
          nav.appendChild(continueBtn);
        }
      } else {
        playSFX?.('wrong');
        
        // Add message at top
        const message = document.createElement('div');
        message.className = 'completion-message';
        message.style.cssText = 'background:#ffebee;border:2px solid #f44336;border-radius:12px;padding:14px 16px;text-align:center;color:#b71c1c;font-weight:800;margin-bottom:16px;font-size:1.05rem;';
        message.textContent = lang === 'ko' ? '빨간 주어�??�시 ??�� 보세??' : 'Try again! Fix the red subjects.';
        stepEl.insertBefore(message, stepEl.firstChild);
      }
    };
  }

  function renderFinishStep(stepEl) {
    stepEl.innerHTML = '';

    const body = document.createElement('div');
    body.className = 'lesson-body';
    body.innerHTML = (lang === 'ko')
      ? '<div style="font-weight:800;color:#19777e">?�제 isn\'t/aren\'t�?바르�??�용?????�어??</div><div class="stars">⭐⭐⭐⭐�?/div>'
      : '<div style="font-weight:800;color:#19777e">You now know when to use isn\'t or aren\'t!</div><div class="stars">⭐⭐⭐⭐�?/div>';
    stepEl.appendChild(body);

    const nav = document.createElement('div');
    nav.className = 'lesson-nav';
    const backBtn = buildPrimaryButton(lang === 'ko' ? '모드�??�아가�? : 'Back to Modes');
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
          mode: 'grammar_lesson_isnt_arent',
          summary: {
            score: 1,
            total: 1,
            correct: 1,
            pct: 100,
            accuracy: 100,
            category: 'grammar',
            context: 'lesson',
            grammarName: grammarName || 'Isn\'t vs Aren\'t',
          },
          listName: grammarFile || grammarName || null,
          wordList: sessionWords,
        });
      } catch (err) {
        console.debug('[IsntArentLesson] endSession failed', err?.message);
      }

      try {
        const ev = new CustomEvent('wa:session-ended', { detail: { summary: { correct: 1, total: 1, grammarName: grammarName || 'Isn\'t vs Aren\'t', category: 'grammar' } } });
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

function ensureIsntArentStyles() {
  if (document.getElementById('wa-lesson-isntarent-styles')) return;
  const st = document.createElement('style');
  st.id = 'wa-lesson-isntarent-styles';
  st.textContent = `
    #gameArea .isntarent-subject-row{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin:24px 0 12px}
    #gameArea .isntarent-subject-row button{border:2px solid #21b3be;background:#ffffff;color:#21b3be;font-weight:700;padding:10px 18px;border-radius:999px;cursor:pointer;transition:transform .15s ease, box-shadow .15s ease, background .15s ease}
    #gameArea .isntarent-subject-row button:hover{transform:translateY(-2px);box-shadow:0 8px 16px rgba(33,179,190,0.22)}
    #gameArea .isntarent-subject-row button.active{background:#21b3be;color:#ffffff;box-shadow:0 10px 22px rgba(33,179,190,0.28)}
    #gameArea .isntarent-highlight-card{background:#f7feff;border:2px solid rgba(33,179,190,0.28);border-radius:18px;padding:22px 20px;display:flex;flex-direction:column;align-items:center;gap:12px;max-width:420px;margin:0 auto;box-shadow:0 14px 40px -22px rgba(20,126,130,0.45)}
    #gameArea .isntarent-highlight-card .negative-label{font-size:0.95rem;font-weight:800;color:#19777e;letter-spacing:0.08em;text-transform:uppercase}
    #gameArea .isntarent-highlight-card .negative-emoji{font-size:2.6rem}
    #gameArea .isntarent-highlight-card .negative-sentence{font-size:1.12rem;line-height:1.6;color:#27323a;font-weight:600}
    #gameArea .isntarent-highlight-card .negative-sentence-ko{font-size:1rem;color:#546070;margin-top:-4px}
    #gameArea .isntarent-highlight-card .negative-tip{font-size:0.95rem;color:#546070}
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

function buildSortingPool(isntList, arentList) {
  const isntPool = shuffle(isntList).slice(0, 5).map((item, idx) => ({
    id: item.id || `isnt_${idx}`,
    answer: 'isnt',
    text: item.word || 'he',
  }));
  const arentPool = shuffle(arentList).slice(0, 5).map((item, idx) => ({
    id: item.id || `arent_${idx}`,
    answer: 'arent',
    text: item.word || 'you',
  }));
  return shuffle([...isntPool, ...arentPool]);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildNegativeSets(isntList, arentList) {
  const pick = (arr, fallback) => arr.length ? arr[0] : fallback;
  const isntExample = pick(isntList, fallbackIsnt[0]);
  const arentExample = pick(arentList, fallbackArent[0]);
  return [
    {
      id: 'isnt',
      negative: 'isn\'t',
      emoji: isntExample.emoji || '?��',
      sentenceEn: isntExample.exampleSentence || 'He isn\'t at home.',
      sentenceKo: isntExample.exampleSentenceKo || '그는 집에 ?�어??',
      tipEn: "Use 'isn't' with he, she, it.",
      tipKo: "he, she, it???�??'isn't'�??�요.",
      label: '?�� Isn\'t'
    },
    {
      id: 'arent',
      negative: 'aren\'t',
      emoji: arentExample.emoji || '?��',
      sentenceEn: arentExample.exampleSentence || 'We aren\'t happy.',
      sentenceKo: arentExample.exampleSentenceKo || '?�리???�복?��? ?�아??',
      tipEn: "Use 'aren't' with you, we, they.",
      tipKo: "you, we, they???�??'aren't'�??�요.",
      label: '?�� Aren\'t'
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
    emoji: item.emoji || '??,
  })).filter((item) => item.exampleSentence);
}

function isContraction(item, target) {
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
  const backBtn = buildSecondaryButton(lang === 'ko' ? '?�로' : 'Back');
  backBtn.onclick = () => onBack();
  const nextBtn = buildPrimaryButton(lang === 'ko' ? '?�음' : 'Next');
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
  const stepsKo = ['?�어 ?�택', '1?�계', '2?�계', '3?�계', '?'완료'];
  const list = (lang === 'ko') ? stepsKo : stepsEn;
  return list[stepIndex] || '';
}

function shuffle(list) {
  return [...(list || [])].sort(() => Math.random() - 0.5);
}

const fallbackIsnt = [
  { id: 'fb_isnt_home', word: 'He', exampleSentence: 'He isn\'t at home.', exampleSentenceKo: '그는 집에 ?�어??', emoji: '?��' },
  { id: 'fb_isnt_happy', word: 'She', exampleSentence: 'She isn\'t happy.', exampleSentenceKo: '그�????�복?��? ?�아??', emoji: '?��' },
  { id: 'fb_isnt_working', word: 'It', exampleSentence: 'It isn\'t working.', exampleSentenceKo: '그것?� ?�동?��? ?�아??', emoji: '?�️' },
  { id: 'fb_isnt_ready', word: 'Tom', exampleSentence: 'Tom isn\'t ready.', exampleSentenceKo: '?��? 준비되지 ?�았?�요.', emoji: '?? }
];

const fallbackArent = [
  { id: 'fb_arent_happy', word: 'We', exampleSentence: 'We aren\'t happy.', exampleSentenceKo: '?�리???�복?��? ?�아??', emoji: '?��' },
  { id: 'fb_arent_ready', word: 'You', exampleSentence: 'You aren\'t ready yet.', exampleSentenceKo: '?�직 준�????�어??', emoji: '?? },
  { id: 'fb_arent_here', word: 'They', exampleSentence: 'They aren\'t here.', exampleSentenceKo: '그들?� ?�기 ?�어??', emoji: '?��' },
  { id: 'fb_arent_students', word: 'We', exampleSentence: 'We aren\'t students.', exampleSentenceKo: '?�리???�생???�니?�요.', emoji: '?��' }
];
