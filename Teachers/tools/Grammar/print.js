// Grammar Worksheet Print Handler
// Clean, reliable print functionality

function printWorksheet() {
  // Use the same content generation as preview
  let worksheetHTML;
  if (typeof window.createGrammarPreview === 'function') {
    worksheetHTML = window.createGrammarPreview();
  } else {
    // Fallback: get existing preview content
    const worksheetContent = document.getElementById('worksheetPreviewArea-grammar');
    if (!worksheetContent) {
      alert('No worksheet content to print');
      return;
    }
    const worksheet = worksheetContent.querySelector('.a4-sheet');
    if (!worksheet) {
      alert('No worksheet found to print');
      return;
    }
    worksheetHTML = worksheet.outerHTML;
  }

  // Check if we got valid HTML
  if (!worksheetHTML || worksheetHTML.includes('undefined')) {
    alert('Error: Invalid worksheet content generated');
    return;
  }

  // Get font and font size from controls
  let font = 'Poppins';
  let fontSize = '12';
  const fontSelect = document.getElementById('fontSelect');
  const fontSizeInput = document.getElementById('fontSizeInput');
  if (fontSelect) font = fontSelect.value;
  if (fontSizeInput) fontSize = fontSizeInput.value;

  // Create a new window for printing
  const printWindow = window.open('', '_blank', 'width=800,height=600');

  // Process the worksheet HTML to format multiple choice options like preview (options under question, on one line)
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = worksheetHTML;
  const questionDivs = tempDiv.querySelectorAll('.grammar-questions');
  questionDivs.forEach(div => {
    // For each line, if it looks like a question with options (e.g., "Question text\na) ... b) ... c) ..."),
    // move the options to a single line below the question.
    div.innerHTML = div.innerHTML.replace(/([^\n]*)(\n|<br\s*\/?>)?\s*([a-h]\)[^<\n]*)/gi, function(match, question, br, options) {
      // Keep all options on one line, separated by spaces
      return question + '<br><span style="margin-left:18px;display:inline-block;">' + options.replace(/\s+/g, ' ') + '</span>';
    });
  });
  worksheetHTML = tempDiv.innerHTML;

  // Write the print document with same styles as preview
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Grammar Worksheet</title>
      <link rel="stylesheet" href="../tests/style.css">
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=Caveat:wght@400;500;600;700&display=swap" rel="stylesheet">
      <style>
        body {
          font-family: '${font}', 'Poppins', sans-serif;
          background: #fff;
          margin: 0;
          padding: 10mm 5mm;
          font-size: ${fontSize}px;
        }

        /* A4 worksheet sizing for print */
        .a4-sheet {
          width: 100%;
          max-width: 210mm;
          margin: 0 auto;
          background: #fff;
          box-shadow: none;
        }

        /* Two-column worksheet layout */
        .two-column {
          column-count: 2;
          column-gap: 40px;
          column-fill: balance;
          height: auto;
        }

        /* Prevent header and answer key from being split by columns */
        .worksheet-header, .answer-key-section {
          column-span: all;
        }

        /* Make sure section boxes don't break across columns */
        .section-box, .grammar-questions {
          margin-bottom: 15px;
        }

        /* Worksheet section box styles - same as preview */
        .section-box.design-0 {
          background: #ffffff;
          border: 2px solid #ffe08a;
          box-shadow: none;
        }
        .section-box.design-1 {
          background: #ffffff;
          border: 2px solid #a3d1ff;
          box-shadow: none;
        }
        .section-box.design-2 {
          background: #ffffff;
          border: 2px solid #c7bfff;
          box-shadow: none;
        }
        .section-box {
          width: 100%;
          box-sizing: border-box;
          border-radius: 8px;
          margin-bottom: 24px;
          padding: 24px 20px 20px 20px;
          display: block;
        }

        /* Line between sections for design-4 */
        .line-section {
          border-bottom: 2px solid #bdbdbd;
          margin-bottom: 24px;
          padding-bottom: 18px;
        }

        .grammar-questions {
          white-space: pre-line;
          margin-bottom: 16px;
          line-height: 1.6;
          font-size: 1em;
        }

        /* Format multiple choice options horizontally like preview */
        .grammar-questions {
          word-spacing: 0.5em;
        }

        /* Header styles - match preview exactly */
        .design-3 .worksheet-header,
        .design-4 .worksheet-header {
          border-bottom: 2px solid #d3d3d3;
          padding-bottom: 12px;
          margin-bottom: 30px;
        }

        /* Increase spacing between header and content for all designs */
        .worksheet-header {
          margin-bottom: 30px;
        }

        /* Header box for boxed designs */
        .header-box {
          background: #fff;
          border: 2px solid #ffe08a;
          border-radius: 8px;
          padding: 18px 18px 10px 18px;
          margin-bottom: 24px;
        }
        .design-1 .header-box {
          border: 2px solid #a3d1ff;
        }
        .design-2 .header-box {
          border: 2px solid #c7bfff;
        }
        .design-3 {
          background: #fff;
          border: none;
          box-shadow: none;
        }
        .design-4 {
          background: #fff;
          border: none;
          box-shadow: none;
        }

        /* Answer key spacing */
        .answer-key-section {
          margin-top: 18px;
          page-break-before: always;
          break-before: page;
        }

        /* Ensure images print */
        img {
          max-width: 80px;
        }

        @page {
          margin: 15mm 10mm;
          size: A4;
        }
      </style>
    </head>
    <body>
      ${worksheetHTML}
    </body>
    </html>
  `);

  printWindow.document.close();

  // Wait for content to load, then print
  printWindow.onload = function() {
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };
}

// Export for use in other files
window.printWorksheet = printWorksheet;
