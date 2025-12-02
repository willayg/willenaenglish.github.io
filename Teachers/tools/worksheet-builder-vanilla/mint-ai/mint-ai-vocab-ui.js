// mint-ai-vocab-ui.js: UI components, language picker, layout controls, and styling for vocab modal
(function() {
  // Function to populate the layouts modal based on mode
  function populateLayoutsModal(modal, isPictureMode) {
    const container = modal.querySelector('#vocab-layouts-container');
    const modalTitle = modal.querySelector('#vocab-layouts-modal-title');
    
    if (!container) return;
    
    // Clear existing content
    container.innerHTML = '';
    
    if (isPictureMode) {
      // Update modal title for picture mode
      if (modalTitle) {
        modalTitle.textContent = 'Picture Layouts';
        modalTitle.style.color = '#f59e0b';
      }
      
      // Picture Cards layout
      container.innerHTML += `
        <div class="layout-thumb-container" style="display:flex;flex-direction:column;align-items:center;">
          <button class="vocab-layout-option" data-value="grid" style="width:160px;height:120px;padding:0;border-radius:14px;background:#fff;color:#f59e0b;font-size:0.45em;font-family:'Poppins',Arial,sans-serif;font-weight:600;border:3px solid #f59e0b;box-shadow:0 2px 8px rgba(245,158,11,0.08);cursor:pointer;transition:all 0.2s;display:flex;align-items:center;justify-content:center;">
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px;width:92%;height:92%;">
              <div style="border:1.2px solid #e1e8ed;border-radius:6px;padding:2px;text-align:center;background:#fafbfc;font-size:0.6em;display:flex;flex-direction:column;">
                <div style="flex:1;background:#f59e0b;border-radius:3px;margin-bottom:2px;display:flex;align-items:center;justify-content:center;color:white;font-size:0.8em;">🏠</div>
              </div>
              <div style="border:1.2px solid #e1e8ed;border-radius:6px;padding:2px;text-align:center;background:#fafbfc;font-size:0.6em;display:flex;flex-direction:column;">
                <div style="flex:1;background:#10b981;border-radius:3px;margin-bottom:2px;display:flex;align-items:center;justify-content:center;color:white;font-size:0.8em;">🚗</div>
              </div>
              <div style="border:1.2px solid #e1e8ed;border-radius:6px;padding:2px;text-align:center;background:#fafbfc;font-size:0.6em;display:flex;flex-direction:column;">
                <div style="flex:1;background:#8b5cf6;border-radius:3px;margin-bottom:2px;display:flex;align-items:center;justify-content:center;color:white;font-size:0.8em;">🌳</div>
              </div>
            </div>
          </button>
          <span style="margin-top:8px;font-size:1em;color:#f59e0b;font-weight:600;">Picture Grid</span>
        </div>
      `;
      
      // Add more picture layouts here...
      
    } else {
      // Vocab mode - restore original vocab layouts
      if (modalTitle) {
        modalTitle.textContent = 'Layout';
        modalTitle.style.color = '#2296a3';
      }
      
      // Add all the original vocab layout thumbnails
      container.innerHTML = `
        <div class="layout-thumb-container" style="display:flex;flex-direction:column;align-items:center;">
          <button class="vocab-layout-option" data-value="sidebyside" style="width:160px;height:120px;padding:0;border-radius:14px;background:#fff;color:#222;font-size:0.55em;font-family:'Poppins',Arial,sans-serif;font-weight:600;border:3px solid #2296a3;box-shadow:0 2px 8px rgba(0,191,174,0.08);cursor:pointer;transition:all 0.2s;display:flex;align-items:center;justify-content:center;">
            <div style="width:95%;height:90%;background:#fff;border-radius:10px;display:flex;flex-direction:column;justify-content:center;box-shadow:0 1px 4px rgba(60,60,80,0.06);border:1.5px solid #e0e0e0;overflow:hidden;">
              <div style="display:grid;grid-template-columns:32px 1fr 1fr;border-bottom:2px solid #222;font-size:0.93em;font-weight:700;padding:2px 0 2px 0;background:#fff;">
                <span></span>
                <span style="text-align:left;padding-left:2px;">English</span>
                <span style="text-align:left;padding-left:2px;">Korean</span>
              </div>
              <div style="display:grid;grid-template-columns:32px 1fr 1fr;align-items:center;font-size:0.88em;border-bottom:1.5px solid #e0e0e0;padding:1.5px 0 1.5px 0;">
                <span style="font-weight:700;">1</span><span style="font-weight:500;">dog</span><span style="font-weight:400;">개</span>
              </div>
              <div style="display:grid;grid-template-columns:32px 1fr 1fr;align-items:center;font-size:0.88em;border-bottom:1.5px solid #e0e0e0;padding:1.5px 0 1.5px 0;">
                <span style="font-weight:700;">2</span><span style="font-weight:500;">cat</span><span style="font-weight:400;">고양이</span>
              </div>
              <div style="display:grid;grid-template-columns:32px 1fr 1fr;align-items:center;font-size:0.88em;border-bottom:1.5px solid #e0e0e0;padding:1.5px 0 1.5px 0;">
                <span style="font-weight:700;">3</span><span style="font-weight:500;">bird</span><span style="font-weight:400;">새</span>
              </div>
            </div>
          </button>
          <span style="margin-top:8px;font-size:1em;color:#2296a3;font-weight:600;">Side-by-Side</span>
        </div>
        <div class="layout-thumb-container" style="display:flex;flex-direction:column;align-items:center;">
          <button class="vocab-layout-option" data-value="doublelist" style="width:160px;height:120px;padding:0;border-radius:14px;background:#fff;color:#222;font-size:0.45em;font-family:'Poppins',Arial,sans-serif;font-weight:600;border:3px solid #2296a3;box-shadow:0 2px 8px rgba(0,191,174,0.08);cursor:pointer;transition:all 0.2s;display:flex;align-items:center;justify-content:center;">
          <!-- Double list thumbnail content -->
          </button>
          <span style="margin-top:8px;font-size:1em;color:#2296a3;font-weight:600;">Double List</span>
        </div>
        <!-- Add more layout thumbnails here -->
      `;
    }
    
    // Re-attach click events to new layout options
    const layoutOptions = modal.querySelectorAll('.vocab-layout-option');
    layoutOptions.forEach(option => {
      option.onclick = function() {
        const format = this.getAttribute('data-value');
        // Update hidden select
        const formatSelect = modal.querySelector('#vocab-list-format');
        if (formatSelect) {
          formatSelect.value = format;
          // Trigger change event for preview update
          formatSelect.dispatchEvent(new Event('change'));
          if (window.MintAIVocabCore) {
            window.MintAIVocabCore.setUserManuallyChangedLayout(true);
          }
        }
        // Close modal
        const layoutsModal = modal.querySelector('#vocab-layouts-modal');
        if (layoutsModal) layoutsModal.style.display = 'none';
      };
    });
  }

  // Language picker functionality
  function setupLanguagePicker(modal) {
    const langPickerModal = modal.querySelector('#vocab-lang-picker-modal');
    let langPickerTarget = null; // 'target' or 'student'
    const langDisplayTarget = modal.querySelector('#vocab-target-lang-display');
    const langDisplayStudent = modal.querySelector('#vocab-student-lang-display');
    const langPickerCancel = modal.querySelector('#vocab-lang-picker-cancel');
    
    console.log('Setting up language picker:', {
      langPickerModal: !!langPickerModal,
      langDisplayTarget: !!langDisplayTarget,
      langDisplayStudent: !!langDisplayStudent,
      langPickerCancel: !!langPickerCancel
    });
    
    function updateLangDisplays() {
      const core = window.MintAIVocabCore;
      if (!core) {
        console.warn('MintAIVocabCore not available for language update');
        return;
      }
      
      const t = core.langOptions.find(l => l.value === core.getSelectedTargetLang());
      const s = core.langOptions.find(l => l.value === core.getSelectedStudentLang());
      
      console.log('Updating language displays:', { target: t, student: s });
      
      if (t && langDisplayTarget) {
        const img = langDisplayTarget.querySelector('img');
        const span = langDisplayTarget.querySelector('span');
        if (img) {
          img.src = t.flag;
          img.alt = t.label;
        }
        if (span) span.textContent = t.label;
      }
      if (s && langDisplayStudent) {
        const img = langDisplayStudent.querySelector('img');
        const span = langDisplayStudent.querySelector('span');
        if (img) {
          img.src = s.flag;
          img.alt = s.label;
        }
        if (span) span.textContent = s.label;
      }
      // Update layout thumbnails with new language label
      updateLayoutThumbnails(modal);
    }

    function updateLayoutThumbnails(modal) {
      const core = window.MintAIVocabCore;
      if (!core) return;
      
      const l1LabelRaw = core.langOptions.find(l => l.value === core.getSelectedStudentLang())?.label || 'Korean';
      const secondColLabel = (core.getCurrentExtractionMode() === 'definition')
        ? (l1LabelRaw === 'Korean' ? 'Definition' : l1LabelRaw)
        : ((core.getCurrentExtractionMode() === 'words') ? '' : l1LabelRaw);
      
      // Update Side-by-Side thumbnail - find the Korean text and replace it
      const sideBySideThumbnail = modal.querySelector('[data-value="sidebyside"]');
      if (sideBySideThumbnail) {
        const spans = sideBySideThumbnail.querySelectorAll('span');
        spans.forEach(span => {
          if (span.textContent.trim() === 'Korean' || span.textContent.trim() === 'Definition') {
            span.textContent = secondColLabel;
          }
        });
      }

      // Update other thumbnails similarly...
    }

    if (langDisplayTarget) {
      langDisplayTarget.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('Target language clicked');
        langPickerTarget = 'target';
        if (langPickerModal) {
          langPickerModal.style.display = 'flex';
        } else {
          console.error('Language picker modal not found');
        }
      };
    } else {
      console.warn('Target language display not found');
    }
    
    if (langDisplayStudent) {
      langDisplayStudent.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('Student language clicked');
        langPickerTarget = 'student';
        if (langPickerModal) {
          langPickerModal.style.display = 'flex';
        } else {
          console.error('Language picker modal not found');
        }
      };
    } else {
      console.warn('Student language display not found');
    }
    
    if (langPickerCancel) {
      langPickerCancel.onclick = function() {
        langPickerModal.style.display = 'none';
      };
    }
    
    // Click outside to close
    if (langPickerModal) {
      langPickerModal.onclick = function(e) {
        if (e.target === langPickerModal) {
          langPickerModal.style.display = 'none';
        }
      };
    }

    // Option click handlers
    if (langPickerModal) {
      const langOptions = langPickerModal.querySelectorAll('.lang-picker-option');
      console.log('Found language options:', langOptions.length);
      
      langOptions.forEach(opt => {
        opt.onclick = function(e) {
          e.preventDefault();
          e.stopPropagation();
          const val = this.getAttribute('data-value');
          console.log('Language option clicked:', val, 'for target:', langPickerTarget);
          
          const core = window.MintAIVocabCore;
          if (!core) {
            console.error('MintAIVocabCore not available');
            return;
          }
          
          if (langPickerTarget === 'target') core.setSelectedTargetLang(val);
          if (langPickerTarget === 'student') core.setSelectedStudentLang(val);
          
          updateLangDisplays();
          // Update preview with new language if updatePreview exists
          if (window.updateVocabPreview) window.updateVocabPreview();
          langPickerModal.style.display = 'none';
        };
      });
    } else {
      console.error('Language picker modal not found for option setup');
    }
    
    // Initial update
    updateLangDisplays();
    return updateLangDisplays;
  }

  // Font controls setup
  function setupFontControls(modal, previewArea) {
    const fontSelect = modal.querySelector('#vocab-preview-font');
    const fontSizeSelect = modal.querySelector('#vocab-preview-fontsize');
    const fontColorSelect = modal.querySelector('#vocab-preview-fontcolor');
    
    // Apply font and size to preview area
    function applyPreviewFontSettings() {
      if (fontSelect && fontSizeSelect && fontColorSelect && previewArea) {
        previewArea.style.setProperty('font-family', fontSelect.value, 'important');
        previewArea.style.setProperty('font-size', fontSizeSelect.value, 'important');
        previewArea.style.setProperty('color', fontColorSelect.value, 'important');
        
        // Also apply to all elements inside preview area with !important
        const allElements = previewArea.querySelectorAll('*');
        allElements.forEach(el => {
          el.style.setProperty('font-family', fontSelect.value, 'important');
          el.style.setProperty('font-size', fontSizeSelect.value, 'important');
          el.style.setProperty('color', fontColorSelect.value, 'important');
        });
      }
    }
    
    if (fontSelect) fontSelect.addEventListener('change', applyPreviewFontSettings);
    if (fontSizeSelect) fontSizeSelect.addEventListener('change', applyPreviewFontSettings);
    if (fontColorSelect) fontColorSelect.addEventListener('change', applyPreviewFontSettings);
    
    // Watch for changes in the preview area and apply font settings to new content
    if (previewArea) {
      const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
          if (mutation.type === 'childList') {
            // Apply font settings to any newly added elements
            setTimeout(applyPreviewFontSettings, 10);
          }
        });
      });
      observer.observe(previewArea, { childList: true, subtree: true });
    }

    return applyPreviewFontSettings;
  }

  // Mode switching functionality
  function setupModeSwitch(modal) {
    const textInputBtn = modal.querySelector('#text-input-btn');
    const topicInputBtn = modal.querySelector('#topic-input-btn');
    const passageInput = modal.querySelector('#vocab-passage');
    const topicInput = modal.querySelector('#vocab-topic-input');
    const generateBtn = modal.querySelector('#vocab-generate-btn');
    
    let currentMode = 'topic'; // 'topic' is default
    
    function switchToTextMode() {
      currentMode = 'text';
      if (textInputBtn) {
        textInputBtn.style.background = '#00897b';
        textInputBtn.style.color = '#fff';
      }
      if (topicInputBtn) {
        topicInputBtn.style.background = '#e1e8ed';
        topicInputBtn.style.color = '#666';
      }
      if (passageInput) passageInput.style.display = 'block';
      if (topicInput) topicInput.style.display = 'none';
      if (generateBtn) generateBtn.textContent = 'Extract';
      const extractionBar = modal.querySelector('#vocab-extraction-bar');
      if (extractionBar) extractionBar.style.display = 'none';
    }
    
    function switchToTopicMode() {
      currentMode = 'topic';
      if (topicInputBtn) {
        topicInputBtn.style.background = '#00897b';
        topicInputBtn.style.color = '#fff';
      }
      if (textInputBtn) {
        textInputBtn.style.background = '#e1e8ed';
        textInputBtn.style.color = '#666';
      }
      if (passageInput) passageInput.style.display = 'none';
      if (topicInput) topicInput.style.display = 'block';
      if (generateBtn) generateBtn.textContent = 'Generate';
      const extractionBar = modal.querySelector('#vocab-extraction-bar');
      if (extractionBar) extractionBar.style.display = 'flex';
    }
    
    if (textInputBtn) textInputBtn.onclick = switchToTextMode;
    if (topicInputBtn) topicInputBtn.onclick = switchToTopicMode;
    
    // Initialize in topic mode
    switchToTopicMode();
    
    return { currentMode: () => currentMode, switchToTextMode, switchToTopicMode };
  }

  // Table style modal setup
  function setupTableStyleModal(modal) {
    const tableStyleBtn = modal.querySelector('#vocab-table-style-btn');
    const tableStyleModal = modal.querySelector('#vocab-table-style-modal');
    const tableStyleClose = modal.querySelector('#vocab-table-style-close');
    const styleOptions = modal.querySelectorAll('.vocab-style-option');
    let currentTableStyle = 'numbered'; // Default style
    
    // Table style modal functionality
    if (tableStyleBtn && tableStyleModal && tableStyleClose) {
      tableStyleBtn.onclick = function() {
        tableStyleModal.style.display = 'flex';
      };
      tableStyleClose.onclick = function() {
        tableStyleModal.style.display = 'none';
      };
      // Style option clicks
      styleOptions.forEach(option => {
        option.onclick = function() {
          currentTableStyle = this.getAttribute('data-value');
          // Update preview if current format is side-by-side
          const formatSelect = modal.querySelector('#vocab-list-format');
          if (formatSelect && formatSelect.value === 'sidebyside') {
            if (window.updateVocabPreview) window.updateVocabPreview();
          }
          // Close modal
          tableStyleModal.style.display = 'none';
        };
      });
    }
    
    return { getCurrentTableStyle: () => currentTableStyle };
  }

  // Export UI functions
  window.MintAIVocabUI = {
    populateLayoutsModal,
    setupLanguagePicker,
    setupFontControls,
    setupModeSwitch,
    setupTableStyleModal
  };
})();
