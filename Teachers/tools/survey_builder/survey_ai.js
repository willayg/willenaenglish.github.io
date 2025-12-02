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
    // Level/type prompt
    const surveyTypeSelect = document.getElementById('surveyTypeSelect');
    const surveyLevelSelect = document.getElementById('surveyLevelSelect');
    const level = surveyLevelSelect?.value || 'basic';
    const type = surveyTypeSelect?.value || 'open';
    let levelPrompt = '';
    if (typeof surveyLevelPrompts !== 'undefined' && surveyLevelPrompts[level] && surveyLevelPrompts[level][type]) {
      levelPrompt = surveyLevelPrompts[level][type];
    }
    // Advanced fields
    function adv(id) { var el = document.getElementById(id); return el ? el.value : ''; }
    var advFields = '';
    if (document.getElementById('advancedPromptSection')) {
      advFields = [
        `\n\n[Teacher Context]`,
        `Age group: ${adv('advAgeGroup')}`,
        `English proficiency: ${adv('advProficiency')}`,
        `Location: ${adv('advLocation')}`,
        `Class energy level: ${adv('advEnergy')}`,
        `Class size: ${adv('advClassSize')}`,
        `Special interests or topics: ${adv('advInterests')}`,
        `Learning challenges/disabilities: ${adv('advChallenges')}`,
        `Cultural background(s): ${adv('advCulture')}`,
        `Preferred question style: ${adv('advStyle')}`,
        `Topics to avoid: ${adv('advAvoid')}`
      ].join('\n');
    }
    // Combine everything for the AI
    let finalPrompt = `${levelPrompt}\n\nTopic/Request: ${promptText}${advFields}`;
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
              { role: 'user', content: finalPrompt }
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
