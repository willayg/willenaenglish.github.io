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
    const res = await fetch('/.netlify/functions/openai_proxy', {
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
  const prompt = `Write a concise, kid-friendly definition that does NOT include or repeat the word "${target}". Consider the Korean meaning "${koreanHint}" as context. Keep it simple for young learners, one short sentence.`;
  
  try {
    const res = await fetch('/.netlify/functions/openai_proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    
    const js = await res.json();
    let def = (js?.result || '').trim();
    if (!def) return '';
    
    // Clean up conversational AI responses - extract just the definition
    def = cleanDefinitionResponse(def);
    if (!def) return '';
    
    // Remove any Korean (Hangul) characters
    def = def.replace(/[\uAC00-\uD7AF]+/g, '');
    
    // Remove the exact Korean word if present
    if (koreanHint) {
      const esc = koreanHint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      def = def.replace(new RegExp(esc, 'g'), '');
    }
    
    def = def.replace(/\s{2,}/g, ' ').trim();
    
    // Ensure it does not contain the target word (case-insensitive)
    const re = new RegExp(`\\b${escapeRegExp(target)}\\b`, 'i');
    if (re.test(def)) {
      // Remove the target word and clean up
      def = def.replace(re, '').replace(/\s{2,}/g, ' ').replace(/^\W+|\W+$/g, '').trim();
    }
    
    // Capitalize first letter; ensure it ends with a period
    def = capitalize(def);
    def = ensurePunctuation(def);
    
    return def;
  } catch (e) {
    console.error('[AI-Service] generateDefinition error:', e);
    return '';
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
