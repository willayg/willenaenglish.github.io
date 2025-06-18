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
    console.log("Button clicked!");
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
    html += `<table class="wordsearch-table ${fontClass}">`;
    for (let row of grid) {
      html += '<tr>';
      for (let cell of row) {
        html += `<td class="${fontClass}">${cell}</td>`;
      }
      html += '</tr>';
    }
    html += '</table>';

    // Show in lesson workspace only
    const workspace = document.getElementById('workspace');
    if (workspace) {
      workspace.scrollIntoView({ behavior: "smooth" });
      const templateSelect = document.getElementById('templateSelect');
      const templateIdx = templateSelect ? templateSelect.selectedIndex : 0;
      const template = window.worksheetTemplates?.[templateIdx] || window.worksheetTemplates[0];
      const title = document.getElementById('worksheetTitle')?.value || "Wordsearch Worksheet";
      const instructions = document.getElementById('worksheetInstructions')?.value || 'Find all the words in the puzzle.';
      const worksheetHTML = template.render({
        title,
        instructions,
        puzzle: `<div id="puzzleExport">${html}</div>`,
        orientation: worksheetOrientation // pass this to your template
      });
      workspace.innerHTML = worksheetHTML;
    }

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
});

