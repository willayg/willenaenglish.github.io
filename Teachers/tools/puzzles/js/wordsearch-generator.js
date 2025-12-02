// Core generation logic & DOM integration for Wordsearch
// (split out from monolithic file)

export const worksheetTemplates = [
  {
    name: 'Classic',
    render: (data) => `
      <div class="worksheet-content" style="width:100%;display:flex;flex-direction:column;align-items:center;">
        <div class="worksheet-header" style="text-align:center;margin-bottom:30px;padding:20px;border-bottom:2px solid #333;width:100%;max-width:800px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">
            <img src="../../../Assets/Images/color-logo.png" alt="Willena" style="height:40px;" />
            <h2 style="margin:0;font-size:1.8em;font-weight:600;">${data.title || 'Wordsearch Puzzle'}</h2>
            <div style="min-width:220px;display:flex;justify-content:space-between;font-size:.9em;">
              <span>Name: _____________</span><span>Date: _____________</span>
            </div>
          </div>
          ${data.instructions ? `<p style="margin:10px 0;font-size:1.05em;color:#555;">${data.instructions}</p>` : ''}
        </div>
        <div class="worksheet-puzzle" style="width:100%;display:flex;flex-direction:column;align-items:center;">${data.puzzle || ''}</div>
      </div>`
  },
  {
    name: 'Modern',
    render: (data) => `
      <div class="worksheet-content" style="width:100%;display:flex;flex-direction:column;align-items:center;">
        <div class="worksheet-header" style="text-align:center;margin-bottom:30px;padding:25px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;border-radius:12px;width:100%;max-width:800px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">
            <img src="../../../Assets/Images/color-logo1.png" alt="Willena" style="height:40px;filter:brightness(0) invert(1);" />
            <h2 style="margin:0;font-size:1.8em;font-weight:600;">${data.title || 'Wordsearch Puzzle'}</h2>
            <div style="min-width:220px;display:flex;justify-content:space-between;font-size:.9em;">
              <span>Name: _____________</span><span>Date: _____________</span>
            </div>
          </div>
          ${data.instructions ? `<p style="margin:10px 0;font-size:1.05em;">${data.instructions}</p>` : ''}
        </div>
        <div class="worksheet-puzzle" style="width:100%;display:flex;flex-direction:column;align-items:center;">${data.puzzle || ''}</div>
      </div>`
  },
  {
    name: 'Simple',
    render: (data) => `
      <div class="worksheet-content" style="width:100%;display:flex;flex-direction:column;align-items:center;">
        <div class="worksheet-header" style="text-align:center;margin-bottom:30px;padding:15px;width:100%;max-width:800px;">
          <img src="../../../Assets/Images/color-logo.png" alt="Willena" style="height:40px;margin-bottom:8px;" />
          <h2 style="margin:0 0 10px;font-size:1.8em;font-weight:600;">${data.title || 'Wordsearch Puzzle'}</h2>
          ${data.instructions ? `<p style="margin:10px 0;font-size:1.05em;color:#555;">${data.instructions}</p>` : ''}
          <div style="display:flex;justify-content:center;gap:40px;margin-top:15px;font-size:.9em;">
            <span>Name: _____________</span><span>Date: _____________</span>
          </div>
        </div>
        <div class="worksheet-puzzle" style="width:100%;display:flex;flex-direction:column;align-items:center;">${data.puzzle || ''}</div>
      </div>`
  }
];

export function getFontInline(fontOpt) {
  switch (fontOpt) {
    case 'mono': return 'font-family:\'Courier New\',Courier,monospace !important;';
    case 'comic': return 'font-family:\'Comic Sans MS\',\'Comic Sans\',cursive,sans-serif !important;';
    case 'nanum': return 'font-family:\'Nanum Pen Script\',cursive !important;line-height:28px !important;padding-top:2px !important;';
    default: return 'font-family:\'Poppins\',Arial,sans-serif !important;';
  }
}

export function generateGrid(words, size, caseOpt, allowDiagonals, allowBackwards, placementsOut) {
  placementsOut.length = 0;
  const grid = Array.from({ length: size }, () => Array(size).fill(''));
  let directions = [ { dr:0, dc:1 }, { dr:1, dc:0 } ];
  if (allowDiagonals) directions.push({ dr:1, dc:1 }, { dr:1, dc:-1 });
  if (allowBackwards) {
    directions.push({ dr:0, dc:-1 }, { dr:-1, dc:0 });
    if (allowDiagonals) directions.push({ dr:-1, dc:1 }, { dr:-1, dc:-1 });
  }
  function canPlace(word, r, c, dr, dc) {
    for (let i=0;i<word.length;i++) {
      const rr = r + dr*i, cc = c + dc*i;
      if (rr<0||rr>=size||cc<0||cc>=size) return false;
      if (grid[rr][cc] && grid[rr][cc] !== word[i]) return false;
    }
    return true;
  }
  function placeWord(word) {
    for (let attempt=0; attempt<120; attempt++) {
      const dir = directions[Math.floor(Math.random()*directions.length)];
      const maxRow = size - Math.abs(dir.dr * (word.length - 1));
      const maxCol = size - Math.abs(dir.dc * (word.length - 1));
      const row = Math.floor(Math.random()*maxRow);
      const col = Math.floor(Math.random()*maxCol);
      if (canPlace(word,row,col,dir.dr,dir.dc)) {
        const placement = { word, positions: [] };
        for (let i=0;i<word.length;i++) {
          const rr = row + dir.dr*i, cc = col + dir.dc*i;
          grid[rr][cc] = word[i];
            placement.positions.push({ row: rr, col: cc });
        }
        placementsOut.push(placement);
        return true;
      }
    }
    return false;
  }
  const placed = [], unplaced = [];
  words.forEach(w => {
    if (w.length > size) { unplaced.push(w); return; }
    placeWord(w) ? placed.push(w) : unplaced.push(w);
  });
  const alphabet = (caseOpt==='upper' ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' : 'abcdefghijklmnopqrstuvwxyz');
  for (let r=0;r<size;r++) for (let c=0;c<size;c++) if (!grid[r][c]) grid[r][c] = alphabet[Math.floor(Math.random()*alphabet.length)];
  return { grid, placed, unplaced };
}

export function buildPuzzleHTML({ grid, placed, unplaced, fontOpt, sizeScale, position, caseOpt }) {
  const inlineFont = getFontInline(fontOpt);
  let html = `<div class="words-list" style="text-align:center;${inlineFont}font-size:1em;margin-bottom:8px;width:100%;"><strong>Words to find (${placed.length}):</strong> ${placed.join(', ')}</div>`;
  if (unplaced.length) {
    html += `<div class="unplaced-words" style="text-align:center;color:#b30000;font-size:.8em;margin-bottom:14px;"><strong>Not included (no space):</strong> ${unplaced.join(', ')}${unplaced.some(w=>w.length>grid.length)?'<br><em style="color:#d44;">(Some words are longer than the grid size)</em>':''}</div>`;
  }
  html += `<div class="wordsearch-wrapper" style="display:flex;flex-direction:column;align-items:center;width:100%;margin:20px 0;">` +
    `<div class="wordsearch-container" style="display:block;background:#fafaff;border:2.5px solid #b6aee0;border-radius:8px;padding:24px;margin:0 auto;margin-top:${position}px;box-shadow:0 2px 8px rgba(46,43,63,0.06);max-width:max-content;transform:scale(${sizeScale});transform-origin:center top;">` +
    `<table class="wordsearch-table" style="margin:0 auto;border-collapse:collapse;table-layout:fixed;aspect-ratio:1/1;width:100%;max-width:600px;height:auto;">` +
    grid.map((row,r) => `<tr>` + row.map((cell,c) => `<td data-row="${r}" data-col="${c}" style="aspect-ratio:1/1;width:calc(100%/${grid.length});height:auto;text-align:center;vertical-align:middle;border:1.5px solid #222;background:#fff;padding:0;box-sizing:border-box;font-size:1.1rem;line-height:1;${inlineFont}">${cell}</td>`).join('') + `</tr>`).join('') +
    `</table></div></div>`;
  return html;
}
