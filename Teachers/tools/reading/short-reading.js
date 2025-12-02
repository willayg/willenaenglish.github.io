// Reading Worksheet Generator
import { extractQuestionsWithAI } from './ai.js';
import { applyPreviewFontStyles, loadGoogleFont, scaleWorksheetPreview } from '../tests/fonts.js';

document.addEventListener('DOMContentLoaded', () => {
    async function updateReadingPreview() {
    console.log('updateReadingPreview called');
    const passage = document.getElementById('readingPassage').value.trim();
    const questions = document.getElementById('readingQuestions').value.trim();
    const includePassage = document.getElementById('includePassage').checked;
    const preview = document.getElementById('worksheetPreviewArea-reading');
    const title = document.getElementById('readingTitle').value.trim() || "Reading Comprehension";
    const font = document.getElementById('readingFont').value || "'Poppins', sans-serif";
    const fontSizeScale = parseFloat(document.getElementById('readingFontSize')?.value || "1");
    console.log('Font values:', { font, fontSizeScale });
    const templateIndex = parseInt(document.getElementById('readingTemplate')?.value || "0", 10);
    const template = window.worksheetTemplates?.[templateIndex] || window.worksheetTemplates[0];

    if (!passage && !questions) {
      preview.innerHTML = `
        <div class="worksheet-preview" style="font-family:${font};font-size:${fontSizeScale}em;">
          <div class="worksheet-page">
            <div class="page-header">
              <h1 style="font-weight: bold; text-align: center; margin-bottom: 10px; color: #2e2b3f; letter-spacing: 1px;">${title}</h1>
            </div>
            <div class="page-content" style="padding: 20px;">
              <div class="text-gray-400 p-4">
                Enter a reading passage and generate questions to preview the worksheet.
                <br><br>
                <strong>Worksheet:</strong>
                <br>Your worksheet will appear here.
                <br>Font: ${font}
                <br>Size scale: ${fontSizeScale}
              </div>
            </div>
          </div>
        </div>
      `;
      return;
    }

    // Format the questions for display
    const formattedQuestions = formatQuestions(questions, font, fontSizeScale);
    
    // Build the worksheet content
    let worksheetContent = "";
    // Add passage section if requested
    if (includePassage && passage) {
      worksheetContent += `
        <div style="margin-bottom: 20px;">
          <h3 style="font-weight: bold; margin-bottom: 10px;">Reading Passage:</h3>
          <div style="line-height: 1.6; margin-bottom: 20px; padding: 15px; background: #f9f9f9;">
            ${passage.replace(/\n/g, '<br>')}
          </div>
        </div>
      `;
    }
    
    // Add questions section
    if (formattedQuestions) {
      worksheetContent += `
        <div>
          <h3 style="font-weight: bold; margin-bottom: 15px;">Questions:</h3>
          ${formattedQuestions}
        </div>
      `;
    }

    // Always use the selected template and font for preview
    let templateHtml = template.render({
      title,
      instructions: "",
      puzzle: worksheetContent,
      orientation: "portrait"
    });
    // Remove any font-family from the template output to avoid override
    templateHtml = templateHtml.replace(/font-family:[^;"']+;?/gi, '');
    preview.innerHTML = `<div class="worksheet-preview" style="font-family:${font};font-size:${fontSizeScale}em;">${templateHtml}</div>`;
    
    // Apply font styles to the preview area
    applyPreviewFontStyles(preview, font, fontSizeScale);
    
    // Load Google Font if needed
    loadGoogleFont(font);
    
    // Scale preview
    scaleWorksheetPreview();
  }

  function formatQuestions(questionsText, font, fontSizeScale) {
    if (!questionsText.trim()) return "";
    const lines = questionsText.split('\n').filter(line => line.trim());
    let questionNumber = 1;
    let result = "";
    let currentQuestion = "";
    let currentOptions = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const isOption = /^[a-dA-D]\)/.test(line);
      if (isOption) {
        currentOptions.push(line);
      } else {
        if (currentQuestion && currentOptions.length > 0) {
          const optionsHtml = currentOptions.map(opt => 
            `<span style="margin-right: 30px; display: inline-block;">${opt}</span>`
          ).join('');
          result += `<div style="margin-bottom: 18px;">
            <div style="margin-bottom: 8px;"><strong>${/^[\d]+\./.test(currentQuestion) ? currentQuestion : `${questionNumber++}. ${currentQuestion}`}</strong></div>
            <div style="margin-left: 20px; line-height: 1.8;">${optionsHtml}</div>
          </div>`;
          currentOptions = [];
        } else if (currentQuestion) {
          // Only add answer line for non-multiple-choice questions
          result += `<div style="margin-bottom: 18px;">
            <div style="margin-bottom: 8px;"><strong>${/^[\d]+\./.test(currentQuestion) ? currentQuestion : `${questionNumber++}. ${currentQuestion}`}</strong></div>
          </div>`;
        }
        currentQuestion = line;
      }
    }
    if (currentQuestion && currentOptions.length > 0) {
      const optionsHtml = currentOptions.map(opt => 
        `<span style="margin-right: 30px; display: inline-block;">${opt}</span>`
      ).join('');
      result += `<div style="margin-bottom: 18px;">
        <div style="margin-bottom: 8px;"><strong>${/^[\d]+\./.test(currentQuestion) ? currentQuestion : `${questionNumber++}. ${currentQuestion}`}</strong></div>
        <div style="margin-left: 20px; line-height: 1.8;">${optionsHtml}</div>
      </div>`;
    } else if (currentQuestion) {
      result += `<div style="margin-bottom: 18px;">
        <div style="margin-bottom: 8px;"><strong>${/^[\d]+\./.test(currentQuestion) ? currentQuestion : `${questionNumber++}. ${currentQuestion}`}</strong></div>
      </div>`;
    }
    return result;
  }

  function getSelectedCategories() {
    const categories = [];
    if (document.getElementById('categoryComprehension').checked) categories.push('comprehension');
    if (document.getElementById('categoryVocabulary').checked) categories.push('vocabulary');
    if (document.getElementById('categoryGrammar').checked) categories.push('grammar');
    if (document.getElementById('categoryInference').checked) categories.push('inference');
    if (document.getElementById('categoryMainIdea').checked) categories.push('main idea');
    return categories;
  }

  [
    'readingPassage',
    'readingQuestions',
    'readingAnswers',
    'readingTitle',
    'readingFont',
    'readingFontSize',
    'readingTemplate',
    'includePassage'
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', updateReadingPreview);
      el.addEventListener('change', updateReadingPreview);
    }
  });

  const generateBtn = document.getElementById('generateQuestionsBtn');
  if (generateBtn) {
    generateBtn.onclick = async () => {
      const passage = document.getElementById('readingPassage').value.trim();
      const numQuestions = document.getElementById('readingNumQuestions').value || 5;
      const questionFormat = document.getElementById('readingQuestionFormat').value || 'multiple-choice';
      const categories = getSelectedCategories();
      
      if (!passage) return alert("Please enter a reading passage first.");
      if (categories.length === 0) return alert("Please select at least one question category.");
      
      generateBtn.disabled = true;
      generateBtn.textContent = "Generating Questions...";
        try {
        const result = await extractQuestionsWithAI(passage, numQuestions, categories, questionFormat);
        document.getElementById('readingQuestions').value = result.questions.trim();
        document.getElementById('readingAnswers').value = result.answers.trim();
        updateReadingPreview();
      } catch (e) {
        console.error('AI question generation failed:', e);
        alert("AI question generation failed. Please try again.");
      }
      
      generateBtn.disabled = false;
      generateBtn.textContent = "Generate Questions with AI";
    };
  }

  const worksheetBtn = document.getElementById('generateReadingWorksheet');
  if (worksheetBtn) {
    worksheetBtn.addEventListener('click', updateReadingPreview);
  }

  // Clear all questions and answers
  const clearAllBtn = document.getElementById('clearAllQuestionsBtn');
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', () => {
      document.getElementById('readingQuestions').value = '';
      document.getElementById('answerKey').value = '';
      updateReadingPreview();
    });
  }

  updateReadingPreview();
  window.updateReadingPreview = updateReadingPreview;
  window.addEventListener('resize', scaleWorksheetPreview);
});

window.generateReadingWorksheet = function() {
  if (window.updateReadingPreview) {
    window.updateReadingPreview();
  }
};
