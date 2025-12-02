// Simplified Mint AI List Builder module
// Encapsulates AI modal wiring, preview, generate, and insert behavior.

import { escapeHtml, hasValidImageUrl, loadImageForRow } from './images.js';

const AI_PREVIEW_PLACEHOLDER = 'Paste or edit here, one pair per line: English, Korean';

export function initMintAiListBuilder({
  getList,
  addItems, // (items) => {from, to}
  render,
  enablePicturesEl,
  enableDefinitionsEl,
  loadingImages,
  generateDefinitionForRow
}) {
  // Elements
  const aiLink = document.getElementById('aiListBuilderLink');
  const aiModal = document.getElementById('mintAiSimpleModal');
  const aiCloseBtn = document.getElementById('mintAiSimpleClose');
  const aiCancelBtn = document.getElementById('mintAiCancel');
  const aiInsertBtn = document.getElementById('mintAiInsert');
  const aiModeTopic = document.getElementById('mintAiModeTopic');
  const aiModeText = document.getElementById('mintAiModeText');
  const aiTopic = document.getElementById('mintAiTopic');
  const aiPassage = document.getElementById('mintAiPassage');
  const aiNum = document.getElementById('mintAiNum');
  const aiDiff = document.getElementById('mintAiDifficulty');
  const aiGenerateBtn = document.getElementById('mintAiGenerate');
  const aiClearBtn = document.getElementById('mintAiClear');
  const aiWordlist = document.getElementById('mintAiWordlist');
  const aiPreview = document.getElementById('mintAiPreview');
  const aiTitleInput = document.getElementById('mintAiSimpleBoxTitle');

  const showAiModal = () => { if (aiModal) aiModal.style.display = 'flex'; };
  const hideAiModal = () => { if (aiModal) aiModal.style.display = 'none'; };

  if (aiLink && aiModal) aiLink.onclick = (e) => { e.preventDefault(); showAiModal(); };
  if (aiCloseBtn) aiCloseBtn.onclick = hideAiModal;
  if (aiCancelBtn) aiCancelBtn.onclick = hideAiModal;

  if (aiModeTopic && aiModeText) {
    aiModeTopic.onclick = () => {
      aiModeTopic.classList.add('active');
      aiModeText.classList.remove('active');
      aiTopic.style.display = '';
      aiPassage.style.display = 'none';
    };
    aiModeText.onclick = () => {
      aiModeText.classList.add('active');
      aiModeTopic.classList.remove('active');
      aiTopic.style.display = 'none';
      aiPassage.style.display = '';
    };
  }

  function parseLinesToPairs(text) {
    const lines = (text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const out = [];
    for (const line of lines) {
      const cleaned = line
        .replace(/^\s*[-*\u2022]?\s*\d+[).]\s*/, '')
        .replace(/^[-*\u2022]\s*/, '');
      const [eng, kor] = cleaned.split(/\s*,\s*/);
      if (eng) out.push({ eng, kor: kor || '' });
    }
    return out;
  }

  function renderAiPreviewFromWordlist() {
    const items = parseLinesToPairs(aiWordlist.value);
    if (!aiPreview) return;
    aiPreview.textContent = '';
    if (!items.length) { aiPreview.textContent = AI_PREVIEW_PLACEHOLDER; return; }
    aiPreview.innerHTML = items
      .map(({eng, kor}) => `<div>${escapeHtml(eng)}${kor? ', ' + escapeHtml(kor):''}</div>`)
      .join('');
  }

  if (aiWordlist) aiWordlist.addEventListener('input', renderAiPreviewFromWordlist);
  if (aiPreview) {
    const syncPreviewToWordlist = () => {
      const rawText = (aiPreview.textContent || '').trim();
      if (!rawText || rawText === AI_PREVIEW_PLACEHOLDER) { aiWordlist.value = ''; return; }
      const lines = Array.from(aiPreview.childNodes).map(node => {
        if (node.nodeType === Node.TEXT_NODE) return String(node.textContent || '').trim();
        if (node.nodeType === Node.ELEMENT_NODE) return String(node.textContent || '').trim();
        return '';
      }).filter(Boolean);
      const text = lines.length ? lines.join('\n') : (aiPreview.textContent || '')
        .split(/\r?\n/).map(s=>s.trim()).filter(Boolean).join('\n');
      aiWordlist.value = text;
    };
    aiPreview.addEventListener('input', syncPreviewToWordlist);
    aiPreview.addEventListener('paste', () => setTimeout(syncPreviewToWordlist, 0));
  }

  if (aiGenerateBtn) aiGenerateBtn.onclick = async () => {
    if (!aiPreview) return;
    aiPreview.textContent = 'Generating…';
    const useText = aiModeText?.classList.contains('active');
    const n = Math.max(1, Math.min(30, parseInt(aiNum?.value || '10', 10)));
    const diff = aiDiff?.value || 'easy';
    const topic = (aiTopic?.value || '').trim();
    const passage = (aiPassage?.value || '').trim();
    const prompt = useText
      ? `From this passage, extract ${n} English-Korean word pairs (level: ${diff}). Format 'english, korean' per line. Passage:\n\n${passage}`
      : `Generate ${n} English-Korean word pairs (level: ${diff}) about the topic "${topic || 'everyday objects'}". Format 'english, korean' per line.`;
    try {
      const res = await WillenaAPI.fetch('/.netlify/functions/openai_proxy', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt })
      });
      const js = await res.json();
      const text = (js?.result || '').trim();
      aiWordlist.value = text;
      renderAiPreviewFromWordlist();

      // Now invent a short title using AI
      let titlePrompt;
      if (useText && passage) {
        titlePrompt = `Invent a short, catchy title (2-3 words only) for a vocabulary box based on this passage: \n${passage}`;
      } else if (topic) {
        titlePrompt = `Invent a short, catchy title (2-3 words only) for a vocabulary box about the topic: ${topic}`;
      } else {
        titlePrompt = `Invent a short, catchy title (2-3 words only) for a vocabulary box about everyday objects.`;
      }
      const titleRes = await WillenaAPI.fetch('/.netlify/functions/openai_proxy', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: titlePrompt })
      });
      const titleJs = await titleRes.json();
      let title = (titleJs?.result || '').trim();
      // Remove quotes, extra punctuation, and keep only 2-3 words
      title = title.replace(/^"|"$/g, '').replace(/[.!?]+$/g, '').trim();
      const words = title.split(/\s+/).filter(Boolean);
      if (words.length > 3) title = words.slice(0, 3).join(' ');
      if (aiTitleInput) aiTitleInput.value = title;
    } catch (e) {
      console.error(e);
      aiPreview.textContent = 'Error generating list.';
    }
  };

  if (aiClearBtn) aiClearBtn.onclick = () => { aiWordlist.value = ''; renderAiPreviewFromWordlist(); };

  if (aiInsertBtn) aiInsertBtn.onclick = async () => {
    const sourceText = (aiWordlist?.value || '').trim();
    const items = parseLinesToPairs(sourceText);
    if (!items.length) return;
    // Update main builder title from modal title
    if (aiTitleInput) {
      const mainTitleInput = document.getElementById('titleInput');
      if (mainTitleInput && aiTitleInput.value.trim()) {
        mainTitleInput.value = aiTitleInput.value.trim();
      }
    }
    const range = addItems(items); // {from, to}
    hideAiModal();
    // Auto-load images for the newly inserted range
    if (enablePicturesEl.checked) {
      for (let i = range.from; i <= range.to; i++) {
        const list = getList();
        if (!hasValidImageUrl(list[i].image_url)) {
          await loadImageForRow(list, i, loadingImages, render);
        }
      }
    }
    // Auto-load definitions for the newly inserted range
    if (enableDefinitionsEl.checked) {
      for (let i = range.from; i <= range.to; i++) {
        await generateDefinitionForRow(i);
      }
    }
  };
}
