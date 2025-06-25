// Reading Worksheet Builder 2.0 - Clean version with proper multi-page system

class ReadingWorksheetBuilder2 {
    constructor() {
        this.currentPages = [];
        this.currentFont = "'Poppins', sans-serif";
        this.currentFontSize = 1.0;
        this.currentPageIndex = 0;
        this.zoomLevel = 0.8;
        this.init();
    }

    init() {
        // Add sample content for immediate preview
        this.initializeSampleContent();
        
        // Bind event listeners
        this.bindEvents();
        
        // Initial preview
        setTimeout(() => {
            this.updateWorksheet();
        }, 100);
    }

    initializeSampleContent() {
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
        const inputs = [
            'reading2Title',
            'reading2Passage', 
            'reading2Questions',
            'reading2Font',
            'reading2FontSize',
            'reading2IncludePassage'
        ];

        inputs.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('input', () => this.updateWorksheet());
                element.addEventListener('change', () => this.updateWorksheet());
            }
        });        document.getElementById('reading2GenerateBtn').addEventListener('click', () => this.generateQuestions());
        document.getElementById('reading2PrintBtn').addEventListener('click', () => this.printWorksheet());
        document.getElementById('reading2PdfBtn').addEventListener('click', () => this.exportToPDF());
        
        // Page navigation controls
        document.getElementById('prevPageBtn').addEventListener('click', () => this.previousPage());
        document.getElementById('nextPageBtn').addEventListener('click', () => this.nextPage());
        document.getElementById('zoomInBtn').addEventListener('click', () => this.zoomIn());
        document.getElementById('zoomOutBtn').addEventListener('click', () => this.zoomOut());
        document.getElementById('fitWidthBtn').addEventListener('click', () => this.fitWidth());
        
        // Preview navigation controls
        document.getElementById('prevPageBtn').addEventListener('click', () => this.goToPreviousPage());
        document.getElementById('nextPageBtn').addEventListener('click', () => this.goToNextPage());
        document.getElementById('zoomInBtn').addEventListener('click', () => this.zoomIn());
        document.getElementById('zoomOutBtn').addEventListener('click', () => this.zoomOut());
        document.getElementById('fitWidthBtn').addEventListener('click', () => this.fitWidth());
    }

    updateWorksheet() {
        console.log('=== UPDATE WORKSHEET ===');
        
        const title = document.getElementById('reading2Title').value.trim() || "Reading Comprehension";
        const passage = document.getElementById('reading2Passage').value.trim();
        const questions = document.getElementById('reading2Questions').value.trim();
        const includePassage = document.getElementById('reading2IncludePassage').checked;
        
        // Update font settings
        const fontSelect = document.getElementById('reading2Font');
        const fontSizeSelect = document.getElementById('reading2FontSize');
        
        if (fontSelect) this.currentFont = fontSelect.value;
        if (fontSizeSelect) {
            const sizeMap = { 'Small': 0.9, 'Normal': 1.0, 'Large': 1.1 };
            this.currentFontSize = sizeMap[fontSizeSelect.value] || 1.0;
        }

        console.log('Title:', title);
        console.log('Passage length:', passage.length);
        console.log('Questions length:', questions.length);
        console.log('Include passage:', includePassage);

        // Build worksheet content
        let content = '';
        
        if (includePassage && passage) {
            content += this.formatPassageSection(passage);
        }
        
        if (questions) {
            content += this.formatQuestionsSection(questions);
        }

        console.log('Total content length:', content.length);

        // Generate pages
        this.currentPages = this.createPages(title, content);
          console.log('Final pages created:', this.currentPages.length);
        
        // Reset to first page
        this.currentPageIndex = 0;
        
        // Render preview
        this.renderPreview();
        this.updateNavigationControls();
    }

    formatPassageSection(passage) {
        return `
            <div class="passage-section" style="margin-bottom: 30px;">
                <h2 style="font-size: 1.4rem; font-weight: 600; color: #2d3748; margin-bottom: 15px; border-bottom: 2px solid #4299e1; padding-bottom: 8px;">📖 Reading Passage</h2>
                <div style="background: #f7fafc; padding: 20px; border-radius: 8px; border-left: 4px solid #4299e1; line-height: 1.8; color: #2d3748;">
                    ${passage.split('\n\n').map(paragraph => 
                        `<p style="margin-bottom: 15px; text-align: justify;">${paragraph.trim()}</p>`
                    ).join('')}
                </div>
            </div>
        `;
    }

    formatQuestionsSection(questions) {
        return `
            <div class="questions-section" style="margin-top: 30px;">
                <h2 style="font-size: 1.4rem; font-weight: 600; color: #2d3748; margin-bottom: 20px; border-bottom: 2px solid #48bb78; padding-bottom: 8px;">❓ Questions</h2>
                ${this.parseAndRenderQuestions(questions)}
            </div>
        `;
    }

    parseAndRenderQuestions(questionsText) {
        const lines = questionsText.split('\n').filter(line => line.trim());
        let result = '';
        let questionNumber = 1;
        let currentQuestion = '';
        let currentOptions = [];
        
        for (const line of lines) {
            const trimmed = line.trim();
            
            if (/^\d+\./.test(trimmed)) {
                if (currentQuestion && currentOptions.length > 0) {
                    result += this.renderMultipleChoiceQuestion(currentQuestion, currentOptions, questionNumber++);
                } else if (currentQuestion) {
                    result += this.renderShortAnswerQuestion(currentQuestion, questionNumber++);
                }
                
                currentQuestion = trimmed;
                currentOptions = [];
            } else if (/^[a-d]\)/i.test(trimmed)) {
                currentOptions.push(trimmed);
            }
        }
        
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
    }

    createPages(title, content) {
        console.log('=== CREATE PAGES START ===');
        
        if (!content.trim()) {
            console.log('No content, returning single empty page');
            return [{ content: '', pageNumber: 1, totalPages: 1 }];
        }

        // For now, create multiple pages by splitting content into reasonable chunks
        const chunks = this.splitContentIntoChunks(content);
        const pages = [];
        let pageNumber = 1;
        
        // Estimate characters per page (rough calculation)
        const maxCharsPerPage = 2000;
        
        let currentPageContent = '';
        
        for (const chunk of chunks) {
            if (currentPageContent.length + chunk.length <= maxCharsPerPage) {
                currentPageContent += chunk;
            } else {
                if (currentPageContent.trim()) {
                    pages.push({
                        content: currentPageContent,
                        pageNumber: pageNumber++
                    });
                }
                currentPageContent = chunk;
            }
        }
        
        if (currentPageContent.trim()) {
            pages.push({
                content: currentPageContent,
                pageNumber: pageNumber++
            });
        }
        
        // Set total pages for all pages
        pages.forEach(page => page.totalPages = pages.length);
        
        console.log('Total pages created:', pages.length);
        
        return pages.length > 0 ? pages : [{ content: content, pageNumber: 1, totalPages: 1 }];
    }

    splitContentIntoChunks(content) {
        // Split content into logical chunks
        const chunks = [];
        
        // First try to split by sections
        const sectionRegex = /<div[^>]*class="[^"]*section[^"]*"[^>]*>.*?<\/div>/gs;
        const sections = content.match(sectionRegex) || [];
        
        if (sections.length > 0) {
            let remainingContent = content;
            
            sections.forEach(section => {
                const index = remainingContent.indexOf(section);
                if (index > 0) {
                    const beforeSection = remainingContent.substring(0, index).trim();
                    if (beforeSection) chunks.push(beforeSection);
                }
                
                chunks.push(section);
                remainingContent = remainingContent.substring(index + section.length);
            });
            
            if (remainingContent.trim()) {
                chunks.push(remainingContent.trim());
            }
        } else {
            // Split by paragraphs/blocks
            const blockRegex = /<(?:p|div|h[1-6])[^>]*>.*?<\/(?:p|div|h[1-6])>/gs;
            const blocks = content.match(blockRegex) || [content];
            chunks.push(...blocks);
        }
        
        return chunks.filter(chunk => chunk && chunk.trim());
    }    renderPreview() {
        const previewArea = document.getElementById('reading2PreviewArea');
        
        console.log('=== RENDER PREVIEW ===');
        console.log('Rendering page', this.currentPageIndex + 1, 'of', this.currentPages.length);
        
        if (this.currentPages.length === 0) {
            previewArea.innerHTML = `
                <div style="text-align: center; color: #666; padding: 60px 20px;">
                    <div style="font-size: 48px; margin-bottom: 20px;">📄</div>
                    <h3>No content to display</h3>
                    <p>Please add a reading passage and questions</p>
                </div>
            `;
            return;
        }

        // Show only the current page
        const page = this.currentPages[this.currentPageIndex];
        const isFirstPage = this.currentPageIndex === 0;
        const title = document.getElementById('reading2Title').value.trim() || "Reading Comprehension";
        
        const html = `
            <div class="preview-page" style="
                width: 600px; 
                height: 849px; 
                background: white; 
                border: 2px solid #e2e8f0; 
                border-radius: 8px; 
                box-shadow: 0 8px 32px rgba(0,0,0,0.12); 
                overflow: hidden; 
                transform: scale(${this.zoomLevel}); 
                transform-origin: top center; 
                margin: 20px auto; 
                font-family: ${this.currentFont}; 
                font-size: ${this.currentFontSize * this.zoomLevel}em; 
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

        previewArea.innerHTML = html;
        this.updatePageNavigation();
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

    async generateQuestions() {
        const passage = document.getElementById('reading2Passage').value.trim();
        if (!passage) {
            alert('Please enter a reading passage first.');
            return;
        }

        const button = document.getElementById('reading2GenerateBtn');
        const originalText = button.textContent;
        button.textContent = '🤖 Generating...';
        button.disabled = true;

        try {
            const numQuestions = document.getElementById('reading2NumQuestions').value || 5;
            const format = document.getElementById('reading2Format').value || 'Multiple Choice';
            const questionTypes = [];
            
            if (document.getElementById('reading2Comprehension').checked) questionTypes.push('comprehension');
            if (document.getElementById('reading2Vocabulary').checked) questionTypes.push('vocabulary');
            if (document.getElementById('reading2Grammar').checked) questionTypes.push('grammar');
            if (document.getElementById('reading2Inference').checked) questionTypes.push('inference');

            const questions = await extractQuestionsWithAI(passage, {
                count: parseInt(numQuestions),
                format: format,
                types: questionTypes
            });

            if (questions) {
                document.getElementById('reading2Questions').value = questions;
                this.updateWorksheet();
            }
        } catch (error) {
            console.error('Error generating questions:', error);
            alert('Failed to generate questions. Please try again.');
        } finally {
            button.textContent = originalText;
            button.disabled = false;
        }
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
        this.printWorksheet();
   }

    // Page Navigation Methods
    previousPage() {
        if (this.currentPageIndex > 0) {
            this.currentPageIndex--;
            this.renderPreview();
        }
    }

    nextPage() {
        if (this.currentPageIndex < this.currentPages.length - 1) {
            this.currentPageIndex++;
            this.renderPreview();
        }
    }

    updatePageNavigation() {
        const prevBtn = document.getElementById('prevPageBtn');
        const nextBtn = document.getElementById('nextPageBtn');
        const currentPageNum = document.getElementById('currentPageNum');
        const totalPagesNum = document.getElementById('totalPagesNum');
        const zoomLevelSpan = document.getElementById('zoomLevel');

        if (prevBtn) prevBtn.disabled = this.currentPageIndex <= 0;
        if (nextBtn) nextBtn.disabled = this.currentPageIndex >= this.currentPages.length - 1;
        if (currentPageNum) currentPageNum.textContent = this.currentPageIndex + 1;
        if (totalPagesNum) totalPagesNum.textContent = this.currentPages.length;
        if (zoomLevelSpan) zoomLevelSpan.textContent = Math.round(this.zoomLevel * 100) + '%';
    }

    zoomIn() {
        this.zoomLevel = Math.min(this.zoomLevel + 0.1, 2.0);
        this.updateZoom();
    }

    zoomOut() {
        this.zoomLevel = Math.max(this.zoomLevel - 0.1, 0.3);
        this.updateZoom();
    }

    fitWidth() {
        this.zoomLevel = 0.8;
        this.updateZoom();
    }

    updateZoom() {
        const previewPage = document.querySelector('.preview-page');
        const zoomLevelSpan = document.getElementById('zoomLevel');
        
        if (previewPage) {
            previewPage.style.transform = `scale(${this.zoomLevel})`;
        }
        
        if (zoomLevelSpan) {
            zoomLevelSpan.textContent = Math.round(this.zoomLevel * 100) + '%';
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ReadingWorksheetBuilder2();
});

// Export for global access
window.ReadingWorksheetBuilder2 = ReadingWorksheetBuilder2;
