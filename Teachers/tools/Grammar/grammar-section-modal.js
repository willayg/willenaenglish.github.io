// grammar-section-modal.js
// Handles AI output popup and sectioned insertion for Grammar Worksheet Generator

export function showGrammarSectionModal(aiQuestions, onInsert) {
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
      <textarea id="modalQuestionsInput" style="width:100%;height:180px;font-size:1.1em;">${aiQuestions}</textarea>
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
    onInsert(editedQuestions);
    document.body.removeChild(modal);
  };
}

// Utility to add a new section to the worksheet preview
export function addGrammarSection(questions, sectionIndex) {
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
  // Design 3: simple line, no box
  if (template === '3') {
    return `<div class="grammar-section" style="margin-bottom:24px;">
      <h3 style="margin-bottom:8px;">Part ${partLabel}: Answer the questions</h3>
      <div class="grammar-questions">${questions}</div>
    </div>`;
  }
  // Design 4: lines between parts, no box, add line-section class except last part
  if (template === '4') {
    // Only add line if not last section
    const isLast = (window.grammarSections && window.grammarSections.length - 1 === sectionIndex);
    return `<div class="grammar-section${!isLast ? ' line-section' : ''}" style="margin-bottom:24px;">
      <h3 style="margin-bottom:8px;">Part ${partLabel}: Answer the questions</h3>
      <div class="grammar-questions">${questions}</div>
    </div>`;
  }
  // Default: box
  return `<div class="section-box ${designClass}">
    <h3 style="margin-bottom:8px;">Part ${partLabel}: Answer the questions</h3>
    <div class="grammar-questions">${questions}</div>
  </div>`;
}
