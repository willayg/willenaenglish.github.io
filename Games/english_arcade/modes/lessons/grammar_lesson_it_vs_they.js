// Grammar Lesson Runner – It vs. They
// Mirrors the article lesson structure while teaching singular vs plural pronouns.

import { startSession, endSession } from '../../../../students/records.js';

export async function runGrammarLessonItVsThey(ctx = {}) {
  const { grammarFile, grammarName, playSFX, inlineToast } = ctx;
  const root = document.getElementById('gameArea');
  if (!root) return;

  if (!document.getElementById('wa-lesson-styles')) {
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
      #gameArea .lesson-rows{display:flex;flex-direction:column;gap:10px}
      #gameArea .lesson-examples{display:grid;grid-template-columns:1fr 1fr;gap:12px;width:100%;max-width:620px;margin:10px auto}
      @media (max-width:620px){#gameArea .lesson-examples{grid-template-columns:1fr}}
      #gameArea .lesson-example{border:2px solid #d1e6f0;border-radius:14px;padding:12px;background:#fff;box-shadow:0 2px 6px rgba(0,0,0,.05)}
      #gameArea .lesson-example strong{color:#19777e}
      #gameArea .lesson-nav{margin-top:auto;display:flex;gap:10px;align-items:center;justify-content:center;width:100%}
      #gameArea .lesson-btn{appearance:none;border:2px solid #21b3be;background:#fff;color:#21b3be;border-radius:12px;padding:10px 16px;font-weight:800;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,.06);transition:transform .15s ease, box-shadow .15s ease}
      #gameArea .lesson-btn:hover{transform:translateY(-1px);box-shadow:0 6px 16px rgba(33,181,192,0.18)}
      #gameArea .lesson-btn.primary{background:#21b3be;color:#fff;border-color:#21b3be}
      #gameArea .choice-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;max-width:680px;margin:12px auto}
      #gameArea .chip{user-select:none;border:2px solid #93cbcf;background:#ffffff;color:#ff6fb0;border-radius:9999px;padding:10px 12px;font-weight:800;cursor:pointer;text-align:center;box-shadow:0 2px 6px rgba(0,0,0,.06);transition:transform .12s ease, box-shadow .12s ease}
      #gameArea .chip:hover{transform:scale(1.04);box-shadow:0 6px 16px rgba(0,0,0,.12)}
      #gameArea .chip.selected{outline:3px solid #21b3be;border-color:#21b3be}
      #gameArea .chip.bad{border-color:#f44336;color:#c62828;background:#ffebee}
      #gameArea .chip.good{border-color:#4caf50;color:#2e7d32;background:#e8f5e9}
      #gameArea .buckets{display:grid;grid-template-columns:1fr;gap:14px;margin-top:12px;width:100%;max-width:820px}
      @media (min-width:720px){#gameArea .buckets{grid-template-columns:1fr 1fr}}
      #gameArea .bucket{border:2px dashed #b0e2e4;border-radius:16px;min-height:120px;background:linear-gradient(180deg, #fbffff 0%, #ffffff 100%);padding:10px;display:flex;flex-direction:column;gap:8px;box-shadow:0 2px 10px rgba(0,0,0,.04);cursor:pointer}
      #gameArea .bucket h4{margin:0;font-size:1.05rem;color:#19777e}
      #gameArea .bucket .bucket-body{display:flex;flex-wrap:wrap;gap:8px;cursor:pointer}
      #gameArea .pool{border:2px dashed #e6e6e6;background:#fff}
      #gameArea .stars{font-size:clamp(1.6rem,6vmin,2.2rem);line-height:1}
    `;
    document.head.appendChild(st);
  }

  if (!document.getElementById('wa-lesson-it-vs-they-styles')) {
    const extra = document.createElement('style');
    extra.id = 'wa-lesson-it-vs-they-styles';
    extra.textContent = `
      #gameArea .pronoun-card{display:flex;flex-direction:column;gap:10px;text-align:center}
      #gameArea .pronoun-card .pronoun-emoji{font-size:2.4rem}
      #gameArea .pronoun-card .pronoun-sentence{font-size:1.05rem;line-height:1.6}
      #gameArea .pronoun-card .pronoun-korean{font-size:0.92rem;color:#546070}
      #gameArea .pronoun-card .pronoun-tip{font-size:0.92rem;color:#19777e;font-weight:600}
      #gameArea .pronoun-switch{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
    `;
    document.head.appendChild(extra);
  }

  let items = [];
  try {
    if (grammarFile) {
      const res = await fetch(grammarFile, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Failed to load ${grammarFile}`);
      const data = await res.json();
      if (Array.isArray(data)) items = data;
    }
  } catch (e) {
    console.warn('[lesson-it-vs-they] failed to load items:', e);
  }

  const sessionWords = (items || [])
    .map((it) => (it && typeof it.word === 'string' ? it.word : null))
    .filter(Boolean)
    .slice(0, 25);

  let sessionId = null;
  let sessionClosed = false;
  try {
    sessionId = startSession({
      mode: 'grammar_lesson_it_vs_they',
      wordList: sessionWords,
      listName: grammarName || null,
      meta: { category: 'grammar', file: grammarFile, lesson: grammarName || 'It vs They' },
    });
  } catch (err) {
    console.debug('[ItVsTheyLesson] startSession failed', err?.message);
  }

  const fallbackIt = [
    { id: 'fallback_it_cat', word: 'cat', article: 'it', emoji: '🐱', exampleSentence: 'It is a sleepy cat.', exampleSentenceKo: '그것은 졸린 고양이에요.', explanation: "Use 'it' when there is only one." },
    { id: 'fallback_it_robot', word: 'robot', article: 'it', emoji: '🤖', exampleSentence: 'It is a shiny robot.', exampleSentenceKo: '그것은 반짝이는 로봇이에요.', explanation: "Use 'it' for a single machine." },
    { id: 'fallback_it_flower', word: 'flower', article: 'it', emoji: '🌸', exampleSentence: 'It is a pink flower.', exampleSentenceKo: '그것은 분홍색 꽃이에요.', explanation: "One flower needs 'it'." },
    { id: 'fallback_it_penguin', word: 'penguin', article: 'it', emoji: '🐧', exampleSentence: 'It is a baby penguin.', exampleSentenceKo: '그것은 아기 펭귄이에요.', explanation: "Single animals use 'it'." }
  ];
  const fallbackThey = [
    { id: 'fallback_they_cats', word: 'cats', article: 'they', emoji: '🐱🐱', exampleSentence: 'They are fluffy cats.', exampleSentenceKo: '그것들은 포근한 고양이들이에요.', explanation: "Use 'they' when there is more than one." },
    { id: 'fallback_they_robots', word: 'robots', article: 'they', emoji: '🤖🤖', exampleSentence: 'They are helper robots.', exampleSentenceKo: '그것들은 도와주는 로봇들이에요.', explanation: "Many machines use 'they'." },
    { id: 'fallback_they_flowers', word: 'flowers', article: 'they', emoji: '🌼🌼', exampleSentence: 'They are yellow flowers.', exampleSentenceKo: '그것들은 노란 꽃들이에요.', explanation: "More than one flower is 'they'." },
    { id: 'fallback_they_penguins', word: 'penguins', article: 'they', emoji: '🐧🐧', exampleSentence: 'They are marching penguins.', exampleSentenceKo: '그것들은 행진하는 펭귄들이에요.', explanation: "A group of animals uses 'they'." }
  ];

  const singularItems = (items || []).filter(it => it && String(it.article || '').toLowerCase() === 'it');
  const pluralItems = (items || []).filter(it => it && String(it.article || '').toLowerCase() === 'they');

  const safeItList = normalizePronounList(singularItems.length ? singularItems : fallbackIt, 'it');
  const safeTheyList = normalizePronounList(pluralItems.length ? pluralItems : fallbackThey, 'they');

  let lang = (() => {
    const guess = detectLang();
    return (guess === 'ko' || guess === 'kr') ? 'ko' : 'en';
  })();
  let stepIndex = 0;

  const cycleIt = shuffle(safeItList.slice());
  const cycleThey = shuffle(safeTheyList.slice());
  let pointerIt = 0;
  let pointerThey = 0;

  const sampleIt = uniqueItems(safeItList).slice(0, 5);
  const sampleThey = uniqueItems(safeTheyList).slice(0, 5);
  const activitySet = makeActivitySet(sampleIt, sampleThey, safeItList, safeTheyList);

  function renderStep1Language(stage, prog, stepEl, nav) {
    prog.textContent = '';
    if (nav) nav.style.display = 'none';
    stepEl.innerHTML = '';
    stepEl.style.cssText = 'display:flex;align-items:center;justify-content:center;';
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:40px;text-align:center;width:90%;max-width:300px;';
    const title = document.createElement('div');
    title.style.cssText = 'font-size:clamp(1.4rem,4.5vmin,2rem);font-weight:800;color:#19777e;';
    title.textContent = (lang === 'ko') ? '언어를 선택하세요' : 'Choose your language';
    const enBtn = document.createElement('button');
    enBtn.textContent = 'English';
    enBtn.style.cssText = 'width:100%;border:3px solid #21b3be;background:#fff;color:#ff6fb0;border-radius:14px;padding:14px 28px;font-weight:800;cursor:pointer;font-size:1.3rem;transition:transform .15s ease, box-shadow .15s ease;box-shadow:0 2px 8px rgba(0,0,0,.06);';
    enBtn.onmouseenter = () => { enBtn.style.transform = 'translateY(-2px)'; enBtn.style.boxShadow = '0 6px 16px rgba(33,181,192,0.2)'; };
    enBtn.onmouseleave = () => { enBtn.style.transform = 'translateY(0)'; enBtn.style.boxShadow = '0 2px 8px rgba(0,0,0,.06)'; };
    enBtn.onclick = () => { lang = 'en'; nextStep(); };
    const koBtn = document.createElement('button');
    koBtn.textContent = '한국어';
    koBtn.style.cssText = 'width:100%;border:3px solid #21b3be;background:#fff;color:#ff6fb0;border-radius:14px;padding:14px 28px;font-weight:800;cursor:pointer;font-size:1.3rem;transition:transform .15s ease, box-shadow .15s ease;box-shadow:0 2px 8px rgba(0,0,0,.06);font-family:\'Noto Sans KR\',\'Nanum Gothic\',\'Apple SD Gothic Neo\',\'Malgun Gothic\',system-ui,Arial,sans-serif;';
    koBtn.onmouseenter = () => { koBtn.style.transform = 'translateY(-2px)'; koBtn.style.boxShadow = '0 6px 16px rgba(33,181,192,0.2)'; };
    koBtn.onmouseleave = () => { koBtn.style.transform = 'translateY(0)'; koBtn.style.boxShadow = '0 2px 8px rgba(0,0,0,.06)'; };
    koBtn.onclick = () => { lang = 'ko'; nextStep(); };
    wrapper.appendChild(title);
    wrapper.appendChild(enBtn);
    wrapper.appendChild(koBtn);
    stepEl.appendChild(wrapper);
  }

  function renderStep2Intro(stage, prog, stepEl, nav) {
    prog.textContent = displayStep(1);
    if (nav) nav.style.display = 'none';
    stepEl.innerHTML = '';

    const container = document.createElement('div');
    container.style.cssText = 'display:flex;flex-direction:column;align-items:center;text-align:center;gap:18px;';

    const blurb = document.createElement('div');
    blurb.className = 'lesson-body';
    blurb.innerHTML = (lang === 'ko')
      ? `하나는 <b>it</b> (그것), 두 개 이상은 <b>they</b> (그것들/그 사람들)를 써요.`
      : `Use <b>it</b> for one animal or thing, and <b>they</b> when there is more than one.`;
    container.appendChild(blurb);

    const switchRow = document.createElement('div');
    switchRow.className = 'pronoun-switch';

    const itBtn = button(`'it'`);
    const theyBtn = button(`'they'`);
    itBtn.style.borderColor = '#21b3be';
    itBtn.style.color = '#ff6fb0';
    theyBtn.style.borderColor = '#21b3be';
    theyBtn.style.color = '#ff6fb0';
    switchRow.appendChild(itBtn);
    switchRow.appendChild(theyBtn);
    container.appendChild(switchRow);

    const card = document.createElement('div');
    card.className = 'lesson-example pronoun-card';
    card.style.maxWidth = '360px';

    const pronounLabel = document.createElement('div');
    pronounLabel.style.cssText = 'font-weight:700;color:#19777e;font-size:1.05rem;';
    const emojiEl = document.createElement('div');
    emojiEl.className = 'pronoun-emoji';
    const sentenceEl = document.createElement('div');
    sentenceEl.className = 'pronoun-sentence';
    const koreanEl = document.createElement('div');
    koreanEl.className = 'pronoun-korean';
    const tipEl = document.createElement('div');
    tipEl.className = 'pronoun-tip';

    card.appendChild(pronounLabel);
    card.appendChild(emojiEl);
    card.appendChild(sentenceEl);
    card.appendChild(koreanEl);
    card.appendChild(tipEl);
    container.appendChild(card);

    const nextExampleBtn = button((lang === 'ko') ? '다른 예 보기' : 'Next Example');
    nextExampleBtn.style.borderColor = '#21b3be';
    nextExampleBtn.style.color = '#ff6fb0';
    container.appendChild(nextExampleBtn);

    const buttonWrap = document.createElement('div');
    buttonWrap.style.cssText = 'display:flex;gap:12px;align-items:center;justify-content:center;margin-top:12px;';
    const backBtn = button((lang === 'ko') ? '뒤로' : 'Back');
    const proceedBtn = button((lang === 'ko') ? '다음 단계로' : 'Go to Next Step');
    backBtn.style.borderColor = '#21b3be';
    backBtn.style.color = '#ff6fb0';
    proceedBtn.style.borderColor = '#21b3be';
    proceedBtn.style.color = '#ff6fb0';
    backBtn.onclick = () => { if (stepIndex > 0) { stepIndex -= 1; render(); } };
    proceedBtn.onclick = () => { nextStep(); };
    buttonWrap.appendChild(backBtn);
    buttonWrap.appendChild(proceedBtn);
    container.appendChild(buttonWrap);

    stepEl.appendChild(container);

    let currentPronoun = 'it';

    const setActivePronoun = (pronoun, advance = false) => {
      currentPronoun = pronoun;
      itBtn.classList.toggle('primary', pronoun === 'it');
      theyBtn.classList.toggle('primary', pronoun === 'they');
      itBtn.style.color = pronoun === 'it' ? '#fff' : '#ff6fb0';
      theyBtn.style.color = pronoun === 'they' ? '#fff' : '#ff6fb0';
      const item = getPronounItem(pronoun, advance);
      if (!item) return;
      pronounLabel.textContent = (pronoun === 'it')
        ? ((lang === 'ko') ? "'it' → 그것 (하나)" : '"it" means just one')
        : ((lang === 'ko') ? "'they' → 그것들/그 사람들 (여러 개)" : '"they" means more than one');
      emojiEl.textContent = item.emoji || (pronoun === 'it' ? '🐾' : '🐾🐾');
      sentenceEl.innerHTML = highlightPronoun(item.exampleSentence, pronoun);
      if (lang === 'ko') {
        koreanEl.textContent = item.exampleSentenceKo;
        tipEl.textContent = item.explanationKo || defaultPronounExplanationKo(pronoun);
      } else {
        koreanEl.textContent = '';
        tipEl.textContent = item.explanation || defaultPronounExplanation(pronoun);
      }
    };

    const getPronounItem = (pronoun, advance) => {
      if (pronoun === 'it') {
        if (!cycleIt.length) cycleIt.push(...safeItList);
        if (advance) pointerIt = (pointerIt + 1) % cycleIt.length;
        return cycleIt[pointerIt % cycleIt.length];
      }
      if (!cycleThey.length) cycleThey.push(...safeTheyList);
      if (advance) pointerThey = (pointerThey + 1) % cycleThey.length;
      return cycleThey[pointerThey % cycleThey.length];
    };

    itBtn.onclick = () => setActivePronoun('it');
    theyBtn.onclick = () => setActivePronoun('they');
    nextExampleBtn.onclick = () => setActivePronoun(currentPronoun, true);

    setActivePronoun('it');
  }

  function renderStep3Examples(stage, prog, stepEl, nav) {
    prog.textContent = displayStep(2);
    stepEl.innerHTML = '';
    if (nav) nav.style.display = 'flex';

    const intro = document.createElement('div');
    intro.className = 'lesson-body';
    intro.innerHTML = (lang === 'ko')
      ? "카드를 보고 어떤 대명사를 쓰는지 기억해 보세요."
      : 'Look at the cards to see when we say “it” or “they”.';
    stepEl.appendChild(intro);

    const grid = document.createElement('div');
    grid.className = 'lesson-examples';
    grid.style.maxWidth = '720px';
    grid.style.marginTop = '12px';
    stepEl.appendChild(grid);

    grid.appendChild(buildPronounColumn('it', sampleIt, lang));
    grid.appendChild(buildPronounColumn('they', sampleThey, lang));
  }

  function renderStep4Sort(stage, prog, stepEl, nav) {
    prog.textContent = displayStep(3);
    stepEl.innerHTML = '';
    if (nav) nav.style.display = 'none';

    const body = document.createElement('div');
    body.className = 'lesson-body';
    body.innerHTML = (lang === 'ko')
      ? "한 개는 <b>it</b> (그것), 여러 개는 <b>they</b> (그것들/그 사람들) 바구니에 넣어 보세요."
      : 'Place single items in the <b>it</b> basket and groups in the <b>they</b> basket.';
    stepEl.appendChild(body);

    const buckets = document.createElement('div');
    buckets.className = 'buckets';
    const pool = makeBucket('pool', (lang === 'ko') ? '단어 모음' : 'Word Pool');
      const bucketIt = makeBucket('it', (lang === 'ko') ? "it (그것 - 하나)" : 'it (one)');
      const bucketThey = makeBucket('they', (lang === 'ko') ? "they (그것들/그 사람들 - 여러 개)" : 'they (more than one)');
    buckets.appendChild(pool.wrap);
    buckets.appendChild(bucketIt.wrap);
    buckets.appendChild(bucketThey.wrap);
    stepEl.appendChild(buckets);

    activitySet.forEach(item => pool.body.appendChild(makeChip(item)));

    let selectedChip = null;
    const clearSelection = () => {
      stepEl.querySelectorAll('.chip.selected').forEach(c => c.classList.remove('selected'));
      selectedChip = null;
    };
    const selectChip = (el) => {
      if (selectedChip === el) {
        el.classList.toggle('selected');
        selectedChip = el.classList.contains('selected') ? el : null;
        return;
      }
      clearSelection();
      selectedChip = el;
      el.classList.add('selected');
    };

    stepEl.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (chip) selectChip(chip);
    });

    [pool.wrap, bucketIt.wrap, bucketThey.wrap].forEach(wrapEl => {
      wrapEl.addEventListener('click', (ev) => {
        if (ev.target.closest('.chip')) return;
        if (!selectedChip) return;
        const targetBody = wrapEl.querySelector('.bucket-body');
        if (!targetBody) return;
        targetBody.appendChild(selectedChip);
        if (playSFX) try { playSFX('click'); } catch {}
        clearSelection();
      });
    });

    stepEl.querySelectorAll('.bucket-body, .pool .bucket-body').forEach(el => {
      el.addEventListener('dragover', ev => { ev.preventDefault(); });
      el.addEventListener('drop', ev => {
        ev.preventDefault();
        const id = ev.dataTransfer?.getData('text/plain');
        if (!id) return;
        const chip = stepEl.querySelector(`.chip[data-id="${CSS.escape(id)}"]`);
        if (chip) el.appendChild(chip);
        clearSelection();
      });
    });

    const checkBtn = button((lang === 'ko') ? '정답 확인' : 'Check Answers');
    checkBtn.style.marginTop = '12px';
    stepEl.appendChild(checkBtn);

  const navLocal = document.createElement('div');
  navLocal.className = 'lesson-nav';
  navLocal.style.marginTop = '14px';
    const backBtn = button((lang === 'ko') ? '뒤로' : 'Back');
    backBtn.style.background = '#fff';
    backBtn.style.color = '#ff6fb0';
    backBtn.style.borderColor = '#ff6fb0';
    backBtn.onclick = () => { if (stepIndex > 0) { stepIndex -= 1; render(); } };
  navLocal.appendChild(backBtn);
  stepEl.appendChild(navLocal);

    let continueBtn = null;
    checkBtn.onclick = () => {
      stepEl.querySelectorAll('.chip').forEach(c => c.classList.remove('good', 'bad'));
      const itIds = new Set(activitySet.filter(it => it.article === 'it').map(it => it.id));
      const theyIds = new Set(activitySet.filter(it => it.article === 'they').map(it => it.id));

      const markBucket = (bucketBody, validSet) => {
        bucketBody.querySelectorAll('.chip').forEach(chip => {
          const ok = validSet.has(chip.getAttribute('data-id'));
          chip.classList.add(ok ? 'good' : 'bad');
        });
      };

      markBucket(bucketIt.body, itIds);
      markBucket(bucketThey.body, theyIds);

      // Remove any existing message
      const existingMsg = stepEl.querySelector('.completion-message');
      if (existingMsg) existingMsg.remove();

      const poolCount = pool.body.querySelectorAll('.chip').length;
      const wrong = stepEl.querySelectorAll('.chip.bad').length;
      const total = activitySet.length;
      const correct = total - wrong;
      if (poolCount === 0 && correct === total) {
        if (playSFX) playSFX('correct');
        
        // Add message at top
        const message = document.createElement('div');
        message.className = 'completion-message';
        message.style.cssText = 'background:#e8f5e9;border:2px solid #4caf50;border-radius:12px;padding:14px 16px;text-align:center;color:#256029;font-weight:800;margin-bottom:16px;font-size:1.05rem;';
        message.textContent = (lang === 'ko') ? "완벽해요! 'it' (그것)은 하나, 'they' (그것들/그 사람들)는 여러 개!" : 'Awesome! "it" is for one, "they" is for more than one!';
        stepEl.insertBefore(message, stepEl.firstChild);
        
        if (!continueBtn) {
          continueBtn = button((lang === 'ko') ? '다음 단계로' : 'Next');
          continueBtn.style.background = '#fff';
          continueBtn.style.color = '#ff6fb0';
          continueBtn.style.borderColor = '#ff6fb0';
          continueBtn.onclick = () => nextStep();
          navLocal.appendChild(continueBtn);
        }
      } else {
        if (playSFX) playSFX('wrong');
        
        // Add message at top
        const message = document.createElement('div');
        message.className = 'completion-message';
        message.style.cssText = 'background:#ffebee;border:2px solid #f44336;border-radius:12px;padding:14px 16px;text-align:center;color:#b71c1c;font-weight:800;margin-bottom:16px;font-size:1.05rem;';
        message.textContent = (lang === 'ko') ? '빨간 카드를 다시 옮겨 보세요.' : 'Try again! Move the red cards.';
        stepEl.insertBefore(message, stepEl.firstChild);
      }
    };
  }

  function renderStep5Finish(stage, prog, stepEl, nav) {
    prog.textContent = displayStep(4);
    if (nav) nav.style.display = 'none';
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
      ? '<div style="font-weight:800;color:#19777e">이제 it (그것)과 they (그것들/그 사람들)을 구별할 수 있어요!</div><div class="stars">⭐⭐⭐⭐⭐</div>'
      : '<div style="font-weight:800;color:#19777e">Now you can tell "it" from "they"!</div><div class="stars">⭐⭐⭐⭐⭐</div>';
    stepEl.appendChild(body);

    const navWrap = document.createElement('div');
    navWrap.className = 'lesson-nav';
    const backToModes = button((lang === 'ko') ? '모드로 돌아가기' : 'Back to Modes');
    backToModes.onclick = () => {
      try {
        if (window.WordArcade && typeof window.WordArcade.startGrammarModeSelector === 'function') {
          window.WordArcade.startGrammarModeSelector();
        } else if (window.WordArcade && typeof window.WordArcade.quitToOpening === 'function') {
          window.WordArcade.quitToOpening(true);
        }
      } catch {}
    };
    navWrap.appendChild(backToModes);
    stepEl.appendChild(navWrap);

    if (!sessionClosed) {
      sessionClosed = true;
      try {
        endSession(sessionId, {
          mode: 'grammar_lesson_it_vs_they',
          summary: {
            score: 1,
            total: 1,
            correct: 1,
            pct: 100,
            accuracy: 100,
            category: 'grammar',
            context: 'lesson',
            grammarName: grammarName || 'It vs They',
          },
          listName: grammarName || null,
          wordList: sessionWords,
        });
      } catch (err) {
        console.debug('[ItVsTheyLesson] endSession failed', err?.message);
      }

      try {
        const ev = new CustomEvent('wa:session-ended', { detail: { summary: { correct: 1, total: 1, grammarName: grammarName || 'It vs They', category: 'grammar' } } });
        window.dispatchEvent(ev);
      } catch {}
    }
  }

  function render() {
    root.innerHTML = '';
    const stage = document.createElement('div');
    stage.className = 'lesson-stage';

    const top = document.createElement('div');
    top.className = 'lesson-topbar';
    const title = document.createElement('div');
    title.className = 'lesson-title';
    title.textContent = grammarName || 'It vs They';
    const prog = document.createElement('div');
    prog.className = 'lesson-progress';
    const stepEl = document.createElement('div');
    stepEl.className = 'lesson-step';
    const navBottom = document.createElement('div');
    navBottom.className = 'lesson-nav';
    const back = button((lang === 'ko') ? '뒤로' : 'Back');
    const next = button((lang === 'ko') ? '다음' : 'Next');
    back.style.borderColor = '#21b3be';
    back.style.color = '#ff6fb0';
    next.style.borderColor = '#21b3be';
    next.style.color = '#ff6fb0';
    back.onclick = () => { if (stepIndex > 0) { stepIndex -= 1; renderStep(); } };
    next.onclick = () => { stepIndex += 1; renderStep(); };
    navBottom.appendChild(back);
    navBottom.appendChild(next);

    top.appendChild(title);
    top.appendChild(prog);
    stage.appendChild(top);
    stage.appendChild(prog);
    stage.appendChild(stepEl);
    stage.appendChild(navBottom);
    root.appendChild(stage);

    function renderStep() {
      stepEl.classList.remove('enter');
      navBottom.style.display = 'none';
      if (stepIndex <= 0) {
        stepIndex = 0;
        renderStep1Language(stage, prog, stepEl, navBottom);
      } else if (stepIndex === 1) {
        renderStep2Intro(stage, prog, stepEl, navBottom);
      } else if (stepIndex === 2) {
        renderStep3Examples(stage, prog, stepEl, navBottom);
      } else if (stepIndex === 3) {
        renderStep4Sort(stage, prog, stepEl, navBottom);
      } else {
        stepIndex = 4;
        renderStep5Finish(stage, prog, stepEl, navBottom);
      }
      requestAnimationFrame(() => stepEl.classList.add('enter'));
    }

    renderStep();
  }

  function nextStep() {
    stepIndex = Math.min(stepIndex + 1, 4);
    render();
  }

  render();
}

function normalizePronounList(arr, pronoun) {
  const list = Array.isArray(arr) ? arr : [];
  return list.map((raw, idx) => {
    const word = resolveWord(raw?.word, pronoun, idx);
    return {
      id: raw?.id || `${pronoun}_${idx}_${word.replace(/\s+/g, '_')}`,
      word,
      article: pronoun,
      emoji: typeof raw?.emoji === 'string' ? raw.emoji : '',
      exampleSentence: typeof raw?.exampleSentence === 'string' ? raw.exampleSentence : defaultPronounSentence(word, pronoun),
      exampleSentenceKo: typeof raw?.exampleSentenceKo === 'string' ? raw.exampleSentenceKo : defaultPronounSentenceKo(word, pronoun),
      explanation: typeof raw?.explanation === 'string' ? raw.explanation : defaultPronounExplanation(pronoun),
      explanationKo: typeof raw?.explanationKo === 'string' ? raw.explanationKo : defaultPronounExplanationKo(pronoun)
    };
  });
}

function makeActivitySet(sampleIt, sampleThey, safeItList, safeTheyList) {
  const singles = sampleIt.length ? sampleIt.slice() : safeItList.slice();
  const plurals = sampleThey.length ? sampleThey.slice() : safeTheyList.slice();
  const poolIt = (singles.length ? shuffle(singles) : shuffle(safeItList.slice())).slice(0, Math.min(3, (singles.length || safeItList.length)));
  const poolThey = (plurals.length ? shuffle(plurals) : shuffle(safeTheyList.slice())).slice(0, Math.min(3, (plurals.length || safeTheyList.length)));
  const ensureIt = poolIt.length ? poolIt : shuffle(safeItList.slice()).slice(0, 3);
  const ensureThey = poolThey.length ? poolThey : shuffle(safeTheyList.slice()).slice(0, 3);
  const combined = [...ensureIt, ...ensureThey].map((item, idx) => ({
    id: item.id || `${item.article}_${idx}_${item.word}`,
    word: item.word,
    article: item.article,
    emoji: item.emoji || ''
  }));
  return shuffle(combined);
}

function buildPronounColumn(pronoun, list, lang) {
  const column = document.createElement('div');
  column.style.display = 'flex';
  column.style.flexDirection = 'column';
  column.style.gap = '12px';

  const heading = document.createElement('div');
  heading.style.cssText = 'font-weight:800;color:#19777e;text-align:center;font-size:1.05rem;';
  heading.textContent = pronoun === 'it'
    ? (lang === 'ko' ? "it (그것 - 하나)" : 'it • just one')
    : (lang === 'ko' ? "they (그것들/그 사람들 - 여러 개)" : 'they • more than one');
  column.appendChild(heading);

  const cards = list.length ? list : [];
  cards.slice(0, 4).forEach(item => {
    const card = document.createElement('div');
    card.className = 'lesson-example';
    const sentence = highlightPronoun(item.exampleSentence, pronoun);
    const korean = (lang === 'ko') ? `<div style="margin-top:4px;color:#546070;">${escapeHtml(item.exampleSentenceKo)}</div>` : '';
    card.innerHTML = `
      <div style="font-weight:700;color:#19777e;">${pronoun === 'it' ? 'It' : 'They'} → ${escapeHtml(item.word)}</div>
      <div style="margin-top:6px;">${sentence}</div>
      ${korean}
    `;
    column.appendChild(card);
  });

  return column;
}

function resolveWord(word, pronoun, idx) {
  if (word && typeof word === 'string' && word.trim()) return word.trim();
  return pronoun === 'it' ? defaultItWord(idx) : defaultTheyWord(idx);
}

function defaultItWord(idx) {
  const defaults = ['cat', 'turtle', 'cookie', 'robot'];
  return defaults[idx % defaults.length];
}

function defaultTheyWord(idx) {
  const defaults = ['cats', 'turtles', 'cookies', 'robots'];
  return defaults[idx % defaults.length];
}

function defaultPronounSentence(word, pronoun) {
  if (pronoun === 'they') return `They are ${word}.`;
  const noun = word || 'item';
  const useAn = /^[aeiou]/i.test(noun);
  return `It is ${useAn ? 'an' : 'a'} ${noun}.`;
}

function defaultPronounSentenceKo(word, pronoun) {
  if (pronoun === 'they') return `그것들은 ${word}들이에요.`;
  return `그것은 ${word}이에요.`;
}

function defaultPronounExplanation(pronoun) {
  return pronoun === 'it' ? "Use 'it' for just one thing." : "Use 'they' when there is more than one.";
}

function defaultPronounExplanationKo(pronoun) {
  return pronoun === 'it' ? "'it' (그것)은 한 개일 때 써요." : "'they' (그것들/그 사람들)는 두 개 이상일 때 써요.";
}

function uniqueItems(arr) {
  const seen = new Set();
  const out = [];
  arr.forEach(item => {
    const key = String(item.word || '').toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(item);
  });
  return out;
}

function shuffle(list) {
  return list.map(value => ({ value, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ value }) => value);
}

function button(text, kind) {
  const b = document.createElement('button');
  b.className = 'lesson-btn' + (kind === 'primary' ? ' primary' : '');
  b.textContent = text;
  return b;
}

function makeBucket(type, label) {
  const wrap = document.createElement('div');
  wrap.className = 'bucket ' + (type === 'pool' ? 'pool' : '');
  const title = document.createElement('h4');
  title.textContent = label;
  const body = document.createElement('div');
  body.className = 'bucket-body';
  body.setAttribute('data-bucket', type);
  wrap.appendChild(title);
  wrap.appendChild(body);
  return { wrap, body };
}

function makeChip(word) {
  const el = document.createElement('div');
  el.className = 'chip';
  el.draggable = true;
  el.setAttribute('data-id', word.id);
  const display = word.emoji ? `${word.emoji} ${word.word}` : word.word;
  el.textContent = display;
  el.addEventListener('dragstart', ev => {
    try { ev.dataTransfer.setData('text/plain', word.id); } catch {}
  });
  return el;
}

function displayStep(n) {
  return `Step ${n} / 5`;
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

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function highlightPronoun(sentence, pronoun) {
  const text = String(sentence || '');
  const target = pronoun === 'they' ? 'they' : 'it';
  const low = text.toLowerCase();
  const index = low.indexOf(target);
  if (index === -1) return escapeHtml(text);
  const before = text.slice(0, index);
  const match = text.slice(index, index + target.length);
  const after = text.slice(index + target.length);
  return `${escapeHtml(before)}<b>${escapeHtml(match)}</b>${escapeHtml(after)}`;
}
