// Printing module for Wordsearch
// Exports initPrintControls which wires up print & PDF buttons

export function initPrintControls(options = {}) {
  const {
    printButtonId = 'printBtn',
    pdfButtonId = 'pdfBtn',
    previewSelector = '#worksheetPreviewArea-wordsearch',
    highlightSelector = '.wordsearch-table td'
  } = options;

  const printBtn = document.getElementById(printButtonId);
  const pdfBtn = document.getElementById(pdfButtonId);

  function buildPrintableHTML(previewEl, { answersBlue = false } = {}) {
    // Clone to avoid mutating live DOM
    const clone = previewEl.cloneNode(true);

    if (answersBlue) {
      // Convert any yellow highlighted cells to blue text only
      const highlighted = clone.querySelectorAll(
        '.wordsearch-table td[style*="ffeb3b"], .wordsearch-table td[style*="rgb(255, 235, 59)"]'
      );
      highlighted.forEach(td => {
        td.style.backgroundColor = 'transparent';
        td.style.color = '#0a55c5';
        td.style.fontWeight = '700';
        td.style.textDecoration = 'underline';
      });
    }

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Wordsearch Worksheet</title>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=Caveat:wght@400;500;600;700&family=Nanum+Pen+Script&display=swap" rel="stylesheet">
<style>
  body { font-family: 'Poppins', Arial, sans-serif; margin: 20px; }
  .wordsearch-table { border-collapse: collapse; margin: 20px auto; }
  .wordsearch-table td { border:1px solid #333; width:2.1em; height:2.1em; text-align:center; font-weight:600; }
  @media print { body { margin:0; } }
</style>
</head>
<body>
${clone.innerHTML}
<script>window.onload = function(){ window.print(); }<\/script>
</body>
</html>`;
  }

  function openDoc(html) {
    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
  }

  if (printBtn) {
    printBtn.addEventListener('click', () => {
      const preview = document.querySelector(previewSelector);
      if (!preview || !preview.innerHTML.trim()) {
        alert('Generate a wordsearch first.');
        return;
      }
      // If answers currently shown (yellow background present), print with blue answers
      const answersVisible = !!preview.querySelector('.wordsearch-table td[style*="ffeb3b"]');
      openDoc(buildPrintableHTML(preview, { answersBlue: answersVisible }));
    });
  }

  if (pdfBtn) {
    pdfBtn.addEventListener('click', () => {
      const preview = document.querySelector(previewSelector);
      if (!preview || !preview.innerHTML.trim()) {
        alert('Generate a wordsearch first.');
        return;
      }
      openDoc(buildPrintableHTML(preview, { answersBlue: false }));
    });
  }
}
