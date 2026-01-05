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
      
      // Fix "2 Lists (Side by Side)" layout alignment
      const twoListsTables = printContent.querySelectorAll('table.two-lists-table');
      twoListsTables.forEach(table => {
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        table.style.tableLayout = 'fixed';
        
        // Ensure column widths are consistent
        const colgroups = table.querySelectorAll('colgroup col');
        const widths = ['8%', '27%', '27%', '3%', '8%', '27%'];
        colgroups.forEach((col, index) => {
          if (widths[index]) {
            col.style.width = widths[index];
          }
        });
      });

      // Fix Picture Test layout images to stay within table cell bounds
      const pictureTestImages = printContent.querySelectorAll('img.picture-test-img');
      pictureTestImages.forEach(img => {
        img.style.maxWidth = '100%';
        img.style.width = '80px';
        img.style.height = '80px';
        img.style.objectFit = 'cover';
        img.style.display = 'block';
        img.style.margin = '0 auto';
        img.style.boxSizing = 'border-box';
      });
      
      // Ensure Picture Test table cells don't overflow
      const pictureTestCellsOld = printContent.querySelectorAll('td');
      pictureTestCellsOld.forEach(td => {
        if (td.querySelector('img.picture-test-img')) {
          td.style.overflow = 'hidden';
          td.style.boxSizing = 'border-box';
          td.style.verticalAlign = 'middle';
        }
      });
      
      // Fix "With Images" layout for print consistency
      const withImagesImages = printContent.querySelectorAll('img.with-images-img');
      withImagesImages.forEach(img => {
        img.style.maxWidth = '85%';
        img.style.maxHeight = '50px';
        img.style.width = 'auto';
        img.style.height = 'auto';
        img.style.objectFit = 'cover';
        img.style.display = 'block';
        img.style.margin = '2px auto';
        img.style.boxSizing = 'border-box';
        img.style.borderRadius = '3px';
        img.style.border = '1px solid #ccc';
      });
      
      // Ensure "With Images" table cells have proper alignment and padding
      const withImagesCells = printContent.querySelectorAll('.with-images-cell, .with-images-text, .with-images-number');
      withImagesCells.forEach(cell => {
        cell.style.verticalAlign = 'middle';
        cell.style.textAlign = 'center';
        cell.style.boxSizing = 'border-box';
        cell.style.overflow = 'hidden';
        
        if (cell.classList.contains('with-images-text')) {
          cell.style.lineHeight = '1.3';
          cell.style.wordBreak = 'break-word';
          cell.style.paddingLeft = '8px';
          cell.style.paddingRight = '8px';
        }
        
        if (cell.classList.contains('with-images-number')) {
          cell.style.fontSize = '0.85em';
        }
      });
      
      // Ensure "With Images" table rows have consistent height
      const withImagesRows = printContent.querySelectorAll('.with-images-row');
      withImagesRows.forEach(row => {
        row.style.minHeight = '60px';
        row.style.height = 'auto';
      });
      
      // Fix "Picture List" layout for print consistency
      const pictureListImages = printContent.querySelectorAll('img.picture-list-img');
      pictureListImages.forEach(img => {
        img.style.maxWidth = '85%';
        img.style.maxHeight = '90px';
        img.style.width = 'auto';
        img.style.height = 'auto';
        img.style.objectFit = 'cover';
        img.style.display = 'block';
        img.style.margin = '0 auto';
        img.style.boxSizing = 'border-box';
        img.style.borderRadius = '8px';
        img.style.border = '2px solid #ddd';
        img.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
      });
      
      // Ensure Picture List table cells have proper formatting
      const pictureListCells = printContent.querySelectorAll('.picture-list-image-cell, .picture-list-text, .picture-list-number');
      pictureListCells.forEach(cell => {
        cell.style.verticalAlign = 'middle';
        cell.style.boxSizing = 'border-box';
        cell.style.padding = '15px 8px';
        
        if (cell.classList.contains('picture-list-text')) {
          cell.style.textAlign = 'center';
          cell.style.lineHeight = '1.4';
          cell.style.wordBreak = 'break-word';
          cell.style.paddingLeft = '12px';
          cell.style.paddingRight = '12px';
          cell.style.fontSize = '1.1em';
          cell.style.fontWeight = '500';
        }
        
        if (cell.classList.contains('picture-list-number')) {
          cell.style.textAlign = 'center';
          cell.style.fontSize = '1.1em';
          cell.style.fontWeight = '500';
        }
        
        if (cell.classList.contains('picture-list-image-cell')) {
          cell.style.textAlign = 'center';
        }
      });
      
      // Ensure Picture List table rows have proper spacing and avoid page breaks
      const pictureListRows = printContent.querySelectorAll('.picture-list-row');
      pictureListRows.forEach(row => {
        row.style.minHeight = '120px';
        row.style.height = 'auto';
        row.style.pageBreakInside = 'avoid';
      });
      
      // Calculate the current scale from transform
      let scale = 1;
      if (currentTransform && currentTransform !== 'none') {
        const matrix = currentTransform.match(/matrix\(([^)]+)\)/);
        if (matrix) {
          const values = matrix[1].split(',').map(parseFloat);
          scale = values[0]; // First value is scaleX
        }
      }
      
      // Check if this is a multi-page worksheet
      const isMultiPage = printContent.querySelector('.multi-page-worksheet');
      
      let printContents;
      if (isMultiPage) {
        // For multi-page worksheets, don't apply transform scaling
        printContents = `
          <div style="font-family:${fontFamily};font-size:${fontSize};">
            ${printContent.innerHTML}
          </div>
        `;
      } else {
        // Apply the same scale to print to match preview for single-page worksheets
        printContents = `
          <div style="width:794px;min-height:1123px;margin:auto;background:#fff;page-break-after:always;transform:scale(${scale});transform-origin:top left;font-family:${fontFamily};font-size:${fontSize};">
            ${printContent.innerHTML}
          </div>
        `;
      }
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
                width: 32px !important;
                height: 32px !important;
                text-align: center !important;
                vertical-align: middle !important;
                border: 1.5px solid #222 !important;
                background: #fff !important;
                padding: 0 !important;
                box-sizing: border-box !important;
                font-size: 1.1rem !important;
                line-height: 32px !important;
                margin: 0 !important;
                display: table-cell !important;
              }
              .wordsearch-table td * {
                line-height: 32px !important;
                text-align: center !important;
                vertical-align: middle !important;
              }              /* Ensure consistent baseline for all wordsearch fonts */
              .wordsearch-table .wordsearch-font-sans,
              .wordsearch-table .wordsearch-font-mono,
              .wordsearch-table .wordsearch-font-comic,
              .wordsearch-table .wordsearch-font-nanum,
              .wordsearch-table .wordsearch-font-poppins {
                line-height: 32px !important;
                text-align: center !important;
                vertical-align: middle !important;
                font-size: 1.1rem !important;
                width: 32px !important;
                height: 32px !important;
                border: 1.5px solid #222 !important;
                background: #fff !important;
                padding: 0 !important;
                box-sizing: border-box !important;
                margin: 0 !important;
                display: table-cell !important;
              }
              
              /* Font family definitions */
              .wordsearch-table .wordsearch-font-sans {
                font-family: 'Poppins', Arial, sans-serif !important;
              }
              .wordsearch-table .wordsearch-font-mono {
                font-family: 'Courier New', Courier, monospace !important;
              }
              .wordsearch-table .wordsearch-font-comic {
                font-family: 'Comic Sans MS', Comic Sans, cursive, sans-serif !important;
              }
              .wordsearch-table .wordsearch-font-nanum {
                font-family: 'Nanum Pen Script', cursive !important;
              }
              .wordsearch-table .wordsearch-font-poppins {
                font-family: 'Poppins', Arial, sans-serif !important;
              }
              
              /* Special handling for Nanum Pen Script which may have different baseline */
              .wordsearch-table .wordsearch-font-nanum {
                line-height: 28px !important; /* Slightly adjust for this font */
                padding-top: 2px !important;  /* Fine-tune vertical position */
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
        
        // Check if this is a multi-page worksheet
        const isMultiPage = tempContainer.querySelector('.multi-page-worksheet');
          if (isMultiPage) {
          // Handle multi-page PDF generation
          await generateMultiPagePDF(tempContainer, getWorksheetTitle());
        } else {
          // Handle single-page PDF generation
          await generateSinglePagePDF(tempContainer, getWorksheetTitle());
        }
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
      
      // Update answer key button visibility
      updateAnswerKeyButtonVisibility();
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
          puzzle_size: document.getElementById('wordsearchSize')?.value || "1.0",
          template: document.getElementById('wordsearchTemplate')?.value || "0",
          hints_alignment: document.getElementById('wordsearchHintsAlign')?.value || "top"
        }
      };
    }    // --- READING ---
    if (!document.getElementById('panel-reading').classList.contains('hidden')) {
      return {
        worksheet_type: 'reading',
        title: document.getElementById('readingTitle')?.value || "",
        passage_text: document.getElementById('readingPassage')?.value || "",
        questions: document.getElementById('readingQuestions')?.value || "",
        answers: document.getElementById('readingAnswers')?.value || "",
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
      document.getElementById('wordsearchSize').value = s.puzzle_size || "1.0";      document.getElementById('wordsearchTemplate').value = s.template || "0";
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
      document.querySelector('.tool-btn[data-panel="reading"]').classList.add('active');      // Fill fields
      document.getElementById('readingTitle').value = worksheet.title || "";
      document.getElementById('readingPassage').value = worksheet.passage_text || "";
      document.getElementById('readingQuestions').value = worksheet.questions || "";
      document.getElementById('readingAnswers').value = worksheet.answers || "";

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
      document.getElementById('worksheetPreviewArea-reading').classList.remove('hidden');      // Trigger preview update
      setTimeout(() => {
        if (window.updateReadingPreview && typeof window.updateReadingPreview === 'function') {
          window.updateReadingPreview();
        }
      }, 100);
      
      // Update answer key button visibility
      updateAnswerKeyButtonVisibility();
    }
    // Add more types as needed
  };

  // PRINT ANSWER KEY (for reading worksheets)
  const printAnswerKeyBtn = document.getElementById('printAnswerKeyBtn');
  if (printAnswerKeyBtn) {
    printAnswerKeyBtn.onclick = () => {
      // Only proceed if we're on the reading panel
      if (document.getElementById('panel-reading').classList.contains('hidden')) {
        alert('Answer key is only available for reading worksheets.');
        return;
      }

      const title = document.getElementById('readingTitle')?.value || "Reading Comprehension";
      const answers = document.getElementById('readingAnswers')?.value || "";
      const questions = document.getElementById('readingQuestions')?.value || "";
      
      if (!answers.trim()) {
        alert('No answer key available. Please generate questions with AI or manually enter answers.');
        return;
      }

      // Get font settings
      let fontFamily = "'Poppins', sans-serif";
      const fontSelect = document.getElementById('readingFont');
      if (fontSelect) {
        fontFamily = fontSelect.value;
      }      const answerKeyContent = `
        <div class="worksheet-page">
          <div class="page-header" style="padding:40px 40px 20px 40px;">
            <div style="text-align:center;margin-bottom:30px;">
              <img src="../Assets/Images/color-logo1.png" alt="Willena Logo" style="width:120px;margin-bottom:20px;">
              <h1 style="font-size:24px;font-weight:bold;margin-bottom:10px;">${title} - Answer Key</h1>
              <div style="border-bottom:2px solid #333;width:60%;margin:0 auto;"></div>
            </div>
          </div>
          
          <div class="page-content" style="padding:0 40px;">
            <div style="margin-bottom:30px;">
              <h2 style="font-size:18px;font-weight:bold;margin-bottom:15px;">Answers:</h2>
              <div style="padding:20px;background:#f9f9f9;border-left:4px solid #2e2b3f;">
                ${formatAnswersForPrint(answers)}
              </div>
            </div>
          </div>
          
          <div class="page-footer" style="margin-top:auto;padding:20px 40px 40px 40px;border-top:1px solid #eee;text-align:center;color:#666;font-size:14px;">
            <p>Willena 원어민 영어학원 | 031-8041-2203 | www.willenaenglish.com</p>
          </div>
        </div>
      `;

      const win = window.open('', '', 'width=900,height=1200');
      win.document.write(`
        <html>
          <head>
            <title>Answer Key - ${title}</title>
            <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500&display=swap" rel="stylesheet">
            <style>
              body { 
                background: #fff; 
                margin: 0; 
                padding: 0; 
                font-family: ${fontFamily};
                font-size: 16px;
                line-height: 1.6;
              }
              @media print {
                body { 
                  background: #fff; 
                  -webkit-print-color-adjust: exact;
                  color-adjust: exact;
                }
                @page {
                  margin: 0.5in;
                  size: A4;
                }
              }
            </style>
          </head>          <body onload="window.print();" style="font-family:${fontFamily};font-size:16px;line-height:1.6;">
            ${answerKeyContent}
          </body>
        </html>
      `);
      win.document.close();
    };
  }
  // Helper function to format answers for printing
  function formatAnswersForPrint(answers) {
    if (!answers) return '';
    
    return answers.split('\n')
      .map(line => line.trim())
      .filter(line => line)
      .map((line, index) => {
        // Add some visual styling based on content
        let style = "margin-bottom:12px;font-size:16px;";
        
        // If line starts with a number, make it bold
        if (/^\d+\./.test(line)) {
          style += "font-weight:bold;color:#2e2b3f;";
        }
        
        // If line looks like a multiple choice answer (just a letter), emphasize it
        if (/^[a-d]$/i.test(line.trim())) {
          style += "font-weight:bold;font-size:18px;color:#7c3aed;background:#f3f0ff;padding:8px 12px;border-radius:4px;display:inline-block;";
        }
        
        return `<div style="${style}">${line}</div>`;
      })
      .join('');
  }

  // Show/hide answer key button based on active panel
  function updateAnswerKeyButtonVisibility() {
    const answerKeyBtn = document.getElementById('printAnswerKeyBtn');
    if (!answerKeyBtn) return;
    
    const isReadingPanelActive = !document.getElementById('panel-reading').classList.contains('hidden');
    answerKeyBtn.style.display = isReadingPanelActive ? 'inline-block' : 'none';
  }

  // Initial update of answer key button visibility
  updateAnswerKeyButtonVisibility();

  // Auto-generate basic answer key for manual questions
  function generateBasicAnswerKey() {
    const questions = document.getElementById('readingQuestions')?.value || "";
    const answersField = document.getElementById('readingAnswers');
    
    if (!questions.trim() || answersField?.value.trim()) {
      return; // Don't overwrite existing answers
    }

    // Count questions and generate placeholder answers
    const questionCount = (questions.match(/^\s*\d+\./gm) || []).length;
    if (questionCount === 0) return;

    const basicAnswers = [];
    for (let i = 1; i <= questionCount; i++) {
      basicAnswers.push(`${i}. [Answer ${i}]`);
    }
    
    if (answersField) {
      answersField.value = basicAnswers.join('\n');
    }
  }

  // Add event listener to auto-generate basic answer key when questions are added manually
  const questionsField = document.getElementById('readingQuestions');
  if (questionsField) {
    questionsField.addEventListener('input', () => {
      // Only auto-generate if answers field is empty
      const answersField = document.getElementById('readingAnswers');
      if (answersField && !answersField.value.trim()) {
        setTimeout(generateBasicAnswerKey, 500); // Small delay to avoid constant updates
      }
    });
  }

  // Helper function for single-page PDF generation
  async function generateSinglePagePDF(container, title) {
    // Capture at full resolution
    const canvas = await html2canvas(container, { 
      scale: 2, 
      backgroundColor: "#fff", 
      useCORS: true,
      width: 794,
      height: container.scrollHeight,
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
    
    pdf.save(`${title || 'worksheet'}.pdf`);
  }

  // Helper function for multi-page PDF generation
  async function generateMultiPagePDF(container, title) {
    const pages = container.querySelectorAll('.worksheet-page');
    const pdf = new window.jspdf.jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4'
    });

    for (let i = 0; i < pages.length; i++) {
      if (i > 0) {
        pdf.addPage();
      }

      // Capture each page individually
      const canvas = await html2canvas(pages[i], { 
        scale: 2, 
        backgroundColor: "#fff", 
        useCORS: true,
        width: 794,
        height: 1123,
        logging: false
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      pdf.addImage(
        imgData,
        'PNG',
        0,
        0,
        pageWidth,
        pageHeight
      );
    }
    
    pdf.save(`${title || 'worksheet'}.pdf`);
  }

  // Helper function to get worksheet title for naming
  function getWorksheetTitle() {
    let worksheetTitle = 'worksheet';
    const activePanel = document.querySelector('.tool-panel:not(.hidden)');
    if (activePanel) {
      const titleInput = activePanel.querySelector('[id$="Title"]');
      if (titleInput && titleInput.value.trim()) {
        worksheetTitle = titleInput.value.trim().replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '-');
      }
    }
    return worksheetTitle;
  }
});

