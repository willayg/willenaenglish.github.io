// Reading Worksheet Generator
import { extractQuestionsWithAI } from './ai.js';
import { applyPreviewFontStyles, loadGoogleFont, scaleWorksheetPreview } from '../tests/fonts.js';

// Define worksheet templates
window.worksheetTemplates = [
  {
    name: "Design 1",
    render: (data) => `
      <div class="worksheet-header" style="text-align: center; margin-bottom: 20px;">
        <img src="../../../Assets/Images/color-logo1.png" alt="Willena Logo" style="width: 80px; margin-bottom: 10px;">
        <h1 style="font-size: 1.8em; margin-bottom: 5px; color: #2e2b3f;">${data.title}</h1>
        <div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
          <span>Name: ________________</span>
          <span>Date: ________________</span>
        </div>
      </div>
      <div class="worksheet-content">
        ${data.puzzle}
      </div>
    `
  },
  {
    name: "Design 2",
    render: (data) => `
      <div class="worksheet-header" style="margin-bottom: 20px; display: flex; align-items: flex-start; justify-content: space-between;">
        <div style="flex:1;">
          <h1 style="font-size: 1.6em; margin-bottom: 10px; color: #2e2b3f;">${data.title}</h1>
          <div style="display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 0.9em;">
            <span>Name: ________________</span>
            <span>Date: ________________</span>
          </div>
        </div>
        <img src="../../../Assets/Images/color-logo1.png" alt="Willena Logo" style="width: 60px; margin-left: 20px; align-self: flex-start;">
      </div>
      <div class="worksheet-content">
        ${data.puzzle}
      </div>
    `
  },
  {
    name: "Design 3",
    render: (data) => `
      <div class="worksheet-header" style="border-bottom: 2px solid #2e2b3f; padding-bottom: 15px; margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <img src="../../../Assets/Images/color-logo1.png" alt="Willena Logo" style="width: 60px;">
          </div>
          <div style="text-align: center; flex-grow: 1;">
            <h1 style="font-size: 1.8em; margin: 0; color: #2e2b3f;">${data.title}</h1>
          </div>
          <div style="text-align: right; font-size: 0.9em;">
            <div>Name: ________________</div>
            <div>Date: ________________</div>
          </div>
        </div>
      </div>
      <div class="worksheet-content">
        ${data.puzzle}
      </div>
    `
  }
];

document.addEventListener('DOMContentLoaded', () => {
    // --- Optimized Live Preview Update ---
    let lastPreviewHtml = '';
    let rafId = null;
    let lastFontSizeScale = null;

    // Track last worksheet content for flicker-free font/font size changes
    let lastWorksheetContent = '';
    let lastFont = '';

    // --- Flicker-free Title Update ---
    function updateTitleInPreview(newTitle) {
      const preview = document.getElementById('worksheetPreviewArea-reading');
      if (!preview) return;
      // Try to find the title node in the preview (works for all templates)
      const h1 = preview.querySelector('.worksheet-header h1, .worksheet-header h1, .worksheet-header h1');
      if (h1 && h1.textContent !== newTitle) {
        h1.textContent = newTitle;
      }
    }

    // Helper: Renumber all questions in all sections
    function renumberQuestionsInTextarea() {
      const textarea = document.getElementById('readingQuestions');
      if (!textarea) return;
      const lines = textarea.value.split('\n');
      let sectionCount = 0;
      let questionNumber = 1;
      let inSection = false;
      let hasFirstSection = false;
      const newLines = lines.map(line => {
        if (/^Part [A-Z]:/.test(line)) {
          sectionCount++;
          questionNumber = 1;
          inSection = true;
          hasFirstSection = true;
          return line;
        }
        if (line.includes('--- Section Break ---')) {
          inSection = false;
          return line;
        }
        if (/^\d+\./.test(line)) {
          return `${questionNumber++}. ${line.replace(/^\d+\.\s*/, '')}`;
        }
        return line;
      });
      textarea.value = newLines.join('\n');
    }

    // Helper: Delete a question by section and index
    function deleteQuestionBySectionAndIndex(sectionIdx, questionIdx) {
      const textarea = document.getElementById('readingQuestions');
      if (!textarea) return;
      const lines = textarea.value.split('\n');
      let currentSection = -1;
      let currentQ = -1;
      let found = false;
      const newLines = [];
      let skipMultipleChoiceOptions = false;
      let optionLinesToSkip = 0;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Handle skipping multiple choice options after question deletion
        if (skipMultipleChoiceOptions && /^[a-dA-D]\)/.test(line)) {
          optionLinesToSkip++;
          continue; // skip this option line
        } else if (skipMultipleChoiceOptions && optionLinesToSkip > 0) {
          skipMultipleChoiceOptions = false;
          optionLinesToSkip = 0;
        }
        
        if (/^Part [A-Z]:/.test(line)) {
          currentSection++;
          currentQ = -1;
          newLines.push(line);
          continue;
        }
        if (line.includes('--- Section Break ---')) {
          newLines.push(line);
          continue;
        }
        if (/^\d+\./.test(line)) {
          currentQ++;
          if (currentSection === sectionIdx && currentQ === questionIdx && !found) {
            found = true;
            skipMultipleChoiceOptions = true; // Skip associated options
            continue; // skip this line (delete)
          }
        }
        newLines.push(line);
      }
      textarea.value = newLines.join('\n');
      
      // --- Delete corresponding answer from answer key ---
      const answersTextarea = document.getElementById('readingAnswers');
      if (answersTextarea) {
        const answerLines = answersTextarea.value.split('\n');
        let currentSection = -1;
        let currentQ = -1;
        let found = false;
        const newAnswerLines = [];
        for (let i = 0; i < answerLines.length; i++) {
          const line = answerLines[i];
          if (/^Part [A-Z]:/.test(line)) {
            currentSection++;
            currentQ = -1;
            newAnswerLines.push(line);
            continue;
          }
          if (/^\d+\./.test(line)) {
            currentQ++;
            if (currentSection === sectionIdx && currentQ === questionIdx && !found) {
              found = true;
              continue; // skip this answer line
            }
          }
          newAnswerLines.push(line);
        }
        answersTextarea.value = newAnswerLines.join('\n');
      }
      
      renumberQuestionsInTextarea();
    }

    // Helper: Make questions editable in preview
    function makeQuestionsEditableInPreview() {
      const preview = document.getElementById('worksheetPreviewArea-reading');
      if (!preview) return;
      // Delegate click events
      preview.addEventListener('click', function(e) {
        const qItem = e.target.closest('.question-item');
        if (qItem && e.button === 0) { // left click
          const sectionIdx = parseInt(qItem.getAttribute('data-section-idx'), 10);
          const questionIdx = parseInt(qItem.getAttribute('data-question-idx'), 10);
          if (isNaN(sectionIdx) || isNaN(questionIdx)) return;
          // Find the question text
          const textarea = document.getElementById('readingQuestions');
          if (!textarea) return;
          const lines = textarea.value.split('\n');
          let currentSection = -1;
          let currentQ = -1;
          let lineIdx = -1;
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (/^Part [A-Z]:/.test(line)) {
              currentSection++;
              currentQ = -1;
              continue;
            }
            if (line.includes('--- Section Break ---')) continue;
            if (/^\d+\./.test(line)) {
              currentQ++;
              if (currentSection === sectionIdx && currentQ === questionIdx) {
                lineIdx = i;
                break;
              }
            }
          }
          if (lineIdx === -1) return;
          // Prompt for new text
          const oldText = lines[lineIdx].replace(/^\d+\.\s*/, '');
          const newText = prompt('Edit question:', oldText);
          if (newText !== null && newText.trim() !== '') {
            lines[lineIdx] = `${lines[lineIdx].match(/^\d+\./)[0]} ${newText.trim()}`;
            textarea.value = lines.join('\n');
            renumberQuestionsInTextarea();
            window.updateReadingPreview && window.updateReadingPreview();
          }
        }
      });
    }

    // Helper: Attach right-click delete to preview questions
    function attachDeleteHandlerToPreview() {
      const preview = document.getElementById('worksheetPreviewArea-reading');
      if (!preview) return;
      preview.addEventListener('contextmenu', function(e) {
        const qItem = e.target.closest('.question-item');
        if (qItem) {
          e.preventDefault();
          const sectionIdx = parseInt(qItem.getAttribute('data-section-idx'), 10);
          const questionIdx = parseInt(qItem.getAttribute('data-question-idx'), 10);
          if (isNaN(sectionIdx) || isNaN(questionIdx)) return;
          // Delete immediately without confirmation
          deleteQuestionBySectionAndIndex(sectionIdx, questionIdx);
          // Use requestAnimationFrame to reduce flicker
          requestAnimationFrame(() => {
            window.updateReadingPreview && window.updateReadingPreview();
          });
        }
      });
    }

    // Call once on load
    setTimeout(() => {
      attachDeleteHandlerToPreview();
      makeQuestionsEditableInPreview();
    }, 300);

    async function updateReadingPreview() {
      let passage = document.getElementById('readingPassage').value.trim();
      const questions = document.getElementById('readingQuestions').value.trim();
      const includePassage = document.getElementById('includePassage').checked;
      const preview = document.getElementById('worksheetPreviewArea-reading');
      const title = document.getElementById('readingTitle').value.trim() || "Reading Comprehension";
      const font = document.getElementById('fontSelect').value || "'Poppins', sans-serif";
      const fontSizePx = parseInt(document.getElementById('fontSizeInput')?.value || "12", 10);
      const templateIndex = parseInt(document.getElementById('templateSelect')?.value || "0", 10);
      const worksheetTemplate = window.worksheetTemplates?.[templateIndex] || window.worksheetTemplates[0];
      const testMode = document.getElementById('testModeSelect')?.value || 'none';

      // Compose worksheet content (excluding font/font size)
      let worksheetContentKey = JSON.stringify({ passage, questions, includePassage, title, templateIndex });

      let templateHtml = '';
      if (!passage && !questions) {
        templateHtml = `
          <div class="multi-page-worksheet">
            <div class="worksheet-page">
              <div class="page-header">
                <h1 style="font-weight: bold; text-align: center; margin-bottom: 10px; color: #2e2b3f; letter-spacing: 1px;">${title}</h1>
              </div>
              <div class="page-content" style="padding: 20px;">
                <div class="text-gray-400 p-4">
                  Enter a reading passage and generate questions to preview the worksheet.
                  <br><br>
                  <strong>Sample text to test font changes:</strong>
                  <br>This text shows how the selected font and size will appear in your worksheet.
                  <br>Font: ${font}
                  <br>Size: ${fontSizePx}px
                </div>
              </div>
            </div>
          </div>
        `;
      } else {
        // Cloze Test Mode: blank out every 5-8th word in passage
        let passageForDisplay = passage;
        if (testMode === 'cloze' && passage) {
          passageForDisplay = passage.replace(/(\S+)(\s+|$)/g, (word, w, space, idx, str) => {
            if (!window._clozeCounter) window._clozeCounter = 0;
            window._clozeCounter++;
            if (!window._clozeNext) window._clozeNext = 5 + Math.floor(Math.random() * 4); // 5-8
            if (window._clozeCounter === window._clozeNext) {
              window._clozeCounter = 0;
              window._clozeNext = 5 + Math.floor(Math.random() * 4);
              return '<span style="display:inline-block;min-width:60px;border-bottom:2px solid #888;margin:0 2px;">&nbsp;</span>' + space;
            }
            return w + space;
          });
          // Reset for next preview
          window._clozeCounter = 0;
          window._clozeNext = 5 + Math.floor(Math.random() * 4);
        }
        // Format the questions for display
        const formattedQuestions = formatQuestions(questions, font, fontSizePx);
        // Build the worksheet content
        let worksheetContent = "";
        if (includePassage && passage) {
          worksheetContent += `
            <div style="margin-bottom: 20px;">
              <h3 style="font-weight: bold; margin-bottom: 10px;">Reading Passage:</h3>
              <div style="line-height: 1.6; margin-bottom: 20px; padding: 15px; background: #f9f9f9;">
                ${passageForDisplay.replace(/\n/g, '<br>')}
              </div>
            </div>
          `;
        }
        if (formattedQuestions) {
          worksheetContent += `
            <div>
              <h3 style="font-weight: bold; margin-bottom: 15px;">Questions:</h3>
              ${formattedQuestions}
            </div>
          `;
        }
        const currentTemplate = window.worksheetTemplates[templateIndex];
        templateHtml = `
          <div id="worksheetPreviewWrapper" class="worksheet-preview-wrapper">
            <div class="worksheet-preview" style="font-family:${font};font-size:${fontSizePx}px;">
              ${currentTemplate.render({
                title,
                instructions: "",
                puzzle: worksheetContent,
                orientation: "portrait"
              })}
            </div>
          </div>
        `;
      }

      // Cloze Test Mode: blank out every 5-8th word in passage
      if (testMode === 'cloze' && passage) {
        passage = passage.replace(/(\S+)(\s+|$)/g, (word, w, space, idx, str) => {
          // Only blank out every 5th to 8th word randomly
          if (!window._clozeCounter) window._clozeCounter = 0;
          window._clozeCounter++;
          if (!window._clozeNext) window._clozeNext = 5 + Math.floor(Math.random() * 4); // 5-8
          if (window._clozeCounter === window._clozeNext) {
            window._clozeCounter = 0;
            window._clozeNext = 5 + Math.floor(Math.random() * 4);
            return '<span style="display:inline-block;min-width:60px;border-bottom:2px solid #888;margin:0 2px;">&nbsp;</span>' + space;
          }
          return w + space;
        });
        // Reset for next preview
        window._clozeCounter = 0;
        window._clozeNext = 5 + Math.floor(Math.random() * 4);
      }

      // If only font/font size changed, update styles only (no flicker)
      if (worksheetContentKey === lastWorksheetContent && (font !== lastFont || fontSizePx !== lastFontSizeScale)) {
        const previewEl = preview.querySelector('.worksheet-preview');
        if (previewEl) {
          previewEl.style.fontFamily = font;
          previewEl.style.fontSize = fontSizePx + 'px';
          applyPreviewFontStyles(preview, font, fontSizePx + 'px');
          loadGoogleFont(font);
          setTimeout(() => scaleWorksheetPreview(), 60);
          lastFont = font;
          lastFontSizeScale = fontSizePx;
        }
        return;
      }

      // Only update if content has changed
      if (templateHtml !== lastPreviewHtml) {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          preview.innerHTML = templateHtml;
          applyPreviewFontStyles(preview, font, fontSizePx + 'px');
          loadGoogleFont(font);
          setTimeout(() => scaleWorksheetPreview(), 60);
          lastPreviewHtml = templateHtml;
          lastWorksheetContent = worksheetContentKey;
          lastFont = font;
          lastFontSizeScale = fontSizePx;
        });
      }
    }

    // Listen for title input changes and update only the title in the preview
    const titleInput = document.getElementById('readingTitle');
    if (titleInput) {
      titleInput.addEventListener('input', (e) => {
        updateTitleInPreview(e.target.value);
      });
    }

    function formatQuestions(questionsText, font, fontSizeScale) {
      if (!questionsText.trim()) return "";
      const lines = questionsText.split('\n').filter(line => line.trim());
      let questionNumber = 1;
      let result = "";
      let currentQuestion = "";
      let currentOptions = [];
      let sectionIdx = -1;
      let questionIdx = -1;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        // Section header
        if (/^Part [A-Z]:/i.test(line)) {
          // Close current question if any
          if (currentQuestion && currentOptions.length > 0) {
            questionIdx++;
            const optionsHtml = currentOptions.map(opt => `<span style="margin-right: 30px; display: inline-block;">${opt}</span>`).join('');
            result += `<div class="question-item" data-section-idx="${sectionIdx}" data-question-idx="${questionIdx}" style="margin-bottom: 18px;">
              <div style="margin-bottom: 8px;"><strong>${/^[\d]+\./.test(currentQuestion) ? currentQuestion : `${questionNumber++}. ${currentQuestion}`}</strong></div>
              <div style="margin-left: 20px; line-height: 1.8;">${optionsHtml}</div>
            </div>`;
            currentOptions = [];
          } else if (currentQuestion) {
            questionIdx++;
            result += `<div class="question-item" data-section-idx="${sectionIdx}" data-question-idx="${questionIdx}" style="margin-bottom: 18px;">
              <div style="margin-bottom: 8px;"><strong>${/^[\d]+\./.test(currentQuestion) ? currentQuestion : `${questionNumber++}. ${currentQuestion}`}</strong></div>
              <div style="margin-left: 20px;">Answer: <span style="display: inline-block; width: 300px; border-bottom: 1px solid #000; height: 16px;"></span></div>
            </div>`;
          }
          currentQuestion = "";
          sectionIdx++;
          questionIdx = -1;
          questionNumber = 1;
          result += `<div class="section-header" style="margin: 30px 0 20px 0; font-size: 1.2em; font-weight: bold; color: #333; border-bottom: 2px solid #ddd; padding-bottom: 8px;">${line}</div>`;
          continue;
        }
        // Section break
        if (line.includes('--- Section Break ---')) {
          if (currentQuestion && currentOptions.length > 0) {
            questionIdx++;
            const optionsHtml = currentOptions.map(opt => `<span style="margin-right: 30px; display: inline-block;">${opt}</span>`).join('');
            result += `<div class="question-item" data-section-idx="${sectionIdx}" data-question-idx="${questionIdx}" style="margin-bottom: 18px;">
              <div style="margin-bottom: 8px;"><strong>${/^[\d]+\./.test(currentQuestion) ? currentQuestion : `${questionNumber++}. ${currentQuestion}`}</strong></div>
              <div style="margin-left: 20px; line-height: 1.8;">${optionsHtml}</div>
            </div>`;
            currentOptions = [];
          } else if (currentQuestion) {
            questionIdx++;
            result += `<div class="question-item" data-section-idx="${sectionIdx}" data-question-idx="${questionIdx}" style="margin-bottom: 18px;">
              <div style="margin-bottom: 8px;"><strong>${/^[\d]+\./.test(currentQuestion) ? currentQuestion : `${questionNumber++}. ${currentQuestion}`}</strong></div>
              <div style="margin-left: 20px;">Answer: <span style="display: inline-block; width: 300px; border-bottom: 1px solid #000; height: 16px;"></span></div>
            </div>`;
          }
          currentQuestion = "";
          result += `<div class="section-break" style="margin: 30px 0; text-align: center; font-weight: bold; color: #666; border-top: 2px solid #ddd; padding-top: 15px;">◆ ◆ ◆</div>`;
          continue;
        }
        const isOption = /^[a-dA-D]\)/.test(line);
        if (isOption) {
          currentOptions.push(line);
        } else {
          if (currentQuestion && currentOptions.length > 0) {
            questionIdx++;
            const optionsHtml = currentOptions.map(opt => `<span style="margin-right: 30px; display: inline-block;">${opt}</span>`).join('');
            result += `<div class="question-item" data-section-idx="${sectionIdx}" data-question-idx="${questionIdx}" style="margin-bottom: 18px;">
              <div style="margin-bottom: 8px;"><strong>${/^[\d]+\./.test(currentQuestion) ? currentQuestion : `${questionNumber++}. ${currentQuestion}`}</strong></div>
              <div style="margin-left: 20px; line-height: 1.8;">${optionsHtml}</div>
            </div>`;
            currentOptions = [];
          } else if (currentQuestion) {
            questionIdx++;
            result += `<div class="question-item" data-section-idx="${sectionIdx}" data-question-idx="${questionIdx}" style="margin-bottom: 18px;">
              <div style="margin-bottom: 8px;"><strong>${/^[\d]+\./.test(currentQuestion) ? currentQuestion : `${questionNumber++}. ${currentQuestion}`}</strong></div>
              <div style="margin-left: 20px;">Answer: <span style="display: inline-block; width: 300px; border-bottom: 1px solid #000; height: 16px;"></span></div>
            </div>`;
          }
          currentQuestion = line;
        }
      }
      // Final question
      if (currentQuestion && currentOptions.length > 0) {
        questionIdx++;
        const optionsHtml = currentOptions.map(opt => `<span style="margin-right: 30px; display: inline-block;">${opt}</span>`).join('');
        result += `<div class="question-item" data-section-idx="${sectionIdx}" data-question-idx="${questionIdx}" style="margin-bottom: 18px;">
          <div style="margin-bottom: 8px;"><strong>${/^[\d]+\./.test(currentQuestion) ? currentQuestion : `${questionNumber++}. ${currentQuestion}`}</strong></div>
          <div style="margin-left: 20px; line-height: 1.8;">${optionsHtml}</div>
        </div>`;
      } else if (currentQuestion) {
        questionIdx++;
        result += `<div class="question-item" data-section-idx="${sectionIdx}" data-question-idx="${questionIdx}" style="margin-bottom: 18px;">
          <div style="margin-bottom: 8px;"><strong>${/^[\d]+\./.test(currentQuestion) ? currentQuestion : `${questionNumber++}. ${currentQuestion}`}</strong></div>
          <div style="margin-left: 20px;">Answer: <span style="display: inline-block; width: 300px; border-bottom: 1px solid #000; height: 16px;"></span></div>
        </div>`;
      }
      return result;
    }

  function getSelectedCategories() {
    const categorySelect = document.getElementById('categorySelect');
    if (!categorySelect) return [];
    const selectedOptions = Array.from(categorySelect.selectedOptions);
    return selectedOptions.map(option => option.value);
  }

  // Live update: listen for changes on all relevant fields
  [
    'readingPassage',
    'readingQuestions',
    'readingAnswers',
    'readingTitle',
    'fontSelect',
    'fontSizeInput',
    'templateSelect',
    'includePassage',
    'categorySelect',
    'numQuestions',
    'questionFormat'
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', updateReadingPreview);
      el.addEventListener('change', updateReadingPreview);
    }
  });

  // Generate Questions with AI
  const generateBtn = document.getElementById('generateQuestionsBtn');
  if (generateBtn) {
    generateBtn.onclick = async () => {
      const passage = document.getElementById('readingPassage').value.trim();
      const numQuestions = document.getElementById('numQuestions').value || 5;
      const questionFormat = document.getElementById('questionFormat').value || 'multiple-choice';
      const categories = getSelectedCategories();

      if (!passage) return alert("Please enter a reading passage first.");
      if (categories.length === 0) return alert("Please select at least one question category.");

      generateBtn.disabled = true;
      generateBtn.textContent = "Generating Questions...";
      try {
        const result = await extractQuestionsWithAI(passage, numQuestions, categories, questionFormat);

        const existingQuestions = document.getElementById('readingQuestions').value.trim();
        const existingAnswers = document.getElementById('readingAnswers').value.trim();

        const newQuestions = result.questions.trim();
        const newAnswers = result.answers.trim();

        const updatedQuestions = existingQuestions
          ? `${existingQuestions}\n\n${newQuestions}`
          : newQuestions;

        const updatedAnswers = existingAnswers
          ? `${existingAnswers}\n\n${newAnswers}`
          : newAnswers;

        const questionLines = updatedQuestions.split('\n');
        let sectionCount = 0;
        let questionNumber = 1;
        let hasFirstSection = false;

        const renumberedQuestions = questionLines.map(line => {
          // Check if this is the first question and we haven't added Part A yet
          if (/^\d+\.\s/.test(line) && !hasFirstSection) {
            hasFirstSection = true;
            sectionCount = 1;
            return `Part A: Questions\n\n${questionNumber++}. ${line.replace(/^\d+\.\s/, '')}`;
          }

          if (line.includes('--- Section Break ---')) {
            sectionCount++;
            questionNumber = 1; // Reset numbering after section break
            return `Part ${String.fromCharCode(65 + sectionCount - 1)}: Questions`;
          }

          if (/^\d+\.\s/.test(line)) {
            return `${questionNumber++}. ${line.replace(/^\d+\.\s/, '')}`;
          }

          return line;
        }).join('\n');

        document.getElementById('readingQuestions').value = renumberedQuestions;
        document.getElementById('readingAnswers').value = updatedAnswers;

        updateReadingPreview();
      } catch (e) {
        console.error('AI question generation failed:', e);
        alert("AI question generation failed. Please try again.");
      }

      generateBtn.disabled = false;
      generateBtn.textContent = "Generate Questions";
    };
  }

  // Generate Worksheet Button
  const worksheetBtn = document.getElementById('generateReadingWorksheet');
  if (worksheetBtn) {
    worksheetBtn.addEventListener('click', updateReadingPreview);
  }

  // --- Print Answer Key Popup ---
    const printAnswerKeyBtn = document.getElementById('printAnswerKeyBtn');
    if (printAnswerKeyBtn) {
      printAnswerKeyBtn.addEventListener('click', function() {
        const title = document.getElementById('readingTitle')?.value || "Reading Worksheet";
        const answers = document.getElementById('readingAnswers')?.value || "";
        if (!answers.trim()) {
          alert('No answer key found. Please add answers first.');
          return;
        }
        const formattedAnswers = answers.split('\n').map(line => `<div style='margin-bottom:8px;'>${line}</div>`).join('');
        const printWindow = window.open('', '', 'width=800,height=1000');
        printWindow.document.write(`
          <html>
            <head>
              <title>Answer Key - ${title}</title>
              <link href='https://fonts.googleapis.com/css2?family=Poppins:wght@400;500&display=swap' rel='stylesheet'>
              <style>
                body { font-family: 'Poppins', Arial, sans-serif; margin: 40px; background: #fff; }
                h1 { font-size: 1.5em; color: #2e2b3f; margin-bottom: 24px; }
                .answer-key { margin-top: 24px; }
                .answer-key div { font-size: 1.1em; margin-bottom: 10px; }
                @media print { body { margin: 0.5in; } }
              </style>
            </head>
            <body onload='window.print();'>
              <h1>${title} - Answer Key</h1>
              <div class='answer-key'>${formattedAnswers}</div>
            </body>
          </html>
        `);
        printWindow.document.close();
      });
    }

  // Initial preview
  updateReadingPreview();

  // Make function globally accessible for loadWorksheet
  window.updateReadingPreview = updateReadingPreview;

  // Scale on window resize
  window.addEventListener('resize', scaleWorksheetPreview);

  // --- Test Mode Dropdown Handler ---
    const testModeSelect = document.getElementById('testModeSelect');
    if (testModeSelect) {
      testModeSelect.addEventListener('change', function() {
        window.updateReadingPreview && window.updateReadingPreview();
      });
    }
// End of DOMContentLoaded
});

// --- Worksheet Save/Load Integration ---
// Returns a worksheet object for saving (called by worksheet_manager.html)
function getCurrentWorksheetData() {
  const title = document.getElementById('readingTitle')?.value || "";
  const passage = document.getElementById('readingPassage')?.value || "";
  const questions = document.getElementById('readingQuestions')?.value || "";
  const answers = document.getElementById('readingAnswers')?.value || "";
  const includePassage = document.getElementById('includePassage')?.checked || false;
  
  // Get font and template settings
  const font = document.getElementById('fontSelect')?.value || "'Poppins', sans-serif";
  const fontSize = document.getElementById('fontSizeInput')?.value || "12";
  const template = document.getElementById('templateSelect')?.value || "0";
  
  // Get selected categories
  const categoryElements = document.querySelectorAll('#categorySelect option:checked');
  const categories = Array.from(categoryElements).map(option => option.value);
  
  const settings = {
    font: font,
    font_size: fontSize,
    template: template,
    include_passage: includePassage,
    categories: categories
  };

  return {
    worksheet_type: 'reading',
    title: title,
    passage_text: passage,
    questions: questions,
    answers: answers,
    settings: JSON.stringify(settings)
  };
}

// Loads a worksheet object into the UI (called by worksheet_manager.html)
function loadWorksheet(worksheet) {
  if (!worksheet || worksheet.worksheet_type !== 'reading') return;
  
  // Populate basic fields
  if (document.getElementById('readingTitle')) {
    document.getElementById('readingTitle').value = worksheet.title || "";
  }
  if (document.getElementById('readingPassage')) {
    document.getElementById('readingPassage').value = worksheet.passage_text || "";
  }
  if (document.getElementById('readingQuestions')) {
    document.getElementById('readingQuestions').value = worksheet.questions || "";
  }
  if (document.getElementById('readingAnswers')) {
    document.getElementById('readingAnswers').value = worksheet.answers || "";
  }

  // Restore settings from worksheet.settings (JSON string)
  let settings = {};
  if (worksheet.settings) {
    try {
      settings = typeof worksheet.settings === 'string' ? JSON.parse(worksheet.settings) : worksheet.settings;
    } catch (e) {
      console.warn('Failed to parse reading worksheet settings:', e);
      settings = {};
    }
  }

  // Restore font
  if (settings.font && document.getElementById('fontSelect')) {
    document.getElementById('fontSelect').value = settings.font;
  }
  
  // Restore font size
  if (settings.font_size && document.getElementById('fontSizeInput')) {
    document.getElementById('fontSizeInput').value = settings.font_size;
  }
  
  // Restore template
  if (settings.template && document.getElementById('templateSelect')) {
    document.getElementById('templateSelect').value = settings.template;
  }
  
  // Restore include passage setting
  if (settings.include_passage !== undefined && document.getElementById('includePassage')) {
    document.getElementById('includePassage').checked = settings.include_passage;
  }
  
  // Restore categories
  if (settings.categories && Array.isArray(settings.categories)) {
    const categorySelect = document.getElementById('categorySelect');
    if (categorySelect) {
      // Deselect all options first
      categorySelect.querySelectorAll('option').forEach(option => option.selected = false);
      // Select the options from the worksheet
      settings.categories.forEach(category => {
        const option = Array.from(categorySelect.options).find(opt => opt.value === category);
        if (option) {
          option.selected = true;
        }
      });
    }
  }

  // Trigger initial preview update
  setTimeout(() => {
    window.updateReadingPreview && window.updateReadingPreview();
  }, 100);
}
