// survey-section-modal.js
// Modal and section logic for inserting new question sets as sections (Part A, Part B, ...)

(function() {
  // Helper to get next part label (A, B, C, ...)
  function getPartLabel(idx) {
    return 'Part ' + String.fromCharCode(65 + idx);
  }

  // Show modal for new section
  window.showSurveySectionModal = function(questions, onInsert) {
    let modal = document.createElement('div');
    modal.id = 'survey-section-modal';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    modal.style.background = 'rgba(0,0,0,0.25)';
    modal.style.zIndex = '99999';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.innerHTML = `
      <div style="background:#fff;max-width:520px;width:90vw;padding:32px 24px 24px 24px;border-radius:12px;box-shadow:0 2px 16px rgba(0,0,0,0.18);position:relative;">
        <h2 style="margin-top:0;">Insert New Section</h2>
        <label style="font-size:1em;font-weight:500;">Section Title</label>
        <input id="modalSectionTitleInput" type="text" style="width:100%;margin-bottom:10px;font-size:1.05em;padding:6px 8px;" placeholder="Section header (e.g. 'Personal Information')">
        <textarea id="modalQuestionsInput" style="width:100%;height:120px;font-size:1.1em;" placeholder="Questions">${questions || ''}</textarea>
        <div style="margin-top:18px;display:flex;justify-content:flex-end;gap:12px;">
          <button id="modalCancelBtn" style="padding:8px 18px;">Cancel</button>
          <button id="modalInsertBtn" style="padding:8px 18px;background:#e6b0f3;border:none;border-radius:4px;">Insert Section</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('#modalCancelBtn').onclick = () => {
      document.body.removeChild(modal);
    };
    modal.querySelector('#modalInsertBtn').onclick = () => {
      const sectionTitle = modal.querySelector('#modalSectionTitleInput').value;
      const sectionQuestions = modal.querySelector('#modalQuestionsInput').value;
      if (onInsert) onInsert(sectionTitle, sectionQuestions);
      document.body.removeChild(modal);
    };
  };

// Renders all sections for preview, using the same formatting as the main preview logic
window.renderSurveySections = function(sections) {
  if (!sections || !sections.length) return '<i>No questions yet.</i>';
  let html = '';
  sections.forEach((section, idx) => {
    const partLabel = String.fromCharCode(65 + idx); // A, B, C, ...
    // Try to auto-detect if this section is MC or open by looking for options (A. ...)
    const lines = section.questions.split(/\r?\n/).map(q => q.trim());
    let isMC = false;
    for (let l of lines) {
      if (/^[A-Z]\.[ )]?\s+/.test(l)) { isMC = true; break; }
    }
    let questionDivs = '';
    if (isMC) {
      // Multiple Choice: group each question with its options
      let qNum = 1;
      let i = 0;
      while (i < lines.length) {
        let qMatch = lines[i].match(/^(\d+)\.\s*(.*)$/);
        if (qMatch) {
          let qText = qMatch[2] || '';
          let options = [];
          let j = i + 1;
          while (j < lines.length) {
            let optMatch = lines[j].match(/^([A-Z])\.[ )]?\s*(.+)$/);
            if (optMatch) {
              options.push(optMatch[2]);
              j++;
            } else {
              break;
            }
          }
          if (options.length > 0) {
            questionDivs += `<div style=\"margin-bottom:18px;\"><span style=\"font-weight:500;\">${qNum}. ${qText}</span><div style='margin:6px 0 0 0;display:flex;gap:24px;flex-wrap:wrap;'>`;
            options.forEach((opt, k) => {
              questionDivs += `<label style='display:inline-flex;align-items:center;margin-right:18px;font-size:1em;'><input type='radio' name='section${idx}_q${qNum}' style='margin-right:6px;'>${opt}</label>`;
            });
            questionDivs += `</div></div>`;
            i = j;
            qNum++;
          } else {
            // No options, treat as open question
            questionDivs += `<div style=\"margin-bottom:18px;\">${qNum}. ${qText}<br><div style=\"border-bottom:1px solid #bbb;height:18px;margin:6px 0 0 0;\"></div></div>`;
            i++;
            qNum++;
          }
        } else if (lines[i]) {
          // Not a question line, treat as open question
          questionDivs += `<div style=\"margin-bottom:18px;\">${lines[i]}<br><div style=\"border-bottom:1px solid #bbb;height:18px;margin:6px 0 0 0;\"></div></div>`;
          i++;
        } else {
          i++;
        }
      }
    } else {
      // Open question mode (default)
      questionDivs = lines.filter(q => q).map((q, i) => `<div style=\"margin-bottom:18px;\">${q}<br><div style=\"border-bottom:1px solid #bbb;height:18px;margin:6px 0 0 0;\"></div></div>`).join('');
    }
    html += `<div style=\"margin-bottom:24px;\">
      <div style=\"font-weight:600;font-size:1.1em;margin-bottom:6px;\">Part ${partLabel}${section.title ? ': ' + section.title : ''}</div>
      <div>${questionDivs}</div>
    </div>`;
  });
  return html;
};
})();
