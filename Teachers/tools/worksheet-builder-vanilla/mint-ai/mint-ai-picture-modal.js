// mint-ai-picture-modal.js
// Modal logic for Picture Activities (image worksheet formats)

(function() {
  // Inject modal HTML if not present
  if (!document.getElementById('picture-activities-modal')) {
    fetch('mint-ai/mint-ai-picture-modal.html')
      .then(res => res.text())
      .then(html => {
        document.body.insertAdjacentHTML('beforeend', html);
        setupPictureModal();
      })
      .catch(err => {
        console.error('Error loading picture modal:', err);
      });
  } else {
    setupPictureModal();
  }

  function setupPictureModal() {
    const modal = document.getElementById('picture-activities-modal');
    if (!modal) return;

    // Forward declaration for updatePreview
    let updatePreview;

    // Elements
    const titleInput = modal.querySelector('#picture-title');
    const uploadArea = modal.querySelector('#picture-upload-area');
    const promptInput = modal.querySelector('#picture-prompt-input');
    const uploadBtn = modal.querySelector('#picture-upload-btn');
    const promptBtn = modal.querySelector('#picture-prompt-btn');
    const moreOptionsBtn = modal.querySelector('#picture-more-options-btn');
    const moreOptionsModal = modal.querySelector('#picture-more-options-modal');
    const moreOptionsClose = modal.querySelector('#picture-more-options-close');

    // Layout modal elements
    const layoutsBtn = modal.querySelector('#picture-layouts-btn');
    const layoutsModal = modal.querySelector('#picture-layouts-modal');
    const layoutsClose = modal.querySelector('#picture-layouts-close');
    const layoutOptions = modal.querySelectorAll('.picture-layout-option');
    
    // Style modal elements
    const styleBtn = modal.querySelector('#picture-style-btn');
    const styleModal = modal.querySelector('#picture-style-modal');
    const styleClose = modal.querySelector('#picture-style-close');
    const styleOptions = modal.querySelectorAll('.picture-style-option');

    // Get all required elements
    const activityTypeSelect = modal.querySelector('#picture-activity-type');
    const diffInput = modal.querySelector('#picture-difficulty');
    const numInput = modal.querySelector('#picture-numimages');
    const generateBtn = modal.querySelector('#picture-generate-btn');
    const clearBtn = modal.querySelector('#picture-clear-btn');
    const imagelistInput = modal.querySelector('#picture-imagelist');
    const formatInput = modal.querySelector('#picture-layout-format');
    const previewArea = modal.querySelector('#picture-preview-area');
    const insertBtn = modal.querySelector('#picture-insert-btn');
    const cancelBtn = modal.querySelector('#picture-cancel-btn');
    const closeBtn = modal.querySelector('#close-picture-modal');

    // Global function to open modal
    window.openPictureActivitiesModal = function() {
      modal.style.display = 'flex';
      if (previewArea) previewArea.innerHTML = '';
      updatePreview();
    };

    // Mode switching functionality
    let currentMode = 'prompt'; // 'prompt' or 'upload'
    function switchToUploadMode() {
      currentMode = 'upload';
      uploadBtn.style.background = '#f59e0b';
      uploadBtn.style.color = '#fff';
      promptBtn.style.background = '#e1e8ed';
      promptBtn.style.color = '#666';
      uploadArea.style.display = 'block';
      promptInput.style.display = 'none';
      generateBtn.textContent = 'Process';
    }
    function switchToPromptMode() {
      currentMode = 'prompt';
      promptBtn.style.background = '#f59e0b';
      promptBtn.style.color = '#fff';
      uploadBtn.style.background = '#e1e8ed';
      uploadBtn.style.color = '#666';
      uploadArea.style.display = 'none';
      promptInput.style.display = 'block';
      generateBtn.textContent = 'Generate';
    }
    if (uploadBtn) uploadBtn.onclick = switchToUploadMode;
    if (promptBtn) promptBtn.onclick = switchToPromptMode;
    // Initialize in prompt mode
    switchToPromptMode();

    // Show More Options modal
    if (moreOptionsBtn && moreOptionsModal) {
      moreOptionsBtn.onclick = function() {
        moreOptionsModal.style.display = 'flex';
      };
    }
    // Close More Options modal
    if (moreOptionsClose && moreOptionsModal) {
      moreOptionsClose.onclick = function() {
        moreOptionsModal.style.display = 'none';
      };
    }

    // Layout modal functionality
    if (layoutsBtn && layoutsModal && layoutsClose) {
      layoutsBtn.onclick = function() {
        layoutsModal.style.display = 'flex';
      };
      layoutsClose.onclick = function() {
        layoutsModal.style.display = 'none';
      };
      // Layout option clicks
      layoutOptions.forEach(option => {
        option.onclick = function() {
          const format = this.getAttribute('data-value');
          // Update hidden select
          if (formatInput) {
            formatInput.value = format;
          }
          updatePreview();
          // Close modal
          layoutsModal.style.display = 'none';
        };
      });
    }

    // Style modal functionality
    if (styleBtn && styleModal && styleClose) {
      styleBtn.onclick = function() {
        styleModal.style.display = 'flex';
      };
      styleClose.onclick = function() {
        styleModal.style.display = 'none';
      };
      // Style option clicks
      styleOptions.forEach(option => {
        option.onclick = function() {
          const style = this.getAttribute('data-value');
          // Update preview with new style
          updatePreview();
          // Close modal
          styleModal.style.display = 'none';
        };
      });
    }

    // Live preview update
    updatePreview = function() {
      const activityType = activityTypeSelect ? activityTypeSelect.value : 'labeling';
      const format = formatInput ? formatInput.value : 'grid';
      const numImages = numInput ? numInput.value : '4';
      
      if (previewArea) {
        previewArea.innerHTML = `
          <div style="padding:20px;background:#fef9e7;border-radius:12px;border:2px solid #f59e0b;text-align:center;">
            <h4 style="color:#f59e0b;margin-top:0;">Picture Activity Preview</h4>
            <div style="color:#666;margin-bottom:16px;">
              <strong>Type:</strong> ${activityType}<br>
              <strong>Layout:</strong> ${format}<br>
              <strong>Images:</strong> ${numImages}
            </div>
            <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin:16px 0;">
              ${Array.from({length: Math.min(4, parseInt(numImages) || 4)}, (_, i) => 
                `<div style="aspect-ratio:1;background:#f3f4f6;border:2px dashed #d1d5db;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:0.8em;">Image ${i+1}</div>`
              ).join('')}
            </div>
            <em style="color:#d97706;">Generate images to see full preview</em>
          </div>
        `;
      }
    };

    // Set up event listeners
    if (imagelistInput) imagelistInput.addEventListener('input', updatePreview);
    if (formatInput) formatInput.addEventListener('change', updatePreview);
    if (activityTypeSelect) activityTypeSelect.addEventListener('change', updatePreview);
    if (numInput) numInput.addEventListener('change', updatePreview);
    
    // Initial preview
    updatePreview();

    // Generate images with AI based on current mode
    if (generateBtn) {
      generateBtn.onclick = async function() {
        generateBtn.disabled = true;
        const originalText = generateBtn.textContent;
        generateBtn.textContent = currentMode === 'upload' ? 'Processing...' : 'Generating...';
        
        try {
          const num = parseInt(numInput.value) || 4;
          const diff = diffInput.value;
          const activityType = activityTypeSelect.value;
          
          if (currentMode === 'upload') {
            // Handle uploaded images
            imagelistInput.value = 'Uploaded images will be processed here...';
          } else {
            // Generate with AI prompt
            const prompt = promptInput.value.trim();
            if (!prompt) {
              alert('Please enter a prompt for image generation.');
              return;
            }
            
            // Simulate AI generation
            const mockImages = Array.from({length: num}, (_, i) => 
              `${prompt.replace(/\s+/g, '_').toLowerCase()}_${i+1}.jpg`
            ).join('\n');
            
            imagelistInput.value = mockImages;
          }
          
          updatePreview();
        } catch (error) {
          console.error('Error:', error);
          alert('Error generating images. Please try again.');
        } finally {
          generateBtn.disabled = false;
          generateBtn.textContent = originalText;
        }
      };
    }

    // Clear all
    if (clearBtn) {
      clearBtn.onclick = function() {
        if (imagelistInput) imagelistInput.value = '';
        if (promptInput) promptInput.value = '';
        updatePreview();
      };
    }

    // Cancel/close
    function closeModal() { 
      modal.style.display = 'none';
    }
    if (cancelBtn) cancelBtn.onclick = closeModal;
    if (closeBtn) closeBtn.onclick = closeModal;

    // Click outside to close
    modal.addEventListener('click', function(e) {
      if (e.target === modal) {
        closeModal();
      }
    });

    // Insert picture activity into worksheet
    if (insertBtn) {
      insertBtn.onclick = function() {
        // Find the selected page, or fallback to last page
        const selected = document.querySelector('.page-preview-a4.selected');
        const pagesEls = document.querySelectorAll('.page-preview-a4');
        if (!pagesEls.length) return;
        const pageEl = selected || pagesEls[pagesEls.length - 1];
        
        // Find the page index
        const pageIdx = Array.from(pagesEls).indexOf(pageEl);
        if (pageIdx === -1) return;
        
        // Calculate position
        const previewRect = pageEl.getBoundingClientRect();
        let left = 80, top = 80;
        const boxWidth = 750, boxHeight = 400;
        if (previewRect) {
          left = Math.max(0, Math.round((previewRect.width - boxWidth) / 2));
          top = Math.max(0, Math.round(previewRect.height * 0.2) - 100);
        }
        
        // Check if we have content to insert
        const images = imagelistInput ? imagelistInput.value.trim() : '';
        if (!images) { 
          alert('No images to insert. Please generate or upload images first.'); 
          return; 
        }
        
        // Create picture activity HTML
        const activityType = activityTypeSelect ? activityTypeSelect.value : 'labeling';
        const format = formatInput ? formatInput.value : 'grid';
        const title = titleInput ? titleInput.value : '';
        
        const pictureActivityHTML = `
          <div style='padding:12px 18px 8px 18px;'>
            ${title ? `<div style='font-size:1.1em;font-weight:700;margin-bottom:8px;'>${title}</div>` : ''}
            <div style='text-align:center;color:#f59e0b;font-weight:600;margin-bottom:12px;'>
              ${activityType.charAt(0).toUpperCase() + activityType.slice(1)} Activity
            </div>
            <div style='display:grid;grid-template-columns:repeat(2,1fr);gap:10px;'>
              ${images.split('\n').slice(0, 4).map((img, i) => 
                `<div style='aspect-ratio:1;background:#f9f9f9;border:2px solid #e5e5e5;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#666;font-size:0.9em;'>${img.trim() || `Image ${i+1}`}</div>`
              ).join('')}
            </div>
            <div style='margin-top:12px;color:#666;font-size:0.9em;text-align:center;'>
              <em>Picture activity generated by MINT AI</em>
            </div>
          </div>
        `;
        
        // Add a new box to the data model
        const boxData = {
          left: left + 'px',
          top: top + 'px',
          width: boxWidth + 'px',
          height: boxHeight + 'px',
          text: pictureActivityHTML,
          html: pictureActivityHTML,
          borderOn: true,
          borderColor: '#e1e8ed',
          borderWeight: 1.5,
          borderRadius: 4,
          lineHeight: '1.8'
        };
        
        // Save to history before adding new textbox
        if (window.saveToHistory) window.saveToHistory('add picture activity');
        if (!window.worksheetState.getPages()[pageIdx]) window.worksheetState.getPages()[pageIdx] = { boxes: [] };
        window.worksheetState.getPages()[pageIdx].boxes.push(boxData);
        
        // Re-render to show the new box
        if (window.renderPages) window.renderPages();
        
        // Close the modal
        closeModal();
      };
    }
  }
})();
