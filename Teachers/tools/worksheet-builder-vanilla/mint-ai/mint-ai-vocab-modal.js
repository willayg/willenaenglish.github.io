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

  // Layout rendering is now handled by MintAIVocabLayouts.js

  // AI extraction (uses same endpoint as wordtest)
  async function extractWordsWithAI(passage, numWords, difficulty) {
    // Use selectedStudentLang to get the language label
    const lang = langOptions.find(l => l.value === selectedStudentLang)?.label || 'Korean';
    const resp = await fetch('/.netlify/functions/openai_proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: 'chat/completions',
        payload: {
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: 'You are a helpful teaching assistant.' },
            { role: 'user', content: `Extract exactly ${numWords} ${difficulty} English words or phrases from the passage below. For each, provide the English, then a comma, then the ${lang} translation. Return each pair on a new line in the format: english, ${lang.toLowerCase()}.\n\nPassage:\n${passage}` }
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
    // Use selectedStudentLang to get the language label
    const lang = langOptions.find(l => l.value === selectedStudentLang)?.label || 'Korean';
    const resp = await fetch('/.netlify/functions/openai_proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: 'chat/completions',
        payload: {
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: 'You are a helpful teaching assistant creating vocabulary lists for English language learners.' },
            { role: 'user', content: `Generate exactly ${numWords} ${difficulty} English words related to the topic "${topic}". For each word, provide the English, then a comma, then the ${lang} translation. Return each pair on a new line in the format: english, ${lang.toLowerCase()}. Make the words appropriate for English language learners.` }
          ],
          max_tokens: 1200
        }
      })
    });
    const data = await resp.json();
    return data.data.choices?.[0]?.message?.content || '';
  }

  // Modal logic
  // Make language options and selections globally accessible in this module
  const langOptions = [
    { value: 'en', label: 'English', flag: 'mint-ai/flags/en.svg' },
    { value: 'ko', label: 'Korean', flag: 'mint-ai/flags/kr.svg' },
    { value: 'ja', label: 'Japanese', flag: 'mint-ai/flags/jp.svg' },
    { value: 'zh', label: 'Chinese', flag: 'mint-ai/flags/cn.svg' },
    { value: 'es', label: 'Spanish', flag: 'mint-ai/flags/es.svg' }
  ];
  let selectedTargetLang = 'en';
  let selectedStudentLang = 'ko';

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

      // Table style modal elements
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
              updatePreview();
            }
            // Close modal
            tableStyleModal.style.display = 'none';
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
      // Font controls
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
        if (window.MintAIVocabLayouts && typeof window.MintAIVocabLayouts.renderPreview === 'function') {
          // Use styled version for side-by-side and double list tables
          if (format === 'sidebyside' && window.MintAIVocabLayouts.renderSideBySideWithStyle) {
            previewArea.innerHTML = window.MintAIVocabLayouts.renderSideBySideWithStyle(words, currentTableStyle);
          } else if (format === 'doublelist' && window.MintAIVocabLayouts.renderDoubleListWithStyle) {
            previewArea.innerHTML = window.MintAIVocabLayouts.renderDoubleListWithStyle(words, currentTableStyle);
          } else {
            previewArea.innerHTML = window.MintAIVocabLayouts.renderPreview(words, format);
          }
        } else {
          previewArea.innerHTML = '<div style="color:#aaa;">Layout module not loaded.</div>';
        }
        applyPreviewFontSettings();
      }
      // Set initial font settings
      applyPreviewFontSettings();
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
          
          let renderedContent = '';
          if (window.MintAIVocabLayouts) {
            // Use styled version for side-by-side and double list tables
            if (format === 'sidebyside' && window.MintAIVocabLayouts.renderSideBySideWithStyle) {
              renderedContent = window.MintAIVocabLayouts.renderSideBySideWithStyle(words, currentTableStyle);
            } else if (format === 'doublelist' && window.MintAIVocabLayouts.renderDoubleListWithStyle) {
              renderedContent = window.MintAIVocabLayouts.renderDoubleListWithStyle(words, currentTableStyle);
            } else {
              renderedContent = window.MintAIVocabLayouts.renderPreview(words, format);
            }
          }
          
          const vocabBoxHTML = `<div style='padding:12px 18px 8px 18px;'><div style='font-size:1.1em;font-weight:700;margin-bottom:8px;'>${titleInput.value||''}</div>${renderedContent}</div>`;
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
