// AI Extraction functions for word worksheet generator

// AI Extraction function
async function extractWordsWithAI(passage, numWords = 10, difficulty = 'medium') {
  let promptContent = '';
  switch((difficulty || '').toLowerCase()) {
    case 'related':
  promptContent = `
You are an ESL teacher. Given the passage below, generate exactly ${numWords} English items that are RELATED to the passage but DO NOT appear in it. Include a mix of:

- Synonyms and near-synonyms of key words or ideas
- Antonyms that help contrast key ideas
- Collocations and common word partners (e.g., make a decision, heavy traffic)
- Thematic associates (words strongly connected to the topic or context)

Guidelines:
- Items must be relevant to the topic, ideas, or context of the passage, but must NOT be present verbatim in the passage
- Prefer useful, teachable vocabulary (avoid very obscure terms)
- Avoid duplicates or near-duplicates
- Provide EXACTLY ${numWords} distinct items

Format:
- One item per line: english, korean

Passage:
${passage}
  `;
      break;
    case 'easy':
      promptContent = `
You are an ESL teacher working with beginner English learners. From the passage below, extract exactly ${numWords} simple and useful words that are:

- Basic vocabulary that beginners should learn
- Common everyday words and simple phrases
- High-frequency words that appear often in English
- Simple verbs, nouns, and adjectives
- Basic prepositions (in, on, at, with, etc.)

Focus on words that are:
- 1-2 syllables when possible
- Commonly used in daily conversation
- Essential for basic communication
- Easy to pronounce and remember

IMPORTANT: 
- Avoid complex vocabulary, idioms, or advanced grammar structures
- Do NOT include duplicate words or very similar words
- Make sure each word/phrase is unique and different from the others
- Ensure you provide exactly ${numWords} distinct items

For each word or phrase, provide the English word/phrase, then a comma, then the Korean translation.
Return each pair on a new line in the format: english, korean

Passage:
${passage}
      `;
      break;
    case 'medium':
      promptContent = `
You are an ESL teacher working with intermediate English learners. From the passage below, extract exactly ${numWords} moderately challenging words and phrases that include:

- Intermediate vocabulary (2-3 syllables)
- Common phrasal verbs (look up, turn on, etc.)
- Simple idiomatic expressions
- Useful prepositional phrases
- Common phrasal interjections and phrases (such as "instead of", "according to", "as well as", "in spite of", "in addition to", "as soon as", "in order to", "even though", "as if", "as though", "as long as", "as far as", "in case", "in fact", "in general", "in particular", "by the way", "at least", "at most", "for example", "for instance", "on the other hand", "however", "whenever", etc.)
- Connecting words (however, therefore, although, etc.)

Focus on words and phrases that:
- Are commonly used but not too basic
- Help students express more complex ideas
- Are useful for academic and everyday contexts
- Build on beginner vocabulary

IMPORTANT: 
- Avoid overly simple words or highly advanced terminology
- Do NOT include duplicate words or very similar words
- Make sure each word/phrase is unique and different from the others
- Ensure you provide exactly ${numWords} distinct items

For each word or phrase, provide the English word/phrase, then a comma, then the Korean translation.
  Return each pair on a new line in the format: english, korean
  Translation policy: If the item is idiomatic or figurative, translate into a natural Korean equivalent that conveys the same meaning (use a common Korean idiom or a clear paraphrase), not a literal word-for-word translation. For ordinary single words, use the most common Korean translation.

Passage:
${passage}
      `;
      break;
    case 'hard':
      promptContent = `
You are an ESL teacher working with advanced English learners. From the passage below, extract exactly ${numWords} challenging and sophisticated words and phrases including:

- Advanced vocabulary and less common words
- All the phrasal verbs you can find (these are of utmost importance)
- Complex phrasal verbs and their variations
- Sophisticated idiomatic expressions
- Advanced prepositional and adverbial phrases
- Prepositional phrases (such as "in spite of", "according to", "in addition to", etc.)
- Connecting words (such as "however", "therefore", "although", "whenever", etc.)
- Conjunctions (such as "even though", "as if", "as though", "as long as", etc.)
- Phrases that include gerunds or infinitives (such as "promise to go", "couldn't stand listening", "look forward to meeting", "decided to leave", etc.)
- Academic and formal language structures
- Complex conjunctions and discourse markers
- Nuanced collocations and expressions

Focus on language that:
- Appears in academic, professional, or literary contexts
- Requires deeper understanding of English nuances
- Helps students sound more fluent and natural
- Challenges students to expand their vocabulary range
- Includes subtle meaning differences and connotations

IMPORTANT: 
- Prioritize all phrasal verbs, multi-word expressions, prepositional phrases, connecting words, conjunctions, phrases with gerunds or infinitives, complex grammar structures, and sophisticated vocabulary
- Do NOT include duplicate words or very similar words
- Make sure each word/phrase is unique and different from the others
- Ensure you provide exactly ${numWords} distinct items

For each word or phrase, provide the English word/phrase, then a comma, then the Korean translation.
Return each pair on a new line in the format: english, korean

Passage:
${passage}
      `;
      break;
    case 'phrases':
  promptContent = `
You are an ESL teacher. From the passage below, extract all the phrases and idioms (not single words) that appear in the text. Focus on:

- Multi-word expressions, collocations, and set phrases
- Idiomatic expressions and figurative language
- Phrasal verbs, prepositional phrases, and common sayings

IMPORTANT:
- Do NOT include simple adjective+noun or noun+noun combinations unless they are idioms, set phrases, or have a figurative/idiomatic meaning (e.g., "big rock" or "empty jar" should NOT be included unless they are part of an idiom)
- Only include phrases and idioms (no single words)
- Each item must be a phrase of two or more words
- Do NOT include duplicate or very similar phrases
- Provide as many unique phrases/idioms as you can find in the passage (up to ${numWords})

For each phrase or idiom, provide the English phrase, then a comma, then the Korean translation.
  IMPORTANT: The Korean translation should be a culturally appropriate, natural equivalent that conveys the same meaning or feeling as the English idiom, not a literal word-for-word translation. If there is a common Korean idiom or phrase that matches the meaning, use that. If not, paraphrase so that a Korean speaker would understand the intended meaning in context.

  Examples (format: english, korean):
- let the cat out of the bag, 비밀을 털어놓다
- the elephant in the room, 모두가 알지만 말하지 않는 문제
- hold your horses, 진정해
- bite off more than you can chew, 욕심을 과하게 부리다
- once in a blue moon, 거의 드물게

Return each pair on a new line in the format: english, korean

Passage:
${passage}
  `;
      break;
    default:
      // Default to medium difficulty
      promptContent = `
You are an ESL teacher working with intermediate English learners. From the passage below, extract exactly ${numWords} moderately challenging words and phrases that include:

- Intermediate vocabulary (2-3 syllables)
- Common phrasal verbs (look up, turn on, etc.)
- Simple idiomatic expressions
- Useful prepositional phrases
- Common collocations (strong coffee, heavy rain)
- Connecting words (however, therefore, although)

For each word or phrase, provide the English word/phrase, then a comma, then the Korean translation.
  Return each pair on a new line in the format: english, korean
  Translation policy: If any item is idiomatic or figurative, translate to a natural Korean equivalent or paraphrase; avoid literal renderings.

Passage:
${passage}
      `;
  }

  try {
    const response = await WillenaAPI.fetch('/.netlify/functions/openai_proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: 'chat/completions',
        payload: {
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: 'You are a helpful teaching assistant.' },
            { role: 'user', content: promptContent }
          ],
          max_tokens: 1500,
          temperature: 0.3
        }
      })
    });
    const data = await response.json();
    return data.data.choices?.[0]?.message?.content || '';
  } catch (error) {
    console.error('AI extraction error:', error);
    throw error;
  }
}

// Export the function for use in other modules
export { extractWordsWithAI };