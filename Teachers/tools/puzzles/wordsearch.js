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
    
    // Get slider values for custom sizing and positioning
    const customSizeScale = parseFloat(document.getElementById('wordsearchSizeSlider')?.value || 1);
    const customPosition = parseInt(document.getElementById('wordsearchPositionSlider')?.value || 0);
    
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
    // Apply font and size to the hints/word list
    let html = `<div class="mb-2" style="${hintsAlignStyle}; font-family: ${getFontStyle(fontOpt)}; font-size: ${sizeScale}em;">Words: <b>${words.join(', ') || 'None'}</b></div>`;

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
          transform: scale(${customSizeScale});
          transform-origin: center top;        ">
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
    
    // Reset highlight state when new wordsearch is generated
    isHighlighted = false;
    const highlightBtn = document.getElementById('highlightAnswers');
    if (highlightBtn) {
      highlightBtn.textContent = 'Show Answers';
    }
    
    console.log(`Reset highlight state. Button text: ${highlightBtn ? highlightBtn.textContent : 'Button not found'}`);
  };

  // Store word placements for highlighting and track highlight state
  let wordPlacements = [];
  let isHighlighted = false;

  // Improved wordsearch grid generator: random placement, horizontal/vertical
  function generateWordsearchGrid(words, size = 12, caseOpt = 'upper', allowDiagonals = false, allowBackwards = false) {
    // Reset word placements
    wordPlacements = [];
    
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
          // Store word placement for highlighting
          const placement = { word, positions: [] };
          for (let i = 0; i < word.length; i++) {
            const r = row + dir.dr * i;
            const c = col + dir.dc * i;
            grid[r][c] = word[i];
            placement.positions.push({ row: r, col: c });
          }
          wordPlacements.push(placement);
          console.log(`Placed word "${word}" at positions:`, placement.positions);
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
    
    console.log(`Generated grid with ${wordPlacements.length} word placements:`, wordPlacements);
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

    // Apply font and size to the hints/word list
    let html = `<div class="mb-2" style="${hintsAlignStyle}; font-family: ${getFontStyle(fontOpt)}; font-size: ${sizeScale}em;">Words: <b>${words.join(', ') || 'None'}</b></div>`;
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
          margin-top: ${customPosition}px;
          box-shadow: 0 2px 8px rgba(46,43,63,0.06);
          max-width: max-content;
          transform: scale(${customSizeScale});
          transform-origin: center top;
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

  // Special handling for font and case changes (live update without regenerating puzzle)
  const fontElement = document.getElementById('wordsearchFont');
  const caseElement = document.getElementById('wordsearchCase');
  
  if (fontElement) {
    fontElement.addEventListener('change', updateWordsearchFontAndCase);
  }
  
  if (caseElement) {
    caseElement.addEventListener('change', updateWordsearchFontAndCase);
  }

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

  // Add wordsearch slider event listeners
  const sizeSlider = document.getElementById('wordsearchSizeSlider');
  const positionSlider = document.getElementById('wordsearchPositionSlider');
  const sizeValue = document.getElementById('wordsearchSizeValue');
  const positionValue = document.getElementById('wordsearchPositionValue');

  if (sizeSlider && sizeValue) {
    sizeSlider.addEventListener('input', () => {
      const value = parseFloat(sizeSlider.value);
      sizeValue.textContent = Math.round(value * 100) + '%';
      updateWordsearchPreview();
    });
  }

  if (positionSlider && positionValue) {
    positionSlider.addEventListener('input', () => {
      const value = parseInt(positionSlider.value);
      if (value === 0) {
        positionValue.textContent = 'Center';
      } else if (value > 0) {
        positionValue.textContent = `Down ${value}px`;
      } else {
        positionValue.textContent = `Up ${Math.abs(value)}px`;
      }
      updateWordsearchPreview();
    });
  }

  // Function to update existing wordsearch preview with slider values
  function updateWordsearchPreview() {
    const preview = document.getElementById('worksheetPreviewArea-wordsearch');
    if (!preview || preview.classList.contains('hidden')) return;

    const container = preview.querySelector('.wordsearch-container');
    if (!container) return;

    const sizeScale = parseFloat(document.getElementById('wordsearchSizeSlider')?.value || 1);
    const position = parseInt(document.getElementById('wordsearchPositionSlider')?.value || 0);

    // Apply size scaling and vertical positioning dynamically
    container.style.transform = `scale(${sizeScale}) translateY(${position}px)`;
    container.style.transformOrigin = 'center top';

    // Apply vertical positioning
    container.style.marginTop = `${position}px`;
  }

  // Add event listener for Highlight Answers button (toggle functionality)
  const highlightAnswersBtn = document.getElementById('highlightAnswers');
  console.log('Highlight button found:', highlightAnswersBtn ? 'Yes' : 'No');
  
  if (highlightAnswersBtn) {
    
    function updateButtonText() {
      const newText = isHighlighted ? 'Hide Answers' : 'Show Answers';
      highlightAnswersBtn.textContent = newText;
      console.log(`Button text updated to: "${newText}"`);
    }
    
    function highlightAnswers() {
      console.log('Highlighting answers...');
      console.log('Current wordPlacements:', wordPlacements);
      
      const preview = document.getElementById('worksheetPreviewArea-wordsearch');
      if (!preview || preview.classList.contains('hidden')) {
        console.log('Preview not visible or not found');
        return false;
      }

      const table = preview.querySelector('.wordsearch-table');
      if (!table) {
        console.log('No table found in preview');
        return false;
      }

      if (!wordPlacements || wordPlacements.length === 0) {
        console.log('No word placements available. Available:', wordPlacements);
        alert('Please generate a wordsearch first before highlighting answers.');
        return false;
      }

      let highlightedCount = 0;
      wordPlacements.forEach((placement, index) => {
        console.log(`Processing word ${index + 1}: "${placement.word}" with ${placement.positions.length} positions`);
        placement.positions.forEach(pos => {
          if (table.rows[pos.row] && table.rows[pos.row].cells[pos.col]) {
            const cell = table.rows[pos.row].cells[pos.col];
            cell.style.backgroundColor = 'orange';
            cell.style.color = 'black';
            cell.style.fontWeight = 'bold';
            highlightedCount++;
            console.log(`Highlighted cell at [${pos.row}, ${pos.col}] with letter "${cell.textContent}"`);
          } else {
            console.log(`Invalid position: [${pos.row}, ${pos.col}] - row or cell not found`);
          }
        });
      });
      
      console.log(`Total highlighted cells: ${highlightedCount}`);
      return true;
    }
    
    function clearHighlights() {
      console.log('Clearing highlights...');
      const preview = document.getElementById('worksheetPreviewArea-wordsearch');
      if (!preview) {
        console.log('Preview not found');
        return;
      }

      const table = preview.querySelector('.wordsearch-table');
      if (!table) {
        console.log('Table not found');
        return;
      }

      const cells = table.querySelectorAll('td');
      let clearedCount = 0;
      cells.forEach(cell => {
        if (cell.style.backgroundColor === 'orange') {
          clearedCount++;
        }
        cell.style.backgroundColor = '#fff';
        cell.style.color = 'black';
        cell.style.fontWeight = 'normal';
      });
      
      console.log(`Cleared highlights from ${clearedCount} cells`);
    }
    
    highlightAnswersBtn.addEventListener('click', () => {
      console.log('Highlight toggle button clicked!');
      console.log('Current state - isHighlighted:', isHighlighted);
      console.log('Button text before:', highlightAnswersBtn.textContent);
      console.log('WordPlacements available:', wordPlacements.length);
      
      if (isHighlighted) {
        // Clear highlights
        clearHighlights();
        isHighlighted = false;
        console.log('Switched to: Clear mode');
      } else {
        // Show highlights
        if (highlightAnswers()) {
          isHighlighted = true;
          console.log('Switched to: Highlight mode');
        } else {
          console.log('Failed to highlight - staying in clear mode');
        }
      }
      
      updateButtonText();
      console.log('Button text after:', highlightAnswersBtn.textContent);
      console.log('Final state - isHighlighted:', isHighlighted);
      console.log('---');
    });
    
    // Initialize button text
    updateButtonText();
  }

  // Add border color cycling functionality
  const borderColors = ['#b6aee0', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3'];
  let currentBorderIndex = 0;

  // Add click event to wordsearch container border
  document.addEventListener('click', (e) => {
    const container = e.target.closest('.wordsearch-container');
    if (container && e.target === container) {
      currentBorderIndex = (currentBorderIndex + 1) % borderColors.length;
      container.style.borderColor = borderColors[currentBorderIndex];
    }
  });

  // Add live font and case updates (without regenerating puzzle)
  function updateWordsearchFontAndCase() {
    console.log('Updating font and case...');
    const preview = document.getElementById('worksheetPreviewArea-wordsearch');
    if (!preview || preview.classList.contains('hidden')) {
      console.log('Preview not available for font update');
      return;
    }

    const table = preview.querySelector('.wordsearch-table');
    if (!table) {
      console.log('Table not found for font update');
      return;
    }

    const fontOpt = document.getElementById('wordsearchFont').value;
    const caseOpt = document.getElementById('wordsearchCase').value;
    
    console.log(`Applying font: ${fontOpt}, case: ${caseOpt}`);
    
    // Apply font changes
    const cells = table.querySelectorAll('td');
    let highlightedCells = 0;
    
    cells.forEach(cell => {
      // Store current highlight state
      const wasHighlighted = cell.style.backgroundColor === 'orange';
      if (wasHighlighted) highlightedCells++;
      
      // Apply case change to existing content
      if (caseOpt === 'upper') {
        cell.textContent = cell.textContent.toUpperCase();
      } else {
        cell.textContent = cell.textContent.toLowerCase();
      }
      
      // Apply font style
      cell.style.removeProperty('font-family');
      cell.classList.remove('wordsearch-font-sans', 'wordsearch-font-mono', 'wordsearch-font-comic', 'wordsearch-font-nanum');
      
      let fontClass = 'wordsearch-font-sans';
      if (fontOpt === 'mono') fontClass = 'wordsearch-font-mono';
      if (fontOpt === 'comic') fontClass = 'wordsearch-font-comic';
      if (fontOpt === 'nanum') fontClass = 'wordsearch-font-nanum';
      
      cell.classList.add(fontClass);
      
      // Apply font style carefully to preserve highlights
      const fontStyle = getFontStyle(fontOpt);
      const fontStyleParts = fontStyle.split(';').filter(part => part.trim());
      fontStyleParts.forEach(part => {
        const [property, value] = part.split(':').map(s => s.trim().replace('!important', '').trim());
        if (property && value && property !== 'color' && property !== 'background-color' && property !== 'font-weight') {
          cell.style.setProperty(property, value, 'important');
        }
      });
      
      // Restore highlight if it was highlighted
      if (wasHighlighted) {
        cell.style.backgroundColor = 'orange';
        cell.style.color = 'black';
        cell.style.fontWeight = 'bold';
      }
    });
    
    console.log(`Font update complete. Preserved ${highlightedCells} highlighted cells.`);

    // Update hints text
    const hintsDiv = preview.querySelector('.mb-2');
    if (hintsDiv) {
      const words = document.getElementById('wordsearchWords').value
        .split('\n')
        .map(w => w.trim())
        .filter(Boolean)
        .map(w => caseOpt === 'upper' ? w.toUpperCase() : w.toLowerCase());
      
      hintsDiv.innerHTML = `Words: <b>${words.join(', ') || 'None'}</b>`;
    }
  }
});

