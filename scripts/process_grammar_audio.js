#!/usr/bin/env node
/**
 * Generate ElevenLabs audio clips for grammar example sentences.
 *
 * Sources: Games/english_arcade/data/grammar/**.json (array files containing
 *          objects with exampleSentence strings).
 * Naming:  <normalized word>[optional suffix]_grammar.mp3
 *
 * Workflow mirrors process_sentence_audio:
 *  - Discover sentences
 *  - Check R2 via get_audio_urls
 *  - Generate missing clips through eleven_labs_proxy
 *  - Upload via upload_audio
 *
 * CLI flags (optional):
 *  --dry-run           (no uploads)
 *  --force             (regenerate even if audio exists)
 *  --limit N           (process only first N sentences)
 *  --concurrency N     (parallel workers, default 3, max 8)
 *  --voice VOICE_ID    (override ElevenLabs voice)
 *  --model MODEL_ID    (override model)
 *  --include file1,file2  (only process specific JSON filenames)
 *  --exclude file1,file2  (skip specific JSON filenames)
 */

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const args = process.argv.slice(2);
function flag(name) {
	return args.includes(`--${name}`) || args.includes(`-${name}`);
}
function getArg(name, def) {
	let idx = args.findIndex(a => a === `--${name}` || a.startsWith(`--${name}=`));
	if (idx === -1) idx = args.findIndex(a => a === `-${name}` || a.startsWith(`-${name}=`));
	if (idx === -1) return def;
	const raw = args[idx];
	if (raw.includes('=')) return raw.split('=').slice(1).join('=');
	const next = args[idx + 1];
	if (!next || next.startsWith('-')) return true;
	return next;
}

const ROOT = process.cwd();
const GRAMMAR_DIR = path.join(ROOT, 'Games', 'english_arcade', 'data', 'grammar');

const DRY_RUN = flag('dry-run') || getArg('dry-run', false) === 'true';
const FORCE = flag('force') || getArg('force', false) === 'true';
const LIMIT = parseInt(getArg('limit', '0'), 10) || 0;
const CONCURRENCY = Math.max(1, Math.min(parseInt(getArg('concurrency', '3'), 10) || 3, 8));
const VOICE = getArg('voice', process.env.ELEVEN_LABS_DEFAULT_VOICE_ID || '');
const MODEL = getArg('model', process.env.ELEVEN_LABS_MODEL_ID || '');
const INCLUDE_FILES = (getArg('include', '') || '')
	.split(',')
	.map(s => s.trim())
	.filter(Boolean);
const EXCLUDE_FILES = (getArg('exclude', '') || '')
	.split(',')
	.map(s => s.trim())
	.filter(Boolean);

const functionBases = [
	'http://localhost:9000/.netlify/functions',
	'http://127.0.0.1:9000/.netlify/functions',
	'http://localhost:8888/.netlify/functions',
	'http://127.0.0.1:8888/.netlify/functions',
	'/.netlify/functions'
];

function normalizeKey(value) {
	return String(value || '')
		.trim()
		.toLowerCase()
		.replace(/['"`]/g, '')
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '')
		|| 'grammar';
}

async function detectFunctionsBase() {
	for (const base of functionBases) {
		try {
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 3000);
			const ping = await fetch(base + '/diag_env', { signal: controller.signal });
			clearTimeout(timeoutId);
			if (ping.ok) {
				console.log(`[INFO] Detected functions base: ${base}`);
				return base;
			}
		} catch (err) {
			// ignore and try next
		}
	}
	console.log('[WARN] Could not detect functions base, using default');
	return 'http://localhost:9000/.netlify/functions';
}

function listGrammarFiles(dir) {
	const results = [];
	const entries = fs.readdirSync(dir, { withFileTypes: true });
	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			results.push(...listGrammarFiles(fullPath));
		} else if (entry.isFile() && entry.name.endsWith('.json')) {
			if (INCLUDE_FILES.length && !INCLUDE_FILES.includes(entry.name)) continue;
			if (EXCLUDE_FILES.includes(entry.name)) continue;
			results.push(fullPath);
		}
	}
	return results;
}

function collectSentencesFromFile(filePath, register) {
	let parsed;
	try {
		const raw = fs.readFileSync(filePath, 'utf8');
		parsed = JSON.parse(raw);
	} catch (err) {
		console.warn('[WARN] Failed to parse JSON', filePath, err.message);
		return;
	}

	const relative = path.relative(GRAMMAR_DIR, filePath);
	const handleEntry = (entry, index) => {
		if (!entry || typeof entry !== 'object') return;
		const sentence = String(entry.exampleSentence || '').trim();
		if (!sentence) return;
		const entryId = entry.id ? String(entry.id).trim() : null;
		const baseWord = entry.word || entryId || `${relative}:${index}`;
		const article = entry.article ? String(entry.article).trim().toLowerCase() : '';
		register({
			file: relative,
			word: baseWord,
			entryId: entryId,
			article,
			text: sentence,
		});
	};

	if (Array.isArray(parsed)) {
		parsed.forEach((entry, idx) => handleEntry(entry, idx));
		return;
	}

	// Some lesson files have structure { steps: [...] } but we only care about
	// objects with exampleSentence. Scan object values.
	const values = Array.isArray(parsed.entries) ? parsed.entries : Object.values(parsed);
	const visit = (val) => {
		if (!val) return;
		if (Array.isArray(val)) {
			val.forEach((item, idx) => handleEntry(item, idx));
		} else if (typeof val === 'object') {
			if ('exampleSentence' in val) {
				handleEntry(val, 0);
			} else {
				Object.values(val).forEach(child => visit(child));
			}
		}
	};
	visit(values);
}

function buildSentenceCatalog() {
	const files = listGrammarFiles(GRAMMAR_DIR);
	const catalog = [];
	const keyMap = new Map();

	const register = ({ file, word, entryId, article, text }) => {
		// Generate a simple hash of the sentence for uniqueness
		let hash = 0;
		for (let i = 0; i < text.length; i++) {
			const char = text.charCodeAt(i);
			hash = ((hash << 5) - hash) + char;
			hash = hash & hash; // Convert to 32bit integer
		}
		hash = Math.abs(hash) % 10000; // Keep it short (4 digits)

		// If entry has an explicit id, use it as-is with _grammar suffix
		let base;
		if (entryId) {
			base = `${entryId}_grammar`;
		} else {
			const normalizedWord = normalizeKey(word);
			base = normalizedWord ? `${normalizedWord}_grammar` : 'grammar_clip';
		}

		const ensureUnique = (candidate, depth = 0) => {
			if (!keyMap.has(candidate)) return candidate;
			const existing = keyMap.get(candidate);
			if (existing.text === text) return candidate; // identical sentence, reuse key
			// When collision detected, append hash to make it unique
			const suffixParts = [hash.toString().padStart(4, '0')];
			if (depth === 0 && article) suffixParts.push(normalizeKey(article));
			const nextCandidate = entryId 
				? `${entryId}_${suffixParts.join('_')}_grammar`
				: `${normalizeKey(word)}_${suffixParts.join('_')}_grammar`;
			return ensureUnique(nextCandidate, depth + 1);
		};

		const key = ensureUnique(base);
		const existing = keyMap.get(key);
		if (existing && existing.text === text) return; // duplicate entry

		keyMap.set(key, { file, word, entryId, article, text });
		catalog.push({ key, file, word, entryId, article, text });
	};

	files.forEach(file => collectSentencesFromFile(file, register));
	return catalog;
}

async function audioExists(base, key) {
	try {
		const res = await fetch(base + '/get_audio_urls', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ words: [key] })
		});
		if (!res.ok) return false;
		const data = await res.json();
		return !!(data.results && data.results[key] && data.results[key].exists);
	} catch (err) {
		return false;
	}
}

async function synthesize(base, text) {
	const payload = { text };
	if (VOICE) payload.voice_id = VOICE;
	if (MODEL) payload.model_id = MODEL;

	let attempt = 0;
	const maxAttempts = 6;
	let lastErr = null;

	while (attempt < maxAttempts) {
		try {
			const res = await fetch(base + '/eleven_labs_proxy', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			if (!res.ok) {
				let detail = '';
				try {
					const errBody = await res.json();
					detail = errBody && (errBody.details || errBody.error || '');
				} catch (_) {}
				const status = res.status;
				if (status === 429 || status === 503) {
					attempt++;
					const retry = res.headers && res.headers.get ? res.headers.get('retry-after') : null;
					const waitMs = retry ? parseFloat(retry) * 1000 : Math.min(30000, 2000 * Math.pow(2, attempt));
					await new Promise(r => setTimeout(r, waitMs));
					continue;
				}
				throw new Error(`TTS error ${status}${detail ? ' :: ' + detail : ''}`);
			}
			const data = await res.json();
			if (!data.audio) throw new Error('TTS response missing audio');
			return data.audio;
		} catch (err) {
			lastErr = err;
			attempt++;
			if (attempt < maxAttempts) {
				await new Promise(r => setTimeout(r, Math.min(30000, 1000 * Math.pow(2, attempt - 1))));
			}
		}
	}
	throw lastErr || new Error('TTS failed');
}

async function upload(base, key, audioB64) {
	const res = await fetch(base + '/upload_audio', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ word: key, fileDataBase64: audioB64 })
	});
	if (!res.ok) throw new Error(`Upload failed HTTP ${res.status}`);
	const data = await res.json();
	if (!data.success) throw new Error('Upload response not successful');
	return data.url;
}

async function main() {
	if (!fs.existsSync(GRAMMAR_DIR)) {
		console.error('[ERROR] Grammar data directory not found:', GRAMMAR_DIR);
		process.exit(1);
	}

	const catalog = buildSentenceCatalog();
	catalog.sort((a, b) => a.key.localeCompare(b.key));
	const targetList = LIMIT > 0 ? catalog.slice(0, LIMIT) : catalog;

	console.log(`[INFO] Collected ${catalog.length} grammar example sentences.`);
	console.log(`[INFO] Processing ${targetList.length} items (dryRun=${DRY_RUN}, force=${FORCE}, concurrency=${CONCURRENCY}).`);

	if (!targetList.length) {
		console.log('[INFO] Nothing to process.');
		return;
	}

	const base = await detectFunctionsBase();
	console.log('[INFO] Using Netlify functions base:', base);

	let index = 0;
	const summary = {
		considered: targetList.length,
		generated: 0,
		skippedExisting: 0,
		errors: 0,
		dryRun: DRY_RUN,
		force: FORCE,
	};

	async function worker() {
		while (index < targetList.length) {
			const current = targetList[index++];
			const { key, text } = current;
			try {
				if (!FORCE && !DRY_RUN) {
					const exists = await audioExists(base, key);
					if (exists) {
						summary.skippedExisting++;
						continue;
					}
				}
				if (DRY_RUN) {
					console.log('[DRY] Would generate', key, '::', text);
					continue;
				}
				const audioB64 = await synthesize(base, text);
				await upload(base, key, audioB64);
				summary.generated++;
				console.log('[OK]', key);
			} catch (err) {
				summary.errors++;
				console.warn('[ERR]', key, '::', err.message);
			}
		}
	}

	await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

	const reportDir = path.join(ROOT, 'build');
	if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
	const reportPath = path.join(reportDir, 'grammar-audio-report.json');
	try {
		fs.writeFileSync(reportPath, JSON.stringify({
			generatedAt: new Date().toISOString(),
			summary,
			items: targetList
		}, null, 2));
	} catch (err) {
		console.warn('[WARN] Failed to write report:', err.message);
	}

	console.log('\n=== Grammar Audio Report ===');
	console.log(summary);
	console.log('Report saved to', reportPath);
}

main().catch(err => {
	console.error('[FATAL]', err);
	process.exit(1);
});

