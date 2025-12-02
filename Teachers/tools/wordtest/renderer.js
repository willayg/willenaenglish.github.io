// renderer.js - Complete Worksheet Rendering Module

export async function generateWorksheetHTML(title, wordPairs, currentSettings, hideRandomLetters, renderImage, generateWorksheetHeader, getImageUrl, getPlaceholderImage) {
    const style = `
        font-family: ${currentSettings.font};
        font-size: ${currentSettings.fontSize}px;
        line-height: 1.5;
    `;
    
    const layout = currentSettings.layout;
    console.log('Generating worksheet with layout:', layout);
    
    // Apply test mode masking
    let testMode = currentSettings.testMode;
    let numLettersToHide = currentSettings.numLettersToHide || 1;
    let maskedPairs = wordPairs;
    if (testMode === 'hide-eng') {
        maskedPairs = wordPairs.map(pair => ({ eng: '', kor: pair.kor, _originalEng: pair.eng }));
    } else if (testMode === 'hide-kor') {
        maskedPairs = wordPairs.map(pair => ({ eng: pair.eng, kor: '', _originalEng: pair.eng }));
    } else if (testMode === 'hide-all') {
        maskedPairs = wordPairs.map(pair => ({ eng: '', kor: '', _originalEng: pair.eng }));
    } else if (testMode === 'hide-random-letters') {
        maskedPairs = wordPairs.map(pair => ({
            eng: hideRandomLetters(pair.eng, numLettersToHide),
            kor: pair.kor,
            _originalEng: pair.eng
        }));
    } else if (testMode === 'hide-random-lang') {
        maskedPairs = wordPairs.map(pair => {
            if (Math.random() < 0.5) {
                return { eng: '', kor: pair.kor, _originalEng: pair.eng };
            } else {
                return { eng: pair.eng, kor: '', _originalEng: pair.eng };
            }
        });
    } else {
        maskedPairs = wordPairs.map(pair => ({ eng: pair.eng, kor: pair.kor, _originalEng: pair.eng }));
    }

    // --- Duplicate detection for preview highlighting ---
    const engCounts = {};
    const korCounts = {};
    wordPairs.forEach(pair => {
        const eng = (pair.eng || '').trim().toLowerCase();
        const kor = (pair.kor || '').trim().toLowerCase();
        if (eng) engCounts[eng] = (engCounts[eng] || 0) + 1;
        if (kor) korCounts[kor] = (korCounts[kor] || 0) + 1;
    });
    
    function isDuplicateEng(eng) {
        return eng && engCounts[eng.trim().toLowerCase()] > 1;
    }
    function isDuplicateKor(kor) {
        return kor && korCounts[kor.trim().toLowerCase()] > 1;
    }
    
    function highlightCell(content, isDup) {
        const overlay = isDup ? '<span class="dup-overlay-screen" style="position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(255,140,0,0.25);pointer-events:none;z-index:1;"></span>' : '';
        return `<span style="position:relative;display:inline-block;width:100%;">${overlay}<span style="position:relative;z-index:2;">${content}</span></span>`;
    }

    const printStyle = `<style>
        @media print {
            .dup-overlay-screen { display: none !important; }
            .worksheet-preview th,
            .worksheet-preview td {
                text-align: left !important;
            }
        }
    </style>`;

    // --- BASIC TABLE LAYOUT ---
    if (layout === "default") {
        const tablesHtml = `
            <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
                <thead>
                    <tr>
                        <th style="width:10%;padding:8px;border-bottom:2px solid #333;text-align:left;">#</th>
                        <th style="width:45%;padding:8px;border-bottom:2px solid #333;text-align:left;">English</th>
                        <th style="width:45%;padding:8px;border-bottom:2px solid #333;text-align:left;">Korean</th>
                    </tr>
                </thead>
                <tbody>
                    ${maskedPairs.map((pair, i) => {
                        const isDupEng = isDuplicateEng(wordPairs[i]?.eng);
                        const isDupKor = isDuplicateKor(wordPairs[i]?.kor);
                        return `
                        <tr>
                            <td style="padding:8px;border-bottom:1px solid #ddd;text-align:left;">${i + 1}</td>
                            <td class="word-cell" data-index="${i}" data-lang="eng" style="position:relative;padding:8px;border-bottom:1px solid #ddd;cursor:pointer;text-align:left;">${highlightCell(pair.eng || '______', isDupEng)}</td>
                            <td class="word-cell" data-index="${i}" data-lang="kor" style="position:relative;padding:8px;border-bottom:1px solid #ddd;cursor:pointer;text-align:left;">${highlightCell(pair.kor || '______', isDupKor)}</td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
        return `
            <div class="worksheet-preview" style="${style}">
                ${await generateWorksheetHeader(title)}
                ${printStyle}
                ${tablesHtml}
            </div>
        `;
    }
    
    // --- TWO LISTS LAYOUT (SIDE BY SIDE) ---
    if (layout === "4col") {
        const half = Math.ceil(maskedPairs.length / 2);
        const left = maskedPairs.slice(0, half);
        const right = maskedPairs.slice(half);
        while (right.length < left.length) {
            right.push({ eng: "", kor: "" });
        }
        const tableHtml = `
            <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
                <colgroup>
                    <col style="width:8%;"><col style="width:23%;"><col style="width:23%;"><col style="width:3%;">
                    <col style="width:8%;"><col style="width:23%;"><col style="width:23%;">
                </colgroup>
                <thead>
                    <tr>
                        <th style="padding:8px;border-bottom:2px solid #333;text-align:center;">#</th>
                        <th style="padding:8px;border-bottom:2px solid #333;text-align:center;">English</th>
                        <th style="padding:8px;border-bottom:2px solid #333;text-align:center;">Korean</th>
                        <th style="background:transparent;border:none;padding:0;"></th>
                        <th style="padding:8px;border-bottom:2px solid #333;text-align:center;">#</th>
                        <th style="padding:8px;border-bottom:2px solid #333;text-align:center;">English</th>
                        <th style="padding:8px;border-bottom:2px solid #333;text-align:center;">Korean</th>
                    </tr>
                </thead>
                <tbody>
                    ${left.map((pair, i) => {
                        const isDupEngL = isDuplicateEng(left[i]?.eng);
                        const isDupKorL = isDuplicateKor(left[i]?.kor);
                        const isDupEngR = isDuplicateEng(right[i]?.eng);
                        const isDupKorR = isDuplicateKor(right[i]?.kor);
                        return `
                        <tr>
                            <td style="padding:8px;border-bottom:1px solid #ddd;text-align:center;white-space:nowrap;">${i + 1}</td>
                            <td class="word-cell" data-index="${i}" data-lang="eng" style="position:relative;padding:8px;border-bottom:1px solid #ddd;text-align:center;cursor:pointer;">${highlightCell(left[i]?.eng || '______', isDupEngL)}</td>
                            <td class="word-cell" data-index="${i}" data-lang="kor" style="position:relative;padding:8px;border-bottom:1px solid #ddd;text-align:center;cursor:pointer;">${highlightCell(left[i]?.kor || '______', isDupKorL)}</td>
                            <td style="border-left:2px solid #e0e0e0;background:transparent;border-bottom:none;padding:0;"></td>
                            <td style="padding:8px;border-bottom:1px solid #ddd;text-align:center;white-space:nowrap;">${i + 1 + half <= maskedPairs.length ? i + 1 + half : ""}</td>
                            <td class="word-cell" data-index="${i + half}" data-lang="eng" style="position:relative;padding:8px;border-bottom:1px solid #ddd;text-align:center;cursor:pointer;">${highlightCell(right[i]?.eng || '______', isDupEngR)}</td>
                            <td class="word-cell" data-index="${i + half}" data-lang="kor" style="position:relative;padding:8px;border-bottom:1px solid #ddd;text-align:center;cursor:pointer;">${highlightCell(right[i]?.kor || '______', isDupKorR)}</td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
        return `
            <div class="worksheet-preview" style="${style}">
                ${await generateWorksheetHeader(title)}
                ${printStyle}
                ${tableHtml}
            </div>
        `;
    }
    
    // --- PICTURE LIST LAYOUT ---
    if (layout === "picture-list") {
        const imagePromises = maskedPairs.map(async (pair, i) => {
            const imageUrl = await getImageUrl(pair._originalEng || pair.eng, i, false, currentSettings);
            return {
                ...pair,
                imageUrl,
                index: i
            };
        });
        const pairsWithImages = await Promise.all(imagePromises);
        const rowHeight = Math.max(currentSettings.imageSize + currentSettings.imageGap, 100);
        const cellPadding = Math.max(currentSettings.imageGap / 2, 8);
        
        const tablesHtml = `
            <table style="width:100%;border-collapse:collapse;table-layout:fixed;min-width:850px;">
                <colgroup>
                    <col style="width:8%;min-width:60px;">
                    <col style="width:30%;min-width:200px;">
                    <col style="width:31%;min-width:220px;">
                    <col style="width:31%;min-width:220px;">
                </colgroup>
                <thead>
                    <tr>
                        <th style="padding:12px 8px;border-bottom:2px solid #333;font-size:1.1em;text-align:center;font-weight:bold;">#</th>
                        <th style="padding:12px 8px;border-bottom:2px solid #333;font-size:1.1em;text-align:center;font-weight:bold;">Picture</th>
                        <th style="padding:12px 8px;border-bottom:2px solid #333;font-size:1.1em;text-align:center;font-weight:bold;">English</th>
                        <th style="padding:12px 8px;border-bottom:2px solid #333;font-size:1.1em;text-align:center;font-weight:bold;">Korean</th>
                    </tr>
                </thead>
                <tbody>
                    ${pairsWithImages.map((pair, i) => {
                        const isDupEng = isDuplicateEng(wordPairs[i]?.eng);
                        const isDupKor = isDuplicateKor(wordPairs[i]?.kor);
                        return `
                        <tr style="min-height:${rowHeight}px;">
                            <td style="padding:${cellPadding}px 8px;border-bottom:1px solid #ddd;text-align:center;font-size:1.1em;font-weight:500;">${i + 1}</td>
                            <td style="padding:${cellPadding}px 8px;border-bottom:1px solid #ddd;text-align:center;">
                                <div class="image-container" style="display:flex;align-items:center;justify-content:center;margin:0 auto;position:relative;">
                                    ${renderImage(pair.imageUrl, i, pair._originalEng || pair.eng, pair.kor, currentSettings)}
                                </div>
                            </td>
                            <td class="word-cell" data-index="${i}" data-lang="eng" style="position:relative;padding:${cellPadding}px 12px;border-bottom:1px solid #ddd;font-size:1.1em;text-align:center;font-weight:500;cursor:pointer;">${highlightCell(pair.eng || '______', isDupEng)}</td>
                            <td class="word-cell" data-index="${i}" data-lang="kor" style="position:relative;padding:${cellPadding}px 12px;border-bottom:1px solid #ddd;font-size:1.1em;text-align:center;font-weight:500;cursor:pointer;">${highlightCell(pair.kor || '______', isDupKor)}</td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
        
        return `
            <div class="worksheet-preview" style="${style}">
                ${await generateWorksheetHeader(title)}
                ${printStyle}
                ${tablesHtml}
            </div>
        `;
    }
    
    // --- PICTURE CARDS LAYOUT (5col-images) ---
    if (layout === "5col-images") {
        const pictureCard5Settings = {
            ...currentSettings
        };
        
        const imagePromises = maskedPairs.map(async (pair, i) => {
            const imageUrl = await getImageUrl(pair._originalEng || pair.eng, i, false, pictureCard5Settings);
            return { ...pair, imageUrl, index: i };
        });
        const pairsWithImages = await Promise.all(imagePromises);
        
    const cardWidth = 160;
    const cardHeight = 200;
    const baseGap = Math.max(currentSettings.imageGap, 10);
    const dynamicPadding = Math.max(15, baseGap / 2);
        
        const gridHtml = `
            <div class="picture-cards-grid-5col" style="display: grid; grid-template-columns: repeat(5, 1fr); row-gap: ${baseGap}px; column-gap: ${Math.max(Math.round(baseGap / 2), 8)}px; padding: ${dynamicPadding}px; width: 100%; max-width: 900px; margin: 0 auto; place-items: center;">
                ${pairsWithImages.map((pair, i) => {
                    const showEng = testMode === 'hide-eng' ? '______' : (pair.eng || pair._originalEng || '______');
                    return `
                    <div class="picture-card-5col" style="
                        padding: 10px;
                        border: 2px solid #e2e8f0;
                        border-radius: 8px;
                        background: white;
                        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                        width: ${cardWidth}px;
                        height: ${cardHeight}px;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        gap: 0;
                    ">
                        <div class="image-container" style="
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            width: 100%;
                            height: 110px;
                            min-height: 80px;
                            max-height: 120px;
                            margin-bottom: 8px;
                            flex-shrink: 0;
                        ">
                            ${renderImage(pair.imageUrl, pair.index, pair._originalEng || pair.eng, pair.kor, pictureCard5Settings)}
                        </div>
                        <div style="width: 100%; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: flex-start;">
                            <div style="font-weight: bold; font-size: 0.95em; margin-bottom: 2px; word-wrap: break-word;">${showEng}</div>
                            <div style="color: #555; font-size: 0.85em; word-wrap: break-word;">${pair.kor || '______'}</div>
                        </div>
                    </div>
                    `;
                }).join('')}
            </div>
        `;
        
        return `
            <div class="worksheet-preview" style="${style}">
                ${await generateWorksheetHeader(title)}
                ${gridHtml}
            </div>
        `;
    }
    
    // --- PICTURE LIST (2 COLUMN) LAYOUT ---
    if (layout === "picture-list-2col") {
        const pictureList2ColSettings = {
            ...currentSettings
        };
        const imagePromises = maskedPairs.map(async (pair, i) => {
            const imageUrl = await getImageUrl(pair._originalEng || pair.eng, i, false, pictureList2ColSettings);
            return { ...pair, imageUrl, index: i };
        });
        const pairsWithImages = await Promise.all(imagePromises);
        // Build a single table with two logical columns of 8 rows each to improve print pagination
        const rowsPerCol = 8;
        const leftCol = pairsWithImages.slice(0, rowsPerCol);
        const rightCol = pairsWithImages.slice(rowsPerCol, rowsPerCol * 2);
        const tableHtml = `
            <table style="width:100%;border-collapse:collapse;table-layout:fixed;min-width:950px;">
                <colgroup>
                    <col style="width:6%"><col style="width:13%"><col style="width:18%"><col style="width:18%"><col style="width:2%">
                    <col style="width:6%"><col style="width:13%"><col style="width:18%"><col style="width:18%">
                </colgroup>
                <thead>
                    <tr>
                        <th style="padding:10px;border-bottom:2px solid #333;text-align:center;font-weight:700;">#</th>
                        <th style="padding:10px;border-bottom:2px solid #333;text-align:center;font-weight:700;">Picture</th>
                        <th style="padding:10px;border-bottom:2px solid #333;text-align:center;font-weight:700;">English</th>
                        <th style="padding:10px;border-bottom:2px solid #333;text-align:center;font-weight:700;">Korean</th>
                        <th style="border:none;background:transparent;"></th>
                        <th style="padding:10px;border-bottom:2px solid #333;text-align:center;font-weight:700;">#</th>
                        <th style="padding:10px;border-bottom:2px solid #333;text-align:center;font-weight:700;">Picture</th>
                        <th style="padding:10px;border-bottom:2px solid #333;text-align:center;font-weight:700;">English</th>
                        <th style="padding:10px;border-bottom:2px solid #333;text-align:center;font-weight:700;">Korean</th>
                    </tr>
                </thead>
                <tbody>
                    ${Array.from({ length: rowsPerCol }).map((_, i) => {
                        const L = leftCol[i];
                        const R = rightCol[i];
                        const lIdx = i;
                        const rIdx = rowsPerCol + i;
                        return `
                        <tr>
                            <td style="padding:8px;border-bottom:1px solid #ddd;text-align:center;">${L ? (lIdx + 1) : ''}</td>
                            <td style="padding:8px;border-bottom:1px solid #ddd;text-align:center;">
                                ${L ? `<div class="image-container" style="display:flex;align-items:center;justify-content:center;margin:0 auto;position:relative;">${renderImage(L.imageUrl, L.index, L._originalEng || L.eng, L.kor, pictureList2ColSettings)}</div>` : ''}
                            </td>
                            <td class="word-cell" data-index="${lIdx}" data-lang="eng" style="position:relative;padding:8px 10px;border-bottom:1px solid #ddd;text-align:center;cursor:pointer;">${L ? (L.eng || '______') : ''}</td>
                            <td class="word-cell" data-index="${lIdx}" data-lang="kor" style="position:relative;padding:8px 10px;border-bottom:1px solid #ddd;text-align:center;cursor:pointer;">${L ? (L.kor || '______') : ''}</td>
                            <td style="border-left:2px solid #e0e0e0;border-bottom:none;"></td>
                            <td style="padding:8px;border-bottom:1px solid #ddd;text-align:center;">${R ? (rIdx + 1) : ''}</td>
                            <td style="padding:8px;border-bottom:1px solid #ddd;text-align:center;">
                                ${R ? `<div class="image-container" style="display:flex;align-items:center;justify-content:center;margin:0 auto;position:relative;">${renderImage(R.imageUrl, R.index, R._originalEng || R.eng, R.kor, pictureList2ColSettings)}</div>` : ''}
                            </td>
                            <td class="word-cell" data-index="${rIdx}" data-lang="eng" style="position:relative;padding:8px 10px;border-bottom:1px solid #ddd;text-align:center;cursor:pointer;">${R ? (R.eng || '______') : ''}</td>
                            <td class="word-cell" data-index="${rIdx}" data-lang="kor" style="position:relative;padding:8px 10px;border-bottom:1px solid #ddd;text-align:center;cursor:pointer;">${R ? (R.kor || '______') : ''}</td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        `;
        return `
            <div class="worksheet-preview" style="${style}">
                ${await generateWorksheetHeader(title)}
                ${printStyle}
                ${tableHtml}
            </div>
        `;
    }
    
    // --- PICTURE QUIZ LAYOUT ---
    if (layout === "picture-quiz") {
        const pictureQuizSettings = {
            ...currentSettings
        };
        const imagePromises = maskedPairs.map(async (pair, i) => {
            const imageUrl = await getImageUrl(pair._originalEng || pair.eng, i, false, pictureQuizSettings);
            return { ...pair, imageUrl, index: i };
        });
        const pairsWithImages = await Promise.all(imagePromises);
        // Word choices row
        const wordChoices = pairsWithImages.map(pair => testMode === 'hide-eng' ? '______' : (pair.eng || pair._originalEng || '______')).join(' ');
        // Grid: 3 per row
        const perRow = 3;
        const rows = [];
        for (let i = 0; i < pairsWithImages.length; i += perRow) {
            rows.push(pairsWithImages.slice(i, i + perRow));
        }
    const chip = (text) => `<span style="display:inline-block;margin:4px 6px 4px 0;padding:4px 10px;border-radius:6px;background:#f7fafc;border:1px solid #d7dbe3;color:#2e2b3f;font-weight:600;font-size:0.95em;text-align:center;white-space:normal;word-break:break-word;overflow-wrap:anywhere;max-width:140px;line-height:1.2;">${text}</span>`;
        const underlineCss = `
            <style>
            .quiz-underline { border-bottom: 2px solid #222; height: 22px; width: 140px; }
            @media print { .quiz-underline { border-bottom-color: #000; } }
            </style>
        `;
    const rowGap = Math.max(currentSettings.imageGap, 16);
    const colGap = Math.max(Math.round(currentSettings.imageGap * 0.75), 20);
    const quizHtml = `
            <div class="picture-quiz" style="max-width: 1000px; margin: 0 auto; padding: 20px 24px 28px;">
                ${underlineCss}
                <div style="display:flex;justify-content:center;margin:6px 0 22px;">
                    <div style="min-height:36px;max-width:720px;width:100%;border:1.5px solid #d7dbe3;border-radius:6px;background:#fff;padding:6px 8px;display:flex;flex-wrap:wrap;justify-content:center;align-items:center;align-content:flex-start;">${pairsWithImages.map(p => chip(testMode === 'hide-eng' ? '______' : (p.eng || p._originalEng || '______'))).join('')}</div>
                </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);column-gap:${colGap}px;row-gap:${rowGap}px;">
                    ${pairsWithImages.map(pair => `
                        <div style="display:flex;flex-direction:column;align-items:center;justify-content:flex-start;">
                            <div style="margin-bottom:12px;">${renderImage(pair.imageUrl, pair.index, pair._originalEng || pair.eng, pair.kor, pictureQuizSettings)}</div>
                            <div class="quiz-underline"></div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        return `
            <div class="worksheet-preview" style="${style}">
                ${await generateWorksheetHeader(title)}
                ${printStyle}
                ${quizHtml}
            </div>
        `;
    }
    
    // --- PICTURE QUIZ (5 COLUMN) LAYOUT ---
    if (layout === "picture-quiz-5col") {
        const pictureQuiz5ColSettings = {
            ...currentSettings
        };
        const imagePromises = maskedPairs.map(async (pair, i) => {
            const imageUrl = await getImageUrl(pair._originalEng || pair.eng, i, false, pictureQuiz5ColSettings);
            return { ...pair, imageUrl, index: i };
        });
        const pairsWithImages = await Promise.all(imagePromises);
        // Word choices row
        const wordChoices = pairsWithImages.map(pair => testMode === 'hide-eng' ? '______' : (pair.eng || pair._originalEng || '______')).join(' ');
        // Grid: 5 per row
        const perRow = 5;
        const rows = [];
        for (let i = 0; i < pairsWithImages.length; i += perRow) {
            rows.push(pairsWithImages.slice(i, i + perRow));
        }
    const chip5 = (text) => `<span style="display:inline-block;margin:4px 6px 4px 0;padding:4px 10px;border-radius:6px;background:#f7fafc;border:1px solid #d7dbe3;color:#2e2b3f;font-weight:600;font-size:0.95em;text-align:center;white-space:normal;word-break:break-word;overflow-wrap:anywhere;max-width:120px;line-height:1.2;">${text}</span>`;
        const underlineCss5 = `
            <style>
            .quiz-underline-5col { border-bottom: 2px solid #222; height: 20px; width: 110px; }
            @media print { .quiz-underline-5col { border-bottom-color: #000; } }
            </style>
        `;
    const rowGap5 = Math.max(currentSettings.imageGap, 16);
    const colGap5 = Math.max(Math.round(currentSettings.imageGap * 0.6), 16);
    const quiz5ColHtml = `
            <div class="picture-quiz-5col" style="max-width: 1100px; margin: 0 auto; padding: 20px 24px 24px;">
                ${underlineCss5}
                <div style="display:flex;justify-content:center;margin:6px 0 22px;">
                    <div style="min-height:36px;max-width:900px;width:100%;border:1.5px solid #d7dbe3;border-radius:6px;background:#fff;padding:6px 8px;display:flex;flex-wrap:wrap;justify-content:center;align-items:center;align-content:flex-start;">${pairsWithImages.map(p => chip5(testMode === 'hide-eng' ? '______' : (p.eng || p._originalEng || '______'))).join('')}</div>
                </div>
        <div style="display:grid;grid-template-columns:repeat(5,1fr);column-gap:${colGap5}px;row-gap:${rowGap5}px;">
                    ${pairsWithImages.map(pair => `
                        <div style="display:flex;flex-direction:column;align-items:center;justify-content:flex-start;">
                            <div style="margin-bottom:10px;">${renderImage(pair.imageUrl, pair.index, pair._originalEng || pair.eng, pair.kor, pictureQuiz5ColSettings)}</div>
                            <div class="quiz-underline-5col"></div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        return `
            <div class="worksheet-preview" style="${style}">
                ${await generateWorksheetHeader(title)}
                ${printStyle}
                ${quiz5ColHtml}
            </div>
        `;
    }
    
    // --- PICTURE MATCHING LAYOUT ---
    if (layout === "picture-matching") {
        // Match the classic (old) layout closely: images on the left, English on the right, circles for drawing lines
        const pictureMatchingSettings = {
            ...currentSettings
        };
        const limitedWordPairs = maskedPairs.slice(0, 8);
        const imagePromises = limitedWordPairs.map(async (pair, i) => {
            const imageUrl = await getImageUrl(pair._originalEng || pair.eng, i, false, pictureMatchingSettings);
            return { ...pair, imageUrl, index: i };
        });
        const pairsWithImages = await Promise.all(imagePromises);
        const shuffledWords = [...limitedWordPairs].sort(() => Math.random() - 0.5);
        const itemHeight = Math.max(currentSettings.imageSize + 20, 60);
        const actualGap = currentSettings.imageGap;
        const totalHeight = pairsWithImages.length * itemHeight + (pairsWithImages.length - 1) * actualGap;
        const tableHtml = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; max-width: 800px; margin: 0 auto; padding: 20px; min-width: 700px;">
                <div style="width: 35%; display: flex; flex-direction: column; justify-content: space-between; min-height: ${totalHeight}px; row-gap: ${actualGap}px;">
                    ${pairsWithImages.map((pair, i) => `
                        <div style="display: flex; align-items: center; justify-content: flex-end; gap: 15px; height: ${itemHeight}px;">
                            <div class="image-container" style="display: flex; align-items: center; position: relative;">
                                ${renderImage(pair.imageUrl, i, pair._originalEng || pair.eng, pair.kor, pictureMatchingSettings)}
                            </div>
                            <div style="width: 16px; height: 16px; border: 3px solid #333; border-radius: 50%; background: white; flex-shrink: 0;"></div>
                        </div>
                    `).join('')}
                </div>
                <div style="width: 30%; min-height: ${totalHeight}px; position: relative; display: flex; align-items: center; justify-content: center;">
                    <div style="color: #ccc; font-size: 14px; text-align: center; font-style: italic;">Draw lines<br>to connect</div>
                </div>
                <div style="width: 35%; display: flex; flex-direction: column; justify-content: space-between; min-height: ${totalHeight}px; row-gap: ${actualGap}px;">
                    ${shuffledWords.map((pair, i) => `
                        <div style="display: flex; align-items: center; justify-content: flex-start; gap: 15px; height: ${itemHeight}px;">
                            <div style="width: 16px; height: 16px; border: 3px solid #333; border-radius: 50%; background: white; flex-shrink: 0;"></div>
                            <div style="padding: 12px 16px; background: #f8f9fa; border: 2px solid #e9ecef; border-radius: 8px; font-weight: 600; display: flex; align-items: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1); flex: 1;">
                                ${pair.eng || '______'}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        return `
            <div class="worksheet-preview" style="${style}">
                ${await generateWorksheetHeader(title)}
                ${tableHtml}
            </div>
        `;
    }
    
    // --- ENGLISH-KOREAN MATCHING LAYOUT ---
    if (layout === "eng-kor-matching") {
        // Match the classic (old) layout closely: English left, Korean right, with a center column for instructions and circles for drawing lines
        const limitedWordPairs = maskedPairs.slice(0, 10);
        const shuffledKorean = [...limitedWordPairs].sort(() => Math.random() - 0.5);
        const itemHeight = Math.max(50, currentSettings.imageGap + 30);
        const actualGap = currentSettings.imageGap;
        const totalHeight = limitedWordPairs.length * itemHeight + (limitedWordPairs.length - 1) * actualGap;
        const tableHtml = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; max-width: 800px; margin: 0 auto; padding: 20px; min-width: 700px;">
                <div style="width: 40%; display: flex; flex-direction: column; min-height: ${totalHeight}px; row-gap: ${actualGap}px;">
                    ${limitedWordPairs.map((pair, i) => `
                        <div style="display: flex; align-items: center; justify-content: flex-end; gap: 15px; height: ${itemHeight}px;${i > 0 ? ` margin-top: ${actualGap}px;` : ''}">
                            <div style="padding: ${Math.max(10, actualGap/2)}px 15px; background: #f8f9fa; border: 2px solid #e9ecef; border-radius: 8px; font-weight: 600; display: flex; align-items: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1); flex: 1;">
                                ${pair.eng || pair._originalEng || 'word'}
                            </div>
                            <div style="width: 16px; height: 16px; border: 3px solid #333; border-radius: 50%; background: white; flex-shrink: 0;"></div>
                        </div>
                    `).join('')}
                </div>
                <div style="width: 20%; min-height: ${totalHeight}px; position: relative; display: flex; align-items: center; justify-content: center;">
                    <div style="color: #ccc; font-size: 14px; text-align: center; font-style: italic;">Draw lines<br>to connect</div>
                </div>
                <div style="width: 40%; display: flex; flex-direction: column; min-height: ${totalHeight}px; row-gap: ${actualGap}px;">
                    ${shuffledKorean.map((pair, i) => `
                        <div style="display: flex; align-items: center; justify-content: flex-start; gap: 15px; height: ${itemHeight}px;${i > 0 ? ` margin-top: ${actualGap}px;` : ''}">
                            <div style="width: 16px; height: 16px; border: 3px solid #333; border-radius: 50%; background: white; flex-shrink: 0;"></div>
                            <div style="padding: ${Math.max(10, actualGap/2)}px 15px; background: #fff5f5; border: 2px solid #fed7d7; border-radius: 8px; font-weight: 600; display: flex; align-items: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1); flex: 1;">
                                ${pair.kor || 'word'}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        return `
            <div class="worksheet-preview" style="${style}">
                ${await generateWorksheetHeader(title)}
                ${tableHtml}
            </div>
        `;
    }
    
    // --- PICTURE CARDS LAYOUT (6col-images) ---
    if (layout === "6col-images") {
        const pictureCard6Settings = {
            ...currentSettings
        };
        const imagePromises = maskedPairs.map(async (pair, i) => {
            const imageUrl = await getImageUrl(pair._originalEng || pair.eng, i, false, pictureCard6Settings);
            return { ...pair, imageUrl, index: i };
        });
        const pairsWithImages = await Promise.all(imagePromises);
        const cardWidth = 140;
        const cardHeight = 180;
        const baseGap = Math.max(currentSettings.imageGap, 12);
        const dynamicPadding = Math.max(12, baseGap / 2);
        const gridHtml = `
            <div class="picture-cards-grid-6col" style="display: grid; grid-template-columns: repeat(6, 1fr); row-gap: ${baseGap}px; column-gap: ${Math.max(Math.round(baseGap / 2), 8)}px; padding: ${dynamicPadding}px; width: 100%; max-width: 1200px; margin: 0 auto; place-items: center;">
                ${pairsWithImages.map((pair, i) => {
                    const showEng = testMode === 'hide-eng' ? '______' : (pair.eng || pair._originalEng || '______');
                    return `
                    <div class="picture-card-6col" style="
                        padding: 8px;
                        border: 2px solid #e2e8f0;
                        border-radius: 8px;
                        background: white;
                        box-shadow: 0 1px 3px rgba(0,0,0,0.08);
                        width: ${cardWidth}px;
                        height: ${cardHeight}px;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        gap: 0;
                    ">
                        <div class="image-container" style="
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            width: 100%;
                            height: 90px;
                            min-height: 60px;
                            max-height: 100px;
                            margin-bottom: 6px;
                            flex-shrink: 0;
                        ">
                            ${renderImage(pair.imageUrl, pair.index, pair._originalEng || pair.eng, pair.kor, pictureCard6Settings)}
                        </div>
                        <div style="width: 100%; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: flex-start;">
                            <div style="font-weight: bold; font-size: 0.92em; margin-bottom: 2px; word-wrap: break-word;">${showEng}</div>
                            <div style="color: #555; font-size: 0.82em; word-wrap: break-word;">${pair.kor || '______'}</div>
                        </div>
                    </div>
                    `;
                }).join('')}
            </div>
        `;
        return `
            <div class="worksheet-preview" style="${style}">
                ${await generateWorksheetHeader(title)}
                ${printStyle}
                ${gridHtml}
            </div>
        `;
    }
    
    // For all other layouts, return a simple grid layout for now
    // This maintains functionality while being manageable
    return `
        <div class="worksheet-preview" style="${style}">
            ${await generateWorksheetHeader(title)}
            <div class="word-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); row-gap: ${currentSettings.imageGap}px; column-gap: 15px;">
                ${maskedPairs.map((pair, index) => `
                    <div class="word-card" style="
                        padding: 10px;
                        border: 1px solid #ccc;
                        border-radius: 8px;
                        text-align: center;
                        background: white;
                        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                    ">
                        <div style="font-weight: bold; margin-bottom: 5px;">${pair.eng || '______'}</div>
                        <div style="color: #666; font-size: 0.9em;">${pair.kor || '______'}</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

export function waitForPreviewImagesToLoad(timeout = 5000) {
    return new Promise((resolve) => {
        const previewArea = document.getElementById('previewArea');
        if (!previewArea) return resolve();
        const images = previewArea.querySelectorAll('img');
        if (images.length === 0) return resolve();
        let loaded = 0;
        let done = false;
        function checkDone() {
            if (!done && loaded >= images.length) {
                done = true;
                resolve();
            }
        }
        images.forEach((img) => {
            if (img.complete && img.naturalWidth !== 0) {
                loaded++;
                checkDone();
            } else {
                img.addEventListener('load', () => {
                    loaded++;
                    checkDone();
                });
                img.addEventListener('error', () => {
                    loaded++;
                    checkDone();
                });
            }
        });
        setTimeout(() => {
            if (!done) resolve();
        }, timeout);
    });
}
