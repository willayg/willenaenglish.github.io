// Reading Worksheet Generator
import { extractQuestionsWithAI } from './ai.js';
import { applyPreviewFontStyles, loadGoogleFont, scaleWorksheetPreview } from '../tests/fonts.js';

document.addEventListener('DOMContentLoaded', () => {
    async function updateReadingPreview() {
    const passage = document.getElementById('readingPassage').value.trim();
    const questions = document.getElementById('readingQuestions').value.trim();
    const includePassage = document.getElementById('includePassage').checked;
    const preview = document.getElementById('worksheetPreviewArea-reading');
    const title = document.getElementById('readingTitle').value.trim() || "Reading Comprehension";
    const font = document.getElementById('readingFont').value || "'Poppins', sans-serif";
    const fontSizeScale = parseFloat(document.getElementById('readingFontSize')?.value || "1");
    const templateIndex = parseInt(document.getElementById('readingTemplate')?.value || "0", 10);
    const template = window.worksheetTemplates?.[templateIndex] || window.worksheetTemplates[0];

    if (!passage && !questions) {
      preview.innerHTML = "<div class='text-gray-400 p-4'>Enter a reading passage and generate questions to preview the worksheet.</div>";
      return;
    }

    // Format the questions for display
    const formattedQuestions = formatQuestions(questions);
    
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

    // Render with template
    preview.innerHTML = template.render({
      title,
      instructions: "",
      puzzle: worksheetContent,
      orientation: "portrait"
    });

    // Apply font styles
    applyPreviewFontStyles(preview, font, fontSizeScale);
    
    // Load Google Font if needed
    loadGoogleFont(font);
    
    // Scale preview
    scaleWorksheetPreview();
  }  function formatQuestions(questionsText) {
    if (!questionsText.trim()) return "";
    
    const lines = questionsText.split('\n').filter(line => line.trim());
    let questionNumber = 1;
    let result = "";
    let currentQuestion = "";
    let currentOptions = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check if this line is an option (starts with a), b), c), etc. or A), B), C), etc.)
      const isOption = /^[a-dA-D]\)/.test(line);
      
      if (isOption) {
        // This is an option, add it to current options
        currentOptions.push(line);
      } else {
        // This is a new question
        // First, process any pending question with options
        if (currentQuestion && currentOptions.length > 0) {
          // Format the previous question with horizontal options
          const optionsHtml = currentOptions.map(opt => 
            `<span style="margin-right: 30px; display: inline-block;">${opt}</span>`
          ).join('');
          
          result += `<div style="margin-bottom: 18px;">
            <div style="margin-bottom: 8px;">
              <strong>${/^\d+\./.test(currentQuestion) ? currentQuestion : `${questionNumber++}. ${currentQuestion}`}</strong>
            </div>
            <div style="margin-left: 20px; line-height: 1.8;">
              ${optionsHtml}
            </div>
          </div>`;
          
          currentOptions = [];
        } else if (currentQuestion) {
          // Process regular question without options
          result += `<div style="margin-bottom: 18px;">
            <div style="margin-bottom: 8px;">
              <strong>${/^\d+\./.test(currentQuestion) ? currentQuestion : `${questionNumber++}. ${currentQuestion}`}</strong>
            </div>
            <div style="margin-left: 20px;">
              Answer: <span style="display: inline-block; width: 300px; border-bottom: 1px solid #000; height: 16px;"></span>
            </div>
          </div>`;
        }
        
        // Set the new current question
        currentQuestion = line;
      }
    }
    
    // Process the last question
    if (currentQuestion && currentOptions.length > 0) {
      // Format question with horizontal options
      const optionsHtml = currentOptions.map(opt => 
        `<span style="margin-right: 30px; display: inline-block;">${opt}</span>`
      ).join('');
      
      result += `<div style="margin-bottom: 18px;">
        <div style="margin-bottom: 8px;">
          <strong>${/^\d+\./.test(currentQuestion) ? currentQuestion : `${questionNumber++}. ${currentQuestion}`}</strong>
        </div>
        <div style="margin-left: 20px; line-height: 1.8;">
          ${optionsHtml}
        </div>
      </div>`;
    } else if (currentQuestion) {
      // Process regular question without options
      result += `<div style="margin-bottom: 18px;">
        <div style="margin-bottom: 8px;">
          <strong>${/^\d+\./.test(currentQuestion) ? currentQuestion : `${questionNumber++}. ${currentQuestion}`}</strong>
        </div>
        <div style="margin-left: 20px;">
          Answer: <span style="display: inline-block; width: 300px; border-bottom: 1px solid #000; height: 16px;"></span>
        </div>
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
  // Live update: listen for changes on all relevant fields
  [
    'readingPassage',
    'readingQuestions',
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

  // Generate Questions with AI
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
        const questions = await extractQuestionsWithAI(passage, numQuestions, categories, questionFormat);
        document.getElementById('readingQuestions').value = questions.trim();
        updateReadingPreview();
      } catch (e) {
        console.error('AI question generation failed:', e);
        alert("AI question generation failed. Please try again.");
      }
      
      generateBtn.disabled = false;
      generateBtn.textContent = "Generate Questions with AI";
    };
  }

  // Generate Worksheet Button
  const worksheetBtn = document.getElementById('generateReadingWorksheet');
  if (worksheetBtn) {
    worksheetBtn.addEventListener('click', updateReadingPreview);
  }

  // Initial preview
  updateReadingPreview();

  // Make function globally accessible for loadWorksheet
  window.updateReadingPreview = updateReadingPreview;

  // Scale on window resize
  window.addEventListener('resize', scaleWorksheetPreview);
});

// Export function for use by main.js
window.generateReadingWorksheet = function() {
  if (window.updateReadingPreview) {
    window.updateReadingPreview();
  }
};
