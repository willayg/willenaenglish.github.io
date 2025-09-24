// Mini Player Bootstrap (ID-based cross-device)
// -------------------------------------------------------------
// Responsibilities:
// 1. Read id from URL (?id=...)
// 2. Fetch JSON from server /.netlify/functions/live_game?id=...
// 3. Normalize words -> pass to requested mode (all modes active except Level Up)
// 4. Provide common utilities (TTS) to modes that need them.
// 5. Render errors gracefully if anything missing.
// -------------------------------------------------------------

import { loadMode } from './core/mode-registry.js';
import { playTTS, preprocessTTS, preloadAllAudio } from './tts.js';

// Abort early if auth gate has not set window.__AUTH_OK (play.html injects it after whoami)
if (!window.__AUTH_OK) {
	// Provide minimal placeholder; the redirect should already be in progress if unauth.
	console.warn('[MiniPlayer] Auth flag missing at module start; likely redirecting.');
}

// Inject enhanced tap-spell styles (idempotent) for spelling / listen_and_spell when loaded live
(function ensureTapSpellStyles(){
	if (document.getElementById('tapSpellLiveEnhance')) return;
	const style = document.createElement('style');
	style.id = 'tapSpellLiveEnhance';
	style.textContent = `
	/* Live Tap-Spell Enhancements */
	.tap-spell { --ts-slot-size:54px; --ts-tile-size:62px; --ts-gap:10px; }
	.tap-spell.from-builder { --ts-slot-size:54px; --ts-tile-size:62px; }
	@media (max-width:640px){ .tap-spell { --ts-slot-size:48px; --ts-tile-size:56px; --ts-gap:8px; } }
	@media (max-width:480px){ .tap-spell { --ts-slot-size:44px; --ts-tile-size:52px; --ts-gap:7px; } }
		/* Reset any generic choice button sizing that leaks onto tile-btn */
		#letterTiles .tile-btn { min-width:var(--ts-tile-size) !important; max-width:var(--ts-tile-size) !important; min-height:var(--ts-tile-size) !important; max-height:var(--ts-tile-size) !important; }
	.tap-spell #letterSlots { display:flex; flex-wrap:wrap; justify-content:center; gap:var(--ts-gap); margin:8px 0 12px; }
	.tap-spell #letterSlots .slot { width:var(--ts-slot-size); height:var(--ts-slot-size); border:3px solid #93cbcf; border-radius:14px; background:#f7fafc; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:1.2em; color:#0f172a; box-shadow:0 2px 4px rgba(0,0,0,0.08); transition:background .2s,border-color .2s; }
	.tap-spell #letterSlots .slot:hover { background:#fff; border-color:#41b6beff; cursor:pointer; }
	.tap-spell #letterTiles { display:flex; flex-wrap:wrap; justify-content:center; gap:var(--ts-gap); max-width:640px; margin:0 auto; }
	.tap-spell #letterTiles .tile-btn { width:var(--ts-tile-size); height:var(--ts-tile-size); border:3px solid #cfdbe2; border-radius:14px; background:#fff; font-weight:800; font-size:1.25em; color:#314249; display:flex; align-items:center; justify-content:center; box-shadow:0 3px 10px rgba(0,0,0,0.08); transition:transform .18s, box-shadow .18s, background .2s, border-color .2s; }
	.tap-spell #letterTiles .tile-btn:hover:not(:disabled){ transform:translateY(-4px); box-shadow:0 6px 16px rgba(0,0,0,0.18); border-color:#41b6beff; }
	.tap-spell #letterTiles .tile-btn:active:not(:disabled){ transform:scale(.9); }
	.tap-spell #letterTiles .tile-btn:disabled { opacity:.15; pointer-events:none; }
	.tap-spell #spelling-feedback, .tap-spell #listening-feedback { min-height:26px; text-align:center; font-size:1.05em; color:#555; margin-top:10px; font-weight:600; }
	.tap-spell #spelling-score, .tap-spell #listening-score { text-align:center; font-size:1.2em; font-weight:700; color:#19777e; }
	`;
	document.head.appendChild(style);
})();

// Use inner stage container so layout (fixed root & header spacing) remains intact
const root = document.getElementById('gameStage') || document.getElementById('gameRoot');

function showError(msg) {
	if (root) {
		root.innerHTML = `<div style="max-width:480px;margin:40px auto;text-align:center;font-family:system-ui,sans-serif;padding:30px 24px;background:#fff;border:2px solid #fecaca;border-radius:18px;box-shadow:0 6px 24px rgba(0,0,0,0.1);">
			<h2 style="margin:0 0 12px;font-size:1.4rem;color:#b91c1c;">Problem Loading Game</h2>
			<div style="color:#334155;font-size:.95rem;line-height:1.4;">${msg}</div>
		</div>`;
	}
	console.error('[MiniPlayer]', msg);
}

function getId() {
	const params = new URLSearchParams(location.search);
	return params.get('id');
}

function getModeFromUrl() {
  const params = new URLSearchParams(location.search);
  return params.get('mode');
}

function isFromBuilder() {
	const params = new URLSearchParams(location.search);
	return params.get('src') === 'builder';
}

async function fetchGame(id) {
	try {
		const resp = await fetch('/.netlify/functions/live_game?id=' + encodeURIComponent(id), { cache: 'no-store' });
		const js = await resp.json().catch(()=>null);
		if (!resp.ok || !js || !js.success) throw new Error(js && js.error || 'Fetch failed');
		return js;
	} catch(e) {
		showError('Could not load game: ' + (e.message || 'error'));
		return null;
	}
}

function normalizeWords(list) {
	if (!Array.isArray(list)) return [];
	return list.map(w => {
		const eng = w.eng || w.en || '';
		const kor = w.kor || w.kr || w.translation || '';
		if (!eng || !kor) return null; // drop incomplete
		return {
			eng,
			kor,
			// Preserve multiple image field aliases so picture modes can find one
			img: w.img || w.image || w.picture || w.image_url || null,
			image: w.image || null,
			image_url: w.image_url || null,
			picture: w.picture || null,
			// Preserve audio aliases for listening modes
			audio: w.audio || w.audio_eng || w.tts || w.audio_url || null,
			audio_eng: w.audio_eng || null,
			audio_kor: w.audio_kor || null,
			tts: w.tts || null,
			audio_url: w.audio_url || null,
			definition: w.definition || '',
			// include any extra fields if needed later (shallow copy limited safe list)
			part: w.part || w.pos || null
		};
	}).filter(Boolean);
}

async function start() {
	const id = getId();
	if (!id) { showError('Missing id in URL.'); return; }
	if (isFromBuilder()) {
		try { document.body.classList.add('from-builder'); } catch {}
		window.__WA_FROM_BUILDER = true;
	}
	const stub = await fetchGame(id);
	if (!stub) return; // fetchGame already showed error
	const modeKey = getModeFromUrl() || stub.mode || (Array.isArray(stub.modes) ? stub.modes[0] : null) || 'multi_choice_eng_to_kor';
	const words = normalizeWords(stub.wordlist || stub.words || []);
	if (!words.length) {
		showError('No valid words found in game data.');
		return;
	}

	// If the selected mode depends on audio, preload existing audio (generation disabled) and skip missing ones.
	const audioModes = new Set(['easy_picture', 'listening_multi_choice', 'listen_and_spell', 'spelling']);
	if (audioModes.has(modeKey)) {
		if (root) {
			root.innerHTML = `<div style="max-width:520px;margin:40px auto;text-align:center;font-family:system-ui,sans-serif;padding:24px 20px;background:#fff;border:2px solid #cfe8ea;border-radius:16px;box-shadow:0 6px 24px rgba(0,0,0,0.08);">
				<h2 style="margin:0 0 10px;font-size:1.2rem;color:#19777e;">Preparing audio…</h2>
				<div id="audioPrepMsg" style="color:#334155;font-size:.95rem;line-height:1.4;">Checking and loading sounds</div>
				<div style="margin-top:12px;height:10px;background:#eef2f7;border-radius:999px;overflow:hidden;">
					<div id="audioPrepBar" style="height:100%;width:0;background:#93cbcf;transition:width .15s ease;"></div>
				</div>
			</div>`;
		}
		try {
			const engWords = words.map(w => w.eng).filter(Boolean);
			const summary = await preloadAllAudio(engWords, (p) => {
				const bar = document.getElementById('audioPrepBar');
				const msg = document.getElementById('audioPrepMsg');
				if (bar && typeof p.progress === 'number') {
					bar.style.width = Math.max(0, Math.min(100, Math.round(p.progress))) + '%';
				}
				if (msg && p.phase) {
					msg.textContent = p.phase === 'checking' ? 'Checking existing audio…' : p.phase === 'generating' ? 'Skipping generation…' : 'Loading audio…';
				}
			});
			if (summary && summary.missing && summary.missing.length) {
				// Remove words lacking audio so audio-dependent gameplay never shows them
				const missingSet = new Set(summary.missing.map(w => w.toLowerCase()));
				for (let i = words.length - 1; i >= 0; i--) {
					if (missingSet.has(words[i].eng.toLowerCase())) words.splice(i, 1);
				}
				if (!words.length) {
					showError('All words missing audio for this mode.');
					return;
				}
			}
		} catch (e) {
			console.warn('Audio preload failed; proceeding with whatever audio is available.', e);
		}
	}
	try {
		const mode = await loadMode(modeKey);
		const context = {
			wordList: words,
			gameArea: root,
			startGame: (k) => { if (k) { location.search = '?id=' + encodeURIComponent(getId()) + '&mode=' + encodeURIComponent(k); } },
			listName: stub.title || 'Live List',
			// Provide shared utilities for modes that require audio
			playTTS,
			preprocessTTS
		};
		mode.run(context);
	} catch(e) {
		console.error(e);
		showError('Failed to load mode: ' + e.message);
	}
}

start();
