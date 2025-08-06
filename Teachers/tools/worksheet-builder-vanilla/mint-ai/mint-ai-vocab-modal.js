// mint-ai-vocab-modal.js: Mint AI Vocab Box Modal logic, styled and wired like mint-ai
(function() {
  // Helper: Parse word list textarea into array of {eng, kor}
  function parseWordList(text) {
    return text.split('\n').map(line => {
      const [eng, kor] = line.split(',').map(s => (s||'').trim());
      if (!eng) return null;
      return { eng, kor: kor||'' };
    }).filter(Boolean);
  }

  // Helper: Render preview - 3 simple layout options
  function renderPreview(words, format) {
    if (!words.length) return '<div style="color:#aaa;font-size:1.1em;">No words to preview.</div>';
    
    // Debug: log the format being used
    console.log('renderPreview called with format:', format);
    
    switch(format) {
      case 'sidebyside':
        // Side-by-side table layout with editable cells
        const tableRows = words.map(w => 
          `<tr>` +
          `<td style="padding:10px 16px;border:1px solid #e1e8ed;border-bottom:1px solid #d1d8dd;font-weight:600;" contenteditable="true">${w.eng}</td>` +
          `<td style="padding:10px 16px;border:1px solid #e1e8ed;border-bottom:1px solid #d1d8dd;color:#666;" contenteditable="true">${w.kor || ''}</td>` +
          `</tr>`
        ).join('');
        // Add 3 empty rows for additional entries
        const emptyRows = Array(3).fill().map(() => 
          `<tr>` +
          `<td style="padding:10px 16px;border:1px solid #e1e8ed;border-bottom:1px solid #d1d8dd;font-weight:600;" contenteditable="true"></td>` +
          `<td style="padding:10px 16px;border:1px solid #e1e8ed;border-bottom:1px solid #d1d8dd;color:#666;" contenteditable="true"></td>` +
          `</tr>`
        ).join('');
        
        return `<table style="width:100%;border-collapse:collapse;font-family:'Poppins',Arial,sans-serif;">` +
          `<thead><tr>` +
          `<th style="padding:12px 16px;background:#f8fafd;border:2px solid #93cbcf;font-weight:700;color:#00897b;text-align:left;" contenteditable="true">English</th>` +
          `<th style="padding:12px 16px;background:#f8fafd;border:2px solid #93cbcf;font-weight:700;color:#00897b;text-align:left;" contenteditable="true">L2</th>` +
          `</tr></thead><tbody>` +
          tableRows + emptyRows +
          '</tbody></table>';
      
      case 'basic':
        // Simple list layout
        return `<ul style="list-style:disc inside;line-height:2.2;font-family:'Poppins',Arial,sans-serif;">` +
          words.map(w => `<li style="margin-bottom:8px;"><b>${w.eng}</b>${w.kor ? ' — ' + w.kor : ''}</li>`).join('') + '</ul>';
      
      case 'cards':
        // Cards grid layout
        return `<div style='display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;font-family:"Poppins",Arial,sans-serif;'>` +
          words.map(w => 
            `<div style='border:2px solid #e1e8ed;border-radius:12px;padding:16px;text-align:center;background:#fafbfc;'>` +
            `<div style='font-size:1.1em;font-weight:700;color:#00897b;margin-bottom:8px;'>${w.eng}</div>` +
            `<div style='color:#666;font-size:0.95em;'>${w.kor || ''}</div>` +
            `</div>`
          ).join('') + '</div>';
      
      default:
        console.log('Unknown format encountered:', format);
        return '<div style="color:#aaa;">Unknown format: ' + format + '</div>';
    }
  }

  // AI extraction (uses same endpoint as wordtest)
  async function extractWordsWithAI(passage, numWords, difficulty) {
    const resp = await fetch('/.netlify/functions/openai_proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: 'chat/completions',
        payload: {
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: 'You are a helpful teaching assistant.' },
            { role: 'user', content: `Extract exactly ${numWords} ${difficulty} English words or phrases from the passage below. For each, provide the English, then a comma, then the Korean translation. Return each pair on a new line in the format: english, korean.\n\nPassage:\n${passage}` }
          ],
          max_tokens: 1200
        }
      })
    });
    const data = await resp.json();
    return data.data.choices?.[0]?.message?.content || '';
  }

  // AI topic generation
  async function generateWordsFromTopic(topic, numWords, difficulty) {
    const resp = await fetch('/.netlify/functions/openai_proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: 'chat/completions',
        payload: {
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: 'You are a helpful teaching assistant creating vocabulary lists for English language learners.' },
            { role: 'user', content: `Generate exactly ${numWords} ${difficulty} English words related to the topic "${topic}". For each word, provide the English, then a comma, then the Korean translation. Return each pair on a new line in the format: english, korean. Make the words appropriate for English language learners.` }
          ],
          max_tokens: 1200
        }
      })
    });
    const data = await resp.json();
    return data.data.choices?.[0]?.message?.content || '';
  }

  // Modal logic
  window.openVocabBoxModal = function() {
    if (document.getElementById('vocab-box-modal')) return;
    fetch('mint-ai/mint-ai-vocab-modal.html').then(r => r.text()).then(html => {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = html;
      document.body.appendChild(wrapper);
      const modal = document.getElementById('vocab-box-modal');
      // Language picker modal logic
      const langPickerModal = modal.querySelector('#vocab-lang-picker-modal');
      let langPickerTarget = null; // 'target' or 'student'
      const langDisplayTarget = modal.querySelector('#vocab-target-lang-display');
      const langDisplayStudent = modal.querySelector('#vocab-student-lang-display');
      const langPickerCancel = modal.querySelector('#vocab-lang-picker-cancel');
      const langOptions = [
        { value: 'en', label: 'English', flag: 'mint-ai/flags/en.svg' },
        { value: 'ko', label: 'Korean', flag: 'mint-ai/flags/kr.svg' },
        { value: 'ja', label: 'Japanese', flag: 'mint-ai/flags/jp.svg' },
        { value: 'zh', label: 'Chinese', flag: 'mint-ai/flags/cn.svg' },
        { value: 'es', label: 'Spanish', flag: 'mint-ai/flags/es.svg' }
      ];
      let selectedTargetLang = 'en';
      let selectedStudentLang = 'ko';
      function updateLangDisplays() {
        const t = langOptions.find(l => l.value === selectedTargetLang);
        const s = langOptions.find(l => l.value === selectedStudentLang);
        if (t) {
          langDisplayTarget.querySelector('img').src = t.flag;
          langDisplayTarget.querySelector('img').alt = t.label;
          langDisplayTarget.querySelector('span').textContent = t.label;
        }
        if (s) {
          langDisplayStudent.querySelector('img').src = s.flag;
          langDisplayStudent.querySelector('img').alt = s.label;
          langDisplayStudent.querySelector('span').textContent = s.label;
        }
      }
      langDisplayTarget.onclick = function() {
        langPickerTarget = 'target';
        langPickerModal.style.display = 'flex';
      };
      langDisplayStudent.onclick = function() {
        langPickerTarget = 'student';
        langPickerModal.style.display = 'flex';
      };
      langPickerCancel.onclick = function() {
        langPickerModal.style.display = 'none';
      };
      // Option click
      langPickerModal.querySelectorAll('.lang-picker-option').forEach(opt => {
        opt.onclick = function() {
          const val = this.getAttribute('data-value');
          if (langPickerTarget === 'target') selectedTargetLang = val;
          if (langPickerTarget === 'student') selectedStudentLang = val;
          updateLangDisplays();
          langPickerModal.style.display = 'none';
        };
      });
      updateLangDisplays();
      // Elements
      const titleInput = modal.querySelector('#vocab-title');
      const passageInput = modal.querySelector('#vocab-passage');
      const topicInput = modal.querySelector('#vocab-topic-input');
      const textInputBtn = modal.querySelector('#text-input-btn');
      const topicInputBtn = modal.querySelector('#topic-input-btn');
      const importBtn = modal.querySelector('#vocab-import-btn');
      const moreOptionsBtn = modal.querySelector('#vocab-more-options-btn');
      const moreOptionsModal = modal.querySelector('#vocab-more-options-modal');
      const moreOptionsClose = modal.querySelector('#vocab-more-options-close');

      // Layout modal elements
      const layoutsBtn = modal.querySelector('#vocab-layouts-btn');
      const layoutsModal = modal.querySelector('#vocab-layouts-modal');
      const layoutsClose = modal.querySelector('#vocab-layouts-close');
      const layoutOptions = modal.querySelectorAll('.vocab-layout-option');
      
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
            const formatSelect = modal.querySelector('#vocab-list-format');
            if (formatSelect) {
              formatSelect.value = format;
              // Trigger change event for preview update
              formatSelect.dispatchEvent(new Event('change'));
            }
            // Close modal
            layoutsModal.style.display = 'none';
          };
        });
      }

      // Get all required elements first
      const diffInput = modal.querySelector('#vocab-difficulty');
      const numInput = modal.querySelector('#vocab-numwords');
      const generateBtn = modal.querySelector('#vocab-generate-btn');
      const clearBtn = modal.querySelector('#vocab-clear-btn');
      const wordlistInput = modal.querySelector('#vocab-wordlist');
      const formatInput = modal.querySelector('#vocab-list-format');
      const previewArea = modal.querySelector('#vocab-preview-area');
      const insertBtn = modal.querySelector('#vocab-insert-btn');
      const cancelBtn = modal.querySelector('#vocab-cancel-btn');
      const closeBtn = modal.querySelector('#close-vocab-modal');

      // Mode switching functionality (moved from HTML inline script)
      let currentMode = 'topic'; // 'topic' is default
      function switchToTextMode() {
        currentMode = 'text';
        textInputBtn.style.background = '#00897b';
        textInputBtn.style.color = '#fff';
        topicInputBtn.style.background = '#e1e8ed';
        topicInputBtn.style.color = '#666';
        passageInput.style.display = 'block';
        topicInput.style.display = 'none';
        generateBtn.textContent = 'Extract';
      }
      function switchToTopicMode() {
        currentMode = 'topic';
        topicInputBtn.style.background = '#00897b';
        topicInputBtn.style.color = '#fff';
        textInputBtn.style.background = '#e1e8ed';
        textInputBtn.style.color = '#666';
        passageInput.style.display = 'none';
        topicInput.style.display = 'block';
        generateBtn.textContent = 'Generate';
      }
      textInputBtn.onclick = switchToTextMode;
      topicInputBtn.onclick = switchToTopicMode;
      // Initialize in topic mode
      switchToTopicMode();

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

      // Live preview update
      function updatePreview() {
        const words = parseWordList(wordlistInput.value);
        const format = formatInput.value;
        console.log('updatePreview: formatInput.value =', format);
        console.log('updatePreview: formatInput element =', formatInput);
        previewArea.innerHTML = renderPreview(words, format);
      }
      wordlistInput.addEventListener('input', updatePreview);
      formatInput.addEventListener('change', updatePreview);
      updatePreview();

      // Generate/Extract words with AI based on current mode
      generateBtn.onclick = async function() {
        generateBtn.disabled = true;
        const originalText = generateBtn.textContent;
        generateBtn.textContent = currentMode === 'text' ? 'Extracting...' : 'Generating...';
        
        try {
          const num = parseInt(numInput.value) || 10;
          const diff = diffInput.value;
          let aiResult = '';
          
          if (currentMode === 'text') {
            // Extract from passage
            const passage = passageInput.value.trim();
            if (!passage) { 
              alert('Please enter a passage to extract words from.'); 
              return; 
            }
            aiResult = await extractWordsWithAI(passage, num, diff);
          } else {
            // Generate from topic
            const topic = topicInput.value.trim();
            if (!topic) { 
              alert('Please enter a topic to generate words for.'); 
              return; 
            }
            aiResult = await generateWordsFromTopic(topic, num, diff);
          }
          
          wordlistInput.value = aiResult.trim();
          updatePreview();
        } catch (error) {
          console.error('Error:', error);
          alert('Error generating words. Please try again.');
        } finally {
          generateBtn.disabled = false;
          generateBtn.textContent = originalText;
        }
      };
      // Clear all
      clearBtn.onclick = function() {
        wordlistInput.value = '';
        updatePreview();
      };
      // Cancel/close
      function closeModal() { wrapper.remove(); }
      cancelBtn.onclick = closeModal;
      closeBtn.onclick = closeModal;
      // Insert vocab box into worksheet
        // Insert logic (fix: insert correct vocab box HTML)
        document.getElementById('vocab-insert-btn').onclick = function() {
          // Find the selected page, or fallback to last page
          const selected = document.querySelector('.page-preview-a4.selected');
          const pagesEls = document.querySelectorAll('.page-preview-a4');
          if (!pagesEls.length) return;
          const pageEl = selected || pagesEls[pagesEls.length - 1];
          // Find the page index
          const pageIdx = Array.from(pagesEls).indexOf(pageEl);
          if (pageIdx === -1) return;
          // Calculate position: horizontally centered, vertically 20% from top minus 100px (not less than 0)
          const previewRect = pageEl.getBoundingClientRect();
          let left = 80, top = 80;
          const boxWidth = 750, boxHeight = 400;
          if (previewRect) {
            left = Math.max(0, Math.round((previewRect.width - boxWidth) / 2));
            top = Math.max(0, Math.round(previewRect.height * 0.2) - 100);
            // Offset for subsequent boxes on the same page
            const pageBoxes = window.worksheetState.getPages()[pageIdx]?.boxes || [];
            if (pageBoxes.length > 0) {
              top += pageBoxes.length * 40;
            }
          }
          // Render the vocab box HTML (title + preview)
          const words = parseWordList(wordlistInput.value);
          const format = formatInput.value;
          if (!words.length) { alert('No words to insert.'); return; }
          const vocabBoxHTML = `<div style='padding:12px 18px 8px 18px;'><div style='font-size:1.1em;font-weight:700;margin-bottom:8px;'>${titleInput.value||''}</div>${renderPreview(words, format)}</div>`;
          // Add a new box to the data model
          const boxData = {
            left: left + 'px',
            top: top + 'px',
            width: boxWidth + 'px',
            height: boxHeight + 'px',
            text: vocabBoxHTML,
            html: vocabBoxHTML, // HTML content for renderer to use innerHTML
            borderOn: true,
            borderColor: '#e1e8ed',
            borderWeight: 1.5,
            borderRadius: 4,
            lineHeight: '1.8'
          };
          // Save to history before adding new textbox
          if (window.saveToHistory) window.saveToHistory('add textbox');
          if (!window.worksheetState.getPages()[pageIdx]) window.worksheetState.getPages()[pageIdx] = { boxes: [] };
          window.worksheetState.getPages()[pageIdx].boxes.push(boxData);
          // Re-render to show the new box
          if (window.renderPages) window.renderPages();
          // Close the modal
          document.getElementById('vocab-box-modal').remove();
        };
    });
  };
})();
