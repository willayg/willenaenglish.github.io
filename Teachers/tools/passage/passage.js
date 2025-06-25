// Passage Builder JavaScript - Built for Multi-Page from the Ground Up

function generatePassage() {
    const title = document.getElementById('passageTitle').value.trim();
    const content = document.getElementById('passageContent').value.trim();
    
    if (!content) {
        alert('Please enter some passage content.');
        return;
    }
    
    // Generate the multi-page passage
    const pages = createMultiPagePassage(title, content);
    
    // Display in preview
    const preview = document.getElementById('passagePreview');
    preview.innerHTML = pages.join('<div class="page-break-indicator">📄 Page Break - Content continues on next page</div>');
}

function createMultiPagePassage(title, content) {
    // Create a test page to measure real available space
    const testPage = createTestPage(title, true);
    document.body.appendChild(testPage);
    
    const pages = [];
    const contentParts = splitContentIntoSentences(content);
    
    let currentPageContent = '';
    let partIndex = 0;
    let pageNumber = 1;
    
    while (partIndex < contentParts.length) {
        const part = contentParts[partIndex];
        const testContent = currentPageContent + (currentPageContent ? ' ' : '') + part;
        
        // Test if this content fits on current page
        const contentDiv = testPage.querySelector('.page-content');
        contentDiv.innerHTML = formatTextContent(testContent);
        
        // Check if content overflows the available space
        const overflows = contentDiv.scrollHeight > contentDiv.clientHeight;
        
        if (overflows && currentPageContent !== '') {
            // Current page is full - save it and start new page
            const isFirstPage = pageNumber === 1;
            pages.push(createPassagePage(title, formatTextContent(currentPageContent), pageNumber, pages.length + 1, isFirstPage));
            
            // Reset for new page
            currentPageContent = part;
            pageNumber++;
            
            // Update test page for continuation page (no title)
            updateTestPageForContinuation(testPage);
        } else {
            // Part fits - add it to current page
            currentPageContent = testContent;
            partIndex++;
        }
    }
    
    // Add final page if it has content
    if (currentPageContent) {
        const isFirstPage = pageNumber === 1;
        pages.push(createPassagePage(title, formatTextContent(currentPageContent), pageNumber, pageNumber, isFirstPage));
    }
    
    // Clean up test page
    document.body.removeChild(testPage);
    
    return pages;
}

function createTestPage(title, isFirstPage) {
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
        font-family: 'Poppins', sans-serif;
    `;
    
    // Create header
    const header = document.createElement('div');
    header.className = `page-header ${isFirstPage ? 'first-page' : 'continuation'}`;
    
    if (isFirstPage) {
        header.innerHTML = `
            <img src="../../Assets/Images/color-logo1.png" alt="Willena Logo" class="logo">
            <div class="student-info">
                <div>Name: <span>&nbsp;</span></div>
                <div>Date: <span>&nbsp;</span></div>
            </div>
            <h1 class="page-title">${title || ''}</h1>
        `;
    } else {
        header.innerHTML = `
            <img src="../../Assets/Images/color-logo1.png" alt="Willena Logo" class="logo">
            <div class="student-info">
                <div>Name: <span>&nbsp;</span></div>
                <div>Date: <span>&nbsp;</span></div>
            </div>
        `;
    }
    
    // Create content area
    const content = document.createElement('div');
    content.className = 'page-content';
    
    // Create footer
    const footer = document.createElement('div');
    footer.className = 'page-footer';
    footer.innerHTML = `
        Willena 원어민 영어학원 | 031-8041-2203 | www.willenaenglish.com
        <div class="page-number">Page 1</div>
    `;
    
    page.appendChild(header);
    page.appendChild(content);
    page.appendChild(footer);
    
    return page;
}

function updateTestPageForContinuation(testPage) {
    const header = testPage.querySelector('.page-header');
    header.className = 'page-header continuation';
    header.innerHTML = `
        <img src="../../Assets/Images/color-logo1.png" alt="Willena Logo" class="logo">
        <div class="student-info">
            <div>Name: <span>&nbsp;</span></div>
            <div>Date: <span>&nbsp;</span></div>
        </div>
    `;
}

function createPassagePage(title, content, pageNumber, totalPages, isFirstPage) {
    return `
        <div class="passage-page">
            <div class="page-header ${isFirstPage ? 'first-page' : 'continuation'}">
                <img src="../../Assets/Images/color-logo1.png" alt="Willena Logo" class="logo">
                <div class="student-info">
                    <div>Name: <span>&nbsp;</span></div>
                    <div>Date: <span>&nbsp;</span></div>
                </div>
                ${isFirstPage ? `<h1 class="page-title">${title}</h1>` : ''}
            </div>
            <div class="page-content">
                ${content}
            </div>
            <div class="page-footer">
                Willena 원어민 영어학원 | 031-8041-2203 | www.willenaenglish.com
                <div class="page-number">Page ${pageNumber} of ${totalPages}</div>
            </div>
        </div>
    `;
}

function splitContentIntoSentences(content) {
    // Split content into sentences, preserving sentence boundaries
    const sentences = content.split(/(?<=[.!?])\s+/);
    return sentences.filter(sentence => sentence.trim().length > 0);
}

function formatTextContent(content) {
    // Simple paragraph formatting
    const paragraphs = content.split(/\n\s*\n/);
    return paragraphs
        .map(para => para.trim())
        .filter(para => para.length > 0)
        .map(para => `<p style="margin-bottom: 16px; text-align: justify;">${para}</p>`)
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

// Auto-generate passage on page load
document.addEventListener('DOMContentLoaded', function() {
    generatePassage();
    
    // Add live preview on input change
    document.getElementById('passageTitle').addEventListener('input', generatePassage);
    document.getElementById('passageContent').addEventListener('input', debounce(generatePassage, 500));
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
