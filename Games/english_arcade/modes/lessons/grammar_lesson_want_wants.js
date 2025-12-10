// Grammar Lesson Runner ??Want vs. Wants
// Lightweight lesson that explains verb agreement for desires.

import { startSession, endSession } from '../../../../students/records.js';

export async function runGrammarLessonWantWants(ctx = {}) {
  const { grammarFile, grammarName, playSFX, inlineToast } = ctx;
  const root = document.getElementById('gameArea');
  if (!root) return;

  ensureBaseStyles();
  ensureWantWantsStyles();

  let items = [];
  try {
    if (!grammarFile) throw new Error('No grammar file provided');
    const res = await fetch(grammarFile, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to load ${grammarFile}`);
    const data = await res.json();
    if (Array.isArray(data)) items = data;
  } catch (err) {
    console.warn('[lesson-want-wants] failed to load list', err);
  }

  const wantList = normalizeList(items.filter((it) => isVerb(it, 'want')), fallbackWant);
  const wantsList = normalizeList(items.filter((it) => isVerb(it, 'wants')), fallbackWants);
  const sortingPool = buildSortingPool(wantList, wantsList);

  const sessionWords = items.map((it) => it?.word).filter(Boolean).slice(0, 30);
  let sessionId = null;
  let sessionClosed = false;
  try {
    sessionId = startSession({
      mode: 'grammar_lesson_want_wants',
      wordList: sessionWords,
      listName: grammarFile || grammarName || null,
      meta: { category: 'grammar', file: grammarFile, lesson: grammarName || 'Want vs Wants', level: 'Level 1 Grammar' }
    });
  } catch (err) {
    console.debug('[WantWantsLesson] startSession failed', err?.message);
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
    title.textContent = grammarName || 'Want vs. Wants';
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
      ? "주어???�라 <b>want</b> (?�해??, <b>wants</b> (?�해??가 바뀌어?? 버튼???�러 ?�떤 말을 ?�는지 ?�인??보세??"
      : "The verb <b>want</b> or <b>wants</b> changes with the subject. Tap each button to see which one fits!";

    const subjectRow = document.createElement('div');
    subjectRow.className = 'amareis-subject-row';

    const cardDisplay = document.createElement('div');
    cardDisplay.className = 'amareis-highlight-card';

    const subjectSets = buildSubjectSets(wantList, wantsList);
    let current = null;
    let currentPronoun = 'want';
    let wantPointer = 0;
    let wantsPointer = 0;

    const renderCard = (set, advance) => {
      if (!set) return;
      current = set;
      currentPronoun = set.id;
      
      // Advance to next example if requested
      if (advance) {
        if (set.id === 'want') {
          wantPointer = (wantPointer + 1) % wantList.length;
          const nextExample = wantList[wantPointer];
          set.sentenceEn = nextExample.exampleSentence || set.sentenceEn;
          set.emoji = nextExample.emoji || set.emoji;
        } else {
          wantsPointer = (wantsPointer + 1) % wantsList.length;
          const nextExample = wantsList[wantsPointer];
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
    const nextExampleBtn = buildSecondaryButton(lang === 'ko' ? '?�음 ?�제' : 'Next Example');
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
      ? "<b>???�람/물건</b>?� <b>wants</b> (?�해??<br/><b>?�러 ?�람/물건</b>?� <b>want</b> (?�해??<br/>버튼???�러 ?�제�??�인??보세??"
      : "<b>One person/thing</b> uses <b>wants</b><br/><b>More than one</b> uses <b>want</b><br/>Tap each button to see examples!";

    const typeRow = document.createElement('div');
    typeRow.className = 'amareis-subject-row';

    const cardDisplay = document.createElement('div');
    cardDisplay.className = 'amareis-highlight-card';

    // Filter for noun examples (excluding pronouns like I, you, we, they, he, she, it)
    const nounWantsExamples = wantsList.filter(item => {
      const word = String(item.word || '').toLowerCase();
      return !['i', 'you', 'we', 'they', 'he', 'she', 'it'].includes(word);
    });
    
    const nounWantExamples = wantList.filter(item => {
      const word = String(item.word || '').toLowerCase();
      return !['i', 'you', 'we', 'they', 'he', 'she', 'it'].includes(word);
    });

    const exampleSets = [
      {
        id: 'singular',
        label: lang === 'ko' ? '??�?wants)\n?��' : 'One (wants)\n?��',
        examples: nounWantsExamples.length ? nounWantsExamples : wantsList,
        pointer: 0,
      },
      {
        id: 'plural',
        label: lang === 'ko' ? '?�러 �?want)\n?��' : 'Many (want)\n?��',
        examples: nounWantExamples.length ? nounWantExamples : wantList,
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
        <div class="verb-label">${example.word || typeId}</div>
        <div class="verb-emoji">${example.emoji}</div>
        <div class="verb-sentence">${escapeHtml(example.exampleSentence)}</div>
        <div class="verb-korean">${escapeHtml(example.exampleSentenceKo)}</div>
      `;
    };

    exampleSets.forEach((set) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.id = set.id;
      btn.innerHTML = set.label.replace(/\n/, '<br/>');
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

    // Next Example button
    const nextExampleBtn = buildSecondaryButton(lang === 'ko' ? '?�음 ?�제' : 'Next Example');
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
    intro.innerHTML = lang === 'ko'
      ? '문장???�러 <b>want</b> ?�는 <b>wants</b> 바구?�에 ?�어 보세?? 모두 맞으�??�음 ?�계�??�어�????�어??'
      : 'Tap each strip and move it into the <b>want</b> or <b>wants</b> basket. Get them all correct to continue!';
    stepEl.appendChild(intro);

  const buckets = document.createElement('div');
  buckets.className = 'amareis-buckets buckets-two';

    const pool = makeBucket('pool', lang === 'ko' ? '문장 모음' : 'Sentence Pool');
    pool.wrap.classList.add('bucket-pool');
    const wantBucket = makeBucket('want', lang === 'ko' ? 'want (?�해??' : 'want');
    const wantsBucket = makeBucket('wants', lang === 'ko' ? 'wants (?�해??' : 'wants');

    [pool.wrap, wantBucket.wrap, wantsBucket.wrap].forEach((wrap) => buckets.appendChild(wrap));
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

    [wantBucket.wrap, wantsBucket.wrap].forEach((wrap) => {
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
    nav.style.marginTop = '18px';
    const backBtn = buildSecondaryButton(lang === 'ko' ? '?�로' : 'Back');
    backBtn.onclick = () => prevStep();
    nav.appendChild(backBtn);
    stepEl.appendChild(nav);

    let continueBtn = null;

    checkBtn.onclick = () => {
      const answers = {
        want: new Set(sortingPool.filter((item) => item.answer === 'want').map((item) => item.id)),
        wants: new Set(sortingPool.filter((item) => item.answer === 'wants').map((item) => item.id)),
      };

      stepEl.querySelectorAll('.chip').forEach((chip) => chip.classList.remove('good', 'bad'));

      const markBucket = (bucketBody, key) => {
        bucketBody.querySelectorAll('.chip').forEach((chip) => {
          const ok = answers[key].has(chip.dataset.id);
          chip.classList.add(ok ? 'good' : 'bad');
        });
      };

      markBucket(wantBucket.body, 'want');
      markBucket(wantsBucket.body, 'wants');

      const leftovers = pool.body.querySelectorAll('.chip').length;
      const wrong = stepEl.querySelectorAll('.chip.bad').length;
      const allPlaced = leftovers === 0;
      const allCorrect = wrong === 0 && allPlaced;

      const existingMsg = stepEl.querySelector('.completion-message');
      if (existingMsg) existingMsg.remove();

      if (allCorrect) {
        playSFX?.('correct');
        const message = document.createElement('div');
        message.className = 'completion-message';
        message.style.cssText = 'background:#e8f5e9;border:2px solid #4caf50;border-radius:12px;padding:14px 16px;text-align:center;color:#256029;font-weight:800;margin-bottom:16px;font-size:1.05rem;';
        message.textContent = lang === 'ko' ? '?�벽?�요! Want?� Wants�???구분?�어??' : 'Great job! You know want vs. wants!';
        stepEl.insertBefore(message, stepEl.firstChild);

        if (!continueBtn) {
          continueBtn = buildPrimaryButton(lang === 'ko' ? '?�음 ?�계�? : 'Next');
          continueBtn.style.marginTop = '12px';
          continueBtn.onclick = () => nextStep();
          nav.appendChild(continueBtn);
        }
      } else {
        playSFX?.('wrong');
        const message = document.createElement('div');
        message.className = 'completion-message';
        message.style.cssText = 'background:#ffebee;border:2px solid #f44336;border-radius:12px;padding:14px 16px;text-align:center;color:#b71c1c;font-weight:800;margin-bottom:16px;font-size:1.05rem;';
        message.textContent = lang === 'ko' ? '빨간 카드�??�시 ??�� 보세??' : 'Move the red cards to the correct basket.';
        stepEl.insertBefore(message, stepEl.firstChild);
      }
    };
  }

  function renderFinishStep(stepEl) {
    stepEl.innerHTML = '';
    stepEl.style.display = 'flex';
    stepEl.style.flexDirection = 'column';
    stepEl.style.alignItems = 'center';
    stepEl.style.gap = '24px';
    stepEl.style.padding = '32px 16px';

    const congratsMsg = document.createElement('div');
    congratsMsg.style.cssText = 'font-size:1.6rem;font-weight:800;color:#19777e;text-align:center;';
    congratsMsg.textContent = lang === 'ko'
      ? '축하?�요! Want?� Wants�?배웠?�요! ?��'
      : 'Congratulations! You learned want vs. wants! ?��';
    stepEl.appendChild(congratsMsg);

    const starsDiv = document.createElement('div');
    starsDiv.style.cssText = 'font-size:3rem;';
    starsDiv.textContent = '⭐⭐⭐⭐�?;
    stepEl.appendChild(starsDiv);

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
    stepEl.appendChild(backBtn);

    if (!sessionClosed) {
      sessionClosed = true;
      try {
        endSession(sessionId, {
          mode: 'grammar_lesson_want_wants',
          summary: {
            score: 1,
            total: 1,
            correct: 1,
            pct: 100,
            accuracy: 100,
            category: 'grammar',
            context: 'lesson',
            grammarName: grammarName || 'Want vs Wants'
          },
          listName: grammarFile || grammarName || null,
          wordList: sessionWords
        });
      } catch (err) {
        console.debug('[WantWantsLesson] endSession failed', err?.message);
      }
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

function makeChip(item) {
  const chip = document.createElement('div');
  chip.className = 'chip';
  chip.dataset.answer = item.answer;
  chip.dataset.id = item.id;
  chip.textContent = item.text;
  return chip;
}

function buildSortingPool(wantList, wantsList) {
  const wantPool = shuffle(wantList).slice(0, 5).map((item, idx) => ({
    id: item.id || `want_${idx}`,
    answer: 'want',
    text: item.word || 'I',
  }));
  const wantsPool = shuffle(wantsList).slice(0, 5).map((item, idx) => ({
    id: item.id || `wants_${idx}`,
    answer: 'wants',
    text: item.word || 'He',
  }));
  return shuffle([...wantPool, ...wantsPool]);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildSubjectSets(wantList, wantsList) {
  const pick = (arr, fallback) => arr.length ? arr[0] : fallback;
  const wantExample = pick(wantList, fallbackWant[0]);
  const wantsExample = pick(wantsList, fallbackWants[0]);
  return [
    {
      id: 'want',
      verb: 'want',
      emoji: wantExample.emoji || '?��',
      sentenceEn: wantExample.exampleSentence || 'I want a toy.',
      sentenceKo: wantExample.exampleSentenceKo || '?�는 ?�난감을 ?�해??',
      tipEn: "Use 'want' with I, you, we, they, or plural nouns.",
      tipKo: "I, you, we, they 그리�?복수 명사?� 'want'�??�요.",
      label: 'I / You / We / They'
    },
    {
      id: 'wants',
      verb: 'wants',
      emoji: wantsExample.emoji || '?��',
      sentenceEn: wantsExample.exampleSentence || 'He wants a bicycle.',
      sentenceKo: wantsExample.exampleSentenceKo || '그는 ?�전거�? ?�해??',
      tipEn: "Use 'wants' with he, she, it, or one person or thing.",
      tipKo: "he, she, it 그리�????�람/물건�?'wants'�??�요.",
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
    emoji: item.emoji || '??,
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
  const backBtn = buildSecondaryButton(lang === 'ko' ? '?�로' : 'Back');
  backBtn.onclick = () => onBack();
  const nextBtn = buildPrimaryButton(lang === 'ko' ? '?�음' : 'Next');
  nextBtn.onclick = () => onNext();
  nav.appendChild(backBtn);
  nav.appendChild(nextBtn);
  return nav;
}

function makeBucket(key, label) {
  const wrap = document.createElement('div');
  wrap.className = 'amareis-bucket';
  const title = document.createElement('h4');
  title.textContent = label;
  const body = document.createElement('div');
  body.className = 'bucket-body';
  body.dataset.bucket = key;
  wrap.appendChild(title);
  wrap.appendChild(body);
  return { wrap, body };
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

const fallbackWant = [
  { id: 'fb_want_i', word: 'I', prompt: 'I ___ a toy.', exampleSentence: 'I want a toy.', exampleSentenceKo: '?�는 ?�난감을 ?�해??', emoji: '?��' },
  { id: 'fb_want_we', word: 'We', prompt: 'We ___ to play.', exampleSentence: 'We want to play.', exampleSentenceKo: '?�리???��??�어??', emoji: '?? },
  { id: 'fb_want_they', word: 'They', prompt: 'They ___ ice cream.', exampleSentence: 'They want ice cream.', exampleSentenceKo: '그들?� ?�이?�크림을 ?�해??', emoji: '?��' },
  { id: 'fb_want_kids', word: 'The kids', prompt: 'The kids ___ candy.', exampleSentence: 'The kids want candy.', exampleSentenceKo: '?�이?��? ?�탕???�해??', emoji: '?��' }
];

const fallbackWants = [
  { id: 'fb_wants_he', word: 'He', prompt: 'He ___ a bike.', exampleSentence: 'He wants a bike.', exampleSentenceKo: '그는 ?�전거�? ?�해??', emoji: '?��' },
  { id: 'fb_wants_she', word: 'She', prompt: 'She ___ a book.', exampleSentence: 'She wants a book.', exampleSentenceKo: '그�???책을 ?�해??', emoji: '?��' },
  { id: 'fb_wants_it', word: 'It', prompt: 'It ___ water.', exampleSentence: 'It wants water.', exampleSentenceKo: '그것?� 물을 ?�해??', emoji: '?��' },
  { id: 'fb_wants_cat', word: 'My cat', prompt: 'My cat ___ to sleep.', exampleSentence: 'My cat wants to sleep.', exampleSentenceKo: '??고양?�는 ?�고 ?�어??', emoji: '?��' }
];

function ensureBaseStyles() {
  if (document.getElementById('wa-lesson-styles')) return;
  const st = document.createElement('style');
  st.id = 'wa-lesson-styles';
  st.textContent = `
    #gameArea .lesson-stage{display:flex;flex-direction:column;align-items:center;justify-content:flex-start;height:100%;gap:clamp(14px,4vmin,32px);padding:clamp(12px,3.2vmin,26px);max-width:820px;width:100%;box-sizing:border-box;margin:0 auto;font-family:'Poppins','Noto Sans KR','Nanum Gothic','Apple SD Gothic Neo','Malgun Gothic',system-ui,Arial,sans-serif;background:linear-gradient(180deg,#f8feff 0%, #ffffff 60%)}
    #gameArea .lesson-topbar{width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px}
    #gameArea .lesson-title{font-weight:800;color:#19777e;font-size:clamp(1.15rem,3.8vmin,1.7rem)}
    #gameArea .lesson-progress{font-size:.95rem;color:#666;font-weight:600}
    #gameArea .lesson-step{opacity:0;transform:translateY(8px);transition:opacity .22s ease,transform .22s ease;width:100%}
    #gameArea .lesson-step.enter{opacity:1;transform:translateY(0)}
    #gameArea .lesson-body{text-align:center;font-size:clamp(1.02rem,3.3vmin,1.22rem);line-height:1.45;color:#27323a}
    #gameArea .lesson-nav{margin-top:auto;display:flex;gap:16px;align-items:center;justify-content:center;width:100%}
    #gameArea .lesson-btn{appearance:none;border:2px solid #21b3be;background:transparent;color:#ff6fb0;border-radius:12px;padding:10px 16px;font-weight:800;cursor:pointer;box-shadow:0 2px 6px rgba(33,181,192,0.15);transition:transform .15s ease, box-shadow .15s ease}
    #gameArea .lesson-btn:hover{transform:translateY(-1px);box-shadow:0 6px 16px rgba(33,181,192,0.25);background:rgba(33,181,192,0.08)}
    #gameArea .lesson-btn.primary{background:transparent;color:#ff6fb0;border-color:#21b3be}
  #gameArea .amareis-subject-row{display:flex;gap:18px;justify-content:center;flex-wrap:wrap;width:100%;margin:24px 0 18px}
  #gameArea .amareis-subject-row button{padding:12px 18px;border:2px solid #93cbcf;background:#fff;color:#19777e;border-radius:12px;font-weight:700;cursor:pointer;transition:all .15s ease}
    #gameArea .amareis-subject-row button:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(33,179,190,0.15)}
    #gameArea .amareis-subject-row button.active{background:#21b3be;color:#fff;border-color:#21b3be}
  #gameArea .amareis-highlight-card{border:3px solid #d1e6f0;border-radius:16px;padding:22px 20px;background:#fbffff;min-height:190px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;max-width:420px;margin:0 auto;box-shadow:0 14px 36px -20px rgba(25,119,126,0.28)}
    #gameArea .verb-label{font-size:1.4rem;font-weight:800;color:#ff6fb0}
    #gameArea .verb-emoji{font-size:3rem}
    #gameArea .verb-sentence{font-size:1.2rem;font-weight:700;color:#19777e}
    #gameArea .verb-korean{font-size:1rem;color:#5f6b75;font-weight:600}
    #gameArea .verb-tip{font-size:0.95rem;color:#666;font-style:italic}
  #gameArea .amareis-buckets{display:grid;grid-template-columns:1fr;gap:18px;margin:20px auto 0;width:100%;max-width:780px}
  #gameArea .amareis-buckets.buckets-two{grid-template-columns:1fr}
  @media (min-width:720px){#gameArea .amareis-buckets.buckets-two{grid-template-columns:1fr 1fr}}
  #gameArea .amareis-buckets .bucket-pool{grid-column:1 / -1}
  @media (min-width:720px){#gameArea .amareis-buckets .bucket-pool{grid-column:1 / span 2}}
  #gameArea .amareis-bucket{border:2px dashed #b0e2e4;border-radius:16px;background:linear-gradient(180deg,#fbffff 0%,#ffffff 100%);padding:12px;display:flex;flex-direction:column;gap:8px;box-shadow:0 2px 10px rgba(0,0,0,.05)}
  #gameArea .amareis-bucket h4{margin:0;font-size:1.05rem;color:#19777e;font-weight:800;text-transform:capitalize}
  #gameArea .amareis-bucket .bucket-body{display:flex;flex-wrap:wrap;gap:8px;cursor:pointer;align-items:flex-start;align-content:flex-start}
  #gameArea .chip{user-select:none;border:2px solid #93cbcf;background:#ffffff;color:#19777e;border-radius:12px;padding:8px 14px;font-weight:700;cursor:pointer;text-align:center;line-height:1.2;white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.06);transition:transform .12s ease, box-shadow .12s ease}
    #gameArea .chip:hover{transform:scale(1.04);box-shadow:0 6px 16px rgba(0,0,0,.12)}
    #gameArea .chip.selected{outline:3px solid #21b3be;border-color:#21b3be;background:#e6f7f8}
    #gameArea .chip.bad{border-color:#f44336;color:#c62828;background:#ffebee}
    #gameArea .chip.good{border-color:#4caf50;color:#2e7d32;background:#e8f5e9}
    #gameArea .completion-message{font-size:1rem;font-weight:800;border-radius:8px;padding:12px;margin-bottom:12px}
  `;
  document.head.appendChild(st);
}

function ensureWantWantsStyles() {
  if (document.getElementById('wa-lesson-want-wants-styles')) return;
  const st = document.createElement('style');
  st.id = 'wa-lesson-want-wants-styles';
  st.textContent = `
    #gameArea .want-wants-scene{display:flex;flex-direction:column;gap:18px;align-items:center;margin:18px auto;width:100%;max-width:520px}
  `;
  document.head.appendChild(st);
}
