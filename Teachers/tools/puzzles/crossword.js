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

  // --- AI ChatBox setup (optional, safe to comment out if not used) ---
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

      // Demo AI response
      let aiReply = "This is a demo AI response. (Integrate OpenAI API here.)";
      messages.innerHTML = messages.innerHTML.replace('<span id="aiTyping">...</span>', aiReply);
      messages.scrollTop = messages.scrollHeight;
    };
  }

  // Uncomment if you want to use the AI chat box
  // setupAIChatBox();
});