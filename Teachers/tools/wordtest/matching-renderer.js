// Paginated matching layouts for Word Builder.
// Kept separate so the feature is easy to disable or roll back.

function chunk(items, size) {
  const pages = [];
  for (let i = 0; i < items.length; i += size) pages.push(items.slice(i, i + size));
  return pages;
}

function shuffled(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pageCss() {
  return `<style>
    .matching-pages { display:flex; flex-direction:column; gap:24px; align-items:center; }
    .matching-page {
      width:210mm;
      min-height:297mm;
      box-sizing:border-box;
      padding:12.7mm;
      background:#fff;
      box-shadow:0 4px 18px rgba(0,0,0,.12);
      break-after:page;
      page-break-after:always;
      overflow:hidden;
    }
    .matching-page:last-child { break-after:auto; page-break-after:auto; }
    .matching-page-label { text-align:right; color:#718096; font-size:11px; margin-top:-2px; margin-bottom:8px; }
    .matching-board { display:flex; justify-content:space-between; align-items:flex-start; width:100%; margin:0 auto; }
    .matching-column { display:flex; flex-direction:column; }
    .matching-row { display:flex; align-items:center; }
    .matching-dot { width:14px; height:14px; border:3px solid #333; border-radius:50%; background:#fff; flex:0 0 auto; }
    .matching-card { border:2px solid #e2e8f0; border-radius:8px; box-shadow:0 1px 3px rgba(0,0,0,.08); display:flex; align-items:center; flex:1; }
    .matching-centre { display:flex; align-items:center; justify-content:center; color:#b8c0cc; font-size:13px; text-align:center; font-style:italic; }
    @media screen and (max-width:900px) {
      .matching-pages { align-items:flex-start; gap:14px; }
      .matching-page { transform-origin:top left; box-shadow:none; }
    }
    @media print {
      .matching-pages { display:block; }
      .matching-page { width:100%; min-height:0; padding:0; margin:0; box-shadow:none; overflow:visible; }
      .matching-page-label { color:#666; }
    }
  </style>`;
}

async function renderPicturePage(pagePairs, pageIndex, pageCount, settings, renderImage, getImageUrl, generateHeader, title, globalOffset) {
  const withImages = await Promise.all(pagePairs.map(async (pair, localIndex) => {
    const globalIndex = globalOffset + localIndex;
    const imageUrl = await getImageUrl(pair._originalEng || pair.eng, globalIndex, false, settings);
    return { ...pair, imageUrl, globalIndex };
  }));
  const words = shuffled(withImages);
  const gap = Math.max(6, Math.min(settings.imageGap || 10, 18));
  const itemHeight = Math.max((settings.imageSize || 70) + 12, 70);
  const totalHeight = withImages.length * itemHeight + Math.max(0, withImages.length - 1) * gap;

  return `<section class="matching-page picture-matching-page">
    ${await generateHeader(title)}
    <div class="matching-page-label">Page ${pageIndex + 1} of ${pageCount}</div>
    <div class="matching-board" style="min-width:700px;">
      <div class="matching-column" style="width:36%;min-height:${totalHeight}px;gap:${gap}px;">
        ${withImages.map(pair => `<div class="matching-row" style="justify-content:flex-end;gap:12px;height:${itemHeight}px;">
          <div class="image-container" style="display:flex;align-items:center;position:relative;">${renderImage(pair.imageUrl, pair.globalIndex, pair._originalEng || pair.eng, pair.kor, settings)}</div>
          <div class="matching-dot"></div>
        </div>`).join('')}
      </div>
      <div class="matching-centre" style="width:26%;min-height:${totalHeight}px;">Draw lines<br>to connect</div>
      <div class="matching-column" style="width:38%;min-height:${totalHeight}px;gap:${gap}px;">
        ${words.map(pair => `<div class="matching-row" style="justify-content:flex-start;gap:12px;height:${itemHeight}px;">
          <div class="matching-dot"></div>
          <div class="matching-card word-cell" data-index="${pair.globalIndex}" data-lang="eng" style="padding:10px 14px;background:#f8f9fa;font-weight:600;cursor:pointer;">${pair.eng || '______'}</div>
        </div>`).join('')}
      </div>
    </div>
  </section>`;
}

async function renderLanguagePage(pagePairs, pageIndex, pageCount, settings, generateHeader, title, globalOffset) {
  const indexed = pagePairs.map((pair, localIndex) => ({ ...pair, globalIndex: globalOffset + localIndex }));
  const korean = shuffled(indexed);
  const gap = Math.max(5, Math.min(settings.imageGap || 10, 16));
  const itemHeight = Math.max(44, 34 + gap);
  const totalHeight = indexed.length * itemHeight + Math.max(0, indexed.length - 1) * gap;
  const pad = Math.max(8, Math.round(gap / 2));

  return `<section class="matching-page eng-kor-matching-page">
    ${await generateHeader(title)}
    <div class="matching-page-label">Page ${pageIndex + 1} of ${pageCount}</div>
    <div class="matching-board" style="min-width:700px;">
      <div class="matching-column" style="width:40%;min-height:${totalHeight}px;gap:${gap}px;">
        ${indexed.map(pair => `<div class="matching-row" style="justify-content:flex-end;gap:12px;height:${itemHeight}px;">
          <div class="matching-card word-cell" data-index="${pair.globalIndex}" data-lang="eng" style="padding:${pad}px 14px;background:#f8f9fa;font-weight:600;cursor:pointer;">${pair.eng || pair._originalEng || 'word'}</div>
          <div class="matching-dot"></div>
        </div>`).join('')}
      </div>
      <div class="matching-centre" style="width:20%;min-height:${totalHeight}px;">Draw lines<br>to connect</div>
      <div class="matching-column" style="width:40%;min-height:${totalHeight}px;gap:${gap}px;">
        ${korean.map(pair => `<div class="matching-row" style="justify-content:flex-start;gap:12px;height:${itemHeight}px;">
          <div class="matching-dot"></div>
          <div class="matching-card word-cell" data-index="${pair.globalIndex}" data-lang="kor" style="padding:${pad}px 14px;background:#fff5f5;border-color:#fed7d7;font-weight:600;cursor:pointer;">${pair.kor || 'word'}</div>
        </div>`).join('')}
      </div>
    </div>
  </section>`;
}

export async function generateMatchingWorksheetHTML({ layout, title, wordPairs, settings, renderImage, getImageUrl, generateHeader }) {
  const perPage = layout === 'picture-matching' ? 8 : 10;
  const pages = chunk(wordPairs, perPage);
  const rendered = [];

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const pagePairs = pages[pageIndex];
    const offset = pageIndex * perPage;
    if (layout === 'picture-matching') {
      rendered.push(await renderPicturePage(pagePairs, pageIndex, pages.length, settings, renderImage, getImageUrl, generateHeader, title, offset));
    } else {
      rendered.push(await renderLanguagePage(pagePairs, pageIndex, pages.length, settings, generateHeader, title, offset));
    }
  }

  return `<div class="worksheet-preview matching-pages" style="font-family:${settings.font};font-size:${settings.fontSize}px;line-height:1.5;">
    ${pageCss()}
    ${rendered.join('')}
  </div>`;
}
