import { state } from './state.js';
import { updatePreview, updatePreviewStyles } from './preview.js';
import { extractWordsWithAI } from './ai.js';
import { ensureFontsLoaded } from './style.js';
import { updateCurrentWordsFromTextarea } from './worksheet_integration.js';
import { highlightDuplicates as worksheetHighlightDuplicates } from './worksheet.js';

const currentWords = state.currentWords;

export async function updateDesign() {
    state.currentSettings.design = document.getElementById('designSelect').value;
    await ensureFontsLoaded();
    await updatePreview();
    setTimeout(updatePreview, 500);
}

export async function extractWords() {
    const passage = document.getElementById('passageInput').value;
    const difficulty = document.getElementById('difficultySelect').value;
    const wordCount = parseInt(document.getElementById('wordCountInput').value);
    const ta = document.getElementById('wordListTextarea');

    async function runAIExtraction(promptContent) {
        const response = await fetch('/.netlify/functions/openai_proxy', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: 'chat/completions', payload: { model: 'gpt-3.5-turbo', messages: [ { role: 'system', content: 'You are a helpful teaching assistant.' }, { role: 'user', content: promptContent } ], max_tokens: 1500 } })
        });
        const data = await response.json();
        return data.data.choices?.[0]?.message?.content || '';
    }

    if (difficulty === 'Topic Input') {
        const topic = (passage || '').trim();
        if (!topic) { alert('Please enter a topic in the passage box.'); return; }
        const extractBtn = document.getElementById('extractBtn');
        const originalText = extractBtn.textContent; extractBtn.textContent = 'Extracting...'; extractBtn.disabled = true;
        let newWords = [];
        try {
            const promptContent = `You are an ESL teacher. Given the topic below, generate a list of exactly ${wordCount} important English words or short phrases related to the topic, suitable for vocabulary study. For each word or phrase, provide the English, then a comma, then the Korean translation. Return each pair on a new line in the format: english, korean\n\nIMPORTANT:\n- Do NOT extract from a passage. Instead, select the most relevant and useful words for the topic.\n- Avoid duplicates or very similar words.\n- Make sure each word/phrase is unique and different from the others.\n- Ensure you provide exactly ${wordCount} distinct items.\n\nTopic:\n${topic}`;
            const aiResponse = await runAIExtraction(promptContent);
            if (aiResponse) {
                const lines = aiResponse.split('\n').filter(line => line.trim() && line.includes(','));
                newWords = lines.map(line => line.trim()).filter(Boolean);
            }
        } catch (e) { console.error('AI topic extraction error:', e); alert('Error extracting topic words. Please try again.'); }
        const existing = (ta?.value || '').trim();
        const combined = existing ? (existing + '\n' + newWords.join('\n')) : newWords.join('\n');
        if (ta) ta.value = combined;
        updateCurrentWordsFromTextarea();
        worksheetHighlightDuplicates();
        updatePreview();
        extractBtn.textContent = originalText; extractBtn.disabled = false;
        return;
    }

    if (!passage?.trim()) { alert('Please enter a passage first.'); return; }
    try {
        const extractBtn = document.getElementById('extractBtn');
        const originalText = extractBtn.textContent; extractBtn.textContent = 'Extracting...'; extractBtn.disabled = true;
        const existing = (ta?.value || '').trim();
        let newWords = [];
        try {
            const aiResponse = await extractWordsWithAI(passage, wordCount, difficulty);
            if (aiResponse) {
                const lines = aiResponse.split('\n').filter(line => line.trim() && line.includes(','));
                newWords = lines.map(line => line.trim()).filter(Boolean);
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
        updatePreview();
        extractBtn.textContent = originalText; extractBtn.disabled = false;
    } catch (error) {
        console.error('Error extracting words:', error);
        alert('Error extracting words. Please try again.');
        const extractBtn = document.getElementById('extractBtn');
        if (extractBtn) { extractBtn.textContent = 'Extract Words'; extractBtn.disabled = false; }
    }
}
