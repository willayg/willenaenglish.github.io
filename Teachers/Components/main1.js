document.addEventListener('DOMContentLoaded', () => {
  // PRINT WORKSHEET
  const printBtn = document.getElementById('printWorksheetBtn');
  if (printBtn) {
    printBtn.onclick = () => {
      // Find the visible worksheet preview
      const previewArea = document.querySelector('.worksheet-preview:not(.hidden)');
      if (!previewArea) return;
      const printContents = `
        <div style="width:794px;min-height:1123px;margin:auto;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;">
          ${previewArea.innerHTML}
        </div>
      `;
      const win = window.open('', '', 'width=900,height=1200');
      win.document.write(`
        <html>
          <head>
            <title>Print Worksheet</title>
            <!-- Google Fonts -->
            <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@500&display=swap" rel="stylesheet">
            <link href="https://fonts.googleapis.com/css2?family=Nanum+Pen+Script&display=swap" rel="stylesheet">
            <style>
              body { background: #fff; margin: 0; padding: 0; }
              .wordsearch-font-sans { font-family: 'Poppins', Arial, sans-serif; }
              .wordsearch-font-mono { font-family: 'Courier New', Courier, monospace; }
              .wordsearch-font-comic { font-family: 'Comic Sans MS', Comic Sans, cursive, sans-serif; }
              .wordsearch-font-nanum { font-family: 'Nanum Pen Script', cursive; }
              .wordsearch-table {
                margin: 0 auto;
                border-collapse: collapse;
              }
              .wordsearch-table td {
                width: 32px;
                height: 32px;
                text-align: center;
                vertical-align: middle;
                border: 1px solid #222;
                padding: 0;
                box-sizing: border-box;
                font-size: 1.3rem;
              }
              @media print {
                body { background: #fff; }
                div { box-shadow: none !important; }
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
      preview.classList.remove('hidden');
      await new Promise(resolve => setTimeout(resolve, 100));
      // Use useCORS: true to allow external images
      const canvas = await html2canvas(preview, { scale: 2, backgroundColor: "#fff", useCORS: true });
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
      // Add pages if content is taller than one page
      while (position < imgHeight) {
        pdf.addImage(
          imgData,
          'PNG',
          0,
          -position,
          imgWidth,
          imgHeight
        );
        position += pageHeight;
        if (position < imgHeight) pdf.addPage();
      }
      pdf.save('worksheet.pdf');
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
    }
    // --- WORDSEARCH ---
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
      document.getElementById('wordsearchSize').value = s.puzzle_size || "1";
      document.getElementById('wordsearchTemplate').value = s.template || "0";
      document.getElementById('wordsearchHintsAlign').value = s.hints_alignment || "top";

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
      document.getElementById('wordTestWords').value = (worksheet.words || []).join('\n');

      // Settings (if present)
      const s = worksheet.settings || {};
      document.getElementById('wordTestFont').value = s.font || "";
      document.getElementById('wordTestFontSize').value = s.font_size || "";
      document.getElementById('wordTestLayout').value = s.layout || "";
      document.getElementById('wordTestTemplate').value = s.template || "";
      document.getElementById('wordTestNumWords').value = s.num_words || "";
      document.getElementById('pixabayImageType').value = s.image_type || "";
      document.getElementById('wordTestMode').value = s.test_mode || "";
    }
    // Add more types as needed
  };
});

