// ai.js for Grammar Worksheet Generator
// Chat box for AI grammar worksheet generation

const aiChatBoxHTML = `
<div class="ai-chatbox" style="max-width: 480px; margin: 24px auto 0; background: #fffbe6; border: 1.5px solid #d8973c; border-radius: 10px; box-shadow: 0 2px 8px rgba(46,43,63,0.06); padding: 18px 16px 12px 16px;">
  <div style="font-weight: 600; font-size: 1.1em; margin-bottom: 8px; color: #a86b00;">AI Grammar Worksheet Chat</div>
  <div id="aiChatMessages" style="min-height: 60px; max-height: 180px; overflow-y: auto; background: #fff9e0; border-radius: 6px; padding: 8px 10px; margin-bottom: 10px; font-size: 1em;"></div>
  <div style="display: flex; gap: 8px;">
    <input id="aiChatInput" type="text" placeholder="Describe your grammar point or give examples..." style="flex:1; padding: 7px 10px; border-radius: 6px; border: 1px solid #d8973c; font-size: 1em;">
    <button id="aiChatSend" style="background: #f8c080; color: #222; border: none; border-radius: 6px; padding: 7px 16px; font-weight: 600; cursor: pointer;">Send</button>
  </div>
</div>
`;

function setupAIChatBox() {
  const mount = document.getElementById('aiChatSidebarMount');
  if (!mount) return;
  mount.innerHTML = aiChatBoxHTML;

  const input = document.getElementById('aiChatInput');
  const sendBtn = document.getElementById('aiChatSend');
  const messages = document.getElementById('aiChatMessages');
  if (!input || !sendBtn || !messages) return;

  sendBtn.onclick = async () => {
    const userMsg = input.value.trim();
    if (!userMsg) return;
    messages.innerHTML += `<div style='margin-bottom:2px;'><b>You:</b> ${userMsg}</div>`;
    input.value = '';
    messages.innerHTML += `<div style='margin-bottom:2px;'><b>AI:</b> <span id='aiTyping'>...</span></div>`;
    messages.scrollTop = messages.scrollHeight;

    // Call Netlify OpenAI proxy (same as reading)
    let aiReply = '';
    try {
      const response = await WillenaAPI.fetch('/.netlify/functions/openai_proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: 'chat/completions',
          payload: {
            model: 'gpt-3.5-turbo',
            messages: [
              { role: 'system', content: 'You are a helpful ESL worksheet generator. When given a grammar point or examples, create a set of grammar questions or exercises for students. Respond in worksheet-ready format.' },
              { role: 'user', content: userMsg }
            ],
            max_tokens: 400
          }
        })
      });
      const data = await response.json();
      aiReply = data.data.choices?.[0]?.message?.content || "Sorry, I couldn't get a response.";
    } catch (e) {
      aiReply = "Sorry, there was an error contacting the AI.";
    }
    messages.innerHTML = messages.innerHTML.replace('<span id=\'aiTyping\'>...</span>', aiReply);
    messages.scrollTop = messages.scrollHeight;
  };
}

// ai.js for Grammar Worksheet Generator
// Flexible AI prompt input for grammar worksheet generation

function setupAIPrompt() {
  const promptInput = document.getElementById('aiPromptInput');
  const sendBtn = document.getElementById('sendAIPromptBtn');
  const questionsTextarea = document.getElementById('grammarQuestions');
  const questionTypeSelect = document.getElementById('questionTypeSelect');
  if (!promptInput || !sendBtn || !questionsTextarea) return;

  sendBtn.onclick = async function() {
    let promptText = promptInput.value.trim();
    if (!promptText && (!questionTypeSelect || questionTypeSelect.value === 'free')) {
      alert('Please enter your prompt.');
      return;
    }
    // Handle question type
    if (questionTypeSelect) {
      const type = questionTypeSelect.value;
      if (type === 'mc') {
        // Improved prompt for superlatives: require 'the _______' in the question stem and instruct the AI to use the definite article
        promptText = `Create multiple choice grammar questions for ESL students about: ${promptText}.

        If the question is about superlatives, always use 'the _______' in the blank and make sure the correct answer includes the definite article 'the' if required. Use this format for all superlative questions:

        1. The cheetah is the _______ animal in the world.
        a) fastest  b) faster  c) fastly  d) more fast

        For all questions:
        - Randomize the position of the correct answer so it is sometimes a), b), c), or d) (not just a) or b)).
        - Shuffle the order of all answer choices for every question, so the correct answer is not always in the same position.
        - Avoid patterns: do not always put the correct answer in the first or second position.
        - Use a clear blank in the question and provide four options, only one of which is correct.
        - Do not use labels like "Question:" or "Answer:". Just write questions and answer choices clearly.

        After all the questions, include an answer key in this format:
        Answer Key:
        1. b) fastest
        2. d) went
        3. a) is
        (etc.)
        The answer key should match the correct letter and answer for each question.`;
      } else if (type === 'fill') {
        promptText = 'Make the questions fill in the blanks. ' + promptText;
      }
      // Free form does not modify promptText
    }
    sendBtn.disabled = true;
    sendBtn.textContent = 'Sending...';
    try {
      const response = await WillenaAPI.fetch('/.netlify/functions/openai_proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: 'chat/completions',
          payload: {
            model: 'gpt-3.5-turbo',
            messages: [
              { role: 'system', content: 'You are a helpful ESL worksheet generator. When given a grammar point, examples, or instructions, create a set of grammar questions or exercises for students. Respond in worksheet-ready format.' },
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
      if (window.updateGrammarPreview) window.updateGrammarPreview();
    } catch (err) {
      alert('AI prompt failed: ' + err.message);
    }
    sendBtn.disabled = false;
    sendBtn.textContent = 'Send Prompt to AI';
  };
}

document.addEventListener('DOMContentLoaded', setupAIChatBox);
