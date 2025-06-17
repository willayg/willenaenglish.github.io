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
    exportPdfBtn.addEventListener('click', () => {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      const puzzle = document.getElementById('puzzleExport');
      if (puzzle) {
        doc.html(puzzle, {
          callback: function (doc) {
            doc.save('puzzle.pdf');
          },
          x: 10,
          y: 10
        });
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
});
