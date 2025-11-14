// Grammar Lesson Runner – This vs. That
// Teaches proximity with a fading slider experience.

import { startSession, endSession } from '../../../../students/records.js';

export async function runGrammarLessonThisThat(ctx = {}) {
  const { grammarFile, grammarName, playSFX, inlineToast } = ctx;
  const root = document.getElementById('gameArea');
  if (!root) return;

  ensureBaseStyles();
  ensureThisThatStyles();

  let items = [];
  try {
    if (!grammarFile) throw new Error('No grammar file provided');
    const res = await fetch(grammarFile, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to load ${grammarFile}`);
    const data = await res.json();
    if (Array.isArray(data)) items = data;
  } catch (err) {
    console.warn('[lesson-this-that] failed to load list', err);
  }

  const fallbackThis = [
    { id: 'fb_this_phone', word: 'phone', emoji: '📱', exampleSentence: 'This is a phone.', exampleSentenceKo: '이것은 전화예요.' },
    { id: 'fb_this_book', word: 'book', emoji: '📘', exampleSentence: 'This is a book.', exampleSentenceKo: '이것은 책이에요.' },
    { id: 'fb_this_cup', word: 'cup', emoji: '☕', exampleSentence: 'This is a cup.', exampleSentenceKo: '이것은 컵이에요.' }
  ];
  const fallbackThat = [
    { id: 'fb_that_tree', word: 'tree', emoji: '🌳', exampleSentence: 'That is a tree.', exampleSentenceKo: '저것은 나무예요.' },
    { id: 'fb_that_kite', word: 'kite', emoji: '🪁', exampleSentence: 'That is a kite.', exampleSentenceKo: '저것은 연이에요.' },
    { id: 'fb_that_bus', word: 'bus', emoji: '🚌', exampleSentence: 'That is a bus.', exampleSentenceKo: '저것은 버스예요.' }
  ];

  const thisList = normalizeList(items.filter((it) => (it?.article || '').toLowerCase() === 'this'), 'this', fallbackThis);
  const thatList = normalizeList(items.filter((it) => (it?.article || '').toLowerCase() === 'that'), 'that', fallbackThat);
  const sliderSample = thisList[0] || fallbackThis[0];

  const activitySet = buildActivitySet(thisList, thatList).slice(0, 6);
  const sessionWords = items.map((it) => it?.word).filter(Boolean).slice(0, 30);

  let sessionId = null;
  let sessionClosed = false;
  try {
    sessionId = startSession({
      mode: 'grammar_lesson_this_that',
      wordList: sessionWords,
      listName: grammarName || null,
      meta: { category: 'grammar', file: grammarFile, lesson: grammarName || 'This vs That' }
    });
  } catch (err) {
    console.debug('[ThisThatLesson] startSession failed', err?.message);
  }

  let lang = detectLang();
  lang = (lang === 'ko' || lang === 'kr') ? 'ko' : 'en';
  let stepIndex = 0;

  function renderLanguageStep(stage, prog, stepEl) {
    prog.textContent = '';
    stepEl.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:40px;text-align:center;width:90%;max-width:300px;';
    const title = document.createElement('div');
    title.style.cssText = 'font-size:clamp(1.4rem,4.5vmin,2rem);font-weight:800;color:#19777e;';
    title.textContent = (lang === 'ko') ? '언어를 선택하세요' : 'Choose your language';
    const enBtn = buildLangButton('English');
    enBtn.onclick = () => { lang = 'en'; nextStep(); };
    const koBtn = buildLangButton('한국어');
    koBtn.onclick = () => { lang = 'ko'; nextStep(); };
    wrap.appendChild(title);
    wrap.appendChild(enBtn);
    wrap.appendChild(koBtn);
    stepEl.appendChild(wrap);
  }

  function renderSliderStep(stage, prog, stepEl) {
  prog.textContent = displayStep(1, lang);
    stepEl.innerHTML = '';

    const nearItem = sliderSample || thisList[0] || fallbackThis[0];
    const farItem = thatList[0] || fallbackThat[0];

    const intro = document.createElement('div');
    intro.className = 'lesson-body';
    intro.innerHTML = (lang === 'ko')
      ? "가까운 것은 <span class=\"tt-highlight\">this</span>(이것), 멀리 있는 것은 <span class=\"tt-highlight\">that</span>(저것)이라고 말해요. 슬라이더를 움직여 보세요!"
      : "When something is close we say <span class=\"tt-highlight\">this</span>; when it is far we say <span class=\"tt-highlight\">that</span>. Slide to feel the change.";
    stepEl.appendChild(intro);

    const scene = document.createElement('div');
    scene.className = 'tt-scene';

    const row = document.createElement('div');
    row.className = 'tt-row';

    const you = document.createElement('div');
    you.className = 'tt-you';
    you.textContent = 'You 🧍‍♂️';

  const bar = document.createElement('div');
  bar.className = 'tt-bar';

    const object = document.createElement('div');
    object.className = 'tt-object';
  object.textContent = nearItem?.emoji || '📘';

    row.appendChild(you);
    row.appendChild(bar);
    row.appendChild(object);
    scene.appendChild(row);

    const labelWrap = document.createElement('div');
    labelWrap.className = 'tt-label-wrap';
    const thisLabel = document.createElement('div');
    thisLabel.className = 'tt-label';
    thisLabel.textContent = 'This is a phone.';
    const thatLabel = document.createElement('div');
    thatLabel.className = 'tt-label';
    thatLabel.textContent = 'That is a phone.';
    labelWrap.appendChild(thisLabel);
    labelWrap.appendChild(thatLabel);

    const labelKoWrap = document.createElement('div');
    labelKoWrap.className = 'tt-label-wrap tt-label-ko';
    const thisKo = document.createElement('div');
    thisKo.className = 'tt-label';
    thisKo.textContent = '이것은 전화예요.';
    const thatKo = document.createElement('div');
    thatKo.className = 'tt-label';
    thatKo.textContent = '저것은 전화예요.';
    labelKoWrap.appendChild(thisKo);
    labelKoWrap.appendChild(thatKo);

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'tt-slider';
  slider.min = '0';
  slider.max = '60';
  slider.value = '8';

    const tip = document.createElement('div');
    tip.className = 'tt-tip';
    tip.textContent = (lang === 'ko')
      ? '가까이 끌어오면 이것, 멀리 보내면 저것으로 바뀌어요.'
      : 'Drag close for "this" and push away for "that".';

    scene.appendChild(labelWrap);
    scene.appendChild(labelKoWrap);
    scene.appendChild(slider);
    scene.appendChild(tip);
    stepEl.appendChild(scene);

    const updateSlider = () => {
  const val = Number(slider.value);
  const distance = 10 + val * 2;
      bar.style.width = `${distance}px`;
  const blend = clamp((val - 18) / 26, 0, 1);
      thisLabel.style.opacity = 1 - blend;
      thatLabel.style.opacity = blend;
      thisKo.style.opacity = 1 - blend;
      thatKo.style.opacity = blend;
      bar.style.background = `linear-gradient(90deg, rgba(33,179,190,0.7), rgba(120,120,255,${0.4 + blend * 0.4}))`;
      object.style.transform = `translateX(${blend * 6}px)`;
      const showFar = blend > 0.55;
      const activeNear = nearItem || { exampleSentence: 'This is near me.', exampleSentenceKo: '이것은 내 옆에 있어요.', emoji: '📘' };
      const activeFar = farItem || { exampleSentence: 'That is over there.', exampleSentenceKo: '저것은 저쪽에 있어요.', emoji: '🏔️' };
      object.textContent = showFar ? activeFar.emoji : activeNear.emoji;
      thisLabel.innerHTML = highlightSentence(activeNear.exampleSentence, 'en');
      thatLabel.innerHTML = highlightSentence(activeFar.exampleSentence, 'en');
      thisKo.innerHTML = highlightSentence(activeNear.exampleSentenceKo, 'ko');
      thatKo.innerHTML = highlightSentence(activeFar.exampleSentenceKo, 'ko');
    };

    slider.addEventListener('input', updateSlider);
    requestAnimationFrame(updateSlider);

    const nav = buildNavRow(() => { stepIndex = Math.max(0, stepIndex - 1); render(); }, nextStep, lang);
    stepEl.appendChild(nav);
  }

  function renderExampleStep(stage, prog, stepEl) {
  prog.textContent = displayStep(2, lang);
    stepEl.innerHTML = '';

    const intro = document.createElement('div');
    intro.className = 'lesson-body';
    intro.innerHTML = (lang === 'ko')
      ? "<span class=\"tt-highlight\">this</span>(이것)은 바로 여기에 있는 물건, <span class=\"tt-highlight\">that</span>(저것)은 저쪽에 있는 물건이에요." 
      : "<span class=\"tt-highlight\">this</span> talks about something right here, <span class=\"tt-highlight\">that</span> points to something over there.";
    stepEl.appendChild(intro);

    const grid = document.createElement('div');
    grid.className = 'lesson-examples';
    grid.appendChild(buildExampleColumn('this', thisList, lang));
    grid.appendChild(buildExampleColumn('that', thatList, lang));
    stepEl.appendChild(grid);

    const nav = buildNavRow(() => { stepIndex = Math.max(0, stepIndex - 1); render(); }, nextStep, lang);
    stepEl.appendChild(nav);
  }

  function renderSortingStep(stage, prog, stepEl) {
    prog.textContent = displayStep(3, lang);
    stepEl.innerHTML = '';

    const body = document.createElement('div');
    body.className = 'lesson-body';
    body.innerHTML = (lang === 'ko')
      ? "문장을 눌러서 <span class=\"tt-highlight\">this</span>(이것) 바구니 또는 <span class=\"tt-highlight\">that</span>(저것) 바구니에 넣어 보세요." 
      : "Tap each strip and drop it into the <span class=\"tt-highlight\">this</span> basket or the <span class=\"tt-highlight\">that</span> basket.";
    stepEl.appendChild(body);

    const buckets = document.createElement('div');
    buckets.className = 'buckets tt-buckets';
    const pool = makeBucket('pool', lang === 'ko' ? '문장 모음' : 'Sentence Pool');
    const bucketThis = makeBucket('this', lang === 'ko' ? 'this (이것)' : 'this (near me)');
    const bucketThat = makeBucket('that', lang === 'ko' ? 'that (저것)' : 'that (far away)');

    [pool.wrap, bucketThis.wrap, bucketThat.wrap].forEach((wrap) => buckets.appendChild(wrap));
    stepEl.appendChild(buckets);

    activitySet.forEach((item) => pool.body.appendChild(makeChip(item)));

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

    [pool.wrap, bucketThis.wrap, bucketThat.wrap].forEach((wrap) => {
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
    checkBtn.style.marginTop = '16px';
    stepEl.appendChild(checkBtn);

    const nav = document.createElement('div');
    nav.className = 'lesson-nav';
    nav.style.marginTop = '18px';
    const backBtn = buildPrimaryButton(lang === 'ko' ? '뒤로' : 'Back');
    backBtn.style.background = '#fff';
    backBtn.style.color = '#ff6fb0';
    backBtn.style.borderColor = '#ff6fb0';
    backBtn.onclick = () => { stepIndex = Math.max(0, stepIndex - 1); render(); };
    nav.appendChild(backBtn);
    stepEl.appendChild(nav);

    let continueBtn = null;

    checkBtn.onclick = () => {
      const thisIds = new Set(activitySet.filter((item) => item.article === 'this').map((item) => item.id));
      const thatIds = new Set(activitySet.filter((item) => item.article === 'that').map((item) => item.id));

      const mark = (bucketBody, allowed) => {
        bucketBody.querySelectorAll('.chip').forEach((chip) => {
          const ok = allowed.has(chip.dataset.id);
          chip.classList.toggle('good', ok);
          chip.classList.toggle('bad', !ok);
        });
      };

      mark(bucketThis.body, thisIds);
      mark(bucketThat.body, thatIds);
      mark(pool.body, new Set());

      // Remove any existing message
      const existingMsg = stepEl.querySelector('.completion-message');
      if (existingMsg) existingMsg.remove();

      const wrong = stepEl.querySelectorAll('.chip.bad').length;
      if (wrong === 0 && pool.body.childElementCount === 0) {
        playSFX?.('correct');
        
        // Add message at top
        const message = document.createElement('div');
        message.className = 'completion-message';
        message.style.cssText = 'background:#e8f5e9;border:2px solid #4caf50;border-radius:12px;padding:14px 16px;text-align:center;color:#256029;font-weight:800;margin-bottom:16px;font-size:1.05rem;';
        message.textContent = lang === 'ko' ? '완벽해요! 이것과 저것을 잘 골랐어요.' : 'Great job! You sorted this vs. that.';
        stepEl.insertBefore(message, stepEl.firstChild);
        
        if (!continueBtn) {
          continueBtn = buildPrimaryButton(lang === 'ko' ? '다음 단계로' : 'Next');
          continueBtn.style.background = '#fff';
          continueBtn.style.color = '#ff6fb0';
          continueBtn.style.borderColor = '#ff6fb0';
          continueBtn.onclick = () => nextStep();
          nav.appendChild(continueBtn);
        }
      } else {
        playSFX?.('wrong');
        
        // Add message at top
        const message = document.createElement('div');
        message.className = 'completion-message';
        message.style.cssText = 'background:#ffebee;border:2px solid #f44336;border-radius:12px;padding:14px 16px;text-align:center;color:#b71c1c;font-weight:800;margin-bottom:16px;font-size:1.05rem;';
        message.textContent = lang === 'ko' ? '빨간 카드를 다시 옮겨 보세요.' : 'Move the red strips to the other basket.';
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
    body.innerHTML = (lang === 'ko')
      ? '<div style="font-weight:800;color:#19777e">이제 가까운 것은 이것, 먼 것은 저것이라고 말할 수 있어요!</div><div class="stars">⭐⭐⭐⭐⭐</div>'
      : '<div style="font-weight:800;color:#19777e">Now you know when to say this or that!</div><div class="stars">⭐⭐⭐⭐⭐</div>';
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
          mode: 'grammar_lesson_this_that',
          summary: {
            score: 1,
            total: 1,
            correct: 1,
            pct: 100,
            accuracy: 100,
            category: 'grammar',
            context: 'lesson',
            grammarName: grammarName || 'This vs That'
          },
          listName: grammarName || null,
          wordList: sessionWords
        });
      } catch (err) {
        console.debug('[ThisThatLesson] endSession failed', err?.message);
      }
      try {
        const ev = new CustomEvent('wa:session-ended', { detail: { summary: { correct: 1, total: 1, grammarName: grammarName || 'This vs That', category: 'grammar' } } });
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
    title.textContent = grammarName || 'This vs. That';
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
      else if (stepIndex === 1) renderSliderStep(stage, prog, stepEl);
      else if (stepIndex === 2) renderExampleStep(stage, prog, stepEl);
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

function normalizeList(list, article, fallback) {
  const source = list && list.length ? list : fallback;
  return source.map((item, idx) => ({
    id: item.id || `${article}_${idx}`,
    word: item.word || (article === 'this' ? 'item' : 'thing'),
    article,
    emoji: item.emoji || (article === 'this' ? '📗' : '🏔️'),
    exampleSentence: item.exampleSentence || (article === 'this' ? 'This is near me.' : 'That is over there.'),
    exampleSentenceKo: item.exampleSentenceKo || (article === 'this' ? '이것은 내 옆에 있어요.' : '저것은 저쪽에 있어요.'),
  }));
}

function buildActivitySet(thisList, thatList) {
  const sampleThis = shuffle(thisList).slice(0, 3);
  const sampleThat = shuffle(thatList).slice(0, 3);
  return shuffle([...sampleThis, ...sampleThat]);
}

function makeChip(item) {
  const chip = document.createElement('div');
  chip.className = 'chip';
  chip.dataset.id = item.id;
  chip.dataset.article = item.article;
  chip.textContent = `${item.emoji} ${item.exampleSentence}`;
  return chip;
}

function buildExampleColumn(label, list, lang) {
  const wrap = document.createElement('div');
  wrap.className = 'lesson-example-column';
  const header = document.createElement('div');
  header.className = 'tt-column-header';
  header.textContent = label === 'this'
    ? (lang === 'ko' ? 'this (이것)' : 'this (near)')
    : (lang === 'ko' ? 'that (저것)' : 'that (far)');
  wrap.appendChild(header);
  list.slice(0, 4).forEach((item) => {
    const en = highlightSentence(item.exampleSentence, 'en');
    const ko = highlightSentence(item.exampleSentenceKo, 'ko');
    const card = document.createElement('div');
    card.className = 'lesson-example';
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
        <span style="font-size:1.6rem;">${item.emoji}</span>
        <span style="font-weight:800;color:#19777e;">${en}</span>
      </div>
      <div style="font-size:1rem;color:#5f6b75;margin-top:8px;font-weight:700;">${ko}</div>
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

function buildLangButton(label) {
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

function displayStep(idx, lang) {
  if (idx === 1) return lang === 'ko' ? '1단계 / 총 3단계' : 'Step 1 of 3';
  if (idx === 2) return lang === 'ko' ? '2단계 / 총 3단계' : 'Step 2 of 3';
  if (idx === 3) return lang === 'ko' ? '3단계 / 총 3단계' : 'Step 3 of 3';
  return '';
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

function ensureThisThatStyles() {
  if (document.getElementById('wa-lesson-this-that-styles')) return;
  const st = document.createElement('style');
  st.id = 'wa-lesson-this-that-styles';
  st.textContent = `
    #gameArea .tt-scene{display:flex;flex-direction:column;gap:18px;align-items:center;margin:18px auto;width:100%;max-width:520px}
  #gameArea .tt-row{display:flex;align-items:center;gap:4px;font-size:1.1rem;color:#19777e;font-weight:700}
    #gameArea .tt-you{white-space:nowrap}
    #gameArea .tt-bar{height:6px;width:100px;border-radius:999px;background:linear-gradient(90deg, rgba(33,179,190,0.7), rgba(120,120,255,0.4));transition:width .25s ease, background .25s ease}
    #gameArea .tt-object{font-size:2.5rem;transition:transform .25s ease}
    #gameArea .tt-label-wrap{position:relative;width:100%;min-height:3.2rem;display:flex;align-items:center;justify-content:center;font-weight:800;color:#19777e;font-size:clamp(1.25rem,3.8vmin,1.6rem)}
    #gameArea .tt-label-wrap.tt-label-ko{font-size:clamp(1.15rem,3.4vmin,1.32rem);color:#4b5864;font-weight:800}
    #gameArea .tt-label{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:0 12px;text-align:center;transition:opacity .25s ease;opacity:0}
    #gameArea .tt-label:first-child{opacity:1}
    #gameArea .tt-slider{width:100%;accent-color:#21b3be}
    #gameArea .tt-tip{font-size:0.95rem;color:#5f6b75}
    #gameArea .tt-column-header{font-weight:800;color:#19777e;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.05em;font-size:1rem}
    #gameArea .tt-buckets{grid-template-columns:1fr 1fr 1fr}
    @media (max-width:720px){#gameArea .tt-buckets{grid-template-columns:1fr}}
    #gameArea .tt-highlight{color:#ff9f43;font-weight:800}
  `;
  document.head.appendChild(st);
}

function highlightSentence(text, lang) {
  if (!text) return '';
  const clean = String(text);
  if (lang === 'ko') {
    return clean.replace(/이것(?!\s)/g, '<span class="tt-highlight">이것</span> ').replace(/저것(?!\s)/g, '<span class="tt-highlight">저것</span> ');
  }
  return clean.replace(/([Tt]his)(\s)/g, '<span class="tt-highlight">$1</span>$2').replace(/([Tt]hat)(\s)/g, '<span class="tt-highlight">$1</span>$2');
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

function shuffle(arr) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
