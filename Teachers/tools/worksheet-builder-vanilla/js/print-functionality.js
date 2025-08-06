// Print functionality for worksheet pages
function printPages() {
  const previewArea = document.getElementById('page-preview-area');
  const pages = previewArea.querySelectorAll('.page-preview-a4');
  const textboxes = previewArea.querySelectorAll('.worksheet-textbox');
  
  // Debug logging
  console.log('Print debug:', {
    pages: pages.length,
    textboxes: textboxes.length,
    previewAreaHTML: previewArea.innerHTML.substring(0, 200) + '...'
  });
  
  // Check if there are any pages at all
  if (pages.length === 0) {
    alert('No pages found. Please create a page first.');
    return;
  }
  
  // Check if there's any content (text boxes or has-content class)
  let hasContent = false;
  
  // Check for text boxes
  if (textboxes.length > 0) {
    hasContent = true;
    console.log('Found text boxes:', textboxes.length);
  } else {
    // Fallback: check for has-content class
    pages.forEach(page => {
      if (page.classList.contains('has-content')) {
        hasContent = true;
        console.log('Found has-content class on page');
      }
    });
  }

  if (hasContent) {
    console.log('Proceeding to print...');
    // Add a small delay to ensure all styles are applied
    setTimeout(() => {
      window.print();
    }, 100);
  } else {
    alert('The print area is empty. Please add content before printing.');
  }
}

// Debug function to test print styles
function debugPrintStyles() {
  const textboxes = document.querySelectorAll('.worksheet-textbox');
  console.log('Current textboxes:', textboxes.length);
  textboxes.forEach((box, i) => {
    console.log(`Textbox ${i}:`, {
      text: box.innerText,
      visible: window.getComputedStyle(box).visibility,
      display: window.getComputedStyle(box).display,
      position: window.getComputedStyle(box).position,
      classes: box.className
    });
  });
}

// Expose functions globally
window.printPages = printPages;
window.debugPrintStyles = debugPrintStyles;
