#!/usr/bin/env node
/**
 * Direct ElevenLabs audio generation (no Netlify proxy).
 * Reads voice ID from .env and generates grammar audio directly.
 * 
 * Usage:
 *   node scripts/direct-grammar-audio.js --level level3 --force
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

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
const LEVEL_FILTER = getArg('level', '');

// Read from .env
const VOICE_ID = process.env.ELEVEN_LABS_DEFAULT_VOICE_ID;
const API_KEY = process.env.ELEVEN_LABS_API_KEY;
const MODEL_ID = process.env.ELEVEN_LABS_MODEL_ID || 'eleven_monolingual_v1';

// R2 config
const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_BUCKET = process.env.R2_BUCKET_NAME || 'willena-files';

if (!VOICE_ID) {
	console.error('[ERROR] ELEVEN_LABS_DEFAULT_VOICE_ID not set in .env');
	process.exit(1);
}
if (!API_KEY) {
	console.error('[ERROR] ELEVEN_LABS_API_KEY not set in .env');
	process.exit(1);
}

console.log(`[INFO] Using voice ID: ${VOICE_ID}`);
console.log(`[INFO] Model: ${MODEL_ID}`);
console.log(`[INFO] Dry run: ${DRY_RUN}`);

let s3Client;
if (!DRY_RUN && R2_ACCESS_KEY && R2_SECRET_KEY && R2_ENDPOINT) {
	s3Client = new S3Client({
		region: 'auto',
		endpoint: R2_ENDPOINT,
		credentials: {
			accessKeyId: R2_ACCESS_KEY,
			secretAccessKey: R2_SECRET_KEY
		}
	});
	console.log(`[INFO] R2 configured for uploads`);
}

async function collectGrammarItems() {
	const items = [];
	let dirToSearch = GRAMMAR_DIR;

	if (LEVEL_FILTER) {
		dirToSearch = path.join(GRAMMAR_DIR, LEVEL_FILTER);
		if (!fs.existsSync(dirToSearch)) {
			console.error(`[ERROR] Level directory not found: ${dirToSearch}`);
			process.exit(1);
		}
	}

	const files = fs.readdirSync(dirToSearch);
	for (const file of files) {
		if (!file.endsWith('.json')) continue;

		const filePath = path.join(dirToSearch, file);
		try {
			const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
			if (!Array.isArray(data)) continue;

			for (const item of data) {
				if (item.exampleSentence && (item.id || item.word)) {
					items.push({
						sentence: item.exampleSentence,
						id: item.id,
						word: item.word,
						file: file
					});
				}
			}
		} catch (err) {
			console.warn(`[WARN] Error reading ${file}: ${err.message}`);
		}
	}

	return items;
}

function normalizeKey(word) {
	return String(word || '')
		.trim()
		.toLowerCase()
		.replace(/['"`]/g, '')
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '')
		|| 'grammar';
}

async function generateAudio(text) {
	const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`;

	try {
		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'xi-api-key': API_KEY,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				text: text,
				model_id: MODEL_ID,
				voice_settings: {
					stability: 1.0,
					similarity_boost: 1.0,
					style: 0.0,
					use_speaker_boost: false
				}
			})
		});

		if (!response.ok) {
			const errText = await response.text();
			throw new Error(`ElevenLabs error ${response.status}: ${errText}`);
		}

		return await response.buffer();
	} catch (err) {
		throw new Error(`Failed to generate audio: ${err.message}`);
	}
}

async function uploadToR2(key, buffer) {
	if (!s3Client) {
		console.warn(`[WARN] R2 not configured, skipping upload for ${key}`);
		return;
	}

	try {
		await s3Client.send(new PutObjectCommand({
			Bucket: R2_BUCKET,
			Key: key,
			Body: buffer,
			ContentType: 'audio/mpeg'
		}));
		console.log(`[R2] Uploaded ${key}`);
	} catch (err) {
		console.error(`[ERROR] R2 upload failed for ${key}: ${err.message}`);
		throw err;
	}
}

async function processItems(items) {
	let generated = 0;
	let errors = 0;

	console.log(`[INFO] Processing ${items.length} grammar items...`);

	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		// Use id if available, otherwise fall back to word
		const base = item.id || normalizeKey(item.word);
		const key = `${base}_grammar.mp3`;

		try {
			if (DRY_RUN) {
				console.log(`[DRY] Would generate: ${key} from "${item.sentence.substring(0, 50)}..."`);
				generated++;
			} else {
				process.stdout.write(`[${i + 1}/${items.length}] Generating ${key}... `);
				const audioBuffer = await generateAudio(item.sentence);

				if (s3Client) {
					await uploadToR2(key, audioBuffer);
					console.log('✓');
				} else {
					console.log('✓ (generated, no R2 upload)');
				}
				generated++;
			}
		} catch (err) {
			console.error(`✗ Error: ${err.message}`);
			errors++;
		}

		// Rate limiting
		if (i < items.length - 1) {
			await new Promise(resolve => setTimeout(resolve, 100));
		}
	}

	return { generated, errors };
}

async function main() {
	try {
		const items = await collectGrammarItems();
		console.log(`[INFO] Collected ${items.length} grammar sentences.`);

		const result = await processItems(items);

		console.log('\n=== Audio Generation Report ===');
		console.log(`Generated: ${result.generated}`);
		console.log(`Errors: ${result.errors}`);
		console.log(`Voice ID: ${VOICE_ID}`);

		if (result.errors > 0) {
			process.exit(1);
		}
	} catch (err) {
		console.error('[ERROR]', err);
		process.exit(1);
	}
}

main();
