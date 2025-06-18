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

  const output = document.getElementById('crossworkdOutput');
  if (output) {
    output.innerHTML = html;
  }
});