// Word Test Generator with Letter Hiding Functionality - Self-Contained Version

// Hide random letters in a word (excluding the first letter)
function hideRandomLetters(word, numLettersToHide = 1) {
    if (!word || word.length <= 1) return word;
    
    // Never hide the first letter
    const availablePositions = [];
    for (let i = 1; i < word.length; i++) {
        if (word[i] !== ' ') { // Don't hide spaces
            availablePositions.push(i);
        }
    }
    
    // Limit the number of letters to hide to available positions
    const actualLettersToHide = Math.min(numLettersToHide, availablePositions.length);
    
    // Randomly select positions to hide
    const positionsToHide = [];
    const shuffled = [...availablePositions].sort(() => Math.random() - 0.5);
    for (let i = 0; i < actualLettersToHide; i++) {
        positionsToHide.push(shuffled[i]);
    }
    
    // Replace selected letters with underscores
    let result = word.split('');
    positionsToHide.forEach(pos => {
        result[pos] = '_';
    });
    
    return result.join('');
}

// Mask word pairs based on test mode
function maskWordPairs(wordPairs, testMode, numLettersToHide = 1) {
    return wordPairs.map(pair => {
        const [eng, kor] = pair;
        if (!eng || !kor) return { eng: eng || '', kor: kor || '' };
        
        switch (testMode) {
            case 'hide-eng':
                return { eng: '', kor: kor.trim() };
            case 'hide-kor':
                return { eng: eng.trim(), kor: '' };
            case 'hide-random-letters':
                return { 
                    eng: hideRandomLetters(eng.trim(), numLettersToHide), 
                    kor: kor.trim() 
                };
            case 'random':
                const hideEng = Math.random() < 0.5;
                return hideEng 
                    ? { eng: '', kor: kor.trim() }
                    : { eng: eng.trim(), kor: '' };
            default:
                return { eng: eng.trim(), kor: kor.trim() };
        }
    });
}

// Generate complete worksheet HTML with styles
function generateWorksheetHTML(wordPairs, title = 'Word Test', layout = 'default') {
    const baseStyles = `
        <style>
            @page { margin: 0.5in; }
            body { 
                font-family: Arial, sans-serif; 
                margin: 0; 
                padding: 20px;
                background: white;
                font-size: 12px;
            }
            .worksheet-header {
                text-align: center;
                margin-bottom: 25px;
                border-bottom: 2px solid #333;
                padding-bottom: 10px;
            }
            .worksheet-title {
                font-size: 20px;
                font-weight: bold;
                margin-bottom: 5px;
            }
            .worksheet-subtitle {
                font-size: 12px;
                color: #666;
            }
            .worksheet-table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 15px;
            }
            .worksheet-table th {
                background-color: #f2f2f2;
                border: 1px solid #333;
                padding: 8px 6px;
                text-align: center;
                font-weight: bold;
                font-size: 11px;
            }
            .worksheet-table td {
                border: 1px solid #333;
                padding: 10px 6px;
                text-align: left;
                min-height: 20px;
                vertical-align: top;
            }
            .worksheet-table tr:nth-child(even) {
                background-color: #f9f9f9;
            }
            /* Default layout */
            .number-col { width: 8%; text-align: center; font-weight: bold; }
            .text-col { width: 46%; }
            /* 2-column layout */
            .two-col-number { width: 5%; text-align: center; font-weight: bold; }
            .two-col-text { width: 22.5%; }
            /* Picture layouts */
            .picture-list-table { page-break-inside: avoid; }
            .picture-list-table td { padding: 12px 8px; min-height: 60px; }
            .picture-test-table { }
            .picture-test-table td { padding: 15px 8px; min-height: 80px; text-align: center; }
            .image-placeholder {
                width: 60px;
                height: 60px;
                border: 2px dashed #ccc;
                display: inline-block;
                margin-right: 10px;
                vertical-align: middle;
                text-align: center;
                line-height: 60px;
                font-size: 10px;
                color: #666;
            }
            .picture-test-placeholder {
                width: 80px;
                height: 80px;
                border: 2px dashed #ccc;
                display: block;
                margin: 0 auto 10px auto;
                text-align: center;
                line-height: 80px;
                font-size: 10px;
                color: #666;
            }
            @media print {
                body { padding: 10px; font-size: 11px; }
                .worksheet-header { margin-bottom: 20px; }
                .worksheet-table { margin-top: 10px; }
                .no-print { display: none; }
            }
        </style>
    `;

    let tableHTML = '';
    
    if (layout === '4col') {
        // 2-Column layout - optimized for print
        const half = Math.ceil(wordPairs.length / 2);
        const left = wordPairs.slice(0, half);
        const right = wordPairs.slice(half);
        
        // Pad right side to match left side length
        while (right.length < left.length) {
            right.push({ eng: "", kor: "" });
        }
        
        tableHTML = `
            <table class="worksheet-table">
                <thead>
                    <tr>
                        <th class="two-col-number">#</th>
                        <th class="two-col-text">English</th>
                        <th class="two-col-text">Korean</th>
                        <th class="two-col-number">#</th>
                        <th class="two-col-text">English</th>
                        <th class="two-col-text">Korean</th>
                    </tr>
                </thead>
                <tbody>
                    ${left.map((leftPair, i) => {
                        const rightPair = right[i] || { eng: "", kor: "" };
                        const leftIndex = i + 1;
                        const rightIndex = i + half + 1 <= wordPairs.length ? i + half + 1 : "";
                        return `
                            <tr>
                                <td class="two-col-number">${leftIndex}</td>
                                <td class="two-col-text">${leftPair.eng || ''}</td>
                                <td class="two-col-text">${leftPair.kor || ''}</td>
                                <td class="two-col-number">${rightIndex}</td>
                                <td class="two-col-text">${rightPair.eng || ''}</td>
                                <td class="two-col-text">${rightPair.kor || ''}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    } else if (layout === 'images') {
        // Picture List layout - optimized for print
        tableHTML = `
            <table class="worksheet-table picture-list-table">
                <thead>
                    <tr>
                        <th class="number-col">#</th>
                        <th style="width:15%;">Image</th>
                        <th style="width:35%;">English</th>
                        <th style="width:42%;">Korean</th>
                    </tr>
                </thead>
                <tbody>
                    ${wordPairs.map((pair, i) => `
                        <tr>
                            <td class="number-col">${i + 1}</td>
                            <td style="text-align:center;">
                                <div class="image-placeholder">IMG</div>
                            </td>
                            <td>${pair.eng || ''}</td>
                            <td>${pair.kor || ''}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } else if (layout === '6col-images') {
        // Picture Test layout - optimized for print
        const half = Math.ceil(wordPairs.length / 2);
        const left = wordPairs.slice(0, half);
        const right = wordPairs.slice(half);
        
        // Pad right side to match left side length
        while (right.length < left.length) {
            right.push({ eng: "", kor: "" });
        }
        
        tableHTML = `
            <table class="worksheet-table picture-test-table">
                <thead>
                    <tr>
                        <th style="width:8%;">#</th>
                        <th style="width:20%;">Image</th>
                        <th style="width:22%;">Word</th>
                        <th style="width:8%;">#</th>
                        <th style="width:20%;">Image</th>
                        <th style="width:22%;">Word</th>
                    </tr>
                </thead>
                <tbody>
                    ${left.map((leftPair, i) => {
                        const rightPair = right[i] || { eng: "", kor: "" };
                        const leftIndex = i + 1;
                        const rightIndex = i + half + 1 <= wordPairs.length ? i + half + 1 : "";
                        return `
                            <tr>
                                <td style="text-align:center;font-weight:bold;">${leftIndex}</td>
                                <td style="text-align:center;">
                                    <div class="picture-test-placeholder">IMG</div>
                                </td>
                                <td>${leftPair.eng || ''}<br><small style="color:#666;">${leftPair.kor || ''}</small></td>
                                <td style="text-align:center;font-weight:bold;">${rightIndex}</td>
                                <td style="text-align:center;">
                                    ${rightIndex ? '<div class="picture-test-placeholder">IMG</div>' : ''}
                                </td>
                                <td>${rightPair.eng || ''}${rightPair.kor ? '<br><small style="color:#666;">' + rightPair.kor + '</small>' : ''}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    } else {
        // Default 3-column layout
        tableHTML = `
            <table class="worksheet-table">
                <thead>
                    <tr>
                        <th class="number-col">#</th>
                        <th class="text-col">English</th>
                        <th class="text-col">Korean</th>
                    </tr>
                </thead>
                <tbody>
                    ${wordPairs.map((pair, i) => `
                        <tr>
                            <td class="number-col">${i + 1}</td>
                            <td class="text-col">${pair.eng || ''}</td>
                            <td class="text-col">${pair.kor || ''}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${title}</title>
            ${baseStyles}
        </head>
        <body>
            <div class="worksheet-header">
                <div class="worksheet-title">${title}</div>
                <div class="worksheet-subtitle">Name: _________________ Date: _____________</div>
            </div>
            ${tableHTML}
        </body>
        </html>
    `;
}

// Generate simple preview HTML (for the preview area)
function generatePreviewHTML(wordPairs, title = 'Word Test', layout = 'default') {
    let tableHTML = '';
    
    if (layout === '4col') {
        // 2-Column layout
        const half = Math.ceil(wordPairs.length / 2);
        const left = wordPairs.slice(0, half);
        const right = wordPairs.slice(half);
        
        // Pad right side to match left side length
        while (right.length < left.length) {
            right.push({ eng: "", kor: "" });
        }
        
        tableHTML = `
            <div style="padding: 20px;">
                <h2 style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px;">
                    ${title}
                    <div style="font-size: 12px; color: #666; margin-top: 5px;">Name: _________________ Date: _____________</div>
                </h2>
                <table style="width:100%;border-collapse:collapse;">
                    <thead>
                        <tr>
                            <th style="width:5%;padding:8px;border:1px solid #333;background:#f2f2f2;font-size:11px;">#</th>
                            <th style="width:22.5%;padding:8px;border:1px solid #333;background:#f2f2f2;font-size:11px;">English</th>
                            <th style="width:22.5%;padding:8px;border:1px solid #333;background:#f2f2f2;font-size:11px;">Korean</th>
                            <th style="width:5%;padding:8px;border:1px solid #333;background:#f2f2f2;font-size:11px;">#</th>
                            <th style="width:22.5%;padding:8px;border:1px solid #333;background:#f2f2f2;font-size:11px;">English</th>
                            <th style="width:22.5%;padding:8px;border:1px solid #333;background:#f2f2f2;font-size:11px;">Korean</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${left.map((leftPair, i) => {
                            const rightPair = right[i] || { eng: "", kor: "" };
                            const leftIndex = i + 1;
                            const rightIndex = i + half + 1 <= wordPairs.length ? i + half + 1 : "";
                            const bgColor = i % 2 === 0 ? '#f9f9f9' : 'white';
                            return `
                                <tr style="background-color: ${bgColor};">
                                    <td style="padding:8px;border:1px solid #333;text-align:center;font-weight:bold;">${leftIndex}</td>
                                    <td style="padding:8px;border:1px solid #333;">${leftPair.eng || ''}</td>
                                    <td style="padding:8px;border:1px solid #333;">${leftPair.kor || ''}</td>
                                    <td style="padding:8px;border:1px solid #333;text-align:center;font-weight:bold;">${rightIndex}</td>
                                    <td style="padding:8px;border:1px solid #333;">${rightPair.eng || ''}</td>
                                    <td style="padding:8px;border:1px solid #333;">${rightPair.kor || ''}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } else if (layout === 'images') {
        // Picture List layout
        tableHTML = `
            <div style="padding: 20px;">
                <h2 style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px;">
                    ${title}
                    <div style="font-size: 12px; color: #666; margin-top: 5px;">Name: _________________ Date: _____________</div>
                </h2>
                <table style="width:100%;border-collapse:collapse;">
                    <thead>
                        <tr>
                            <th style="width:8%;padding:8px;border:1px solid #333;background:#f2f2f2;">#</th>
                            <th style="width:15%;padding:8px;border:1px solid #333;background:#f2f2f2;">Image</th>
                            <th style="width:35%;padding:8px;border:1px solid #333;background:#f2f2f2;">English</th>
                            <th style="width:42%;padding:8px;border:1px solid #333;background:#f2f2f2;">Korean</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${wordPairs.map((pair, i) => {
                            const bgColor = i % 2 === 0 ? '#f9f9f9' : 'white';
                            return `
                                <tr style="background-color: ${bgColor};">
                                    <td style="padding:8px;border:1px solid #333;text-align:center;font-weight:bold;">${i + 1}</td>
                                    <td style="padding:8px;border:1px solid #333;text-align:center;">
                                        <div style="width:60px;height:60px;border:2px dashed #ccc;display:inline-block;text-align:center;line-height:60px;font-size:10px;color:#666;">IMG</div>
                                    </td>
                                    <td style="padding:8px;border:1px solid #333;">${pair.eng || ''}</td>
                                    <td style="padding:8px;border:1px solid #333;">${pair.kor || ''}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } else if (layout === '6col-images') {
        // Picture Test layout
        const half = Math.ceil(wordPairs.length / 2);
        const left = wordPairs.slice(0, half);
        const right = wordPairs.slice(half);
        
        // Pad right side to match left side length
        while (right.length < left.length) {
            right.push({ eng: "", kor: "" });
        }
        
        tableHTML = `
            <div style="padding: 20px;">
                <h2 style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px;">
                    ${title}
                    <div style="font-size: 12px; color: #666; margin-top: 5px;">Name: _________________ Date: _____________</div>
                </h2>
                <table style="width:100%;border-collapse:collapse;">
                    <thead>
                        <tr>
                            <th style="width:8%;padding:8px;border:1px solid #333;background:#f2f2f2;">#</th>
                            <th style="width:20%;padding:8px;border:1px solid #333;background:#f2f2f2;">Image</th>
                            <th style="width:22%;padding:8px;border:1px solid #333;background:#f2f2f2;">Word</th>
                            <th style="width:8%;padding:8px;border:1px solid #333;background:#f2f2f2;">#</th>
                            <th style="width:20%;padding:8px;border:1px solid #333;background:#f2f2f2;">Image</th>
                            <th style="width:22%;padding:8px;border:1px solid #333;background:#f2f2f2;">Word</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${left.map((leftPair, i) => {
                            const rightPair = right[i] || { eng: "", kor: "" };
                            const leftIndex = i + 1;
                            const rightIndex = i + half + 1 <= wordPairs.length ? i + half + 1 : "";
                            const bgColor = i % 2 === 0 ? '#f9f9f9' : 'white';
                            return `
                                <tr style="background-color: ${bgColor};">
                                    <td style="padding:15px 8px;border:1px solid #333;text-align:center;font-weight:bold;">${leftIndex}</td>
                                    <td style="padding:15px 8px;border:1px solid #333;text-align:center;">
                                        <div style="width:80px;height:80px;border:2px dashed #ccc;display:block;margin:0 auto;text-align:center;line-height:80px;font-size:10px;color:#666;">IMG</div>
                                    </td>
                                    <td style="padding:15px 8px;border:1px solid #333;">${leftPair.eng || ''}${leftPair.kor ? '<br><small style="color:#666;">' + leftPair.kor + '</small>' : ''}</td>
                                    <td style="padding:15px 8px;border:1px solid #333;text-align:center;font-weight:bold;">${rightIndex}</td>
                                    <td style="padding:15px 8px;border:1px solid #333;text-align:center;">
                                        ${rightIndex ? '<div style="width:80px;height:80px;border:2px dashed #ccc;display:block;margin:0 auto;text-align:center;line-height:80px;font-size:10px;color:#666;">IMG</div>' : ''}
                                    </td>
                                    <td style="padding:15px 8px;border:1px solid #333;">${rightPair.eng || ''}${rightPair.kor ? '<br><small style="color:#666;">' + rightPair.kor + '</small>' : ''}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } else {
        // Default 3-column layout
        tableHTML = `
            <div style="padding: 20px;">
                <h2 style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px;">
                    ${title}
                    <div style="font-size: 12px; color: #666; margin-top: 5px;">Name: _________________ Date: _____________</div>
                </h2>
                <table style="width:100%;border-collapse:collapse;">
                    <thead>
                        <tr>
                            <th style="width:8%;padding:8px;border:1px solid #333;background:#f2f2f2;">#</th>
                            <th style="width:46%;padding:8px;border:1px solid #333;background:#f2f2f2;">English</th>
                            <th style="width:46%;padding:8px;border:1px solid #333;background:#f2f2f2;">Korean</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${wordPairs.map((pair, i) => {
                            const bgColor = i % 2 === 0 ? '#f9f9f9' : 'white';
                            return `
                                <tr style="background-color: ${bgColor};">
                                    <td style="padding:8px;border:1px solid #333;text-align:center;font-weight:bold;">${i + 1}</td>
                                    <td style="padding:8px;border:1px solid #333;">${pair.eng || ''}</td>
                                    <td style="padding:8px;border:1px solid #333;">${pair.kor || ''}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }
    
    return tableHTML;
}

// Update preview
function updatePreview() {
    const wordsTextarea = document.getElementById('wordTestWords');
    const previewArea = document.getElementById('worksheetPreviewArea');
    const titleInput = document.getElementById('wordTestTitle');
    const layoutSelect = document.getElementById('wordTestLayout');
    const modeSelect = document.getElementById('wordTestMode');
    const numLettersInput = document.getElementById('numLettersToHide');
    
    if (!wordsTextarea || !previewArea) return;
    
    const words = wordsTextarea.value.trim();
    const title = titleInput ? titleInput.value.trim() || 'Word Test' : 'Word Test';
    const layout = layoutSelect ? layoutSelect.value : 'default';
    const testMode = modeSelect ? modeSelect.value : 'none';
    const numLettersToHide = numLettersInput ? parseInt(numLettersInput.value, 10) || 2 : 2;
    
    if (!words) {
        previewArea.innerHTML = `
            <div style="padding: 20px; text-align: center; color: #666;">
                Enter some word pairs to preview the worksheet.
            </div>
        `;
        return;
    }
    
    // Parse word pairs
    const wordPairs = words.split('\n')
        .map(line => line.split(',').map(item => item.trim()))
        .filter(pair => pair.length >= 2 && pair[0] && pair[1]);
    
    if (wordPairs.length === 0) {
        previewArea.innerHTML = `
            <div style="padding: 20px; text-align: center; color: #666;">
                Please enter valid word pairs in the format: english, korean
            </div>
        `;
        return;
    }
    
    // Mask words based on test mode
    const maskedPairs = maskWordPairs(wordPairs, testMode, numLettersToHide);
    
    // Generate preview HTML
    const html = generatePreviewHTML(maskedPairs, title, layout);
    previewArea.innerHTML = html;
}

// Toggle visibility of number input based on test mode
function toggleNumLettersInput() {
    const modeSelect = document.getElementById('wordTestMode');
    const numGroup = document.getElementById('numLettersToHideGroup');
    
    if (modeSelect && numGroup) {
        const isHideRandomLetters = modeSelect.value === 'hide-random-letters';
        numGroup.style.display = isHideRandomLetters ? 'block' : 'none';
    }
}

// Load sample words
function loadSampleWords() {
    const sampleWords = [
        'apple, 사과',
        'book, 책',
        'cat, 고양이',
        'dog, 개',
        'elephant, 코끼리',
        'fish, 물고기',
        'guitar, 기타',
        'house, 집',
        'ice cream, 아이스크림',
        'jacket, 재킷'
    ].join('\n');
    
    const textarea = document.getElementById('wordTestWords');
    if (textarea) {
        textarea.value = sampleWords;
        updatePreview();
    }
}

// Clear words
function clearWords() {
    const textarea = document.getElementById('wordTestWords');
    if (textarea) {
        textarea.value = '';
        updatePreview();
    }
}

// Randomize words
function randomizeWords() {
    const textarea = document.getElementById('wordTestWords');
    if (!textarea || !textarea.value.trim()) return;
    
    const lines = textarea.value.trim().split('\n');
    const shuffled = lines.sort(() => Math.random() - 0.5);
    textarea.value = shuffled.join('\n');
    updatePreview();
}

// Print worksheet
function printWorksheet() {
    const wordsTextarea = document.getElementById('wordTestWords');
    const titleInput = document.getElementById('wordTestTitle');
    const layoutSelect = document.getElementById('wordTestLayout');
    const modeSelect = document.getElementById('wordTestMode');
    const numLettersInput = document.getElementById('numLettersToHide');
    
    if (!wordsTextarea || !wordsTextarea.value.trim()) {
        alert('Please enter some word pairs before printing.');
        return;
    }
    
    const words = wordsTextarea.value.trim();
    const title = titleInput ? titleInput.value.trim() || 'Word Test' : 'Word Test';
    const layout = layoutSelect ? layoutSelect.value : 'default';
    const testMode = modeSelect ? modeSelect.value : 'none';
    const numLettersToHide = numLettersInput ? parseInt(numLettersInput.value, 10) || 2 : 2;
    
    // Parse word pairs
    const wordPairs = words.split('\n')
        .map(line => line.split(',').map(item => item.trim()))
        .filter(pair => pair.length >= 2 && pair[0] && pair[1]);
    
    if (wordPairs.length === 0) {
        alert('Please enter valid word pairs in the format: english, korean');
        return;
    }
    
    // Mask words based on test mode
    const maskedPairs = maskWordPairs(wordPairs, testMode, numLettersToHide);
    
    // Generate complete worksheet HTML
    const worksheetHTML = generateWorksheetHTML(maskedPairs, title, layout);
    
    // Open in new window and print
    const printWindow = window.open('', '_blank');
    printWindow.document.write(worksheetHTML);
    printWindow.document.close();
    
    // Wait for content to load then print
    printWindow.onload = function() {
        printWindow.print();
    };
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Prevent any conflicting functions from other files
    if (window.updateWordTestPreview) {
        delete window.updateWordTestPreview;
    }
    
    // Set up event listeners
    const elements = [
        'wordTestWords',
        'wordTestTitle', 
        'wordTestLayout',
        'wordTestMode',
        'numLettersToHide'
    ];
    
    elements.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('input', updatePreview);
            element.addEventListener('change', updatePreview);
        }
    });
    
    // Special handling for test mode to show/hide number input
    const modeSelect = document.getElementById('wordTestMode');
    if (modeSelect) {
        modeSelect.addEventListener('change', function() {
            toggleNumLettersInput();
            updatePreview();
        });
    }
    
    // Set up button event listeners
    const printBtn = document.getElementById('printWorksheet');
    if (printBtn) {
        printBtn.addEventListener('click', printWorksheet);
    }
    
    // Initialize UI state
    toggleNumLettersInput();
    updatePreview();
});

// Make functions globally available
window.loadSampleWords = loadSampleWords;
window.clearWords = clearWords;
window.randomizeWords = randomizeWords;
