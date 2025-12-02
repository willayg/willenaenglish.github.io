document.addEventListener('DOMContentLoaded', () => {
  // (Legacy inline PDF/Print handlers removed in favor of centralized logic in HTML wrapper / dedicated print module.)
  // Save worksheet to Supabase via worksheet manager
  const saveBtn = document.getElementById('saveBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      window.open('/Teachers/worksheet_manager.html?mode=save', 'worksheetManager', 'width=1200,height=550');
    });
  }

  // Load worksheet from Supabase via worksheet manager
  const loadBtn = document.getElementById('loadBtn');
  if (loadBtn) {
    loadBtn.addEventListener('click', () => {
      window.open('/Teachers/worksheet_manager.html?mode=load', 'worksheetManager', 'width=1200,height=550');
    });
  }

  // Exported for worksheet manager integration
  window.getCurrentWorksheetData = function() {
    // Gather all worksheet data
    const allowDiagonals = document.getElementById('wordsearchAllowDiagonals').checked;
    const allowBackwards = document.getElementById('wordsearchAllowBackwards').checked;
    // Only include fields that are used for fetching/searching at the top level.
    // Store allowDiagonals and allowBackwards in settings_json only.
    // Gather all settings panel data into settings_json only
    return {
      worksheet_type: 'wordsearch',
      title: document.getElementById('wordsearchTitle').value,
      words: document.getElementById('wordsearchWords').value,
      settings: JSON.stringify({
        instructions: document.getElementById('wordsearchInstructions').value,
        gridSize: document.getElementById('wordsearchGridSize').value,
        font: document.getElementById('wordsearchFont').value,
        template: document.getElementById('wordsearchTemplate').value,
        sizeScale: document.getElementById('wordsearchSizeSlider').value,
        position: document.getElementById('wordsearchPositionSlider').value,
        allowDiagonals: allowDiagonals,
        allowBackwards: allowBackwards,
        case: document.getElementById('wordsearchCase').value
      })
    };
  };

  window.loadWorksheet = function(data) {
    if (!data || (data.worksheet_type && data.worksheet_type !== 'wordsearch')) {
      alert('Only wordsearch worksheet files can be loaded here.');
      return;
    }
    document.getElementById('wordsearchTitle').value = data.title || '';
    document.getElementById('wordsearchInstructions').value = data.instructions || '';
    document.getElementById('wordsearchWords').value = data.words || '';
    document.getElementById('wordsearchGridSize').value = data.gridSize || '12';
    document.getElementById('wordsearchCase').value = data.case || 'upper';
    document.getElementById('wordsearchFont').value = data.font || 'sans';
    document.getElementById('wordsearchTemplate').value = data.template || '0';

    // Try to load allowDiagonals and allowBackwards from settings JSON if present
    let allowDiagonals = data.allowDiagonals;
    let allowBackwards = data.allowBackwards;
    if (data.settings) {
      try {
        const settings = typeof data.settings === 'string' ? JSON.parse(data.settings) : data.settings;
        if (typeof settings.allowDiagonals !== 'undefined') allowDiagonals = settings.allowDiagonals;
        if (typeof settings.allowBackwards !== 'undefined') allowBackwards = settings.allowBackwards;
      } catch (e) {
        // Ignore JSON parse errors
      }
    }
    document.getElementById('wordsearchAllowDiagonals').checked = allowDiagonals === true;
    document.getElementById('wordsearchAllowBackwards').checked = allowBackwards === true;
    document.getElementById('wordsearchSizeSlider').value = data.sizeScale || '1';
    document.getElementById('wordsearchPositionSlider').value = data.position || '0';
    document.getElementById('wordsearchSizeValue').textContent = `${parseFloat(data.sizeScale || '1').toFixed(1)}x`;
    document.getElementById('wordsearchPositionValue').textContent = `${data.position || '0'}px`;
    // Trigger preview update
    setTimeout(() => {
      const generateBtn = document.getElementById('generateWordsearch');
      if (generateBtn) {
        generateBtn.click();
      }
    }, 100);
  };
  // (Legacy print button handler removed.)
  console.log('Standalone Wordsearch Generator loaded!');

  // Add Google Fonts for handwriting
  if (!document.getElementById('nanum-pen-font')) {
    const link = document.createElement('link');
    link.id = 'nanum-pen-font';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Nanum+Pen+Script&display=swap';
    document.head.appendChild(link);
  }

  // Store word placements for answer marking
  let wordPlacements = [];

  // Helper function to get font-specific CSS styles
  function getFontStyle(fontOpt) {
    switch(fontOpt) {
      case 'sans':
        return 'font-family: Arial, Helvetica, sans-serif !important;';
      case 'poppins':
        return 'font-family: "Poppins", Arial, sans-serif !important;';
      case 'verdana':
        return 'font-family: Verdana, Geneva, sans-serif !important;';
      case 'mono':
        return 'font-family: "Courier New", Courier, monospace !important;';
      case 'comic':
        return 'font-family: "Comic Sans MS", Comic Sans, cursive, sans-serif !important;';
      case 'nanum':
        return 'font-family: "Nanum Pen Script", cursive !important; line-height: 28px !important; padding-top: 2px !important;';
      case 'caveat':
        return 'font-family: "Caveat", cursive !important;';
      case 'dancing':
        return 'font-family: "Dancing Script", cursive !important;';
      case 'pacifico':
        return 'font-family: "Pacifico", cursive !important;';
      default:
        return 'font-family: "Poppins", Arial, sans-serif !important;';
    }
  }

  // Worksheet templates for different designs
  const worksheetTemplates = [
    {
      name: "Classic",
      render: (data) => `
        <div class="worksheet-content" style="width: 100%; display: flex; flex-direction: column; align-items: center;">
          <div class="worksheet-header" style="text-align: center; margin-bottom: 30px; padding: 20px; border-bottom: 2px solid #333; width: 100%; max-width: 800px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
              <img src="../../../Assets/Images/color-logo.png" alt="Willena" style="height: 40px;">
              <h2 style="margin: 0; font-size: 1.8em; font-weight: 600;">${data.title || 'Wordsearch Puzzle'}</h2>
              <div style="min-width: 220px; display: flex; justify-content: space-between;">
                <span style="font-size: 0.9em;">Name: _____________</span>
                <span style="font-size: 0.9em;">Date: _____________</span>
              </div>
            </div>
            ${data.instructions ? `<p style="margin: 10px 0; font-size: 1.1em; color: #555;">${data.instructions}</p>` : ''}
          </div>
          <div class="worksheet-puzzle" style="width: 100%; display: flex; flex-direction: column; align-items: center;">
            ${data.puzzle || ''}
          </div>
        </div>
      `
    },
    {
      name: "Modern",
      render: (data) => `
        <div class="worksheet-content" style="width: 100%; display: flex; flex-direction: column; align-items: center;">
          <div class="worksheet-header" style="text-align: center; margin-bottom: 30px; padding: 25px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 12px; width: 100%; max-width: 800px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
              <img src="../../../Assets/Images/color-logo1.png" alt="Willena" style="height: 40px; filter: brightness(0) invert(1);">
              <h2 style="margin: 0; font-size: 1.8em; font-weight: 600;">${data.title || 'Wordsearch Puzzle'}</h2>
              <div style="min-width: 220px; display: flex; justify-content: space-between;">
                <span style="font-size: 0.9em;">Name: _____________</span>
                <span style="font-size: 0.9em;">Date: _____________</span>
              </div>
            </div>
            ${data.instructions ? `<p style="margin: 10px 0; font-size: 1.1em;">${data.instructions}</p>` : ''}
          </div>
          <div class="worksheet-puzzle" style="width: 100%; display: flex; flex-direction: column; align-items: center;">
            ${data.puzzle || ''}
          </div>
        </div>
      `
    },
    {
      name: "Simple",
      render: (data) => `
        <div class="worksheet-content" style="width: 100%; display: flex; flex-direction: column; align-items: center;">
          <div class="worksheet-header" style="text-align: center; margin-bottom: 30px; padding: 15px; width: 100%; max-width: 800px;">
            <img src="../../../Assets/Images/color-logo.png" alt="Willena" style="height: 40px; margin-bottom: 8px;">
            <h2 style="margin: 0 0 10px 0; font-size: 1.8em; font-weight: 600;">${data.title || 'Wordsearch Puzzle'}</h2>
            ${data.instructions ? `<p style="margin: 10px 0; font-size: 1.1em; color: #555;">${data.instructions}</p>` : ''}
            <div style="display: flex; justify-content: center; gap: 40px; margin-top: 15px;">
              <span style="font-size: 0.9em;">Name: _____________</span>
              <span style="font-size: 0.9em;">Date: _____________</span>
            </div>
          </div>
          <div class="worksheet-puzzle" style="width: 100%; display: flex; flex-direction: column; align-items: center;">
            ${data.puzzle || ''}
          </div>
        </div>
      `
    }
  ];

  // Main generation function
  document.getElementById('generateWordsearch').onclick = () => {
    const size = parseInt(document.getElementById('wordsearchGridSize').value, 10);
    const caseOpt = document.getElementById('wordsearchCase').value;
    const fontOpt = document.getElementById('wordsearchFont').value;
    const title = document.getElementById('wordsearchTitle').value.trim();
    const instructions = document.getElementById('wordsearchInstructions').value.trim();
    
    // Get slider values for custom sizing and positioning
    const customSizeScale = parseFloat(document.getElementById('wordsearchSizeSlider')?.value || 1);
    const customPosition = parseInt(document.getElementById('wordsearchPositionSlider')?.value || 0);
    
    let words = document.getElementById('wordsearchWords').value
      .split('\n')
      .map(w => w.trim())
      .filter(Boolean);

    if (words.length === 0) {
      alert('Please enter some words to generate a wordsearch.');
      return;
    }

    // Apply case
    words = words.map(w => caseOpt === 'upper' ? w.toUpperCase() : w.toLowerCase());

    // Generate the wordsearch grid
    const allowDiagonals = document.getElementById('wordsearchAllowDiagonals')?.checked;
    const allowBackwards = document.getElementById('wordsearchAllowBackwards')?.checked;
  const { grid, placedWords, unplacedWords } = generateWordsearchGrid(words, size, caseOpt, allowDiagonals, allowBackwards);

    // Font CSS class
    let fontClassMap = {
      'sans': 'wordsearch-font-sans',
      'poppins': 'wordsearch-font-poppins',
      'verdana': 'wordsearch-font-verdana',
      'mono': 'wordsearch-font-mono',
      'comic': 'wordsearch-font-comic',
      'nanum': 'wordsearch-font-nanum',
      'caveat': 'wordsearch-font-caveat',
      'dancing': 'wordsearch-font-dancing',
      'pacifico': 'wordsearch-font-pacifico'
    };
    let fontClass = fontClassMap[fontOpt] || 'wordsearch-font-poppins';

    // Build the HTML for the hints/words list
    let html = `<div class=\"words-list\" style=\"text-align: center; font-family: ${getFontStyle(fontOpt)}; font-size: 1em; margin-bottom: 8px; width: 100%;\">
      <strong>Words to find (${placedWords.length}):</strong> ${placedWords.join(', ')}
    </div>`;
    if (unplacedWords.length) {
      html += `<div class=\"unplaced-words\" style=\"text-align:center; color:#b30000; font-size:0.8em; margin-bottom:14px;\"><strong>Not included (no space):</strong> ${unplacedWords.join(', ')}${unplacedWords.some(w=>w.length>size)?'<br><em style=\"color:#d44;\">(Some words are longer than the grid size)</em>':''}</div>`;
    }

    // Add the wordsearch grid
    html += `
      <div class="wordsearch-wrapper" style="
        display: flex;
        flex-direction: column;
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
            border-collapse: collapse;
            table-layout: fixed;
            aspect-ratio: 1 / 1;
            width: 100%;
            max-width: 600px;
            height: auto;
          ">
            ${grid.map((row, rowIndex) => `
              <tr>
                ${row.map((cell, colIndex) => `<td class="${fontClass}" data-row="${rowIndex}" data-col="${colIndex}" style="
                  aspect-ratio: 1 / 1;
                  width: calc(100% / ${grid.length});
                  height: auto;
                  text-align: center !important;
                  vertical-align: middle !important;
                  border: 1.5px solid #222;
                  background: #fff;
                  padding: 0;
                  box-sizing: border-box;
                  font-size: 1.1rem;
                  line-height: 1;
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
      // Use worksheet template
      const templateIndex = parseInt(document.getElementById('wordsearchTemplate')?.value || "0", 10);
      const template = worksheetTemplates[templateIndex] || worksheetTemplates[0];
      preview.innerHTML = template.render({
        title: title || 'Wordsearch Puzzle',
        instructions: instructions || 'Find the hidden words in the grid below.',
        puzzle: html,
        orientation: "portrait"
      });
      preview.classList.add('worksheet-preview');
    }
    
    // Mark answer cells (data-answer="true") so external toggle logic / CSS can style them
    try {
      const previewArea = document.getElementById('worksheetPreviewArea-wordsearch');
      if (previewArea) {
        console.log('Marking', wordPlacements.length, 'word placements as answers'); // Debug log
        wordPlacements.forEach(placement => {
          console.log('Marking word:', placement.word, 'positions:', placement.positions.length); // Debug log
          placement.positions.forEach(pos => {
            const cell = previewArea.querySelector(`td[data-row="${pos.row}"][data-col="${pos.col}"]`);
            if (cell) {
              cell.setAttribute('data-answer','true');
              console.log('Marked cell at', pos.row, pos.col, 'with letter:', cell.textContent); // Debug log
            } else {
              console.warn('Could not find cell at', pos.row, pos.col); // Debug log
            }
          });
        });
      }
    } catch(e) {
      console.error('Mark answer cells failed:', e.message);
    }
    // Reset external toggle button text if present
    const highlightBtn = document.getElementById('highlightAnswers');
    if (highlightBtn) highlightBtn.textContent = 'Show Answers';
    
    console.log(`Generated wordsearch with ${wordPlacements.length} word placements; unplaced: ${unplacedWords.length}`);
  };

  // Improved wordsearch grid generator with placed/unplaced reporting
  function generateWordsearchGrid(words, size = 12, caseOpt = 'upper', allowDiagonals = false, allowBackwards = false) {
    wordPlacements = [];
    const grid = Array.from({ length: size }, () => Array(size).fill(''));
    let directions = [ { dr: 0, dc: 1 }, { dr: 1, dc: 0 } ];
    if (allowDiagonals) directions.push({ dr: 1, dc: 1 }, { dr: 1, dc: -1 });
    if (allowBackwards) {
      directions.push({ dr: 0, dc: -1 }, { dr: -1, dc: 0 });
      if (allowDiagonals) directions.push({ dr: -1, dc: 1 }, { dr: -1, dc: -1 });
    }
    function canPlace(word, row, col, dr, dc) {
      for (let i = 0; i < word.length; i++) {
        const r = row + dr * i, c = col + dc * i;
        if (r < 0 || r >= size || c < 0 || c >= size) return false;
        if (grid[r][c] && grid[r][c] !== word[i]) return false;
      }
      return true;
    }
    function placeWord(word) {
      for (let attempt = 0; attempt < 120; attempt++) {
        const dir = directions[Math.floor(Math.random() * directions.length)];
        const maxRow = size - Math.abs(dir.dr * (word.length - 1));
        const maxCol = size - Math.abs(dir.dc * (word.length - 1));
        const row = Math.floor(Math.random() * maxRow);
        const col = Math.floor(Math.random() * maxCol);
        if (canPlace(word, row, col, dir.dr, dir.dc)) {
          const placement = { word, positions: [] };
          for (let i = 0; i < word.length; i++) {
            const r = row + dir.dr * i, c = col + dir.dc * i;
            grid[r][c] = word[i];
            placement.positions.push({ row: r, col: c });
          }
          wordPlacements.push(placement);
          return true;
        }
      }
      return false;
    }
    const placedWords = [], unplacedWords = [];
    words.forEach(w => {
      if (w.length > size) { unplacedWords.push(w); return; }
      placeWord(w) ? placedWords.push(w) : unplacedWords.push(w);
    });
    const alphabet = (caseOpt === 'upper' ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' : 'abcdefghijklmnopqrstuvwxyz');
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (!grid[r][c]) grid[r][c] = alphabet[Math.floor(Math.random()*alphabet.length)];
    return { grid, placedWords, unplacedWords };
  }

  // Note: Highlight button event handler is managed by the main HTML page script
  // to ensure proper integration with setAnswersState function

  // AI Word Generation
  document.getElementById('generateCategoryWordsBtn').onclick = async () => {
    const prompt = document.getElementById('categoryPrompt').value.trim();
    if (!prompt) {
      alert('Please enter a category or topic.');
      return;
    }

    const button = document.getElementById('generateCategoryWordsBtn');
    const originalText = button.textContent;
    button.textContent = 'Generating...';
    button.disabled = true;

    try {
      // Simple word generation based on common categories
      const words = await generateWordsFromCategory(prompt);
      const wordsTextarea = document.getElementById('wordsearchWords');
      
      if (words.length > 0) {
        wordsTextarea.value = words.join('\n');
        // Auto-generate wordsearch
        setTimeout(() => {
          document.getElementById('generateWordsearch').click();
        }, 100);
      } else {
        alert('Could not generate words for that category. Please try a different topic.');
      }
    } catch (error) {
      console.error('Error generating words:', error);
      alert('Error generating words. Please try again.');
    } finally {
      button.textContent = originalText;
      button.disabled = false;
    }
  };

  // Extract words from text
  document.getElementById('extractDifficultWordsBtn').onclick = async () => {
    const passage = document.getElementById('passageInput').value.trim();
    if (!passage) {
      alert('Please enter some text to analyze.');
      return;
    }

    const button = document.getElementById('extractDifficultWordsBtn');
    const originalText = button.textContent;
    button.textContent = 'Extracting...';
    button.disabled = true;

    try {
      const words = extractWordsFromText(passage);
      const wordsTextarea = document.getElementById('wordsearchWords');
      
      if (words.length > 0) {
        wordsTextarea.value = words.join('\n');
        // Auto-generate wordsearch
        setTimeout(() => {
          document.getElementById('generateWordsearch').click();
        }, 100);
      } else {
        alert('Could not extract suitable words from the text.');
      }
    } catch (error) {
      console.error('Error extracting words:', error);
      alert('Error extracting words. Please try again.');
    } finally {
      button.textContent = originalText;
      button.disabled = false;
    }
  };

  // Simple word generation from categories
  async function generateWordsFromCategory(category) {
    const wordCategories = {
      'animals': ['CAT','DOG','BIRD','FISH','RABBIT','HORSE','ELEPHANT','LION','TIGER','BEAR','WOLF','FOX'],
      'colors': ['RED','BLUE','GREEN','YELLOW','PURPLE','ORANGE','BLACK','WHITE','PINK','BROWN','GRAY'],
      'food': ['APPLE','BANANA','ORANGE','BREAD','CHEESE','PIZZA','BURGER','CAKE','COOKIE','MILK','WATER','RICE'],
      'sports': ['FOOTBALL','BASKETBALL','BASEBALL','SOCCER','TENNIS','GOLF','SWIMMING','RUNNING','CYCLING'],
      'school': ['TEACHER','STUDENT','BOOK','PENCIL','PAPER','DESK','CHAIR','BOARD','LESSON','HOMEWORK'],
      'family': ['MOTHER','FATHER','SISTER','BROTHER','GRANDMA','GRANDPA','UNCLE','AUNT','COUSIN'],
      'weather': ['SUNNY','RAINY','CLOUDY','WINDY','SNOWY','STORMY','HOT','COLD','WARM','COOL'],
      'body': ['HEAD','EYES','NOSE','MOUTH','EARS','HANDS','ARMS','LEGS','FEET','FINGERS'],
      'house': ['KITCHEN','BEDROOM','BATHROOM','LIVING','DOOR','WINDOW','ROOF','FLOOR','WALL','STAIRS'],
      'transport': ['CAR','BUS','TRAIN','PLANE','BIKE','BOAT','SHIP','TRUCK','TAXI','SUBWAY'],
      'toys': ['BALL','DOLL','ROBOT','PUZZLE','BLOCKS','CAR','TRAIN','KITE','YOYO','DRUM','TEDDY','TOP']
    };
    const synonyms = {
      'toy': 'toys', 'toys': 'toys', 'favorite toys': 'toys', 'games': 'toys'
    };
    const normalized = category.toLowerCase().trim();
    const mapped = synonyms[normalized];
    if (mapped && wordCategories[mapped]) return wordCategories[mapped].slice(0,12);
    for (const [key, list] of Object.entries(wordCategories)) {
      if (key.includes(normalized) || normalized.includes(key)) return list.slice(0,12);
    }
    // Try OpenAI (proxy) as a fallback for uncategorized prompts
    try {
      const resp = await fetch('/.netlify/functions/openai_proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: 'chat/completions',
          payload: {
            model: 'gpt-3.5-turbo',
            messages: [
              { role: 'system', content: 'You produce ONLY a clean newline separated list of simple uppercase single English words (no numbering, no punctuation).' },
              { role: 'user', content: `List 12 simple classroom-appropriate English words about: ${category}` }
            ],
            max_tokens: 120, temperature: 0.4
          }
        })
      });
      if (resp.ok) {
        const data = await resp.json();
        const raw = data.data?.choices?.[0]?.message?.content || '';
        const cleaned = raw.split(/\n+/)
          .map(l => l.replace(/^[0-9]+[).\-\s]*/,'').replace(/[^A-Z]/gi,'').toUpperCase().trim())
          .filter(w => w.length >= 3 && w.length <= 14)
          .filter((w,i,a) => w && a.indexOf(w)===i)
          .slice(0,12);
        if (cleaned.length) return cleaned;
      }
    } catch(e) {
      console.warn('AI fallback failed:', e.message);
    }
    // Final fallback: return category letters forming one word split (ensures not always animals)
    const letters = category.toUpperCase().replace(/[^A-Z]/g,'');
    if (letters.length >= 3) return [letters];
    return ['WORD','LIST'];
  }

  // Extract words from text
  function extractWordsFromText(text) {
    // Simple text analysis - extract unique words of 4+ letters
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length >= 4 && word.length <= 12)
      .filter(word => /^[a-zA-Z]+$/.test(word))
      .map(word => word.toUpperCase());

    // Remove duplicates and common words
    const commonWords = ['THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 'HER', 'WAS', 'ONE', 'OUR', 'OUT', 'DAY', 'GET', 'HAS', 'HIM', 'HIS', 'HOW', 'ITS', 'MAY', 'NEW', 'NOW', 'OLD', 'SEE', 'TWO', 'WAY', 'WHO', 'BOY', 'DID', 'USE', 'SHE', 'EACH', 'THEM', 'BEEN', 'CALL', 'COME', 'DOWN', 'FIND', 'FROM', 'HAVE', 'INTO', 'LIKE', 'LOOK', 'MAKE', 'MORE', 'ONLY', 'OTHER', 'OVER', 'PART', 'SAID', 'SOME', 'SUCH', 'THAN', 'THAT', 'THEIR', 'THERE', 'THESE', 'THEY', 'THIS', 'TIME', 'VERY', 'WELL', 'WHAT', 'WHEN', 'WHERE', 'WHICH', 'WHILE', 'WILL', 'WITH', 'WORK', 'WOULD', 'WRITE', 'YEAR', 'YOUR'];
    
    const uniqueWords = [...new Set(words)]
      .filter(word => !commonWords.includes(word))
      .slice(0, 12);

    return uniqueWords;
  }

  // Auto-update preview when inputs change
  function updateWordsearchPreview() {
    const generateBtn = document.getElementById('generateWordsearch');
    if (generateBtn) {
      generateBtn.click();
    }
  }

  // Set up event listeners for auto-update
  const autoUpdateElements = [
    'wordsearchTitle',
    'wordsearchInstructions',
    'wordsearchWords',
    'wordsearchGridSize',
    'wordsearchCase',
    'wordsearchFont',
    'wordsearchTemplate',
    'wordsearchAllowDiagonals',
    'wordsearchAllowBackwards',
    'wordsearchSizeSlider',
    'wordsearchPositionSlider'
  ];

  autoUpdateElements.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      if (element.type === 'checkbox') {
        element.addEventListener('change', updateWordsearchPreview);
      } else if (element.type === 'range') {
        element.addEventListener('input', updateWordsearchPreview);
      } else {
        element.addEventListener('input', debounce(updateWordsearchPreview, 500));
      }
    }
  });

  // Debounce function to limit auto-updates
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Make functions globally available
  window.updateWordsearchPreview = updateWordsearchPreview;
  window.generateWordsearch = () => {
    document.getElementById('generateWordsearch').click();
  };

  console.log('Wordsearch generator ready!');
});
