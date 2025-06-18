document.addEventListener('DOMContentLoaded', () => {
  const generateBtn = document.getElementById('generateCrossword');
  if (!generateBtn) return;

  generateBtn.addEventListener('click', () => {
    const size = parseInt(document.getElementById('crosswordGridSize').value, 10);
    const words = document.getElementById('crosswordWords').value
      .split('\n')
      .map(w => w.trim())
      .filter(Boolean);

    // Placeholder: Show grid size and words
    document.getElementById('crosswordOutput').innerHTML = `
      <div class="mb-2">Grid size: <b>${size} x ${size}</b></div>
      <div class="mb-2">Words: <b>${words.join(', ') || 'None'}</b></div>
      <div class="text-[#888]">[Crossword grid will appear here]</div>
    `;

    // TODO: Add crossword generation logic here!
  });

  const output = document.getElementById('crosswordOutput');
  if (output) {
    output.innerHTML = html;
  }
});

function setupAIChatBox() {
  const input = document.getElementById('aiChatInput');
  const sendBtn = document.getElementById('aiChatSend');
  const messages = document.getElementById('aiChatMessages');
  if (!input || !sendBtn || !messages) return;

  sendBtn.onclick = async () => {
    const userMsg = input.value.trim();
    if (!userMsg) return;
    messages.innerHTML += `<div class="mb-1"><b>You:</b> ${userMsg}</div>`;
    input.value = '';
    messages.innerHTML += `<div class="mb-1"><b>AI:</b> <span id="aiTyping">...</span></div>`;
    messages.scrollTop = messages.scrollHeight;

    // Call your backend or OpenAI API here
    // For demo, just echo the prompt
    // Replace this with your actual API call
    let aiReply = "This is a demo AI response. (Integrate OpenAI API here.)";

    // Example: Uncomment and use fetch to your backend or OpenAI API
    /*
    const response = await fetch('/your-backend-endpoint', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({prompt: userMsg})
    });
    const data = await response.json();
    let aiReply = data.reply;
    */

    // Replace the typing indicator with the AI reply
    messages.innerHTML = messages.innerHTML.replace('<span id="aiTyping">...</span>', aiReply);
    messages.scrollTop = messages.scrollHeight;
  };
}

// Example for Wordsearch AI chat box
function setupAIChatBoxWordsearch() {
  const input = document.getElementById('aiChatInputWordsearch');
  const sendBtn = document.getElementById('aiChatSendWordsearch');
  const messages = document.getElementById('aiChatMessagesWordsearch');
  if (!input || !sendBtn || !messages) return;

  sendBtn.onclick = async () => {
    const userMsg = input.value.trim();
    if (!userMsg) return;
    messages.innerHTML += `<div class="mb-1"><b>You:</b> ${userMsg}</div>`;
    input.value = '';
    messages.innerHTML += `<div class="mb-1"><b>AI:</b> <span id="aiTypingWordsearch">...</span></div>`;
    messages.scrollTop = messages.scrollHeight;

    // Call your Netlify OpenAI proxy
    let aiReply = '';
    try {
      const response = await fetch('/.netlify/functions/openai_proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: 'chat/completions',
          payload: {
            model: 'gpt-3.5-turbo',
            messages: [
              { role: 'system', content: 'You are a helpful teaching assistant.' },
              { role: 'user', content: userMsg }
            ],
            max_tokens: 150
          }
        })
      });
      const data = await response.json();
      aiReply = data.data.choices?.[0]?.message?.content || "Sorry, I couldn't get a response.";
    } catch (e) {
      aiReply = "Sorry, there was an error contacting the AI.";
    }

    messages.innerHTML = messages.innerHTML.replace('<span id="aiTypingWordsearch">...</span>', aiReply);
    messages.scrollTop = messages.scrollHeight;
  };
}

// Call this after the DOM is loaded
setupAIChatBox();
setupAIChatBoxWordsearch();
