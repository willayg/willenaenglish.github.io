// Grammar Prepositions Data & Scene Builder
// Specific functionality for "in/on/under" preposition lessons

export function buildPrepositionScene(preposition, emoji, word) {
  const prep = String(preposition || '').toLowerCase();
  let displayEmoji = emoji;
  const wordLower = String(word || '').toLowerCase();
  const isPlural = wordLower.includes('pencil') || wordLower.includes('shoe') || wordLower.includes('children') || wordLower.includes('glass');
  
  if (!displayEmoji || displayEmoji.trim() === '') {
    if (wordLower.includes('cat')) displayEmoji = '🐱';
    else if (wordLower.includes('dog')) displayEmoji = '🐶';
    else if (wordLower.includes('bird')) displayEmoji = '🐦';
    else if (wordLower.includes('book')) displayEmoji = '📖';
    else if (wordLower.includes('laptop')) displayEmoji = '💻';
    else if (wordLower.includes('phone')) displayEmoji = '📱';
    else if (wordLower.includes('toy')) displayEmoji = '🧸';
    else if (wordLower.includes('shoe')) displayEmoji = '👟';
    else if (wordLower.includes('letter')) displayEmoji = '✉️';
    else if (wordLower.includes('glass')) displayEmoji = '👓';
    else if (wordLower.includes('pencil')) displayEmoji = '✏️';
    else if (wordLower.includes('children')) displayEmoji = '👧👦';
    else displayEmoji = '📦';
  }
  
  const emojiDisplay = isPlural ? `${displayEmoji} ${displayEmoji}` : displayEmoji;
  
  if (prep === 'in') {
    return `
      <div style="display:flex;flex-direction:column;align-items:center;width:100%;max-width:360px;margin:0 auto;">
        <div style="width:120px;height:120px;border:3px solid #333;border-radius:12px;background:#ffffff;display:flex;align-items:center;justify-content:center;font-size:56px;flex-wrap:wrap;gap:8px;padding:8px;">
          ${emojiDisplay}
        </div>
      </div>
    `;
  } else if (prep === 'on') {
    return `
      <div style="display:flex;flex-direction:column;align-items:center;width:100%;max-width:360px;margin:0 auto;position:relative;height:160px;">
        <div style="font-size:56px;position:relative;z-index:2;margin-bottom:-15px;display:flex;gap:4px;">
          ${emojiDisplay}
        </div>
        <div style="width:120px;height:100px;border:3px solid #333;border-radius:12px;background:#ffffff;position:relative;z-index:1;"></div>
      </div>
    `;
  } else if (prep === 'under') {
    return `
      <div style="display:flex;flex-direction:column;align-items:center;width:100%;max-width:360px;margin:0 auto;position:relative;height:160px;">
        <div style="width:120px;height:100px;border:3px solid #333;border-radius:12px;background:#ffffff;position:relative;z-index:2;margin-bottom:-15px;"></div>
        <div style="font-size:56px;position:relative;z-index:1;display:flex;gap:4px;">
          ${emojiDisplay}
        </div>
      </div>
    `;
  }
  return '';
}

export function isInOnUnderMode(answerChoices) {
  if (!Array.isArray(answerChoices)) return false;
  const lower = answerChoices.map(a => String(a || '').toLowerCase());
  return lower.includes('in') && lower.includes('on') && lower.includes('under');
}
