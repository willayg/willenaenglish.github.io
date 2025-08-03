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

  // Helper: Render preview based on format
  function renderPreview(words, format) {
    if (!words.length) return '<div style="color:#aaa;font-size:1.1em;">No words to preview.</div>';
    switch(format) {
      case 'basic':
        return `<ul style="list-style:disc inside;line-height:2;">` +
          words.map(w => `<li><b>${w.eng}</b>${w.kor ? ' — ' + w.kor : ''}</li>`).join('') + '</ul>';
      case 'sidebyside':
        return `<table style="width:100%;border-collapse:collapse;">` +
          words.map(w => `<tr><td style='padding:4px 12px;border-bottom:1px solid #e1e8ed;'>${w.eng}</td><td style='padding:4px 12px;border-bottom:1px solid #e1e8ed;'>${w.kor}</td></tr>`).join('') + '</table>';
      case 'picturecards':
        return `<div style='display:grid;grid-template-columns:repeat(5,1fr);gap:12px;'>` +
          words.map(w => `<div style='border:1.5px solid #e1e8ed;border-radius:8px;padding:12px;text-align:center;min-height:60px;'><div style='font-size:1.2em;font-weight:600;'>${w.eng}</div><div style='color:#888;font-size:0.98em;'>${w.kor}</div></div>`).join('') + '</div>';
      case 'picturelist':
        return `<ul style='list-style:none;padding:0;'>` +
          words.map(w => `<li style='margin-bottom:10px;'><span style='font-weight:600;'>${w.eng}</span> <span style='color:#888;'>${w.kor}</span></li>`).join('') + '</ul>';
      case 'picturelist2':
        return `<table style='width:100%;'><tbody>` +
          words.map((w,i) => i%2===0?`<tr><td style='padding:6px 12px;'>${w.eng}</td><td style='padding:6px 12px;'>${words[i+1]?words[i+1].eng:''}</td></tr>`:'').join('') + '</tbody></table>';
      case 'picturequiz':
        return `<ol style='line-height:2;'>` +
          words.map(w => `<li><span style='font-weight:600;'>${w.eng}</span> ________</li>`).join('') + '</ol>';
      case 'picturequiz5':
        return `<div style='display:grid;grid-template-columns:repeat(5,1fr);gap:12px;'>` +
          words.map(w => `<div style='border:1.5px solid #e1e8ed;border-radius:8px;padding:12px;text-align:center;min-height:60px;'><div style='font-size:1.2em;font-weight:600;'>${w.eng}</div><div style='margin-top:8px;'>________</div></div>`).join('') + '</div>';
      case 'picturematching':
        return `<table style='width:100%;border-collapse:collapse;'><tbody>` +
          words.map(w => `<tr><td style='padding:6px 12px;border-bottom:1px solid #e1e8ed;'>${w.eng}</td><td style='padding:6px 12px;border-bottom:1px solid #e1e8ed;'>________</td></tr>`).join('') + '</tbody></table>';
      case 'engkormatch':
        return `<table style='width:100%;border-collapse:collapse;'><tbody>` +
          words.map(w => `<tr><td style='padding:6px 12px;border-bottom:1px solid #e1e8ed;'>${w.eng}</td><td style='padding:6px 12px;border-bottom:1px solid #e1e8ed;'>${w.kor}</td></tr>`).join('') + '</tbody></table>';
      default:
        return '<div style="color:#aaa;">Unknown format.</div>';
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
      const importBtn = modal.querySelector('#vocab-import-btn');
      const moreOptionsBtn = modal.querySelector('#vocab-more-options-btn');
      const moreOptionsModal = modal.querySelector('#vocab-more-options-modal');
      const moreOptionsClose = modal.querySelector('#vocab-more-options-close');

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
      const diffInput = modal.querySelector('#vocab-difficulty');
      const numInput = modal.querySelector('#vocab-numwords');
      const extractBtn = modal.querySelector('#vocab-extract-btn');
      const clearBtn = modal.querySelector('#vocab-clear-btn');
      const wordlistInput = modal.querySelector('#vocab-wordlist');
      const formatInput = modal.querySelector('#vocab-list-format');
      const previewArea = modal.querySelector('#vocab-preview-area');
      const insertBtn = modal.querySelector('#vocab-insert-btn');
      const cancelBtn = modal.querySelector('#vocab-cancel-btn');
      const closeBtn = modal.querySelector('#close-vocab-modal');

      // Live preview update
      function updatePreview() {
        const words = parseWordList(wordlistInput.value);
        const format = formatInput.value;
        previewArea.innerHTML = renderPreview(words, format);
      }
      wordlistInput.addEventListener('input', updatePreview);
      formatInput.addEventListener('change', updatePreview);
      updatePreview();

      // Extract words with AI
      extractBtn.onclick = async function() {
        extractBtn.disabled = true;
        extractBtn.textContent = 'Extracting...';
        try {
          const passage = passageInput.value.trim();
          const num = parseInt(numInput.value) || 10;
          const diff = diffInput.value;
          if (!passage) { alert('Please enter a passage.'); return; }
          const aiResult = await extractWordsWithAI(passage, num, diff);
          wordlistInput.value = aiResult.trim();
          updatePreview();
        } finally {
          extractBtn.disabled = false;
          extractBtn.textContent = 'Extract Words';
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
