import { state } from './state.js';
import { updatePreview, updatePreviewStyles } from './preview.js';
import { extractWordsWithAI } from './ai.js';
import { ensureFontsLoaded } from './style.js';
import { updateCurrentWordsFromTextarea } from './worksheet_integration.js';
import { highlightDuplicates as worksheetHighlightDuplicates } from './worksheet.js';

const currentWords = state.currentWords;

// Map common English idioms to preferred, natural Korean equivalents (figurative, not literal)
function normalizeEngIdiom(str = '') {
    return (str || '')
        .toLowerCase()
        .replace(/[^a-z\s']/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

const IDIOM_KO_MAP = new Map([
    ['the early bird catches the worm', '부지런한 사람이 기회를 잡는다'],
    ['early bird catches the worm', '부지런한 사람이 기회를 잡는다'],
    ["a wolf in sheep's clothing", '양의 탈을 쓴 늑대'],
    ['wolf in sheeps clothing', '양의 탈을 쓴 늑대'],
    ['let sleeping dogs lie', '긁어 부스럼'],
    ['kill two birds with one stone', '일석이조'],
    ['a bird in the hand is worth two in the bush', '지금 가진 게 더 소중하다'],
    ['when pigs fly', '절대 일어나지 않을 일'],
    ["the lion's share", '가장 큰 몫'],
    ['the lions share', '가장 큰 몫'],
    ['a fish out of water', '낯선 환경에서 어색한 사람'],
    ["the straw that broke the camel's back", '마지막 결정타'],
    ['the straw that broke the camels back', '마지막 결정타'],
    ['the elephant in the room', '모두가 알지만 말하지 않는 문제'],
    ['hold your horses', '진정해'],
    ['rat race', '치열한 경쟁 사회'],
]);

function applyFigurativeKorean(line) {
    if (!line || !line.includes(',')) return line;
    const [engRaw, ...rest] = line.split(',');
    const eng = (engRaw || '').trim();
    const engKey = normalizeEngIdiom(eng);
    const mapped = IDIOM_KO_MAP.get(engKey);
    if (!mapped) return line.trim();
    return `${eng}, ${mapped}`;
}

export async function updateDesign() {
    state.currentSettings.design = document.getElementById('designSelect').value;
    await ensureFontsLoaded();
    await updatePreview();
    setTimeout(updatePreview, 500);
}

export async function extractWords() {
    const passage = document.getElementById('passageInput').value;
    const topic = document.getElementById('topicInput')?.value || '';
    const extractionMode = document.getElementById('extractionMode')?.value || 'passage';
    const difficulty = document.getElementById('difficultySelect').value;
    const wordCount = parseInt(document.getElementById('wordCountInput').value);
    const ta = document.getElementById('wordListTextarea');

    async function runAIExtraction(promptContent) {
        const response = await fetch('/.netlify/functions/openai_proxy', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: 'chat/completions', payload: { model: 'gpt-4o-mini', messages: [ { role: 'system', content: 'You are a helpful ESL assistant. When translating idioms to Korean, use natural, culturally appropriate equivalents or clear paraphrases, not literal word-for-word translations.' }, { role: 'user', content: promptContent } ], max_tokens: 1500, temperature: 0.4 } })
        });
        const data = await response.json();
        return data.data.choices?.[0]?.message?.content || '';
    }

    // Helper: generate a concise worksheet title if the title input is empty
    function toTitleCase(str = '') {
        const smallWords = new Set(['a','an','and','as','at','but','by','for','in','nor','of','on','or','so','the','to','up','yet']);
        return (str || '')
            .toLowerCase()
            .split(/\s+/)
            .map((w, i) => {
                if (i > 0 && smallWords.has(w)) return w;
                return w.charAt(0).toUpperCase() + w.slice(1);
            })
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function sanitizeTitle(raw = '') {
        let t = (raw || '').replace(/["'`]/g, '').trim();
        // Keep it short and clean
        t = t.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9)!?\-\s]+$/g, '').trim();
        if (t.endsWith('.')) t = t.slice(0, -1);
        // Title case
        t = toTitleCase(t);
        // Avoid empty leftovers
        return t.slice(0, 80).trim();
    }

    async function maybeGenerateAutoTitle({ mode, topicText, passageText, wordsList, buttonEl }) {
        const titleInput = document.getElementById('titleInput');
        if (!titleInput || titleInput.value.trim()) return; // respect user-entered titles

        // Prefer using the words list to avoid re-sending long passages
        const englishWords = Array.isArray(wordsList)
            ? wordsList.map(line => (line.split(',')[0] || '').trim()).filter(Boolean).slice(0, 8)
            : [];

        let prompt = '';
        if ((mode || '').toLowerCase() === 'topic' && (topicText || '').trim()) {
            prompt = `Create a short, catchy vocabulary worksheet title (3–6 words, Title Case, no quotes) about the topic: "${topicText.trim()}". Return only the title.`;
        } else if (englishWords.length) {
            prompt = `Create a short, catchy vocabulary worksheet title (3–6 words, Title Case, no quotes) based on these words: ${englishWords.join(', ')}. Return only the title.`;
        } else if ((passageText || '').trim()) {
            // Fallback to passage if no words yet
            const snippet = passageText.trim().slice(0, 400);
            prompt = `Create a short, catchy vocabulary worksheet title (3–6 words, Title Case, no quotes) based on this passage: ${snippet}. Return only the title.`;
        }

        // UI hint like Mint AI: briefly show "Creating title..."
        const originalBtnText = buttonEl?.textContent;
        if (buttonEl) buttonEl.textContent = 'Creating title...';
        try {
            let aiTitle = '';
            if (prompt) aiTitle = await runAIExtraction(prompt);
            let finalTitle = sanitizeTitle(aiTitle);

            // Fallbacks if AI empty/failed
            if (!finalTitle) {
                if ((mode || '').toLowerCase() === 'topic' && (topicText || '').trim()) {
                    const base = toTitleCase(topicText.trim());
                    finalTitle = base.includes('Vocabulary') ? base : `${base} Vocabulary`;
                } else if (englishWords.length) {
                    const base = toTitleCase(englishWords.slice(0, 2).join(' & '));
                    finalTitle = `${base} Vocabulary`;
                } else {
                    finalTitle = 'Vocabulary Practice';
                }
            }

            if (!titleInput.value.trim() && finalTitle) {
                titleInput.value = finalTitle;
                await updatePreview();
            }
        } catch (e) {
            console.warn('Auto-title generation failed:', e);
            // Fallback without AI
            if (!titleInput.value.trim()) {
                if ((mode || '').toLowerCase() === 'topic' && (topicText || '').trim()) {
                    const base = toTitleCase(topicText.trim());
                    titleInput.value = base.includes('Vocabulary') ? base : `${base} Vocabulary`;
                } else if (englishWords.length) {
                    const base = toTitleCase(englishWords.slice(0, 2).join(' & '));
                    titleInput.value = `${base} Vocabulary`;
                } else {
                    titleInput.value = 'Vocabulary Practice';
                }
                await updatePreview();
            }
        } finally {
            if (buttonEl && originalBtnText) buttonEl.textContent = originalBtnText;
        }
    }

    if (extractionMode === 'topic') {
        const t = (topic || '').trim();
        if (!t) { alert('Please enter a topic.'); return; }
        const extractBtn = document.getElementById('extractBtn');
        const originalText = extractBtn.textContent; extractBtn.textContent = 'Generating...'; extractBtn.disabled = true;
        let newWords = [];
        try {
            let promptContent = '';
            switch ((difficulty || '').toLowerCase()) {
                case 'easy':
                    promptContent = `You are an ESL teacher for beginners. Given the TOPIC below, generate exactly ${wordCount} simple and useful English words closely related to the topic. Prefer high-frequency, easy, everyday vocabulary (1–2 syllables where possible).\n\nRules:\n- Beginners level (very simple words)\n- Avoid advanced or rare words\n- Avoid duplicates or near-duplicates\n- Output EXACTLY ${wordCount} items\n- Format: english, korean (one pair per line)\n- Translation policy: For ordinary single words, use the most common Korean translation. For any phrase with figurative meaning, translate naturally (not word-for-word).\n\nTOPIC:\n${t}`;
                    break;
                case 'medium':
                    promptContent = `You are an ESL teacher for intermediate learners. Given the TOPIC below, generate exactly ${wordCount} moderately challenging vocabulary items related to the topic. Include useful single words and some common phrasal verbs or collocations.\n\nRules:\n- Intermediate level (not too basic, not highly advanced)\n- Useful in everyday or academic contexts\n- Avoid duplicates or near-duplicates\n- Output EXACTLY ${wordCount} items\n- Format: english, korean (one pair per line)\n- Translation policy: If an item is idiomatic or figurative, provide a natural Korean equivalent or concise paraphrase that conveys meaning (avoid literal renderings).\n\nTOPIC:\n${t}`;
                    break;
                case 'hard':
                    promptContent = `You are an ESL teacher for advanced learners. Given the TOPIC below, generate exactly ${wordCount} challenging vocabulary items related to the topic, including advanced words, nuanced collocations, phrasal verbs, and idiomatic expressions.\n\nRules:\n- Advanced level (less common vocabulary)\n- Mix of single words, multi-word expressions, and idioms\n- No duplicates or near-duplicates\n- Output EXACTLY ${wordCount} items\n- Format: english, korean (one pair per line)\n- Translation policy: For idioms and figurative phrases, translate into a common, natural Korean equivalent (or paraphrase) that preserves meaning and tone; do not translate literally.\n\nTOPIC:\n${t}`;
                    break;
                case 'phrases':
                    promptContent = `You are an ESL teacher. Given the TOPIC below, generate exactly ${wordCount} phrases and idioms (multi-word expressions only) that are clearly related to the topic. Do NOT include single words.\n\nRules:\n- Phrases/idioms only (2+ words each)\n- Must be clearly related to the topic\n- No duplicates or near-duplicates\n- Output EXACTLY ${wordCount} items\n- Format: english, korean (one pair per line)\n- Translation policy: Provide a culturally appropriate, natural Korean equivalent that conveys the same meaning/feeling. Avoid literal, word-for-word translations. If no set equivalent exists, paraphrase clearly.\n\nExamples (format: english, korean) — use these as style guidance, not as outputs:\n- let the cat out of the bag, 비밀을 털어놓다\n- the elephant in the room, 모두가 알지만 말하지 않는 문제\n- hold your horses, 진정해\n- bite off more than you can chew, 욕심을 과하게 부리다\n- once in a blue moon, 거의 드물게\n\nTOPIC:\n${t}`;
                    break;
                default:
                    // Fallback to intermediate topic list
                    promptContent = `You are an ESL teacher. Given the TOPIC below, generate exactly ${wordCount} useful English words or short phrases related to the topic.\n\nRules:\n- Avoid duplicates or near-duplicates\n- Output EXACTLY ${wordCount} items\n- Format: english, korean (one pair per line)\n- Translation policy: If any item is idiomatic/figurative, translate naturally (not literal).\n\nTOPIC:\n${t}`;
            }
            const aiResponse = await runAIExtraction(promptContent);
            if (aiResponse) {
                const lines = aiResponse.split('\n').filter(line => line.trim() && line.includes(','));
                newWords = lines.map(line => applyFigurativeKorean(line.trim())).filter(Boolean);
            }
        } catch (e) { console.error('AI topic extraction error:', e); alert('Error generating topic list. Please try again.'); }
        const existing = (ta?.value || '').trim();
        const combined = existing ? (existing + '\n' + newWords.join('\n')) : newWords.join('\n');
        if (ta) ta.value = combined;
        updateCurrentWordsFromTextarea();
        worksheetHighlightDuplicates();
    // Auto-title if empty (based on topic or generated words)
    await maybeGenerateAutoTitle({ mode: 'topic', topicText: t, passageText: '', wordsList: newWords, buttonEl: document.getElementById('extractBtn') });
    updatePreview();
        extractBtn.textContent = originalText; extractBtn.disabled = false;
        return;
    }

    if (!passage?.trim()) { alert('Please enter a passage first.'); return; }
    try {
    const extractBtn = document.getElementById('extractBtn');
    const originalText = extractBtn.textContent; extractBtn.textContent = 'Generating...'; extractBtn.disabled = true;
        const existing = (ta?.value || '').trim();
        let newWords = [];
        try {
            const aiResponse = await extractWordsWithAI(passage, wordCount, difficulty);
            if (aiResponse) {
                const lines = aiResponse.split('\n').filter(line => line.trim() && line.includes(','));
                newWords = lines.map(line => applyFigurativeKorean(line.trim())).filter(Boolean);
            }
        } catch (aiError) {
            console.warn('AI extraction failed, using simple extraction:', aiError);
            const words = passage.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 2).filter((w, i, a) => a.indexOf(w) === i).slice(0, wordCount);
            newWords = words.map(w => `${w}, ${w}`);
        }
        const combined = existing ? (existing + '\n' + newWords.join('\n')) : newWords.join('\n');
        if (ta) ta.value = combined;
        updateCurrentWordsFromTextarea();
        worksheetHighlightDuplicates();
    // Auto-title if empty (based on new words or passage)
    await maybeGenerateAutoTitle({ mode: extractionMode, topicText: '', passageText: passage, wordsList: newWords, buttonEl: extractBtn });
    updatePreview();
        extractBtn.textContent = originalText; extractBtn.disabled = false;
    } catch (error) {
        console.error('Error extracting words:', error);
        alert('Error extracting words. Please try again.');
        const extractBtn = document.getElementById('extractBtn');
    if (extractBtn) { extractBtn.textContent = 'Generate List'; extractBtn.disabled = false; }
    }
}
