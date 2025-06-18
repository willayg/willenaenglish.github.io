document.addEventListener('DOMContentLoaded', () => {
  // PRINT WORKSHEET
  const printBtn = document.getElementById('printWorksheetBtn');
  if (printBtn) {
    printBtn.onclick = () => {
      const previewArea = document.getElementById('worksheetPreviewArea');
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
      const preview = document.getElementById('worksheetPreviewArea');
      preview.classList.remove('hidden');
      await new Promise(resolve => setTimeout(resolve, 100));
      const canvas = await html2canvas(preview, { scale: 2, backgroundColor: "#fff" });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new window.jspdf.jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4'
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      let imgWidth = pageWidth;
      let imgHeight = canvas.height * (imgWidth / canvas.width);
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save('worksheet.pdf');
    };
  }
});

