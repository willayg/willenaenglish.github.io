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

    // --- FIX: Use template for single-page, multi-page for overflow ---
    // Create a temporary element to check if content fits on one page
    const temp = document.createElement('div');
    temp.style.cssText = `position:absolute;visibility:hidden;width:794px;height:1123px;left:-9999px;top:-9999px;font-family:${font};font-size:${fontSizeScale}em;`;
    // Remove any font-family from the template output to avoid override
    let templateHtml = template.render({
      title,
      instructions: "",
      puzzle: worksheetContent,
      orientation: "portrait"
    });
    templateHtml = templateHtml.replace(/font-family:[^;"']+;?/gi, '');
    preview.innerHTML = `<div class="worksheet-preview" style="font-family:${font};font-size:${fontSizeScale}em;">${templateHtml}</div>`;
    
    // Apply font styles to the preview area
    applyPreviewFontStyles(preview, font, fontSizeScale);
    
    // Load Google Font if needed
    loadGoogleFont(font);
    
    // Scale preview
    scaleWorksheetPreview();
  }  function formatQuestions(questionsText, font, fontSizeScale) {
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
          result += `<div style="margin-bottom: 18px;">
            <div style="margin-bottom: 8px;"><strong>${/^[\d]+\./.test(currentQuestion) ? currentQuestion : `${questionNumber++}. ${currentQuestion}`}</strong></div>
            <div style="margin-left: 20px;">Answer: <span style="display: inline-block; width: 300px; border-bottom: 1px solid #000; height: 16px;"></span></div>
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
        <div style="margin-left: 20px;">Answer: <span style="display: inline-block; width: 300px; border-bottom: 1px solid #000; height: 16px;"></span></div>
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
  }  // Live update: listen for changes on all relevant fields
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

function createReadingWorksheetPages(title, content, font, fontSizeScale) {
  console.log('Creating reading worksheet pages with content:', content.substring(0, 100) + '...');
  
  if (!content) {
    return `<div class="multi-page-worksheet" style="font-family: ${font}; font-size: ${fontSizeScale}em;"><div class="worksheet-page"><div class="page-header"></div><div class="page-content"></div><div class="page-footer"></div></div></div>`;
  }
  
  // Create pages by actually filling them one by one
  const pages = fillReadingPagesSequentially(title, content, font, fontSizeScale);
  console.log('Generated pages:', pages.length);
    let html = `<div class="multi-page-worksheet" style="font-family: ${font}; font-size: ${fontSizeScale}em;">`;
  
  pages.forEach((pageContent, index) => {
    console.log(`Page ${index + 1} content length:`, pageContent.length);
    html += `
      <div class="worksheet-page" style="font-family: ${font}; font-size: ${fontSizeScale}em;">
        ${renderReadingPageHeader(title, index, font, fontSizeScale)}
        <div class="page-content" style="font-family: ${font}; font-size: ${fontSizeScale}em;">
          ${pageContent}
        </div>
        ${renderReadingPageFooter(index + 1, pages.length, font, fontSizeScale)}
      </div>
    `;
    
    // Add page break indicator between pages (for preview only)
    if (index < pages.length - 1) {
      html += '<div class="page-break-indicator" style="text-align: center; padding: 10px; margin: 10px 0; background: #f0ebff; color: #7c3aed; border-radius: 8px; font-size: 0.9rem;">📄 Page Break - Content continues on next page</div>';
    }
  });
  
  html += '</div>';
  return html;
}

function fillReadingPagesSequentially(title, content, font, fontSizeScale) {
  console.log('Filling pages with content length:', content.length);
  
  // Create a real page container for testing
  const pageContainer = createReadingTestPageContainer(title, font, fontSizeScale, true);
  document.body.appendChild(pageContainer);
  
  const pages = [];
  const contentParts = parseReadingContentIntoSmallParts(content);
  console.log('Content split into parts:', contentParts.length);
  
  let currentPageContent = '';
  let partIndex = 0;
  let isFirstPage = true;
  
  while (partIndex < contentParts.length) {
    const part = contentParts[partIndex];
    const testContent = currentPageContent + part;
    
    // Test if this content fits on current page
    const contentDiv = pageContainer.querySelector('.page-content');
    contentDiv.innerHTML = testContent;
    
    // Check if content overflows
    const overflows = contentDiv.scrollHeight > contentDiv.clientHeight;
    console.log(`Part ${partIndex}: scrollHeight=${contentDiv.scrollHeight}, clientHeight=${contentDiv.clientHeight}, overflows=${overflows}`);
    
    if (overflows && currentPageContent !== '') {
      // Current page is full, save it and start new page
      console.log('Page full, creating new page. Current content length:', currentPageContent.length);
      pages.push(currentPageContent);
      currentPageContent = '';
      isFirstPage = false;
      
      // Update page header for continuation pages
      updateReadingPageHeaderForContinuation(pageContainer, title);
      
      // Don't increment partIndex - retry this part on new page
      continue;
    } else {
      // Part fits, add it to current page
      currentPageContent = testContent;
      partIndex++;
    }
  }
  
  // Add final page if it has content
  if (currentPageContent) {
    console.log('Adding final page with content length:', currentPageContent.length);
    pages.push(currentPageContent);
  }
  
  document.body.removeChild(pageContainer);
  console.log('Total pages created:', pages.length);
  return pages.length > 0 ? pages : [''];
}

function createReadingTestPageContainer(title, font, fontSizeScale, isFirstPage) {
  const container = document.createElement('div');
  container.className = 'worksheet-page';
  container.style.cssText = `
    visibility: hidden;
    position: absolute;
    top: -9999px;
    left: -9999px;
    width: 794px;
    height: 1123px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: white;
    font-family: ${font};
    font-size: ${fontSizeScale}em;
  `;
  
  // Create header
  const header = document.createElement('div');
  header.className = 'page-header';
  header.style.cssText = 'flex-shrink: 0; padding: 32px 32px 20px 32px;';
  
  if (isFirstPage) {
    header.innerHTML = `
      <img src="../Assets/Images/color-logo1.png" alt="Willena Logo" style="display:block;margin:0 auto 16px auto;width:110px;">
      <div style="display:flex; justify-content:space-between; margin-bottom:18px; font-family:'Glacial Indifference', Arial, sans-serif; font-size:1.05rem; color:#222;">
        <span>Name: <span style="display:inline-block; border-bottom:1px solid #bbb; min-width:120px;">&nbsp;</span></span>
        <span>Date: <span style="display:inline-block; border-bottom:1px solid #bbb; min-width:90px;">&nbsp;</span></span>
      </div>
      <h1 style="font-size:2.2rem;font-weight:bold;text-align:center;margin-bottom:10px;color:#2e2b3f;letter-spacing:1px;">${title || ""}</h1>
    `;
  } else {
    header.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:25px; padding-bottom:15px; border-bottom:2px solid #2e2b3f;">
        <div>
          <h2 style="font-size:1.6rem;font-weight:bold;color:#2e2b3f;margin:0;letter-spacing:0.5px;">${title || ""}</h2>
          <div style="font-size:0.9rem;color:#666;margin-top:4px;">continued from previous page</div>
        </div>
        <div style="display:flex; flex-direction:column; gap:6px; font-size:0.95rem; color:#222;">
          <span>Name: <span style="display:inline-block; border-bottom:1px solid #bbb; min-width:100px;">&nbsp;</span></span>
          <span>Date: <span style="display:inline-block; border-bottom:1px solid #bbb; min-width:80px;">&nbsp;</span></span>
        </div>
      </div>
    `;
  }
    // Create content area
  const contentArea = document.createElement('div');
  contentArea.className = 'page-content';
  contentArea.style.cssText = `
    flex: 1 1 auto;
    padding: 0 32px;
    overflow: hidden;
    word-wrap: break-word;
    overflow-wrap: break-word;
    font-family: ${font};
    font-size: ${fontSizeScale}em;
    max-height: 800px;
  `;
  
  // Create footer
  const footer = document.createElement('div');
  footer.className = 'page-footer';
  footer.style.cssText = `
    flex-shrink: 0;
    padding: 20px 32px 32px 32px;
    margin-top: auto;
    border-top: 1px solid #eee;
    text-align: center;
    color: #888;
    font-size: 0.95rem;
    font-family: 'Glacial Indifference', Arial, sans-serif;
  `;
  footer.innerHTML = `
    Willena 원어민 영어학원 | 031-8041-2203 | www.willenaenglish.com
    <div style="position: absolute; bottom: 15px; right: 32px; font-size: 0.9rem; color: #666;">Page 1</div>
  `;
  
  container.appendChild(header);
  container.appendChild(contentArea);
  container.appendChild(footer);
  
  return container;
}

function updateReadingPageHeaderForContinuation(pageContainer, title) {
  const header = pageContainer.querySelector('.page-header');
  header.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:25px; padding-bottom:15px; border-bottom:2px solid #2e2b3f;">
      <div>
        <h2 style="font-size:1.6rem;font-weight:bold;color:#2e2b3f;margin:0;letter-spacing:0.5px;">${title || ""}</h2>
        <div style="font-size:0.9rem;color:#666;margin-top:4px;">continued from previous page</div>
      </div>
      <div style="display:flex; flex-direction:column; gap:6px; font-size:0.95rem; color:#222;">
        <span>Name: <span style="display:inline-block; border-bottom:1px solid #bbb; min-width:100px;">&nbsp;</span></span>
        <span>Date: <span style="display:inline-block; border-bottom:1px solid #bbb; min-width:80px;">&nbsp;</span></span>
      </div>
    </div>
  `;
}

function parseReadingContentIntoSmallParts(content) {
  // Split content into very small, atomic parts
  const parts = [];
  
  // First try to split by HTML elements
  const htmlParts = content.split(/(<[^>]+>[^<]*<\/[^>]+>|<[^>]+\/?>)/g);
  
  for (const part of htmlParts) {
    if (!part || !part.trim()) continue;
    
    // If this is a large text block, split it further
    if (part.length > 200 && !part.includes('<')) {
      // Split by sentences
      const sentences = part.split(/([.!?]+\s+)/g);
      for (const sentence of sentences) {
        if (sentence && sentence.trim()) {
          parts.push(sentence);
        }
      }
    } else {
      parts.push(part);
    }
  }
  
  return parts.filter(part => part && part.trim());
}

function renderReadingPageHeader(title, pageIndex, font, fontSizeScale) {
  const isFirstPage = pageIndex === 0;
  
  let headerHtml = `<div class="page-header" style="font-family: ${font}; font-size: ${fontSizeScale}em;">`;
  
  if (isFirstPage) {
    // Full header with logo, title, etc. on first page
    headerHtml += `
      <img src="../Assets/Images/color-logo1.png" alt="Willena Logo" style="display:block;margin:0 auto 16px auto;width:110px;">
      <div style="display:flex; justify-content:space-between; margin-bottom:18px; font-family:${font}; font-size:${0.95 * fontSizeScale}em; color:#222;">
        <span>Name: <span style="display:inline-block; border-bottom:1px solid #bbb; min-width:120px;">&nbsp;</span></span>
        <span>Date: <span style="display:inline-block; border-bottom:1px solid #bbb; min-width:90px;">&nbsp;</span></span>
      </div>
      <h1 style="font-size:${2.2 * fontSizeScale}em;font-weight:bold;text-align:center;margin-bottom:10px;color:#2e2b3f;letter-spacing:1px;font-family:${font};">${title || ""}</h1>
    `;
  } else {
    // Continuation page header
    headerHtml += `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:25px; padding-bottom:15px; border-bottom:2px solid #2e2b3f;">
        <div>
          <h2 style="font-size:${1.6 * fontSizeScale}em;font-weight:bold;color:#2e2b3f;margin:0;letter-spacing:0.5px;font-family:${font};">${title || ""}</h2>
          <div style="font-size:${0.9 * fontSizeScale}em;color:#666;margin-top:4px;font-family:${font};">continued from previous page</div>
        </div>
        <div style="display:flex; flex-direction:column; gap:6px; font-size:${0.95 * fontSizeScale}em; color:#222;font-family:${font};">
          <span>Name: <span style="display:inline-block; border-bottom:1px solid #bbb; min-width:100px;">&nbsp;</span></span>
          <span>Date: <span style="display:inline-block; border-bottom:1px solid #bbb; min-width:80px;">&nbsp;</span></span>
        </div>
      </div>
    `;
  }
  
  headerHtml += '</div>';
  return headerHtml;
}

function renderReadingPageFooter(pageNumber, totalPages, font, fontSizeScale) {
  return `
    <div class="page-footer" style="font-family: ${font}; font-size: ${0.95 * fontSizeScale}em;">
      Willena 원어민 영어학원 | 031-8041-2203 | www.willenaenglish.com
      <div class="page-number" style="font-family: ${font}; font-size: ${0.9 * fontSizeScale}em;">Page ${pageNumber} of ${totalPages}</div>
    </div>
  `;
}
