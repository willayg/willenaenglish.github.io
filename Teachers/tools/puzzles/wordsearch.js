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

  // Render the Wordsearch Maker UI (if not already rendered)
  if (!document.getElementById('generateWordsearch')) {
    wordsearchMaker.innerHTML = `
      <div class="mb-2 font-semibold">Wordsearch Maker</div>
      <label class="block mb-1">Grid Size</label>
      <select id="wordsearchGridSize" class="border rounded px-2 py-1 mb-2">
        <option value="8">8 x 8</option>
        <option value="10" selected>10 x 10</option>
        <option value="12">12 x 12</option>
        <option value="15">15 x 15</option>
      </select>
      <label class="block mb-1">Letter Case</label>
      <select id="wordsearchCase" class="border rounded px-2 py-1 mb-2">
        <option value="upper">UPPERCASE</option>
        <option value="lower">lowercase</option>
      </select>
      <label class="block mb-1">Font</label>
      <select id="wordsearchFont" class="border rounded px-2 py-1 mb-2">
        <option value="sans">Sans-serif (Default)</option>
        <option value="mono">Monospace</option>
        <option value="comic">Comic Sans MS</option>
        <option value="nanum">Nanum Pen Script</option>
      </select>
      <textarea id="wordsearchWords" class="border rounded w-full p-2 mb-2" rows="3" placeholder="Enter words, one per line"></textarea>
      <button id="generateWordsearch" class="px-3 py-1 bg-[#2e2b3f] text-white rounded hover:bg-[#827e9b]">Generate Wordsearch</button>
      <div id="wordsearchOutput" class="mt-4"></div>
    `;
  }

  document.getElementById('generateWordsearch').onclick = () => {
    const size = parseInt(document.getElementById('wordsearchGridSize').value, 10);
    const caseOpt = document.getElementById('wordsearchCase').value;
    const fontOpt = document.getElementById('wordsearchFont').value;
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

    // Render the grid as a table with the font class on both table and td
    let html = `<div class="mb-2">Grid size: <b>${size} x ${size}</b></div>`;
    html += `<div class="mb-2">Words: <b>${words.join(', ') || 'None'}</b></div>`;
    html += `<table class="border border-collapse mx-auto ${fontClass}" style="font-size:1.3rem;">`;
    for (let row of grid) {
      html += '<tr>';
      for (let cell of row) {
        html += `<td class="border w-8 h-8 text-center select-none ${fontClass}">${cell}</td>`;
      }
      html += '</tr>';
    }
    html += '</table>';

    // Show in lesson workspace only
    const workspace = document.getElementById('workspace');
    if (workspace) {
      workspace.scrollIntoView({ behavior: "smooth" });
      document.getElementById('generatedBlocks').innerHTML = `
        <div class="p-4 bg-white rounded shadow text-[#555]">
          <div class="font-bold mb-2">🧩 Wordsearch Puzzle</div>
          ${html}
        </div>
      `;
    }

    // Remove or comment out this line:
    // document.getElementById('wordsearchOutput').innerHTML = html;
  };

  // Improved wordsearch grid generator: random placement, horizontal/vertical
  function generateWordsearchGrid(words, size, caseOpt) {
    const alphabet = caseOpt === 'upper' ? "ABCDEFGHIJKLMNOPQRSTUVWXYZ" : "abcdefghijklmnopqrstuvwxyz";
    let grid = Array.from({ length: size }, () =>
      Array.from({ length: size }, () => alphabet[Math.floor(Math.random() * alphabet.length)])
    );

    // Try to place each word randomly, horizontal or vertical
    words.forEach(word => {
      let placed = false, attempts = 0;
      while (!placed && attempts < 100) {
        attempts++;
        const dir = Math.random() < 0.5 ? 'H' : 'V';
        const maxStart = size - word.length;
        let row = Math.floor(Math.random() * size);
        let col = Math.floor(Math.random() * size);
        if (dir === 'H' && col <= maxStart) {
          // Check if fits
          let fits = true;
          for (let i = 0; i < word.length; i++) {
            if (grid[row][col + i] !== alphabet[Math.floor(Math.random() * alphabet.length)]) {
              fits = true; // allow overwrite for simplicity
            }
          }
          // Place
          for (let i = 0; i < word.length; i++) {
            grid[row][col + i] = word[i];
          }
          placed = true;
        } else if (dir === 'V' && row <= maxStart) {
          // Check if fits
          let fits = true;
          for (let i = 0; i < word.length; i++) {
            if (grid[row + i][col] !== alphabet[Math.floor(Math.random() * alphabet.length)]) {
              fits = true; // allow overwrite for simplicity
            }
          }
          // Place
          for (let i = 0; i < word.length; i++) {
            grid[row + i][col] = word[i];
          }
          placed = true;
        }
      }
    });

    return grid;
  }
});