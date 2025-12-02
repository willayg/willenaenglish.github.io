// insert-header-tool.js
// Logic for the 'Insert Header' tool in the worksheet builder

(function() {
  // Expose modal logic as window.openHeaderModal immediately
  window.openHeaderModal = function() {
    console.log('Header modal opening...'); // Debug log
    
    // Wait for header templates to load if they're not ready yet
    function waitForTemplates(callback, retries = 10) {
      if (window.headerTemplates && window.headerTemplates.templates) {
        callback();
      } else if (retries > 0) {
        console.log('Waiting for header templates to load... retries left:', retries);
        setTimeout(() => waitForTemplates(callback, retries - 1), 100);
      } else {
        console.warn('Header templates failed to load, using fallback');
        callback(); // Use fallback
      }
    }
    
    function createModal() {
      // Remove any existing modal
      const oldModal = document.getElementById('header-modal');
      if (oldModal && oldModal.parentElement) oldModal.parentElement.removeChild(oldModal);
        // Create modal wrapper
        const modal = document.createElement('div');
        modal.id = 'header-modal';
        
        // Load saved position or use defaults
        const savedPosition = JSON.parse(localStorage.getItem('headerModalPosition') || '{"top": 220, "left": 120}');
        
        modal.style = `position:fixed;top:${savedPosition.top}px;left:${savedPosition.left}px;z-index:12000;background:linear-gradient(135deg, rgba(160, 211, 195, 0.18) 0%, rgba(117, 174, 182, 0.18) 100%);border-radius:16px;box-shadow:0 8px 32px 0 rgba(96, 96, 100, 0.13);padding:2px 18px 24px 18px;width:420px;max-width:96vw;border:2px solid #405554ff;cursor:move;backdrop-filter: blur(16px) saturate(180%);-webkit-backdrop-filter: blur(16px) saturate(180%);`;
        
        // Generate header previews dynamically
        function generateHeaderPreviews() {
          // Check if header templates are loaded
          if (!window.headerTemplates || !window.headerTemplates.templates) {
            console.error('Header templates not loaded');
            // Return fallback with basic template
            return `
              <div class="header-style" data-style="basic1" style="cursor:pointer;width:100%;box-sizing:border-box;border:2px solid #e1e8ed;border-radius:8px;padding:0;margin-bottom:8px;">
                <div style="padding:16px;border-bottom:1px solid #e1e8ed;display:flex;align-items:center;justify-content:center;">
                  <img src="../../../../Assets/Images/color-logo1.png" alt="Logo" style="height:45px;margin-right:6px;">
                  <span class="preview-title" style="font-size:0.8em;font-weight:600;font-family:Roboto,sans-serif;white-space:nowrap;margin:0 auto;">Worksheet Title</span>
                  <div style="margin-left:auto;font-size:0.7em;color:#666;font-family:Roboto,sans-serif;white-space:nowrap;">Name: ______ Date: ______</div>
                </div>
              </div>
              <div style="padding:16px;text-align:center;color:#666;font-style:italic;">Header templates loading...</div>
            `;
          }
          
          console.log('Generating previews for templates:', Object.keys(window.headerTemplates.templates));
          
          let previewsHTML = '';
          const templates = window.headerTemplates.templates;
          const logoSrc = '../../../../Assets/Images/color-logo1.png';
          
          // Generate all previews at once
          Object.keys(templates).forEach(styleKey => {
            try {
              // Generate preview HTML using the actual template
              let templateHTML = window.headerTemplates.generateHTML(styleKey, 'Worksheet Title', logoSrc);
              
              // Create smaller preview by modifying the template HTML directly
              // Scale down font sizes, padding, and image heights for preview
              templateHTML = templateHTML
                .replace(/font-size:2em/g, 'font-size:1em')
                .replace(/font-size:1\.5em/g, 'font-size:0.9em')
                .replace(/font-size:1\.2em/g, 'font-size:0.8em')
                .replace(/font-size:1\.1em/g, 'font-size:0.7em')
                .replace(/height:75px/g, 'height:45px')
                .replace(/height:32px/g, 'height:20px')
                .replace(/padding:22px 18px/g, 'padding:8px 6px')
                .replace(/padding:16px 24px/g, 'padding:6px 8px')
                .replace(/padding:16px/g, 'padding:6px')
                .replace(/margin-right:6px/g, 'margin-right:3px')
                .replace(/margin-bottom:4px/g, 'margin-bottom:2px')
                .replace(/gap:18px/g, 'gap:6px');
              
              // Determine if this is a centered template for better height
              const isCentered = styleKey.includes('centered');
              const minHeight = isCentered ? '90px' : '65px';
              
              // Wrap in clickable preview container with dividing line below
              previewsHTML += `
                <div class="header-style" data-style="${styleKey}" style="cursor:pointer;width:100%;box-sizing:border-box;border:none;border-radius:8px;padding:0;margin-bottom:8px;height:auto;min-height:${minHeight};">
                  ${templateHTML}
                  <hr style="border:none;border-bottom:2px solid #b2d3db;margin:10px 0 23px 0;" />
                </div>`;
            } catch (error) {
              console.error(`Error generating template ${styleKey}:`, error);
              // Add a fallback for this template
              previewsHTML += `
                <div class="header-style" data-style="${styleKey}" style="cursor:pointer;width:100%;box-sizing:border-box;border:2px solid #e1e8ed;border-radius:8px;padding:16px;margin-bottom:8px;text-align:center;color:#999;">
                  Template ${styleKey} (error)
                </div>`;
            }
          });
          
          console.log('Generated HTML length:', previewsHTML.length);
          return previewsHTML;
        }

      // Header style previews and color choices
      modal.innerHTML = `
        <h2 style="font-family:Poppins,sans-serif;font-size:1.3em;margin-bottom:18px;color:#045c63;">Header</h2>
        <form id="header-edit-form" style="display:flex;flex-direction:column;gap:12px;">
          <label style="font-family:Poppins,sans-serif;">Title: <input type="text" id="header-title" value="Worksheet Title" style="width:120PX;padding:6px 10px;border-radius:6px;border:1px solid #cbd5e0;font-family:Poppins,sans-serif;"></label>
        </form>
        <div style="height:18px;"></div>
        <hr style="border:none;border-top:1.5px solid #e1e8ed;margin:0 0 18px 0;" />
        <div id="header-previews-container" style="max-height:300px;overflow-y:auto;margin-bottom:16px;display:flex;flex-direction:column;gap:8px;padding-right:8px;background:white;border-radius:10px;box-shadow:0 2px 8px rgba(60,60,80,0.06);border:2px solid #9eb8b9ff;scrollbar-width:thin;scrollbar-color:#b9f5d0 #e0f7fa;">
          <div style="padding:16px;text-align:center;color:#666;">Loading templates...</div>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:12px;">
          <button type="button" id="close-header-modal" style="padding:8px 18px;border-radius:8px;border:none;background:#e1e8ed;color:#333;font-family:Poppins,sans-serif;cursor:pointer;">Close</button>
        </div>
      `;
      document.body.appendChild(modal);
      
      // Add custom scrollbar styles for Webkit browsers
      const style = document.createElement('style');
      style.textContent = `
        #header-previews-container::-webkit-scrollbar {
          width: 10px;
          border-radius: 10px;
          background: #e0f7fa;
        }
        #header-previews-container::-webkit-scrollbar-thumb {
          background: linear-gradient(135deg, #b9f5d0 0%, #a0e9e0 100%);
          border-radius: 10px;
          border: 2px solid #e0f7fa;
        }
        #header-previews-container::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(135deg, #a0e9e0 0%, #b9f5d0 100%);
        }
      `;
      document.head.appendChild(style);
      
      // Generate and insert the previews after modal is in DOM
      const previewsContainer = modal.querySelector('#header-previews-container');
      const previewsHTML = generateHeaderPreviews();
      previewsContainer.innerHTML = previewsHTML;
      
      // Attach outside click handler after a short delay to avoid immediate close
      setTimeout(() => {
        function outsideClickHandler(e) {
          // Only close if modal is still present and click is outside
          if (modal.parentElement && !modal.contains(e.target)) {
            modal.parentElement.removeChild(modal);
            document.removeEventListener('mousedown', outsideClickHandler, true);
          }
        }
        document.addEventListener('mousedown', outsideClickHandler, true);
      }, 100);

      // Make modal draggable
      let isDragging = false;
      let dragOffsetX = 0;
      let dragOffsetY = 0;
      
      modal.addEventListener('mousedown', function(e) {
        // Only start dragging if clicking on the modal background (not on inputs, buttons, etc.)
        if (e.target === modal || e.target.closest('h2')) {
          isDragging = true;
          dragOffsetX = e.clientX - modal.offsetLeft;
          dragOffsetY = e.clientY - modal.offsetTop;
          modal.style.cursor = 'grabbing';
          e.preventDefault();
        }
      });
      
      document.addEventListener('mousemove', function(e) {
        if (isDragging && modal.parentElement) {
          const newLeft = e.clientX - dragOffsetX;
          const newTop = e.clientY - dragOffsetY;
          
          // Keep modal within viewport bounds
          const maxLeft = window.innerWidth - modal.offsetWidth;
          const maxTop = window.innerHeight - modal.offsetHeight;
          
          const boundedLeft = Math.max(0, Math.min(newLeft, maxLeft));
          const boundedTop = Math.max(0, Math.min(newTop, maxTop));
          
          modal.style.left = boundedLeft + 'px';
          modal.style.top = boundedTop + 'px';
          
          // Save position to localStorage
          localStorage.setItem('headerModalPosition', JSON.stringify({
            top: boundedTop,
            left: boundedLeft
          }));
        }
      });
      
      document.addEventListener('mouseup', function() {
        if (isDragging) {
          isDragging = false;
          modal.style.cursor = 'move';
        }
      });

      const titleInput = modal.querySelector('#header-title');

      // Title persistence: previously used localStorage (restored automatically across hard refreshes).
      // New behavior: use sessionStorage for automatic restore within a tab session.
      // If a legacy localStorage value exists BUT no session value yet, ask user whether to restore.
      const sessionTitle = (function(){ try { return sessionStorage.getItem('worksheetTitle'); } catch { return null; } })();
      const legacyTitle = (function(){ try { return localStorage.getItem('worksheetTitle'); } catch { return null; } })();
      if (sessionTitle) {
        titleInput.value = sessionTitle;
        titleInput.dispatchEvent(new Event('input'));
      } else if (!sessionTitle && legacyTitle) {
        // Prompt user for restoration to prevent unexpected carry-over between distinct worksheets
        try {
          if (confirm('Restore previous worksheet title?')) {
            titleInput.value = legacyTitle;
            titleInput.dispatchEvent(new Event('input'));
            try { sessionStorage.setItem('worksheetTitle', legacyTitle); } catch {}
          } else {
            // User opted not to restore; clear legacy to avoid future prompts.
            try { localStorage.removeItem('worksheetTitle'); } catch {}
          }
        } catch {}
      }

      // Save worksheet title to localStorage on change and update all previews
      titleInput.addEventListener('input', function() {
        const newTitle = titleInput.value;
        // Persist only in sessionStorage now for non-sticky session scoped behavior
        try { sessionStorage.setItem('worksheetTitle', newTitle); } catch {}
        // Remove legacy key to stop auto-persistence across new sessions
        try { localStorage.removeItem('worksheetTitle'); } catch {}

        // Regenerate all previews with the new title
        if (window.headerTemplates && window.headerTemplates.templates) {
          const templates = window.headerTemplates.templates;
          const logoSrc = '../../../../Assets/Images/color-logo1.png';
          let previewsHTML = '';
          Object.keys(templates).forEach(styleKey => {
            try {
              let templateHTML = window.headerTemplates.generateHTML(styleKey, newTitle, logoSrc);
              templateHTML = templateHTML
                .replace(/font-size:2em/g, 'font-size:1em')
                .replace(/font-size:1\.5em/g, 'font-size:0.9em')
                .replace(/font-size:1\.2em/g, 'font-size:0.8em')
                .replace(/font-size:1\.1em/g, 'font-size:0.7em')
                .replace(/height:75px/g, 'height:45px')
                .replace(/height:32px/g, 'height:20px')
                .replace(/padding:22px 18px/g, 'padding:8px 6px')
                .replace(/padding:16px 24px/g, 'padding:6px 8px')
                .replace(/padding:16px/g, 'padding:6px')
                .replace(/margin-right:6px/g, 'margin-right:3px')
                .replace(/margin-bottom:4px/g, 'margin-bottom:2px')
                .replace(/gap:18px/g, 'gap:6px');
              const isCentered = styleKey.includes('centered');
              const minHeight = isCentered ? '90px' : '65px';
              previewsHTML += `
                <div class="header-style" data-style="${styleKey}" style="cursor:pointer;width:100%;box-sizing:border-box;border:none;border-radius:8px;padding:0;margin-bottom:8px;height:auto;min-height:${minHeight};">
                  ${templateHTML}
                  <hr style="border:none;border-bottom:2px solid #b2d3db;margin:10px 0 23px 0;" />
                </div>`;
            } catch (error) {
              previewsHTML += `
                <div class="header-style" data-style="${styleKey}" style="cursor:pointer;width:100%;box-sizing:border-box;border:2px solid #e1e8ed;border-radius:8px;padding:16px;margin-bottom:8px;text-align:center;color:#999;">
                  Template ${styleKey} (error)
                </div>`;
            }
          });
          previewsContainer.innerHTML = previewsHTML;

          // Re-attach click handlers for style selection
          modal.querySelectorAll('.header-style').forEach(tpl => {
            tpl.addEventListener('click', function() {
              modal.querySelectorAll('.header-style').forEach(el => el.style.borderColor = '#e1e8ed');
              tpl.style.borderColor = '#045c63';
              selectedStyle = tpl.getAttribute('data-style');
              applyHeader(selectedStyle);
            });
          });
          // Restore selected style border
          const selected = modal.querySelector(`.header-style[data-style="${selectedStyle}"]`);
          if (selected) selected.style.borderColor = '#045c63';
        }
      });

      // Style selection logic with auto-apply
      let selectedStyle = 'basic1';
      
      // Function to apply header
      function applyHeader(style) {
  const title = modal.querySelector('#header-title').value;
  try { sessionStorage.setItem('worksheetTitle', title); } catch {}
  try { localStorage.removeItem('worksheetTitle'); } catch {}
        let logoSrc = '../../../../Assets/Images/color-logo1.png';
        
        // Use centralized header templates
        const headerHTML = window.headerTemplates 
          ? window.headerTemplates.generateHTML(style, title, logoSrc)
          : `<div style="padding:16px;border-bottom:1px solid #e1e8ed;display:flex;align-items:center;justify-content:center;">
              <img src="${logoSrc}" alt="Logo" style="height:32px;margin-right:8px;">
              <span style="font-size:1.5em;font-weight:600;font-family:Poppins,sans-serif;white-space:nowrap;margin:0 auto;">${title}</span>
              <div style="margin-left:auto;font-size:0.8em;color:#666;font-family:Poppins,sans-serif;white-space:nowrap;">Name: ______ Date: ______</div>
            </div>`;
        
        // Apply the header to all pages
        const pages = document.querySelectorAll('.page-preview-a4');
        pages.forEach((page, pageIndex) => {
          const existingHeader = page.querySelector('.worksheet-header');
          if (existingHeader) existingHeader.remove();
          
          // Save header data to the page model using consistent state system
          if (!window.worksheetState.getPages()[pageIndex]) window.worksheetState.getPages()[pageIndex] = { boxes: [] };
          window.worksheetState.getPages()[pageIndex].header = {
            style: style,
            title: title,
            logoSrc: logoSrc,
            borderOn: false,
            borderColor: '#e1e8ed',
            borderWeight: 1.5,
            borderRadius: 4
          };
          
          const headerDiv = document.createElement('div');
          headerDiv.className = 'worksheet-header';
          // Set fixed width and center
          headerDiv.style.width = '780px';
          headerDiv.style.margin = '5px auto 0 auto'; // 5px margin from top
          headerDiv.setAttribute('contenteditable', 'true');
          headerDiv.setAttribute('spellcheck', 'false');
          
          // Set border data attributes
          headerDiv.setAttribute('data-border-on', 'false');
          headerDiv.setAttribute('data-border-color', '#e1e8ed');
          headerDiv.setAttribute('data-border-width', '1.5');
          headerDiv.setAttribute('data-border-radius', '4');
          
          // Set header-specific data attributes so sync function can preserve them
          headerDiv.setAttribute('data-header-style', style);
          headerDiv.setAttribute('data-header-title', title);
          headerDiv.setAttribute('data-header-logo-src', logoSrc);
          
          headerDiv.innerHTML = headerHTML.replace(/\n/g, '');
          page.insertBefore(headerDiv, page.firstChild);

          // --- Make header resizable vertically with invisible handles ---
          // Remove any existing resize handle
          const oldHandle = headerDiv.querySelector('.header-resize-handle');
          if (oldHandle) oldHandle.remove();
          
          // Create invisible resize handle
          const resizeHandle = document.createElement('div');
          resizeHandle.className = 'header-resize-handle';
          resizeHandle.style = `
            position: absolute;
            left: 0; right: 0; bottom: -5px;
            height: 10px;
            cursor: ns-resize;
            z-index: 10;
            background: transparent;
            opacity: 0;
          `;
          
          // Make headerDiv position:relative for handle positioning
          headerDiv.style.position = 'relative';
          headerDiv.appendChild(resizeHandle);

          // Resizing logic that actually changes the header container size
          let isResizing = false;
          let startY = 0;
          let startHeight = 0;
          const minHeight = 40;
          
          resizeHandle.addEventListener('mousedown', function(e) {
            isResizing = true;
            startY = e.clientY;
            startHeight = headerDiv.offsetHeight;
            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'ns-resize';
            e.preventDefault();
            e.stopPropagation();
          });
          
          document.addEventListener('mousemove', function(e) {
            if (!isResizing) return;
            const dy = e.clientY - startY;
            let newHeight = Math.max(minHeight, startHeight + dy);
            // Resize the header container
            headerDiv.style.height = newHeight + 'px';
            headerDiv.style.overflow = 'hidden';
            // Ensure inner content is centered vertically and horizontally
            const innerContent = headerDiv.firstElementChild;
            if (innerContent) {
              innerContent.style.height = '100%';
              innerContent.style.display = 'flex';
              innerContent.style.alignItems = 'center';
              innerContent.style.justifyContent = 'center';
              innerContent.style.width = '100%';
              innerContent.style.boxSizing = 'border-box';
            }
          });
          
          document.addEventListener('mouseup', function() {
            if (isResizing) {
              isResizing = false;
              document.body.style.userSelect = '';
              document.body.style.cursor = '';
            }
          });

          // Auto-select the header and update toolbar immediately after insertion
          setTimeout(() => {
            document.querySelectorAll('.worksheet-header.selected').forEach(h => h.classList.remove('selected'));
            headerDiv.classList.add('selected');
            if (window.updateToolbarFromBox) window.updateToolbarFromBox(headerDiv);
          }, 0);
        });
        if (window.saveToHistory) window.saveToHistory('add header');
      }
      
      modal.querySelectorAll('.header-style').forEach(tpl => {
        tpl.addEventListener('click', function() {
          modal.querySelectorAll('.header-style').forEach(el => el.style.borderColor = '#e1e8ed');
          tpl.style.borderColor = '#045c63';
          selectedStyle = tpl.getAttribute('data-style');
          
          // Auto-apply the header immediately
          applyHeader(selectedStyle);
        });
      });
      
      // Default select first style
      modal.querySelector('.header-style').style.borderColor = '#045c63';

        // Close button logic
        modal.querySelector('#close-header-modal').addEventListener('click', function() {
          if (modal.parentElement) modal.parentElement.removeChild(modal);
        });
    } // End of createModal function
    
    // Start the template loading process
    waitForTemplates(createModal);
  }; // End of openHeaderModal function
})();