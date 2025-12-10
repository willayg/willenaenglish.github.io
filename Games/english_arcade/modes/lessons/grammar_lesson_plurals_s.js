// Grammar Lesson Runner ??Singular / Plural (add 's')
// Kid-friendly five-step lesson that teaches singular vs plural words.

import { startSession, endSession } from '../../../../students/records.js';

export async function runGrammarLessonPluralsS(ctx = {}) {
  const { grammarFile, grammarName, playSFX, inlineToast } = ctx;
  const root = document.getElementById('gameArea');
  if (!root) return;

  ensureBaseStyles();
  ensurePluralsStyles();

  let items = [];
  try {
    if (!grammarFile) throw new Error('No grammar file provided');
    const res = await fetch(grammarFile, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to load ${grammarFile}`);
    const data = await res.json();
    if (Array.isArray(data)) items = data;
  } catch (err) {
    console.warn('[lesson-plurals-s] failed to load grammar list', err);
  }

  const sessionWords = (items || [])
    .map((it) => (it && typeof it.word === 'string' ? it.word : null))
    .filter(Boolean)
    .slice(0, 25);

  let sessionId = null;
  let sessionClosed = false;
  try {
    sessionId = startSession({
      mode: 'grammar_lesson_plurals_s',
      wordList: sessionWords,
      listName: grammarFile || grammarName || null,
      meta: { category: 'grammar', file: grammarFile, lesson: grammarName || 'Singular vs Plural' },
    });
  } catch (err) {
    console.debug('[plurals-s] startSession failed', err?.message);
  }

  const singularList = normalizeList(items.filter((it) => (it?.article || '').toLowerCase() === 'singular'));
  const pluralList = normalizeList(items.filter((it) => (it?.article || '').toLowerCase() === 'plural'));

  let lang = detectLang();
  if (lang !== 'ko') lang = 'en';
  let stepIndex = 0;

  const activityPool = buildActivityPool(singularList, pluralList);

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
      ? "?�나???�는 ?�수, ???�상?�면 복수?�요. 보통 복수???�에 's'�?붙여??"
      : "One is singular; more than one is plural. Usually we add 's' to make plurals!";

    stepEl.appendChild(intro);
    const singularExample = singularList[0] || {
      word: 'bear',
      exampleSentence: 'There is one bear.',
      exampleSentenceKo: '곰이 ??마리 ?�어??',
      emoji: '?��',
    };
    const pluralExample = pluralList[0] || {
      word: 'bears',
      exampleSentence: 'There are two bears.',
      exampleSentenceKo: '곰이 ??마리 ?�어??',
      emoji: '?��?��',
    };

    const exampleCard = document.createElement('div');
    exampleCard.className = 'plurals-highlight-card';
    exampleCard.innerHTML = `
      <div class="card-heading">${lang === 'ko' ? '?�시�??�인?�요!' : 'Let\'s peek at an example!'}</div>
      <div class="card-row">
        <div class="card-side">
          <div class="card-label">${lang === 'ko' ? '?�수 (1�?' : 'Singular (1)'}</div>
          <div class="card-emoji">${escapeHtml(singularExample.emoji || '?��')}</div>
          <div class="card-word">${escapeHtml(singularExample.word || 'bear')}</div>
          <div class="card-sentence">${escapeHtml(singularExample.exampleSentence || 'There is one bear.')}</div>
          ${singularExample.exampleSentenceKo ? `<div class="card-sentence card-sentence-ko">${escapeHtml(singularExample.exampleSentenceKo)}</div>` : ''}
        </div>
        <div class="card-side">
          <div class="card-label">${lang === 'ko' ? '복수 (?�러 �?' : 'Plural (many)'}</div>
          <div class="card-emoji">${escapeHtml(pluralExample.emoji || '?��?��')}</div>
          <div class="card-word">${escapeHtml(pluralExample.word || 'bears')}</div>
          <div class="card-sentence">${escapeHtml(pluralExample.exampleSentence || 'There are two bears.')}</div>
          ${pluralExample.exampleSentenceKo ? `<div class="card-sentence card-sentence-ko">${escapeHtml(pluralExample.exampleSentenceKo)}</div>` : ''}
        </div>
      </div>
      <div class="card-tip">${lang === 'ko' ? "???�상?�면 ?�에 's'�?붙여??" : "Add an 's' when you have more than one!"}</div>
    `;
    stepEl.appendChild(exampleCard);
    const controls = buildNavRow(() => { stepIndex = Math.max(0, stepIndex - 1); render(); }, nextStep, lang);
    stepEl.appendChild(controls);
  }

  function renderExamplesStep(stage, prog, stepEl) {
    prog.textContent = displayStep(2);
    stepEl.innerHTML = '';
    const intro = document.createElement('div');
    intro.className = 'lesson-body';
    intro.innerHTML = lang === 'ko'
      ? "?�쪽?� ?�수(?�나), ?�른쪽�? 복수(?�러 �? ?�문?�에?? ?�리 ?�어 ?�어 보세??"
      : "Left shows singular (one), right shows plural (more than one). Try reading aloud!";
    stepEl.appendChild(intro);

    const grid = document.createElement('div');
    grid.className = 'plurals-example-grid';
    grid.appendChild(buildExampleColumn('singular', singularList, lang));
    grid.appendChild(buildExampleColumn('plural', pluralList, lang));
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
      ? "?�수 ?�는 복수 바구?�에 ?�어�??�어 보세?? 모두 맞히�??�음?�로 �????�어??"
      : "Place each word into the singular or plural basket. Get them all right to continue!";
    stepEl.appendChild(body);

    const buckets = document.createElement('div');
    buckets.className = 'buckets buckets-two';
    const pool = makeBucket('pool', lang === 'ko' ? '?�어 모음' : 'Word Pool');
    const bucketSing = makeBucket('singular', lang === 'ko' ? '?�수' : 'Singular');
    const bucketPlu = makeBucket('plural', lang === 'ko' ? '복수' : 'Plural');

    [pool.wrap, bucketSing.wrap, bucketPlu.wrap].forEach((wrap) => buckets.appendChild(wrap));
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

    [pool.wrap, bucketSing.wrap, bucketPlu.wrap].forEach((wrap) => {
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

    const checkBtn = buildPrimaryButton(lang === 'ko' ? '?�답 ?�인' : 'Check Answers');
    checkBtn.style.marginTop = '15px';
    stepEl.appendChild(checkBtn);

    const nav = document.createElement('div');
    nav.className = 'lesson-nav';
    nav.style.marginTop = '18px';
    const backBtn = buildPrimaryButton(lang === 'ko' ? '?�로' : 'Back');
    backBtn.style.background = '#fff';
    backBtn.style.color = '#ff6fb0';
    backBtn.style.borderColor = '#ff6fb0';
    backBtn.onclick = () => { stepIndex = Math.max(0, stepIndex - 1); render(); };
    nav.appendChild(backBtn);
    stepEl.appendChild(nav);

    let continueBtn = null;

    checkBtn.onclick = () => {
      const singularSet = new Set(activityPool.filter((item) => item.article === 'singular').map((item) => item.id));
      const pluralSet = new Set(activityPool.filter((item) => item.article === 'plural').map((item) => item.id));

      stepEl.querySelectorAll('.chip').forEach((chip) => chip.classList.remove('good', 'bad'));

      const markBucket = (bucketBody, allowed) => {
        bucketBody.querySelectorAll('.chip').forEach((chip) => {
          const ok = allowed.has(chip.dataset.id);
          chip.classList.add(ok ? 'good' : 'bad');
        });
      };

      markBucket(bucketSing.body, singularSet);
      markBucket(bucketPlu.body, pluralSet);

      const poolCount = pool.body.querySelectorAll('.chip').length;
      const wrongCount = stepEl.querySelectorAll('.chip.bad').length;
      const correct = activityPool.length - wrongCount;

      const existingMsg = stepEl.querySelector('.completion-message');
      if (existingMsg) existingMsg.remove();

      if (poolCount === 0 && wrongCount === 0) {
        playSFX?.('correct');
        const message = document.createElement('div');
        message.className = 'completion-message';
        message.style.cssText = 'background:#e8f5e9;border:2px solid #4caf50;border-radius:12px;padding:14px 16px;text-align:center;color:#256029;font-weight:800;margin-bottom:16px;font-size:1.05rem;';
        message.textContent = lang === 'ko' ? '?�답?�에?? ?�수?� 복수�???구분?�어??' : 'Great! You could spot singular and plural words.';
        stepEl.insertBefore(message, stepEl.firstChild);

        if (!continueBtn) {
          continueBtn = buildPrimaryButton(lang === 'ko' ? '?�음 ?�계�? : 'Next Step');
          continueBtn.style.background = '#fff';
          continueBtn.style.color = '#ff6fb0';
          continueBtn.style.borderColor = '#ff6fb0';
          continueBtn.onclick = nextStep;
          nav.appendChild(continueBtn);
        }
      } else {
        playSFX?.('wrong');
        const message = document.createElement('div');
        message.className = 'completion-message';
        message.style.cssText = 'background:#ffebee;border:2px solid #f44336;border-radius:12px;padding:14px 16px;text-align:center;color:#b71c1c;font-weight:800;margin-bottom:16px;font-size:1.05rem;';
        message.textContent = lang === 'ko' ? '빨간 카드�??�시 ??�� 보세??' : 'Try again! Fix the red cards.';
        stepEl.insertBefore(message, stepEl.firstChild);
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
      ? '<div style="font-weight:800;color:#19777e">?�제 ?�수?� 복수�???구별?????�어??</div><div class="stars">⭐⭐⭐⭐�?/div>'
      : '<div style="font-weight:800;color:#19777e">You can now tell singular from plural ??awesome!</div><div class="stars">⭐⭐⭐⭐�?/div>';
    stepEl.appendChild(body);

    const nav = document.createElement('div');
    nav.className = 'lesson-nav';
    const backBtn = buildPrimaryButton(lang === 'ko' ? '모드�??�아가�? : 'Back to Modes');
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
          mode: 'grammar_lesson_plurals_s',
          summary: {
            score: 1,
            total: 1,
            correct: 1,
            pct: 100,
            accuracy: 100,
            category: 'grammar',
            context: 'lesson',
            grammarName: grammarName || 'Singular vs Plural',
          },
          listName: grammarFile || grammarName || null,
          wordList: sessionWords,
        });
      } catch (err) {
        console.debug('[plurals-s] endSession failed', err?.message);
      }

      try {
        const ev = new CustomEvent('wa:session-ended', { detail: { summary: { correct: 1, total: 1, grammarName: grammarName || 'Singular vs Plural', category: 'grammar' } } });
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
    title.textContent = grammarName || 'Singular vs Plural';
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

  function displayStep(index) {
    const steps = [lang === 'ko' ? '?�어 ?�택' : 'Choose Language', lang === 'ko' ? '1?�계' : 'Step 1', lang === 'ko' ? '2?�계' : 'Step 2', lang === 'ko' ? '3?�계' : 'Step 3', lang === 'ko' ? '?�료' : 'Complete'];
    return steps[index] || '';
  }

  render();

  // Helpers (copied/adapted from other lessons)
  function ensureBaseStyles() {
    if (document.getElementById('wa-lesson-styles')) return;
    const st = document.createElement('style');
    st.id = 'wa-lesson-styles';
    st.textContent = `
      #gameArea .lesson-stage{display:flex;flex-direction:column;align-items:center;justify-content:flex-start;min-height:calc(100vh - 140px);gap:clamp(10px,3vmin,24px);padding:clamp(12px,3.2vmin,26px);max-width:820px;width:100%;box-sizing:border-box;margin:0 auto;font-family:'Poppins','Noto Sans KR','Nanum Gothic','Apple SD Gothic Neo','Malgun Gothic',system-ui,Arial,sans-serif;background:linear-gradient(180deg,#f8feff 0%, #ffffff 60%)}
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

  function ensurePluralsStyles() {
    if (document.getElementById('wa-lesson-plurals-s-styles')) return;
    const st = document.createElement('style');
    st.id = 'wa-lesson-plurals-s-styles';
    st.textContent = `
      #gameArea .plurals-example-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:16px}
      #gameArea .plurals-example-card{background:#ffffff;border:2px solid #d1e6f0;border-radius:16px;padding:14px 16px;text-align:left;box-shadow:0 10px 20px -18px rgba(0,0,0,0.22);display:flex;flex-direction:column;gap:5px;font-size:0.98rem;color:#334155}
      #gameArea .plurals-example-card .card-title{font-weight:800;color:#19777e}
      #gameArea .plurals-highlight-card{margin:18px auto 0;width:100%;max-width:680px;background:#ffffff;border:2px solid #d1e6f0;border-radius:20px;box-shadow:0 16px 32px -24px rgba(25,119,126,0.35);padding:20px 24px;display:flex;flex-direction:column;gap:16px}
      #gameArea .plurals-highlight-card .card-heading{text-align:center;font-weight:800;font-size:clamp(1.15rem,3.6vmin,1.6rem);color:#19777e}
      #gameArea .plurals-highlight-card .card-row{display:flex;flex-direction:column;gap:18px}
      @media (min-width:640px){#gameArea .plurals-highlight-card .card-row{flex-direction:row}}
      #gameArea .plurals-highlight-card .card-side{flex:1;background:linear-gradient(180deg,#f5fdff 0%,#ffffff 100%);border:2px solid rgba(33,179,190,0.22);border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:8px;align-items:center;text-align:center}
      #gameArea .plurals-highlight-card .card-label{font-weight:800;color:#21b3be;font-size:1rem}
      #gameArea .plurals-highlight-card .card-emoji{font-size:2.6rem}
      #gameArea .plurals-highlight-card .card-word{font-size:1.4rem;font-weight:800;color:#ff6fb0}
      #gameArea .plurals-highlight-card .card-sentence{font-size:1.05rem;color:#27323a}
      #gameArea .plurals-highlight-card .card-sentence-ko{font-size:0.95rem;color:#516170;font-weight:600}
      #gameArea .plurals-highlight-card .card-tip{text-align:center;font-weight:700;color:#256f75;font-size:1.05rem}
    `;
    document.head.appendChild(st);
  }

  function normalizeList(list, fallback = []) {
    const source = Array.isArray(list) && list.length ? list : fallback;
    return source.map((item, idx) => ({
      id: item.id || `${item.article}_${idx}`,
      word: item.word || '',
      prompt: item.prompt || `${item.word || ''}`,
      article: item.article || 'singular',
      emoji: item.emoji || '?��',
      exampleSentence: item.exampleSentence || '',
      exampleSentenceKo: item.exampleSentenceKo || '',
      explanation: item.explanation || '',
      explanationKo: item.explanationKo || ''
    }));
  }

  function buildActivityPool(sList, pList) {
    const pick = (arr, count) => shuffle(arr).slice(0, Math.min(count, arr.length));
    const chips = [
      ...pick(sList, 4),
      ...pick(pList, 4),
    ];
    return shuffle(chips).map((item, idx) => ({
      id: item.id || `${item.article}_${idx}`,
      article: item.article,
      text: item.word || 'Word'
    }));
  }

  function buildExampleColumn(kind, list, lang) {
    const col = document.createElement('div');
    const titleWrap = document.createElement('div');
    titleWrap.style.cssText = 'text-align:center;font-weight:800;color:#19777e;margin-bottom:6px;';
    titleWrap.textContent = kind === 'singular'
      ? (lang === 'ko' ? '?�수 (?�나)' : 'Singular (one)')
      : (lang === 'ko' ? '복수 (?�럿)' : 'Plural (more)');
    col.appendChild(titleWrap);

    list.slice(0, 6).forEach((item) => {
      const card = document.createElement('div');
      card.className = 'plurals-example-card';
      card.innerHTML = `
        <div class="card-title">${escapeHtml(item.word)}</div>
        <div>${escapeHtml(item.exampleSentence)}</div>
        ${item.exampleSentenceKo ? `<div class="card-korean">${escapeHtml(item.exampleSentenceKo)}</div>` : ''}
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

  function shuffle(list) {
    return list.map((item) => ({ item, sort: Math.random() }))
      .sort((a, b) => a.sort - b.sort)
      .map(({ item }) => item);
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
    const back = buildPrimaryButton(currentLang === 'ko' ? '?�로' : 'Back');
    back.style.borderColor = '#21b3be';
    back.style.color = '#ff6fb0';
    back.style.background = '#fff';
    back.onclick = onBack;
    const next = buildPrimaryButton(currentLang === 'ko' ? '?�음' : 'Next');
    next.style.borderColor = '#21b3be';
    next.style.color = '#ff6fb0';
    next.style.background = '#fff';
    next.onclick = onNext;
    nav.appendChild(back);
    nav.appendChild(next);
    return nav;
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
}
