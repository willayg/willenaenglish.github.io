export async function extractWordsWithAI(passage, numWords = 10) {
  const response = await fetch('/.netlify/functions/openai_proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: 'chat/completions',
      payload: {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are a helpful teaching assistant.' },
          { role: 'user', content: `Extract the ${numWords} most important English vocabulary words from this passage. For each word, provide the Korean translation, formatted as: english, korean (one per line, no numbering):\n\n${passage}` }
        ],
        max_tokens: 200
      }
    })
  });
  const data = await response.json();
  return data.data.choices?.[0]?.message?.content || '';
}