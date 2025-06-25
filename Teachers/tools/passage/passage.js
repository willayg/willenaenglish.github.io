// Passage Builder JavaScript - Built for Multi-Page from the Ground Up

function generatePassage() {
    const title = document.getElementById('passageTitle').value.trim();
    const content = document.getElementById('passageContent').value.trim();
    const fontFamily = document.getElementById('passageFont').value;
    const fontSize = document.getElementById('passageFontSize').value + 'px';
    
    if (!content) {
        alert('Please enter some passage content.');
        return;
    }
    
    // Generate the multi-page passage with font settings
    const pages = createMultiPagePassage(title, content, fontFamily, fontSize);
    
    // Display in preview
    const preview = document.getElementById('passagePreview');
    preview.innerHTML = pages.join('<div class="page-break-indicator">Page Break - Content continues on next page</div>');
}

function createMultiPagePassage(title, content, fontFamily, fontSize) {
    // Create a test page to measure real available space with the selected font
    const testPage = createTestPage(title, true, fontFamily, fontSize);
    document.body.appendChild(testPage);
    
    const pages = [];
    const contentParts = splitContentIntoChunks(content);
    
    let currentPageContent = '';
    let partIndex = 0;
    let pageNumber = 1;    while (partIndex < contentParts.length) {
        const part = contentParts[partIndex];
        
        // Handle paragraph breaks
        if (part === '\n\n') {
            currentPageContent += '\n\n';
            partIndex++;
            continue;
        }
        
        // Determine the separator based on whether we're continuing a sentence or starting new content
        let separator = '';
        if (currentPageContent) {
            // If current content doesn't end with paragraph break, add appropriate separator
            if (!currentPageContent.endsWith('\n\n')) {
                // If the part starts with punctuation or current content ends with sentence, just add space
                if (part.match(/^[.!?]/) || currentPageContent.match(/[.!?]\s*$/)) {
                    separator = ' ';
                } else {
                    separator = ' ';
                }
            }
        }
        
        const testContent = currentPageContent + separator + part;
        
        // Test if this content fits on current page
        const contentDiv = testPage.querySelector('.page-content');
        contentDiv.innerHTML = formatTextContent(testContent, fontFamily, fontSize);
        
        // Force layout recalculation
        contentDiv.offsetHeight;
        
        // Check if content overflows the available space
        const overflows = contentDiv.scrollHeight > contentDiv.clientHeight;
          if (overflows && currentPageContent !== '') {
            // Current page is full - save it and start new page
            const isFirstPage = pageNumber === 1;
            pages.push(createPassagePage(title, formatTextContent(currentPageContent, fontFamily, fontSize), pageNumber, 0, isFirstPage, fontFamily, fontSize));
            
            // Reset for new page - start with the current part
            currentPageContent = part;
            pageNumber++;
            
            // Update test page for continuation page (no title)
            updateTestPageForContinuation(testPage);
            
            // Move to next part since we've handled this one
            partIndex++;
        } else {
            // Part fits - add it to current page
            currentPageContent = testContent;
            partIndex++;
        }
    }// Add final page if it has content
    if (currentPageContent && currentPageContent.trim()) {
        const isFirstPage = pageNumber === 1;
        pages.push(createPassagePage(title, formatTextContent(currentPageContent, fontFamily, fontSize), pageNumber, 0, isFirstPage, fontFamily, fontSize));
    }
    
    // Update all pages with correct total page count
    const totalPages = pages.length;
    const updatedPages = pages.map((page, index) => {
        return page.replace(/Page \d+ of \d+/, `Page ${index + 1} of ${totalPages}`);
    });
    
    // Clean up test page
    document.body.removeChild(testPage);
    
    return updatedPages;
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

function createPassagePage(title, content, pageNumber, totalPages, isFirstPage, fontFamily = "'Poppins', sans-serif", fontSize = "16px") {    return `        <div class="passage-page" style="font-family: ${fontFamily} !important;">
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
    
    // Split content into paragraphs while preserving structure
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
// Question Insertion System Variables
let insertionMode = false;
let generatedQuestions = '';
let insertionPoints = [];

// Undo/Redo System
let undoStack = [];
let redoStack = [];
let currentContent = '';
let isUndoRedoAction = false;

// Enhanced Question Generator Functions
function showQuestionGenerator() {
    document.getElementById('questionModal').style.display = 'block';
}

function hideQuestionGenerator() {    document.getElementById('questionModal').style.display = 'none';
}

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

async function generateQuestions() {
    const content = document.getElementById('passageContent').value.trim();
    if (!content) {
        alert('Please enter passage content first.');
        return;
    }

    const questionType = document.getElementById('questionType').value;
    const categories = [];
    
    // Collect selected categories and their counts
    if (document.getElementById('comprehension').checked && document.getElementById('comprehensionCount').value > 0) {
        categories.push({ type: 'comprehension', count: parseInt(document.getElementById('comprehensionCount').value) });
    }
    if (document.getElementById('detail').checked && document.getElementById('detailCount').value > 0) {
        categories.push({ type: 'detail', count: parseInt(document.getElementById('detailCount').value) });
    }
    if (document.getElementById('inference').checked && document.getElementById('inferenceCount').value > 0) {
        categories.push({ type: 'inference', count: parseInt(document.getElementById('inferenceCount').value) });
    }
    if (document.getElementById('grammar').checked && document.getElementById('grammarCount').value > 0) {
        categories.push({ type: 'grammar', count: parseInt(document.getElementById('grammarCount').value) });
    }
    if (document.getElementById('mainIdea').checked && document.getElementById('mainIdeaCount').value > 0) {
        categories.push({ type: 'main idea', count: parseInt(document.getElementById('mainIdeaCount').value) });
    }

    if (categories.length === 0) {
        alert('Please select at least one question category with a count greater than 0.');
        return;
    }

    const generateBtn = event.target;
    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating...';

    try {        const questions = await generateQuestionsWithAI(content, categories, questionType);
        generatedQuestions = questions;
          // Hide modal first
        hideQuestionGenerator();        // Show question results in main interface (outside modal)
        document.getElementById('questionContent').textContent = questions;
        document.getElementById('questionResults').style.display = 'block';
        
        showToast('Questions generated successfully! Click "Insert at End" to add them to your passage.');
    } catch (error) {
        console.error('Error generating questions:', error);
        alert('Failed to generate questions. Please try again.');
    } finally {
        generateBtn.disabled = false;
        generateBtn.textContent = 'Generate Questions';
    }
}

async function generateQuestionsWithAI(passage, categories, questionType) {
    const totalQuestions = categories.reduce((sum, cat) => sum + cat.count, 0);
    const categoryText = categories.map(cat => `${cat.count} ${cat.type} questions`).join(', ');
      let formatInstructions = '';    if (questionType === 'multiple-choice') {
        formatInstructions = `Create multiple choice questions with 4 options (a, b, c, d). Format them EXACTLY like this:

1. Question text here?

a) First option
b) Second option  
c) Third option
d) Fourth option

2. Second question text here?

a) First option
b) Second option
c) Third option
d) Fourth option

IMPORTANT FORMATTING RULES:
- Put a blank line after each question
- Put each answer option on its own line
- Put a blank line between each complete question set
- Do NOT put extra spaces or formatting`;
    } else {
        formatInstructions = `Create written answer questions that require 1-3 sentence responses. Format them EXACTLY like this:

1. Question text here?

2. Second question text here?

3. Third question text here?

IMPORTANT: Put each question on its own line with a blank line between questions.`;
    }    const prompt = `Based on the following reading passage, create exactly ${totalQuestions} questions with this EXACT breakdown: ${categoryText}.

${formatInstructions}

Reading Passage:
"${passage}"

STRICT REQUIREMENTS:
- Create EXACTLY the number of questions specified for each category
- ${categories.map(cat => `${cat.count} ${cat.type} questions`).join('\n- ')}
- Questions must be clearly categorized and test different skills
- Number each question (1., 2., 3., etc.) in sequence
- Make questions engaging and appropriate for the reading level
- Ensure questions directly relate to the passage content

CATEGORY DEFINITIONS:
- Comprehension: General understanding questions about main ideas and themes
- Detail: Specific factual questions about information stated in the passage
- Inference: Questions requiring reading between the lines or drawing conclusions
- Grammar: Questions about sentence structure, word usage, or language mechanics
- Main Idea: Questions about the central theme or purpose of the passage

${questionType === 'multiple-choice' ? `
ANSWER KEY REQUIREMENTS:
- At the end, add a section labeled "ANSWER KEY:"
- List answers in this exact format:
1. a
2. c
3. b
(continue for all questions)
- Ensure answer key has ${totalQuestions} answers` : ''}

Generate the questions now following the exact format specified:`;

    try {
        const response = await fetch('/.netlify/functions/openai_proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                endpoint: 'chat/completions',
                payload: {
                    model: 'gpt-4',
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: 2000,
                    temperature: 0.3
                }
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        const data = result.data;

        if (data.error) {
            throw new Error(data.error.message || 'OpenAI API error');
        }

        let generatedText = data.choices[0].message.content.trim();
        
        // Post-process to ensure proper formatting
        generatedText = formatQuestionsText(generatedText, questionType);
        
        return generatedText;
    } catch (error) {
        console.error('AI question generation error:', error);
        throw error;
    }
}

function copyQuestions() {
    if (!generatedQuestions) {
        alert('No questions to copy.');
        return;
    }
    
    navigator.clipboard.writeText(generatedQuestions).then(() => {
        showToast('Questions copied to clipboard!');
    }).catch(err => {
        console.error('Failed to copy: ', err);
        alert('Failed to copy to clipboard');
    });
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

// ...existing code...

// Auto-generate passage on page load
document.addEventListener('DOMContentLoaded', function() {
    // Initialize undo/redo system
    initializeUndoRedo();
    
    generatePassage();
      // Add live preview on input change - with immediate font regeneration
    document.getElementById('passageTitle').addEventListener('input', generatePassage);
    document.getElementById('passageContent').addEventListener('input', debounce(generatePassage, 500));
    document.getElementById('passageFont').addEventListener('change', function() {
        // Immediate regeneration for font changes to ensure proper pagination
        generatePassage();
    });
    document.getElementById('passageFontSize').addEventListener('change', function() {
        // Immediate regeneration for font size changes to ensure proper pagination
        generatePassage();
    });
    
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

function updatePassageWithQuestions() {
    const content = document.getElementById('passageContent').value.trim();
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim());
    
    let newContent = '';
    let insertedAtStart = false;
    
    // Sort insertion points by position for proper ordering
    insertionPoints.sort((a, b) => {
        if (a.position === 'start') return -1;
        if (b.position === 'start') return 1;
        if (a.position === 'end') return 1;
        if (b.position === 'end') return -1;
        
        const aIndex = parseInt(a.position.split('-')[1]);
        const bIndex = parseInt(b.position.split('-')[1]);
        return aIndex - bIndex;
    });
    
    // Process insertions
    insertionPoints.forEach(insertion => {
        if (insertion.position === 'start' && !insertedAtStart) {
            newContent = formatQuestionsForInsertion(insertion.content) + '\n\n' + content;
            insertedAtStart = true;
        }
    });
    
    // If no start insertion, build content paragraph by paragraph
    if (!insertedAtStart) {
        let result = [];
        
        paragraphs.forEach((paragraph, index) => {
            result.push(paragraph);
            
            // Check if there's an insertion after this paragraph
            const afterInsertion = insertionPoints.find(ip => ip.position === `after-${index}`);
            if (afterInsertion) {
                result.push(formatQuestionsForInsertion(afterInsertion.content));
            }
        });
        
        // Check for end insertion
        const endInsertion = insertionPoints.find(ip => ip.position === 'end');
        if (endInsertion) {
            result.push(formatQuestionsForInsertion(endInsertion.content));
        }
        
        newContent = result.join('\n\n');
    }
    
    document.getElementById('passageContent').value = newContent;
}

function formatQuestionsForInsertion(questions) {
    return `
═══════════════════════════════════════
         READING COMPREHENSION QUESTIONS
═══════════════════════════════════════

${questions.trim()}

═══════════════════════════════════════
               END OF QUESTIONS
═══════════════════════════════════════`;
}

// Initialize undo/redo system
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

// Simplified question insertion - auto-insert at end
function insertQuestionsAtEnd() {
    if (!generatedQuestions) {
        alert('No questions available to insert.');
        return;
    }
    
    saveState(); // Save current state for undo
    
    const content = document.getElementById('passageContent').value.trim();
    const separator = '\n\n' + '─'.repeat(50) + '\n';
    
    const questionSection = separator + 'READING COMPREHENSION QUESTIONS\n' + '─'.repeat(50) + '\n\n' + generatedQuestions;
    
    const newContent = content + questionSection;
    document.getElementById('passageContent').value = newContent;
    generatePassage(); // Refresh preview
    
    // Hide question results interface
    document.getElementById('questionResults').style.display = 'none';
    
    showToast('Questions inserted at the end of the passage!');
}

// Function to clean up and format question text
function formatQuestionsText(text, questionType) {
    if (questionType === 'multiple-choice') {
        // More aggressive approach to split options that are on the same line
        let processed = text;
        
        // Split on patterns like "; b)" or " b)" or "; c)" etc.
        processed = processed.replace(/;\s*([a-d]\))/g, '\n$1');
        processed = processed.replace(/\s+([b-d]\))/g, '\n$1');
        
        // Also handle direct concatenation like "option a) next option b)"
        processed = processed.replace(/([a-d]\)[^a-d]*?)\s+([a-d]\))/g, '$1\n$2');
        
        const lines = processed.split('\n');
        const formattedLines = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (!line) {
                continue;
            }
            
            // Check if this is a question (starts with number and dot)
            if (/^\d+\.\s/.test(line)) {
                // Add spacing before question (except first one)
                if (formattedLines.length > 0) {
                    formattedLines.push(''); // Empty line for spacing
                }
                formattedLines.push(line);
                formattedLines.push(''); // Empty line after question
            }
            // Check if this is an answer option (starts with a), b), c), d))
            else if (/^[a-d]\)\s/.test(line)) {
                // Convert a) to a: format and clean up any trailing punctuation
                let convertedLine = line.replace(/^([a-d])\)\s/, '$1: ');
                // Remove trailing semicolons or other punctuation that might be left over
                convertedLine = convertedLine.replace(/[;,]\s*$/, '');
                formattedLines.push(convertedLine);
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
