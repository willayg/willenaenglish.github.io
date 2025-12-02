// MINT AI OpenAI proxy integration
window.generateQuestionsWithAI = async function(prompt) {
  const resp = await fetch('/.netlify/functions/openai_proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt })
  });
  const data = await resp.json();
  return data.result || '';
};
