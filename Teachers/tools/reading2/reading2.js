// Reading Worksheet Builder 2.0 - Built from scratch with robust multi-page system
import { extractQuestionsWithAI } from '../reading/ai.js';

// Constants for page layout
const PAGE_WIDTH = 794;
const PAGE_HEIGHT = 1123;
const HEADER_HEIGHT = 280; // Increased to account for full header
const FOOTER_HEIGHT = 100; // Increased for footer
const CONTENT_PADDING = 64; // 32px on each side
const MAX_CONTENT_HEIGHT = PAGE_HEIGHT - HEADER_HEIGHT - FOOTER_HEIGHT; // About 743px

class ReadingWorksheetBuilder2 {
    constructor() {
        this.currentPages = [];
        this.currentFont = "'Poppins', sans-serif";
        this.currentFontSize = 1.0;
        this.init();
    }    init() {
        // Add sample content for immediate preview
        this.initializeSampleContent();
        
        // Bind event listeners
        this.bindEvents();
        
        // Initial preview
        this.updateWorksheet();
    }

    initializeSampleContent() {
        // Add sample content for immediate preview
        document.getElementById('reading2Title').value = 'Reading Comprehension';
        document.getElementById('reading2Passage').value = `Everton and Manchester United are interested in Leicester's 28-year-old Nigeria midfielder Wilfred Ndidi, who has a £9m relegation release clause in his contract. (Talksport), external

Nottingham Forest and Marseille are interested in Ajax's 35-year-old England midfielder Jordan Henderson, who has a clause in his contract that would allow him to move on a free transfer. (Mail), external

Leeds are yet to receive an offer for 25-year-old French goalkeeper Illan Meslier despite reports he is due to have a medical with Fenerbahce. (Sky Sports), external

Athletic Bilbao's 22-year-old Spain forward Nico Williams, who has a £50m release clause in his contract, has told the club he intends to sign for Barcelona. (Athletic - subscription required), external

Everton, Brentford, West Ham and Fulham are considering a move for Ipswich's 21-year-old England Under-21s winger Omari Hutchinson. (Mail), external

Burnley are preparing a £12m bid for Lazio's 21-year-old France Under-21s forward Loum Tchaouna.`;
        
        document.getElementById('reading2Questions').value = `1. Which team is interested in Leicester's Wilfred Ndidi, who has a £9m relegation release clause in his contract?
a) Everton
b) Manchester City  
c) Chelsea

2. What would allow Jordan Henderson to move on a free transfer?
a) A clause in his contract
b) End of his contract
c) Transfer request

3. How much is Nico Williams' release clause?
a) £30m
b) £50m
c) £70m

4. Which French club is interested in Jordan Henderson?
a) PSG
b) Lyon
c) Marseille

5. What is Burnley preparing for Loum Tchaouna?
a) £10m bid
b) £12m bid
c) £15m bid`;
    }

    bindEvents() {
        // Auto-update on input changes
        const inputs = [
            'reading2Title',
            'reading2Passage', 
            'reading2Questions',
            'reading2Font',
            'reading2FontSize',
            'reading2IncludePassage'
        ];        inputs.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('input', () => this.updateWorksheet());
                element.addEventListener('change', () => this.updateWorksheet());
            }
        });

        // AI Generate button
        document.getElementById('reading2GenerateBtn').addEventListener('click', () => this.generateQuestions());

        // Action buttons
        document.getElementById('reading2PrintBtn').addEventListener('click', () => this.printWorksheet());
        document.getElementById('reading2PdfBtn').addEventListener('click', () => this.exportToPDF());
    }

    async generateQuestions() {
        const passage = document.getElementById('reading2Passage').value.trim();
        const numQuestions = document.getElementById('reading2NumQuestions').value || 5;
        const questionFormat = document.getElementById('reading2QuestionFormat').value || 'multiple-choice';
        
        if (!passage) {
            alert("Please enter a reading passage first.");
            return;
        }

        const categories = this.getSelectedCategories();
        if (categories.length === 0) {
            alert("Please select at least one question category.");
            return;
        }

        const generateBtn = document.getElementById('reading2GenerateBtn');
        generateBtn.disabled = true;
        generateBtn.textContent = "🤖 Generating Questions...";

        try {
            const result = await extractQuestionsWithAI(passage, numQuestions, categories, questionFormat);
            document.getElementById('reading2Questions').value = result.questions.trim();
            this.updatePreview();
        } catch (e) {
            console.error('AI question generation failed:', e);
            alert("AI question generation failed. Please try again.");
        }

        generateBtn.disabled = false;
        generateBtn.textContent = "🤖 Generate Questions with AI";
    }

    getSelectedCategories() {
        const categories = [];
        if (document.getElementById('reading2CategoryComprehension').checked) categories.push('comprehension');
        if (document.getElementById('reading2CategoryVocabulary').checked) categories.push('vocabulary');
        if (document.getElementById('reading2CategoryGrammar').checked) categories.push('grammar');
        if (document.getElementById('reading2CategoryInference').checked) categories.push('inference');
        return categories;
    }    updatePreview() {
        const title = document.getElementById('reading2Title').value.trim() || "Reading Comprehension";
        const passage = document.getElementById('reading2Passage').value.trim();
        const questions = document.getElementById('reading2Questions').value.trim();
        const includePassage = document.getElementById('reading2IncludePassage').checked;
        this.currentFont = document.getElementById('reading2Font').value;
        this.currentFontSize = parseFloat(document.getElementById('reading2FontSize').value);

        const previewArea = document.getElementById('reading2PreviewArea');

        console.log('=== UPDATE PREVIEW ===');
        console.log('Title:', title);
        console.log('Passage length:', passage.length);
        console.log('Questions length:', questions.length);
        console.log('Include passage:', includePassage);

        if (!passage && !questions) {
            previewArea.innerHTML = `
                <div style="text-align: center; color: #666; padding: 60px 20px;">
                    <div style="font-size: 48px; margin-bottom: 20px;">📄</div>
                    <h3>Preview will appear here</h3>
                    <p>Enter a reading passage and questions to see the worksheet preview</p>
                </div>
            `;
            return;
        }

        // Build worksheet content
        let content = '';
        
        if (includePassage && passage) {
            content += this.formatPassageSection(passage);
        }
        
        if (questions) {
            content += this.formatQuestionsSection(questions);
        }

        console.log('Total content length:', content.length);
        console.log('Content preview:', content.substring(0, 200) + '...');

        // Generate pages
        this.currentPages = this.createPages(title, content);
        
        console.log('Final pages created:', this.currentPages.length);
        this.currentPages.forEach((page, i) => {
            console.log(`Page ${i + 1} content length:`, page.content.length);
        });
        
        // Render preview
        this.renderPreview();
    }

    formatPassageSection(passage) {
        return `
            <div class="passage-section" style="margin-bottom: 30px;">
                <h2 style="font-size: 1.4rem; font-weight: 600; color: #2d3748; margin-bottom: 15px; border-bottom: 2px solid #4299e1; padding-bottom: 8px;">📖 Reading Passage</h2>
                <div style="background: #f7fafc; padding: 20px; border-radius: 8px; line-height: 1.8; font-size: 1rem;">
                    ${this.formatParagraphs(passage)}
                </div>
            </div>
        `;
    }

    formatQuestionsSection(questions) {
        const formattedQuestions = this.formatQuestions(questions);
        return `
            <div class="questions-section">
                <h2 style="font-size: 1.4rem; font-weight: 600; color: #2d3748; margin-bottom: 20px; border-bottom: 2px solid #48bb78; padding-bottom: 8px;">❓ Questions</h2>
                ${formattedQuestions}
            </div>
        `;
    }

    formatParagraphs(text) {
        const paragraphs = text.split(/\n\s*\n/);
        return paragraphs
            .map(para => para.trim())
            .filter(para => para.length > 0)
            .map(para => `<p style="margin-bottom: 16px; text-align: justify;">${para.replace(/\n/g, '<br>')}</p>`)
            .join('');
    }

    formatQuestions(questionsText) {
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
                    result += this.renderMultipleChoiceQuestion(currentQuestion, currentOptions, questionNumber++);
                    currentOptions = [];
                } else if (currentQuestion) {
                    result += this.renderShortAnswerQuestion(currentQuestion, questionNumber++);
                }
                currentQuestion = line;
            }
        }
        
        // Process the last question
        if (currentQuestion && currentOptions.length > 0) {
            result += this.renderMultipleChoiceQuestion(currentQuestion, currentOptions, questionNumber++);
        } else if (currentQuestion) {
            result += this.renderShortAnswerQuestion(currentQuestion, questionNumber++);
        }
        
        return result;
    }

    renderMultipleChoiceQuestion(question, options, number) {
        const cleanQuestion = question.replace(/^\d+\.?\s*/, '');
        const optionsHtml = options.map(opt => 
            `<div style="margin: 8px 0; padding: 8px 12px; background: #f8f9fa; border-radius: 6px; border-left: 3px solid #4299e1;">
                <span style="font-weight: 500;">${opt}</span>
            </div>`
        ).join('');
        
        return `
            <div style="margin-bottom: 25px; page-break-inside: avoid;">
                <div style="margin-bottom: 12px; padding: 12px; background: #edf2f7; border-radius: 8px; border-left: 4px solid #4299e1;">
                    <strong style="color: #2d3748;">${number}. ${cleanQuestion}</strong>
                </div>
                <div style="margin-left: 20px;">
                    ${optionsHtml}
                </div>
            </div>
        `;
    }

    renderShortAnswerQuestion(question, number) {
        const cleanQuestion = question.replace(/^\d+\.?\s*/, '');
        return `
            <div style="margin-bottom: 25px; page-break-inside: avoid;">
                <div style="margin-bottom: 15px; padding: 12px; background: #edf2f7; border-radius: 8px; border-left: 4px solid #48bb78;">
                    <strong style="color: #2d3748;">${number}. ${cleanQuestion}</strong>
                </div>
                <div style="margin-left: 20px;">
                    <div style="border-bottom: 2px solid #e2e8f0; height: 40px; margin-bottom: 10px;"></div>
                    <div style="border-bottom: 2px solid #e2e8f0; height: 40px; margin-bottom: 10px;"></div>
                </div>
            </div>
        `;
    }    createPages(title, content) {
        console.log('=== CREATE PAGES START ===');
        
        if (!content.trim()) {
            console.log('No content, returning single empty page');
            return [{ content: '', pageNumber: 1, totalPages: 1 }];
        }

        // Create a test page to measure content
        const testPage = this.createMeasurementPage(title);
        document.body.appendChild(testPage);
        
        try {
            return this.splitContentDomBased(content, testPage, title);
        } finally {
            document.body.removeChild(testPage);
        }
    }

    createMeasurementPage(title) {
        const page = document.createElement('div');
        page.style.cssText = `
            position: absolute;
            top: -9999px;
            left: -9999px;
            width: 210mm;
            height: 297mm;
            font-family: ${this.currentFont};
            font-size: ${this.currentFontSize}em;
            background: white;
            display: flex;
            flex-direction: column;
            visibility: hidden;
        `;
        
        // Add header
        const header = document.createElement('div');
        header.innerHTML = this.createPrintPageHeader(title, true);
        header.style.flexShrink = '0';
        page.appendChild(header);
        
        // Add content area
        const contentArea = document.createElement('div');
        contentArea.style.cssText = `
            flex: 1;
            padding: 0 32px;
            overflow: hidden;
        `;
        page.appendChild(contentArea);
        
        // Add footer
        const footer = document.createElement('div');
        footer.innerHTML = this.createPrintPageFooter(1, 1);
        footer.style.flexShrink = '0';
        page.appendChild(footer);
        
        return page;
    }

    splitContentDomBased(content, testPage, title) {
        const pages = [];
        const contentArea = testPage.children[1]; // The content div
        const maxHeight = contentArea.offsetHeight;
        console.log('Available content height:', maxHeight);
        
        // Split content into logical chunks (paragraphs, questions, etc.)
        const chunks = this.splitContentIntoChunks(content);
        console.log('Content split into', chunks.length, 'chunks');
        
        let currentPageContent = '';
        let pageNumber = 1;
        
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const testContent = currentPageContent + chunk;
            
            // Test if this content fits on current page
            contentArea.innerHTML = testContent;
            
            if (contentArea.scrollHeight <= maxHeight) {
                // Content fits, add it to current page
                currentPageContent = testContent;
            } else {
                // Content doesn't fit, finish current page and start new one
                if (currentPageContent.trim()) {
                    pages.push({
                        content: currentPageContent,
                        pageNumber: pageNumber++
                    });
                    console.log(`Page ${pageNumber - 1} created with content length:`, currentPageContent.length);
                }
                
                // Start new page with current chunk
                currentPageContent = chunk;
                
                // Check if even this single chunk is too big
                contentArea.innerHTML = chunk;
                if (contentArea.scrollHeight > maxHeight) {
                    console.warn('Chunk too large for page, splitting further');
                    // For now, just add it - in production we'd split the chunk further
                }
            }
        }
        
        // Add the last page if there's content
        if (currentPageContent.trim()) {
            pages.push({
                content: currentPageContent,
                pageNumber: pageNumber++
            });
            console.log(`Final page ${pageNumber - 1} created`);
        }
        
        // Set total pages for all pages
        pages.forEach(page => page.totalPages = pages.length);
        
        console.log('=== FINAL PAGES ===');
        console.log('Total pages created:', pages.length);
        
        return pages.length > 0 ? pages : [{ content: content, pageNumber: 1, totalPages: 1 }];
    }

    splitContentIntoChunks(content) {
        // Split content into logical chunks that shouldn't be broken
        const chunks = [];
        
        // First try to split by major sections
        const sectionRegex = /<div[^>]*class="[^"]*section[^"]*"[^>]*>.*?<\/div>/gs;
        const sections = content.match(sectionRegex) || [];
        
        if (sections.length > 0) {
            let remainingContent = content;
            
            sections.forEach(section => {
                const index = remainingContent.indexOf(section);
                if (index > 0) {
                    // Add content before this section
                    const beforeSection = remainingContent.substring(0, index).trim();
                    if (beforeSection) chunks.push(beforeSection);
                }
                
                // Add the section itself
                chunks.push(section);
                
                // Update remaining content
                remainingContent = remainingContent.substring(index + section.length);
            });
            
            // Add any remaining content
            if (remainingContent.trim()) {
                chunks.push(remainingContent.trim());
            }
        } else {
            // If no sections, split by paragraphs and other block elements
            const blockRegex = /<(?:p|div|h[1-6]|ul|ol|li)[^>]*>.*?<\/(?:p|div|h[1-6]|ul|ol|li)>/gs;
            const blocks = content.match(blockRegex) || [];
            
            if (blocks.length > 0) {
                chunks.push(...blocks);
            } else {
                // Last resort - split by sentences
                const sentences = content.split(/(?<=[.!?])\s+/);
                chunks.push(...sentences.filter(s => s.trim()));
            }
        }
          return chunks.filter(chunk => chunk && chunk.trim());
    }

    createTestPage(title, isFirstPage) {
        const page = document.createElement('div');
        page.style.cssText = `
            position: absolute;
            top: -9999px;
            left: -9999px;
            visibility: hidden;
            width: ${PAGE_WIDTH}px;
            height: ${PAGE_HEIGHT}px;
            display: flex;
            flex-direction: column;
            font-family: ${this.currentFont};
            font-size: ${this.currentFontSize}em;
            background: white;
            box-sizing: border-box;
        `;

        const header = this.createPageHeader(title, isFirstPage);
        const content = document.createElement('div');
        content.className = 'page-content';
        content.style.cssText = `
            flex: 1;
            padding: 0 32px;
            overflow: hidden;
            height: ${MAX_CONTENT_HEIGHT}px;
            max-height: ${MAX_CONTENT_HEIGHT}px;
            box-sizing: border-box;
        `;
        const footer = this.createPageFooter(1, 1);

        page.appendChild(header);
        page.appendChild(content);
        page.appendChild(footer);

        return page;
    }

    createPageHeader(title, isFirstPage) {
        const header = document.createElement('div');
        header.className = 'page-header';
        header.style.cssText = 'flex-shrink: 0; padding: 32px 32px 20px 32px;';

        if (isFirstPage) {
            header.innerHTML = `
                <img src="../../Assets/Images/color-logo1.png" alt="Willena Logo" style="display:block;margin:0 auto 16px auto;width:110px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:18px; font-size:1.05rem; color:#222;">
                    <span>Name: <span style="display:inline-block; border-bottom:1px solid #bbb; min-width:120px;">&nbsp;</span></span>
                    <span>Date: <span style="display:inline-block; border-bottom:1px solid #bbb; min-width:90px;">&nbsp;</span></span>
                </div>
                <h1 style="font-size:2.2rem;font-weight:bold;text-align:center;margin-bottom:20px;color:#2e2b3f;letter-spacing:1px;">${title}</h1>
            `;
        } else {
            header.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; padding-bottom:15px; border-bottom:2px solid #2e2b3f;">
                    <div>
                        <h2 style="font-size:1.6rem;font-weight:bold;color:#2e2b3f;margin:0;">${title}</h2>
                        <div style="font-size:0.9rem;color:#666;margin-top:4px;">continued from previous page</div>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:6px; font-size:0.95rem; color:#222;">
                        <span>Name: <span style="display:inline-block; border-bottom:1px solid #bbb; min-width:100px;">&nbsp;</span></span>
                        <span>Date: <span style="display:inline-block; border-bottom:1px solid #bbb; min-width:80px;">&nbsp;</span></span>
                    </div>
                </div>
            `;
        }

        return header;
    }

    createPageFooter(pageNumber, totalPages) {
        const footer = document.createElement('div');
        footer.className = 'page-footer';
        footer.style.cssText = `
            flex-shrink: 0;
            padding: 20px 32px;
            border-top: 1px solid #eee;
            text-align: center;
            color: #888;
            font-size: 0.9rem;
            position: relative;
        `;

        footer.innerHTML = `
            Willena 원어민 영어학원 | 031-8041-2203 | www.willenaenglish.com
            <div style="position: absolute; bottom: 20px; right: 32px; font-size: 0.9rem; color: #666;">
                Page ${pageNumber} of ${totalPages}
            </div>
        `;

        return footer;
    }

    updateTestPageForContinuation(testPage, title) {
        const header = testPage.querySelector('.page-header');
        header.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; padding-bottom:15px; border-bottom:2px solid #2e2b3f;">
                <div>
                    <h2 style="font-size:1.6rem;font-weight:bold;color:#2e2b3f;margin:0;">${title}</h2>
                    <div style="font-size:0.9rem;color:#666;margin-top:4px;">continued from previous page</div>
                </div>
                <div style="display:flex; flex-direction:column; gap:6px; font-size:0.95rem; color:#222;">
                    <span>Name: <span style="display:inline-block; border-bottom:1px solid #bbb; min-width:100px;">&nbsp;</span></span>
                    <span>Date: <span style="display:inline-block; border-bottom:1px solid #bbb; min-width:80px;">&nbsp;</span></span>
                </div>
            </div>
        `;
    }    splitContentIntoMeasurableParts(content) {
        // Split content into very small, measurable parts
        const parts = [];
        
        // First split by major HTML blocks
        const majorBlocks = content.split(/(<div[^>]*class="[^"]*section[^"]*"[^>]*>.*?<\/div>)/gs);
        
        for (const block of majorBlocks) {
            if (!block || !block.trim()) continue;
            
            if (block.includes('class="') && block.includes('section')) {
                // This is a section block - split it more carefully
                const sectionParts = block.split(/(<h[1-6][^>]*>.*?<\/h[1-6]>|<p[^>]*>.*?<\/p>|<div[^>]*>.*?<\/div>)/gs);
                for (const part of sectionParts) {
                    if (part && part.trim()) {
                        if (part.length > 300) {
                            // Split large text further by sentences
                            const sentences = part.split(/([.!?]+\s+)/);
                            for (const sentence of sentences) {
                                if (sentence && sentence.trim()) {
                                    parts.push(sentence);
                                }
                            }
                        } else {
                            parts.push(part);
                        }
                    }
                }
            } else {
                // Regular content - split by sentences if it's large
                if (block.length > 200) {
                    const sentences = block.split(/([.!?]+\s+)/);
                    for (const sentence of sentences) {
                        if (sentence && sentence.trim()) {
                            parts.push(sentence);
                        }
                    }
                } else {
                    parts.push(block);
                }
            }
        }
        
        return parts.filter(part => part && part.trim());    }
    
    renderPreview() {
        const previewArea = document.getElementById('reading2PreviewArea');
        
        console.log('=== RENDER PREVIEW ===');
        console.log('Rendering', this.currentPages.length, 'pages');
        
        if (this.currentPages.length === 0) {
            previewArea.innerHTML = `
                <div style="text-align: center; color: #666; padding: 60px 20px;">
                    <div style="font-size: 48px; margin-bottom: 20px;">📄</div>
                    <h3>No content to display</h3>
                    <p>Please check if content is being generated</p>
                </div>
            `;
            return;
        }

        // Create scrollable container with all pages
        let html = '';
        
        this.currentPages.forEach((page, index) => {
            const isFirstPage = index === 0;
            const title = document.getElementById('reading2Title').value.trim() || "Reading Comprehension";
            
            console.log(`Rendering page ${index + 1} with content length:`, page.content.length);
            
            html += `
                <div class="preview-page" style="
                    width: 600px; 
                    height: 849px; 
                    background: white; 
                    border: 2px solid #e2e8f0; 
                    border-radius: 8px; 
                    box-shadow: 0 8px 32px rgba(0,0,0,0.12); 
                    overflow: hidden; 
                    transform: scale(0.8); 
                    transform-origin: top center; 
                    margin: 20px auto; 
                    font-family: ${this.currentFont}; 
                    font-size: ${this.currentFontSize * 0.8}em; 
                    display: flex; 
                    flex-direction: column;
                    position: relative;
                ">
                    ${this.createPreviewPageHeader(title, isFirstPage)}
                    <div style="flex: 1; padding: 0 24px; overflow: hidden; line-height: 1.6;">
                        ${page.content}
                    </div>
                    ${this.createPreviewPageFooter(page.pageNumber, page.totalPages)}
                </div>
            `;
            
            // Add page break indicator between pages
            if (index < this.currentPages.length - 1) {
                html += `
                    <div style="
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        padding: 12px 24px;
                        border-radius: 25px;
                        font-size: 14px;
                        font-weight: 600;
                        text-align: center;
                        box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
                        max-width: 400px;
                        margin: 30px auto;
                    ">
                        📄 Page Break - Content continues on Page ${index + 2}
                    </div>
                `;
            }
        });

        console.log('Setting preview HTML, length:', html.length);
        previewArea.innerHTML = html;
        console.log('Preview rendered successfully');
                html += `
                    <div class="page-break-indicator" style="
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        padding: 12px 24px;
                        border-radius: 25px;
                        font-size: 14px;
                        font-weight: 600;
                        text-align: center;
                        box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);                        max-width: 400px;
                        margin: 30px auto;
                    ">
                        📄 Page Break - Content continues on Page ${index + 2}
                    </div>
                `;
            }
        });

        console.log('Setting preview HTML, length:', html.length);
        previewArea.innerHTML = html;
        console.log('Preview rendered successfully');
    }

    createPreviewPageHeader(title, isFirstPage) {
        if (isFirstPage) {
            return `
                <div style="flex-shrink: 0; padding: 18px 24px; text-align: center; border-bottom: 1px solid #e2e8f0;">
                    <img src="../../Assets/Images/color-logo1.png" alt="Logo" style="width: 60px; margin-bottom: 8px;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:12px; font-size:0.8rem; color:#666;">
                        <span>Name: _______________</span>
                        <span>Date: ___________</span>
                    </div>
                    <h1 style="font-size:1.4rem;font-weight:bold;margin:0;color:#2e2b3f;">${title}</h1>
                </div>
            `;
        } else {
            return `
                <div style="flex-shrink: 0; padding: 18px 24px; border-bottom: 1px solid #e2e8f0;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <h2 style="font-size:1.1rem;font-weight:bold;margin:0;color:#2e2b3f;">${title}</h2>
                            <div style="font-size:0.65rem;color:#666;margin-top:2px;">continued from previous page</div>
                        </div>
                        <div style="font-size:0.65rem;color:#666;">
                            <div>Name: _______</div>
                            <div>Date: _______</div>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    createPreviewPageFooter(pageNumber, totalPages) {
        return `
            <div style="flex-shrink: 0; padding: 8px 24px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 0.5rem; color: #888; position: relative; background: #f8f9fa;">
                Willena 원어민 영어학원 | 031-8041-2203 | www.willenaenglish.com
                <div style="position: absolute; bottom: 8px; right: 24px; font-size: 0.55rem; font-weight: 600; color: #2e2b3f;">
                    Page ${pageNumber} of ${totalPages}
                </div>
            </div>
        `;
    }

    printWorksheet() {
        if (this.currentPages.length === 0) {
            alert('Please create a worksheet first.');
            return;
        }

        const printWindow = window.open('', '', 'width=900,height=1200');
        const title = document.getElementById('reading2Title').value.trim() || "Reading Comprehension";
        
        let printContent = `
            <html>
                <head>
                    <title>Print - ${title}</title>
                    <style>
                        @page { margin: 0; size: A4; }
                        body { margin: 0; padding: 0; font-family: ${this.currentFont}; font-size: ${this.currentFontSize}em; }
                        .print-page { 
                            width: 210mm; 
                            height: 297mm; 
                            page-break-after: always; 
                            page-break-inside: avoid;
                            display: flex;
                            flex-direction: column;
                            background: white;
                            overflow: hidden;
                        }
                        .print-page:last-child { page-break-after: auto; }
                        .page-header { flex-shrink: 0; padding: 32px 32px 20px 32px; }
                        .page-content { flex: 1; padding: 0 32px; overflow: hidden; }
                        .page-footer { 
                            flex-shrink: 0; 
                            padding: 20px 32px; 
                            border-top: 1px solid #eee; 
                            text-align: center; 
                            color: #888; 
                            font-size: 0.9rem;
                            position: relative;
                        }
                    </style>
                </head>
                <body>
        `;

        this.currentPages.forEach((page, index) => {
            const isFirstPage = index === 0;
            printContent += `
                <div class="print-page">
                    ${this.createPrintPageHeader(title, isFirstPage)}
                    <div class="page-content">${page.content}</div>
                    ${this.createPrintPageFooter(page.pageNumber, page.totalPages)}
                </div>
            `;
        });

        printContent += '</body></html>';
        
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
    }

    createPrintPageHeader(title, isFirstPage) {
        if (isFirstPage) {
            return `
                <div class="page-header">
                    <img src="../../Assets/Images/color-logo1.png" alt="Willena Logo" style="display:block;margin:0 auto 16px auto;width:110px;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:18px; font-size:1.05rem; color:#222;">
                        <span>Name: <span style="display:inline-block; border-bottom:1px solid #bbb; min-width:120px;">&nbsp;</span></span>
                        <span>Date: <span style="display:inline-block; border-bottom:1px solid #bbb; min-width:90px;">&nbsp;</span></span>
                    </div>
                    <h1 style="font-size:2.2rem;font-weight:bold;text-align:center;margin-bottom:20px;color:#2e2b3f;letter-spacing:1px;">${title}</h1>
                </div>
            `;
        } else {
            return `
                <div class="page-header">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; padding-bottom:15px; border-bottom:2px solid #2e2b3f;">
                        <div>
                            <h2 style="font-size:1.6rem;font-weight:bold;color:#2e2b3f;margin:0;">${title}</h2>
                            <div style="font-size:0.9rem;color:#666;margin-top:4px;">continued from previous page</div>
                        </div>
                        <div style="display:flex; flex-direction:column; gap:6px; font-size:0.95rem; color:#222;">
                            <span>Name: <span style="display:inline-block; border-bottom:1px solid #bbb; min-width:100px;">&nbsp;</span></span>
                            <span>Date: <span style="display:inline-block; border-bottom:1px solid #bbb; min-width:80px;">&nbsp;</span></span>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    createPrintPageFooter(pageNumber, totalPages) {
        return `
            <div class="page-footer">
                Willena 원어민 영어학원 | 031-8041-2203 | www.willenaenglish.com
                <div style="position: absolute; bottom: 20px; right: 32px; font-size: 0.9rem; color: #666;">
                    Page ${pageNumber} of ${totalPages}
                </div>
            </div>
        `;
    }

    exportToPDF() {
        // For now, trigger print dialog which can save as PDF
        this.printWorksheet();
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ReadingWorksheetBuilder2();
});

// Export for global access
window.ReadingWorksheetBuilder2 = ReadingWorksheetBuilder2;
