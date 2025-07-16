// survey_ai.js for ESL Survey Builder
// Flexible AI prompt input for survey generation

function setupAIPrompt() {
  const promptInput = document.getElementById('aiPromptInput');
  const sendBtn = document.getElementById('sendAIPromptBtn');
  const questionsTextarea = document.getElementById('surveyQuestions');
  const templateSelect = document.getElementById('templateSelect');
  const layoutSelect = document.getElementById('layoutSelect');
  if (!promptInput || !sendBtn || !questionsTextarea) return;

  sendBtn.onclick = async function() {
    const promptText = promptInput.value.trim();
    if (!promptText) {
      alert('Please enter your prompt.');
      return;
    }
    sendBtn.disabled = true;
    sendBtn.textContent = 'Sending...';
    try {
      const response = await fetch('/.netlify/functions/openai_proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: 'chat/completions',
          payload: {
            model: 'gpt-3.5-turbo',
            messages: [
              { role: 'system', content: 'You are a helpful ESL survey generator. When given a topic, examples, or instructions, create a set of survey questions for students. Respond in worksheet-ready format.' },
              { role: 'user', content: promptText }
            ],
            max_tokens: 600,
            temperature: 0.7
          }
        })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      const result = await response.json();
      const data = result.data;
      if (data.error) throw new Error(data.error.message || 'OpenAI API error');
      const content = data.choices[0].message.content.trim();
      // Insert questions into textarea and update preview
      const existingQuestions = questionsTextarea.value.trim();
      const updatedQuestions = existingQuestions ? `${existingQuestions}\n\n${content}` : content;
      questionsTextarea.value = updatedQuestions;
      // Update preview and apply selected layout/template
      if (window.updateSurveyPreview) {
        // If template/layout selects exist, trigger their change event to update preview
        if (templateSelect) templateSelect.dispatchEvent(new Event('change'));
        if (layoutSelect) layoutSelect.dispatchEvent(new Event('change'));
        window.updateSurveyPreview();
      }
    } catch (err) {
      alert('AI prompt failed: ' + err.message);
    }
    sendBtn.disabled = false;
    sendBtn.textContent = 'Send Prompt to AI';
  };
}

document.addEventListener('DOMContentLoaded', setupAIPrompt);
