import { playTTSVariant, playSentenceById } from '../tts.js';

// SVG Play Icon
const playIconSvg = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="width:20px;height:20px;">
  <path d="M8 5v14l11-7z"/>
</svg>`;

// Study Words Modal: displays full word list with audio playback
export function showStudyWordsModal({ wordList = [], onClose = null }) {
  // Create modal overlay
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    z-index: 2000;
    padding: 12px;
    overflow-y: auto;
  `;

  // Create modal content container
  const content = document.createElement('div');
  content.style.cssText = `
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    margin-top: 20px;
    margin-bottom: 20px;
    width: 100%;
    max-width: 600px;
    border: 2px solid #93cbcf;
    font-family: 'Poppins', Arial, sans-serif;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  `;

  // Header
  const header = document.createElement('div');
  header.style.cssText = `
    background: #93cbcf;
    color: #fff;
    padding: 14px 16px;
    font-weight: 800;
    font-size: clamp(16px, 4vw, 18px);
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 4px;
  `;
  header.innerHTML = `
    <div>Study Words</div>
    <div style="font-size: clamp(11px, 2.5vw, 13px); font-weight: 600; color: rgba(255,255,255,0.85);">click to hear the words</div>
  `;

  // Word list container with scrollable body
  const listContainer = document.createElement('div');
  listContainer.style.cssText = `
    flex: 1;
    overflow-y: auto;
    max-height: 70vh;
    padding: 12px 0;
  `;

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.style.cssText = `
    background: #e5e7eb;
    color: #374151;
    border: none;
    padding: 10px 16px;
    font-family: 'Poppins', Arial, sans-serif;
    font-weight: 700;
    font-size: 14px;
    cursor: pointer;
    width: 100%;
    transition: background 0.2s ease;
  `;
  closeBtn.textContent = 'Close';
  closeBtn.addEventListener('mouseenter', () => {
    closeBtn.style.background = '#d1d5db';
  });
  closeBtn.addEventListener('mouseleave', () => {
    closeBtn.style.background = '#e5e7eb';
  });
  closeBtn.onclick = () => {
    modal.remove();
    if (onClose) onClose();
  };

  // Helper: format word display (eng / kor)
  const formatWord = (item) => {
    if (typeof item === 'string') return item;
    if (item && typeof item === 'object') {
      return `${item.eng || ''} / ${item.kor || ''}`;
    }
    return String(item || '');
  };

  // Helper: get emoji from word object, with fallback to first char if missing
  const getEmoji = (item) => {
    if (!item || typeof item !== 'object') return '';
    // If emoji field exists and is non-empty, use it
    if (item.emoji && typeof item.emoji === 'string' && item.emoji.trim()) {
      return item.emoji;
    }
    return '';
  };

  // Helper: get English word for audio playback
  const getEngWord = (item) => {
    if (typeof item === 'string') return item;
    if (item && typeof item === 'object') return item.eng || '';
    return String(item || '');
  };

  // Helper: determine if a word is short (<=4 chars)
  const isShortWord = (word) => {
    const w = String(word || '').trim();
    return w.length > 0 && w.length <= 4;
  };

  // Render word items
  if (Array.isArray(wordList) && wordList.length > 0) {
    wordList.forEach((item, idx) => {
      const wordRow = document.createElement('div');
      wordRow.style.cssText = `
        display: flex;
        align-items: center;
        padding: clamp(10px, 2vw, 12px) clamp(12px, 3vw, 16px);
        border-bottom: 1px solid #e5e7eb;
        gap: clamp(8px, 2vw, 12px);
        transition: background 0.15s ease;
        flex-wrap: wrap;
      `;

      // Hover effect
      wordRow.addEventListener('mouseenter', () => {
        wordRow.style.background = '#f0f9fa';
      });
      wordRow.addEventListener('mouseleave', () => {
        wordRow.style.background = 'transparent';
      });

      // Index
      const indexSpan = document.createElement('span');
      indexSpan.style.cssText = `
        font-weight: 700;
        color: #93cbcf;
        min-width: 28px;
        font-size: clamp(12px, 2.5vw, 14px);
        flex-shrink: 0;
      `;
      indexSpan.textContent = `${(idx + 1).toString().padStart(2, '0')}.`;

      // Emoji (if available)
      const emoji = getEmoji(item);
      const emojiSpan = document.createElement('span');
      emojiSpan.style.cssText = `
        font-size: clamp(18px, 4vw, 24px);
        min-width: clamp(24px, 5vw, 32px);
        text-align: center;
        flex-shrink: 0;
      `;
      emojiSpan.textContent = emoji;

      // Word display (center)
      const wordSpan = document.createElement('div');
      wordSpan.style.cssText = `
        flex: 1;
        cursor: pointer;
        padding: 8px 12px;
        border-radius: 6px;
        transition: background 0.15s ease;
        user-select: none;
      `;
      
      // Get Korean meaning if available
      const korMeaning = (item && typeof item === 'object' && item.kor) ? item.kor : '';
      const engWord = getEngWord(item);
      const exampleSentence = (item && typeof item === 'object' && item.ex) ? item.ex : '';
      
      if (korMeaning) {
        wordSpan.innerHTML = `<div style="display: flex; flex-direction: column; gap: 3px;">
          <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
            <span style="font-weight: 700; color: #20a39f; font-size: clamp(14px, 3vw, 16px);">${engWord}</span>
            <span style="color: #9ca3af; font-size: clamp(12px, 2.5vw, 14px);">—</span>
            <span style="color: #9ca3af; font-size: clamp(12px, 2.5vw, 14px);">${korMeaning}</span>
          </div>
          ${exampleSentence ? `<div style="color: #9ca3af; font-size: clamp(11px, 2.5vw, 12px); line-height: 1.3;">${exampleSentence}</div>` : ''}
        </div>`;
      } else {
        wordSpan.innerHTML = `<div style="display: flex; flex-direction: column; gap: 3px;">
          <div style="font-weight: 700; color: #20a39f; font-size: clamp(14px, 3vw, 16px);">${engWord}</div>
          ${exampleSentence ? `<div style="color: #9ca3af; font-size: clamp(11px, 2.5vw, 12px); line-height: 1.3;">${exampleSentence}</div>` : ''}
        </div>`;
      }

      // Click word to play audio
      // For short words (<=4 chars), use base word.mp3 to avoid TTS quality issues
      // For longer words, use word_itself.mp3
      wordSpan.addEventListener('click', async () => {
        wordSpan.style.background = '#d6f3f5';
        try {
          const engWord = getEngWord(item);
          const variant = isShortWord(engWord) ? 'default' : 'itself';
          await playTTSVariant(engWord, variant);
        } catch (e) {
          console.error('Error playing word audio:', e);
        }
        setTimeout(() => {
          wordSpan.style.background = 'transparent';
        }, 300);
      });

      // Hover effect on word
      wordSpan.addEventListener('mouseenter', () => {
        wordSpan.style.background = '#d6f3f5';
      });
      wordSpan.addEventListener('mouseleave', () => {
        wordSpan.style.background = 'transparent';
      });

      // Sentence play button (right side)
      const sentenceBtn = document.createElement('button');
      sentenceBtn.style.cssText = `
        background: #93cbcf;
        color: #fff;
        border: none;
        padding: clamp(6px, 1.5vw, 8px) clamp(10px, 2vw, 12px);
        border-radius: 6px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        font-family: 'Poppins', Arial, sans-serif;
        font-weight: 700;
        font-size: clamp(11px, 2.5vw, 12px);
        transition: background 0.2s ease;
        min-width: clamp(36px, 8vw, 44px);
        min-height: clamp(36px, 8vw, 40px);
        flex-shrink: 0;
      `;
      sentenceBtn.innerHTML = playIconSvg;
      sentenceBtn.setAttribute('title', 'Play sentence');
      sentenceBtn.addEventListener('mouseenter', () => {
        sentenceBtn.style.background = '#5eb3c1';
      });
      sentenceBtn.addEventListener('mouseleave', () => {
        sentenceBtn.style.background = '#93cbcf';
      });
      sentenceBtn.onclick = async () => {
        sentenceBtn.style.background = '#2d9ba0';
        try {
          // Use sentence_id if available (proper fix), fallback to word-based lookup
          const sentenceId = (item && typeof item === 'object') ? item.sentence_id : null;
          if (sentenceId) {
            await playSentenceById(sentenceId, getEngWord(item));
          } else {
            await playTTSVariant(getEngWord(item), 'sentence');
          }
        } catch (e) {
          console.error('Error playing sentence audio:', e);
        }
        setTimeout(() => {
          sentenceBtn.style.background = '#93cbcf';
        }, 300);
      };

      // Assemble row
      wordRow.appendChild(indexSpan);
      wordRow.appendChild(emojiSpan);
      wordRow.appendChild(wordSpan);
      wordRow.appendChild(sentenceBtn);

      listContainer.appendChild(wordRow);
    });
  } else {
    // No words message
    const emptyMsg = document.createElement('div');
    emptyMsg.style.cssText = `
      padding: 40px 20px;
      text-align: center;
      color: #9ca3af;
      font-size: 14px;
    `;
    emptyMsg.textContent = 'No words to display.';
    listContainer.appendChild(emptyMsg);
  }

  // Assemble modal
  content.appendChild(header);
  content.appendChild(listContainer);
  content.appendChild(closeBtn);

  modal.appendChild(content);

  // Close modal on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
      if (onClose) onClose();
    }
  });

  document.body.appendChild(modal);
}
