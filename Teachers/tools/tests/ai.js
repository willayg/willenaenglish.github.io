export async function extractWordsWithAI(passage, numWords = 10, difficulty = 'medium') {
  let promptContent = '';
  
  switch(difficulty) {
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
- Common collocations (strong coffee, heavy rain)
- Connecting words (however, therefore, although)

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

Passage:
${passage}
      `;
      break;
      
    case 'hard':
      promptContent = `
You are an ESL teacher working with advanced English learners. From the passage below, extract exactly ${numWords} challenging and sophisticated words and phrases including:

- Advanced vocabulary and less common words
- Complex phrasal verbs and their variations
- Sophisticated idiomatic expressions
- Advanced prepositional and adverbial phrases
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
- Prioritize multi-word expressions, complex grammar structures, and sophisticated vocabulary
- Do NOT include duplicate words or very similar words
- Make sure each word/phrase is unique and different from the others
- Ensure you provide exactly ${numWords} distinct items

For each word or phrase, provide the English word/phrase, then a comma, then the Korean translation.
Return each pair on a new line in the format: english, korean

Passage:
${passage}
      `;
      break;
      
    case 'x':
      promptContent = `
You are an ESL teacher helping Korean students in elementary and middle school.

From the passage below, extract exactly ${numWords} useful words and phrases for learning English. 
Don't just pick vocabulary nouns. Include:

- Uncommon or challenging vocabulary (nouns, verbs, adjectives)
- Phrasal verbs (like "make up", "carry out")
- Prepositional phrases (like "at the correct time", "in 1970")
- Conjunctions and linking expressions (like "since then", "although")
- Common expressions or collocations (like "plan their day", "reach our wrists")

IMPORTANT: 
- Avoid repeating very similar words or listing only nouns
- Do NOT include duplicate words or very similar words
- Make sure each word/phrase is unique and different from the others
- Include full phrases where useful
- Ensure you provide exactly ${numWords} distinct items

For each word or phrase, provide the English word/phrase, then a comma, then the Korean translation.
Return each pair on a new line in the format: english, korean
Do not stop until you have listed exactly ${numWords} items.

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

Passage:
${passage}
      `;
  }

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
        max_tokens: 1500 // Large enough for 40+ pairs
      }
    })
  });
  const data = await response.json();
  return data.data.choices?.[0]?.message?.content || '';
}