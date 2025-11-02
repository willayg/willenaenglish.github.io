// Grammar Lesson Runner (step-by-step, EN/KR)
// Lightweight lesson engine that loads a companion .lesson.json file next to the grammar data
// Example: data/grammar/level1/articles.json -> data/grammar/level1/articles.lesson.json

export async function runGrammarLesson(ctx = {}) {
  const {
    grammarFile,
    grammarName,
    playSFX,
    inlineToast,
  } = ctx;

  const root = document.getElementById('gameArea');
  if (!root) return;

  // Inject minimal CSS for lesson layout and animations (scoped to #gameArea)
  if (!document.getElementById('wa-lesson-styles')) {
    const st = document.createElement('style');
    st.id = 'wa-lesson-styles';
    st.textContent = `
      #gameArea .lesson-stage{display:flex;flex-direction:column;align-items:center;justify-content:flex-start;height:100%;gap:clamp(10px,3vmin,24px);padding:clamp(10px,3vmin,24px);max-width:760px;width:100%;box-sizing:border-box;margin:0 auto;}
      #gameArea .lesson-topbar{width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px}
      #gameArea .lesson-title{font-weight:800;color:#19777e;font-size:clamp(1.1rem,3.6vmin,1.6rem)}
      #gameArea .lesson-lang{appearance:none;border:2px solid #93cbcf;background:#fff;color:#19777e;border-radius:9999px;padding:6px 10px;font-weight:800;cursor:pointer}
      #gameArea .lesson-progress{font-size:.9rem;color:#666;font-weight:600}
      #gameArea .lesson-step{opacity:0;transform:translateY(6px);transition:opacity .22s ease,transform .22s ease;width:100%}
      #gameArea .lesson-step.enter{opacity:1;transform:translateY(0)}
      #gameArea .lesson-body{ text-align:center;font-size:clamp(1rem,3.2vmin,1.2rem);line-height:1.35;color:#333 }
      #gameArea .lesson-emoji{ font-size:clamp(2.5rem,12vmin,4.5rem);line-height:1;margin-top:4px }
      #gameArea .lesson-examples{ display:grid;grid-template-columns:1fr;gap:12px;width:100%;max-width:560px }
      @media (min-width:600px){ #gameArea .lesson-examples{ grid-template-columns:1fr 1fr } }
      #gameArea .lesson-example{ border:2px solid #d1e6f0;border-radius:14px;padding:12px;background:#fff;box-shadow:0 2px 6px rgba(0,0,0,.05) }
      #gameArea .lesson-nav{ margin-top:auto;display:flex;gap:10px;align-items:center;justify-content:center;width:100% }
      #gameArea .lesson-btn{ appearance:none;border:2px solid #21b3be;background:#fff;color:#21b3be;border-radius:12px;padding:10px 16px;font-weight:800;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,.06) }
      #gameArea .lesson-btn.primary{ background:#21b3be;color:#fff;border-color:#21b3be }
      #gameArea .mini-check{ display:flex;gap:12px;justify-content:center;align-items:center;margin-top:10px }
      #gameArea .mini-check .opt{ appearance:none;border:2px solid #ff6fb0;background:#fff;color:#ff6fb0;border-radius:12px;padding:10px 16px;font-weight:800;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,.06);text-transform:lowercase }
      #gameArea .mini-check .opt.correct{ background:#e8f5e9;color:#2e7d32;border-color:#4caf50 }
      #gameArea .mini-check .opt.wrong{ background:#ffebee;color:#c62828;border-color:#f44336 }
    `;
    document.head.appendChild(st);
  }

  // Derive lesson JSON path
  const lessonPath = deriveLessonPath(grammarFile);
  let lesson;
  try {
    const res = await fetch(lessonPath, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    lesson = await res.json();
  } catch (e) {
    // Provide a tiny built-in lesson if external file missing
    lesson = fallbackLesson(grammarName);
    if (inlineToast) inlineToast('Lesson file not found – showing a quick built-in lesson.');
  }

  const langPref = detectLang() || lesson.languageDefault || 'en';
  let lang = (langPref === 'ko' || langPref === 'kr') ? 'ko' : 'en';
  let stepIndex = 0;
  let answeredOnStep = false;

  function t(obj) {
    if (obj == null) return '';
    if (typeof obj === 'string') return obj;
    return obj[lang] || obj.en || obj.ko || '';
  }

  function render() {
    root.innerHTML = '';
    const stage = document.createElement('div');
    stage.className = 'lesson-stage';

    // top bar
    const top = document.createElement('div');
    top.className = 'lesson-topbar';
    const title = document.createElement('div');
    title.className = 'lesson-title';
    title.textContent = t(lesson.title) || (grammarName || 'Grammar Lesson');
    const langBtn = document.createElement('button');
    langBtn.className = 'lesson-lang';
    langBtn.textContent = (lang === 'en') ? 'EN' : '한글';
    langBtn.title = 'Language';
    langBtn.onclick = () => { lang = (lang === 'en') ? 'ko' : 'en'; renderStep(true); };
    top.appendChild(title);
    top.appendChild(langBtn);

    const prog = document.createElement('div');
    prog.className = 'lesson-progress';
    prog.textContent = `Step ${stepIndex + 1} / ${lesson.steps.length}`;

    const stepEl = document.createElement('div');
    stepEl.className = 'lesson-step';

    stage.appendChild(top);
    stage.appendChild(prog);
    stage.appendChild(stepEl);

    // nav
    const nav = document.createElement('div');
    nav.className = 'lesson-nav';
    const prev = document.createElement('button'); prev.className = 'lesson-btn'; prev.textContent = 'Back';
    const next = document.createElement('button'); next.className = 'lesson-btn primary'; next.textContent = (stepIndex === lesson.steps.length - 1) ? 'Practice This' : 'Next';

    prev.disabled = stepIndex === 0;
    prev.onclick = () => { stepIndex = Math.max(0, stepIndex - 1); answeredOnStep = false; renderStep(); };
    next.onclick = async () => {
      if (stepIndex === lesson.steps.length - 1) {
        // Load the grammar practice (choose) mode directly
        try {
          const mod = await import('./grammar_mode.js');
          mod.runGrammarMode({ ...ctx });
        } catch (e) {
          if (inlineToast) inlineToast('Unable to start practice right now');
        }
        return;
      }
      stepIndex = Math.min(lesson.steps.length - 1, stepIndex + 1);
      answeredOnStep = false;
      renderStep();
    };

    stage.appendChild(nav);
    root.appendChild(stage);

    function renderStep(isLangToggle = false) {
      // Avoid relayout animations when just toggling language
      if (!isLangToggle) { stepEl.classList.remove('enter'); }
      const step = lesson.steps[stepIndex] || {};
      stepEl.innerHTML = '';

      if (step.type === 'intro' || step.type === 'rule' || step.type === 'tip') {
        if (step.emoji) {
          const em = document.createElement('div'); em.className = 'lesson-emoji'; em.textContent = step.emoji; stepEl.appendChild(em);
        }
        const body = document.createElement('div'); body.className = 'lesson-body'; body.innerHTML = escapeHtml(t(step.body)).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>'); stepEl.appendChild(body);
      } else if (step.type === 'examples') {
        if (step.emoji) { const em = document.createElement('div'); em.className = 'lesson-emoji'; em.textContent = step.emoji; stepEl.appendChild(em); }
        const grid = document.createElement('div'); grid.className = 'lesson-examples';
        (step.pairs || []).forEach(p => {
          const card = document.createElement('div'); card.className = 'lesson-example';
          const en = document.createElement('div'); en.style.fontWeight = '800'; en.style.color = '#19777e'; en.style.fontSize = '1.1rem'; en.textContent = p.en || '';
          const ko = document.createElement('div'); ko.style.color = '#555'; ko.style.marginTop = '4px'; ko.textContent = p.ko || '';
          card.appendChild(en); card.appendChild(ko); grid.appendChild(card);
        });
        stepEl.appendChild(grid);
      } else if (step.type === 'check') {
        if (step.emoji) { const em = document.createElement('div'); em.className = 'lesson-emoji'; em.textContent = step.emoji; stepEl.appendChild(em); }
        const body = document.createElement('div'); body.className = 'lesson-body'; body.textContent = t(step.question) || 'Choose the correct answer'; stepEl.appendChild(body);
        const kw = document.createElement('div'); kw.style.fontSize = 'clamp(2rem,7vmin,3rem)'; kw.style.fontWeight = '800'; kw.style.color = '#21b3be'; kw.style.margin = '4px 0 8px'; kw.textContent = step.word || ''; stepEl.appendChild(kw);
        const row = document.createElement('div'); row.className = 'mini-check';
        const btnA = document.createElement('button'); btnA.className = 'opt'; btnA.textContent = 'a';
        const btnAn = document.createElement('button'); btnAn.className = 'opt'; btnAn.textContent = 'an';
        const mark = (correct) => (el) => { el.classList.add(correct ? 'correct' : 'wrong'); if (playSFX) playSFX(correct ? 'correct' : 'wrong'); answeredOnStep = true; };
        btnA.onclick = () => mark(step.correct === 'a')(btnA);
        btnAn.onclick = () => mark(step.correct === 'an')(btnAn);
        row.appendChild(btnA); row.appendChild(btnAn); stepEl.appendChild(row);
      }

      // Animate in
      requestAnimationFrame(() => stepEl.classList.add('enter'));

      // Update nav button label and disabled state
      prog.textContent = `Step ${stepIndex + 1} / ${lesson.steps.length}`;
      next.textContent = (stepIndex === lesson.steps.length - 1) ? (t(lesson.cta) || 'Practice This') : 'Next';
      // If this step is a check and not yet answered, keep Next enabled but optional; we can enforce if desired
      // next.disabled = step.type === 'check' && !answeredOnStep; // Uncomment to require answer before next
    }

    renderStep();
  }

  render();
}

function deriveLessonPath(grammarFile) {
  try {
    if (!grammarFile) return 'data/grammar/level1/articles.lesson.json';
    return grammarFile.replace(/\.json$/i, '.lesson.json');
  } catch { return 'data/grammar/level1/articles.lesson.json'; }
}

function detectLang() {
  try {
    // If StudentLang is present, honor it
    if (window.StudentLang && typeof window.StudentLang.getLang === 'function') {
      const v = window.StudentLang.getLang();
      if (typeof v === 'string') return v.toLowerCase();
    }
    // Basic heuristic via <html lang>
    const h = document.documentElement.getAttribute('lang');
    if (h) return h.toLowerCase();
  } catch {}
  return 'en';
}

function fallbackLesson(grammarName) {
  return {
    title: { en: grammarName || 'A vs. An', ko: (grammarName || 'A vs. An') },
    languageDefault: 'en',
    cta: { en: 'Practice This', ko: '연습하기' },
    steps: [
      { type: 'intro', emoji: '📘', body: { en: 'Welcome! In this lesson you will learn when to use <b>a</b> and <b>an</b>.', ko: '환영합니다! 이 수업에서는 <b>a</b> 와 <b>an</b> 을 언제 쓰는지 배워요.' } },
      { type: 'rule', emoji: '🔊', body: { en: 'Use <b>an</b> before vowel sounds (a, e, i, o, u). Use <b>a</b> before consonant sounds.', ko: '모음 소리(a, e, i, o, u) 앞에는 <b>an</b>을, 자음 소리 앞에는 <b>a</b>를 사용해요.' } },
      { type: 'examples', emoji: '✨', pairs: [
        { en: 'an apple', ko: '사과 하나' },
        { en: 'a dog', ko: '개 한 마리' },
        { en: 'an umbrella', ko: '우산 하나' },
        { en: 'a cat', ko: '고양이 한 마리' }
      ] },
      { type: 'tip', emoji: '💡', body: { en: 'Focus on the sound, not just the letter. We say <b>an hour</b> (silent h).', ko: '철자보다 소리에 집중하세요. <b>hour</b>는 h가 묵음이라 <b>an hour</b>라고 해요.' } },
      { type: 'check', emoji: '🧠', question: { en: 'Choose the correct article:', ko: '올바른 관사를 고르세요:' }, word: 'elephant', correct: 'an' }
    ]
  };
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
