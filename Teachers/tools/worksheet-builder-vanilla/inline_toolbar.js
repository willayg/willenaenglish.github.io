// inline_toolbar.js - Floating toolbar for worksheet text box formatting

let textToolbar = null;
let currentTextbox = null;

function createTextToolbar() {
  if (textToolbar) return textToolbar;
  textToolbar = document.createElement('div');
  textToolbar.id = 'inline-toolbar';
  textToolbar.style.position = 'fixed';
  textToolbar.style.display = 'none';
  textToolbar.style.background = '#e0f7ff';
  textToolbar.style.border = '1px solid #22d3ee';
  textToolbar.style.borderRadius = '8px';
  textToolbar.style.boxShadow = '0 2px 12px 0 rgba(60,60,80,0.13)';
  textToolbar.style.padding = '6px 12px';
  textToolbar.style.zIndex = 10000;
  textToolbar.style.gap = '8px';
  textToolbar.style.display = 'flex';
  textToolbar.style.alignItems = 'center';
  textToolbar.style.fontFamily = 'Poppins, Arial, sans-serif';
  
  // Consistent color for all icons
  const iconColor = '#0891b2';
  const iconBg = '#a7f3d0';
  textToolbar.innerHTML = `
    <button id="tt-ai" class="toolbar-btn" title="AI" style="font-family:'Poppins',Verdana,sans-serif;font-weight:600;">AI</button>
    <button id="tt-copy" class="toolbar-btn" title="Copy">⧉</button>
    <button id="tt-delete" class="toolbar-btn" title="Delete">✕</button>
    <button id="tt-more" class="toolbar-btn" title="More">⋯</button>
  `;
  
  // Add feedback effect to all toolbar buttons
  function addButtonFeedback(btn) {
    btn.addEventListener('mousedown', () => btn.classList.add('active'));
    btn.addEventListener('mouseup', () => btn.classList.remove('active'));
    btn.addEventListener('mouseleave', () => btn.classList.remove('active'));
    btn.addEventListener('touchstart', () => btn.classList.add('active'));
    btn.addEventListener('touchend', () => btn.classList.remove('active'));
  }
  
  [
    textToolbar.querySelector('#tt-ai'),
    textToolbar.querySelector('#tt-copy'),
    textToolbar.querySelector('#tt-delete'),
    textToolbar.querySelector('#tt-more')
  ].forEach(addButtonFeedback);

  // Add event handlers for buttons
  textToolbar.querySelector('#tt-copy').addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    if (currentTextbox && window.copyTextbox) {
      window.copyTextbox(currentTextbox);
      // Visual feedback
      this.style.background = '#10b981';
      this.style.color = 'white';
      setTimeout(() => {
        this.style.background = '';
        this.style.color = '';
      }, 200);
    }
  });
  
  textToolbar.querySelector('#tt-delete').addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    if (currentTextbox && window.deleteTextbox) {
      window.deleteTextbox(currentTextbox);
      hideTextToolbar();
    }
  });
  
  textToolbar.querySelector('#tt-ai').addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    if (currentTextbox) {
      // Load and open the Mint AI vocab modal instead of the regular AI modal
      if (!window.openVocabBoxModal) {
        // Dynamically load the vocab modal script if not already loaded
        const script = document.createElement('script');
        script.src = 'mint-ai/mint-ai-vocab-modal.js';
        script.onload = function() {
          if (window.openVocabBoxModal) {
            window.openVocabBoxModal();
          }
        };
        document.head.appendChild(script);
      } else {
        window.openVocabBoxModal();
      }
    }
  });
  
  textToolbar.querySelector('#tt-more').addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    // TODO: Implement more options
    console.log('More options not implemented yet');
  });

  // Inject feedback style if not present
  if (!document.getElementById('inline-toolbar-style')) {
    const style = document.createElement('style');
    style.id = 'inline-toolbar-style';
    style.textContent = `
      .toolbar-btn {
        background: none;
        border: none;
        border-radius: 6px;
        padding: 2px 4px;
        cursor: pointer;
        transition: background 0.13s, box-shadow 0.13s;
        outline: none;
        display: flex;
        align-items: center;
      }
      .toolbar-btn.active {
        background: #a7f3d0;
        box-shadow: 0 2px 8px 0 rgba(8,145,178,0.10);
      }
      .toolbar-btn svg {
        display: block;
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(textToolbar);
  
  // Simple click outside to hide logic
  document.addEventListener('click', function(e) {
    // If toolbar is visible and click is outside both toolbar and textbox, hide it
    if (
      textToolbar &&
      textToolbar.style.display === 'flex' &&
      !textToolbar.contains(e.target) &&
      (!currentTextbox || !currentTextbox.contains(e.target))
    ) {
      hideTextToolbar();
    }
  }, false);

  return textToolbar;
}

function showTextToolbar(box) {
  createTextToolbar();
  currentTextbox = box;
  
  // Position toolbar just above and centered on the box, adjust for viewport edges
  function positionToolbar() {
    const rect = box.getBoundingClientRect();
    const toolbarRect = textToolbar.getBoundingClientRect();
    
    // Center horizontally above the textbox
    let left = rect.left + (rect.width - toolbarRect.width) / 2;
    
    // Position above the textbox with some spacing
    let top = rect.top - toolbarRect.height - 12;
    
    // Adjust for viewport edges
    if (left < 8) left = 8;
    const maxLeft = window.innerWidth - toolbarRect.width - 8;
    if (left > maxLeft) left = maxLeft;
    
    // If toolbar would go above viewport, position it below the textbox
    if (top < 8) {
      top = rect.bottom + 12;
    }
    
    textToolbar.style.left = left + 'px';
    textToolbar.style.top = top + 'px';
    textToolbar.style.display = 'flex';
  }
  
  textToolbar.style.display = 'flex';
  setTimeout(positionToolbar, 0);
  
  // Make toolbar follow box while dragging
  if (!box._toolbarMoveHandler) {
    box._toolbarMoveHandler = function() {
      if (document.activeElement === box || box === currentTextbox) {
        positionToolbar();
      }
    };
    document.addEventListener('mousemove', box._toolbarMoveHandler);
    box._toolbarMoveCleanup = function() {
      document.removeEventListener('mousemove', box._toolbarMoveHandler);
      box._toolbarMoveHandler = null;
    };
    box.addEventListener('blur', box._toolbarMoveCleanup);
  }
}

function hideTextToolbar() {
  if (textToolbar) textToolbar.style.display = 'none';
  currentTextbox = null;
}

// Expose functions globally
window.showTextToolbar = showTextToolbar;
window.hideTextToolbar = hideTextToolbar;