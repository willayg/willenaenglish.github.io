// Panel toggle logic
document.addEventListener('DOMContentLoaded', () => {
  function setMainLayout(mode) {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;
    mainContent.classList.remove('side-layout', 'stack-layout');
    mainContent.classList.add(mode === 'side' ? 'side-layout' : 'stack-layout');
  }

  // Map panel to layout mode
  const panelLayout = {
    puzzles: 'side',
    // Add other panels that should be side-by-side here
    // e.g. vocab: 'side',
  };

  function showPanel(panel) {
    document.querySelectorAll('.tool-panel').forEach(el => el.classList.add('hidden'));
    const active = document.getElementById('panel-' + panel);
    if (active) active.classList.remove('hidden');
    // Set layout
    setMainLayout(panelLayout[panel] || 'stack');
  }

  // Sidebar button click handlers
  document.querySelectorAll('#sidebar .tool-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      const panel = this.getAttribute('data-panel');
      showPanel(panel);
    });
  });

  // Show Files panel by default
  showPanel('files');

  // PDF Export logic
  const exportPdfBtn = document.getElementById('exportPdfBtn');
  if (exportPdfBtn) {
    exportPdfBtn.addEventListener('click', async () => {
      const { jsPDF } = window.jspdf;
      const puzzle = document.getElementById('puzzleExport');
      if (puzzle) {
        // Use html2canvas to capture the puzzle as an image
        const canvas = await html2canvas(puzzle, { scale: 2 });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'pt',
          format: 'a4'
        });
        // Calculate width/height to fit A4
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = pageWidth - 40;
        const imgHeight = canvas.height * (imgWidth / canvas.width);
        pdf.addImage(imgData, 'PNG', 20, 20, imgWidth, imgHeight);
        pdf.save('puzzle.pdf');
      } else {
        alert('No puzzle to export!');
      }
    });
  }

  // Save to Supabase logic
  const saveBtn = document.getElementById('saveBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const workspace = document.getElementById('workspace');
      if (!workspace) return;
      const lessonHtml = workspace.innerHTML;
      const fileName = prompt('Enter a name for your lesson file:', 'lesson.html');
      if (!fileName) return;

      // Send to Netlify function (as in your supabase_proxy.js)
      const response = await fetch('/.netlify/functions/supabase_proxy/upload_teacher_file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName,
          fileDataBase64: btoa(unescape(encodeURIComponent(lessonHtml))),
        }),
      });
      const result = await response.json();
      if (result.error) {
        alert('Save failed: ' + result.error);
      } else {
        alert('Lesson saved!');
      }
    });
  }

  // Worksheet Export Modal Logic
  document.getElementById('openWorksheetExport').onclick = () => {
    updateWorksheetPreview();
    document.getElementById('worksheetExportModal').classList.remove('hidden');
  };
  document.getElementById('worksheetCancelBtn').onclick = () => {
    document.getElementById('worksheetExportModal').classList.add('hidden');
  };

  // Preview Worksheet
  document.getElementById('worksheetPreviewBtn').onclick = () => {
    updateWorksheetPreview();
    const preview = document.getElementById('worksheetPreviewArea');
    preview.classList.remove('hidden');
    preview.style.position = 'fixed';
    preview.style.top = '60px';
    preview.style.left = '50%';
    preview.style.transform = 'translateX(-50%)';
    preview.style.zIndex = '9999';
    preview.style.background = '#fff';
    preview.style.boxShadow = '0 4px 32px rgba(0,0,0,0.15)';
    preview.style.maxHeight = '80vh';
    preview.style.overflow = 'auto';

    // Add a close button
    if (!document.getElementById('closePreviewBtn')) {
      const closeBtn = document.createElement('button');
      closeBtn.id = 'closePreviewBtn';
      closeBtn.innerText = 'Close Preview';
      closeBtn.style.position = 'absolute';
      closeBtn.style.top = '16px';
      closeBtn.style.right = '32px';
      closeBtn.style.zIndex = '10000';
      closeBtn.className = 'px-3 py-1 bg-gray-300 rounded hover:bg-gray-400';
      closeBtn.onclick = () => {
        preview.classList.add('hidden');
        preview.style = '';
        closeBtn.remove();
      };
      preview.appendChild(closeBtn);
    }
  };

  // Export Worksheet as PDF
  document.getElementById('worksheetExportPdfBtn').onclick = async () => {
    updateWorksheetPreview(); // Make sure preview is up to date
    const preview = document.getElementById('worksheetPreviewArea');
    preview.classList.remove('hidden'); // Ensure it's visible for capture

    // Wait for the browser to render the preview area
    await new Promise(resolve => setTimeout(resolve, 100));

    const canvas = await html2canvas(preview, { scale: 2, backgroundColor: "#fff" });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new window.jspdf.jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4'
    });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const imgWidth = pageWidth - 40;
    const imgHeight = canvas.height * (imgWidth / canvas.width);
    pdf.addImage(imgData, 'PNG', 20, 20, imgWidth, imgHeight);
    pdf.save('worksheet.pdf');
    preview.classList.add('hidden'); // Hide again if needed
    document.getElementById('worksheetExportModal').classList.add('hidden');
  };

  function updateWorksheetPreview() {
    const title = document.getElementById('worksheetTitle').value;
    const instructions = document.getElementById('worksheetInstructions').value;
    const puzzle = document.getElementById('puzzleExport');
    const preview = document.getElementById('worksheetPreviewArea');
    preview.innerHTML = `
      <img src="../Assets/Images/Logo.png" style="width:120px;margin-bottom:16px;">
      <h1 style="font-size:2rem;font-weight:bold;margin-bottom:8px;">${title || 'Worksheet'}</h1>
      <div style="margin-bottom:24px;color:#444;">${instructions || ''}</div>
      ${puzzle ? puzzle.outerHTML : ''}
    `;
  }

  // TODO (next steps):
  // 1. Add standard worksheet formatting, logo, and styles
  // 2. Add teacher controls for font and color in worksheet export
  // 3. Add "Willena AI Box" for AI-powered word generation
});
