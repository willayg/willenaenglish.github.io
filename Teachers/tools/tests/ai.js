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
          { role: 'user', content: `
Extract exactly ${numWords} important English words and short phrases (not just single words) that are relevant and meaningful in the context of the following passage.
For each, provide the English word or phrase, then a comma, then the Korean translation.
Return each pair on a new line in the format: english, korean
Do not stop until you have listed exactly ${numWords} items, unless there are not enough in the passage.
Do not summarize or group items. List each word or phrase separately, one per line, until you reach ${numWords}.

Passage:
${passage}
` }
        ],
        max_tokens: 1500 // Large enough for 40+ pairs
      }
    })
  });
  const data = await response.json();
  return data.data.choices?.[0]?.message?.content || '';
}