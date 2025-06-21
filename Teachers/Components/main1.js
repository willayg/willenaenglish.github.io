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

      // --- SCALE PREVIEW TO A4 ---
      const originalWidth = preview.style.width;
      const originalHeight = preview.style.height;
      const originalTransform = preview.style.transform;
      preview.style.width = "794px";
      preview.style.height = "1123px";
      preview.style.transform = "scale(1)";

      await new Promise(resolve => setTimeout(resolve, 100));
      const canvas = await html2canvas(preview, { scale: 2, backgroundColor: "#fff", useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new window.jspdf.jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4'
      });
      pdf.addImage(imgData, 'PNG', 0, 0, 794, 1123);
      pdf.save('worksheet.pdf');

      // --- RESTORE ORIGINAL STYLES ---
      preview.style.width = originalWidth;
      preview.style.height = originalHeight;
      preview.style.transform = originalTransform;
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

  // Generate Wordsearch
  document.getElementById('generateWordsearch').onclick = () => {
    console.log('GenerateWordsearch CLICKED!');
    // Your existing code for generating wordsearch goes here
  };
});

