// left-toolbar.js
// Centralized logic for left toolbar buttons in worksheet builder

// Import left-toolbar styles
const styleSheet = document.createElement('link');
styleSheet.rel = 'stylesheet';
styleSheet.href = './left-toolbar.css';
document.head.appendChild(styleSheet);

(function() {
  document.addEventListener('DOMContentLoaded', function() {
    const leftToolbar = document.querySelector('.left-toolbar');
    if (!leftToolbar) return;

    // Insert Header button
    if (!document.getElementById('insert-header-tool')) {
      const headerBtn = document.createElement('button');
      headerBtn.id = 'insert-header-tool';
      headerBtn.title = 'Insert Header';
      headerBtn.className = 'left-toolbar-btn';
      headerBtn.innerHTML = `
        <img src="./icons/header-icon.svg" alt="Header Icon" style="width: 60px; height: 60px; display: block; margin: 0 auto 4px auto; filter: drop-shadow(0 0 2px #a3d8b0);" />
        <span style="font-size:0.8em;color:#6b7b6e;font-family:Poppins, sans-serif;font-weight:600;display:block;margin:0;vertical-align:top;">Header</span>
      `;
      leftToolbar.insertBefore(headerBtn, leftToolbar.firstChild);
      
      // Wire up click event to open header modal
      headerBtn.addEventListener('click', function() {
        if (window.openHeaderModal) {
          window.openHeaderModal();
        }
      });
    }

    // Insert Text Box button
    if (!document.getElementById('insert-text-tool')) {
      const textBtn = document.createElement('button');
      textBtn.id = 'insert-text-tool';
      textBtn.title = 'Insert Text Box';
      textBtn.className = 'left-toolbar-btn';
      textBtn.innerHTML = `
        <img src="./icons/text-box-icon.svg" alt="Text Box Icon" style="width: 60px; height: 60px; display: block; margin: 0 auto 4px auto; filter: drop-shadow(0 0 2px #a8d8f0);" />
        <span style="font-size:0.8em;color:#6b7b6e;font-family:Poppins, sans-serif;font-weight:600;display:block;margin:0;vertical-align:top;">Text Box</span>
      `;
      leftToolbar.appendChild(textBtn);
    }

    // Insert Vocab Box button
    if (!document.getElementById('insert-vocab-tool')) {
      const vocabBtn = document.createElement('button');
      vocabBtn.id = 'insert-vocab-tool';
      vocabBtn.title = 'Insert Vocab Box';
      vocabBtn.className = 'left-toolbar-btn';
      vocabBtn.innerHTML = `
        <img src="./icons/vocab-box-icon.svg" alt="Vocab Box Icon" style="width: 60px; height: 60px; display: block; margin: 0 auto 4px auto; filter: drop-shadow(0 0 2px #f8c6d8);" />
        <span style="font-size:0.8em;color:#6b7b6e;font-family:Poppins, sans-serif;font-weight:600;display:block;margin:0;vertical-align:top;">Vocab Box</span>
      `;
      leftToolbar.appendChild(vocabBtn);

      // Wire up click event for vocab box functionality (Mint AI modal)
      vocabBtn.addEventListener('click', function() {
        console.log('🖱️ Vocab Box button clicked!');
        console.log('🔍 Checking for openVocabBoxModal function:', typeof window.openVocabBoxModal);
        
        // Dynamically load the modal script if not present
        if (window.openVocabBoxModal) {
          console.log('✅ Function exists, calling openVocabBoxModal()');
          window.openVocabBoxModal();
        } else {
          console.log('❌ Function not found, loading script...');
          const script = document.createElement('script');
          script.src = 'mint-ai/mint-ai-vocab-modal-fixed.js';
          script.onload = function() {
            console.log('📜 Script loaded, checking function again:', typeof window.openVocabBoxModal);
            if (window.openVocabBoxModal) {
              console.log('✅ Now calling openVocabBoxModal()');
              window.openVocabBoxModal();
            } else {
              console.error('❌ Function still not available after script load');
            }
          };
          script.onerror = function(error) {
            console.error('❌ Script failed to load:', error);
          };
          document.body.appendChild(script);
        }
      });
    }

    // Insert Picture Activities button
    if (!document.getElementById('insert-picture-activities-tool')) {
      const pictureBtn = document.createElement('button');
      pictureBtn.id = 'insert-picture-activities-tool';
      pictureBtn.title = 'Picture Activities';
      pictureBtn.className = 'left-toolbar-btn';
      pictureBtn.innerHTML = `
        <img src="./icons/picture-activities-icon.svg" alt="Picture Activities Icon" style="width: 60px; height: 60px; display: block; margin: 0 auto 4px auto; filter: drop-shadow(0 0 2px #c084fc);" />
        <span style="font-size:0.8em;color:#6b7b6e;font-family:Poppins, sans-serif;font-weight:600;display:block;margin:0;vertical-align:top;">Picture Activities</span>
      `;
      leftToolbar.appendChild(pictureBtn);

      // Wire up click event for picture activities functionality
      pictureBtn.addEventListener('click', function() {
        // Open the new picture activity modal
        if (window.openPictureActivityModal) {
          window.openPictureActivityModal();
        } else {
          const script = document.createElement('script');
          script.src = 'mint-ai/mint-ai-picture-modal.js';
          script.onload = function() {
            if (window.openPictureActivityModal) window.openPictureActivityModal();
          };
          document.body.appendChild(script);
        }
      });
    }

    // Insert Template button
    if (!document.getElementById('template-tool')) {
      const templateBtn = document.createElement('button');
      templateBtn.id = 'template-tool';
      templateBtn.title = 'Templates (Coming soon)';
      templateBtn.className = 'left-toolbar-btn';
      templateBtn.innerHTML = `
        <img src="./icons/template-icon.svg" alt="Template Icon" style="width: 60px; height: 60px; display: block; margin: 0 auto 4px auto;" />
        <span style="font-size:0.8em;color:#6b7b6e;font-family:Poppins, sans-serif;font-weight:600;display:block;margin:0;vertical-align:top;">Templates</span>
      `;
      leftToolbar.insertBefore(templateBtn, leftToolbar.firstChild);
      templateBtn.addEventListener('click', function() {
        if (window.openTemplateModal) {
          window.openTemplateModal();
        } else {
          const script = document.createElement('script');
          script.src = 'template-modal.js';
          script.onload = function() {
            if (window.openTemplateModal) window.openTemplateModal();
          };
          document.head.appendChild(script);
        }
      });
    }
  });
})();
