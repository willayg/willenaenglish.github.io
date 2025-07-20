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
    // Combine everything for the AI, and make instructions even more forceful, require simple language, and add a sample for open questions for young beginners
    let finalPrompt = `IMPORTANT: STRICTLY follow ALL instructions and context below.\n\nLEVEL & TYPE: ${levelPrompt}\n\nTOPIC/REQUEST: ${promptText}\n${advFields}\n\nYou MUST tailor ALL questions to the age, proficiency, location, interests, and context provided.\n\nDO NOT ask about facts, trivia, or general knowledge. DO NOT ask about countries, capitals, or famous people.\n\nONLY ask about the student's own life, opinions, preferences, or experiences.\n\nIf the age group is young children or beginners, you MUST use ONLY simple, short sentences and easy words. DO NOT use big words.\n\nUse specific references (e.g., if 'K-pop' is listed as an interest, include K-pop in the questions). Make questions age-appropriate, culturally relevant, and fun if requested. Avoid all topics listed in 'Topics to avoid.'\n\nIf the age group is young children, make questions simple, playful, and engaging. If adults, make them mature and relevant. If a location is given, localize questions. If a preferred style is given, use it. If energy level is low, keep questions light and easy.\n\nDO NOT IGNORE ANY CONTEXT.\n\n---\n\nSAMPLE OUTPUT FOR AGE 6-8, INTERESTS: K-pop, Pokémon, LOCATION: Korea, TYPE: Multiple Choice\n\n1. What is your favorite K-pop group?\nA. BTS\nB. Blackpink\nC. NewJeans\nD. IVE\nE. Other: ____________\n\n2. Which Pokémon do you like the most?\nA. Pikachu\nB. Charizard\nC. Squirtle\nD. Eevee\nE. Other: ____________\n\n3. What song do you like to dance to?\nA. Dynamite\nB. Pink Venom\nC. Butter\nD. I AM\nE. Other: ____________\n\n4. Who do you like to sing with?\nA. My friends\nB. My family\nC. My teacher\nD. By myself\nE. Other: ____________\n\n5. Where do you like to play Pokémon games?\nA. At home\nB. At school\nC. At a friend’s house\nD. At a café\nE. Other: ____________\n\n---\n\nSAMPLE OUTPUT FOR AGE 9-11, BEGINNER ENGLISH, TYPE: OPEN QUESTION\n\n1. What is your favorite food?\n2. What do you like to do after school?\n3. Who is your best friend?\n4. What animal do you like?\n5. What is your favorite game?\n\nAll questions MUST be simple, short, and easy for a 9-year-old beginner.\n\n---\n\nFollow this style for all outputs.\n`;
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
              { role: 'system', content: 'You are an expert ESL survey generator. You must ALWAYS use all teacher context, level, and localization provided in the user message. If interests, age, or location are given, you MUST reference them in the questions. Make questions age-appropriate, culturally relevant, and fun if requested. If you ignore any context, you will be penalized. DO NOT ask about facts, trivia, or general knowledge. ONLY ask about the student’s own life, opinions, or experiences. Respond in worksheet-ready format only.' },
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
