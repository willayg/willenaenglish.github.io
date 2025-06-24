document.addEventListener('DOMContentLoaded', () => {  // PRINT WORKSHEET
  const printBtn = document.getElementById('printWorksheetBtn');
  if (printBtn) {
    printBtn.onclick = () => {
      // Find the visible worksheet preview
      const previewArea = document.querySelector('.worksheet-preview:not(.hidden)');
      if (!previewArea) return;      // Get current font settings from the active tool panel
      let fontFamily = "'Poppins', sans-serif";
      let fontSizeScale = 1;
      
      // Check which panel is active and get its font settings
      const activePanel = document.querySelector('.tool-panel:not(.hidden)');
      if (activePanel) {
        const fontSelect = activePanel.querySelector('[id$="Font"]');
        const fontSizeSelect = activePanel.querySelector('[id$="FontSize"]');
        
        if (fontSelect) {
          const fontValue = fontSelect.value;
          // Handle wordsearch font options
          if (fontValue === 'mono') fontFamily = "'Courier New', Courier, monospace";
          else if (fontValue === 'comic') fontFamily = "'Comic Sans MS', Comic Sans, cursive, sans-serif";
          else if (fontValue === 'nanum') fontFamily = "'Nanum Pen Script', cursive";
          else if (fontValue === 'sans') fontFamily = "'Poppins', Arial, sans-serif";
          else fontFamily = fontValue; // For reading/other tools
        }
        if (fontSizeSelect) fontSizeScale = parseFloat(fontSizeSelect.value);
      }
      
      // Get the actual computed styles from the preview element for more accuracy
      const computedStyle = window.getComputedStyle(previewArea);
      const actualFontSize = computedStyle.fontSize; // This will be in px
      
      // Use the computed font size if available, otherwise fall back to scale calculation
      let fontSize = actualFontSize || `${16 * fontSizeScale}px`;
      
      const currentTransform = computedStyle.transform;
      
      // Create a temporary full-size version for printing that matches preview exactly
      const printContent = previewArea.cloneNode(true);
      
      // Calculate the current scale from transform
      let scale = 1;
      if (currentTransform && currentTransform !== 'none') {
        const matrix = currentTransform.match(/matrix\(([^)]+)\)/);
        if (matrix) {
          const values = matrix[1].split(',').map(parseFloat);
          scale = values[0]; // First value is scaleX
        }
      }
        // Apply the same scale to print to match preview
      const printContents = `
        <div style="width:794px;min-height:1123px;margin:auto;background:#fff;page-break-after:always;transform:scale(${scale});transform-origin:top left;font-family:${fontFamily};font-size:${fontSize};">
          ${printContent.innerHTML}
        </div>
      `;
      const win = window.open('', '', 'width=900,height=1200');
      win.document.write(`
        <html>
          <head>
            <title>Print Worksheet</title>
            <!-- Google Fonts -->
            <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500&display=swap" rel="stylesheet">
            <link href="https://fonts.googleapis.com/css2?family=Nanum+Pen+Script&display=swap" rel="stylesheet">
            <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400&display=swap" rel="stylesheet">
            <link href="https://fonts.googleapis.com/css2?family=Nanum+Gothic:wght@400&display=swap" rel="stylesheet">
            <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400&display=swap" rel="stylesheet">
            <link href="https://fonts.googleapis.com/css2?family=Comic+Sans+MS&display=swap" rel="stylesheet">            <style>              body { 
                background: #fff; 
                margin: 0; 
                padding: 0; 
                font-family: ${fontFamily};
                font-size: ${fontSize};
                line-height: 1.6;
              }
              * {
                font-family: inherit;
                font-size: inherit;
                box-sizing: border-box;
              }
              /* Preserve exact spacing and styling from preview */
              p {
                line-height: 1.6;
                margin-bottom: 10px;
              }
              div {
                line-height: 1.6;
              }              /* Reading passage specific styling */
              div[style*="line-height: 1.6"] {
                line-height: 1.6 !important;
              }
              div[style*="padding: 15px"] {
                padding: 15px !important;
                margin-bottom: 20px !important;
                background: #f9f9f9 !important;
              }
              /* Simple line breaks for passage text */
              br {
                line-height: 1.6;
              }
              /* Question spacing */
              div[style*="margin-bottom: 18px"] {
                margin-bottom: 18px !important;
              }
              div[style*="margin-bottom: 8px"] {
                margin-bottom: 8px !important;
              }
              div[style*="margin-left: 20px"] {
                margin-left: 20px !important;
                line-height: 1.8 !important;
              }
              .wordsearch-font-sans { font-family: 'Poppins', Arial, sans-serif; }
              .wordsearch-font-mono { font-family: 'Courier New', Courier, monospace; }
              .wordsearch-font-comic { font-family: 'Comic Sans MS', Comic Sans, cursive, sans-serif; }
              .wordsearch-font-nanum { font-family: 'Nanum Pen Script', cursive; }
              .wordsearch-table {
                margin: 0 auto;
                border-collapse: collapse;
              }              .wordsearch-table td {
                width: 32px;
                height: 32px;
                text-align: center;
                vertical-align: middle;
                border: 1.5px solid #222;
                background: #fff;
                padding: 0;
                box-sizing: border-box;
                font-size: 1.1rem;
                line-height: 32px;
                margin: 0;
                display: table-cell;
              }
              .wordsearch-table td * {
                line-height: 32px;
                text-align: center;
                vertical-align: middle;
              }              /* Ensure consistent baseline for all wordsearch fonts */
              .wordsearch-table .wordsearch-font-sans,
              .wordsearch-table .wordsearch-font-mono,
              .wordsearch-table .wordsearch-font-comic,
              .wordsearch-table .wordsearch-font-nanum,
              .wordsearch-table .wordsearch-font-poppins {
                line-height: 32px;
                text-align: center;
                vertical-align: middle;
                font-size: 1.1rem;
              }
              /* Special handling for Nanum Pen Script which may have different baseline */
              .wordsearch-table .wordsearch-font-nanum {
                line-height: 28px; /* Slightly adjust for this font */
                padding-top: 2px;  /* Fine-tune vertical position */
              }
              table {
                border-collapse: collapse;
              }
              h1, h2, h3, h4, h5, h6 {
                font-family: inherit;
                font-size: inherit;
                line-height: 1.4;
                margin-bottom: 10px;
              }
              div, p, span, strong {
                font-family: inherit;
                font-size: inherit;
              }
              @media print {
                body { 
                  background: #fff; 
                  -webkit-print-color-adjust: exact;
                  color-adjust: exact;
                  line-height: 1.6;
                }
                div { box-shadow: none !important; }
                p { line-height: 1.6 !important; }
                @page {
                  margin: 0.5in;
                  size: A4;
                }
              }
            </style>
          </head>
          <body onload="window.print();">
            ${printContents}
          </body>
        </html>
      `);
      win.document.close();
    };
  }
  // DOWNLOAD WORKSHEET AS PDF
  const pdfBtn = document.getElementById('downloadWorksheetPdfBtn');
  if (pdfBtn) {
    pdfBtn.onclick = async () => {
      const preview = document.querySelector('.worksheet-preview:not(.hidden)');
      if (!preview) return;
      
      // Create a temporary container for PDF generation at full size
      const tempContainer = document.createElement('div');
      tempContainer.style.position = 'fixed';
      tempContainer.style.top = '-9999px';
      tempContainer.style.left = '-9999px';
      tempContainer.style.width = '794px';
      tempContainer.style.minHeight = '1123px';
      tempContainer.style.background = '#fff';
      tempContainer.style.transform = 'none';
      tempContainer.style.zoom = '1';
      tempContainer.innerHTML = preview.innerHTML;
      document.body.appendChild(tempContainer);
      
      try {
        // Wait for fonts and images to load
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Capture at full resolution
        const canvas = await html2canvas(tempContainer, { 
          scale: 2, 
          backgroundColor: "#fff", 
          useCORS: true,
          width: 794,
          height: tempContainer.scrollHeight,
          logging: false
        });
        
        const imgData = canvas.toDataURL('image/png');
        const pdf = new window.jspdf.jsPDF({
          orientation: 'portrait',
          unit: 'pt',
          format: 'a4'
        });
        
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = pageWidth;
        const imgHeight = canvas.height * (imgWidth / canvas.width);

        let position = 0;
        let pageNumber = 1;
        
        // Add pages if content is taller than one page
        while (position < imgHeight) {
          if (pageNumber > 1) {
            pdf.addPage();
          }
          
          pdf.addImage(
            imgData,
            'PNG',
            0,
            -position,
            imgWidth,
            imgHeight
          );
          
          position += pageHeight;
          pageNumber++;
        }
        
        // Get worksheet title for naming
        let worksheetTitle = 'worksheet';
        const activePanel = document.querySelector('.tool-panel:not(.hidden)');
        if (activePanel) {
          const titleInput = activePanel.querySelector('[id$="Title"]');
          if (titleInput && titleInput.value.trim()) {
            worksheetTitle = titleInput.value.trim().replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '-');
          }
        }
        
        pdf.save(`${worksheetTitle}.pdf`);
      } finally {
        // Clean up temporary container
        document.body.removeChild(tempContainer);
      }
    };
  }

  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // Hide all tool panels
      document.querySelectorAll('.tool-panel').forEach(panel => {
        panel.classList.add('hidden');
      });

      // Hide all worksheet previews
      document.querySelectorAll('.worksheet-preview').forEach(preview => {
        preview.classList.add('hidden');
      });

      // Remove active from all buttons
      document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));

      // Show the selected panel
      const panelId = btn.dataset.panel;
      const panel = document.getElementById('panel-' + panelId);
      if (panel) {
        panel.classList.remove('hidden');
        btn.classList.add('active');
      }
    });
  });

  function getCurrentWorksheetData() {
    // --- WORD TEST ---
    if (!document.getElementById('panel-tests').classList.contains('hidden')) {
      return {
        worksheet_type: 'wordtest',
        title: document.getElementById('wordTestTitle')?.value || "",
        passage_text: document.getElementById('wordTestPassage')?.value || "",
        words: document.getElementById('wordTestWords')?.value
          ? document.getElementById('wordTestWords').value.split('\n').map(w => w.trim()).filter(w => w)
          : [],
        settings: {
          font: document.getElementById('wordTestFont')?.value || "",
          font_size: document.getElementById('wordTestFontSize')?.value || "",
          layout: document.getElementById('wordTestLayout')?.value || "",
          template: document.getElementById('wordTestTemplate')?.value || "",
          num_words: document.getElementById('wordTestNumWords')?.value || "",
          image_type: document.getElementById('pixabayImageType')?.value || "",
          test_mode: document.getElementById('wordTestMode')?.value || ""
        }
      };
    }    // --- WORDSEARCH ---
    if (!document.getElementById('panel-wordsearch').classList.contains('hidden')) {
      return {
        worksheet_type: 'wordsearch',
        title: document.getElementById('wordsearchTitle')?.value || "",
        words: document.getElementById('wordsearchWords')?.value
          ? document.getElementById('wordsearchWords').value.split('\n').map(w => w.trim()).filter(w => w)
          : [],
        settings: {
          grid_size: document.getElementById('wordsearchGridSize')?.value || 12,
          letter_case: document.getElementById('wordsearchCase')?.value || "upper",
          font: document.getElementById('wordsearchFont')?.value || "sans",
          puzzle_size: document.getElementById('wordsearchSize')?.value || "1",
          template: document.getElementById('wordsearchTemplate')?.value || "0",
          hints_alignment: document.getElementById('wordsearchHintsAlign')?.value || "top"
        }
      };
    }
    // --- READING ---
    if (!document.getElementById('panel-reading').classList.contains('hidden')) {
      return {
        worksheet_type: 'reading',
        title: document.getElementById('readingTitle')?.value || "",
        passage_text: document.getElementById('readingPassage')?.value || "",
        questions: document.getElementById('readingQuestions')?.value || "",
        settings: {
          font: document.getElementById('readingFont')?.value || "",
          font_size: document.getElementById('readingFontSize')?.value || "",
          template: document.getElementById('readingTemplate')?.value || "0",
          num_questions: document.getElementById('readingNumQuestions')?.value || "",
          question_format: document.getElementById('readingQuestionFormat')?.value || "",
          categories: {
            comprehension: document.getElementById('categoryComprehension')?.checked || false,
            vocabulary: document.getElementById('categoryVocabulary')?.checked || false,
            grammar: document.getElementById('categoryGrammar')?.checked || false,
            inference: document.getElementById('categoryInference')?.checked || false,
            main_idea: document.getElementById('categoryMainIdea')?.checked || false
          }
        }
      };
    }
    return {};
  }
  window.getCurrentWorksheetData = getCurrentWorksheetData;

  if (window.opener && typeof window.opener.getCurrentWorksheetData === 'function') {
    const worksheet = window.opener.getCurrentWorksheetData();
    // ... continue
  } else {
    alert("Cannot access worksheet data from the main window.");
  }

  window.loadWorksheet = function(worksheet) {
    if (worksheet.worksheet_type === 'wordsearch') {
      // Activate the wordsearch panel
      document.querySelectorAll('.tool-panel').forEach(panel => panel.classList.add('hidden'));
      document.getElementById('panel-wordsearch').classList.remove('hidden');
      document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
      document.querySelector('.tool-btn[data-panel="wordsearch"]').classList.add('active');

      // Fill fields using the correct property names
      document.getElementById('wordsearchTitle').value = worksheet.title || "";
      document.getElementById('wordsearchWords').value = (worksheet.words || []).join('\n');
      const s = worksheet.settings || {};
      document.getElementById('wordsearchGridSize').value = s.grid_size || "12";
      document.getElementById('wordsearchCase').value = s.letter_case || "upper";
      document.getElementById('wordsearchFont').value = s.font || "sans";
      document.getElementById('wordsearchSize').value = s.puzzle_size || "1";      document.getElementById('wordsearchTemplate').value = s.template || "0";
      document.getElementById('wordsearchHintsAlign').value = s.hints_alignment || "top";

      // Switch to the correct preview area
      document.querySelectorAll('.worksheet-preview').forEach(preview => {
        preview.classList.add('hidden');
      });
      document.getElementById('worksheetPreviewArea-wordsearch').classList.remove('hidden');

      // Immediately generate the worksheet preview
      if (typeof window.generateWordsearch === 'function') window.generateWordsearch();
    } else if (worksheet.worksheet_type === 'wordtest') {
      // Show the word test panel
      document.querySelectorAll('.tool-panel').forEach(panel => panel.classList.add('hidden'));
      document.getElementById('panel-tests').classList.remove('hidden');
      document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
      document.querySelector('.tool-btn[data-panel="tests"]').classList.add('active');

      // Fill fields
      document.getElementById('wordTestTitle').value = worksheet.title || "";
      document.getElementById('wordTestPassage').value = worksheet.passage_text || "";
      document.getElementById('wordTestWords').value = (worksheet.words || []).join('\n');      // Settings (if present)
      const s = worksheet.settings || {};
      document.getElementById('wordTestFont').value = s.font || "";
      document.getElementById('wordTestFontSize').value = s.font_size || "";
      document.getElementById('wordTestLayout').value = s.layout || "";
      document.getElementById('wordTestTemplate').value = s.template || "";
      document.getElementById('wordTestNumWords').value = s.num_words || "";
      document.getElementById('pixabayImageType').value = s.image_type || "";
      document.getElementById('wordTestMode').value = s.test_mode || "";

      // Switch to the correct preview area
      document.querySelectorAll('.worksheet-preview').forEach(preview => {
        preview.classList.add('hidden');
      });
      document.getElementById('worksheetPreviewArea-tests').classList.remove('hidden');

      // Trigger the preview update after a short delay to ensure all fields are populated
      setTimeout(() => {
        if (window.updateWordTestPreview && typeof window.updateWordTestPreview === 'function') {
          window.updateWordTestPreview();        }
      }, 100);
    } else if (worksheet.worksheet_type === 'reading') {
      // Show the reading panel
      document.querySelectorAll('.tool-panel').forEach(panel => panel.classList.add('hidden'));
      document.getElementById('panel-reading').classList.remove('hidden');
      document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
      document.querySelector('.tool-btn[data-panel="reading"]').classList.add('active');

      // Fill fields
      document.getElementById('readingTitle').value = worksheet.title || "";
      document.getElementById('readingPassage').value = worksheet.passage_text || "";
      document.getElementById('readingQuestions').value = worksheet.questions || "";

      // Settings (if present)
      const s = worksheet.settings || {};
      document.getElementById('readingFont').value = s.font || "";
      document.getElementById('readingFontSize').value = s.font_size || "";
      document.getElementById('readingTemplate').value = s.template || "";
      document.getElementById('readingNumQuestions').value = s.num_questions || "";
      document.getElementById('readingQuestionFormat').value = s.question_format || "";
      
      // Categories
      const categories = s.categories || {};
      document.getElementById('categoryComprehension').checked = categories.comprehension || false;
      document.getElementById('categoryVocabulary').checked = categories.vocabulary || false;
      document.getElementById('categoryGrammar').checked = categories.grammar || false;
      document.getElementById('categoryInference').checked = categories.inference || false;
      document.getElementById('categoryMainIdea').checked = categories.main_idea || false;

      // Switch to the correct preview area
      document.querySelectorAll('.worksheet-preview').forEach(preview => {
        preview.classList.add('hidden');
      });
      document.getElementById('worksheetPreviewArea-reading').classList.remove('hidden');

      // Trigger preview update
      setTimeout(() => {
        if (window.updateReadingPreview && typeof window.updateReadingPreview === 'function') {
          window.updateReadingPreview();
        }
      }, 100);
    }
    // Add more types as needed
  };
});

