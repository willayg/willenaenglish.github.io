// Grammar Lesson Runner – Articles (a vs. an)
// Implements a 5-step, bilingual, kid-friendly lesson with an interactive sorting activity.

import { startSession, endSession } from '../../../../students/records.js';

export async function runGrammarLesson(ctx = {}) {
  const { grammarFile, grammarName, playSFX, inlineToast } = ctx;
  const root = document.getElementById('gameArea');
  if (!root) return;

  // Inject lesson CSS (scoped)
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
      #gameArea .lesson-body{ text-align:center;font-size:clamp(1.02rem,3.3vmin,1.22rem);line-height:1.45;color:#27323a }
      #gameArea .lesson-rows{ display:flex;flex-direction:column;gap:10px }
  #gameArea .lesson-examples{ display:grid;grid-template-columns:1fr 1fr;gap:12px;width:100%;max-width:620px;margin:10px auto }
      @media (min-width:660px){ #gameArea .lesson-examples{ grid-template-columns:1fr 1fr } }
      #gameArea .lesson-example{ border:2px solid #d1e6f0;border-radius:14px;padding:12px;background:#fff;box-shadow:0 2px 6px rgba(0,0,0,.05) }
      #gameArea .lesson-example strong{ color:#19777e }
      #gameArea .lesson-nav{ margin-top:auto;display:flex;gap:10px;align-items:center;justify-content:center;width:100% }
      #gameArea .lesson-btn{ appearance:none;border:2px solid #21b3be;background:#fff;color:#21b3be;border-radius:12px;padding:10px 16px;font-weight:800;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,.06);transition:transform .15s ease, box-shadow .15s ease }
      #gameArea .lesson-btn:hover{ transform:translateY(-1px); box-shadow:0 6px 16px rgba(33, 181, 192, 0.18) }
      #gameArea .lesson-btn.primary{ background:#21b3be;color:#fff;border-color:#21b3be }
      #gameArea .choice-grid{ display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;max-width:680px;margin:12px auto }
  #gameArea .chip{ user-select:none;border:2px solid #93cbcf;background:#ffffff;color:#ff6fb0;border-radius:9999px;padding:10px 12px;font-weight:800;cursor:pointer;text-align:center;box-shadow:0 2px 6px rgba(0,0,0,.06);transition:transform .12s ease, box-shadow .12s ease }
      #gameArea .chip:hover{ transform:scale(1.04); box-shadow:0 6px 16px rgba(0,0,0,.12) }
  #gameArea .chip.selected{ outline:3px solid #21b3be; border-color:#21b3be }
      #gameArea .chip.bad{ border-color:#f44336;color:#c62828;background:#ffebee }
      #gameArea .chip.good{ border-color:#4caf50;color:#2e7d32;background:#e8f5e9 }
      #gameArea .buckets{ display:grid;grid-template-columns:1fr;gap:14px;margin-top:12px;width:100%;max-width:820px }
      @media (min-width:720px){ #gameArea .buckets{ grid-template-columns:1fr 1fr } }
  #gameArea .bucket{ border:2px dashed #b0e2e4;border-radius:16px;min-height:120px;background:linear-gradient(180deg, #fbffff 0%, #ffffff 100%);padding:10px;display:flex;flex-direction:column;gap:8px;box-shadow:0 2px 10px rgba(0,0,0,.04);cursor:pointer }
      #gameArea .bucket h4{ margin:0;font-size:1.05rem;color:#19777e }
  #gameArea .bucket .bucket-body{ display:flex;flex-wrap:wrap;gap:8px;cursor:pointer }
      #gameArea .pool{ border:2px dashed #e6e6e6;background:#fff }
      #gameArea .stars{ font-size:clamp(1.6rem,6vmin,2.2rem);line-height:1 }

    /* Step 1 tweaks: subtle inline next link and emoji hint */
    #gameArea .next-line-tap{ border:none;background:transparent;color:#7d8a97;font-weight:800;cursor:pointer;font-size:1rem;margin-top:10px;padding:4px 8px;text-decoration:underline dotted; }
    #gameArea .next-line-tap:hover{ color:#5f6b75 }
  #gameArea .emoji-swap{ position:relative }
  /* Halo pulse + tiny bounce to suggest interactivity */
  #gameArea .emoji-swap.hinting{ animation: wa-bounce 1.6s ease-in-out infinite; }
  #gameArea .emoji-swap.hinting::after{ content:''; position:absolute; inset:-6px; border-radius:50%; box-shadow:0 0 0 0 rgba(33,179,190,0.45); animation: wa-halo 1.6s ease-out infinite; pointer-events:none }
  @keyframes wa-halo{ 0%{ box-shadow:0 0 0 0 rgba(33,179,190,0.45); opacity:1 } 70%{ box-shadow:0 0 0 14px rgba(33,179,190,0); opacity:0 } 100%{ opacity:0 } }
  @keyframes wa-bounce{ 0%,100%{ transform:translateY(0) scale(1)} 50%{ transform:translateY(-2px) scale(1.06)} }
  #gameArea .emoji-microcopy{ font-size:.95rem; color:#7d8a97; margin-top:6px }
    #gameArea .emoji-swap.hinting{ animation: wa-pulse 1.3s ease-in-out infinite; }
    @keyframes wa-pulse{ 0%{ transform:scale(1) } 50%{ transform:scale(1.18) } 100%{ transform:scale(1) } }
    `;
    document.head.appendChild(st);
  }

  // Load grammar items (used for examples and activity)
  let items = [];
  try {
    if (!grammarFile) throw new Error('No grammar file');
    const res = await fetch(grammarFile, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to load ${grammarFile}`);
    const data = await res.json();
    if (Array.isArray(data)) items = data;
  } catch (e) {
    console.warn('[lesson] failed to load grammar items', e);
  }

  const sessionWords = items
    .map((it) => (it && typeof it.word === 'string' ? it.word : null))
    .filter(Boolean)
    .slice(0, 25);

  let sessionId = null;
  let sessionClosed = false;
  try {
    sessionId = startSession({
      mode: 'grammar_lesson',
      wordList: sessionWords,
      listName: grammarName || null,
      meta: { category: 'grammar', file: grammarFile, lesson: grammarName || null },
    });
  } catch (err) {
    console.debug('[GrammarLesson] startSession failed', err?.message);
  }

  // Language (step 1 will set this explicitly)
  let lang = (detectLang() === 'ko' || detectLang() === 'kr') ? 'ko' : 'en';
  let stepIndex = 0;

  // Helper: pick N words by article
  function pickByArticle(article, n) {
    const pool = items.filter(it => (it && String(it.article).toLowerCase() === article) && typeof it.word === 'string');
    const shuffled = pool.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, n).map(it => ({ id: it.id || it.word, word: it.word, article: article }));
  }

  // Prepare examples for steps 3-4
  let sampleAn = pickByArticle('an', 6); // grab a few extra in case of duplicates
  let sampleA = pickByArticle('a', 6);
  if (sampleAn.length < 5 || sampleA.length < 5) {
    // Fallback defaults if file is missing or too small
    const fallbackAn = ['apple','egg','orange','umbrella','elephant','ice cream'];
    const fallbackA = ['dog','cat','book','phone','car','toy'];
    sampleAn = fallbackAn.map(w => ({ id: w, word: w, article: 'an' }));
    sampleA = fallbackA.map(w => ({ id: w, word: w, article: 'a' }));
  }
  // Create final 5+5 unique lists for examples
  sampleAn = uniqueWords(sampleAn).slice(0,5);
  sampleA = uniqueWords(sampleA).slice(0,5);
  // Sorting mini-game uses only 6 total words: 3 with vowels (an) and 3 with consonants (a)
  const activitySet = shuffle([
    ...shuffle(sampleAn).slice(0,3),
    ...shuffle(sampleA).slice(0,3)
  ]);

  // Step renderers
  function renderStep1Language(stage, prog, stepEl, nav) {
    prog.textContent = '';
    nav.style.display = 'none';
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

  function renderStep2Intro(stage, prog, stepEl) {
    prog.textContent = displayStep(1);
    stepEl.innerHTML = '';
    
    // Inject step-specific CSS for animated text reveals
    if (!document.getElementById('wa-lesson-step1-styles')) {
      const st = document.createElement('style');
      st.id = 'wa-lesson-step1-styles';
      st.textContent = `
  #gameArea .intro-line { opacity:0; transform:translateY(10px); transition:opacity .25s ease, transform .25s ease; margin-bottom:12px; font-size:1.15rem; line-height:1.8; }
        #gameArea .intro-line.show { opacity:1; transform:translateY(0); }
        #gameArea .intro-line strong { color:#ff6fb0; font-weight:800; }
        #gameArea .emoji-swap { display:inline-block; font-size:2rem; cursor:pointer; transition:transform .2s ease; margin:0 4px; }
        #gameArea .emoji-swap:hover { transform:scale(1.15); }
        /* legacy .next-line-btn kept for compatibility, not used now */
        #gameArea .next-line-btn { margin-top:12px; padding:10px 20px; border:2px solid #21b3be; background:#fff; color:#ff6fb0; border-radius:12px; font-weight:800; cursor:pointer; font-size:1rem; transition:transform .15s ease, box-shadow .15s ease; box-shadow:0 2px 6px rgba(0,0,0,.06); }
        #gameArea .next-line-btn:hover { transform:translateY(-2px); box-shadow:0 6px 16px rgba(33,181,192,0.2); }
      `;
      document.head.appendChild(st);
    }

    const container = document.createElement('div');
    container.style.cssText = 'display:flex;flex-direction:column;align-items:center;text-align:center;';
    
    let lineIndex = 0;
    const lines = [];
    
    // Prepare lines based on language
    if (lang === 'ko') {
      lines.push({
        text: '<b>a</b> 와 <b>an</b> 은 둘 다 "하나의"라는 뜻이에요.',
        type: 'text'
      });
      lines.push({
         text: 'I see <b>an</b> ',
        emoji: '🍎',
        swapOptions: ['🍎', '🍊', '🍋', '🍌', '🥕', '🐕'],
        korean: '(사과 하나가 보여요)',
        type: 'interactive'
      });
      lines.push({
        text: '<b>a</b> 나 <b>an</b> 은 하나보다 많을 때 쓰지 않아요.',
        type: 'text'
      });
      lines.push({
         text: 'I see 3 ',
        emoji: '🍌🍌🍌',
        swapOptions: ['🍌🍌🍌', '🍎🍎🍎', '🍊🍊🍊', '🐕🐕🐕', '⭐⭐⭐', '🚗🚗🚗'],
        korean: '(바나나 3개가 보여요)',
        type: 'interactive',
        count: 3
      });
    } else {
      lines.push({
        text: '<b>a</b> and <b>an</b> both mean "one of something".',
        type: 'text'
      });
      lines.push({
         text: 'I see <b>an</b> ',
        emoji: '🍎',
        swapOptions: ['🍎', '🍊', '🍋', '🍌', '🥕', '🐕'],
        korean: '(I see one apple)',
        type: 'interactive'
      });
      lines.push({
        text: 'We don\'t use <b>a</b> or <b>an</b> when we have more than one.',
        type: 'text'
      });
      lines.push({
         text: 'I see 3 ',
        emoji: '🍌🍌🍌',
        swapOptions: ['🍌🍌🍌', '🍎🍎🍎', '🍊🍊🍊', '🐕🐕🐕', '⭐⭐⭐', '🚗🚗🚗'],
        korean: '(I see 3 bananas)',
        type: 'interactive',
        count: 3
      });
    }

    function showNextLine() {
      if (lineIndex >= lines.length) {
        // All lines shown, show proceed button with green border and pink text
        const buttonWrap = document.createElement('div');
        buttonWrap.style.cssText = 'display:flex;gap:12px;align-items:center;justify-content:center;margin-top:24px;';
        
        const backBtn = document.createElement('button');
        backBtn.className = 'lesson-btn';
        backBtn.textContent = (lang === 'ko') ? '뒤로' : 'Back';
        backBtn.style.borderColor = '#21b3be';
        backBtn.style.color = '#ff6fb0';
        backBtn.onclick = () => { if (stepIndex > 0) { stepIndex--; render(); } };
        
        const proceedBtn = document.createElement('button');
        proceedBtn.className = 'lesson-btn';
        proceedBtn.textContent = (lang === 'ko') ? '다음 단계로' : 'Go to Next Step';
        proceedBtn.style.borderColor = '#21b3be';
        proceedBtn.style.color = '#ff6fb0';
        proceedBtn.onclick = () => { nextStep(); };
        
        buttonWrap.appendChild(backBtn);
        buttonWrap.appendChild(proceedBtn);
        container.appendChild(buttonWrap);
        return;
      }

  const line = lines[lineIndex];
  const lineDiv = document.createElement('div');
  lineDiv.className = 'intro-line';

      if (line.type === 'text') {
        lineDiv.innerHTML = line.text;
        container.appendChild(lineDiv);
        lineIndex++;
        // Animate in
        const reveal = () => lineDiv.classList.add('show');
        // rAF for smooth transition, plus timeout fallback in case rAF is throttled
        requestAnimationFrame(() => { requestAnimationFrame(reveal); });
        setTimeout(reveal, 80);
  // Auto-show next line after a shorter delay to feel faster
  setTimeout(showNextLine, 1000);
      } else if (line.type === 'interactive') {
        // Interactive line with clickable emoji
        const isPlural = Number(line.count) > 1;
        const count = isPlural ? Number(line.count) : 1;

        // reduce any multi-emoji strings to a single base emoji codepoint
        const toBase = (s) => Array.from(String(s||''))[0] || '';
        let currentEmoji = toBase(line.emoji);
        const choices = Array.from(new Set((line.swapOptions||[]).map(toBase)));
        let currentIdx = Math.max(0, choices.indexOf(currentEmoji));

        // noun mapping for proper a/an and bilingual support (adding star/car)
        const nounMap = {
          '🍎': { en: 'apple', ko: '사과' },
          '🍊': { en: 'orange', ko: '오렌지' },
          '🍋': { en: 'lemon',  ko: '레몬' },
          '🍌': { en: 'banana', ko: '바나나' },
          '🥕': { en: 'carrot', ko: '당근' },
          '🐕': { en: 'dog',    ko: '강아지' },
          '⭐': { en: 'star',   ko: '별' },
          '🚗': { en: 'car',    ko: '자동차' }
        };
        const isVowel = (w) => /^[aeiou]/i.test(w || '');
        const aAn = (w) => isVowel(w) ? 'an' : 'a';
        const pluralize = (w) => {
          if (!w) return w;
          if (/([sxz]|ch|sh)$/i.test(w)) return w + 'es';
          if (/[aeiou]y$/i.test(w)) return w + 's';
          if (/[^aeiou]y$/i.test(w)) return w.replace(/y$/i,'ies');
          return w + 's';
        };

  const sentenceSpan = document.createElement('span');
  const emojiBtn = document.createElement('span');
  emojiBtn.className = 'emoji-swap hinting';
        
        const koreanDiv = document.createElement('div');
        koreanDiv.style.cssText = 'font-size:0.95rem;color:#666;margin-top:4px;';

        const updateSentence = () => {
          const nounEn = nounMap[currentEmoji]?.en || 'item';
          const nounKo = nounMap[currentEmoji]?.ko || '물건';
          const eng = isPlural
            ? `I see ${count} ${escapeHtml(pluralize(nounEn))}.`
            : `I see <b>${aAn(nounEn)}</b> ${escapeHtml(nounEn)}.`;
          sentenceSpan.innerHTML = eng;
          if (lang === 'ko') {
            const kor = isPlural ? `(${nounKo} ${count}개가 보여요)` : `(${nounKo} 하나가 보여요)`;
            koreanDiv.innerHTML = kor;
          } else {
            koreanDiv.innerHTML = '';
          }
          // update emoji visual
          emojiBtn.textContent = isPlural ? currentEmoji.repeat(count) : currentEmoji;
        };

        const handleEmojiClick = () => {
          currentIdx = (currentIdx + 1) % (choices.length || 1);
          currentEmoji = choices[currentIdx] || currentEmoji;
          emojiBtn.classList.remove('hinting');
          if (tip && tip.parentNode) tip.remove();
          updateSentence();
        };
        emojiBtn.onclick = handleEmojiClick;

        // Initial paint
        updateSentence();

        // Build DOM: sentence on one line, emoji on line below
        lineDiv.appendChild(sentenceSpan);
        const emojiWrap = document.createElement('div');
        emojiWrap.style.cssText = 'margin-top:12px;display:flex;align-items:center;justify-content:center;gap:8px;';
        emojiWrap.appendChild(emojiBtn);
        lineDiv.appendChild(emojiWrap);
        lineDiv.appendChild(koreanDiv);
        container.appendChild(lineDiv);
        lineIndex++;
        
        // Animate in
        const reveal = () => lineDiv.classList.add('show');
        requestAnimationFrame(() => { requestAnimationFrame(reveal); });
        setTimeout(reveal, 80);
        
        // Inline minimal "Got it" text control
        const tap = document.createElement('button');
        tap.className = 'next-line-tap';
        tap.textContent = (lang === 'ko') ? '알겠어요' : 'Got it';
        tap.onclick = () => { tap.remove(); showNextLine(); };
        container.appendChild(tap);

        // Microcopy to guide click, removed after first tap on emoji
        const tip = document.createElement('div');
        tip.className = 'emoji-microcopy';
        tip.textContent = (lang === 'ko') ? '이모지를 눌러요' : 'Tap the emoji';
        container.appendChild(tip);
      }
    }

    stepEl.appendChild(container);
    // Call showNextLine after DOM update
    let started = false;
    const start = () => { if (started) return; started = true; showNextLine(); };
    requestAnimationFrame(start);
    // Fallback if rAF is throttled (background tab, low-power mode, etc.)
    setTimeout(start, 150);
  }

  function renderStep3Vowels(stage, prog, stepEl, nav) {
    // Hide progress indicator for this step
    prog.textContent = '';
    stepEl.innerHTML = '';

    // Phase flow: first AN (left), then A (right)
    if (nav) nav.style.display = 'none';

    const sentence = document.createElement('div');
    sentence.className = 'lesson-body';
    sentence.style.cssText = 'font-size:1.15rem;line-height:1.8;margin-bottom:8px;';

    const grid = document.createElement('div');
    grid.className = 'lesson-examples';
    const leftCol = document.createElement('div');
    const rightCol = document.createElement('div');
    grid.appendChild(leftCol);
    grid.appendChild(rightCol);

    stepEl.appendChild(sentence);
    stepEl.appendChild(grid);

    let phase = 0; // 0 = an on left, 1 = a on right

  // Styled Got it button consistent with other cyan/pink buttons
  const tap = button((lang === 'ko') ? '알겠어요' : 'Got it');
  tap.style.borderColor = '#21b3be';
  tap.style.color = '#ff6fb0';
  // Bottom bar for positioning Got it at bottom center, below vowel list
  const bottomBar = document.createElement('div');
  bottomBar.style.cssText = 'display:flex;align-items:center;justify-content:center;margin-top:12px;width:100%';
  bottomBar.appendChild(tap);

    function renderExamples(col, list, article) {
      col.innerHTML = '';
      list.slice(0,5).forEach(w => {
        const card = document.createElement('div');
        card.className = 'lesson-example';
        card.innerHTML = `<div><strong>${article}</strong> ${escapeHtml(w.word)}</div>`;
        col.appendChild(card);
      });
    }

    function setPhase(p) {
      phase = p;
      if (phase === 0) {
        sentence.innerHTML = (lang === 'ko')
          ? `모음 소리(<b>a, e, i, o, u</b>) 앞에서는 <b>an</b>을 써요.`
          : `We use <b>an</b> before a vowel sound like <b>a, e, i, o, u</b>.`;
        renderExamples(leftCol, sampleAn, 'an');
        rightCol.innerHTML = '';
        // Place Got it below the vowel examples grid at bottom center
        if (!bottomBar.isConnected) stepEl.appendChild(bottomBar);
        if (nav) nav.style.display = 'none';
      } else {
        sentence.innerHTML = (lang === 'ko')
          ? `자음 소리(<b>b, t, f, p</b> 등) 앞에서는 <b>a</b>를 써요.`
          : `We use <b>a</b> before consonant sounds like <b>b, t, f, p</b>.`;
        renderExamples(rightCol, sampleA, 'a');
        if (tap.parentNode) tap.remove();
        if (bottomBar.parentNode) bottomBar.remove();
        // After acknowledging vowels, show Back/Next controls
        if (nav) nav.style.display = 'flex';
      }
    }

    tap.onclick = () => setPhase(1);
    setPhase(0);
  }

  function renderStep4Sort(stage, prog, stepEl, nav, nextBtn) {
    // Hide progress indicator for this step
    prog.textContent = '';
    stepEl.innerHTML = '';
    // Hide page nav; we'll show an inline Continue when perfect
    if (nav) nav.style.display = 'none';
    const body = document.createElement('div');
    body.className = 'lesson-body';
    body.style.cssText = 'font-size:1.15rem;line-height:1.8;margin-bottom:16px;';
    body.innerHTML = (lang === 'ko')
      ? '단어 6개를 <b>a</b> 바구니와 <b>an</b> 바구니로 나눠 보세요. 모두 맞으면 다음으로 갈 수 있어요!'
      : 'Sort the 6 words into the <b>a</b> bucket and the <b>an</b> bucket. Get all correct to move on!';
    stepEl.appendChild(body);

    // Pool + Buckets
    const buckets = document.createElement('div');
    buckets.className = 'buckets';
    const pool = makeBucket('pool', (lang==='ko')?'단어 모음':'Word Pool');
    const bucketA = makeBucket('a', 'a');
    const bucketAn = makeBucket('an', 'an');
    buckets.appendChild(pool.wrap);
    buckets.appendChild(bucketA.wrap);
    buckets.appendChild(bucketAn.wrap);
    stepEl.appendChild(buckets);

    // Chips in pool
    activitySet.forEach(w => pool.body.appendChild(makeChip(w)));

    // Click-select, then click-target to drop
    let selectedChip = null;
    const clearSelection = () => { stepEl.querySelectorAll('.chip.selected').forEach(c=>c.classList.remove('selected')); selectedChip = null; };
    const selectChip = (el) => {
      if (selectedChip === el) { el.classList.toggle('selected'); selectedChip = el.classList.contains('selected') ? el : null; return; }
      clearSelection();
      selectedChip = el;
      el.classList.add('selected');
    };
    // Delegate click for chips
    stepEl.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (chip) { selectChip(chip); }
    });
    // Buckets accept selected chip on click
    [pool.wrap, bucketA.wrap, bucketAn.wrap].forEach(wrapEl => {
      wrapEl.addEventListener('click', (ev) => {
        // avoid if clicking a chip (selection handled above)
        if (ev.target.closest('.chip')) return;
        if (!selectedChip) return;
        const targetBody = wrapEl.querySelector('.bucket-body');
        if (!targetBody) return;
        targetBody.appendChild(selectedChip);
        if (playSFX) try { playSFX('click'); } catch {}
        clearSelection();
      });
    });

    // Drag & drop support (optional; click-select also works)
    stepEl.querySelectorAll('.bucket-body, .pool .bucket-body').forEach(el => {
      el.addEventListener('dragover', ev => { ev.preventDefault(); });
      el.addEventListener('drop', ev => {
        ev.preventDefault();
        const id = ev.dataTransfer?.getData('text/plain');
        const chip = stepEl.querySelector(`.chip[data-id="${CSS.escape(id)}"]`);
        if (chip) el.appendChild(chip);
        clearSelection();
      });
    });

    // Nav: require all correct before Next
    let continueBtn = null;
    const checkBtn = button((lang==='ko')?'정답 확인':'Check Answers');
    checkBtn.style.marginTop = '12px';
    stepEl.appendChild(checkBtn);

    checkBtn.onclick = () => {
      // Clear marks
      stepEl.querySelectorAll('.chip').forEach(c => { c.classList.remove('good','bad'); });
      let allPlaced = true;
      // Evaluate A bucket
      const aIds = new Set(sampleA.map(w=>w.id));
      const anIds = new Set(sampleAn.map(w=>w.id));
      bucketA.body.querySelectorAll('.chip').forEach(c => {
        const ok = aIds.has(c.getAttribute('data-id'));
        c.classList.add(ok? 'good' : 'bad');
      });
      bucketAn.body.querySelectorAll('.chip').forEach(c => {
        const ok = anIds.has(c.getAttribute('data-id'));
        c.classList.add(ok? 'good' : 'bad');
      });
      // Must not leave chips in pool
      const poolCount = pool.body.querySelectorAll('.chip').length;
      if (poolCount>0) allPlaced = false;
      // Must all be correct
      const wrongCount = stepEl.querySelectorAll('.chip.bad').length;
      const total = activitySet.length;
      const correct = total - wrongCount;
      if (correct === total && poolCount === 0) {
        if (playSFX) playSFX('correct');
        if (!continueBtn) {
          continueBtn = button((lang==='ko')?'다음 단계로':'Next');
          continueBtn.style.marginTop = '12px';
          continueBtn.onclick = () => nextStep();
          stepEl.appendChild(continueBtn);
        }
        inlineToast && inlineToast((lang==='ko') ? '완벽해요! 다음으로 가요.' : 'Perfect! Continue.');
      } else {
        if (playSFX) playSFX('wrong');
        inlineToast && inlineToast((lang==='ko') ? '다시 한 번 고쳐 보세요! 빨간 단어를 옮겨요.' : 'Try again! Move the red words.');
      }
    };
  }

  function renderStep5Finish(stage, prog, stepEl, nav) {
    // Hide progress and global nav on the last screen
    prog.textContent = '';
    if (nav) nav.style.display = 'none';
    stepEl.innerHTML = '';
    // Increase spacing between all elements
    stepEl.style.display = 'flex';
    stepEl.style.flexDirection = 'column';
    stepEl.style.gap = '30px';
    const body = document.createElement('div');
    body.className = 'lesson-body';
    body.style.display = 'flex';
    body.style.flexDirection = 'column';
    body.style.alignItems = 'center';
    body.style.gap = '30px';
    body.innerHTML = (lang==='ko')
      ? '<div style="font-weight:800;color:#19777e">아주 잘했어요!</div><div class="stars">⭐⭐⭐⭐⭐</div>'
      : '<div style="font-weight:800;color:#19777e">Great job!</div><div class="stars">⭐⭐⭐⭐⭐</div>';
    stepEl.appendChild(body);

    const navWrap = document.createElement('div');
    navWrap.className = 'lesson-nav';
    const backToModes = button((lang==='ko')?'모드로 돌아가기':'Back to Modes');
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

    // Optional: fire a session-ended event so star overlay can show
    if (!sessionClosed) {
      sessionClosed = true;
      try {
        endSession(sessionId, {
          mode: 'grammar_lesson',
          summary: {
            score: 1,
            total: 1,
            correct: 1,
            pct: 100,
            accuracy: 100,
            category: 'grammar',
            context: 'lesson',
            grammarName: grammarName || null,
          },
          listName: grammarName || null,
          wordList: sessionWords,
        });
      } catch (err) {
        console.debug('[GrammarLesson] endSession failed', err?.message);
      }

      try {
        const ev = new CustomEvent('wa:session-ended', { detail: { summary: { correct: 1, total: 1, category: 'grammar' } } });
        window.dispatchEvent(ev);
      } catch {}
    }
  }

  // Root render
  function render() {
    root.innerHTML = '';
    const stage = document.createElement('div');
    stage.className = 'lesson-stage';

    const top = document.createElement('div'); top.className = 'lesson-topbar';
    const title = document.createElement('div'); title.className = 'lesson-title'; title.textContent = grammarName || 'A vs. An';
  const prog = document.createElement('div'); prog.className = 'lesson-progress';
  // Hide progress display globally
  prog.style.display = 'none';
    const stepEl = document.createElement('div'); stepEl.className = 'lesson-step';
    const nav = document.createElement('div'); nav.className = 'lesson-nav';
    const back = button((lang==='ko')?'뒤로':'Back');
    const next = button((lang==='ko')?'다음':'Next');
    back.style.borderColor = '#21b3be';
    back.style.color = '#ff6fb0';
    next.style.borderColor = '#21b3be';
    next.style.color = '#ff6fb0';
    back.onclick = () => { if (stepIndex>0) { stepIndex--; renderStep(); } };
    next.onclick = () => { stepIndex++; renderStep(); };
    nav.appendChild(back); nav.appendChild(next);

    stage.appendChild(top);
    stage.appendChild(prog);
    stage.appendChild(stepEl);
    stage.appendChild(nav);
    root.appendChild(stage);

    function renderStep() {
      stepEl.classList.remove('enter');
      // Clear navigation defaults each time
      next.disabled = false;
      // Hide global back/next by default
      nav.style.display = 'none';
      // Switch per step
      if (stepIndex === 0)      renderStep1Language(stage, prog, stepEl, nav);
      else if (stepIndex === 1) renderStep2Intro(stage, prog, stepEl, nav);
      else if (stepIndex === 2) renderStep3Vowels(stage, prog, stepEl, nav);
      else if (stepIndex === 3) renderStep4Sort(stage, prog, stepEl, nav, next);
      else { renderStep5Finish(stage, prog, stepEl, nav); }
      requestAnimationFrame(() => stepEl.classList.add('enter'));
    }

    renderStep();
  }

  function nextStep() { stepIndex = Math.min(stepIndex + 1, 4); render(); }

  render();
}

// Utilities
function uniqueWords(arr) {
  const seen = new Set();
  const out = [];
  for (const it of arr) {
    const key = String(it.word || '').toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key); out.push(it);
  }
  return out;
}
function shuffle(a){ return a.map(x=>[Math.random(),x]).sort((p,q)=>p[0]-q[0]).map(x=>x[1]); }
function button(text, kind){ const b=document.createElement('button'); b.className = 'lesson-btn' + (kind==='primary'?' primary':''); b.textContent = text; return b; }
function makeBucket(type, label){
  const wrap = document.createElement('div'); wrap.className = 'bucket ' + (type==='pool'?'pool':'');
  const title = document.createElement('h4'); title.textContent = label;
  const body = document.createElement('div'); body.className = 'bucket-body'; body.setAttribute('data-bucket', type);
  wrap.appendChild(title); wrap.appendChild(body);
  return { wrap, body };
}
function makeChip(word){
  const el = document.createElement('div');
  el.className = 'chip';
  el.draggable = true;
  el.setAttribute('data-id', word.id);
  el.textContent = word.word;
  el.addEventListener('dragstart', ev => { try { ev.dataTransfer.setData('text/plain', word.id); } catch {} });
  return el;
}
function displayStep(n){ return `Step ${n} / 5`; }
function detectLang(){
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
function escapeHtml(s){
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#039;');
}
