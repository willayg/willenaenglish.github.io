document.addEventListener('DOMContentLoaded', () => {
  const wordsearchMaker = document.getElementById('wordsearchMaker');
  if (!wordsearchMaker) return;

  // Add Google Fonts for handwriting
  if (!document.getElementById('nanum-pen-font')) {
    const link = document.createElement('link');
    link.id = 'nanum-pen-font';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Nanum+Pen+Script&display=swap';
    document.head.appendChild(link);
  }


  document.getElementById('generateWordsearch').onclick = () => {
    const size = parseInt(document.getElementById('wordsearchGridSize').value, 10);
    const caseOpt = document.getElementById('wordsearchCase').value;
    const fontOpt = document.getElementById('wordsearchFont').value;
    const sizeScale = parseFloat(document.getElementById('wordsearchSize')?.value || "1");
    const align = document.getElementById('wordsearchAlign')?.value || "center";
    const hintsAlign = document.getElementById('wordsearchHintsAlign')?.value || "center";
    let words = document.getElementById('wordsearchWords').value
      .split('\n')
      .map(w => w.trim())
      .filter(Boolean);

    // Apply case
    words = words.map(w => caseOpt === 'upper' ? w.toUpperCase() : w.toLowerCase());

    // Generate the wordsearch grid
    const grid = generateWordsearchGrid(words, size, caseOpt);

    // Font CSS class
    let fontClass = 'wordsearch-font-sans';
    if (fontOpt === 'mono') fontClass = 'wordsearch-font-mono';
    if (fontOpt === 'comic') fontClass = 'wordsearch-font-comic';
    if (fontOpt === 'nanum') fontClass = 'wordsearch-font-nanum';

    // Alignment CSS
    let alignStyle = "text-align:center;";
    if (align === "left") alignStyle = "text-align:left;";
    if (align === "right") alignStyle = "text-align:right;";
    let hintsAlignStyle = "text-align:center;";
    if (hintsAlign === "left") hintsAlignStyle = "text-align:left;";
    if (hintsAlign === "right") hintsAlignStyle = "text-align:right;";

    // Build the HTML for the hints/words list
    let html = `<div class="mb-2" style="${hintsAlignStyle}">Words: <b>${words.join(', ') || 'None'}</b></div>`;

    // Add a container div for alignment
    html += `<div style="width:100%; text-align:${align};">`;
    // The inline-block div allows scaling and keeps the table together
    html += `<div style="display:inline-block; transform:scale(${sizeScale}); transform-origin:top left;">`;
    html += `<table class="wordsearch-table ${fontClass}">`;
    for (let row of grid) {
      html += '<tr>';
      for (let cell of row) {
        html += `<td class="${fontClass}">${cell}</td>`;
      }
      html += '</tr>';
    }
    html += '</table></div></div>';

    const output = document.getElementById('wordsearchOutput');
    if (output) {
      output.innerHTML = html;
    }

    const preview = document.getElementById('worksheetPreviewArea');
    if (preview) {
      const template = window.worksheetTemplates?.[0];
      const title = document.getElementById('worksheetTitle')?.value || "Wordsearch Worksheet";
      const instructions = document.getElementById('worksheetInstructions')?.value || 'Find all the words in the puzzle.';
      const worksheetHTML = template.render({
        title,
        instructions,
        puzzle: `<div id="puzzleExport">${html}</div>`,
        orientation: worksheetOrientation
      });
      preview.innerHTML = worksheetHTML;
    }
  };

  // Improved wordsearch grid generator: random placement, horizontal/vertical
  function generateWordsearchGrid(words, size = 12) {
    const grid = Array.from({length: size}, () => Array(size).fill(''));
    words.forEach((word, idx) => {
      if (idx < size) {
        for (let i = 0; i < word.length && i < size; i++) {
          grid[idx][i] = word[i].toUpperCase();
        }
      }
    });
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!grid[r][c]) {
          grid[r][c] = alphabet[Math.floor(Math.random() * alphabet.length)];
        }
      }
    }
    return grid;
  }

  let worksheetOrientation = 'portrait';

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

      // After: aiReply = ...;
      if (aiReply) {
        // Try to extract a list of words (one per line, no numbering)
        // Remove numbers and punctuation, just in case
        const cleaned = aiReply
          .replace(/^\d+[\).\s-]*/gm, '') // remove leading numbers
          .replace(/[•\-–●]/g, '')       // remove bullet points
          .split('\n')
          .map(w => w.trim())
          .filter(Boolean)
          .join('\n');
        // Fill the word box
        const wordBox = document.getElementById('wordsearchWords');
        if (wordBox) wordBox.value = cleaned;
      }

      messages.innerHTML = messages.innerHTML.replace('<span id="aiTypingWordsearch">...</span>', aiReply);
      messages.scrollTop = messages.scrollHeight;
    };
  }

  // 1. Generate words from category prompt using OpenAI
  document.getElementById('generateCategoryWordsBtn').onclick = async () => {
    const prompt = document.getElementById('categoryPrompt').value.trim();
    if (!prompt) return alert("Please enter a category prompt.");
    // Call OpenAI (or your proxy)
    const response = await fetch('/.netlify/functions/openai_proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: 'chat/completions',
        payload: {
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: 'You are a helpful teaching assistant.' },
            { role: 'user', content: `List ${prompt}, one per line, no numbering or punctuation.` }
          ],
          max_tokens: 100
        }
      })
    });
    const data = await response.json();
    const aiWords = data.data.choices?.[0]?.message?.content || '';
    document.getElementById('wordsearchWords').value = aiWords.trim();
  };

  // 2. Extract difficult words from passage using OpenAI
  document.getElementById('extractDifficultWordsBtn').onclick = async () => {
    const passage = document.getElementById('passageInput').value.trim();
    if (!passage) return alert("Please paste a passage.");
    // Call OpenAI (or your proxy)
    const response = await fetch('/.netlify/functions/openai_proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: 'chat/completions',
        payload: {
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: 'You are a helpful teaching assistant.' },
            { role: 'user', content: `From the following passage, extract the 10 most difficult or advanced words (one per line, no numbering):\n\n${passage}` }
          ],
          max_tokens: 100
        }
      })
    });
    const data = await response.json();
    const aiWords = data.data.choices?.[0]?.message?.content || '';
    document.getElementById('wordsearchWords').value = aiWords.trim();
  };

  // Call this after the DOM is loaded and after the chat box is rendered
  setupAIChatBox();
  setupAIChatBoxWordsearch();
});

