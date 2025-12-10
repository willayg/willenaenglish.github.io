// Grammar Lesson Runner ??Plurals that change y to "ies"
// Mirrors the plurals_s and plurals_es lessons but explains the y?ies spelling rule for kids.

import { startSession, endSession } from '../../../../students/records.js';

export async function runGrammarLessonPluralsIes(ctx = {}) {
  const { grammarFile, grammarName, playSFX } = ctx;
  const root = document.getElementById('gameArea');
  if (!root) return;

  ensureBaseStyles();
  ensurePluralsIesStyles();

  let items = [];
  try {
    if (!grammarFile) throw new Error('No grammar file provided');
    const res = await fetch(grammarFile, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to load ${grammarFile}`);
    const data = await res.json();
    if (Array.isArray(data)) items = data;
  } catch (err) {
    console.warn('[lesson-plurals-ies] failed to load grammar list', err);
  }

  const singularList = normalizeList(items.filter((it) => (it?.article || '').toLowerCase() === 'singular'), fallbackSingular);
  const pluralList = normalizeList(items.filter((it) => (it?.article || '').toLowerCase() === 'plural'), fallbackPlural);

  const sessionWords = (items || [])
    .map((it) => (it && typeof it.word === 'string' ? it.word : null))
    .filter(Boolean)
    .slice(0, 25);

  let sessionId = null;
  let sessionClosed = false;
  try {
    sessionId = startSession({
      mode: 'grammar_lesson_plurals_ies',
      wordList: sessionWords,
      listName: grammarFile || grammarName || null,
      meta: { category: 'grammar', file: grammarFile, lesson: grammarName || 'Y to IES Plurals' },
    });
  } catch (err) {
    console.debug('[plurals-ies] startSession failed', err?.message);
  }

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
    enBtn.onclick = () => { playSFX?.('click'); lang = 'en'; nextStep(); };
    const koBtn = buildLanguageButton('한국어');
    koBtn.onclick = () => { playSFX?.('click'); lang = 'ko'; nextStep(); };
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
        ? "자음 + y로 끝나는 단어는 y를 'ies'로 바꿔 복수형을 만들어요!"
        : "When a word ends with consonant + y, we change y to 'ies' to make it plural!";
    stepEl.appendChild(intro);

    const singularExample = singularList.find(item => item.word === 'baby') || singularList[0] || fallbackSingular[0];
    const pluralExample = pluralList.find(item => item.word === 'babies') || pluralList[0] || fallbackPlural[0];

    const highlight = document.createElement('div');
    highlight.className = 'plurals-ies-highlight-card';
    highlight.innerHTML = `
      <div class="card-heading">${lang === 'ko' ? '?��?��Ģ???�����!' : 'See how the rule works!'}</div>
      <div class="card-rule">${lang === 'ko' ? "?�� + y ??<strong>y?ies?�ٲ�??/strong>" : "Consonant + y ??change y to <strong>ies</strong>"}</div>
      <div class="card-row">
        <div class="card-side">
          <div class="card-label">${lang === 'ko' ? '?�� (1?' : 'Singular (1)'}</div>
            <div class="card-label">${lang === 'ko' ? '단수 (1개)' : 'Singular (1)'}</div>
          <div class="card-emoji">${escapeHtml(singularExample.emoji || '?')}</div>
          <div class="card-word">${escapeHtml(singularExample.word || 'baby')}</div>
          <div class="card-sentence">${escapeHtml(singularExample.exampleSentence || 'One baby is sleeping.')}</div>
          ${singularExample.exampleSentenceKo ? `<div class="card-sentence card-sentence-ko">${escapeHtml(singularExample.exampleSentenceKo)}</div>` : ''}
        </div>
        <div class="card-side">
          <div class="card-label">${lang === 'ko' ? '���� (?�� ?' : 'Plural (many)'}</div>
            <div class="card-label">${lang === 'ko' ? '복수 (여러개)' : 'Plural (many)'}</div>
            <div class="card-tip">${lang === 'ko' ? "y를 찾아 ies로 바꿔요!" : "Find the y, then change it to ies!"}</div>
          <div class="card-emoji">${escapeHtml(pluralExample?.emoji || '??')}</div>
          <div class="card-word">${escapeHtml(pluralExample?.word || 'babies')}</div>
          <div class="card-sentence">${escapeHtml(pluralExample?.exampleSentence || 'Many babies are sleeping.')}</div>
          ${pluralExample?.exampleSentenceKo ? `<div class="card-sentence card-sentence-ko">${escapeHtml(pluralExample.exampleSentenceKo)}</div>` : ''}
        </div>
      </div>
      <div class="card-tip">${lang === 'ko' ? "y???ġ?ã��, 'ies'?�ٲ�??" : "Find the y, then change it to ies!"}</div>
    `;
    stepEl.appendChild(highlight);

    const controls = buildNavRow(() => { playSFX?.('click'); stepIndex = Math.max(0, stepIndex - 1); render(); }, nextStep, lang, playSFX);
    stepEl.appendChild(controls);
  }

  function renderExamplesStep(stage, prog, stepEl) {
    prog.textContent = displayStep(2);
    stepEl.innerHTML = '';
    const intro = document.createElement('div');
    intro.className = 'lesson-body';
      intro.innerHTML = lang === 'ko'
        ? '왼쪽은 단수 단어, 오른쪽은 y를 ies로 바꾼 복수입니다. 소리 내어 읽으며 구별해보세요!'
        : 'Left shows the singular word, right shows the plural where y changed to ies. Read them aloud!';
    stepEl.appendChild(intro);

    const grid = document.createElement('div');
    grid.className = 'plurals-ies-example-grid';
    grid.appendChild(buildExampleColumn('singular', singularList, lang));
    grid.appendChild(buildExampleColumn('plural', pluralList, lang));
    stepEl.appendChild(grid);

    const controls = buildNavRow(() => { playSFX?.('click'); stepIndex = Math.max(0, stepIndex - 1); render(); }, nextStep, lang, playSFX);
    stepEl.appendChild(controls);
  }

  function renderSortingStep(stage, prog, stepEl) {
    prog.textContent = displayStep(3);
    stepEl.innerHTML = '';

    const body = document.createElement('div');
    body.className = 'lesson-body';
    body.innerHTML = lang === 'ko'
      ? '각 조각을 단수 또는 복수 바구니로 옮겨보세요. 모두 맞히면 계속할 수 있어요!'
      : 'Tap each strip and move it into the singular or plural basket. Get them all correct to continue!';
    stepEl.appendChild(body);

    const buckets = document.createElement('div');
    buckets.className = 'buckets buckets-two';
    const pool = makeBucket('pool', lang === 'ko' ? '단어 풀' : 'Word Pool');
    const bucketSing = makeBucket('singular', lang === 'ko' ? '단수' : 'Singular');
    const bucketPlu = makeBucket('plural', lang === 'ko' ? '복수 (y → ies)' : 'Plural (y → ies)');

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
        playSFX?.('click');
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

    const checkBtn = buildPrimaryButton(lang === 'ko' ? '정답 확인' : 'Check Answers');
    checkBtn.style.marginTop = '15px';
    stepEl.appendChild(checkBtn);

    const nav = document.createElement('div');
    nav.className = 'lesson-nav';
    nav.style.marginTop = '18px';
    const backBtn = buildSecondaryButton(lang === 'ko' ? '뒤로' : 'Back');
    backBtn.onclick = () => { playSFX?.('click'); stepIndex = Math.max(0, stepIndex - 1); render(); };
    nav.appendChild(backBtn);
    stepEl.appendChild(nav);

    let continueBtn = null;

    checkBtn.onclick = () => {
      playSFX?.('click');
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

      const existingMsg = stepEl.querySelector('.completion-message');
      if (existingMsg) existingMsg.remove();

      if (poolCount === 0 && wrongCount === 0) {
        playSFX?.('correct');
        const message = document.createElement('div');
        message.className = 'completion-message';
        message.style.cssText = 'background:#e8f5e9;border:2px solid #4caf50;border-radius:12px;padding:14px 16px;text-align:center;color:#256029;font-weight:800;margin-bottom:16px;font-size:1.05rem;';
        message.textContent = lang === 'ko'
          ? '완벽해요! 모든 y → ies 복수형을 정확히 골랐어요.'
          : 'Perfect! Every y → ies plural is in the right basket.';
        stepEl.insertBefore(message, stepEl.firstChild);

        if (!continueBtn) {
          continueBtn = buildPrimaryButton(lang === 'ko' ? '다음 단계' : 'Next Step');
          continueBtn.onclick = () => { playSFX?.('click'); nextStep(true); };
          nav.appendChild(continueBtn);
        }
      } else {
        playSFX?.('wrong');
        const message = document.createElement('div');
        message.className = 'completion-message';
        message.style.cssText = 'background:#ffebee;border:2px solid #f44336;border-radius:12px;padding:14px 16px;text-align:center;color:#b71c1c;font-weight:800;margin-bottom:16px;font-size:1.05rem;';
        message.textContent = lang === 'ko'
          ? '잘못된 카드를 올바른 바구니로 옮겨보세요.'
          : 'Move the red cards to the correct basket.';
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
      ? "<div style=\"font-weight:800;color:#19777e\">축하합니다! y to ies 규칙을 익혔어요!</div><div class=\"stars\">⭐⭐⭐⭐⭐</div>"
      : "<div style=\"font-weight:800;color:#19777e\">You learned the y to ies rule!</div><div class=\"stars\">⭐⭐⭐⭐⭐</div>";
    stepEl.appendChild(body);

    const nav = document.createElement('div');
    nav.className = 'lesson-nav';
    const backBtn = buildPrimaryButton(lang === 'ko' ? '모드로 돌아가기' : 'Back to Modes');
    backBtn.onclick = () => {
      playSFX?.('click');
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
          mode: 'grammar_lesson_plurals_ies',
          summary: {
            score: 1,
            total: 1,
            correct: 1,
            pct: 100,
            accuracy: 100,
            category: 'grammar',
            context: 'lesson',
            grammarName: grammarName || 'Y to IES Plurals',
          },
          listName: grammarFile || grammarName || null,
          wordList: sessionWords,
        });
      } catch (err) {
        console.debug('[plurals-ies] endSession failed', err?.message);
      }

      try {
        const ev = new CustomEvent('wa:session-ended', { detail: { summary: { correct: 1, total: 1, grammarName: grammarName || 'Y to IES Plurals', category: 'grammar' } } });
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
    title.textContent = grammarName || 'Y to IES Plurals';
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

  function nextStep(fromButton) {
    if (!fromButton) playSFX?.('click');
    stepIndex = Math.min(stepIndex + 1, 4);
    render();
  }

  function displayStep(index) {
    const steps = [lang === 'ko' ? '언어 선택' : 'Choose Language', lang === 'ko' ? '1단계' : 'Step 1', lang === 'ko' ? '2단계' : 'Step 2', lang === 'ko' ? '3단계' : 'Step 3', lang === 'ko' ? '완료' : 'Complete'];
    return steps[index] || '';
  }

  render();

  // Helpers
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

  function ensurePluralsIesStyles() {
    if (document.getElementById('wa-lesson-plurals-ies-styles')) return;
    const st = document.createElement('style');
    st.id = 'wa-lesson-plurals-ies-styles';
    st.textContent = `
      #gameArea .plurals-ies-highlight-card{margin:18px auto 0;width:100%;max-width:720px;background:#ffffff;border:2px solid #d1e6f0;border-radius:20px;box-shadow:0 18px 36px -26px rgba(25,119,126,0.35);padding:22px 26px;display:flex;flex-direction:column;gap:18px}
      #gameArea .plurals-ies-highlight-card .card-heading{text-align:center;font-weight:800;font-size:clamp(1.15rem,3.6vmin,1.6rem);color:#19777e}
      #gameArea .plurals-ies-highlight-card .card-rule{text-align:center;font-weight:800;color:#ff6fb0;font-size:clamp(1.05rem,3.2vmin,1.35rem)}
      #gameArea .plurals-ies-highlight-card .card-rule strong{color:#19777e}
      #gameArea .plurals-ies-highlight-card .card-row{display:flex;flex-direction:column;gap:18px}
      @media (min-width:640px){#gameArea .plurals-ies-highlight-card .card-row{flex-direction:row}}
      #gameArea .plurals-ies-highlight-card .card-side{flex:1;background:linear-gradient(180deg,#f5fdff 0%,#ffffff 100%);border:2px solid rgba(33,179,190,0.22);border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:8px;align-items:center;text-align:center}
      #gameArea .plurals-ies-highlight-card .card-label{font-weight:800;color:#21b3be;font-size:1rem}
      #gameArea .plurals-ies-highlight-card .card-emoji{font-size:2.6rem}
      #gameArea .plurals-ies-highlight-card .card-word{font-size:1.4rem;font-weight:800;color:#ff6fb0}
      #gameArea .plurals-ies-highlight-card .card-sentence{font-size:1.05rem;color:#27323a}
      #gameArea .plurals-ies-highlight-card .card-sentence-ko{font-size:0.95rem;color:#516170;font-weight:600}
      #gameArea .plurals-ies-highlight-card .card-tip{text-align:center;font-weight:700;color:#256f75;font-size:1.05rem}
      #gameArea .plurals-ies-example-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:16px}
      #gameArea .plurals-ies-example-card{background:#ffffff;border:2px solid #d1e6f0;border-radius:16px;padding:14px 16px;text-align:left;box-shadow:0 10px 20px -18px rgba(0,0,0,0.22);display:flex;flex-direction:column;gap:5px;font-size:0.98rem;color:#334155}
      #gameArea .plurals-ies-example-card .card-title{font-weight:800;color:#19777e}
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
      emoji: item.emoji || '?',
      exampleSentence: item.exampleSentence || '',
      exampleSentenceKo: item.exampleSentenceKo || '',
      explanation: item.explanation || '',
      explanationKo: item.explanationKo || ''
    }));
  }

  function buildActivityPool(sList, pList) {
    const pick = (arr, count) => shuffle(arr).slice(0, Math.min(count, arr.length));
    const chips = [
      ...pick(sList, 5),
      ...pick(pList, 5),
    ];
    return shuffle(chips).map((item, idx) => ({
      id: item.id || `${item.article}_${idx}`,
      article: item.article,
      text: item.word || 'word'
    }));
  }

  function buildExampleColumn(kind, list, currentLang) {
    const col = document.createElement('div');
    const titleWrap = document.createElement('div');
    titleWrap.style.cssText = 'text-align:center;font-weight:800;color:#19777e;margin-bottom:6px;';
    titleWrap.textContent = kind === 'singular'
      ? (currentLang === 'ko' ? '?�� (?��)' : 'Singular (one)')
      : (currentLang === 'ko' ? "���� (y?ies)" : "Plural (y?ies)");
    col.appendChild(titleWrap);

    list.slice(0, 6).forEach((item) => {
      const card = document.createElement('div');
      card.className = 'plurals-ies-example-card';
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
    el.dataset.id = item.id;
    el.dataset.answer = item.article;
    el.textContent = item.text;
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

  function buildSecondaryButton(label) {
    const btn = document.createElement('button');
    btn.className = 'lesson-btn';
    btn.textContent = label;
    btn.style.border = '2px solid #21b3be';
    btn.style.background = '#fff';
    btn.style.color = '#21b3be';
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

  function buildNavRow(onBack, onNext, currentLang, sfx) {
    const nav = document.createElement('div');
    nav.className = 'lesson-nav';
    nav.style.marginTop = '15px';
    const back = buildSecondaryButton(currentLang === 'ko' ? '?��' : 'Back');
    back.onclick = () => { sfx?.('click'); onBack(); };
    const next = buildPrimaryButton(currentLang === 'ko' ? '?��' : 'Next');
    next.onclick = () => { onNext(); };
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

const fallbackSingular = [
  { id: 'fb_ies_baby', word: 'baby', article: 'singular', emoji: '👶', exampleSentence: 'One baby is sleeping.', exampleSentenceKo: '한 아기가 자고 있어요.' },
  { id: 'fb_ies_city', word: 'city', article: 'singular', emoji: '🏙️', exampleSentence: 'One city is large.', exampleSentenceKo: '한 도시는 넓어요.' },
  { id: 'fb_ies_party', word: 'party', article: 'singular', emoji: '🎉', exampleSentence: 'One party is fun.', exampleSentenceKo: '한 파티는 즐거워요.' },
  { id: 'fb_ies_fly', word: 'fly', article: 'singular', emoji: '🪰', exampleSentence: 'One fly is on the table.', exampleSentenceKo: '한 파리가 테이블 위에 있어요.' }
];

const fallbackPlural = [
  { id: 'fb_ies_babies', word: 'babies', article: 'plural', emoji: '👶', exampleSentence: 'Many babies are sleeping.', exampleSentenceKo: '많은 아기들이 자고 있어요.' },
  { id: 'fb_ies_cities', word: 'cities', article: 'plural', emoji: '🏙️', exampleSentence: 'Many cities are large.', exampleSentenceKo: '많은 도시들이 넓어요.' },
  { id: 'fb_ies_parties', word: 'parties', article: 'plural', emoji: '🎊', exampleSentence: 'Many parties are fun.', exampleSentenceKo: '많은 파티가 즐거워요.' },
  { id: 'fb_ies_flies', word: 'flies', article: 'plural', emoji: '🪰', exampleSentence: 'Many flies are on the table.', exampleSentenceKo: '많은 파리가 테이블 위에 있어요.' }
];
