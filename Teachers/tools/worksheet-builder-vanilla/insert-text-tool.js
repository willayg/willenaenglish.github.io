// insert-text-tool.js
// Logic for the 'Insert Text Box' tool in the worksheet builder

(function() {
  // Wait for DOM and main.js to finish rendering
  document.addEventListener('DOMContentLoaded', function() {
    const insertBtn = document.getElementById('insert-text-tool');
    if (!insertBtn) return;
    insertBtn.addEventListener('click', function() {
      // Find the selected page, or fallback to last page
      const selected = document.querySelector('.page-preview-a4.selected');
      const pagesEls = document.querySelectorAll('.page-preview-a4');
      if (!pagesEls.length) return;
      const pageEl = selected || pagesEls[pagesEls.length - 1];
      // Find the page index
      const pageIdx = Array.from(pagesEls).indexOf(pageEl);
      if (pageIdx === -1) return;
      // Calculate position: horizontally aligned with T button, vertically centered in preview area
      const tBtn = document.getElementById('insert-text-tool');
      const previewRect = pageEl.getBoundingClientRect();
      const scrollY = window.scrollY || document.documentElement.scrollTop;
      const scrollX = window.scrollX || document.documentElement.scrollLeft;
      let left = 80, top = 80;
      const boxWidth = 780, boxHeight = 400;
      if (previewRect) {
        // Horizontal: center in preview area
        left = Math.max(0, Math.round((previewRect.width - boxWidth) / 2));
        // Vertical: 20% from the top of the preview area, minus 100px (but not less than 0)
        top = Math.max(0, Math.round(previewRect.height * 0.2) - 100);
        // Offset for subsequent boxes on the same page
        const pageBoxes = window.worksheetState.getPages()[pageIdx]?.boxes || [];
        if (pageBoxes.length > 0) {
          // Offset each new box by 40px more than the previous
          top += pageBoxes.length * 40;
        }
      }
      // Add a new box to the data model
      const boxData = {
        left: left + 'px',
        top: top + 'px',
        width: boxWidth + 'px',
        height: boxHeight + 'px', // Default height is 400px, but will auto-grow
        text: '',
        borderOn: false,
        borderColor: '#e1e8ed',
        borderWeight: 1.5,
        borderRadius: 4,
        lineHeight: '1.8' // New line spacing system default
      };
      // Save to history before adding new textbox
      if (window.saveToHistory) window.saveToHistory('add textbox');
      if (!window.worksheetState.getPages()[pageIdx]) window.worksheetState.getPages()[pageIdx] = { boxes: [] };
      window.worksheetState.getPages()[pageIdx].boxes.push(boxData);
      // Re-render to show the new box
      if (window.renderPages) window.renderPages();
    });
  });
})();
