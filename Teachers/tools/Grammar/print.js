// Grammar Worksheet Print Handler
// Clean, reliable print functionality

function printWorksheet() {
  // Get the worksheet content
  const worksheetContent = document.getElementById('worksheetPreviewArea-grammar');
  if (!worksheetContent) {
    alert('No worksheet content to print');
    return;
  }

  // Get the actual worksheet HTML (the a4-sheet div)
  const worksheet = worksheetContent.querySelector('.a4-sheet');
  if (!worksheet) {
    alert('No worksheet found to print');
    return;
  }

  // Get font and font size from preview
  let font = 'Poppins';
  let fontSize = '12';
  const fontSelect = document.getElementById('fontSelect');
  const fontSizeInput = document.getElementById('fontSizeInput');
  if (fontSelect) font = fontSelect.value;
  if (fontSizeInput) fontSize = fontSizeInput.value;

  // Create a new window for printing
  const printWindow = window.open('', '_blank', 'width=800,height=600');

  // Write the print document
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Grammar Worksheet</title>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=Caveat:wght@400;500;600;700&display=swap" rel="stylesheet">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: '${font}', 'Poppins', sans-serif;
          background: #fff;
          margin: 0;
          padding: 10mm 5mm;
          font-size: ${fontSize}px;
        }

        .worksheet-container {
          width: 100%;
          max-width: 210mm;
          margin: 0 auto;
          background: #fff;
        }

        /* Two-column layout */
        .two-column {
          column-count: 2;
          column-gap: 40px;
          column-fill: balance;
        }

        /* Prevent header and answer key from being split by columns */
        .worksheet-header, .answer-key-section {
          column-span: all;
          break-inside: avoid;
          page-break-inside: avoid;
        }

        /* Keep worksheet content together */
        .worksheet-container {
          break-inside: avoid;
          page-break-inside: avoid;
        }

        /* Make sure sections don't break across columns */
        .grammar-questions, .section-box {
          break-inside: avoid;
          page-break-inside: avoid;
          margin-bottom: 15px;
        }

        /* Answer key on new page - only if there's content */
        .answer-key-section {
          margin-top: 50px;
        }

        /* Only break to new page if answer key has actual content */
        .answer-key-section:not(:empty) {
          break-before: page;
          page-break-before: always;
        }

        /* Print: All box designs have white background and neutral border */
        .section-box.design-0,
        .section-box.design-1,
        .section-box.design-2 {
          background: #fff !important;
          border: 2px solid #e0e0e0 !important;
          box-shadow: none !important;
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

        /* Header styling - match preview exactly and prevent breaking */
        .worksheet-header {
          border-bottom: 2px solid #d3d3d3;
          padding-bottom: 12px;
          margin-bottom: 20px;
          break-inside: avoid;
          page-break-inside: avoid;
          display: block !important;
        }

        /* Ensure header content stays together */
        .worksheet-header * {
          break-inside: avoid;
          page-break-inside: avoid;
        }

        /* All design headers have the same line styling */
        .design-0 .worksheet-header,
        .design-1 .worksheet-header,
        .design-2 .worksheet-header,
        .design-3 .worksheet-header,
        .design-4 .worksheet-header {
          border-bottom: 2px solid #d3d3d3;
          padding-bottom: 12px;
          margin-bottom: 18px;
          break-inside: avoid;
          page-break-inside: avoid;
        }

        /* Make sure text is readable */
        .grammar-questions {
          white-space: pre-line;
          line-height: 2.1;
          margin-bottom: 16px;
        }

        /* Ensure images print */
        img {
          max-width: 100px;
        }

        @page {
          margin: 15mm 10mm;
          size: A4;
        }

        @page :first {
          margin: 15mm 10mm;
        }
      </style>
    </head>
    <body>
      <div class="worksheet-container">
        ${worksheet.innerHTML}
      </div>
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
