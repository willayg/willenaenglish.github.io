// Grammar Chart Modal - Shows rules and examples for grammar lessons
export function showGrammarChartModal({ grammarFile, grammarName, grammarData, onClose }) {
  ensureGrammarChartStyles();

  let modal = document.getElementById('grammarChartModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'grammarChartModal';
    modal.style.cssText = `position:fixed;top:0;left:0;width:100vw;height:100vh;background:linear-gradient(120deg, rgba(25,119,126,0.22) 0%, rgba(255,255,255,0.18) 100%);backdrop-filter:blur(12px) saturate(1.2);-webkit-backdrop-filter:blur(12px) saturate(1.2);z-index:1000;display:flex;align-items:center;justify-content:center;overflow-y:auto;padding:12px;`;
    document.body.appendChild(modal);
  }

  // Language state for this modal instance
  let isKorean = false;

  const updateChartContent = () => {
    const chart = buildGrammarChart(grammarName, grammarData, isKorean);
    const contentDiv = document.getElementById('grammarChartContent');
    if (contentDiv) {
      contentDiv.innerHTML = chart;
    }
  };

  modal.innerHTML = `
    <div style="width:95vw;max-width:600px;max-height:90vh;background:#fff;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,0.25);overflow:hidden;display:flex;flex-direction:column;font-family:'Poppins',Arial,sans-serif;border:3px solid #27c5ca;">
      <!-- Header -->
      <div style="position:sticky;top:0;background:#f6feff;border-bottom:2px solid #a9d6e9;display:flex;align-items:center;justify-content:space-between;padding:10px 12px;z-index:1;">
        <span style="font-size:1.3em;color:#19777e;font-weight:700;">${grammarName} Rules</span>
        <button id="closeGrammarChartModalX" style="cursor:pointer;border:none;background:transparent;color:#19777e;font-size:20px;font-weight:700;">✕</button>
      </div>
      <!-- Content -->
      <div id="grammarChartContent" style="overflow-y:auto;flex:1;padding:20px;color:#333;line-height:1.6;">
        ${buildGrammarChart(grammarName, grammarData, isKorean)}
      </div>
      <!-- Footer with Language Toggle -->
      <div style="padding:12px 18px;display:flex;align-items:center;justify-content:space-between;gap:8px;border-top:1px solid #e0f2f4;">
        <div></div>
        <!-- Language Toggle Switch -->
        <div style="display:flex;align-items:center;gap:8px;background:#f6feff;padding:6px 12px;border-radius:20px;border:2px solid #27c5ca;">
          <span id="langLabelEng" style="font-size:0.85em;font-weight:600;color:#19777e;cursor:pointer;">English</span>
          <div id="langToggle" style="width:40px;height:22px;background:#ccc;border-radius:11px;position:relative;cursor:pointer;transition:background 0.3s;display:flex;align-items:center;">
            <div id="langToggleSlider" style="width:18px;height:18px;background:#fff;border-radius:50%;position:absolute;left:2px;transition:left 0.3s;box-shadow:0 2px 4px rgba(0,0,0,0.2);"></div>
          </div>
          <span id="langLabelKor" style="font-size:0.85em;font-weight:600;color:#999;cursor:pointer;">한국어</span>
        </div>
        <button id="closeGrammarChartModal" style="padding:8px 18px;border-radius:8px;border:none;font-weight:700;cursor:pointer;background:#eceff1;color:#19777e;box-shadow:0 2px 8px rgba(60,60,80,0.08);">Close</button>
      </div>
    </div>
  `;

  modal.style.display = 'flex';

  // Language toggle functionality
  const toggle = document.getElementById('langToggle');
  const slider = document.getElementById('langToggleSlider');
  const labelEng = document.getElementById('langLabelEng');
  const labelKor = document.getElementById('langLabelKor');

  const updateToggleStyle = () => {
    if (isKorean) {
      toggle.style.background = '#19777e';
      slider.style.left = '20px';
      labelEng.style.color = '#999';
      labelKor.style.color = '#19777e';
    } else {
      toggle.style.background = '#27c5ca';
      slider.style.left = '2px';
      labelEng.style.color = '#19777e';
      labelKor.style.color = '#999';
    }
  };

  toggle.onclick = () => {
    isKorean = !isKorean;
    updateToggleStyle();
    updateChartContent();
  };

  labelEng.onclick = () => {
    if (isKorean) {
      isKorean = false;
      updateToggleStyle();
      updateChartContent();
    }
  };

  labelKor.onclick = () => {
    if (!isKorean) {
      isKorean = true;
      updateToggleStyle();
      updateChartContent();
    }
  };

  document.getElementById('closeGrammarChartModalX').onclick = () => {
    modal.style.display = 'none';
    if (onClose) onClose();
  };
  document.getElementById('closeGrammarChartModal').onclick = () => {
    modal.style.display = 'none';
    if (onClose) onClose();
  };
  modal.onclick = (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
      if (onClose) onClose();
    }
  };
}

function buildGrammarChart(grammarName, grammarData, isKorean = false) {
  const name = (grammarName || '').toLowerCase();
  
  // Determine chart type
  if (name.includes('articles') || name.includes('a vs an')) {
    return buildArticlesChart(grammarData, isKorean);
  } else if (name.includes('this') || name.includes('that') || name.includes('these') || name.includes('those')) {
    return buildDemonstrativesChart(grammarName, grammarData, isKorean);
  } else if (name.includes('am') || name.includes('are') || name.includes('is')) {
    return buildBeVerbChart(grammarData, isKorean);
  } else if (name.includes('it') || name.includes('they')) {
    return buildPronounsChart(grammarData, isKorean);
  } else if (name.includes('have') || name.includes('has')) {
    return buildHaveHasChart(grammarData, isKorean);
  } else if (name.includes('like') || name.includes('want')) {
    return buildVerbChart(grammarData, isKorean);
  } else {
    // Default generic chart
    return buildGenericChart(grammarData, isKorean);
  }
}

function buildArticlesChart(data, isKorean = false) {
  const aExamples = data ? data.filter(item => item.article === 'a').slice(0, 5) : [];
  const anExamples = data ? data.filter(item => item.article === 'an').slice(0, 5) : [];
  
  if (isKorean) {
    return `
      <div style="margin-bottom:24px;">
        <h3 style="color:#19777e;font-weight:700;margin:0 0 12px 0;font-size:1.2em;">규칙</h3>
        <div style="background:#f6feff;border-left:4px solid #27c5ca;padding:12px;border-radius:4px;">
          <p style="margin:0 0 8px 0;"><strong>"a"</strong>는 자음 소리 앞에 사용합니다</p>
          <p style="margin:0;"><strong>"an"</strong>은 모음 소리 앞에 사용합니다 (a, e, i, o, u)</p>
        </div>
      </div>
      
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <!-- A Examples -->
        <div>
          <h4 style="color:#ff6fb0;font-weight:700;margin:0 0 12px 0;">"a" 예제</h4>
          <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
            ${aExamples.map(item => `<li style="padding:8px;background:#fff5f8;border-left:3px solid #ff6fb0;border-radius:4px;font-size:0.95em;"><strong>${item.article}</strong> ${item.word || item.id || 'example'}</li>`).join('')}
          </ul>
        </div>
        
        <!-- An Examples -->
        <div>
          <h4 style="color:#7b9fff;font-weight:700;margin:0 0 12px 0;">"an" 예제</h4>
          <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
            ${anExamples.map(item => `<li style="padding:8px;background:#f0f4ff;border-left:3px solid #7b9fff;border-radius:4px;font-size:0.95em;"><strong>${item.article}</strong> ${item.word || item.id || 'example'}</li>`).join('')}
          </ul>
        </div>
      </div>
    `;
  }
  
  return `
    <div style="margin-bottom:24px;">
      <h3 style="color:#19777e;font-weight:700;margin:0 0 12px 0;font-size:1.2em;">Rule</h3>
      <div style="background:#f6feff;border-left:4px solid #27c5ca;padding:12px;border-radius:4px;">
        <p style="margin:0 0 8px 0;"><strong>"a"</strong> is used before consonant sounds</p>
        <p style="margin:0;"><strong>"an"</strong> is used before vowel sounds (a, e, i, o, u)</p>
      </div>
    </div>
    
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <!-- A Examples -->
      <div>
        <h4 style="color:#ff6fb0;font-weight:700;margin:0 0 12px 0;">Examples with "a"</h4>
        <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
          ${aExamples.map(item => `<li style="padding:8px;background:#fff5f8;border-left:3px solid #ff6fb0;border-radius:4px;font-size:0.95em;"><strong>${item.article}</strong> ${item.word || item.id || 'example'}</li>`).join('')}
        </ul>
      </div>
      
      <!-- An Examples -->
      <div>
        <h4 style="color:#7b9fff;font-weight:700;margin:0 0 12px 0;">Examples with "an"</h4>
        <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
          ${anExamples.map(item => `<li style="padding:8px;background:#f0f4ff;border-left:3px solid #7b9fff;border-radius:4px;font-size:0.95em;"><strong>${item.article}</strong> ${item.word || item.id || 'example'}</li>`).join('')}
        </ul>
      </div>
    </div>
  `;
}

function buildBeVerbChart(data, isKorean = false) {
  const imExamples = data ? data.filter(item => item.article === 'am').slice(0, 2) : [];
  const areExamples = data ? data.filter(item => item.article === 'are').slice(0, 2) : [];
  const isExamples = data ? data.filter(item => item.article === 'is').slice(0, 2) : [];
  
  if (isKorean) {
    return `
      <div style="margin-bottom:24px;">
        <h3 style="color:#19777e;font-weight:700;margin:0 0 12px 0;font-size:1.2em;">규칙</h3>
        <div style="background:#f6feff;border-left:4px solid #27c5ca;padding:12px;border-radius:4px;">
          <p style="margin:0 0 8px 0;"><strong>I am</strong> - "나"와 함께 "am"을 사용합니다</p>
          <p style="margin:0 0 8px 0;"><strong>He/She/It is</strong> - 단수형 주어와 함께 "is"를 사용합니다</p>
          <p style="margin:0;"><strong>We/You/They are</strong> - 복수형 주어와 "you"와 함께 "are"를 사용합니다</p>
        </div>
      </div>
      
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
        <!-- AM Examples -->
        <div>
          <h4 style="color:#40d4de;font-weight:700;margin:0 0 10px 0;font-size:0.95em;">I am</h4>
          <ul style="list-style:none;padding:0;margin:0;gap:6px;display:flex;flex-direction:column;font-size:0.9em;">
            ${imExamples.map(item => `<li style="padding:6px;background:#e6f7f8;border-left:3px solid #40d4de;border-radius:3px;"><span style="font-size:1.1em;margin-right:6px;">${item.emoji || '•'}</span>${item.exampleSentenceKo || 'am'}</li>`).join('')}
          </ul>
        </div>
        
        <!-- ARE Examples -->
        <div>
          <h4 style="color:#ffb84d;font-weight:700;margin:0 0 10px 0;font-size:0.95em;">are</h4>
          <ul style="list-style:none;padding:0;margin:0;gap:6px;display:flex;flex-direction:column;font-size:0.9em;">
            ${areExamples.map(item => `<li style="padding:6px;background:#fff9e6;border-left:3px solid #ffb84d;border-radius:3px;"><span style="font-size:1.1em;margin-right:6px;">${item.emoji || '•'}</span>${item.exampleSentenceKo || 'are'}</li>`).join('')}
          </ul>
        </div>
        
        <!-- IS Examples -->
        <div>
          <h4 style="color:#ff85d0;font-weight:700;margin:0 0 10px 0;font-size:0.95em;">is</h4>
          <ul style="list-style:none;padding:0;margin:0;gap:6px;display:flex;flex-direction:column;font-size:0.9em;">
            ${isExamples.map(item => `<li style="padding:6px;background:#ffe6f5;border-left:3px solid #ff85d0;border-radius:3px;"><span style="font-size:1.1em;margin-right:6px;">${item.emoji || '•'}</span>${item.exampleSentenceKo || 'is'}</li>`).join('')}
          </ul>
        </div>
      </div>
    `;
  }
  
  return `
    <div style="margin-bottom:24px;">
      <h3 style="color:#19777e;font-weight:700;margin:0 0 12px 0;font-size:1.2em;">Rule</h3>
      <div style="background:#f6feff;border-left:4px solid #27c5ca;padding:12px;border-radius:4px;">
        <p style="margin:0 0 8px 0;"><strong>I am</strong> - Use "am" with the subject "I"</p>
        <p style="margin:0 0 8px 0;"><strong>He/She/It is</strong> - Use "is" with singular subjects (he, she, it, and single nouns)</p>
        <p style="margin:0;"><strong>We/You/They are</strong> - Use "are" with plural subjects and "you"</p>
      </div>
    </div>
    
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
      <!-- AM Examples -->
      <div>
        <h4 style="color:#40d4de;font-weight:700;margin:0 0 10px 0;font-size:0.95em;">I am</h4>
        <ul style="list-style:none;padding:0;margin:0;gap:6px;display:flex;flex-direction:column;font-size:0.9em;">
          ${imExamples.map(item => `<li style="padding:6px;background:#e6f7f8;border-left:3px solid #40d4de;border-radius:3px;"><span style="font-size:1.1em;margin-right:6px;">${item.emoji || '•'}</span>${item.exampleSentence || 'am'}</li>`).join('')}
        </ul>
      </div>
      
      <!-- ARE Examples -->
      <div>
        <h4 style="color:#ffb84d;font-weight:700;margin:0 0 10px 0;font-size:0.95em;">are</h4>
        <ul style="list-style:none;padding:0;margin:0;gap:6px;display:flex;flex-direction:column;font-size:0.9em;">
          ${areExamples.map(item => `<li style="padding:6px;background:#fff9e6;border-left:3px solid #ffb84d;border-radius:3px;"><span style="font-size:1.1em;margin-right:6px;">${item.emoji || '•'}</span>${item.exampleSentence || 'are'}</li>`).join('')}
        </ul>
      </div>
      
      <!-- IS Examples -->
      <div>
        <h4 style="color:#ff85d0;font-weight:700;margin:0 0 10px 0;font-size:0.95em;">is</h4>
        <ul style="list-style:none;padding:0;margin:0;gap:6px;display:flex;flex-direction:column;font-size:0.9em;">
          ${isExamples.map(item => `<li style="padding:6px;background:#ffe6f5;border-left:3px solid #ff85d0;border-radius:3px;"><span style="font-size:1.1em;margin-right:6px;">${item.emoji || '•'}</span>${item.exampleSentence || 'is'}</li>`).join('')}
        </ul>
      </div>
    </div>
  `;
}

function buildDemonstrativesChart(grammarName, data, isKorean = false) {
  const name = (grammarName || '').toLowerCase();
  const isPluralDemo = /\b(these|those)\b/i.test(name);
  const leftArticle = isPluralDemo ? 'these' : 'this';
  const rightArticle = isPluralDemo ? 'those' : 'that';
  const leftExamples = data ? data.filter(item => item.article === leftArticle).slice(0, 3) : [];
  const rightExamples = data ? data.filter(item => item.article === rightArticle).slice(0, 3) : [];
  
  if (isKorean) {
    return `
      <div style="margin-bottom:24px;">
        <h3 style="color:#19777e;font-weight:700;margin:0 0 12px 0;font-size:1.2em;">규칙</h3>
        <div style="background:#f6feff;border-left:4px solid #27c5ca;padding:12px;border-radius:4px;">
          <p style="margin:0 0 8px 0;"><strong>This</strong> - 가까운 물건 (한 개)</p>
          <p style="margin:0;"><strong>That</strong> - 먼 물건 (한 개)</p>
        </div>
      </div>
      
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <!-- This -->
        <div>
          <h4 style="color:#40d4de;font-weight:700;margin:0 0 12px 0;">${isPluralDemo ? '이것들' : '이것'}</h4>
          <p style="font-size:0.85em;color:#666;margin:0 0 10px 0;font-style:italic;">${isPluralDemo ? '가까운 물건들' : '가까운 물건'}</p>
          <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
            ${leftExamples.map(item => `<li style="padding:8px;background:#e6f7f8;border-left:3px solid #40d4de;border-radius:4px;font-size:0.9em;display:flex;align-items:center;gap:8px;"><span style="font-size:1.3em;">${item.emoji || '•'}</span><span>${item.exampleSentenceKo || (isPluralDemo ? 'These' : 'This')}</span></li>`).join('')}
          </ul>
        </div>
        
        <!-- That -->
        <div>
          <h4 style="color:#ffb84d;font-weight:700;margin:0 0 12px 0;">${isPluralDemo ? '저것들' : '저것'}</h4>
          <p style="font-size:0.85em;color:#666;margin:0 0 10px 0;font-style:italic;">${isPluralDemo ? '먼 물건들' : '먼 물건'}</p>
          <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
            ${rightExamples.map(item => `<li style="padding:8px;background:#fff9e6;border-left:3px solid #ffb84d;border-radius:4px;font-size:0.9em;display:flex;align-items:center;gap:8px;"><span style="font-size:1.3em;">${item.emoji || '•'}</span><span>${item.exampleSentenceKo || (isPluralDemo ? 'Those' : 'That')}</span></li>`).join('')}
          </ul>
        </div>
      </div>
    `;
  }
  
  return `
  <div style="margin-bottom:24px;">
      <h3 style="color:#19777e;font-weight:700;margin:0 0 12px 0;font-size:1.2em;">Rule</h3>
      <div style="background:#f6feff;border-left:4px solid #27c5ca;padding:12px;border-radius:4px;">
        <p style="margin:0 0 8px 0;"><strong>This</strong> - For things that are NEAR (singular)</p>
        <p style="margin:0;"><strong>That</strong> - For things that are FAR AWAY (singular)</p>
      </div>
    </div>
    
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <!-- This -->
      <div>
  <h4 style="color:#40d4de;font-weight:700;margin:0 0 12px 0;">${isPluralDemo ? 'These' : 'This'}</h4>
  <p style="font-size:0.85em;color:#666;margin:0 0 10px 0;font-style:italic;">${isPluralDemo ? 'near you (plural)' : 'near you'}</p>
        <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
          ${leftExamples.map(item => `<li style="padding:8px;background:#e6f7f8;border-left:3px solid #40d4de;border-radius:4px;font-size:0.9em;display:flex;align-items:center;gap:8px;"><span style="font-size:1.3em;">${item.emoji || '•'}</span><span>${item.exampleSentence || (isPluralDemo ? 'These' : 'This')}</span></li>`).join('')}
        </ul>
      </div>
      
      <!-- That -->
      <div>
  <h4 style="color:#ffb84d;font-weight:700;margin:0 0 12px 0;">${isPluralDemo ? 'Those' : 'That'}</h4>
  <p style="font-size:0.85em;color:#666;margin:0 0 10px 0;font-style:italic;">${isPluralDemo ? 'far away (plural)' : 'far away'}</p>
        <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
          ${rightExamples.map(item => `<li style="padding:8px;background:#fff9e6;border-left:3px solid #ffb84d;border-radius:4px;font-size:0.9em;display:flex;align-items:center;gap:8px;"><span style="font-size:1.3em;">${item.emoji || '•'}</span><span>${item.exampleSentence || (isPluralDemo ? 'Those' : 'That')}</span></li>`).join('')}
        </ul>
      </div>
    </div>
  `;
}

function buildPronounsChart(data, isKorean = false) {
  const itExamples = data ? data.filter(item => item.article === 'it').slice(0, 3) : [];
  const theyExamples = data ? data.filter(item => item.article === 'they').slice(0, 3) : [];
  
  if (isKorean) {
    return `
      <div style="margin-bottom:24px;">
        <h3 style="color:#19777e;font-weight:700;margin:0 0 12px 0;font-size:1.2em;">규칙</h3>
        <div style="background:#f6feff;border-left:4px solid #27c5ca;padding:12px;border-radius:4px;">
          <p style="margin:0 0 8px 0;"><strong>It</strong> - 한 개의 단수 명사를 대체합니다 (한 사람, 동물, 또는 물건)</p>
          <p style="margin:0;"><strong>They</strong> - 복수 명사를 대체합니다 (여러 사람, 동물, 또는 물건)</p>
        </div>
      </div>
      
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <!-- It -->
        <div>
          <h4 style="color:#ff6fb0;font-weight:700;margin:0 0 12px 0;">그것 (단수)</h4>
          <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
            ${itExamples.map(item => `<li style="padding:8px;background:#fff5f8;border-left:3px solid #ff6fb0;border-radius:4px;font-size:0.9em;"><span style="font-size:1.2em;margin-right:6px;">${item.emoji || '•'}</span>${item.exampleSentenceKo || '그것'}</li>`).join('')}
          </ul>
        </div>
        
        <!-- They -->
        <div>
          <h4 style="color:#7b9fff;font-weight:700;margin:0 0 12px 0;">그들 (복수)</h4>
          <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
            ${theyExamples.map(item => `<li style="padding:8px;background:#f0f4ff;border-left:3px solid #7b9fff;border-radius:4px;font-size:0.9em;"><span style="font-size:1.2em;margin-right:6px;">${item.emoji || '•'}</span>${item.exampleSentenceKo || '그들'}</li>`).join('')}
          </ul>
        </div>
      </div>
    `;
  }
  
  return `
    <div style="margin-bottom:24px;">
      <h3 style="color:#19777e;font-weight:700;margin:0 0 12px 0;font-size:1.2em;">Rule</h3>
      <div style="background:#f6feff;border-left:4px solid #27c5ca;padding:12px;border-radius:4px;">
        <p style="margin:0 0 8px 0;"><strong>It</strong> - Replaces ONE singular noun (one person, animal, or thing)</p>
        <p style="margin:0;"><strong>They</strong> - Replaces PLURAL nouns (multiple people, animals, or things)</p>
      </div>
    </div>
    
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <!-- It -->
      <div>
        <h4 style="color:#ff6fb0;font-weight:700;margin:0 0 12px 0;">It (singular)</h4>
        <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
          ${itExamples.map(item => `<li style="padding:8px;background:#fff5f8;border-left:3px solid #ff6fb0;border-radius:4px;font-size:0.9em;"><span style="font-size:1.2em;margin-right:6px;">${item.emoji || '•'}</span>${item.exampleSentence || 'It'}</li>`).join('')}
        </ul>
      </div>
      
      <!-- They -->
      <div>
        <h4 style="color:#7b9fff;font-weight:700;margin:0 0 12px 0;">They (plural)</h4>
        <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
          ${theyExamples.map(item => `<li style="padding:8px;background:#f0f4ff;border-left:3px solid #7b9fff;border-radius:4px;font-size:0.9em;"><span style="font-size:1.2em;margin-right:6px;">${item.emoji || '•'}</span>${item.exampleSentence || 'They'}</li>`).join('')}
        </ul>
      </div>
    </div>
  `;
}

function buildHaveHasChart(data, isKorean = false) {
  const haveExamples = data ? data.filter(item => item.article === 'have').slice(0, 3) : [];
  const hasExamples = data ? data.filter(item => item.article === 'has').slice(0, 3) : [];
  
  if (isKorean) {
    return `
      <div style="margin-bottom:24px;">
        <h3 style="color:#19777e;font-weight:700;margin:0 0 12px 0;font-size:1.2em;">규칙</h3>
        <div style="background:#f6feff;border-left:4px solid #27c5ca;padding:12px;border-radius:4px;">
          <p style="margin:0 0 8px 0;"><strong>"have"</strong> - I, you, we, they와 함께 쓰며 '가지다'라는 뜻이에요</p>
          <p style="margin:0;"><strong>"has"</strong> - he, she, it과 단수 명사와 함께 쓰며 '가지다'라는 뜻이에요</p>
        </div>
      </div>
      
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <!-- Have Examples -->
        <div>
          <h4 style="color:#40d4de;font-weight:700;margin:0 0 12px 0;">have (복수/you)</h4>
          <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
            ${haveExamples.map(item => `<li style="padding:8px;background:#e6f7f8;border-left:3px solid #40d4de;border-radius:4px;font-size:0.9em;"><span style="font-size:1.1em;margin-right:6px;">${item.emoji || '•'}</span>${item.exampleSentenceKo || 'have'}</li>`).join('')}
          </ul>
        </div>
        
        <!-- Has Examples -->
        <div>
          <h4 style="color:#ff6fb0;font-weight:700;margin:0 0 12px 0;">has (단수)</h4>
          <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
            ${hasExamples.map(item => `<li style="padding:8px;background:#fff5f8;border-left:3px solid #ff6fb0;border-radius:4px;font-size:0.9em;"><span style="font-size:1.1em;margin-right:6px;">${item.emoji || '•'}</span>${item.exampleSentenceKo || 'has'}</li>`).join('')}
          </ul>
        </div>
      </div>
    `;
  }
  
  return `
    <div style="margin-bottom:24px;">
      <h3 style="color:#19777e;font-weight:700;margin:0 0 12px 0;font-size:1.2em;">Rule</h3>
      <div style="background:#f6feff;border-left:4px solid #27c5ca;padding:12px;border-radius:4px;">
        <p style="margin:0 0 8px 0;"><strong>"have"</strong> - Use with I, you, we, they to show possession (having something)</p>
        <p style="margin:0;"><strong>"has"</strong> - Use with he, she, it and singular nouns to show possession (having something)</p>
      </div>
    </div>
    
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <!-- Have Examples -->
      <div>
        <h4 style="color:#40d4de;font-weight:700;margin:0 0 12px 0;">have (plural/you)</h4>
        <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
          ${haveExamples.map(item => `<li style="padding:8px;background:#e6f7f8;border-left:3px solid #40d4de;border-radius:4px;font-size:0.9em;"><span style="font-size:1.1em;margin-right:6px;">${item.emoji || '•'}</span>${item.exampleSentence || 'have'}</li>`).join('')}
        </ul>
      </div>
      
      <!-- Has Examples -->
      <div>
        <h4 style="color:#ff6fb0;font-weight:700;margin:0 0 12px 0;">has (singular)</h4>
        <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
          ${hasExamples.map(item => `<li style="padding:8px;background:#fff5f8;border-left:3px solid #ff6fb0;border-radius:4px;font-size:0.9em;"><span style="font-size:1.1em;margin-right:6px;">${item.emoji || '•'}</span>${item.exampleSentence || 'has'}</li>`).join('')}
        </ul>
      </div>
    </div>
  `;
}

function buildVerbChart(data, isKorean = false) {
  if (!data || !data.length) return buildGenericChart(data, isKorean);
  
  const articles = [...new Set(data.map(d => d.article))].slice(0, 2);
  
  if (isKorean) {
    return `
      <div style="margin-bottom:24px;">
        <h3 style="color:#19777e;font-weight:700;margin:0 0 12px 0;font-size:1.2em;">규칙</h3>
        <div style="background:#f6feff;border-left:4px solid #27c5ca;padding:12px;border-radius:4px;">
          <p style="margin:0;font-size:0.95em;">각 주어와 함께 사용할 동사 형태를 비교하세요.</p>
        </div>
      </div>
      
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        ${articles.map((article, idx) => {
          const examples = data.filter(d => d.article === article).slice(0, 3);
          const colors = ['#40d4de', '#ffb84d', '#ff85d0', '#ff6fb0'];
          const color = colors[idx % colors.length];
          return `
            <div>
              <h4 style="color:${color};font-weight:700;margin:0 0 12px 0;">${article}</h4>
              <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
                ${examples.map(item => `<li style="padding:8px;background:${color}15;border-left:3px solid ${color};border-radius:4px;font-size:0.95em;">${item.article}</li>`).join('')}
              </ul>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }
  
  return `
    <div style="margin-bottom:24px;">
      <h3 style="color:#19777e;font-weight:700;margin:0 0 12px 0;font-size:1.2em;">Rule</h3>
      <div style="background:#f6feff;border-left:4px solid #27c5ca;padding:12px;border-radius:4px;">
        <p style="margin:0;font-size:0.95em;">Compare the verb forms to see which form goes with each subject.</p>
      </div>
    </div>
    
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      ${articles.map((article, idx) => {
        const examples = data.filter(d => d.article === article).slice(0, 3);
        const colors = ['#40d4de', '#ffb84d', '#ff85d0', '#ff6fb0'];
        const color = colors[idx % colors.length];
        return `
          <div>
            <h4 style="color:${color};font-weight:700;margin:0 0 12px 0;">${article}</h4>
            <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
              ${examples.map(item => `<li style="padding:8px;background:${color}15;border-left:3px solid ${color};border-radius:4px;font-size:0.95em;">${item.article}</li>`).join('')}
            </ul>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function buildGenericChart(data, isKorean = false) {
  if (!data || !data.length) {
    return isKorean 
      ? `<p style="color:#666;font-size:0.95em;">차트에 사용할 수 있는 문법 데이터가 없습니다.</p>`
      : `<p style="color:#666;font-size:0.95em;">No grammar data available for chart.</p>`;
  }
  
  // Group by article/form
  const groups = {};
  data.forEach(item => {
    const key = item.article || item.word || 'other';
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  });
  
  const articles = Object.keys(groups).slice(0, 3);
  
  if (isKorean) {
    return `
      <div style="margin-bottom:24px;">
        <h3 style="color:#19777e;font-weight:700;margin:0 0 12px 0;font-size:1.2em;">예제</h3>
      </div>
      
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;">
        ${articles.map((article, idx) => {
          const examples = groups[article].slice(0, 3);
          const colors = ['#40d4de', '#ffb84d', '#ff85d0'];
          const color = colors[idx % colors.length];
          return `
            <div style="background:${color}15;border-left:4px solid ${color};border-radius:8px;padding:12px;">
              <h4 style="color:${color};font-weight:700;margin:0 0 10px 0;font-size:0.9em;">${article}</h4>
              <ul style="list-style:none;padding:0;margin:0;font-size:0.85em;">
                ${examples.map(item => `<li style="padding:4px 0;">${item.word || item.id || '예제'}</li>`).join('')}
              </ul>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }
  
  return `
    <div style="margin-bottom:24px;">
      <h3 style="color:#19777e;font-weight:700;margin:0 0 12px 0;font-size:1.2em;">Examples</h3>
    </div>
    
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;">
      ${articles.map((article, idx) => {
        const examples = groups[article].slice(0, 3);
        const colors = ['#40d4de', '#ffb84d', '#ff85d0'];
        const color = colors[idx % colors.length];
        return `
          <div style="background:${color}15;border-left:4px solid ${color};border-radius:8px;padding:12px;">
            <h4 style="color:${color};font-weight:700;margin:0 0 10px 0;font-size:0.9em;">${article}</h4>
            <ul style="list-style:none;padding:0;margin:0;font-size:0.85em;">
              ${examples.map(item => `<li style="padding:4px 0;">${item.word || item.id || 'example'}</li>`).join('')}
            </ul>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function ensureGrammarChartStyles() {
  if (document.getElementById('grammarChartStyles')) return;
  
  const style = document.createElement('style');
  style.id = 'grammarChartStyles';
  style.textContent = `
    #grammarChartModal ul li {
      padding: 8px;
      border-radius: 4px;
      font-size: 0.95em;
    }
    #grammarChartModal h3, #grammarChartModal h4 {
      margin: 0;
      font-family: 'Poppins', Arial, sans-serif;
    }
    #grammarChartModal p {
      margin: 0.5em 0;
      font-size: 0.95em;
    }
  `;
  document.head.appendChild(style);
}
