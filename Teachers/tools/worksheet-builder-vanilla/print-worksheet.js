// print-worksheet.js
// Simple print functionality

(function() {
  function printWorksheet() {
    window.print();
  }

  // Add print button to toolbar
  document.addEventListener('DOMContentLoaded', function() {
    const toolbar = document.querySelector('.pastel-toolbar');
    if (toolbar && !document.getElementById('print-btn')) {
      const btn = document.createElement('button');
      btn.id = 'print-btn';
      btn.textContent = 'Print';
      btn.style.cssText = 'padding:8px 16px;background:#fff;border:1px solid #ddd;border-radius:4px;cursor:pointer;margin-left:auto;';
      btn.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        printWorksheet();
      };
      toolbar.appendChild(btn);
    }
  });

  // Handle File menu print - be very specific
  document.addEventListener('click', function(e) {
    if (e.target && e.target.id === 'file-menu-print') {
      e.preventDefault();
      e.stopPropagation();
      printWorksheet();
    }
  });
})();
