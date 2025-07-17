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
    let promptText = promptInput.value.trim();
    if (!promptText) {
      alert('Please enter your prompt.');
      return;
    }
    // Force multiple choice prompt if in MC mode
    const surveyTypeSelect = document.getElementById('surveyTypeSelect');
    if (surveyTypeSelect && surveyTypeSelect.value === 'mc') {
      promptText = `IMPORTANT: Only generate MULTIPLE CHOICE survey questions for ESL students. Each question MUST have several answer options (A, B, C, etc.) and must NOT be open-ended. Do not include answer keys. For each question of opinion, ALWAYS include 'Other: ____________' as the last option. Format each question and its options clearly, for example:\n1. Question text\nA. Option1\nB. Option2\nC. Option3\nD. Other: ____________\n. Only output multiple choice questions with options, no open/freestyle questions.\n\nUser request: ${promptText}`;
    }
    // If the prompt is very short, prepend a clarifying instruction
    if (promptText.split(/\s+/).length < 10) {
      promptText = `Write questions that ask about the interviewee’s own preferences, opinions, or experiences about this topic.\n\n${promptText}`;
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
              { role: 'system', content: 'You are a helpful ESL survey generator. When given a topic, examples, or instructions, create a set of survey questions for students. Unless the user specifies otherwise, always write questions that ask for the interviewee’s personal opinions, preferences, or experiences—not questions of fact or general knowledge. For example, if the topic is “hobbies,” ask about the interviewee’s own hobbies, interests, or preferences, not about facts or statistics. Respond in worksheet-ready format.' },
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
      // Always REPLACE questions with new AI content
      questionsTextarea.value = content;
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
