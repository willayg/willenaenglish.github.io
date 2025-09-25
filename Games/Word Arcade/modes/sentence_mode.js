// Sentence Mode (Base Unscramble Implementation)
// -------------------------------------------------------------
// Phase 1: Provide a single mechanic: Sentence Unscramble.
// - Filters word list for entries that have a sentence field and sentence audio available.
// - Sentence audio naming convention: WORD_SENTENCE (provided in R2) -> we request via get_audio_urls.
// - Displays shuffled tokens; user taps to build sentence; Submit checks answer; Next advances.
// - Auto plays sentence audio at round start (if found) and provides replay button.
//
// Future phases (Fill Blank, Completion, Chunk) will extend this file.
// -------------------------------------------------------------

// NOTE: Context provided by play-main.js
// ctx.wordList: normalized words (we will re-fetch sentence/audio fields if necessary later)
// ctx.gameArea: DOM container
// ctx.playTTS, ctx.preprocessTTS available

export function run(ctx){
	const root = ctx.gameArea || document.getElementById('gameStage') || document.body;
	if (!root) return console.error('[SentenceMode] Missing root');

	// Prepare working set: only words that have a sentence and we can locate sentence audio.
	// For now we optimistically keep those with sentence; we asynchronously probe audio and mark missing.
		let items = (ctx.wordList || []).filter(w => w && w.sentence && typeof w.sentence === 'string' && w.sentence.trim().split(/\s+/).length >= 3);
		// Shuffle the order of sentences (stable shuffle) so rounds appear random each session
		items = shuffle(items.slice());
	if (!items.length){
		root.innerHTML = renderErrorBox('No sentences available for this list. Add sentence examples first.');
		return;
	}

	// We'll enrich each with sentenceAudioUrl if exists.
	// Sentence audio key pattern: `${word.eng}_SENTENCE` (case-insensitive match).
	enrichSentenceAudio(items).then(summary => {
		if (!items.some(i=>i.sentenceAudioUrl)) {
			// proceed anyway but no audio
			console.warn('[SentenceMode] No sentence audio found. Proceeding silently.');
		}
		startGame();
	}).catch(e=>{ console.warn('[SentenceMode] Audio enrich failed', e); startGame(); });

	let index = 0;
	let score = 0; // reserved for future multi-round scoring

	function startGame(){
		root.innerHTML = '';
		root.classList.add('cgm-mode-root');
		const wrap = document.createElement('div');
		wrap.className = 'sentence-mode';
			injectStylesOnce();
				wrap.innerHTML = `
				<div class="sm-header">
					<div class="sm-title">Sentence Unscramble</div>
					<div id="smCounter" class="sm-counter">1 / ${items.length}</div>
				</div>
				<div id="smSentenceBox" class="sm-box fade-in">
					<div class="sm-section-label">Build the sentence:</div>
						<div id="smConstruct" class="sm-construct sm-construct-line" aria-label="Your assembled sentence" role="presentation"><span class="sm-line-placeholder">Tap words below…</span></div>
					<div class="sm-divider"></div>
					<div id="smTokens" class="sm-tokens" aria-label="Available words" role="list"></div>
					<div id="smFeedback" class="sm-feedback" aria-live="polite"></div>
					<div class="sm-actions">
						<button id="smReplay" class="sm-btn ghost audio" type="button">🔊 Sentence</button>
						<button id="smClear" class="sm-btn ghost" type="button">Reset</button>
						<div class="flex-spacer"></div>
						<button id="smSubmit" class="sm-btn primary" type="button">Submit</button>
						<button id="smNext" class="sm-btn accent" type="button" style="display:none;">Next ▶</button>
					</div>
				</div>`;
		root.appendChild(wrap);
		renderRound();
	}

	function renderRound(){
		const item = items[index];
		if (!item){
			showSummary();
			return;
		}
		const counter = root.querySelector('#smCounter');
		if (counter) counter.textContent = `${index+1} / ${items.length}`;

		const constructEl = root.querySelector('#smConstruct');
		const tokensEl = root.querySelector('#smTokens');
		const feedbackEl = root.querySelector('#smFeedback');
		const submitBtn = root.querySelector('#smSubmit');
		const nextBtn = root.querySelector('#smNext');
		const replayBtn = root.querySelector('#smReplay');
		const clearBtn = root.querySelector('#smClear');
		if (!constructEl || !tokensEl) return;

		feedbackEl.textContent = '';
		submitBtn.style.display = '';
		nextBtn.style.display = 'none';
		constructEl.innerHTML = '';
		tokensEl.innerHTML = '';

		const correctTokens = tokenize(item.sentence);
		const shuffled = shuffle(correctTokens.slice());

				shuffled.forEach(tok => {
					const btn = document.createElement('button');
					btn.type='button';
					btn.className='sm-chip';
					btn.textContent = tok;
					btn.addEventListener('click', () => {
						btn.disabled = true;
						addTokenToLine(tok, btn);
					});
					tokensEl.appendChild(btn);
				});

			submitBtn.onclick = () => {
				const attemptTokens = currentConstructTokens(constructEl);
				if (attemptTokens.length !== correctTokens.length){
					feedbackEl.textContent = 'Complete the sentence.';
					feedbackEl.style.color = '#b45309';
					return;
				}
				const attemptNorm = normalizeSentence(attemptTokens.join(' '));
				const correctNorm = normalizeSentence(correctTokens.join(' '));
				const ok = attemptNorm === correctNorm;
				if (ok){
					feedbackEl.textContent = 'Correct!';
					feedbackEl.style.color = '#065f46';
					score++;
					submitBtn.style.display='none';
					nextBtn.style.display='';
					constructEl.classList.add('sm-correct');
						playSfx('right');
				} else {
					feedbackEl.textContent = 'Not quite. Tap a word to remove or Reset.';
					feedbackEl.style.color = '#b91c1c';
					constructEl.classList.add('sm-shake');
					setTimeout(()=>constructEl.classList.remove('sm-shake'), 480);
						playSfx('wrong');
				}
			};

		nextBtn.onclick = () => { index++; renderRound(); };
		clearBtn.onclick = () => { renderRound(); };
		replayBtn.onclick = () => { playSentenceAudio(item); };

		// Autoplay after slight delay
		setTimeout(()=>{ playSentenceAudio(item); }, 150);
	}

	function showSummary(){
		root.innerHTML = `<div style="max-width:520px;margin:40px auto;text-align:center;font-family:Poppins,system-ui;padding:30px 24px;background:#fff;border:2px solid #93cbcf;border-radius:20px;box-shadow:0 10px 32px -6px rgba(0,0,0,0.15);">
			<h2 style="margin:0 0 14px;font-size:1.6rem;color:#19777e;font-weight:800;">Great Job!</h2>
			<div style="font-size:1rem;color:#334155;margin-bottom:18px;">You completed ${items.length} sentence${items.length===1?'':'s'}.<br/>Score: ${score} / ${items.length}</div>
			<button class="choice-btn" style="--cb-bg:#0d9488;--cb-color:#fff;font-weight:800;padding:14px 26px;" onclick="location.reload()">Play Again</button>
		</div>`;
	}

	// Helpers
		function tokenize(sentence){
		return sentence
			.replace(/[\u2018\u2019]/g, "'")
			.replace(/[\u201C\u201D]/g, '"')
			.trim()
			// Split on space but keep basic punctuation attached to preceding word
			.split(/\s+/)
			.filter(Boolean);
	}
		function normalizeSentence(s){
			return s.replace(/\s+/g,' ') // collapse spaces
							.replace(/\s([,;.?!])/g,'$1') // remove space before punctuation if any
							.trim();
		}
		function currentConstructTokens(constructEl){
			return Array.from(constructEl.querySelectorAll('[data-token]')).map(el=>el.getAttribute('data-token'));
		}
		function addTokenToLine(tok, originBtn){
			const constructEl = root.querySelector('#smConstruct');
			if (!constructEl) return;
			const placeholder = constructEl.querySelector('.sm-line-placeholder');
			if (placeholder) placeholder.remove();
				const span = document.createElement('span');
				span.className = 'sm-word-frag sm-word-inline';
				span.textContent = tok;
				span.setAttribute('data-token', tok);
				span.tabIndex = 0;
				span.addEventListener('click', () => { span.remove(); originBtn.disabled = false; originBtn.focus(); if (!constructEl.querySelector('[data-token]')) addPlaceholder(constructEl); });
				span.addEventListener('keydown', (e)=>{ if (e.key==='Backspace' || e.key==='Delete' || e.key==='Enter' || e.key===' ') { e.preventDefault(); span.click(); } });
				constructEl.appendChild(span);
		}
		function addPlaceholder(constructEl){
			const pl = document.createElement('span');
			pl.className='sm-line-placeholder';
			pl.textContent='Tap words below…';
			constructEl.appendChild(pl);
		}
	function shuffle(arr){ for (let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()* (i+1)); [arr[i],arr[j]]=[arr[j],arr[i]];} return arr; }
	function arraysEqualLoose(a,b){ if (a.length!==b.length) return false; for (let i=0;i<a.length;i++){ if(a[i]!==b[i]) return false; } return true; }

	function playSentenceAudio(item){
		if (item.sentenceAudioUrl){
			try { new Audio(item.sentenceAudioUrl).play(); return; } catch(e){ console.warn('Sentence audio play failed', e); }
		}
		// fallback: speak raw sentence via TTS utility if available
		if (ctx.playTTS){ ctx.playTTS(item.sentence); }
	}

	function playSfx(kind){
  try {
    if(!playSfx.cache){
      playSfx.cache = {
        right: new Audio('/Assets/audio/right.mp3'),
        wrong: new Audio('/Assets/audio/wrong.mp3')
      };
      Object.values(playSfx.cache).forEach(a=>{ a.preload='auto'; a.volume = 0.85; });
    }
    const a = playSfx.cache[kind];
    if(!a) return;
    // rewind
    a.currentTime = 0;
    const p = a.play();
    if (p && typeof p.catch === 'function') {
      p.catch(err=>{
        // Ignore autoplay errors silently; will play after user gesture (first click).
        if (err && !playSfx._warned && (err.name === 'NotAllowedError' || /gesture/i.test(err.message||''))){
          playSfx._warned = true;
          console.debug('[SentenceMode] Audio blocked until user gesture.');
        }
      });
    }
  } catch(e){ /* ignore */ }
}

// Fetch sentence audio URLs using existing get_audio_urls lambda.
// We send the derived keys: WORD_SENTENCE (uppercase normalization not enforced server-side presumably).
async function enrichSentenceAudio(items){
	const words = Array.from(new Set(items.map(i => (i.eng||'').trim()).filter(Boolean)));
	if (!words.length) return;
	const keys = words.map(w => `${w}_SENTENCE`);
	const endpoints = [ '/.netlify/functions/get_audio_urls' ];
	let resp = null; let lastErr=null;
	for (const url of endpoints){
		try {
			const r = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ words: keys }) });
			if (r.ok){ resp = await r.json(); break; }
		} catch(e){ lastErr=e; }
	}
	if (!resp || !resp.results){ if (lastErr) throw lastErr; return; }
	const map = {}; Object.entries(resp.results).forEach(([k,v])=>{ if (v && v.exists && v.url) map[k.toLowerCase()] = v.url; });
	items.forEach(it => {
		const key = `${(it.eng||'').trim()}_SENTENCE`.toLowerCase();
		if (map[key]) it.sentenceAudioUrl = map[key];
	});
	return { found: items.filter(i=>i.sentenceAudioUrl).length };
}

function renderErrorBox(msg){
	return `<div style="max-width:520px;margin:40px auto;text-align:center;font-family:Poppins,system-ui;padding:30px 24px;background:#fff;border:2px solid #fecaca;border-radius:20px;box-shadow:0 10px 32px -6px rgba(0,0,0,0.15);">
		<h2 style="margin:0 0 14px;font-size:1.4rem;color:#b91c1c;font-weight:800;">Sentence Mode</h2>
		<div style="font-size:.95rem;color:#334155;line-height:1.4;">${msg}</div>
	</div>`;
}

// (Phase 2+) Additional mechanics will be added below this line.

function injectStylesOnce(){
	if (document.getElementById('sentenceModeStyles')) return;
	const style = document.createElement('style');
	style.id = 'sentenceModeStyles';
	style.textContent = `
		.sentence-mode { font-family:Poppins,system-ui,sans-serif; animation:smFade .5s ease; }
		.sentence-mode .sm-header { display:flex;align-items:center;justify-content:space-between;gap:12px;margin:4px 0 16px; }
		.sentence-mode .sm-title { font-weight:800;color:#0f3f44;font-size:clamp(1rem,2vw,1.25rem); letter-spacing:.5px; }
		.sentence-mode .sm-counter { font-size:.75rem;font-weight:700;background:#e6f7f8;color:#19777e;padding:6px 12px;border-radius:20px;letter-spacing:.5px; }
		.sentence-mode .sm-box { position:relative;background:linear-gradient(165deg,#ffffff,#f2fbfc);border:2px solid #93cbcf;border-radius:24px;padding:22px 20px 20px;min-height:210px;display:flex;flex-direction:column;gap:14px;box-shadow:0 8px 28px -4px rgba(8,70,74,0.18); }
		.sentence-mode .sm-section-label { font-size:.65rem;font-weight:700; letter-spacing:.9px; color:#0d555c; text-transform:uppercase; }
		.sentence-mode .sm-construct { min-height:54px; display:flex;flex-wrap:wrap;gap:10px; padding:4px 2px 2px; }
		.sentence-mode .sm-construct-line { background:#ffffff;border:1px dashed #b9d9db; border-radius:14px; min-height:56px; padding:12px 14px; display:flex;align-items:center;flex-wrap:wrap; gap:8px; font-size:1.05rem; line-height:1.35; font-weight:600; color:#0f172a; }
		.sentence-mode .sm-construct-line.sm-correct { box-shadow:0 0 0 3px #0d948888; border-style:solid; }
		.sentence-mode .sm-word-frag { background:#19777e; color:#fff; padding:6px 12px; border-radius:12px; position:relative; cursor:pointer; display:inline-flex; align-items:center; gap:4px; font-weight:600; font-size:.95rem; box-shadow:0 2px 8px rgba(0,0,0,0.18); animation:fragPop .35s ease; }
		.sentence-mode .sm-word-frag.sm-word-inline { background:transparent; box-shadow:none; color:#0f172a; padding:0 4px; border-radius:8px; position:relative; font-weight:600; }
		.sentence-mode .sm-word-frag.sm-word-inline:after { content:''; position:absolute; left:0; right:0; bottom:0; height:2px; background:linear-gradient(90deg,#93cbcf,#41b6be); transform:scaleX(0); transform-origin:left; transition:transform .35s ease; }
		.sentence-mode .sm-word-frag.sm-word-inline:hover:after, .sentence-mode .sm-word-frag.sm-word-inline:focus-visible:after { transform:scaleX(1); }
		.sentence-mode .sm-word-frag.sm-word-inline { cursor:pointer; }
		.sentence-mode .sm-word-frag:focus-visible { outline:3px solid #41b6be; outline-offset:3px; }
		.sentence-mode .sm-line-placeholder { opacity:.5; font-weight:500; font-size:.9rem; letter-spacing:.5px; }
		.sentence-mode .sm-tokens { justify-content:center; }
		@keyframes fragPop { 0% { transform:scale(.4); opacity:0;} 70% { transform:scale(1.08); opacity:1;} 100% { transform:scale(1); opacity:1;} }
		.sentence-mode .sm-shake { animation:smShake .48s cubic-bezier(.36,.07,.19,.97); }
		@keyframes smShake { 10%, 90% { transform:translateX(-2px);} 20%, 80% { transform:translateX(4px);} 30%, 50%, 70% { transform:translateX(-6px);} 40%, 60% { transform:translateX(6px);} }
		.sentence-mode .sm-tokens { display:flex;flex-wrap:wrap;gap:10px; margin-top:2px; }
		.sentence-mode .sm-divider { height:1px; background:linear-gradient(90deg,rgba(147,203,207,0) 0%, #93cbcf 18%, #93cbcf 82%, rgba(147,203,207,0) 100%); margin:2px 0 4px; }
		.sentence-mode .sm-feedback { min-height:24px; font-size:.85rem; font-weight:600; letter-spacing:.3px; }
		.sentence-mode .sm-chip { --sm-bg:#ffffff; --sm-border:#cfdbe2; --sm-color:#0f172a; position:relative; font:inherit; font-weight:600; font-size:.95rem; padding:10px 16px; border:2px solid var(--sm-border); background:var(--sm-bg); color:var(--sm-color); border-radius:16px; cursor:pointer; display:inline-flex; align-items:center; gap:6px; line-height:1.1; box-shadow:0 3px 10px rgba(0,0,0,0.05); transition:background .25s, transform .25s, box-shadow .25s, border-color .25s; }
		.sentence-mode .sm-chip:hover:not(:disabled){ background:#f2fbfc; border-color:#41b6be; }
		.sentence-mode .sm-chip:active:not(:disabled){ transform:scale(.92); }
		.sentence-mode .sm-chip:disabled { opacity:.3; cursor:default; }
		.sentence-mode .sm-chip.placed { --sm-bg:#19777e; --sm-border:#19777e; --sm-color:#ffffff; font-weight:700; box-shadow:0 4px 16px -2px rgba(0,0,0,0.25); }
		.sentence-mode .sm-chip.placed:hover { background:#12595f; border-color:#12595f; }
		.sentence-mode .sm-actions { display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin-top:4px; }
		.sentence-mode .flex-spacer { flex:1; }
		.sentence-mode .sm-btn { --btn-bg:#0d9488; --btn-bg2:#0d9488; --btn-color:#fff; font:inherit; font-weight:700; letter-spacing:.3px; font-size:.85rem; border:none; background:linear-gradient(140deg,var(--btn-bg),var(--btn-bg2)); color:var(--btn-color); padding:12px 22px; border-radius:16px; cursor:pointer; position:relative; display:inline-flex; align-items:center; gap:6px; box-shadow:0 4px 16px -4px rgba(0,0,0,0.25); transition:box-shadow .28s, transform .28s, filter .28s; }
		.sentence-mode .sm-btn:hover { box-shadow:0 6px 22px -4px rgba(0,0,0,0.3); transform:translateY(-2px); }
		.sentence-mode .sm-btn:active { transform:scale(.9); box-shadow:0 4px 14px -4px rgba(0,0,0,0.35); }
		.sentence-mode .sm-btn:focus-visible { outline:3px solid #41b6be; outline-offset:3px; }
		.sentence-mode .sm-btn.primary { --btn-bg:#0d9488; --btn-bg2:#0f766e; }
		.sentence-mode .sm-btn.accent { --btn-bg:#19777e; --btn-bg2:#155e63; }
		.sentence-mode .sm-btn.ghost { --btn-bg:#ffffff; --btn-bg2:#ffffff; --btn-color:#0f3f44; border:2px solid #93cbcf; padding:10px 18px; box-shadow:0 2px 10px rgba(0,0,0,0.08); }
		.sentence-mode .sm-btn.ghost.audio { border-style:dashed; }
		.sentence-mode .sm-btn.ghost:hover { background:#f2fbfc; }
		.sentence-mode .sm-btn[disabled] { opacity:.35; pointer-events:none; }
		.sentence-mode .fade-in { animation:smPop .6s cubic-bezier(.16,.8,.24,1); }
		@keyframes smPop { 0% { opacity:0; transform:translateY(12px) scale(.96); } 60% { opacity:1; transform:translateY(0) scale(1.015);} 100% { opacity:1; transform:translateY(0) scale(1);} }
		@keyframes smFade { 0% { opacity:0;} 100% { opacity:1;} }
		@media (max-width:640px){ .sentence-mode .sm-chip { font-size:.9rem; padding:9px 14px; } .sentence-mode .sm-btn { padding:11px 18px; border-radius:14px; } }
	`;
	document.head.appendChild(style);
}

} // <-- close run(ctx)

