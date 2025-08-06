// Border Style Modal logic: open modal on textbox click
function initializeTextboxBorderAttributes(textbox) {
  if (!textbox.hasAttribute('data-border-on')) textbox.setAttribute('data-border-on', 'true');
  if (!textbox.hasAttribute('data-border-color')) textbox.setAttribute('data-border-color', '#b9f5d0');
  if (!textbox.hasAttribute('data-border-width')) textbox.setAttribute('data-border-width', '1.5');
  if (!textbox.hasAttribute('data-border-radius')) textbox.setAttribute('data-border-radius', '4');
}

// Listen for textbox creation (assumes textboxes are added with class 'worksheet-textbox')
const previewArea = document.getElementById('page-preview-area');
if (previewArea) {
  const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      mutation.addedNodes.forEach(function(node) {
        if (node.nodeType === 1 && node.classList.contains('worksheet-textbox')) {
          initializeTextboxBorderAttributes(node);
          // Apply styles from data attributes
          const borderOn = node.getAttribute('data-border-on') === 'true';
          const borderColorVal = node.getAttribute('data-border-color') || '#e1e8ed';
          const borderWidthVal = node.getAttribute('data-border-width') || '1.5';
          const borderRadiusVal = node.getAttribute('data-border-radius') || '4';
          if (borderOn) {
            node.style.borderStyle = 'solid';
            node.style.borderWidth = borderWidthVal + 'px';
            node.style.borderColor = borderColorVal || '#b9f5d0';
          } else {
            node.style.borderStyle = 'none';
            node.style.borderWidth = '0px';
          }
          node.style.borderRadius = borderRadiusVal + 'px';
        }
      });
    });
  });
  observer.observe(previewArea, { childList: true, subtree: true });
}

// Open border-style modal when a worksheet-textbox is clicked
document.addEventListener('click', function(e) {
  // Check if the clicked element is inside a textbox (including text content)
  const textbox = e.target.closest('.worksheet-textbox');
  if (textbox) {
    // Remove any existing modal
    const oldModal = document.getElementById('border-style-modal');
    if (oldModal && oldModal.parentElement) oldModal.parentElement.remove();
    fetch('border-style-modal.html')
      .then(resp => resp.text())
      .then(html => {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = html;
        // Style the modal as a floating panel to the left of the workspace
        const modal = wrapper.querySelector('#border-style-modal');
        if (modal) {
          modal.style.display = 'flex';
          modal.style.position = 'fixed';
          // Restore modal position from localStorage if available
          let savedLeft = localStorage.getItem('borderStyleModalLeft');
          let savedTop = localStorage.getItem('borderStyleModalTop');
          if (savedLeft && savedTop) {
            modal.style.left = savedLeft;
            modal.style.top = savedTop;
          } else {
            modal.style.left = '120px'; // right of left toolbar (90px) + 10px gap
            modal.style.top = '250px'; // below header+toolbar (96px) + 12px gap
          }
          modal.style.width = '320px';
          modal.style.height = 'auto';
          modal.style.background = 'none';
          modal.style.boxShadow = 'none';
          modal.style.zIndex = '2000';
          modal.style.alignItems = 'flex-start';
          modal.style.justifyContent = 'flex-start';
          // Remove full-screen overlay effect
          // Make modal 50% transparent and add dark cyan border to the panel
          const panel = modal.querySelector('div');
              if (panel) {
                panel.style.background = 'rgba(255,255,255,0.5)';
                panel.style.border = '2.5px solid #045c63';
                panel.style.boxShadow = '0 8px 32px 0 rgba(60,60,80,0.18)';
                // Make modal draggable from anywhere inside the panel
                let isDragging = false, dragOffsetX = 0, dragOffsetY = 0;
                panel.style.cursor = 'move';
                panel.addEventListener('mousedown', function(ev) {
                  // Only left mouse button
                  if (ev.button !== 0) return;
                  // Prevent drag if clicking on input, range, or color controls
                  const tag = ev.target.tagName.toLowerCase();
                  if (tag === 'input' || tag === 'select' || tag === 'textarea' || tag === 'button' || tag === 'label') return;
                  isDragging = true;
                  const rect = modal.getBoundingClientRect();
                  dragOffsetX = ev.clientX - rect.left;
                  dragOffsetY = ev.clientY - rect.top;
                  document.body.style.userSelect = 'none';
                });
                function onMouseMove(ev) {
                  if (isDragging) {
                    modal.style.left = (ev.clientX - dragOffsetX) + 'px';
                    modal.style.top = (ev.clientY - dragOffsetY) + 'px';
                  }
                }
                function onMouseUp() {
                  isDragging = false;
                  document.body.style.userSelect = '';
                  // Save modal position to localStorage
                  localStorage.setItem('borderStyleModalLeft', modal.style.left);
                  localStorage.setItem('borderStyleModalTop', modal.style.top);
                  window.removeEventListener('mousemove', onMouseMove);
                  window.removeEventListener('mouseup', onMouseUp);
                }
                panel.addEventListener('mousedown', function(ev) {
                  // Only left mouse button
                  if (ev.button !== 0) return;
                  window.addEventListener('mousemove', onMouseMove);
                  window.addEventListener('mouseup', onMouseUp);
                });
              }
        }
        document.body.appendChild(wrapper);
        // Get the current selected textbox dynamically 
        function getCurrentSelectedTextbox() {
          return document.querySelector('.worksheet-textbox.selected') || 
                 textbox || 
                 (window.worksheetState && window.worksheetState.getLastTextbox());
        }
        
        // Sync modal controls to textbox
        function syncModalToTextbox() {
          const selectedTextbox = getCurrentSelectedTextbox();
          if (!modal || !selectedTextbox) return;
          const borderOn = selectedTextbox.getAttribute('data-border-on') === 'true';
          const borderColorVal = selectedTextbox.getAttribute('data-border-color') || '#e1e8ed';
          const borderWidthVal = selectedTextbox.getAttribute('data-border-width') || '1.5';
          const borderRadiusVal = selectedTextbox.getAttribute('data-border-radius') || '4';
          modal.querySelector('#modal-border-toggle').checked = borderOn;
          modal.querySelector('#modal-border-switch').style.left = borderOn ? '22px' : '2px';
          modal.querySelector('#modal-border-status').textContent = borderOn ? 'On' : 'Off';
          // Update border color picker preview
          const borderPreview = document.getElementById('modal-border-color-preview');
          if (borderPreview) borderPreview.style.backgroundColor = borderColorVal;
          modal.querySelector('#modal-borderweight').value = parseFloat(borderWidthVal);
          modal.querySelector('#modal-borderweight-value').textContent = borderWidthVal + 'px';
          modal.querySelector('#modal-border-radius').value = parseInt(borderRadiusVal);
          modal.querySelector('#modal-border-radius-value').textContent = borderRadiusVal + 'px';

          // Fill controls sync
          const fillOn = selectedTextbox.getAttribute('data-fill-on') === 'true';
          const fillColorVal = selectedTextbox.getAttribute('data-fill-color') || '#ffffff';
          const fillOpacityVal = selectedTextbox.getAttribute('data-fill-opacity') || '1';
          modal.querySelector('#modal-fill-toggle').checked = fillOn;
          modal.querySelector('#modal-fill-switch').style.left = fillOn ? '22px' : '2px';
          modal.querySelector('#modal-fill-status').textContent = fillOn ? 'On' : 'Off';
          // Update fill color picker preview
          const fillPreview = document.getElementById('modal-fill-color-preview');
          if (fillPreview) fillPreview.style.backgroundColor = fillColorVal;
          modal.querySelector('#modal-fill-opacity').value = fillOpacityVal;
          modal.querySelector('#modal-fill-opacity').disabled = !fillOn;
          modal.querySelector('#modal-fill-opacity').style.opacity = fillOn ? '1' : '0.5';
          modal.querySelector('#modal-fill-opacity-value').textContent = Math.round(fillOpacityVal * 100) + '%';
        }
        syncModalToTextbox();
        
        // Initialize color pickers for the modal
        if (window.worksheetColorPicker && window.worksheetColorPicker.initializeModalPickers) {
          window.worksheetColorPicker.initializeModalPickers();
        }

        // Modal controls update textbox in real time
        modal.querySelector('#modal-border-toggle').addEventListener('change', function() {
          const selectedTextbox = getCurrentSelectedTextbox();
          if (!selectedTextbox) return;
          
          if (this.checked) {
            selectedTextbox.setAttribute('data-border-on', 'true');
            selectedTextbox.style.borderStyle = 'solid';
            selectedTextbox.style.borderWidth = modal.querySelector('#modal-borderweight').value + 'px';
            const borderColor = selectedTextbox.getAttribute('data-border-color') || '#e1e8ed';
            selectedTextbox.style.borderColor = borderColor || '#b9f5d0';
          } else {
            selectedTextbox.setAttribute('data-border-on', 'false');
            selectedTextbox.style.borderStyle = 'none';
            selectedTextbox.style.borderWidth = '0px';
          }
          syncModalToTextbox();
        });

        modal.querySelector('#modal-borderweight').addEventListener('input', function() {
          const selectedTextbox = getCurrentSelectedTextbox();
          if (!selectedTextbox) return;
          
          modal.querySelector('#modal-borderweight-value').textContent = this.value + 'px';
          selectedTextbox.setAttribute('data-border-width', this.value);
          if (modal.querySelector('#modal-border-toggle').checked) {
            selectedTextbox.style.borderWidth = this.value + 'px';
            selectedTextbox.style.borderStyle = 'solid';
          }
        });

        modal.querySelector('#modal-border-radius').addEventListener('input', function() {
          const selectedTextbox = getCurrentSelectedTextbox();
          if (!selectedTextbox) return;
          
          modal.querySelector('#modal-border-radius-value').textContent = this.value + 'px';
          selectedTextbox.setAttribute('data-border-radius', this.value);
          selectedTextbox.style.borderRadius = this.value + 'px';
        });

        // Utility to convert hex to rgba
        function hexToRgba(hex, opacity) {
          let c = hex.replace('#', '');
          if (c.length === 3) c = c[0]+c[0]+c[1]+c[1]+c[2]+c[2];
          const num = parseInt(c, 16);
          return `rgba(${(num >> 16) & 255},${(num >> 8) & 255},${num & 255},${opacity})`;
        }

        function applyFillToTextbox(textbox) {
          const fillOn = textbox.getAttribute('data-fill-on') === 'true';
          const fillColor = textbox.getAttribute('data-fill-color') || '#ffffff';
          const fillOpacity = textbox.getAttribute('data-fill-opacity') || '1';
          if (fillOn) {
            textbox.style.backgroundColor = hexToRgba(fillColor, fillOpacity);
          } else {
            textbox.style.backgroundColor = '';
          }
        }

        // Fill controls event listeners
        modal.querySelector('#modal-fill-toggle').addEventListener('change', function() {
          const selectedTextbox = getCurrentSelectedTextbox();
          if (!selectedTextbox) return;
          
          if (this.checked) {
            selectedTextbox.setAttribute('data-fill-on', 'true');
          } else {
            selectedTextbox.setAttribute('data-fill-on', 'false');
          }
          applyFillToTextbox(selectedTextbox);
          syncModalToTextbox();
        });

        modal.querySelector('#modal-fill-opacity').addEventListener('input', function() {
          const selectedTextbox = getCurrentSelectedTextbox();
          if (!selectedTextbox) return;
          
          const val = this.value;
          modal.querySelector('#modal-fill-opacity-value').textContent = Math.round(val * 100) + '%';
          selectedTextbox.setAttribute('data-fill-opacity', val);
          if (modal.querySelector('#modal-fill-toggle').checked) {
            applyFillToTextbox(selectedTextbox);
          }
        });

        // Ensure fill persists on focus/hover/blur for the current selected textbox
        function setupFillPersistence() {
          const selectedTextbox = getCurrentSelectedTextbox();
          if (!selectedTextbox) return;
          
          ['focus', 'blur', 'mouseenter', 'mouseleave'].forEach(evt => {
            selectedTextbox.addEventListener(evt, function() {
              applyFillToTextbox(this);
            });
          });
        }
        setupFillPersistence();

        // Hide modal on outside click
        function handleOutsideClick(ev) {
          // Allow clicks on the modal itself
          if (modal.contains(ev.target)) return;
          
          // Allow clicks on textboxes or any content inside textboxes
          const clickedTextbox = ev.target.closest('.worksheet-textbox');
          if (clickedTextbox) return;
          
          // Allow clicks on the main content area where textboxes live
          const contentArea = ev.target.closest('#page-preview-area');
          if (contentArea) return;
          
          // Allow clicks on the pastel toolbar (formatting controls)
          const toolbar = ev.target.closest('#pastel-toolbar');
          if (toolbar) return;
          
          // Allow clicks on any toolbar elements
          const anyToolbar = ev.target.closest('.pastel-toolbar, .left-toolbar, .top-actions');
          if (anyToolbar) return;
          
          // Only close modal for clicks truly outside the workspace and toolbars
          if (wrapper.parentElement) wrapper.parentElement.removeChild(wrapper);
          document.removeEventListener('mousedown', handleOutsideClick);
        }

        setTimeout(() => {
          document.addEventListener('mousedown', handleOutsideClick);
        }, 0);

        // Hide modal on close button
        const closeBtn = modal.querySelector('#close-border-modal');
        if (closeBtn) {
          closeBtn.addEventListener('click', function() {
            if (wrapper.parentElement) wrapper.parentElement.removeChild(wrapper);
            document.removeEventListener('mousedown', handleOutsideClick);
          });
        }
      });
  }
});

// On DOMContentLoaded, apply border styles from data attributes to all existing textboxes
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.worksheet-textbox').forEach(function(node) {
    // Ensure data attributes are initialized
    if (!node.hasAttribute('data-border-on')) node.setAttribute('data-border-on', 'true');
    if (!node.hasAttribute('data-border-color')) node.setAttribute('data-border-color', '#b9f5d0');
    if (!node.hasAttribute('data-border-width')) node.setAttribute('data-border-width', '1.5');
    if (!node.hasAttribute('data-border-radius')) node.setAttribute('data-border-radius', '4');
    // Apply styles from data attributes
    const borderOn = node.getAttribute('data-border-on') === 'true';
    const borderColorVal = node.getAttribute('data-border-color') || '#b9f5d0';
    const borderWidthVal = node.getAttribute('data-border-width') || '1.5';
    const borderRadiusVal = node.getAttribute('data-border-radius') || '4';
    if (borderOn) {
      node.style.borderStyle = 'solid';
      node.style.borderWidth = borderWidthVal + 'px';
      node.style.borderColor = borderColorVal;
    } else {
      node.style.borderStyle = 'none';
      node.style.borderWidth = '0px';
    }
    node.style.borderRadius = borderRadiusVal + 'px';
  });
});

// Border modal dynamic loader
document.addEventListener('DOMContentLoaded', function() {
  var borderBtn = document.getElementById('open-border-modal');
  if (borderBtn) {
    borderBtn.addEventListener('click', async function() {
      // Prevent multiple modals
      if (document.getElementById('border-style-modal')) return;
      const resp = await fetch('border-style-modal.html');
      const html = await resp.text();
      const wrapper = document.createElement('div');
      wrapper.innerHTML = html;
      document.body.appendChild(wrapper);
      // Close logic
      const closeBtn = wrapper.querySelector('#close-border-modal');
      if (closeBtn) {
        closeBtn.addEventListener('click', function() {
          wrapper.remove();
        });
      }
      // Also close on overlay click
      const modal = wrapper.querySelector('#border-style-modal');
      if (modal) {
        modal.addEventListener('click', function(e) {
          if (e.target === modal) wrapper.remove();
        });
      }
    });
  }
});
