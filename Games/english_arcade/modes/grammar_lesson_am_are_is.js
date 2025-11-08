// Grammar Lesson Runner – Am / Is / Are
// Provides a five-step lesson teaching "to be" verb agreement in present tense.

export async function runGrammarLessonAmAreIs(ctx = {}) {
  const { grammarFile, grammarName, playSFX, inlineToast } = ctx;
  const root = document.getElementById('gameArea');
  if (!root) return;

  ensureBaseStyles();
  ensureAmAreIsStyles();

  let items = [];
  try {
    if (!grammarFile) throw new Error('No grammar file provided');
    const res = await fetch(grammarFile, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to load ${grammarFile}`);
    const data = await res.json();
    if (Array.isArray(data)) items = data;
  } catch (err) {
    console.warn('[lesson-am-are-is] failed to load grammar list', err);
  }

  const amList = normalizeList(items.filter((it) => (it?.article || '').toLowerCase() === 'am'), fallbackAm);
  const isList = normalizeList(items.filter((it) => (it?.article || '').toLowerCase() === 'is'), fallbackIs);
  const areList = normalizeList(items.filter((it) => (it?.article || '').toLowerCase() === 'are'), fallbackAre);

  let lang = detectLang();
  if (lang !== 'ko') lang = 'en';
  let stepIndex = 0;

  const activityPool = buildActivityPool(amList, isList, areList);

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
      ? "주어에 따라 <b>am</b>, <b>is</b>, <b>are</b>가 바뀌어요. 버튼을 눌러서 어떤 말을 쓰는지 확인해 보세요!"
      : "The verb <b>am</b>, <b>is</b>, or <b>are</b> changes with the subject. Tap each button to see which one fits!";

    const subjectRow = document.createElement('div');
    subjectRow.className = 'amareis-subject-row';

    const cardDisplay = document.createElement('div');
    cardDisplay.className = 'amareis-highlight-card';

    const subjectSets = buildSubjectSets(amList, isList, areList);
    let current = null;

    const renderCard = (set) => {
      if (!set) return;
      current = set;
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
        renderCard(set);
      };
      subjectRow.appendChild(btn);
    });

    intro.appendChild(subjectRow);
    intro.appendChild(cardDisplay);
    stepEl.appendChild(intro);

    renderCard(subjectSets[0]);

    const controls = buildNavRow(() => { stepIndex = Math.max(0, stepIndex - 1); render(); }, nextStep, lang);
    stepEl.appendChild(controls);
  }

  function renderExamplesStep(stage, prog, stepEl) {
    prog.textContent = displayStep(2);
    stepEl.innerHTML = '';

    const intro = document.createElement('div');
    intro.className = 'lesson-body';
    intro.innerHTML = lang === 'ko'
      ? "왼쪽부터 <b>am</b>, <b>is</b>, <b>are</b> 예문이에요. 소리를 내어 읽어 보세요!"
      : "Examples for <b>am</b>, <b>is</b>, and <b>are</b>. Try reading them out loud!";
    stepEl.appendChild(intro);

    const grid = document.createElement('div');
    grid.className = 'amareis-example-grid';
    grid.appendChild(buildExampleColumn('am', amList, lang));
    grid.appendChild(buildExampleColumn('is', isList, lang));
    grid.appendChild(buildExampleColumn('are', areList, lang));
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
      ? "문장을 눌러서 <b>am</b>, <b>is</b>, <b>are</b> 바구니에 넣어 보세요. 모두 맞으면 다음으로 갈 수 있어요!"
      : "Tap each strip and place it into the <b>am</b>, <b>is</b>, or <b>are</b> basket. Get them all correct to continue!";
    stepEl.appendChild(body);

    const buckets = document.createElement('div');
    buckets.className = 'buckets buckets-three';
    const pool = makeBucket('pool', lang === 'ko' ? '문장 모음' : 'Sentence Pool');
    const bucketAm = makeBucket('am', 'am');
    const bucketIs = makeBucket('is', 'is');
    const bucketAre = makeBucket('are', 'are');

    [pool.wrap, bucketAm.wrap, bucketIs.wrap, bucketAre.wrap].forEach((wrap) => buckets.appendChild(wrap));
    stepEl.appendChild(buckets);

    activityPool.forEach((item) => pool.body.appendChild(makeChip(item)));

    let selectedChip = null;
    const clearSelection = () => {
      stepEl.querySelectorAll('.chip.selected').forEach((chip) => chip.classList.remove('selected'));
      selectedChip = null;
    };

    stepEl.addEventListener('click', (evt) => {
      const chip = evt.target.closest('.chip');
      if (chip) {
        if (selectedChip === chip) {
          chip.classList.toggle('selected');
          selectedChip = chip.classList.contains('selected') ? chip : null;
        } else {
          clearSelection();
          chip.classList.add('selected');
          selectedChip = chip;
        }
      }
    });

    [pool.wrap, bucketAm.wrap, bucketIs.wrap, bucketAre.wrap].forEach((wrap) => {
      wrap.addEventListener('click', (evt) => {
        if (evt.target.closest('.chip')) return;
        if (!selectedChip) return;
        const bodyEl = wrap.querySelector('.bucket-body');
        if (!bodyEl) return;
        bodyEl.appendChild(selectedChip);
        playSFX?.('click');
        clearSelection();
      });
    });

    const checkBtn = buildPrimaryButton(lang === 'ko' ? '정답 확인' : 'Check Answers');
    checkBtn.style.marginTop = '15px';
    stepEl.appendChild(checkBtn);
    let continueBtn = null;

    checkBtn.onclick = () => {
      const amSet = new Set(activityPool.filter((item) => item.article === 'am').map((item) => item.id));
      const isSet = new Set(activityPool.filter((item) => item.article === 'is').map((item) => item.id));
      const areSet = new Set(activityPool.filter((item) => item.article === 'are').map((item) => item.id));

      stepEl.querySelectorAll('.chip').forEach((chip) => chip.classList.remove('good', 'bad'));

      const markBucket = (bucketBody, allowed) => {
        bucketBody.querySelectorAll('.chip').forEach((chip) => {
          const ok = allowed.has(chip.dataset.id);
          chip.classList.add(ok ? 'good' : 'bad');
        });
      };

      markBucket(bucketAm.body, amSet);
      markBucket(bucketIs.body, isSet);
      markBucket(bucketAre.body, areSet);

      const poolCount = pool.body.querySelectorAll('.chip').length;
      const wrongCount = stepEl.querySelectorAll('.chip.bad').length;
      const correct = activityPool.length - wrongCount;

      if (poolCount === 0 && wrongCount === 0) {
        playSFX?.('correct');
        inlineToast?.(lang === 'ko' ? "완벽해요! am, is, are를 잘 골랐어요." : 'Perfect! You matched am, is, and are.');
        if (!continueBtn) {
          continueBtn = buildPrimaryButton(lang === 'ko' ? '다음 단계로' : 'Next Step');
          continueBtn.onclick = nextStep;
          continueBtn.style.marginTop = '15px';
          stepEl.appendChild(continueBtn);
        }
      } else {
        playSFX?.('wrong');
        inlineToast?.(lang === 'ko' ? '빨간 카드를 다시 옮겨 보세요.' : 'Try again! Fix the red cards.');
      }
    };
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
    body.innerHTML = lang === 'ko'
      ? '<div style="font-weight:800;color:#19777e">이제 am / is / are를 바르게 쓸 수 있어요!</div><div class="stars">⭐⭐⭐⭐⭐</div>'
      : '<div style="font-weight:800;color:#19777e">You now know when to use am, is, or are!</div><div class="stars">⭐⭐⭐⭐⭐</div>';
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

    try {
      const ev = new CustomEvent('wa:session-ended', { detail: { summary: { correct: 18, total: 18, grammarName: grammarName || 'Am vs Are vs Is' } } });
      window.dispatchEvent(ev);
    } catch {}
  }

  function render() {
    root.innerHTML = '';
    const stage = document.createElement('div');
    stage.className = 'lesson-stage';

    const top = document.createElement('div');
    top.className = 'lesson-topbar';
    const title = document.createElement('div');
    title.className = 'lesson-title';
    title.textContent = grammarName || 'Am vs. Are vs. Is';
    const prog = document.createElement('div');
    prog.className = 'lesson-progress';
    const stepEl = document.createElement('div');
    stepEl.className = 'lesson-step';

    stage.appendChild(top);
    stage.appendChild(prog);
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

  function displayStep(index) {
    const steps = [lang === 'ko' ? '언어 선택' : 'Choose Language', lang === 'ko' ? '1단계' : 'Step 1', lang === 'ko' ? '2단계' : 'Step 2', lang === 'ko' ? '3단계' : 'Step 3', lang === 'ko' ? '완료' : 'Complete'];
    return steps[index] || '';
  }

  render();

  // Helpers
  function buildLanguageButton(text) {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.cssText = 'width:100%;border:3px solid #21b3be;background:#fff;color:#ff6fb0;border-radius:14px;padding:14px 28px;font-weight:800;cursor:pointer;font-size:1.3rem;transition:transform .15s ease, box-shadow .15s ease;box-shadow:0 2px 8px rgba(0,0,0,.06);';
    btn.onmouseenter = () => { btn.style.transform = 'translateY(-2px)'; btn.style.boxShadow = '0 6px 16px rgba(33,181,192,0.2)'; };
    btn.onmouseleave = () => { btn.style.transform = 'translateY(0)'; btn.style.boxShadow = '0 2px 8px rgba(0,0,0,.06)'; };
    return btn;
  }

  function buildNavRow(onBack, onNext, currentLang) {
    const nav = document.createElement('div');
    nav.className = 'lesson-nav';
    nav.style.marginTop = '15px';
    const back = buildPrimaryButton(currentLang === 'ko' ? '뒤로' : 'Back');
    back.style.borderColor = '#21b3be';
    back.style.color = '#ff6fb0';
    back.style.background = '#fff';
    back.onclick = onBack;
    const next = buildPrimaryButton(currentLang === 'ko' ? '다음' : 'Next');
    next.style.borderColor = '#21b3be';
    next.style.color = '#ff6fb0';
    next.style.background = '#fff';
    next.onclick = onNext;
    nav.appendChild(back);
    nav.appendChild(next);
    return nav;
  }
}

function ensureBaseStyles() {
  if (document.getElementById('wa-lesson-styles')) return;
  const st = document.createElement('style');
  st.id = 'wa-lesson-styles';
  st.textContent = `
    #gameArea .lesson-stage{display:flex;flex-direction:column;align-items:center;justify-content:flex-start;height:100%;gap:clamp(10px,3vmin,24px);padding:clamp(12px,3.2vmin,26px);max-width:820px;width:100%;box-sizing:border-box;margin:0 auto;font-family:'Poppins','Noto Sans KR','Nanum Gothic','Apple SD Gothic Neo','Malgun Gothic',system-ui,Arial,sans-serif;background:linear-gradient(180deg,#f8feff 0%, #ffffff 60%)}
    #gameArea .lesson-topbar{width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px}
    #gameArea .lesson-title{font-weight:800;color:#19777e;font-size:clamp(1.15rem,3.8vmin,1.7rem)}
    #gameArea .lesson-progress{font-size:.95rem;color:#666;font-weight:600}
    #gameArea .lesson-step{opacity:0;transform:translateY(8px);transition:opacity .22s ease,transform .22s ease;width:100%}
    #gameArea .lesson-step.enter{opacity:1;transform:translateY(0)}
    #gameArea .lesson-body{text-align:center;font-size:clamp(1.02rem,3.3vmin,1.22rem);line-height:1.45;color:#27323a}
    #gameArea .lesson-nav{margin-top:auto;display:flex;gap:10px;align-items:center;justify-content:center;width:100%}
    #gameArea .lesson-btn{appearance:none;border:2px solid #21b3be;background:#fff;color:#21b3be;border-radius:12px;padding:10px 16px;font-weight:800;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,.06);transition:transform .15s ease, box-shadow .15s ease}
    #gameArea .lesson-btn:hover{transform:translateY(-1px);box-shadow:0 6px 16px rgba(33,181,192,0.18)}
    #gameArea .lesson-btn.primary{background:#21b3be;color:#fff;border-color:#21b3be}
    #gameArea .buckets{display:grid;gap:14px;margin-top:12px;width:100%;max-width:820px}
    #gameArea .bucket{border:2px dashed #b0e2e4;border-radius:16px;min-height:120px;background:linear-gradient(180deg, #fbffff 0%, #ffffff 100%);padding:10px;display:flex;flex-direction:column;gap:8px;box-shadow:0 2px 10px rgba(0,0,0,.04);cursor:pointer}
    #gameArea .bucket h4{margin:0;font-size:1.05rem;color:#19777e}
    #gameArea .bucket .bucket-body{display:flex;flex-wrap:wrap;gap:8px;cursor:pointer}
    #gameArea .pool{border:2px dashed #e6e6e6;background:#fff}
    #gameArea .chip{user-select:none;border:2px solid #93cbcf;background:#ffffff;color:#ff6fb0;border-radius:9999px;padding:10px 12px;font-weight:800;cursor:pointer;text-align:center;box-shadow:0 2px 6px rgba(0,0,0,.06);transition:transform .12s ease, box-shadow .12s ease}
    #gameArea .chip:hover{transform:scale(1.04);box-shadow:0 6px 16px rgba(0,0,0,.12)}
    #gameArea .chip.selected{outline:3px solid #21b3be;border-color:#21b3be}
    #gameArea .chip.bad{border-color:#f44336;color:#c62828;background:#ffebee}
    #gameArea .chip.good{border-color:#4caf50;color:#2e7d32;background:#e8f5e9}
    #gameArea .stars{font-size:clamp(1.6rem,6vmin,2.2rem);line-height:1}
  `;
  document.head.appendChild(st);
}

function ensureAmAreIsStyles() {
  if (document.getElementById('wa-lesson-am-are-is-styles')) return;
  const st = document.createElement('style');
  st.id = 'wa-lesson-am-are-is-styles';
  st.textContent = `
    #gameArea .amareis-subject-row{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin:24px 0 12px}
    #gameArea .amareis-subject-row button{border:2px solid #21b3be;background:#ffffff;color:#21b3be;font-weight:700;padding:10px 18px;border-radius:999px;cursor:pointer;transition:transform .15s ease, box-shadow .15s ease, background .15s ease}
    #gameArea .amareis-subject-row button:hover{transform:translateY(-2px);box-shadow:0 8px 16px rgba(33,179,190,0.22)}
    #gameArea .amareis-subject-row button.active{background:#21b3be;color:#ffffff;box-shadow:0 10px 22px rgba(33,179,190,0.28)}
    #gameArea .amareis-highlight-card{background:#f7feff;border:2px solid rgba(33,179,190,0.28);border-radius:18px;padding:22px 20px;display:flex;flex-direction:column;align-items:center;gap:12px;max-width:420px;margin:0 auto;box-shadow:0 14px 40px -22px rgba(20,126,130,0.45)}
    #gameArea .amareis-highlight-card .verb-label{font-size:0.95rem;font-weight:800;color:#19777e;letter-spacing:0.08em;text-transform:uppercase}
    #gameArea .amareis-highlight-card .verb-emoji{font-size:2.6rem}
    #gameArea .amareis-highlight-card .verb-sentence{font-size:1.12rem;line-height:1.6;color:#27323a;font-weight:600}
    #gameArea .amareis-highlight-card .verb-tip{font-size:0.95rem;color:#546070}
    #gameArea .amareis-example-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px;margin-top:16px}
    #gameArea .amareis-example-card{background:#ffffff;border:2px solid #d1e6f0;border-radius:16px;padding:14px 16px;text-align:left;box-shadow:0 10px 20px -18px rgba(0,0,0,0.22);display:flex;flex-direction:column;gap:6px;font-size:0.98rem;color:#334155}
    #gameArea .amareis-example-card .card-title{font-weight:800;color:#19777e}
    #gameArea .amareis-example-card .card-korean{font-size:0.9rem;color:#64748b}
    #gameArea .amareis-example-card .card-tip{font-size:0.9rem;color:#19777e;font-weight:600}
    #gameArea .buckets-three{grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}
  `;
  document.head.appendChild(st);
}

function normalizeList(list, fallback) {
  const source = Array.isArray(list) && list.length ? list : fallback;
  return source.map((item, idx) => ({
    id: item.id || `${item.article}_${idx}`,
    word: item.word || '',
    prompt: item.prompt || `${item.word || ''}`,
    article: item.article || 'is',
    emoji: item.emoji || '🧠',
    exampleSentence: item.exampleSentence || '',
    exampleSentenceKo: item.exampleSentenceKo || '',
    explanation: item.explanation || '',
    explanationKo: item.explanationKo || ''
  }));
}

function buildActivityPool(amList, isList, areList) {
  const pick = (arr, count) => shuffle(arr).slice(0, Math.min(count, arr.length));
  const chips = [
    ...pick(amList, 3),
    ...pick(isList, 3),
    ...pick(areList, 3)
  ];
  return shuffle(chips).map((item, idx) => ({
    id: item.id || `${item.article}_${idx}`,
    article: item.article,
    text: item.prompt || buildPromptFromSentence(item)
  }));
}

function buildPromptFromSentence(item) {
  const sentence = String(item.exampleSentence || '').trim();
  if (!sentence) return `${item.word || ''} ___`;
  const article = String(item.article || 'is');
  if (!article) return sentence;
  const pattern = new RegExp(`\b${article}\b`, 'i');
  if (!pattern.test(sentence)) return sentence;
  return sentence.replace(pattern, '___');
}

function buildPrimaryButton(label) {
  const btn = document.createElement('button');
  btn.className = 'lesson-btn primary';
  btn.textContent = label;
  btn.style.border = '2px solid #21b3be';
  btn.style.background = '#fff';
  btn.style.color = '#ff6fb0';
  return btn;
}

function buildExampleColumn(verb, list, lang) {
  const col = document.createElement('div');
  const titleWrap = document.createElement('div');
  titleWrap.style.cssText = 'text-align:center;font-weight:800;color:#19777e;margin-bottom:6px;';
  titleWrap.textContent = verb === 'am'
    ? (lang === 'ko' ? "am (I)" : 'am → with I')
    : verb === 'is'
      ? (lang === 'ko' ? "is (한 사람/물건)" : 'is → one person or thing')
      : (lang === 'ko' ? "are (여럿/you)" : 'are → many or you');
  col.appendChild(titleWrap);

  list.slice(0, 5).forEach((item) => {
    const card = document.createElement('div');
    card.className = 'amareis-example-card';
    card.innerHTML = `
      <div class="card-title">${escapeHtml(item.prompt || buildPromptFromSentence(item))}</div>
      <div>${escapeHtml(item.exampleSentence)}</div>
      ${item.explanation ? `<div class="card-tip">${escapeHtml(lang === 'ko' ? (item.explanationKo || item.explanation) : item.explanation)}</div>` : ''}
    `;
    col.appendChild(card);
  });

  return col;
}

function makeBucket(kind, label) {
  const wrap = document.createElement('div');
  wrap.className = 'bucket ' + (kind === 'pool' ? 'pool' : '');
  const title = document.createElement('h4');
  title.textContent = label;
  const body = document.createElement('div');
  body.className = 'bucket-body';
  body.dataset.bucket = kind;
  wrap.appendChild(title);
  wrap.appendChild(body);
  return { wrap, body };
}

function makeChip(item) {
  const el = document.createElement('div');
  el.className = 'chip';
  el.draggable = true;
  el.dataset.id = item.id;
  el.textContent = item.text;
  el.addEventListener('dragstart', (evt) => {
    try { evt.dataTransfer.setData('text/plain', item.id); } catch {}
  });
  return el;
}

function buildSubjectSets(amList, isList, areList) {
  const pick = (arr, fallback) => arr.length ? arr[0] : fallback;
  const amExample = pick(amList, fallbackAm[0]);
  const isExample = pick(isList, fallbackIs[0]);
  const areExample = pick(areList, fallbackAre[0]);
  return [
    {
      id: 'am',
      verb: 'am',
      emoji: amExample.emoji || '😀',
      sentenceEn: amExample.exampleSentence || 'I am happy.',
      sentenceKo: amExample.exampleSentenceKo || '나는 행복해요.',
      tipEn: "Use 'am' only with I.",
      tipKo: "I일 때만 'am'을 써요.",
      label: 'I'
    },
    {
      id: 'is',
      verb: 'is',
      emoji: isExample.emoji || '🧒',
      sentenceEn: isExample.exampleSentence || 'She is on the bus.',
      sentenceKo: isExample.exampleSentenceKo || '그녀는 버스에 있어요.',
      tipEn: "Use 'is' with he, she, it, or one noun.",
      tipKo: "he, she, it, 그리고 단수 명사에 'is'를 써요.",
      label: 'He / She / It'
    },
    {
      id: 'are',
      verb: 'are',
      emoji: areExample.emoji || '👫',
      sentenceEn: areExample.exampleSentence || 'They are playing.',
      sentenceKo: areExample.exampleSentenceKo || '그들은 놀고 있어요.',
      tipEn: "Use 'are' with we, you, they, or plural nouns.",
      tipKo: "we, you, they 또는 복수 명사에는 'are'를 써요.",
      label: 'We / You / They'
    }
  ];
}

function shuffle(list) {
  return list.map((item) => ({ item, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ item }) => item);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function detectLang() {
  try {
    if (window.StudentLang && typeof window.StudentLang.getLang === 'function') {
      const v = window.StudentLang.getLang();
      if (typeof v === 'string') return v.toLowerCase();
    }
    const attr = document.documentElement.getAttribute('lang');
    if (attr) return attr.toLowerCase();
  } catch {}
  return 'en';
}

const fallbackAm = [
  { id: 'fallback_am_1', word: 'I', prompt: 'I ___ happy.', article: 'am', emoji: '😀', exampleSentence: 'I am happy.', exampleSentenceKo: '나는 행복해요.', explanation: "Use 'am' with I.", explanationKo: "I에 'am'을 써요." },
  { id: 'fallback_am_2', word: 'I', prompt: 'I ___ from Korea.', article: 'am', emoji: '🇰🇷', exampleSentence: 'I am from Korea.', exampleSentenceKo: '나는 한국에서 왔어요.', explanation: "'am' links I with facts.", explanationKo: "I 뒤 정보에는 'am'." }
];

const fallbackIs = [
  { id: 'fallback_is_1', word: 'She', prompt: 'She ___ on the bus.', article: 'is', emoji: '🚌', exampleSentence: 'She is on the bus.', exampleSentenceKo: '그녀는 버스에 있어요.', explanation: "Use 'is' with one person.", explanationKo: "한 사람은 'is'." },
  { id: 'fallback_is_2', word: 'The cat', prompt: 'The cat ___ sleepy.', article: 'is', emoji: '🐱', exampleSentence: 'The cat is sleepy.', exampleSentenceKo: '그 고양이는 졸려요.', explanation: "One animal uses 'is'.", explanationKo: "동물 하나도 'is'." }
];

const fallbackAre = [
  { id: 'fallback_are_1', word: 'They', prompt: 'They ___ ready.', article: 'are', emoji: '👫', exampleSentence: 'They are ready.', exampleSentenceKo: '그들은 준비됐어요.', explanation: "Use 'are' with they.", explanationKo: "they에는 'are'." },
  { id: 'fallback_are_2', word: 'We', prompt: 'We ___ in class.', article: 'are', emoji: '🏫', exampleSentence: 'We are in class.', exampleSentenceKo: '우리는 교실에 있어요.', explanation: "Groups use 'are'.", explanationKo: "여럿이면 'are'." }
];
