// grammar-section-modal.js
// Handles AI output popup and sectioned insertion for Grammar Worksheet Generator
// When rendering each section, add a data-section-idx attribute for reliable deletion

export function showGrammarSectionModal(aiData, onInsert) {
  // Handle both string (legacy) and object (new) formats
  let questions = '';
  let answers = '';
  let sectionTitle = '';
  if (typeof aiData === 'string') {
    questions = aiData;
  } else if (typeof aiData === 'object' && aiData !== null) {
    questions = aiData.questions || '';
    answers = aiData.answers || '';
    sectionTitle = aiData.sectionTitle || '';
  }

  // Create modal HTML
  let modal = document.createElement('div');
  modal.id = 'grammar-section-modal';
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
      <h2 style="margin-top:0;">Edit AI Questions</h2>
      <label style="font-size:1em;font-weight:500;">Section Header</label>
      <input id="modalSectionTitleInput" type="text" style="width:100%;margin-bottom:10px;font-size:1.05em;padding:6px 8px;" placeholder="Section header (e.g. 'Choose the correct past tense word.')" value="${sectionTitle.replace(/"/g, '&quot;')}">
      <textarea id="modalQuestionsInput" style="width:100%;height:120px;font-size:1.1em;" placeholder="Questions">${questions.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
      <h3 style="margin:16px 0 4px 0;font-size:1.1em;">Answers</h3>
      <textarea id="modalAnswersInput" style="width:100%;height:60px;font-size:1.05em;" placeholder="Answers (one per line, or as needed)">${answers.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
      <div style="margin-top:18px;display:flex;justify-content:flex-end;gap:12px;">
        <button id="modalCancelBtn" style="padding:8px 18px;">Cancel</button>
        <button id="modalInsertBtn" style="padding:8px 18px;background:#f8c080;border:none;border-radius:4px;">Insert as New Section</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Button handlers
  modal.querySelector('#modalCancelBtn').onclick = () => {
    document.body.removeChild(modal);
  };
  modal.querySelector('#modalInsertBtn').onclick = () => {
    const editedQuestions = modal.querySelector('#modalQuestionsInput').value;
    const editedAnswers = modal.querySelector('#modalAnswersInput').value;
    const editedSectionTitle = modal.querySelector('#modalSectionTitleInput').value;
    onInsert({ questions: editedQuestions, answers: editedAnswers, sectionTitle: editedSectionTitle });
    document.body.removeChild(modal);
  };
}

// Utility to add a new section to the worksheet preview
export function addGrammarSection(sectionData, sectionIndex) {
  // Handle both old format (string) and new format (object)
  let questions = '';
  let sectionTitle = '';
  if (typeof sectionData === 'string') {
    questions = sectionData;
  } else if (typeof sectionData === 'object' && sectionData !== null) {
    questions = sectionData.questions || '';
    sectionTitle = sectionData.sectionTitle || '';
  }
  // Section label: Part A, Part B, etc.
  const partLabel = String.fromCharCode(65 + sectionIndex); // 65 = 'A'
  // Get the current template selection for design
  let template = '0';
  try {
    template = document.getElementById('templateSelect')?.value || '0';
  } catch (e) {}
  let designClass = '';
  if (template === '0') designClass = 'design-0';
  else if (template === '1') designClass = 'design-1';
  else if (template === '2') designClass = 'design-2';
  // Compose header
  let header = `<h3 style="margin-bottom:8px;">Part ${partLabel}`;
  if (sectionTitle && sectionTitle.trim()) {
    header += `: ${sectionTitle.trim()}`;
  } else {
    header += ': Answer the questions';
  }
  header += '</h3>';
  // Design 3: simple line, no box
  if (template === '3') {
    return `<div class="grammar-section" data-section-idx="${sectionIndex}" style="margin-bottom:24px;">
      ${header}
      <div class="grammar-questions">${questions}</div>
    </div>`;
  }
  // Design 4: lines between parts, no box, add line-section class except last part
  if (template === '4') {
    // Only add line if not last section
    const isLast = (window.grammarSections && window.grammarSections.length - 1 === sectionIndex);
    return `<div class="grammar-section${!isLast ? ' line-section' : ''}" data-section-idx="${sectionIndex}" style="margin-bottom:24px;">
      ${header}
      <div class="grammar-questions">${questions}</div>
    </div>`;
  }
  // Default: box
  return `<div class="section-box ${designClass}" data-section-idx="${sectionIndex}">
    ${header}
    <div class="grammar-questions">${questions}</div>
  </div>`;
}
