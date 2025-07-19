// --- Sectioned Worksheet State ---
window.readingWorksheetSections = [];

function getNextSectionLetter() {
  return String.fromCharCode(65 + window.readingWorksheetSections.length); // 'A', 'B', ...
}

function getSectionInfo(category) {
  switch (category) {
    case 'comprehension-mc': return { title: 'Comprehension (Multiple Choice)', instructions: 'Read the passage and answer the following multiple choice questions.' };
    case 'comprehension-choose-word-mc': return { title: 'Comprehension (Choose the Word)', instructions: 'Choose the correct word to complete each sentence.' };
    case 'comprehension-sa': return { title: 'Comprehension (Short Answer)', instructions: 'Answer the following questions in complete sentences.' };
    case 'vocabulary-mc': return { title: 'Vocabulary (Multiple Choice)', instructions: 'Choose the correct meaning for each word.' };
    case 'vocabulary-context-mc': return { title: 'Vocab in Context (Multiple Choice)', instructions: 'Choose the correct word for each sentence.' };
    case 'grammar-mc': return { title: 'Grammar (Multiple Choice)', instructions: 'Choose the correct answer for each grammar question.' };
    case 'grammar-correction': return { title: 'Grammar (Correction)', instructions: 'Correct the mistakes in each sentence.' };
    case 'grammar-unscramble': return { title: 'Grammar Unscramble', instructions: 'Unscramble the words to make correct sentences.' };
    case 'inference-sa': return { title: 'Inference (Short Answer)', instructions: 'Answer the inference questions based on the passage.' };
    case 'inference-mc': return { title: 'Inference (Multiple Choice)', instructions: 'Choose the best answer for each inference question.' };
    default: return { title: '', instructions: '' };
  }
}

window.updateReadingPreview = function() {
  const previewArea = document.getElementById('worksheetPreviewArea-reading');
  if (!previewArea) return;
  previewArea.innerHTML = '';
  // Optionally show passage at top
  const includePassage = document.getElementById('includePassage')?.checked;
  const passage = document.getElementById('readingPassage')?.value.trim();
  if (includePassage && passage) {
    const passageDiv = document.createElement('div');
    passageDiv.className = 'worksheet-passage';
    passageDiv.innerHTML = `<h3>Reading Passage</h3><div>${passage.replace(/\n/g, '<br>')}</div>`;
    previewArea.appendChild(passageDiv);
  }
  // Render each section
  window.readingWorksheetSections.forEach((section) => {
    const sectionDiv = document.createElement('div');
    sectionDiv.className = 'worksheet-section';
    sectionDiv.innerHTML = `
      <h3>Part ${section.letter}: ${section.title}</h3>
      <div class="section-instructions">${section.instructions}</div>
      <ol class="section-questions">
        ${section.questions.map(q => {
          // Format multiple choice (including inference-mc) options on new lines with spacing
          if (typeof q === 'string' && /\n[a-dA-D]\)/.test('\n' + q)) {
            // Split question from options
            const match = q.match(/^(.*?)(?=(?:\n[a-dA-D]\)))/s);
            const questionText = match ? match[1].trim() : q;
            // Find all options
            const options = Array.from(q.matchAll(/^[a-dA-D]\)[^\n]*/gm)).map(opt => opt[0].trim());
            return `<li style="margin-bottom:18px;">
              <div style="margin-bottom:6px;"><strong>${questionText}</strong></div>
              <div style="margin-left:18px;">
                ${options.map(opt => `<div style="margin-bottom:14px;">${opt}</div>`).join('')}
              </div>
            </li>`;
          } else {
            return `<li>${q}</li>`;
          }
        }).join('')}
      </ol>
      ${section.answers && section.answers.length ? `<details><summary>Answer Key</summary><ol>${section.answers.map(a => `<li>${a}</li>`).join('')}</ol></details>` : ''}
    `;
    previewArea.appendChild(sectionDiv);
  });
  if (window.readingWorksheetSections.length === 0) {
    const placeholder = document.createElement('div');
    placeholder.className = 'preview-placeholder';
    placeholder.innerHTML = '<p>Preview will appear here</p>';
    previewArea.appendChild(placeholder);
  }
};
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
        
        // Track absolute question number for simple numbered answers
        let absoluteQuestionNum = 0;
        let targetAbsoluteNum = 0;
        
        // Calculate target absolute question number
        for (let s = 0; s < sectionIdx; s++) {
          const sectionLines = newLines.filter(line => /^Part [A-Z]:/.test(line));
          if (s < sectionLines.length) {
            targetAbsoluteNum += newLines.filter(line => /^\d+\./.test(line) && 
              newLines.indexOf(line) > newLines.indexOf(sectionLines[s]) && 
              (s + 1 >= sectionLines.length || newLines.indexOf(line) < newLines.indexOf(sectionLines[s + 1]))).length;
          }
        }
        targetAbsoluteNum += questionIdx + 1;
        
        for (let i = 0; i < answerLines.length; i++) {
          const line = answerLines[i];
          
          // Handle section-based answers
          if (/^Part [A-Z]:/.test(line)) {
            currentSection++;
            currentQ = -1;
            newAnswerLines.push(line);
            continue;
          }
          
          // Handle numbered answers
          if (/^\d+\./.test(line)) {
            absoluteQuestionNum++;
            currentQ++;
            
            // Skip if this is the answer to delete (section-based)
            if (currentSection === sectionIdx && currentQ === questionIdx && !found) {
              found = true;
              continue;
            }
            
            // Skip if this is the answer to delete (absolute numbering)
            if (absoluteQuestionNum === targetAbsoluteNum && !found) {
              found = true;
              continue;
            }
          }
          
          newAnswerLines.push(line);
        }
        answersTextarea.value = newAnswerLines.join('\n');
      }
      
      renumberQuestionsInTextarea();
      renumberAnswerKey();
    }

    // Helper: Make questions editable in preview (REMOVED - replaced by enableInlineEditingInPreview)
    function makeQuestionsEditableInPreview() {
      // This function is now replaced by enableInlineEditingInPreview()
      // No longer adding click handlers here to avoid conflicts
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
      // makeQuestionsEditableInPreview(); // REMOVED - causes popup conflicts
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

      // Check if inline editing is currently active - don't update if so
      const previewElement = document.getElementById('worksheetPreviewArea-reading');
      if (previewElement && (previewElement.querySelector('textarea') || previewElement.querySelector('input[type="text"]'))) {
        return; // Skip update while editing
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
          
          // Reset inline editing flag since DOM was replaced
          preview._inlineEditingEnabled = false;
          
          // After preview is updated, enable inline editing
          setTimeout(() => {
            enableInlineEditingInPreview();
          }, 100);
        });
      } else {
        // Content hasn't changed, but still need to enable editing if not already done
        if (!previewElement._inlineEditingEnabled) {
          setTimeout(() => {
            enableInlineEditingInPreview();
          }, 100);
        }
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
      
      // Check if we're dealing with grammar unscramble format
      const selectedCategories = getSelectedCategories();
      const isGrammarUnscramble = selectedCategories.includes('grammar-unscramble');
      
      if (isGrammarUnscramble) {
        // Special formatting for grammar unscramble
        const lines = questionsText.split('\n').filter(line => line.trim());
        let result = "<div class='grammar-unscramble-questions'>";
        let questionNumber = 1;
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          // Skip section headers, only process numbered lines
          if (/^\d+\./.test(line)) {
            // Extract the scrambled chunks
            const parts = line.split(/^\d+\.\s*/);
            if (parts.length > 1) {
              const scrambledText = parts[1].split('/').map(chunk => chunk.trim()).join(' / ');
              result += `<div class="question-item" style="margin-bottom: 18px;">
                <div style="margin-bottom: 8px;"><strong>${questionNumber++}. __________________________________________________________</strong></div>
                <div style="margin-left: 20px; line-height: 1.8; border-left: 3px solid #ddd; padding-left: 12px;">
                  ${scrambledText}
                </div>
              </div>`;
            }
          }
        }
        
        result += "</div>";
        return result;
      }
      
      // Original formatting for other question types
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

  // Clear All button functionality
  const clearBtn = document.getElementById('clearBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      const questionsTextarea = document.getElementById('readingQuestions');
      const answersTextarea = document.getElementById('readingAnswers');
      if (questionsTextarea) {
        questionsTextarea.value = '';
        questionsTextarea.dispatchEvent(new Event('input'));
      }
      if (answersTextarea) {
        answersTextarea.value = '';
        answersTextarea.dispatchEvent(new Event('input'));
      }
      window.updateReadingPreview && window.updateReadingPreview();
    });
  }

  // Generate Questions with AI (sectioned)
  const generateBtn = document.getElementById('generateQuestionsBtn');
  if (generateBtn) {
    generateBtn.onclick = async () => {
      const passage = document.getElementById('readingPassage').value.trim();
      const numQuestions = document.getElementById('numQuestions').value || 5;
      const categorySelect = document.getElementById('categorySelect');
      const selectedCategory = categorySelect.value;
      if (!passage) return alert("Please enter a reading passage first.");
      if (!selectedCategory) return alert("Please select a question type.");
      generateBtn.disabled = true;
      generateBtn.textContent = "Generating Questions...";
      try {
        const result = await extractQuestionsWithAI(passage, numQuestions, [selectedCategory]);
        // Parse questions and answers into arrays
        const questionsArr = result.questions
          ? result.questions.split(/\n\s*\d+\.\s*/).filter(q => q.trim()).map((q, i) => (i === 0 && result.questions.match(/^\d+\./)) ? q : q)
          : [];
        const answersArr = result.answers
          ? result.answers.split(/\n\s*\d+\.\s*/).filter(a => a.trim()).map((a, i) => (i === 0 && result.answers.match(/^\d+\./)) ? a : a)
          : [];
        // Get section info
        const sectionLetter = getNextSectionLetter();
        const sectionInfo = getSectionInfo(selectedCategory);
        // Add new section object
        window.readingWorksheetSections.push({
          letter: sectionLetter,
          title: sectionInfo.title,
          instructions: sectionInfo.instructions,
          questions: questionsArr,
          answers: answersArr
        });
        // Update preview
        window.updateReadingPreview();
      } catch (e) {
        console.error('AI question generation failed:', e);
        alert("AI question generation failed. Please try again.");
      }
      generateBtn.disabled = false;
      generateBtn.textContent = "Generate Questions";
    };
  }
  // Remove Add Section Break button and related logic
  const addSectionBreakBtn = document.getElementById('addSectionBreakBtn');
  if (addSectionBreakBtn) {
    addSectionBreakBtn.style.display = 'none';
    addSectionBreakBtn.disabled = true;
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
        
        // Check if we're dealing with grammar unscramble format
        const selectedCategories = getSelectedCategories();
        const isGrammarUnscramble = selectedCategories.includes('grammar-unscramble');
        
        let formattedAnswers = '';
        if (isGrammarUnscramble) {
          // Format grammar unscramble answers as complete sentences
          const answerLines = answers.split('\n').filter(line => line.trim());
          formattedAnswers = '<h3>Grammar Unscramble Answers:</h3><ol style="margin-left: 20px;">';
          for (const line of answerLines) {
            if (/^\d+\./.test(line)) {
              const parts = line.split(/^\d+\.\s*/);
              if (parts.length > 1) {
                formattedAnswers += `<li style="margin-bottom: 8px;">${parts[1]}</li>`;
              }
            }
          }
          formattedAnswers += '</ol>';
        } else {
          // Default formatting for other question types
          formattedAnswers = answers.split('\n').map(line => `<div style='margin-bottom:8px;'>${line}</div>`).join('');
        }
        
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

  // Print worksheet function
function printReadingWorksheet() {
  const preview = document.getElementById('worksheetPreviewArea-reading');
  if (!preview || !preview.innerHTML.trim()) {
    alert('No worksheet to print. Please generate a worksheet first.');
    return;
  }

  const title = document.getElementById('readingTitle')?.value || "Reading Worksheet";
  const font = document.getElementById('fontSelect')?.value || "'Poppins', sans-serif";
  const fontSize = document.getElementById('fontSizeInput')?.value || "12";

  const printWindow = window.open('', '', 'width=800,height=1000');
  printWindow.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <link href='https://fonts.googleapis.com/css2?family=Poppins:wght@400;500&display=swap' rel='stylesheet'>
        <style>
          body {
            font-family: ${font};
            margin: 0.5in;
            background: #fff;
            font-size: ${fontSize}px;
            line-height: 1.5;
          }
          .worksheet-preview {
            width: 100% !important;
            max-width: none !important;
            transform: none !important;
          }
          @media print {
            body {
              margin: 0.5in;
            }
            .worksheet-preview {
              page-break-inside: avoid;
            }
          }
        </style>
      </head>
      <body onload='window.print(); window.close();'>
        ${preview.innerHTML}
      </body>
    </html>
  `);
  printWindow.document.close();
}

// Attach print button functionality
const printBtn = document.getElementById('printWorksheetBtn');
if (printBtn) {
  printBtn.addEventListener('click', printReadingWorksheet);
}

// Make function globally accessible
window.printReadingWorksheet = printReadingWorksheet;

  // Initial preview
  updateReadingPreview();

  // Enable inline editing after initial preview
  setTimeout(() => {
    enableInlineEditingInPreview();
  }, 200);

  // Make function globally accessible for loadWorksheet
  window.updateReadingPreview = updateReadingPreview;
  window.enableInlineEditingInPreview = enableInlineEditingInPreview;

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

  const worksheetData = {
    worksheet_type: 'reading',
    title: title,
    passage_text: passage,
    questions: questions,
    answers: answers,
    settings: JSON.stringify(settings)
  };
  
  // Include id if this worksheet was loaded from database (for updates)
  if (window._currentWorksheetId) {
    worksheetData.id = window._currentWorksheetId;
  }
  
  return worksheetData;
}

// Loads a worksheet object into the UI (called by worksheet_manager.html)
function loadWorksheet(worksheet) {
  if (!worksheet || worksheet.worksheet_type !== 'reading') return;
  
  // Store worksheet id for updates
  window._currentWorksheetId = worksheet.id || null;
  
  // Populate basic fields and dispatch events to update UI
  const titleEl = document.getElementById('readingTitle');
  if (titleEl) {
    titleEl.value = worksheet.title || "";
    titleEl.dispatchEvent(new Event('input', { bubbles: true }));
  }
  const passageEl = document.getElementById('readingPassage');
  if (passageEl) {
    passageEl.value = worksheet.passage_text || "";
    passageEl.dispatchEvent(new Event('input', { bubbles: true }));
  }
  const questionsEl = document.getElementById('readingQuestions');
  if (questionsEl) {
    questionsEl.value = worksheet.questions || "";
    questionsEl.dispatchEvent(new Event('input', { bubbles: true }));
  }
  const answersEl = document.getElementById('readingAnswers');
  if (answersEl) {
    answersEl.value = worksheet.answers || "";
    answersEl.dispatchEvent(new Event('input', { bubbles: true }));
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
  const fontEl = document.getElementById('fontSelect');
  if (settings.font && fontEl) {
    fontEl.value = settings.font;
    fontEl.dispatchEvent(new Event('change', { bubbles: true }));
  }
  
  // Restore font size
  const fontSizeEl = document.getElementById('fontSizeInput');
  if (settings.font_size && fontSizeEl) {
    fontSizeEl.value = settings.font_size;
    fontSizeEl.dispatchEvent(new Event('input', { bubbles: true }));
  }
  
  // Restore template
  const templateEl = document.getElementById('templateSelect');
  if (settings.template && templateEl) {
    templateEl.value = settings.template;
    templateEl.dispatchEvent(new Event('change', { bubbles: true }));
  }
  
  // Restore include passage setting
  const includePassageEl = document.getElementById('includePassage');
  if (settings.include_passage !== undefined && includePassageEl) {
    includePassageEl.checked = settings.include_passage;
    includePassageEl.dispatchEvent(new Event('change', { bubbles: true }));
  }
  
  // Restore categories
  const categorySelect = document.getElementById('categorySelect');
  if (settings.categories && Array.isArray(settings.categories) && categorySelect) {
    // Deselect all options first
    categorySelect.querySelectorAll('option').forEach(option => option.selected = false);
    // Select the options from the worksheet
    settings.categories.forEach(category => {
      const option = Array.from(categorySelect.options).find(opt => opt.value === category);
      if (option) {
        option.selected = true;
      }
    });
    categorySelect.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // Trigger initial preview update
  setTimeout(() => {
    window.updateReadingPreview && window.updateReadingPreview();
  }, 100);
}

// Helper: Renumber answer key to match questions
    function renumberAnswerKey() {
      const answersTextarea = document.getElementById('readingAnswers');
      if (!answersTextarea) return;
      
      const answerLines = answersTextarea.value.split('\n');
      let answerNumber = 1;
      let sectionCount = 0;
      
      const newAnswerLines = answerLines.map(line => {
        if (/^Part [A-Z]:/.test(line)) {
          sectionCount++;
          answerNumber = 1;
          return line;
        }
        if (/^\d+\./.test(line)) {
          const answerText = line.replace(/^\d+\.\s*/, '');
          return `${answerNumber++}. ${answerText}`;
        }
        return line;
      });
      
      answersTextarea.value = newAnswerLines.join('\n');
    }

    // Inline editing for questions and answers in preview
function enableInlineEditingInPreview() {
  const preview = document.getElementById('worksheetPreviewArea-reading');
  if (!preview) return;

  // Check if already enabled to prevent duplicate handlers
  if (preview._inlineEditingEnabled) {
    return;
  }

  // Mark as enabled first
  preview._inlineEditingEnabled = true;

  // Add event delegation for inline editing (use addEventListener for better compatibility)
  preview.addEventListener('click', function handleInlineEditClick(e) {
    // Prevent double-click issues
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') {
      return;
    }

    // Edit question text (clicking on the question)
    const questionDiv = e.target.closest('strong');
    if (questionDiv) {
      const qItem = questionDiv.closest('.question-item');
      if (!qItem || qItem.querySelector('textarea')) return;
      
      const fullText = questionDiv.textContent;
      const questionMatch = fullText.match(/^(\d+\.\s*)(.*)/);
      const questionNumber = questionMatch ? questionMatch[1] : '';
      const questionText = questionMatch ? questionMatch[2] : fullText;
      
      const textarea = document.createElement('textarea');
      textarea.value = questionText;
      textarea.style.cssText = `
        width: 95%; 
        min-height: 40px; 
        font-size: inherit; 
        font-family: inherit; 
        border: 2px solid #007acc; 
        border-radius: 4px; 
        padding: 8px; 
        resize: vertical;
        outline: none;
        background: #f8f9fa;
      `;
      
      questionDiv.style.display = 'none';
      questionDiv.parentNode.insertBefore(textarea, questionDiv);
      textarea.focus();
      textarea.select();
      
      function saveQuestionEdit() {
        const newText = textarea.value.trim();
        questionDiv.textContent = questionNumber + newText;
        questionDiv.style.display = '';
        textarea.remove();
        
        // Update the textarea without causing a full preview refresh
        updateQuestionInTextarea(qItem, questionText, newText);
      }
      
      textarea.addEventListener('blur', saveQuestionEdit);
      textarea.addEventListener('keydown', function(ev) {
        if (ev.key === 'Enter' && !ev.shiftKey) {
          ev.preventDefault();
          saveQuestionEdit();
        } else if (ev.key === 'Escape') {
          questionDiv.style.display = '';
          textarea.remove();
        }
      });
      
      e.stopPropagation();
      return;
    }

    // Edit answer options (clicking on a), b), c), d) choices)
    const optionSpan = e.target.closest('span');
    if (optionSpan && optionSpan.textContent.match(/^[a-dA-D]\)/)) {
      const qItem = optionSpan.closest('.question-item');
      if (!qItem || optionSpan.querySelector('input')) return;
      
      const oldOptionText = optionSpan.textContent;
      const optionMatch = oldOptionText.match(/^([a-dA-D]\)\s*)(.*)/);
      const optionPrefix = optionMatch ? optionMatch[1] : '';
      const optionContent = optionMatch ? optionMatch[2] : oldOptionText;
      
      const input = document.createElement('input');
      input.type = 'text';
      input.value = optionContent;
      input.style.cssText = `
        width: 300px; 
        font-size: inherit; 
        font-family: inherit; 
        border: 2px solid #007acc; 
        border-radius: 4px; 
        padding: 4px 8px; 
        outline: none;
        background: #f8f9fa;
      `;
      
      optionSpan.style.display = 'none';
      optionSpan.parentNode.insertBefore(input, optionSpan);
      input.focus();
      input.select();
      
      function saveOptionEdit() {
        const newContent = input.value.trim();
        const newOptionText = optionPrefix + newContent;
        optionSpan.textContent = newOptionText;
        optionSpan.style.display = '';
        input.remove();
        
        // Update the textarea without causing a full preview refresh
        updateOptionInTextarea(qItem, oldOptionText, newOptionText);
      }
      
      input.addEventListener('blur', saveOptionEdit);
      input.addEventListener('keydown', function(ev) {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          saveOptionEdit();
        } else if (ev.key === 'Escape') {
          optionSpan.style.display = '';
          input.remove();
        }
      });
      
      e.stopPropagation();
      return;
    }
  });
}

function updateQuestionInTextarea(questionItem, oldText, newText) {
  if (oldText === newText) return;
  
  const textarea = document.getElementById('readingQuestions');
  if (!textarea) return;
  
  const sectionIdx = parseInt(questionItem.getAttribute('data-section-idx') || '0');
  const questionIdx = parseInt(questionItem.getAttribute('data-question-idx') || '0');
  
  const lines = textarea.value.split('\n');
  let currentSectionIdx = -1;
  let currentQuestionIdx = -1;
  let foundQuestion = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Track section headers
    if (/^Part [A-Z]:/i.test(line)) {
      currentSectionIdx++;
      currentQuestionIdx = -1;
      continue;
    }
    
    // Skip section breaks
    if (line.includes('--- Section Break ---')) {
      continue;
    }
    
    // Skip option lines
    if (/^[a-dA-D]\)/.test(line)) {
      continue;
    }
    
    // Check if this is a question line (not empty, not section header, not option)
    if (line && !(/^Part [A-Z]:/i.test(line)) && !line.includes('--- Section Break ---') && !(/^[a-dA-D]\)/.test(line))) {
      currentQuestionIdx++;
      
      // If this is our target question
      if (currentSectionIdx === sectionIdx && currentQuestionIdx === questionIdx) {
        // Extract question number if present
        const questionMatch = line.match(/^(\d+\.\s*)(.*)/);
        const questionNumber = questionMatch ? questionMatch[1] : '';
        const questionContent = questionMatch ? questionMatch[2] : line;
        
        // Only update if the content matches our old text
        if (questionContent.trim() === oldText.trim()) {
          lines[i] = questionNumber + newText;
          foundQuestion = true;
          break;
        }
      }
    }
  }
  
  // If we found and updated the question, update the textarea
  if (foundQuestion) {
    textarea.value = lines.join('\n');
  }
}

function updateOptionInTextarea(questionItem, oldOptionText, newOptionText) {
  if (oldOptionText === newOptionText) return;
  
  const textarea = document.getElementById('readingQuestions');
  if (!textarea) return;
  
  const lines = textarea.value.split('\n');
  
  // Find and replace the option text
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === oldOptionText.trim()) {
      lines[i] = newOptionText;
      break;
    }
  }
  
  textarea.value = lines.join('\n');
}

// --- Make worksheet save/load functions accessible to popup ---
window.getCurrentWorksheetData = getCurrentWorksheetData;
window.loadWorksheet = loadWorksheet;
