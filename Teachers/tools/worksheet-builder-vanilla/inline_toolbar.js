// inline_toolbar.js - Floating toolbar for worksheet text box formatting

let textToolbar = null;
let currentTextbox = null;

// Helper function to load scripts
function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

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
    <button id="tt-copy" class="toolbar-btn" title="Copy (Ctrl+C)">⧉</button>
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
    if (currentTextbox && window.worksheetTextbox && window.worksheetTextbox.duplicateTextbox) {
      window.worksheetTextbox.duplicateTextbox(currentTextbox);
      // Wait for DOM update and selection frame, then show toolbar on new box
      setTimeout(() => {
        const newBox = window.lastCreatedTextbox;
        if (newBox && window.showTextToolbar) {
          window.showTextToolbar(newBox);
        }
      }, 0);
      // Visual feedback
      this.style.background = '#10b981';
      this.style.color = 'white';
      setTimeout(() => {
        this.style.background = '';
        this.style.color = '';
      }, 200);
      console.log('Textbox duplicated');
    }
  });
  
  textToolbar.querySelector('#tt-delete').addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    if (currentTextbox) {
      // Try both global and namespaced functions
      const deleteFunc = window.deleteTextbox || window.worksheetTextbox?.deleteTextbox;
      if (deleteFunc) {
        deleteFunc(currentTextbox);
        hideTextToolbar();
        console.log('Textbox deleted');
      } else {
        console.error('Delete function not found');
      }
    }
  });
  
  textToolbar.querySelector('#tt-ai').addEventListener('click', async function(e) {
    e.preventDefault();
    e.stopPropagation();
    if (currentTextbox) {
      console.log('AI button clicked for textbox:', currentTextbox);

      // Ensure this textbox has a complete, repairable vocab state
      try {
        // Ensure the handler script is loaded before repair
        if (!window.VocabTextboxHandler) {
          await loadScript('mint-ai/vocab-textbox-handler.js');
        }
        if (window.VocabTextboxHandler && typeof window.VocabTextboxHandler.detectAndRepairVocabBox === 'function') {
          window.VocabTextboxHandler.detectAndRepairVocabBox(currentTextbox);
        } else {
          updateVocabStateFromTextbox(currentTextbox);
        }
      } catch (err) {
        console.warn('Could not repair vocab state before opening modal:', err);
      }

      // Load modal script if needed, then open with the specific textbox
      let modalScript = document.querySelector('script[src="mint-ai/mint-ai-vocab-modal-fixed.js"]');
      const openModal = () => {
        if (typeof window.openVocabBoxModal === 'function') {
          window.openVocabBoxModal(false, currentTextbox);
        } else {
          alert('Error: Could not open the AI modal.');
        }
      };
      if (!modalScript) {
        modalScript = document.createElement('script');
        modalScript.src = 'mint-ai/mint-ai-vocab-modal-fixed.js';
        modalScript.onload = openModal;
        modalScript.onerror = () => alert('Error loading a required script.');
        document.head.appendChild(modalScript);
      } else {
        openModal();
      }

    } else {
      console.error('No current textbox found');
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

// Update vocab state with current textbox content before opening AI modal
function updateVocabStateFromTextbox(textbox) {
  try {
    console.log('🔄 Starting updateVocabStateFromTextbox...');
    console.log('📦 Textbox element:', textbox);
    console.log('📦 Textbox innerHTML:', textbox.innerHTML);
    console.log('📦 Textbox innerText:', textbox.innerText);
    
    // Get current vocab state if it exists
    const vocabStateAttr = textbox.getAttribute('data-vocab-state');
    if (!vocabStateAttr) {
      console.log('❌ No existing vocab state found on textbox');
      return;
    }
    
    const currentState = JSON.parse(vocabStateAttr);
    console.log('📋 Current vocab state:', currentState);
    
    // Extract current text content from the textbox
    const currentHTML = textbox.innerHTML;
    const currentText = textbox.innerText || textbox.textContent;
    
    console.log('📝 Current textbox content (HTML):', currentHTML);
    console.log('📝 Current textbox content (text):', currentText);
    
    // Try to extract word list from current content
    // Look for patterns like "word - translation" or table structures
    let extractedWordlist = '';
    
    // Check if it's a table structure (common for vocab boxes)
    const tableRows = textbox.querySelectorAll('tr');
    if (tableRows.length > 1) { // More than just header
      console.log('🔍 Found table structure, extracting word pairs...', tableRows.length, 'rows');
      
      tableRows.forEach((row, index) => {
        if (index === 0) return; // Skip header row
        
        const cells = row.querySelectorAll('td, th');
        console.log(`  Row ${index}:`, cells.length, 'cells');
        if (cells.length >= 2) {
          const english = cells[0]?.textContent?.trim() || '';
          const translation = cells[1]?.textContent?.trim() || '';
          
          console.log(`    English: "${english}", Translation: "${translation}"`);
          
          // Skip numbering if present
          const cleanEnglish = english.replace(/^\d+\.?\s*/, '');
          
          if (cleanEnglish && translation) {
            extractedWordlist += `${cleanEnglish}, ${translation}\n`;
            console.log(`    ✅ Added: "${cleanEnglish}, ${translation}"`);
          }
        }
      });
    } else {
      // Try to extract from plain text patterns
      console.log('🔍 No table found, trying to extract from text patterns...');
      
      const lines = currentText.split('\n');
      console.log('📝 Text lines:', lines);
      
      lines.forEach((line, lineIndex) => {
        line = line.trim();
        if (!line) return;
        
        console.log(`  Line ${lineIndex}: "${line}"`);
        
        // Skip title/header lines
        if (line.includes('English') && line.includes('Korean')) {
          console.log('    ⏭️ Skipping header line');
          return;
        }
        if (/^\d+$/.test(line)) {
          console.log('    ⏭️ Skipping number line');
          return;
        }
        
        // Look for patterns like "word - translation", "word, translation", etc.
        const patterns = [
          /^(\d+\.?\s*)?([^,-]+)[,-]\s*(.+)$/,  // "1. word, translation" or "word - translation"
          /^(\d+\.?\s*)?([^:]+):\s*(.+)$/       // "word: translation"
        ];
        
        for (const [patternIndex, pattern] of patterns.entries()) {
          const match = line.match(pattern);
          if (match) {
            const english = match[2]?.trim();
            const translation = match[3]?.trim();
            console.log(`    Pattern ${patternIndex} matched: "${english}" → "${translation}"`);
            if (english && translation && english !== translation) {
              extractedWordlist += `${english}, ${translation}\n`;
              console.log(`    ✅ Added: "${english}, ${translation}"`);
              break;
            }
          }
        }
      });
    }
    
    // Update the vocab state with extracted content
    if (extractedWordlist.trim()) {
      currentState.wordlist = extractedWordlist.trim();
      console.log('✅ Updated wordlist in vocab state:', extractedWordlist);
    } else {
      console.log('⚠️ Could not extract word list from current content');
    }
    
    // Update the textbox with the new state
    textbox.setAttribute('data-vocab-state', JSON.stringify(currentState));
    console.log('💾 Updated vocab state on textbox');
    
  } catch (error) {
    console.error('❌ Error updating vocab state from textbox:', error);
  }
}

// Expose functions globally
window.showTextToolbar = showTextToolbar;
window.hideTextToolbar = hideTextToolbar;