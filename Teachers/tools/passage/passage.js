// Passage Builder JavaScript - Built for Multi-Page from the Ground Up

import { extractQuestionsWithAI } from './ai.js';

function generatePassage() {
    try {
        const title = document.getElementById('passageTitle').value.trim();
        const content = document.getElementById('passageContent').value.trim();
        const fontFamily = document.getElementById('passageFont').value;
        const fontSize = document.getElementById('passageFontSize').value + 'px';
        // Get questions from the editable box
        const questionsBox = document.getElementById('questionsBox');
        let questions = '';
        if (questionsBox) {
            questions = questionsBox.value.trim();
        }
        
        console.log('Generate passage called with:', { title, content: content.substring(0, 50) + '...', fontFamily, fontSize });
        
        if (!content) {
            const preview = document.getElementById('passagePreview');
            preview.innerHTML = '<div style="padding: 20px; color: #666; text-align: center;">Enter passage content to see preview</div>';
            return;
        }
        
        // Generate the multi-page passage with font settings
        const passagePages = createMultiPagePassage(title, content, fontFamily, fontSize);
        let allPages = [...passagePages];
        // Paginate questions as their own pages if present
        if (questions) {
            const questionsPages = paginateQuestions(questions, fontFamily, fontSize);
            allPages = allPages.concat(questionsPages);
        }
        // Update page numbers for all pages
        const totalPages = allPages.length;
        allPages = allPages.map((page, idx) => page.replace(/Page \d+ of \d+/, `Page ${idx + 1} of ${totalPages}`));
        // Display in preview
        const preview = document.getElementById('passagePreview');
        if (allPages && allPages.length > 0) {
            preview.innerHTML = allPages.join('<div class="page-break-indicator">Page Break - Content continues on next page</div>');
        } else {
            preview.innerHTML = '<div style="padding: 20px; color: #red; text-align: center;">Error: No pages generated</div>';
        }
    } catch (error) {
        console.error('Error in generatePassage:', error);
        const preview = document.getElementById('passagePreview');
        preview.innerHTML = `<div style="padding: 20px; color: red; text-align: center;">Error: ${error.message}</div>`;
    }
}

function paginateQuestions(questions, fontFamily, fontSize) {
    // Add a header to the first page of questions
    const header = 'Questions:';
    const formattedQuestions = questions.trim();
    // Use the same pagination logic as passage, but with a header on the first page
    const pages = [];
    // Split questions into paragraphs for better pagination
    const questionParagraphs = formattedQuestions.split(/\n{2,}/g).map(q => q.trim()).filter(q => q.length > 0);
    let remaining = questionParagraphs.slice();
    let pageNumber = 1;
    let isFirstPage = true;
    while (remaining.length > 0) {
        // Create a test page for questions
        const testPage = createTestPage('', false, fontFamily, fontSize);
        const contentDiv = testPage.querySelector('.page-content');
        let fitCount = 0;
        // Try to fit as many question paragraphs as possible
        for (let i = 1; i <= remaining.length; i++) {
            let testContent = remaining.slice(0, i).join('\n\n');
            if (isFirstPage) {
                testContent = header + '\n\n' + testContent;
            }
            contentDiv.innerHTML = formatTextContent(testContent, fontFamily, fontSize);
            contentDiv.offsetHeight;
            if (contentDiv.scrollHeight <= contentDiv.clientHeight) {
                fitCount = i;
            } else {
                break;
            }
        }
        if (fitCount === 0) fitCount = 1; // Always fit at least one
        let pageContent = remaining.slice(0, fitCount).join('\n\n');
        if (isFirstPage) {
            pageContent = header + '\n\n' + pageContent;
        }
        const pageHtml = createPassagePage('', formatTextContent(pageContent, fontFamily, fontSize), 0, 0, false, fontFamily, fontSize);
        pages.push(pageHtml);
        remaining = remaining.slice(fitCount);
        isFirstPage = false;
    }
    return pages;
}

function createMultiPagePassage(title, content, fontFamily, fontSize) {
    try {
        console.log('Creating multi-page passage:', { title, fontFamily, fontSize });
        
        // Create a test page to measure real available space with the selected font
        const testPage = createTestPage(title, true, fontFamily, fontSize);
        document.body.appendChild(testPage);
        
        const pages = [];
        let remainingContent = content;
        let pageNumber = 1;
        
        console.log('Starting pagination with content length:', remainingContent.length);
        
        while (remainingContent.trim().length > 0) {
            const isFirstPage = pageNumber === 1;
            
            console.log(`Processing page ${pageNumber}, remaining content: ${remainingContent.length} chars`);
            
            // Set up the test page for current page type
            if (!isFirstPage) {
                updateTestPageForContinuation(testPage);
            }
            
            // Find the maximum content that fits on this page
            const pageContent = findMaxContentForPage(testPage, remainingContent, fontFamily, fontSize);
            console.log(`Page ${pageNumber} content length:`, pageContent.length);
            
            if (pageContent.trim().length === 0) {
                // Safety check - if no content fits, break to avoid infinite loop
                console.error('No content fits on page', pageNumber);
                break;
            }
            
            // Create the page
            const pageHtml = createPassagePage(title, formatTextContent(pageContent, fontFamily, fontSize), pageNumber, 0, isFirstPage, fontFamily, fontSize);
            pages.push(pageHtml);
            
            // Find the exact position where this content ends in the original text
            // This prevents cutting words in half
            const contentIndex = remainingContent.indexOf(pageContent);
            if (contentIndex === 0) {
                // Perfect match at the beginning
                remainingContent = remainingContent.substring(pageContent.length).trim();
            } else {
                // Fallback: find where the page content actually ends
                let endPosition = pageContent.length;
                
                // If the content ends mid-word, find the end of the current word
                if (endPosition < remainingContent.length && 
                    remainingContent[endPosition] !== ' ' && 
                    remainingContent[endPosition] !== '\n') {
                    
                    // Find the next space or end of content
                    while (endPosition < remainingContent.length && 
                           remainingContent[endPosition] !== ' ' && 
                           remainingContent[endPosition] !== '\n') {
                        endPosition++;
                    }
                }
                
                remainingContent = remainingContent.substring(endPosition).trim();
            }
            
            pageNumber++;
            
            // Safety check to prevent infinite loops
            if (pageNumber > 50) {
                console.error('Too many pages generated, stopping at 50');
                break;
            }
        }
        
        console.log('Final page count:', pages.length);
        
        // Update all pages with correct total page count
        const totalPages = pages.length;
        const updatedPages = pages.map((page, index) => {
            return page.replace(/Page \d+ of \d+/, `Page ${index + 1} of ${totalPages}`);
        });
        
        // Clean up test page
        document.body.removeChild(testPage);
        
        return updatedPages;
    } catch (error) {
        console.error('Error in createMultiPagePassage:', error);
        return [`<div style="padding: 20px; color: red;">Error creating pages: ${error.message}</div>`];
    }
}

function findMaxContentForPage(testPage, content, fontFamily, fontSize) {
    const contentDiv = testPage.querySelector('.page-content');
    
    // Try to break at paragraph boundaries first
    const paragraphs = content.split(/\n\s*\n/);
    let paragraphCount = paragraphs.length;
    let bestFit = '';
    
    // Start with all paragraphs and work backwards
    while (paragraphCount > 0) {
        const testContent = paragraphs.slice(0, paragraphCount).join('\n\n');
        
        // Test if this content fits
        contentDiv.innerHTML = formatTextContent(testContent, fontFamily, fontSize);
        contentDiv.offsetHeight; // Force layout
        
        const fits = contentDiv.scrollHeight <= contentDiv.clientHeight;
        
        if (fits) {
            bestFit = testContent;
            break;
        }
        
        paragraphCount--;
    }
    
    // If no complete paragraphs fit, try sentence-by-sentence within the first paragraph
    if (!bestFit && paragraphs.length > 0) {
        const firstParagraph = paragraphs[0];
        const sentences = firstParagraph.split(/(?<=[.!?])\s+/);
        let sentenceCount = sentences.length;
        
        while (sentenceCount > 0) {
            const testContent = sentences.slice(0, sentenceCount).join(' ');
            
            contentDiv.innerHTML = formatTextContent(testContent, fontFamily, fontSize);
            contentDiv.offsetHeight;
            
            const fits = contentDiv.scrollHeight <= contentDiv.clientHeight;
            
            if (fits) {
                bestFit = testContent;
                break;
            }
            
            sentenceCount--;
        }
    }
    
    // Last resort: word-by-word from the beginning
    if (!bestFit) {
        const words = content.split(' ');
        let wordCount = Math.min(20, words.length); // Start smaller
        
        while (wordCount > 0) {
            const testContent = words.slice(0, wordCount).join(' ');
            
            contentDiv.innerHTML = formatTextContent(testContent, fontFamily, fontSize);
            contentDiv.offsetHeight;
            
            const fits = contentDiv.scrollHeight <= contentDiv.clientHeight;
            
            if (fits) {
                bestFit = testContent;
                break;
            }
            
            wordCount--;
        }
    }
    
    console.log(`Best fit found: ${bestFit.length} characters from ${content.length} total`);
    return bestFit;
}

function createTestPage(title, isFirstPage, fontFamily = "'Poppins', sans-serif", fontSize = "16px") {
    const page = document.createElement('div');
    page.className = 'passage-page';
    page.style.cssText = `
        position: absolute;
        top: -9999px;
        left: -9999px;
        visibility: hidden;
        width: 794px;
        height: 1123px;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        background: white;
        font-family: ${fontFamily};
        font-size: ${fontSize};
        page-break-after: always;
    `;
    
    // Create header
    const header = document.createElement('div');
    header.className = `page-header ${isFirstPage ? 'first-page' : 'continuation'}`;
    header.style.cssText = `
        flex-shrink: 0;
        font-family: ${fontFamily};
        font-size: ${fontSize};
    `;
    
    if (isFirstPage) {
        header.style.cssText += `
            padding: 30px 40px 30px 40px;
        `;
        header.innerHTML = `
            <img src="../../../Assets/Images/color-logo1.png" alt="Willena" class="logo" style="width: 80px; height: auto; margin-bottom: 15px;">
            <div class="student-info" style="display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 14px; color: #666;">
                <div>Name: <span style="border-bottom: 1px solid #ccc; min-width: 120px; display: inline-block; padding-bottom: 2px;">&nbsp;</span></div>
                <div>Date: <span style="border-bottom: 1px solid #ccc; min-width: 120px; display: inline-block; padding-bottom: 2px;">&nbsp;</span></div>
            </div>
            <h1 class="page-title" style="font-size: 24px; font-weight: 700; color: #2e2b3f; margin: 0 0 10px 0; text-align: center;">${title || ''}</h1>
        `;
    } else {
        header.style.cssText += `
            padding: 30px 40px 15px 40px;
            border-bottom: 2px solid #eee;
            margin-bottom: 20px;
        `;
        header.innerHTML = `
            <img src="../../../Assets/Images/color-logo1.png" alt="Willena Logo" class="logo" style="width: 80px; height: auto; margin-bottom: 15px;">
            <div class="student-info" style="display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 14px; color: #666;">
                <div>Name: <span style="border-bottom: 1px solid #ccc; min-width: 120px; display: inline-block; padding-bottom: 2px;">&nbsp;</span></div>
                <div>Date: <span style="border-bottom: 1px solid #ccc; min-width: 120px; display: inline-block; padding-bottom: 2px;">&nbsp;</span></div>
            </div>
        `;
    }
    
    // Create content area with accurate styling
    const content = document.createElement('div');
    content.className = 'page-content';
    content.style.cssText = `
        flex: 1 1 auto;
        padding: 0 40px;
        overflow: hidden;
        font-family: ${fontFamily};
        font-size: ${fontSize};
        line-height: 1.8;
        color: #333;
    `;
    
    // Create footer with accurate styling
    const footer = document.createElement('div');
    footer.className = 'page-footer';
    footer.style.cssText = `
        padding: 15px 40px 30px 40px;
        flex-shrink: 0;
        border-top: 1px solid #eee;
        font-size: 12px;
        color: #888;
        text-align: center;
        position: relative;
    `;
    footer.innerHTML = `
        Willena 원어민 영어학원 | 031-8041-2203 | www.willenaenglish.com
        <div class="page-number" style="position: absolute; bottom: 15px; right: 40px; font-weight: 500;">Page 1</div>
    `;
    
    page.appendChild(header);
    page.appendChild(content);
    page.appendChild(footer);
    
    return page;
}

function updateTestPageForContinuation(testPage) {
    const header = testPage.querySelector('.page-header');
    header.className = 'page-header continuation';
    header.style.cssText = `
        padding: 30px 40px 15px 40px;
        border-bottom: 2px solid #eee;
        margin-bottom: 20px;
        flex-shrink: 0;
        font-family: inherit;
        font-size: inherit;
    `;
    header.innerHTML = `
        <img src="../../../Assets/Images/color-logo1.png" alt="Willena Logo" class="logo" style="width: 80px; height: auto; margin-bottom: 15px;">
        <div class="student-info" style="display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 14px; color: #666;">
            <div>Name: <span style="border-bottom: 1px solid #ccc; min-width: 120px; display: inline-block; padding-bottom: 2px;">&nbsp;</span></div>
            <div>Date: <span style="border-bottom: 1px solid #ccc; min-width: 120px; display: inline-block; padding-bottom: 2px;">&nbsp;</span></div>
        </div>
    `;
}

function createPassagePage(title, content, pageNumber, totalPages, isFirstPage, fontFamily = "'Poppins', sans-serif", fontSize = "16px") {
    return `
        <div class="passage-page" style="font-family: ${fontFamily} !important;">
            <div class="page-header ${isFirstPage ? 'first-page' : 'continuation'}">
                <img src="../../../Assets/Images/color-logo1.png" alt="Willena" class="logo">
                <div class="student-info">
                    <div>Name: <span>&nbsp;</span></div>
                    <div>Date: <span>&nbsp;</span></div>
                </div>
                ${isFirstPage ? `<h1 class="page-title">${title}</h1>` : ''}
            </div>
            <div class="page-content" style="font-family: ${fontFamily} !important; font-size: ${fontSize} !important;">
                ${content}
            </div>
            <div class="page-footer">
                Willena 원어민 영어학원 | 031-8041-2203 | www.willenaenglish.com
                <div class="page-number">Page ${pageNumber} of ${totalPages}</div>
            </div>
        </div>
    `;
}

function splitContentIntoChunks(content) {
    // Split content into smaller, more flexible chunks for better pagination
    // First split by paragraphs to preserve paragraph structure
    const paragraphs = content.split(/\n\s*\n/);
    const chunks = [];
    
    paragraphs.forEach(paragraph => {
        if (paragraph.trim().length === 0) return;
        
        // Split each paragraph into sentences
        const sentences = paragraph.split(/(?<=[.!?])\s+/);
        sentences.forEach(sentence => {
            if (sentence.trim().length === 0) return;
            
            // For very long sentences, split them into smaller phrases
            if (sentence.length > 150) {
                // Split at natural break points: commas, semicolons, conjunctions, clauses
                const phrases = sentence.split(/(?<=,|;|\sand\s|\sbut\s|\sor\s|\syet\s|\sso\s|\swhile\s|\swhen\s|\swhere\s|\sif\s|\sthat\s|\swhich\s|\swho\s)\s+/);
                phrases.forEach(phrase => {
                    if (phrase.trim().length > 0) {
                        // For extremely long phrases, split by words in groups
                        if (phrase.length > 100) {
                            const words = phrase.split(/\s+/);
                            for (let i = 0; i < words.length; i += 8) {
                                const wordChunk = words.slice(i, i + 8).join(' ');
                                if (wordChunk.trim().length > 0) {
                                    chunks.push(wordChunk.trim());
                                }
                            }
                        } else {
                            chunks.push(phrase.trim());
                        }
                    }
                });
            } else {
                chunks.push(sentence.trim());
            }
        });
        
        // Add paragraph break marker
        chunks.push('\n\n');
    });
    
    return chunks.filter(chunk => chunk.length > 0);
}

function formatTextContent(content, fontFamily, fontSize) {
    if (!content || content.trim().length === 0) return '';
    
    // Check if this content contains multiple choice questions
    const hasMultipleChoice = /^\s*[a-d]\)\s/.test(content) || content.includes('a)') || content.includes('READING COMPREHENSION');
    
    if (hasMultipleChoice) {
        // Special formatting for questions and answers
        const lines = content.split('\n');
        const formattedLines = [];
        
        for (let line of lines) {
            line = line.trim();
            if (!line) {
                formattedLines.push('<br>');
                continue;
            }
            
            // Format question numbers
            if (/^\d+\.\s/.test(line)) {
                formattedLines.push(`<p style="margin: 20px 0 10px 0; font-weight: 600; font-family: inherit; font-size: inherit;">${line}</p>`);
            }
            // Format multiple choice options
            else if (/^[a-d]\)\s/.test(line)) {
                formattedLines.push(`<p style="margin: 5px 0 5px 20px; font-family: inherit; font-size: inherit;">${line}</p>`);
            }
            // Format section headers
            else if (line.includes('READING COMPREHENSION') || line.includes('ANSWER KEY')) {
                formattedLines.push(`<p style="margin: 30px 0 20px 0; font-weight: 700; text-align: center; font-family: inherit; font-size: inherit;">${line}</p>`);
            }
            // Format separator lines
            else if (/^[─═-]{10,}$/.test(line)) {
                formattedLines.push(`<hr style="margin: 20px 0; border: 1px solid #ccc;">`);
            }
            // Regular text
            else {
                formattedLines.push(`<p style="margin-bottom: 16px; text-align: justify; line-height: 1.5; font-family: inherit; font-size: inherit;">${line}</p>`);
            }
        }
        
        return formattedLines.join('');
    } else {
        // Regular passage formatting
        const paragraphs = content.split(/\n\s*\n/);
        
        return paragraphs
            .map(para => para.trim())
            .filter(para => para.length > 0)
            .map(para => {
                // Clean up extra spaces and format the paragraph
                const cleanPara = para.replace(/\s+/g, ' ').trim();
                return `<p style="margin-bottom: 16px; text-align: justify; line-height: 1.5; font-family: inherit; font-size: inherit;">${cleanPara}</p>`;
            })
            .join('');
    }
}

function printPassage() {
    const preview = document.getElementById('passagePreview');
    if (!preview.innerHTML.trim()) {
        alert('Please generate a passage first.');
        return;
    }
    
    // Create print window
    const printWindow = window.open('', '', 'width=900,height=1200');
    printWindow.document.write(`
        <html>
            <head>
                <title>Print Passage</title>
                <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
                <style>
                    body { 
                        margin: 0; 
                        padding: 0; 
                        font-family: 'Poppins', sans-serif;
                        background: white;
                    }
                    
                    .passage-page {
                        width: 794px;
                        height: 1123px;
                        margin: 0 auto;
                        background: white;
                        display: flex;
                        flex-direction: column;
                        position: relative;
                        overflow: hidden;
                        page-break-after: always;
                    }
                    
                    .passage-page:last-child {
                        page-break-after: auto;
                    }
                    
                    .page-header {
                        padding: 30px 40px 20px 40px;
                        flex-shrink: 0;
                    }
                    
                    .page-header.first-page {
                        padding-bottom: 30px;
                    }
                    
                    .page-header.continuation {
                        padding-bottom: 15px;
                        border-bottom: 2px solid #eee;
                        margin-bottom: 20px;
                    }
                    
                    .logo {
                        width: 80px;
                        height: auto;
                        margin-bottom: 15px;
                    }
                    
                    .student-info {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 15px;
                        font-size: 14px;
                        color: #666;
                    }
                    
                    .student-info span {
                        border-bottom: 1px solid #ccc;
                        min-width: 120px;
                        display: inline-block;
                        padding-bottom: 2px;
                    }
                    
                    .page-title {
                        font-size: 24px;
                        font-weight: 700;
                        color: #2e2b3f;
                        margin: 0 0 10px 0;
                        text-align: center;
                    }
                    
                    .page-content {
                        flex: 1 1 auto;
                        padding: 0 40px;
                        overflow: hidden;
                        font-size: 16px;
                        line-height: 1.8;
                        color: #333;
                    }
                    
                    .page-footer {
                        padding: 15px 40px 30px 40px;
                        flex-shrink: 0;
                        border-top: 1px solid #eee;
                        font-size: 12px;
                        color: #888;
                        text-align: center;
                        position: relative;
                    }
                    
                    .page-number {
                        position: absolute;
                        bottom: 15px;
                        right: 40px;
                        font-weight: 500;
                    }
                    
                    .page-break-indicator {
                        display: none;
                    }
                    
                    p {
                        margin-bottom: 16px;
                        text-align: justify;
                    }
                </style>
            </head>
            <body>
                ${preview.innerHTML}
            </body>
        </html>
    `);
    
    printWindow.document.close();
    
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 250);
}

async function downloadPDF() {
    const preview = document.getElementById('passagePreview');
    if (!preview.innerHTML.trim()) {
        alert('Please generate a passage first.');
        return;
    }
    
    const pages = preview.querySelectorAll('.passage-page');
    if (pages.length === 0) {
        alert('No pages found to export.');
        return;
    }
    
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4'
    });
    
    for (let i = 0; i < pages.length; i++) {
        if (i > 0) {
            pdf.addPage();
        }
        
        try {
            const canvas = await html2canvas(pages[i], {
                scale: 2,
                backgroundColor: "#fff",
                useCORS: true,
                width: 794,
                height: 1123,
                logging: false
            });
            
            const imgData = canvas.toDataURL('image/png');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            
            pdf.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight);
        } catch (error) {
            console.error('Error generating PDF page:', error);
        }
    }
    
    const title = document.getElementById('passageTitle').value.trim() || 'passage';
    pdf.save(`${title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
}

// Question Generator Functions
// Undo/Redo System
let undoStack = [];
let redoStack = [];
let currentContent = '';
let isUndoRedoAction = false;

// Enhanced Question Generator Functions
function showQuestionGenerator() {
  document.getElementById('questionModal').style.display = 'block';
}
function hideQuestionGenerator() {
  document.getElementById('questionModal').style.display = 'none';
}

// Attach to window so HTML onclick works
window.showQuestionGenerator = showQuestionGenerator;
window.hideQuestionGenerator = hideQuestionGenerator;

// Simplified question insertion system - questions auto-insert at end
// (Removed complex insertion mode functions - now using insertQuestionsAtEnd())

// Function to clear inserted questions from passage content
function clearQuestionsFromPassage() {
    saveState(); // Save current state for undo
    const content = document.getElementById('passageContent').value;
    // Remove question sections using regex for both old and new formats
    const cleanedContent = content
        .replace(/\n{2,}─{50}\nREADING COMPREHENSION QUESTIONS\n─{50}\n[\s\S]*$/g, '') // New format
        .replace(/═{39}\s*READING COMPREHENSION QUESTIONS\s*═{39}[\s\S]*?═{39}\s*END OF QUESTIONS\s*═{39}/g, '') // Old format        .replace(/\n{3,}/g, '\n\n') // Remove excessive line breaks
        .trim();
    document.getElementById('passageContent').value = cleanedContent;
    generatePassage(); // Refresh preview
    showToast('Questions removed from passage.');
}

// Simplified system - removed complex insertion functions  
// Now using direct insertion at end with simple separator

async function generateQuestions(event) {
  const content = document.getElementById('passageContent').value.trim();
  const questionType = document.getElementById('questionType').value || 'multiple-choice';
  const numComprehension = parseInt(document.getElementById('comprehensionCount').value || 0);
  const numDetail = parseInt(document.getElementById('detailCount').value || 0);
  const numInference = parseInt(document.getElementById('inferenceCount').value || 0);
  const numGrammar = parseInt(document.getElementById('grammarCount').value || 0);
  const numMainIdea = parseInt(document.getElementById('mainIdeaCount').value || 0);
  const numQuestions = numComprehension + numDetail + numInference + numGrammar + numMainIdea || 5;

  if (!content) {
    alert('Please enter passage content first.');
    return;
  }

  let generateBtn = null;
  if (event && event.target) {
    generateBtn = event.target;
  } else {
    generateBtn = document.getElementById('generateQuestionsBtn');
  }
  if (generateBtn) {
    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating...';
  }

  try {
    let allQuestions = [];
    // Generate grammar questions separately if requested
    if (numGrammar > 0) {
      const grammarPrompt = `Generate exactly ${numGrammar} ESL-style grammar questions based on the passage below. Each question should focus on a common ESL grammar point (verb tense, articles, prepositions, subject-verb agreement, etc.) and be clear and accessible for English learners. Format as numbered questions with four multiple-choice options (a-d). Do NOT repeat content questions.\n\nPassage:\n${content}`;
      const grammarResult = await extractQuestionsWithAI(content, numGrammar, [], 'grammar', grammarPrompt);
      allQuestions.push(grammarResult.questions.trim());
    }
    // Generate other questions (comprehension, detail, inference, main idea)
    const otherCount = numComprehension + numDetail + numInference + numMainIdea;
    if (otherCount > 0) {
      const otherPrompt = `Generate exactly ${otherCount} reading comprehension questions (including main idea, detail, inference, and content questions as appropriate) based on the passage below. Format as numbered questions with four multiple-choice options (a-d). Do NOT include grammar questions.\n\nPassage:\n${content}`;
      const otherResult = await extractQuestionsWithAI(content, otherCount, [], 'comprehension', otherPrompt);
      allQuestions.push(otherResult.questions.trim());
    }
    // Combine and clean up
    const questionsBox = document.getElementById('questionsBox');
    if (questionsBox) {
      questionsBox.value = allQuestions.filter(Boolean).join('\n\n');
    }
    generatePassage();
    showToast('Questions generated and preview updated!');
    hideQuestionGenerator();
  } catch (error) {
    console.error('AI question generation failed:', error);
    alert('Failed to generate questions. Please try again.');
  } finally {
    if (generateBtn) {
      generateBtn.disabled = false;
      generateBtn.textContent = 'Generate Questions';
    }
  }
}

function showToast(message) {
    // Create toast notification
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4caf50;
        color: white;
        padding: 12px 20px;
        border-radius: 5px;
        box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        z-index: 9999;
        font-size: 14px;
        font-weight: 500;
        animation: slideIn 0.3s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    // Add CSS animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
    `;
    document.head.appendChild(style);
    
    setTimeout(() => {
        toast.remove();
        style.remove();
    }, 3000);
}

// Auto-generate passage on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing...');
    
    // Check if required elements exist
    const elements = {
        passageTitle: document.getElementById('passageTitle'),
        passageContent: document.getElementById('passageContent'),
        passageFont: document.getElementById('passageFont'),
        passageFontSize: document.getElementById('passageFontSize'),
        passagePreview: document.getElementById('passagePreview')
    };
    
    console.log('Elements found:', elements);
    
    // Check for missing elements
    const missing = Object.keys(elements).filter(key => !elements[key]);
    if (missing.length > 0) {
        console.error('Missing elements:', missing);
        if (elements.passagePreview) {
            elements.passagePreview.innerHTML = `<div style="padding: 20px; color: red;">Missing form elements: ${missing.join(', ')}</div>`;
        }
        return;
    }
    
    // Initialize undo/redo system
    initializeUndoRedo();
    
    // Set default content if empty
    if (!elements.passageContent.value.trim()) {
        elements.passageContent.value = `Maya was nine years old when she found the old key in her grandmother's attic. It was a peculiar thing – made of a metal she couldn't identify, with intricate designs carved into its surface. The key seemed to shimmer in the dusty afternoon light that filtered through the small attic window.

"What does it open?" Maya asked, her eyes wide with curiosity.

"That, my child,

Maya spent the rest of the day thinking about the key and what it might unlock. She carried it with her everywhere, feeling its smooth surface in her pocket. That evening, as she sat by her bedroom window looking out at the forest, she made a decision.

The next morning, Maya told her grandmother that she wanted to explore the forest to see if the key might open something there. Nani nodded approvingly. "I was wondering when you would ask," she said. "Take this with you." She handed Maya a small compass. "It will help you find your way back home."`;
    }
    
    generatePassage();
      // Add live preview on input change - with immediate font regeneration
    elements.passageTitle.addEventListener('input', generatePassage);
    elements.passageContent.addEventListener('input', debounce(generatePassage, 500));
    elements.passageFont.addEventListener('change', function() {
        // Immediate regeneration for font changes to ensure proper pagination
        generatePassage();
    });
    elements.passageFontSize.addEventListener('change', function() {
        // Immediate regeneration for font size changes to ensure proper pagination
        generatePassage();
    });
    
    // Add live preview for questions box
    const questionsBox = document.getElementById('questionsBox');
    if (questionsBox) {
        questionsBox.addEventListener('input', generatePassage);
    }
    
    // Update undo/redo buttons initially
    updateUndoRedoButtons();
});

// Debounce function to limit how often generatePassage is called
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function initializeUndoRedo() {
    currentContent = document.getElementById('passageContent').value;
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            undo();
        }
        if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
            e.preventDefault();
            redo();
        }
    });
    
    // Save state on content changes (with debounce)
    let saveTimeout;
    document.getElementById('passageContent').addEventListener('input', function() {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(saveState, 1000); // Save state 1 second after stopping typing
    });
}

function saveState() {
    if (isUndoRedoAction) return; // Don't save states during undo/redo operations
    
    const content = document.getElementById('passageContent').value;
    if (content !== currentContent) {
        undoStack.push(currentContent);
        if (undoStack.length > 50) { // Limit undo history
            undoStack.shift();
        }
        redoStack = []; // Clear redo stack when new action is performed
        currentContent = content;
        updateUndoRedoButtons();
    }
}

function undo() {
    if (undoStack.length > 0) {
        isUndoRedoAction = true;
        redoStack.push(currentContent);
        const previousState = undoStack.pop();
        document.getElementById('passageContent').value = previousState;
        currentContent = previousState;
        generatePassage(); // Update preview
        updateUndoRedoButtons();
        showToast('Undo applied');
        isUndoRedoAction = false;
    }
}

function redo() {
    if (redoStack.length > 0) {
        isUndoRedoAction = true;
        undoStack.push(currentContent);
        const nextState = redoStack.pop();
        document.getElementById('passageContent').value = nextState;
        currentContent = nextState;
        generatePassage(); // Update preview
        updateUndoRedoButtons();
        showToast('Redo applied');
        isUndoRedoAction = false;
    }
}

function updateUndoRedoButtons() {
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    
    if (undoBtn) {
        undoBtn.disabled = undoStack.length === 0;
        undoBtn.style.opacity = undoStack.length === 0 ? '0.5' : '1';
    }
    
    if (redoBtn) {
        redoBtn.disabled = redoStack.length === 0;
        redoBtn.style.opacity = redoStack.length === 0 ? '0.5' : '1';
    }
}

// Function to clean up and format question text
function formatQuestionsText(text, questionType) {
    if (questionType === 'multiple-choice') {
        // First, clean up any formatting issues
        let processed = text;
        
        // Split options that might be concatenated
        processed = processed.replace(/([a-d]\)[^a-d\n]*?)\s+([a-d]\))/g, '$1\n$2');
        
        // Handle semicolon separators
        processed = processed.replace(/;\s*([a-d]\))/g, '\n$1');
        
        // Handle space before options
        processed = processed.replace(/\s+([b-d]\))/g, '\n$1');
        
        const lines = processed.split('\n');
        const formattedLines = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (!line) continue;
            
            // Check if this is a question (starts with number and dot)
            if (/^\d+\.\s/.test(line)) {
                // Add spacing before question (except first one)
                if (formattedLines.length > 0) {
                    formattedLines.push('');
                }
                formattedLines.push(line);
                formattedLines.push(''); // Empty line after question
            }
            // Check if this is an answer option (starts with a), b), c), d))
            else if (/^[a-d]\)\s/.test(line)) {
                // Keep the original a) format but ensure it's on its own line
                formattedLines.push(line);
            }
            // Check if this is the answer key
            else if (line.includes('ANSWER KEY')) {
                formattedLines.push('');
                formattedLines.push('');
                formattedLines.push(line);
                formattedLines.push('');
            }
            // Any other text (like answer key content)
            else {
                formattedLines.push(line);
            }
        }
        
        return formattedLines.join('\n');
    } else {
        // For written answer questions
        const lines = text.split('\n');
        const formattedLines = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (!line) continue;
            
            // Check if this is a question
            if (/^\d+\.\s/.test(line)) {
                // Add spacing before question (except first one)
                if (formattedLines.length > 0) {
                    formattedLines.push('');
                    formattedLines.push('');
                }
                formattedLines.push(line);
                formattedLines.push('');
            } else {
                formattedLines.push(line);
            }
        }
        
        return formattedLines.join('\n');
    }
}

window.generateQuestions = generateQuestions;
window.copyQuestions = copyQuestions;
