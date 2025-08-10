// mint-ai-vocab-modal.js: Mint AI Vocab Box Modal logic, styled and wired like mint-ai
(function() {
  // Helper: Parse word list textarea into array of {eng, kor}
  function parseWordList(text) {
    return text.split('\n').map(line => {
      // Remove leading numbers and dots, e.g. '1. bird' -> 'bird'
      let cleaned = line.replace(/^\s*\d+\.?\s*/, '');
      const [eng, kor] = cleaned.split(',').map(s => (s||'').trim());
      if (!eng) return null;
      return { eng, kor: kor||'' };
    }).filter(Boolean);
  }

  // Layout rendering is now handled by MintAIVocabLayouts.js

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
      
      // Picture Matching layout
      container.innerHTML += `
        <div class="layout-thumb-container" style="display:flex;flex-direction:column;align-items:center;">
          <button class="vocab-layout-option" data-value="matching" style="width:160px;height:120px;padding:0;border-radius:14px;background:#fff3cd;color:#856404;font-size:0.55em;font-family:'Poppins',Arial,sans-serif;font-weight:600;border:3px solid #ffc107;box-shadow:0 2px 8px rgba(255,193,7,0.08);cursor:pointer;transition:all 0.2s;display:flex;align-items:center;justify-content:center;">
            <div style="width:95%;height:90%;background:#fff3cd;border-radius:10px;display:flex;flex-direction:row;justify-content:space-between;box-shadow:0 1px 4px rgba(255,193,7,0.06);border:1.5px solid #ffeaa7;overflow:hidden;align-items:center;">
              <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8px 0;">
                <div style="width:30px;height:20px;background:#f59e0b;border-radius:3px;margin-bottom:3px;display:flex;align-items:center;justify-content:center;color:white;font-size:0.7em;">🏠</div>
                <div style="width:30px;height:20px;background:#10b981;border-radius:3px;margin-bottom:3px;display:flex;align-items:center;justify-content:center;color:white;font-size:0.7em;">🚗</div>
                <div style="width:30px;height:20px;background:#8b5cf6;border-radius:3px;margin-bottom:3px;display:flex;align-items:center;justify-content:center;color:white;font-size:0.7em;">🌳</div>
              </div>
              <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8px 0;">
                <div style="background:#fff;border-radius:4px;padding:2px 8px;margin-bottom:3px;font-weight:600;font-size:0.8em;">house</div>
                <div style="background:#fff;border-radius:4px;padding:2px 8px;margin-bottom:3px;font-weight:600;font-size:0.8em;">car</div>
                <div style="background:#fff;border-radius:4px;padding:2px 8px;margin-bottom:3px;font-weight:600;font-size:0.8em;">tree</div>
              </div>
            </div>
          </button>
          <span style="margin-top:8px;font-size:1em;color:#856404;font-weight:600;">Picture Matching</span>
        </div>
      `;
      
      // Picture Labeling layout
      container.innerHTML += `
        <div class="layout-thumb-container" style="display:flex;flex-direction:column;align-items:center;">
          <button class="vocab-layout-option" data-value="labeling" style="width:160px;height:120px;padding:0;border-radius:14px;background:#e7f3ff;color:#0066cc;font-size:0.45em;font-family:'Poppins',Arial,sans-serif;font-weight:600;border:3px solid #0066cc;box-shadow:0 2px 8px rgba(0,102,204,0.08);cursor:pointer;transition:all 0.2s;display:flex;align-items:center;justify-content:center;">
            <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:3px;width:92%;height:92%;">
              <div style="border:1.2px solid #e1e8ed;border-radius:6px;padding:2px;text-align:center;background:#fafbfc;font-size:0.6em;display:flex;flex-direction:column;">
                <div style="flex:1;background:#0066cc;border-radius:3px;margin-bottom:2px;display:flex;align-items:center;justify-content:center;color:white;font-size:0.8em;">🏠</div>
                <div style="width:90%;height:8px;background:#f0f0f0;border:1px solid #ccc;border-radius:2px;margin:0 auto;"></div>
              </div>
              <div style="border:1.2px solid #e1e8ed;border-radius:6px;padding:2px;text-align:center;background:#fafbfc;font-size:0.6em;display:flex;flex-direction:column;">
                <div style="flex:1;background:#10b981;border-radius:3px;margin-bottom:2px;display:flex;align-items:center;justify-content:center;color:white;font-size:0.8em;">🚗</div>
                <div style="width:90%;height:8px;background:#f0f0f0;border:1px solid #ccc;border-radius:2px;margin:0 auto;"></div>
              </div>
            </div>
          </button>
          <span style="margin-top:8px;font-size:1em;color:#0066cc;font-weight:600;">Picture Labeling</span>
        </div>
      `;
      
      // Picture Cards layout (similar to vocab cards but with images)
      container.innerHTML += `
        <div class="layout-thumb-container" style="display:flex;flex-direction:column;align-items:center;">
          <button class="vocab-layout-option" data-value="picturecards" style="width:160px;height:120px;padding:0;border-radius:14px;background:#fff;color:#8b5cf6;font-size:0.45em;font-family:'Poppins',Arial,sans-serif;font-weight:600;border:3px solid #8b5cf6;box-shadow:0 2px 8px rgba(139,92,246,0.08);cursor:pointer;transition:all 0.2s;display:flex;align-items:center;justify-content:center;">
            <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:3px;width:92%;height:92%;">
              <div style="border:1.2px solid #e1e8ed;border-radius:6px;padding:2px;text-align:center;background:#fafbfc;font-size:0.6em;display:flex;flex-direction:column;">
                <div style="flex:1;background:#8b5cf6;border-radius:3px;margin-bottom:2px;display:flex;align-items:center;justify-content:center;color:white;font-size:0.8em;">🐱</div>
                <div style="font-weight:700;color:#8b5cf6;font-size:0.7em;">cat</div>
                <div style="color:#666;font-size:0.6em;">고양이</div>
              </div>
              <div style="border:1.2px solid #e1e8ed;border-radius:6px;padding:2px;text-align:center;background:#fafbfc;font-size:0.6em;display:flex;flex-direction:column;">
                <div style="flex:1;background:#10b981;border-radius:3px;margin-bottom:2px;display:flex;align-items:center;justify-content:center;color:white;font-size:0.8em;">🐶</div>
                <div style="font-weight:700;color:#8b5cf6;font-size:0.7em;">dog</div>
                <div style="color:#666;font-size:0.6em;">개</div>
              </div>
              <div style="border:1.2px solid #e1e8ed;border-radius:6px;padding:2px;text-align:center;background:#fafbfc;font-size:0.6em;display:flex;flex-direction:column;">
                <div style="flex:1;background:#f59e0b;border-radius:3px;margin-bottom:2px;display:flex;align-items:center;justify-content:center;color:white;font-size:0.8em;">🛏️</div>
                <div style="font-weight:700;color:#8b5cf6;font-size:0.7em;">bed</div>
                <div style="color:#666;font-size:0.6em;">침대</div>
              </div>
              <div style="border:1.2px solid #e1e8ed;border-radius:6px;padding:2px;text-align:center;background:#fafbfc;font-size:0.6em;display:flex;flex-direction:column;">
                <div style="flex:1;background:#ef4444;border-radius:3px;margin-bottom:2px;display:flex;align-items:center;justify-content:center;color:white;font-size:0.8em;">👦</div>
                <div style="font-weight:700;color:#8b5cf6;font-size:0.7em;">boy</div>
                <div style="color:#666;font-size:0.6em;">소년</div>
              </div>
            </div>
          </button>
          <span style="margin-top:8px;font-size:1em;color:#8b5cf6;font-weight:600;">Picture Cards</span>
        </div>
      `;
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
            <div style="width:95%;height:90%;background:#fff;border-radius:10px;display:flex;flex-direction:row;justify-content:space-between;box-shadow:0 1px 4px rgba(60,60,80,0.06);border:1.5px solid #e0e0e0;overflow:hidden;padding:1px;gap:1px;">
              <div style="flex:1;display:flex;flex-direction:column;border-right:1.5px solid #222;">
                <div style="display:grid;grid-template-columns:14px 1fr 1fr;border-bottom:1.5px solid #222;font-size:0.45em;font-weight:700;padding:0.5px 0;background:#f5f5f5;text-align:center;">
                  <span></span>
                  <span>Eng</span>
                  <span>Kor</span>
                </div>
                <div style="display:grid;grid-template-columns:14px 1fr 1fr;align-items:center;font-size:0.36em;border-bottom:0.7px solid #e8e8e8;padding:0.5px 0;text-align:center;">
                  <span style="font-weight:700;">1</span><span style="font-weight:500;">cat</span><span style="font-weight:400;">고양이</span>
                </div>
                <div style="display:grid;grid-template-columns:14px 1fr 1fr;align-items:center;font-size:0.36em;border-bottom:0.7px solid #e8e8e8;padding:0.5px 0;text-align:center;">
                  <span style="font-weight:700;">2</span><span style="font-weight:500;">dog</span><span style="font-weight:400;">개</span>
                </div>
                <div style="display:grid;grid-template-columns:14px 1fr 1fr;align-items:center;font-size:0.36em;border-bottom:0.7px solid #e8e8e8;padding:0.5px 0;text-align:center;">
                  <span style="font-weight:700;">3</span><span style="font-weight:500;">bed</span><span style="font-weight:400;">침대</span>
                </div>
              </div>
              <div style="flex:1;display:flex;flex-direction:column;">
                <div style="display:grid;grid-template-columns:14px 1fr 1fr;border-bottom:1.5px solid #222;font-size:0.45em;font-weight:700;padding:0.5px 0;background:#f5f5f5;text-align:center;">
                  <span></span>
                  <span>Eng</span>
                  <span>Kor</span>
                </div>
                <div style="display:grid;grid-template-columns:14px 1fr 1fr;align-items:center;font-size:0.36em;border-bottom:0.7px solid #e8e8e8;padding:0.5px 0;text-align:center;">
                  <span style="font-weight:700;">4</span><span style="font-weight:500;">cup</span><span style="font-weight:400;">컵</span>
                </div>
                <div style="display:grid;grid-template-columns:14px 1fr 1fr;align-items:center;font-size:0.36em;border-bottom:0.7px solid #e8e8e8;padding:0.5px 0;text-align:center;">
                  <span style="font-weight:700;">5</span><span style="font-weight:500;">pen</span><span style="font-weight:400;">펜</span>
                </div>
                <div style="display:grid;grid-template-columns:14px 1fr 1fr;align-items:center;font-size:0.36em;border-bottom:0.7px solid #e8e8e8;padding:0.5px 0;text-align:center;">
                  <span style="font-weight:700;">6</span><span style="font-weight:500;">bag</span><span style="font-weight:400;">가방</span>
                </div>
              </div>
            </div>
          </button>
          <span style="margin-top:8px;font-size:1em;color:#2296a3;font-weight:600;">Double List</span>
        </div>
        <div class="layout-thumb-container" style="display:flex;flex-direction:column;align-items:center;">
          <button class="vocab-layout-option" data-value="basic" style="width:160px;height:120px;padding:0;border-radius:14px;background:#fff;color:#00897b;font-size:0.45em;font-family:'Poppins',Arial,sans-serif;font-weight:600;border:3px solid #2296a3;box-shadow:0 2px 8px rgba(0,191,174,0.08);cursor:pointer;transition:all 0.2s;display:flex;align-items:center;justify-content:center;">
            <div style="width:90%;margin:0 auto;padding:0.5em 0 0.5em 0;">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5em 0.7em;align-items:center;font-size:0.7em;">
                <div style="text-align:right;font-weight:600;">cat</div><div style="text-align:left;color:#666;">고양이</div>
                <div style="text-align:right;font-weight:600;">dog</div><div style="text-align:left;color:#666;">개</div>
                <div style="text-align:right;font-weight:600;">bed</div><div style="text-align:left;color:#666;">침대</div>
                <div style="text-align:right;font-weight:600;">boy</div><div style="text-align:left;color:#666;">소년</div>
                <div style="text-align:right;font-weight:600;">sun</div><div style="text-align:left;color:#666;">태양</div>
              </div>
            </div>
          </button>
          <span style="margin-top:8px;font-size:1em;color:#2296a3;font-weight:600;">Simple List</span>
        </div>
        <div class="layout-thumb-container" style="display:flex;flex-direction:column;align-items:center;">
          <button class="vocab-layout-option" data-value="cards" style="width:160px;height:120px;padding:0;border-radius:14px;background:#fff;color:#00897b;font-size:0.45em;font-family:'Poppins',Arial,sans-serif;font-weight:600;border:3px solid #2296a3;box-shadow:0 2px 8px rgba(0,191,174,0.08);cursor:pointer;transition:all 0.2s;display:flex;align-items:center;justify-content:center;">
            <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:3px;width:92%;height:92%;">
              <div style="border:1.2px solid #e1e8ed;border-radius:6px;padding:4px 2px;text-align:center;background:#fafbfc;font-size:0.7em;">
                <div style="font-weight:700;color:#00897b;">cat</div>
                <div style="color:#666;">고양이</div>
              </div>
              <div style="border:1.2px solid #e1e8ed;border-radius:6px;padding:4px 2px;text-align:center;background:#fafbfc;font-size:0.7em;">
                <div style="font-weight:700;color:#00897b;">dog</div>
                <div style="color:#666;">개</div>
              </div>
              <div style="border:1.2px solid #e1e8ed;border-radius:6px;padding:4px 2px;text-align:center;background:#fafbfc;font-size:0.7em;">
                <div style="font-weight:700;color:#00897b;">bed</div>
                <div style="color:#666;">침대</div>
              </div>
              <div style="border:1.2px solid #e1e8ed;border-radius:6px;padding:4px 2px;text-align:center;background:#fafbfc;font-size:0.7em;">
                <div style="font-weight:700;color:#00897b;">boy</div>
                <div style="color:#666;">소년</div>
              </div>
            </div>
          </button>
          <span style="margin-top:8px;font-size:1em;color:#2296a3;font-weight:600;">Cards Grid</span>
        </div>
        <div class="layout-thumb-container" style="display:flex;flex-direction:column;align-items:center;">
          <button class="vocab-layout-option" data-value="matching" style="width:160px;height:120px;padding:0;border-radius:14px;background:#fffbe7;color:#b26a00;font-size:0.55em;font-family:'Poppins',Arial,sans-serif;font-weight:600;border:3px solid #fbc02d;box-shadow:0 2px 8px rgba(251,191,36,0.08);cursor:pointer;transition:all 0.2s;display:flex;align-items:center;justify-content:center;">
            <div style="width:95%;height:90%;background:#fffbe7;border-radius:10px;display:flex;flex-direction:row;justify-content:space-between;box-shadow:0 1px 4px rgba(251,191,36,0.06);border:1.5px solid #ffe082;overflow:hidden;align-items:center;">
              <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8px 0;">
                <div style="font-weight:700;color:#b26a00;font-size:1em;margin-bottom:4px;">English</div>
                <div style="background:#fff;border-radius:6px;padding:4px 12px 4px 12px;margin-bottom:3px;font-weight:600;">cat</div>
                <div style="background:#fff;border-radius:6px;padding:4px 12px 4px 12px;margin-bottom:3px;font-weight:600;">dog</div>
                <div style="background:#fff;border-radius:6px;padding:4px 12px 4px 12px;margin-bottom:3px;font-weight:600;">bed</div>
              </div>
              <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8px 0;">
                <div style="font-weight:700;color:#b26a00;font-size:1em;margin-bottom:4px;">Korean</div>
                <div style="background:#fff;border-radius:6px;padding:4px 12px 4px 12px;margin-bottom:3px;">고양이</div>
                <div style="background:#fff;border-radius:6px;padding:4px 12px 4px 12px;margin-bottom:3px;">개</div>
                <div style="background:#fff;border-radius:6px;padding:4px 12px 4px 12px;margin-bottom:3px;">침대</div>
              </div>
            </div>
          </button>
          <span style="margin-top:8px;font-size:1em;color:#b26a00;font-weight:600;">Word Matching</span>
        </div>
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
        }
        // Close modal
        const layoutsModal = modal.querySelector('#vocab-layouts-modal');
        if (layoutsModal) layoutsModal.style.display = 'none';
      };
    });
  }

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

  window.openVocabBoxModal = function(pictureMode = false) {
    if (document.getElementById('vocab-box-modal')) return;
    fetch('mint-ai/mint-ai-vocab-modal.html').then(r => r.text()).then(html => {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = html;
      document.body.appendChild(wrapper);
      const modal = document.getElementById('vocab-box-modal');
      
      // Store picture mode for later reference
      modal.dataset.pictureMode = pictureMode;
      
      // If pictureMode, change the title and accent color, and load picture layouts
      if (pictureMode) {
        const title = modal.querySelector('h2');
        if (title) {
          title.textContent = 'MINT AI - Pictures';
          title.style.color = '#f59e0b';
        }
        // Dynamically load the picture layouts module and override window.MintAIVocabLayouts
        const script = document.createElement('script');
        script.src = 'mint-ai/mint-ai-pictures-layouts.js';
        script.onload = function() {
          if (window.MintAIPicturesLayouts) {
            window.MintAIVocabLayouts = window.MintAIPicturesLayouts;
          }
          // Populate layouts after loading picture layouts
          populateLayoutsModal(modal, true);
        };
        document.body.appendChild(script);
      } else {
        // Load vocab layouts if not already loaded
        if (!window.MintAIVocabLayouts) {
          const script = document.createElement('script');
          script.src = 'mint-ai/mint-ai-vocab-layouts.js';
          script.onload = function() {
            // Populate layouts after loading vocab layouts
            populateLayoutsModal(modal, false);
          };
          document.body.appendChild(script);
        } else {
          // Populate layouts immediately if already loaded
          populateLayoutsModal(modal, false);
        }
      }
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
        // Update layout thumbnails with new language label
        updateLayoutThumbnails();
      }

      function updateLayoutThumbnails() {
        const l1Label = langOptions.find(l => l.value === selectedStudentLang)?.label || 'Korean';
        
        // Update Side-by-Side thumbnail - find the Korean text and replace it
        const sideBySideThumbnail = modal.querySelector('[data-value="sidebyside"]');
        if (sideBySideThumbnail) {
          const spans = sideBySideThumbnail.querySelectorAll('span');
          spans.forEach(span => {
            if (span.textContent.trim() === 'Korean') {
              span.textContent = l1Label;
            }
          });
        }

        // Update Double List thumbnail - find "Kor" text and replace with abbreviated L1 label
        const doubleListThumbnail = modal.querySelector('[data-value="doublelist"]');
        if (doubleListThumbnail) {
          const spans = doubleListThumbnail.querySelectorAll('span');
          spans.forEach(span => {
            if (span.textContent.trim() === 'Kor') {
              // Use first 3 characters for space constraints, but ensure it's not empty
              const abbrev = l1Label.length >= 3 ? l1Label.substring(0, 3) : l1Label;
              span.textContent = abbrev;
            }
          });
        }

        // Update Matching thumbnail - find the Korean header and replace it
        const matchingThumbnail = modal.querySelector('[data-value="matching"]');
        if (matchingThumbnail) {
          const divs = matchingThumbnail.querySelectorAll('div');
          divs.forEach(div => {
            if (div.textContent.trim() === 'Korean') {
              div.textContent = l1Label;
            }
          });
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
          updatePreview(); // Update preview with new language
          langPickerModal.style.display = 'none';
        };
      });
      updateLangDisplays();

      // Forward declaration for updatePreview
      let updatePreview;

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
          // Repopulate layouts based on current mode
          const isPictureMode = modal.dataset.pictureMode === 'true';
          populateLayoutsModal(modal, isPictureMode);
          layoutsModal.style.display = 'flex';
        };
        layoutsClose.onclick = function() {
          layoutsModal.style.display = 'none';
        };
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
      updatePreview = function() {
        const words = parseWordList(wordlistInput.value);
        const format = formatInput.value;
        // Get the label for the student's L1 language
        const l1Label = langOptions.find(l => l.value === selectedStudentLang)?.label || 'Korean';
        if (window.MintAIVocabLayouts && typeof window.MintAIVocabLayouts.renderPreview === 'function') {
          // Use styled version for side-by-side and double list tables
          if (format === 'sidebyside' && window.MintAIVocabLayouts.renderSideBySideWithStyle) {
            previewArea.innerHTML = window.MintAIVocabLayouts.renderSideBySideWithStyle(words, currentTableStyle, l1Label);
          } else if (format === 'doublelist' && window.MintAIVocabLayouts.renderDoubleListWithStyle) {
            previewArea.innerHTML = window.MintAIVocabLayouts.renderDoubleListWithStyle(words, currentTableStyle, l1Label);
          } else if (format === 'matching' && window.MintAIVocabLayouts.renderMatching) {
            previewArea.innerHTML = window.MintAIVocabLayouts.renderMatching(words, l1Label);
          } else {
            previewArea.innerHTML = window.MintAIVocabLayouts.renderPreview(words, format, l1Label);
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
            // Get the correct L1 label for all layouts
            const l1Label = langOptions.find(l => l.value === selectedStudentLang)?.label || 'Korean';
            // Use styled version for side-by-side and double list tables
            if (format === 'sidebyside' && window.MintAIVocabLayouts.renderSideBySideWithStyle) {
              renderedContent = window.MintAIVocabLayouts.renderSideBySideWithStyle(words, currentTableStyle, l1Label);
            } else if (format === 'doublelist' && window.MintAIVocabLayouts.renderDoubleListWithStyle) {
              renderedContent = window.MintAIVocabLayouts.renderDoubleListWithStyle(words, currentTableStyle, l1Label);
            } else if (format === 'matching' && window.MintAIVocabLayouts.renderMatching) {
              renderedContent = window.MintAIVocabLayouts.renderMatching(words, l1Label);
            } else {
              // Pass l1Label for any other layouts that might use it
              renderedContent = window.MintAIVocabLayouts.renderPreview(words, format, l1Label);
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
