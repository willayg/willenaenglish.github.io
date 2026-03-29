// AI Service - OpenAI proxy integration for definitions and examples
import { capitalize, ensurePunctuation, cleanDefinitionResponse, escapeRegExp } from '../utils/validation.js';

/**
 * Generate an example sentence for a word using AI
 * @param {string} targetWord - The word to generate an example for
 * @returns {Promise<string>} The generated example sentence
 */
export async function generateExample(targetWord) {
  if (!targetWord || !targetWord.trim()) return '';
  
  const target = targetWord.trim();
  const prompt = `Write one short simple English sentence for beginner ESL students using the word "${target}". Keep it positive, concrete, and 5-12 words. Avoid quotes, explanations, or extra text. Output only the sentence.`;
  
  try {
    const res = await WillenaAPI.fetch('/.netlify/functions/openai_proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    
    const js = await res.json();
    let sent = (js?.result || '').trim();
    if (!sent) return '';
    
    // Clean up formatting
    sent = sent.replace(/^\s*[-*•]?\s*\d+[).]\s*/, '').replace(/^"|"$/g, '').trim();
    
    // Capitalize & add punctuation
    sent = capitalize(sent);
    sent = ensurePunctuation(sent);
    
    return sent;
  } catch (e) {
    console.error('[AI-Service] generateExample error:', e);
    return '';
  }
}

/**
 * Generate a kid-friendly definition for a word using AI
 * @param {string} targetWord - The word to define
 * @param {string} koreanHint - Optional Korean translation for context
 * @returns {Promise<string>} The generated definition
 */
export async function generateDefinition(targetWord, koreanHint = '') {
  if (!targetWord || !targetWord.trim()) return '';
  
  const target = targetWord.trim();
  const promptPrimary = `Write a concise, kid-friendly definition that does NOT include or repeat the word "${target}". Consider the Korean meaning "${koreanHint}" as context. Keep it simple for young learners, one short sentence.`;
  const promptRetry = `Give ONE beginner-friendly meaning sentence for "${target}" without using that exact word. Use plain classroom English, 6-14 words, output only the sentence.`;

  function fallbackDefinition(word, kor) {
    const cleanWord = String(word || '').trim();
    const cleanKor = String(kor || '').trim();
    if (cleanKor) {
      return `A common word that means ${cleanKor}.`;
    }
    if (cleanWord.includes(' ')) {
      return 'A useful phrase used in everyday English.';
    }
    return 'A useful English word for everyday conversation.';
  }

  function sanitizeCandidate(raw, targetWordInner, koreanHintInner) {
    let def = String(raw || '').trim();
    if (!def) return '';

    def = cleanDefinitionResponse(def);
    if (!def) return '';

    def = def.replace(/[\uAC00-\uD7AF]+/g, '');
    if (koreanHintInner) {
      const esc = koreanHintInner.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      def = def.replace(new RegExp(esc, 'g'), '');
    }

    def = def.replace(/["'`]+/g, '').replace(/\s{2,}/g, ' ').trim();

    const re = new RegExp(`\\b${escapeRegExp(targetWordInner)}\\b`, 'ig');
    def = def.replace(re, '').replace(/\s{2,}/g, ' ').replace(/^\W+|\W+$/g, '').trim();

    def = capitalize(def);
    def = ensurePunctuation(def);

    // Quality guardrails: avoid empty/too-short/no-letter outputs (e.g., '?').
    if (!/[a-zA-Z]{3,}/.test(def)) return '';
    if (def.length < 12) return '';
    if (/^[?.!\s]+$/.test(def)) return '';
    return def;
  }
  
  try {
    const prompts = [promptPrimary, promptRetry];
    for (const prompt of prompts) {
      const res = await WillenaAPI.fetch('/.netlify/functions/openai_proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      const js = await res.json().catch(() => ({}));
      const raw = String(js?.result || js?.data?.choices?.[0]?.message?.content || '').trim();
      const clean = sanitizeCandidate(raw, target, koreanHint);
      if (clean) return clean;
    }
    return fallbackDefinition(target, koreanHint);
  } catch (e) {
    console.error('[AI-Service] generateDefinition error:', e);
    return fallbackDefinition(target, koreanHint);
  }
}

/**
 * Batch generate examples for multiple words
 * @param {Array<{eng: string, example?: string}>} wordList - Words to process
 * @param {Function} onProgress - Callback(current, total)
 * @returns {Promise<number>} Number of examples generated
 */
export async function batchGenerateExamples(wordList, onProgress = null) {
  let generated = 0;
  const total = wordList.length;
  
  for (let i = 0; i < wordList.length; i++) {
    const w = wordList[i];
    if (!w || !w.eng) continue;
    if (w.example && w.example.trim()) continue; // Skip if already has example
    
    const example = await generateExample(w.eng);
    if (example) {
      w.example = example;
      generated++;
    }
    
    if (onProgress) onProgress(i + 1, total);
  }
  
  return generated;
}

/**
 * Batch generate definitions for multiple words
 * @param {Array<{eng: string, kor?: string, definition?: string}>} wordList - Words to process
 * @param {Function} onProgress - Callback(current, total)
 * @returns {Promise<number>} Number of definitions generated
 */
export async function batchGenerateDefinitions(wordList, onProgress = null) {
  let generated = 0;
  const total = wordList.length;
  
  for (let i = 0; i < wordList.length; i++) {
    const w = wordList[i];
    if (!w || !w.eng) continue;
    if (w.definition && w.definition.trim()) continue; // Skip if already has definition
    
    const definition = await generateDefinition(w.eng, w.kor || '');
    if (definition) {
      w.definition = definition;
      generated++;
    }
    
    if (onProgress) onProgress(i + 1, total);
  }
  
  return generated;
}
