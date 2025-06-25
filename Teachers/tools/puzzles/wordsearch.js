document.addEventListener('DOMContentLoaded', () => {

  console.log('Wordsearch.js loaded and DOM ready!');

  // Add Google Fonts for handwriting
  if (!document.getElementById('nanum-pen-font')) {
    const link = document.createElement('link');
    link.id = 'nanum-pen-font';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Nanum+Pen+Script&display=swap';
    document.head.appendChild(link);
  }

  // Helper function to get font-specific CSS styles
  function getFontStyle(fontOpt) {
    switch(fontOpt) {
      case 'sans':
        return 'font-family: "Poppins", Arial, sans-serif !important;';
      case 'mono':
        return 'font-family: "Courier New", Courier, monospace !important;';
      case 'comic':
        return 'font-family: "Comic Sans MS", Comic Sans, cursive, sans-serif !important;';
      case 'nanum':
        return 'font-family: "Nanum Pen Script", cursive !important; line-height: 28px !important; padding-top: 2px !important;';
      default:
        return 'font-family: "Poppins", Arial, sans-serif !important;';
    }
  }

  document.getElementById('generateWordsearch').onclick = () => {
    const size = parseInt(document.getElementById('wordsearchGridSize').value, 10);
    const caseOpt = document.getElementById('wordsearchCase').value;
    const fontOpt = document.getElementById('wordsearchFont').value;
    const sizeScale = parseFloat(document.getElementById('wordsearchSize')?.value || "1.0");
    const align = document.getElementById('wordsearchAlign')?.value || "center";
    const hintsAlign = document.getElementById('wordsearchHintsAlign')?.value || "center";
    let words = document.getElementById('wordsearchWords').value
      .split('\n')
      .map(w => w.trim())
      .filter(Boolean);

    // Apply case
    words = words.map(w => caseOpt === 'upper' ? w.toUpperCase() : w.toLowerCase());

    // Generate the wordsearch grid
    const allowDiagonals = document.getElementById('wordsearchAllowDiagonals')?.checked;
    const allowBackwards = document.getElementById('wordsearchAllowBackwards')?.checked;
    const grid = generateWordsearchGrid(words, size, caseOpt, allowDiagonals, allowBackwards);

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
    if (hintsAlign === "right") hintsAlignStyle = "text-align:right;";    // Build the HTML for the hints/words list
    let html = `<div class="mb-2" style="${hintsAlignStyle}">Words: <b>${words.join(', ') || 'None'}</b></div>`;

    // Add a centered container with consistent styling for all rendering modes
    html += `
      <div style="
        display: flex;
        justify-content: center;
        align-items: center;
        width: 100%;
        margin: 20px 0;
      ">
        <div class="wordsearch-container" style="
          display: block;
          background: #fafaff;
          border: 2.5px solid #b6aee0;
          border-radius: 8px;
          padding: 24px;
          margin: 0 auto;
          box-shadow: 0 2px 8px rgba(46,43,63,0.06);
          max-width: max-content;
          transform: scale(${sizeScale});
          transform-origin: center;        ">
          <table class="wordsearch-table ${fontClass}" style="
            margin: 0 auto;
            border-collapse: collapse;
          ">
            ${grid.map(row => `
              <tr>
                ${row.map(cell => `<td class="${fontClass}" style="
                  width: 32px;
                  height: 32px;
                  text-align: center !important;
                  vertical-align: middle !important;
                  border: 1.5px solid #222;
                  background: #fff;
                  padding: 0;
                  box-sizing: border-box;
                  font-size: 1.1rem;
                  line-height: 32px !important;
                  margin: 0;
                  display: table-cell;
                  ${getFontStyle(fontOpt)}
                ">${cell}</td>`).join('')}
              </tr>
            `).join('')}
          </table>
        </div>
      </div>
    `;

    const output = document.getElementById('wordsearchOutput');
    if (output) {
      output.innerHTML = html;
    }

    const preview = document.getElementById('worksheetPreviewArea-wordsearch');
    if (preview) {
      preview.classList.remove('hidden');
      // Use worksheet template
      const templateIndex = parseInt(document.getElementById('wordsearchTemplate')?.value || "0", 10);
      const template = window.worksheetTemplates?.[templateIndex] || window.worksheetTemplates[0];
      const title = document.getElementById('wordsearchTitle')?.value?.trim() || "";
      const instructions = document.getElementById('wordsearchInstructions')?.value?.trim() || "";
      preview.innerHTML = template.render({
        title,
        instructions,
        puzzle: html,
        orientation: "portrait"
      });
      preview.classList.add('worksheet-preview');
    }
  };

  // Improved wordsearch grid generator: random placement, horizontal/vertical
  function generateWordsearchGrid(words, size = 12, caseOpt = 'upper', allowDiagonals = false, allowBackwards = false) {
    // Initialize empty grid
    const grid = Array.from({ length: size }, () => Array(size).fill(''));
    // Directions: right, down, (optionally diagonals)
    let directions = [
      { dr: 0, dc: 1 },   // right
      { dr: 1, dc: 0 },   // down
    ];
    if (allowDiagonals) {
      directions.push(
        { dr: 1, dc: 1 },   // down-right
        { dr: 1, dc: -1 }   // down-left
      );
    }
    // If backwards allowed, add left and up (and diagonals if enabled)
    if (allowBackwards) {
      directions.push(
        { dr: 0, dc: -1 },  // left
        { dr: -1, dc: 0 }   // up
      );
      if (allowDiagonals) {
        directions.push(
          { dr: -1, dc: 1 },  // up-right
          { dr: -1, dc: -1 }  // up-left
        );
      }
    }

    function canPlace(word, row, col, dr, dc) {
      for (let i = 0; i < word.length; i++) {
        const r = row + dr * i;
        const c = col + dc * i;
        if (r < 0 || r >= size || c < 0 || c >= size) return false;
        if (grid[r][c] && grid[r][c] !== word[i]) return false;
      }
      return true;
    }

    function placeWord(word) {
      // Try up to 100 times to place the word
      for (let attempt = 0; attempt < 100; attempt++) {
        const dir = directions[Math.floor(Math.random() * directions.length)];
        const maxRow = dir.dr === 0 ? size : size - (dir.dr * (word.length - 1));
        const maxCol = dir.dc === 0 ? size : size - (dir.dc * (word.length - 1));
        const row = Math.floor(Math.random() * maxRow);
        const col = Math.floor(Math.random() * maxCol);
        if (canPlace(word, row, col, dir.dr, dir.dc)) {
          for (let i = 0; i < word.length; i++) {
            grid[row + dir.dr * i][col + dir.dc * i] = word[i];
          }
          return true;
        }
      }
      return false; // Could not place word
    }

    // Prepare words (case)
    words = words.map(w => caseOpt === 'upper' ? w.toUpperCase() : w.toLowerCase());

    // Place each word
    words.forEach(word => placeWord(word));

    // Fill empty cells with random letters
    const alphabet = caseOpt === 'upper' ? "ABCDEFGHIJKLMNOPQRSTUVWXYZ" : "abcdefghijklmnopqrstuvwxyz";
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
          .replace(/^\d+[\).\s-]*/gm, '')
          .replace(/[•\-–●]/g, '')
          .split('\n')
          .map(w => w.replace(/[^A-Za-z]/g, '').trim()) // keep only letters
          .filter(Boolean)
          .join('\n');
        document.getElementById('wordsearchWords').value = cleaned;
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
    async function extractWords(difficulty) {
      if (!passage) return alert("Please paste a passage.");
      let prompt = '';
      if (difficulty === 'easy') prompt = "Extract 10 of the simplest words from this passage (one per line, no numbering):\n\n" + passage;
      if (difficulty === 'medium') prompt = "Extract 10 medium-difficulty words from this passage (one per line, no numbering):\n\n" + passage;
      if (difficulty === 'hard') prompt = "Extract the 10 most difficult or advanced words from this passage (one per line, no numbering):\n\n" + passage;
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
              { role: 'user', content: prompt }
            ],
            max_tokens: 100
          }
        })
      });
      const data = await response.json();
      const aiWords = data.data.choices?.[0]?.message?.content || '';
      document.getElementById('wordsearchWords').value = aiWords.trim();
    }
    extractWords('hard'); // default to hard
  };
  // Function to generate the worksheet preview (refactor your existing code into this)
  function updateWordsearchPreview() {
    const size = parseInt(document.getElementById('wordsearchGridSize').value, 10);
    const caseOpt = document.getElementById('wordsearchCase').value;
    const fontOpt = document.getElementById('wordsearchFont').value;
    const sizeScale = parseFloat(document.getElementById('wordsearchSize')?.value || "1.0");
    const align = document.getElementById('wordsearchAlign')?.value || "center";
    const hintsAlign = document.getElementById('wordsearchHintsAlign')?.value || "center";
    let words = document.getElementById('wordsearchWords').value
      .split('\n')
      .map(w => w.trim())
      .filter(Boolean);

    words = words.map(w => caseOpt === 'upper' ? w.toUpperCase() : w.toLowerCase());
    const grid = generateWordsearchGrid(words, size, caseOpt);

    let fontClass = 'wordsearch-font-sans';
    if (fontOpt === 'mono') fontClass = 'wordsearch-font-mono';
    if (fontOpt === 'comic') fontClass = 'wordsearch-font-comic';
    if (fontOpt === 'nanum') fontClass = 'wordsearch-font-nanum';

    let alignStyle = "text-align:center;";
    if (align === "left") alignStyle = "text-align:left;";
    if (align === "right") alignStyle = "text-align:right;";
    let hintsAlignStyle = "text-align:center;";
    if (hintsAlign === "left") hintsAlignStyle = "text-align:left;";    if (hintsAlign === "right") hintsAlignStyle = "text-align:right;";

    let html = `<div class="mb-2" style="${hintsAlignStyle}">Words: <b>${words.join(', ') || 'None'}</b></div>`;
    // Add a centered container with consistent styling for all rendering modes
    html += `
      <div style="
        display: flex;
        justify-content: center;
        align-items: center;
        width: 100%;
        margin: 20px 0;
      ">
        <div class="wordsearch-container" style="
          display: block;
          background: #fafaff;
          border: 2.5px solid #b6aee0;
          border-radius: 8px;
          padding: 24px;
          margin: 0 auto;
          box-shadow: 0 2px 8px rgba(46,43,63,0.06);
          max-width: max-content;
          transform: scale(${sizeScale});
          transform-origin: center;
        ">
          <table class="wordsearch-table ${fontClass}" style="
            margin: 0 auto;
            border-collapse: collapse;          ">
            ${grid.map(row => `
              <tr>
                ${row.map(cell => `<td class="${fontClass}" style="
                  width: 32px;
                  height: 32px;
                  text-align: center !important;
                  vertical-align: middle !important;
                  border: 1.5px solid #222;
                  background: #fff;
                  padding: 0;
                  box-sizing: border-box;
                  font-size: 1.1rem;
                  line-height: 32px !important;
                  margin: 0;
                  display: table-cell;
                  ${getFontStyle(fontOpt)}
                ">${cell}</td>`).join('')}
              </tr>
            `).join('')}
          </table>
        </div>
      </div>
    `;

    const preview = document.getElementById('worksheetPreviewArea-wordsearch');
    if (preview) {
      preview.classList.remove('hidden');
      const templateIndex = parseInt(document.getElementById('wordsearchTemplate')?.value || "0", 10);
      const template = window.worksheetTemplates?.[templateIndex] || window.worksheetTemplates[0];
      const title = document.getElementById('wordsearchTitle')?.value?.trim() || "";
      const instructions = document.getElementById('wordsearchInstructions')?.value?.trim() || "";
      preview.innerHTML = template.render({
        title,
        instructions,
        puzzle: html,
        orientation: "portrait"
      });
      preview.classList.add('worksheet-preview');
    }
  }
  // List of input/select IDs to watch for changes
  const ids = [
    'wordsearchGridSize',
    'wordsearchCase',
    'wordsearchFont',
    'wordsearchSize',
    'wordsearchTemplate',
    'wordsearchTitle',
    'wordsearchInstructions',
    'wordsearchWords',
    'wordsearchAlign',
    'wordsearchHintsAlign'
  ];

  // Set up automatic preview updates when settings change
  ids.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener('change', updateWordsearchPreview);
      element.addEventListener('input', updateWordsearchPreview);
    }
  });

  // Also trigger update when checkboxes change
  const checkboxes = ['wordsearchAllowDiagonals', 'wordsearchAllowBackwards'];
  checkboxes.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener('change', updateWordsearchPreview);
    }
  });

  // Make updateWordsearchPreview available globally
  window.updateWordsearchPreview = updateWordsearchPreview;
  
  // Also make the main generation function available globally for main1.js
  window.generateWordsearch = () => {
    document.getElementById('generateWordsearch').click();
  };

  // Optionally, call once on load to show preview immediately
  updateWordsearchPreview();

  // Call this after the DOM is loaded and after the chat box is rendered
  setupAIChatBox();
  setupAIChatBoxWordsearch();

  // Enter key submits category prompt
  const categoryInput = document.getElementById('categoryPrompt');
  if (categoryInput) {
    categoryInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('generateCategoryWordsBtn').click();
      }
    });
  }
});

