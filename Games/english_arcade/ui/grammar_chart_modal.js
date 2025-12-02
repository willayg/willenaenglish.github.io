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
  const hasContractions = Array.isArray(grammarData) && grammarData.some(it => it && (it.contraction || it.ending));

  // Custom chart for 'Some vs Any'
  if (name.includes('some vs any')) {
    return buildSomeAnyChart(grammarData, isKorean);
  }
    // Custom chart for 'There is / There are'
    if (name.includes('there is') || name.includes('there are')) {
      return buildThereIsThereAreChart(grammarData, isKorean);
    }
      // Custom chart for 'Are there / Is there'
      if (name.includes('are there') || name.includes('is there')) {
        return buildAreIsThereChart(grammarData, isKorean);
      }
        // Custom chart for 'Yes/No Questions'
        if (name.includes('short questions 1') || name.includes('short questions 2') || name.includes('yes/no question') || name.includes('yes no question')) {
          return buildYesNoQuestionsChart(grammarData, isKorean);
        }
          // Custom chart for Simple Present (first one)
          if (name.includes('present simple') && !name.includes('negative')) {
            return buildSimplePresentChart(grammarData, isKorean);
          }
            // Custom chart for Simple Present Negative
            if (name.includes('negative') || name.includes('present simple negative')) {
              return buildSimplePresentNegativeChart(grammarData, isKorean);
            }
  // Custom chart for "Be Going To" future (Level 3)
  if (name.includes('be going to') && name.includes('future')) {
    return buildBeGoingToFutureChart(grammarData, isKorean);
  }
  // Custom chart for "Be Going To" questions (Level 3)
  if (name.includes('be going to') && name.includes('question')) {
    return buildBeGoingToQuestionsChart(grammarData, isKorean);
  }
  // Custom chart for Past Simple (Regular) - Level 3
  if (name.includes('past simple') && name.includes('regular')) {
    return buildPastSimpleRegularChart(grammarData, isKorean);
  }
  // Custom chart for Past vs Future - Level 3
  if (name.includes('past vs future') || name.includes('past_vs_future')) {
    return buildPastVsFutureChart(grammarData, isKorean);
  }
  // Custom chart for All Tenses Practice - Level 3
  if (name.includes('all tenses') || name.includes('past_vs_present_vs_future')) {
    return buildAllTensesPracticeChart(grammarData, isKorean);
  }
// Custom chart builder for Simple Present Negative sentences
function buildSimplePresentNegativeChart(data, isKorean = false) {
  // Group examples
  const doesntExamples = data.filter(ex => ex.word && (ex.word.includes("doesn_t") || ex.word.includes("he_") || ex.word.includes("she_"))).slice(0, 3);
  const dontExamples = data.filter(ex => ex.word && (
    ex.word.includes("don_t") || ex.word.includes("i_") || ex.word.includes("we_") || ex.word.includes("they_") || ex.word.includes("you_")
  )).slice(0, 3);

  if (isKorean) {
    return `
      <div style="margin-bottom:18px;">
        <div style="background:#fff7f7;border-left:4px solid #ff6fb0;padding:12px;border-radius:4px;">
          <p style="margin:0 0 8px 0;font-size:1.05em;">
            <strong>현재시제 부정문</strong>은 <span style="color:#ff6fb0;font-weight:700;">하지 않다</span>를 말할 때 써요.<br>
            <span style="color:#19777e;font-weight:700;">예: I don't like spinach. He doesn't play tennis.</span>
          </p>
          <p style="margin:0 0 8px 0;font-size:1.05em;">
            <strong>3인칭 단수(he, she, it)</strong>에는 <span style="color:#ffb84d;font-weight:700;">doesn't + 동사 원형</span>을 써요.<br>
            <span style="color:#19777e;font-weight:700;">예: She doesn't like, He doesn't play</span>
          </p>
          <p style="margin:0 0 8px 0;font-size:1.05em;">
            <strong>I, you, we, they</strong>에는 <span style="color:#40d4de;font-weight:700;">don't + 동사 원형</span>을 써요.<br>
            <span style="color:#19777e;font-weight:700;">예: I don't like, You don't play, We don't study, They don't eat</span>
          </p>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div>
          <h4 style="color:#ffb84d;font-weight:700;margin:0 0 10px 0;font-size:1em;">3인칭 단수 부정문 (doesn't)</h4>
          <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
            ${doesntExamples.map(ex => `<li style="padding:8px;background:#fff9e6;border-left:3px solid #ffb84d;border-radius:4px;font-size:1em;display:flex;align-items:center;gap:8px;"><span style="font-size:1.3em;">${ex.emoji || '🚫'}</span><div style="display:flex;flex-direction:column;"><span style="font-weight:700;color:#19777e;">${ex.exampleSentence}</span><div style="font-size:0.98em;color:#555;margin-top:2px;">${ex.exampleSentenceKo}</div></div></li>`).join('')}
          </ul>
        </div>
        <div>
          <h4 style="color:#40d4de;font-weight:700;margin:0 0 10px 0;font-size:1em;">I/You/We/They 부정문 (don't)</h4>
          <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
            ${dontExamples.map(ex => `<li style="padding:8px;background:#e6f7f8;border-left:3px solid #40d4de;border-radius:4px;font-size:1em;display:flex;align-items:center;gap:8px;"><span style="font-size:1.3em;">${ex.emoji || '🚫'}</span><div style="display:flex;flex-direction:column;"><span style="font-weight:700;color:#19777e;">${ex.exampleSentence}</span><div style="font-size:0.98em;color:#555;margin-top:2px;">${ex.exampleSentenceKo}</div></div></li>`).join('')}
          </ul>
        </div>
      </div>
      <div style="margin-top:18px;background:#fff7f7;border-left:4px solid #ff6fb0;padding:12px;border-radius:4px;">
        <p style="font-size:1.05em;color:#19777e;font-weight:700;margin:0;">팁: 3인칭 단수(he, she, it)는 doesn't!<br>I/you/we/they는 don't!</p>
      </div>
    `;
  }
  // English version
  return `
    <div style="margin-bottom:18px;">
      <div style="background:#fff7f7;border-left:4px solid #ff6fb0;padding:12px;border-radius:4px;">
        <p style="margin:0 0 8px 0;font-size:1.05em;">
          <strong>Simple present negative</strong> is used to say <span style="color:#ff6fb0;font-weight:700;">don't/doesn't</span>.<br>
          <span style="color:#19777e;font-weight:700;">Examples: I don't like spinach. He doesn't play tennis.</span>
        </p>
        <p style="margin:0 0 8px 0;font-size:1.05em;">
          <strong>Third person singular (he, she, it)</strong> uses <span style="color:#ffb84d;font-weight:700;">doesn't + base verb</span>.<br>
          <span style="color:#19777e;font-weight:700;">Examples: She doesn't like, He doesn't play</span>
        </p>
        <p style="margin:0 0 8px 0;font-size:1.05em;">
          <strong>I, you, we, they</strong> use <span style="color:#40d4de;font-weight:700;">don't + base verb</span>.<br>
          <span style="color:#19777e;font-weight:700;">Examples: I don't like, You don't play, We don't study, They don't eat</span>
        </p>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div>
        <h4 style="color:#ffb84d;font-weight:700;margin:0 0 10px 0;font-size:1em;">Third Person Singular Negative (doesn't)</h4>
        <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
          ${doesntExamples.map(ex => `<li style="padding:8px;background:#fff9e6;border-left:3px solid #ffb84d;border-radius:4px;font-size:1em;display:flex;align-items:center;gap:8px;"><span style="font-size:1.3em;">${ex.emoji || '🚫'}</span><div style="display:flex;flex-direction:column;"><span style="font-weight:700;color:#19777e;">${ex.exampleSentence}</span><div style="font-size:0.98em;color:#555;margin-top:2px;">${ex.exampleSentenceKo}</div></div></li>`).join('')}
        </ul>
      </div>
      <div>
        <h4 style="color:#40d4de;font-weight:700;margin:0 0 10px 0;font-size:1em;">I/You/We/They Negative (don't)</h4>
        <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
          ${dontExamples.map(ex => `<li style="padding:8px;background:#e6f7f8;border-left:3px solid #40d4de;border-radius:4px;font-size:1em;display:flex;align-items:center;gap:8px;"><span style="font-size:1.3em;">${ex.emoji || '🚫'}</span><div style="display:flex;flex-direction:column;"><span style="font-weight:700;color:#19777e;">${ex.exampleSentence}</span><div style="font-size:0.98em;color:#555;margin-top:2px;">${ex.exampleSentenceKo}</div></div></li>`).join('')}
        </ul>
      </div>
    </div>
    <div style="margin-top:18px;background:#fff7f7;border-left:4px solid #ff6fb0;padding:12px;border-radius:4px;">
      <p style="font-size:1.05em;color:#19777e;font-weight:700;margin:0;">Tip: Third person singular (he, she, it) uses doesn't!<br>I/you/we/they use don't!</p>
    </div>
  `;
}
// Custom chart builder for Simple Present (third person singular vs non-third person singular)
function buildSimplePresentChart(data, isKorean = false) {
  // Group examples
  const thirdPersonExamples = data.filter(ex => ex.word && (ex.word.includes('he_') || ex.word.includes('she_'))).slice(0, 3);
  const nonThirdPersonExamples = data.filter(ex => ex.word && (
    ex.word.includes('i_') || ex.word.includes('we_') || ex.word.includes('they_') || ex.word.includes('you_')
  )).slice(0, 3);

  if (isKorean) {
    return `
      <div style="margin-bottom:18px;">
        <div style="background:#f6feff;border-left:4px solid #27c5ca;padding:12px;border-radius:4px;">
          <p style="margin:0 0 8px 0;font-size:1.05em;">
            <strong>현재시제</strong>는 <span style="color:#40d4de;font-weight:700;">습관</span>, <span style="color:#40d4de;font-weight:700;">사실</span>, <span style="color:#40d4de;font-weight:700;">규칙</span>을 말할 때 써요.<br>
            <span style="color:#19777e;font-weight:700;">예: I walk to school. She plays soccer.</span>
          </p>
          <p style="margin:0 0 8px 0;font-size:1.05em;">
            <strong>3인칭 단수(he, she, it)</strong>에는 <span style="color:#ffb84d;font-weight:700;">동사에 s</span>를 붙여요.<br>
            <span style="color:#19777e;font-weight:700;">예: She plays, He likes, It rains</span>
          </p>
          <p style="margin:0 0 8px 0;font-size:1.05em;">
            <strong>I, you, we, they</strong>에는 <span style="color:#40d4de;font-weight:700;">동사 원형</span>을 써요.<br>
            <span style="color:#19777e;font-weight:700;">예: I play, You like, We walk, They study</span>
          </p>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div>
          <h4 style="color:#ffb84d;font-weight:700;margin:0 0 10px 0;font-size:1em;">3인칭 단수 예시 (s 붙임)</h4>
          <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
            ${thirdPersonExamples.map(ex => `<li style="padding:8px;background:#fff9e6;border-left:3px solid #ffb84d;border-radius:4px;font-size:1em;display:flex;align-items:center;gap:8px;"><span style="font-size:1.3em;">${ex.emoji || '⚽'}</span><div style="display:flex;flex-direction:column;"><span style="font-weight:700;color:#19777e;">${ex.exampleSentence}</span><div style="font-size:0.98em;color:#555;margin-top:2px;">${ex.exampleSentenceKo}</div></div></li>`).join('')}
          </ul>
        </div>
        <div>
          <h4 style="color:#40d4de;font-weight:700;margin:0 0 10px 0;font-size:1em;">I/You/We/They 예시 (원형)</h4>
          <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
            ${nonThirdPersonExamples.map(ex => `<li style="padding:8px;background:#e6f7f8;border-left:3px solid #40d4de;border-radius:4px;font-size:1em;display:flex;align-items:center;gap:8px;"><span style="font-size:1.3em;">${ex.emoji || '🚶'}</span><div style="display:flex;flex-direction:column;"><span style="font-weight:700;color:#19777e;">${ex.exampleSentence}</span><div style="font-size:0.98em;color:#555;margin-top:2px;">${ex.exampleSentenceKo}</div></div></li>`).join('')}
          </ul>
        </div>
      </div>
      <div style="margin-top:18px;background:#f6feff;border-left:4px solid #27c5ca;padding:12px;border-radius:4px;">
        <p style="font-size:1.05em;color:#19777e;font-weight:700;margin:0;">팁: 3인칭 단수(he, she, it)는 s 붙임!<br>I/you/we/they는 s 안 붙임!</p>
      </div>
    `;
  }
  // English version
  return `
    <div style="margin-bottom:18px;">
      <div style="background:#f6feff;border-left:4px solid #27c5ca;padding:12px;border-radius:4px;">
        <p style="margin:0 0 8px 0;font-size:1.05em;">
          <strong>Simple present</strong> is used for <span style="color:#40d4de;font-weight:700;">habits</span>, <span style="color:#40d4de;font-weight:700;">facts</span>, and <span style="color:#40d4de;font-weight:700;">rules</span>.<br>
          <span style="color:#19777e;font-weight:700;">Examples: I walk to school. She plays soccer.</span>
        </p>
        <p style="margin:0 0 8px 0;font-size:1.05em;">
          <strong>Third person singular (he, she, it)</strong> adds <span style="color:#ffb84d;font-weight:700;">s to the verb</span>.<br>
          <span style="color:#19777e;font-weight:700;">Examples: She plays, He likes, It rains</span>
        </p>
        <p style="margin:0 0 8px 0;font-size:1.05em;">
          <strong>I, you, we, they</strong> use the <span style="color:#40d4de;font-weight:700;">base verb</span>.<br>
          <span style="color:#19777e;font-weight:700;">Examples: I play, You like, We walk, They study</span>
        </p>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div>
        <h4 style="color:#ffb84d;font-weight:700;margin:0 0 10px 0;font-size:1em;">Third Person Singular Examples (add s)</h4>
        <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
          ${thirdPersonExamples.map(ex => `<li style="padding:8px;background:#fff9e6;border-left:3px solid #ffb84d;border-radius:4px;font-size:1em;display:flex;align-items:center;gap:8px;"><span style="font-size:1.3em;">${ex.emoji || '⚽'}</span><div style="display:flex;flex-direction:column;"><span style="font-weight:700;color:#19777e;">${ex.exampleSentence}</span><div style="font-size:0.98em;color:#555;margin-top:2px;">${ex.exampleSentenceKo}</div></div></li>`).join('')}
        </ul>
      </div>
      <div>
        <h4 style="color:#40d4de;font-weight:700;margin:0 0 10px 0;font-size:1em;">I/You/We/They Examples (base verb)</h4>
        <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
          ${nonThirdPersonExamples.map(ex => `<li style="padding:8px;background:#e6f7f8;border-left:3px solid #40d4de;border-radius:4px;font-size:1em;display:flex;align-items:center;gap:8px;"><span style="font-size:1.3em;">${ex.emoji || '🚶'}</span><div style="display:flex;flex-direction:column;"><span style="font-weight:700;color:#19777e;">${ex.exampleSentence}</span><div style="font-size:0.98em;color:#555;margin-top:2px;">${ex.exampleSentenceKo}</div></div></li>`).join('')}
        </ul>
      </div>
    </div>
    <div style="margin-top:18px;background:#f6feff;border-left:4px solid #27c5ca;padding:12px;border-radius:4px;">
      <p style="font-size:1.05em;color:#19777e;font-weight:700;margin:0;">Tip: Third person singular (he, she, it) adds s!<br>I/you/we/they do NOT add s!</p>
    </div>
  `;
}
// Custom chart builder for 'Yes/No Questions'
function buildYesNoQuestionsChart(data, isKorean = false) {
  // Example: Do you like apples? Yes, I do. / Does he play soccer? Yes, he does. / Can you swim? Yes, I can.
  const doExamples = data.filter(ex => ex.word && (ex.word.startsWith('do_') || ex.word.startsWith('does_'))).slice(0, 3);
  const isAreExamples = data.filter(ex => ex.word && (ex.word.startsWith('is_') || ex.word.startsWith('are_'))).slice(0, 3);
  const canExamples = data.filter(ex => ex.word && ex.word.startsWith('can_')).slice(0, 2);

  if (isKorean) {
    return `
      <div style="margin-bottom:18px;">
        <div style="background:#f6feff;border-left:4px solid #27c5ca;padding:12px;border-radius:4px;">
          <p style="margin:0 0 8px 0;font-size:1.05em;">
            <strong>Yes/No 질문</strong>은 <span style="color:#40d4de;font-weight:700;">Do/Does/Is/Are/Can</span>로 시작해요.<br>
            <span style="color:#19777e;font-weight:700;">예: Do you like apples? Does he play soccer? Is she your teacher? Can you swim?</span>
          </p>
          <p style="margin:0 0 8px 0;font-size:1.05em;">
            <strong>짧은 대답</strong>은 질문의 동사를 반복해요.<br>
            <span style="color:#19777e;font-weight:700;">예: Yes, I do. / Yes, he does. / Yes, she is. / Yes, I can.</span>
          </p>
          <p style="margin:0 0 8px 0;font-size:1.05em;">
            <strong>예외:</strong> Are you...? → Yes, I am.
          </p>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;">
        <div>
          <h4 style="color:#40d4de;font-weight:700;margin:0 0 10px 0;font-size:1em;">Do/Does Yes/No 질문 예시</h4>
          <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
            ${doExamples.map(ex => `<li style="padding:8px;background:#e6f7f8;border-left:3px solid #40d4de;border-radius:4px;font-size:1em;display:flex;align-items:center;gap:8px;"><span style="font-size:1.3em;">${ex.emoji || '❓'}</span><div style="display:flex;flex-direction:column;"><span style="font-weight:700;color:#19777e;">${ex.exampleSentence}</span><div style="font-size:0.98em;color:#555;margin-top:2px;">${ex.exampleSentenceKo}</div></div></li>`).join('')}
          </ul>
        </div>
        <div>
          <h4 style="color:#ffb84d;font-weight:700;margin:0 0 10px 0;font-size:1em;">Is/Are Yes/No 질문 예시</h4>
          <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
            ${isAreExamples.map(ex => `<li style="padding:8px;background:#fff9e6;border-left:3px solid #ffb84d;border-radius:4px;font-size:1em;display:flex;align-items:center;gap:8px;"><span style="font-size:1.3em;">${ex.emoji || '❓'}</span><div style="display:flex;flex-direction:column;"><span style="font-weight:700;color:#19777e;">${ex.exampleSentence}</span><div style="font-size:0.98em;color:#555;margin-top:2px;">${ex.exampleSentenceKo}</div></div></li>`).join('')}
          </ul>
        </div>
        <div>
          <h4 style="color:#27c5ca;font-weight:700;margin:0 0 10px 0;font-size:1em;">Can Yes/No 질문 예시</h4>
          <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
            ${canExamples.map(ex => `<li style="padding:8px;background:#e6fff7;border-left:3px solid #27c5ca;border-radius:4px;font-size:1em;display:flex;align-items:center;gap:8px;"><span style="font-size:1.3em;">${ex.emoji || '🤔'}</span><div style="display:flex;flex-direction:column;"><span style="font-weight:700;color:#19777e;">${ex.exampleSentence}</span><div style="font-size:0.98em;color:#555;margin-top:2px;">${ex.exampleSentenceKo}</div></div></li>`).join('')}
          </ul>
        </div>
      </div>
      <div style="margin-top:18px;background:#f6feff;border-left:4px solid #27c5ca;padding:12px;border-radius:4px;">
        <p style="font-size:1.05em;color:#19777e;font-weight:700;margin:0;">팁: "Do you...?" → Yes, I do.<br>"Does he...?" → Yes, he does.<br>"Is she...?" → Yes, she is.<br>"Are you...?" → Yes, I am.<br>"Can you...?" → Yes, I can.</p>
      </div>
    `;
  }
  // English version
  return `
    <div style="margin-bottom:18px;">
      <div style="background:#f6feff;border-left:4px solid #27c5ca;padding:12px;border-radius:4px;">
        <p style="margin:0 0 8px 0;font-size:1.05em;">
          <strong>Yes/No questions</strong> start with <span style="color:#40d4de;font-weight:700;">Do/Does/Is/Are/Can</span>.<br>
          <span style="color:#19777e;font-weight:700;">Examples: Do you like apples? Does he play soccer? Is she your teacher? Can you swim?</span>
        </p>
        <p style="margin:0 0 8px 0;font-size:1.05em;">
          <strong>Short answers</strong> repeat the verb from the question.<br>
          <span style="color:#19777e;font-weight:700;">Examples: Yes, I do. / Yes, he does. / Yes, she is. / Yes, I can.</span>
        </p>
        <p style="margin:0 0 8px 0;font-size:1.05em;">
          <strong>Exception:</strong> Are you...? → Yes, I am.
        </p>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;">
      <div>
        <h4 style="color:#40d4de;font-weight:700;margin:0 0 10px 0;font-size:1em;">Do/Does Yes/No Question Examples</h4>
        <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
          ${doExamples.map(ex => `<li style="padding:8px;background:#e6f7f8;border-left:3px solid #40d4de;border-radius:4px;font-size:1em;display:flex;align-items:center;gap:8px;"><span style="font-size:1.3em;">${ex.emoji || '❓'}</span><div style="display:flex;flex-direction:column;"><span style="font-weight:700;color:#19777e;">${ex.exampleSentence}</span><div style="font-size:0.98em;color:#555;margin-top:2px;">${ex.exampleSentenceKo}</div></div></li>`).join('')}
        </ul>
      </div>
      <div>
        <h4 style="color:#ffb84d;font-weight:700;margin:0 0 10px 0;font-size:1em;">Is/Are Yes/No Question Examples</h4>
        <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
          ${isAreExamples.map(ex => `<li style="padding:8px;background:#fff9e6;border-left:3px solid #ffb84d;border-radius:4px;font-size:1em;display:flex;align-items:center;gap:8px;"><span style="font-size:1.3em;">${ex.emoji || '❓'}</span><div style="display:flex;flex-direction:column;"><span style="font-weight:700;color:#19777e;">${ex.exampleSentence}</span><div style="font-size:0.98em;color:#555;margin-top:2px;">${ex.exampleSentenceKo}</div></div></li>`).join('')}
        </ul>
      </div>
      <div>
        <h4 style="color:#27c5ca;font-weight:700;margin:0 0 10px 0;font-size:1em;">Can Yes/No Question Examples</h4>
        <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
          ${canExamples.map(ex => `<li style="padding:8px;background:#e6fff7;border-left:3px solid #27c5ca;border-radius:4px;font-size:1em;display:flex;align-items:center;gap:8px;"><span style="font-size:1.3em;">${ex.emoji || '🤔'}</span><div style="display:flex;flex-direction:column;"><span style="font-weight:700;color:#19777e;">${ex.exampleSentence}</span><div style="font-size:0.98em;color:#555;margin-top:2px;">${ex.exampleSentenceKo}</div></div></li>`).join('')}
        </ul>
      </div>
    </div>
    <div style="margin-top:18px;background:#f6feff;border-left:4px solid #27c5ca;padding:12px;border-radius:4px;">
      <p style="font-size:1.05em;color:#19777e;font-weight:700;margin:0;">Tip: "Do you...?" → Yes, I do.<br>"Does he...?" → Yes, he does.<br>"Is she...?" → Yes, she is.<br>"Are you...?" → Yes, I am.<br>"Can you...?" → Yes, I can.</p>
    </div>
  `;
}
// Custom chart builder for 'Are there / Is there'
function buildAreIsThereChart(data, isKorean = false) {
  // Split examples
  const isThereExamples = data.filter(ex => ex.word === 'is_there').slice(0, 3);
  const areThereExamples = data.filter(ex => ex.word === 'are_there').slice(0, 3);
  const negativeExamples = data.filter(ex => ex.word === 'is_there_not' || ex.word === 'are_there_not').slice(0, 2);

  if (isKorean) {
    return `
      <div style="margin-bottom:18px;">
        <div style="background:#f6feff;border-left:4px solid #27c5ca;padding:12px;border-radius:4px;">
          <p style="margin:0 0 8px 0;font-size:1.05em;"><strong>Is there</strong>는 <span style="color:#40d4de;font-weight:700;">한 개</span> 또는 <span style="color:#40d4de;font-weight:700;">셀 수 없는 것</span>이 있는지 물어볼 때 써요.<br><span style="color:#19777e;font-weight:700;">예: 물, 우유, 공기, 사랑</span></p>
          <p style="margin:0 0 8px 0;font-size:1.05em;"><strong>Are there</strong>는 <span style="color:#ffb84d;font-weight:700;">여러 개</span>가 있는지 물어볼 때 써요.<br><span style="color:#19777e;font-weight:700;">예: 사과들, 책들, 학생들</span></p>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div>
          <h4 style="color:#40d4de;font-weight:700;margin:0 0 10px 0;font-size:1em;">Is there 예시</h4>
          <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
            ${isThereExamples.map(ex => `<li style="padding:8px;background:#e6f7f8;border-left:3px solid #40d4de;border-radius:4px;font-size:1em;display:flex;align-items:center;gap:8px;"><span style="font-size:1.3em;">${ex.emoji || '🍎'}</span><div style="display:flex;flex-direction:column;"><span style="font-weight:700;color:#19777e;">${ex.exampleSentence}</span><div style="font-size:0.98em;color:#555;margin-top:2px;">${ex.exampleSentenceKo}</div></div></li>`).join('')}
          </ul>
        </div>
        <div>
          <h4 style="color:#ffb84d;font-weight:700;margin:0 0 10px 0;font-size:1em;">Are there 예시</h4>
          <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
            ${areThereExamples.map(ex => `<li style="padding:8px;background:#fff9e6;border-left:3px solid #ffb84d;border-radius:4px;font-size:1em;display:flex;align-items:center;gap:8px;"><span style="font-size:1.3em;">${ex.emoji || '🍏'}</span><div style="display:flex;flex-direction:column;"><span style="font-weight:700;color:#19777e;">${ex.exampleSentence}</span><div style="font-size:0.98em;color:#555;margin-top:2px;">${ex.exampleSentenceKo}</div></div></li>`).join('')}
          </ul>
        </div>
      </div>
      <div style="margin-top:18px;background:#fff7f7;border-left:4px solid #ff6fb0;padding:12px;border-radius:4px;">
        <h4 style="color:#ff6fb0;font-weight:700;margin:0 0 8px 0;">부정문 (없을 때)</h4>
        <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
          ${negativeExamples.map(ex => `<li style="padding:8px;background:#ffe6f5;border-left:3px solid #ff6fb0;border-radius:4px;font-size:1em;display:flex;align-items:center;gap:8px;"><span style="font-size:1.3em;">${ex.emoji || '❌'}</span><div style="display:flex;flex-direction:column;"><span style="font-weight:700;color:#19777e;">${ex.exampleSentence}</span><div style="font-size:0.98em;color:#555;margin-top:2px;">${ex.exampleSentenceKo}</div></div></li>`).join('')}
        </ul>
      </div>
      <div style="margin-top:18px;background:#f6feff;border-left:4px solid #27c5ca;padding:12px;border-radius:4px;">
        <p style="font-size:1.05em;color:#19777e;font-weight:700;margin:0;">팁: "Is there" = 한 개/셀 수 없는 것 있어요?<br>"Are there" = 여러 개 있어요?<br>"Isn't/aren't there" = 없어요?</p>
      </div>
    `;
  }
  // English version
  return `
    <div style="margin-bottom:18px;">
      <div style="background:#f6feff;border-left:4px solid #27c5ca;padding:12px;border-radius:4px;">
        <p style="margin:0 0 8px 0;font-size:1.05em;"><strong>Is there</strong> is for <span style="color:#40d4de;font-weight:700;">one thing</span> or <span style="color:#40d4de;font-weight:700;">uncountable nouns</span> (asking if there is one or some).<br><span style="color:#19777e;font-weight:700;">Examples: water, milk, air, love</span></p>
        <p style="margin:0 0 8px 0;font-size:1.05em;"><strong>Are there</strong> is for <span style="color:#ffb84d;font-weight:700;">more than one</span> (plural nouns, asking if there are many).<br><span style="color:#19777e;font-weight:700;">Examples: apples, books, students</span></p>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div>
        <h4 style="color:#40d4de;font-weight:700;margin:0 0 10px 0;font-size:1em;">Examples with "Is there"</h4>
        <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
          ${isThereExamples.map(ex => `<li style="padding:8px;background:#e6f7f8;border-left:3px solid #40d4de;border-radius:4px;font-size:1em;display:flex;align-items:center;gap:8px;"><span style="font-size:1.3em;">${ex.emoji || '🍎'}</span><div style="display:flex;flex-direction:column;"><span style="font-weight:700;color:#19777e;">${ex.exampleSentence}</span><div style="font-size:0.98em;color:#555;margin-top:2px;">${ex.exampleSentenceKo}</div></div></li>`).join('')}
        </ul>
      </div>
      <div>
        <h4 style="color:#ffb84d;font-weight:700;margin:0 0 10px 0;font-size:1em;">Examples with "Are there"</h4>
        <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
          ${areThereExamples.map(ex => `<li style="padding:8px;background:#fff9e6;border-left:3px solid #ffb84d;border-radius:4px;font-size:1em;display:flex;align-items:center;gap:8px;"><span style="font-size:1.3em;">${ex.emoji || '🍏'}</span><div style="display:flex;flex-direction:column;"><span style="font-weight:700;color:#19777e;">${ex.exampleSentence}</span><div style="font-size:0.98em;color:#555;margin-top:2px;">${ex.exampleSentenceKo}</div></div></li>`).join('')}
        </ul>
      </div>
    </div>
    <div style="margin-top:18px;background:#fff7f7;border-left:4px solid #ff6fb0;padding:12px;border-radius:4px;">
      <h4 style="color:#ff6fb0;font-weight:700;margin:0 0 8px 0;">Negative (when there is nothing)</h4>
      <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
        ${negativeExamples.map(ex => `<li style="padding:8px;background:#ffe6f5;border-left:3px solid #ff6fb0;border-radius:4px;font-size:1em;display:flex;align-items:center;gap:8px;"><span style="font-size:1.3em;">${ex.emoji || '❌'}</span><div style="display:flex;flex-direction:column;"><span style="font-weight:700;color:#19777e;">${ex.exampleSentence}</span><div style="font-size:0.98em;color:#555;margin-top:2px;">${ex.exampleSentenceKo}</div></div></li>`).join('')}
      </ul>
    </div>
    <div style="margin-top:18px;background:#f6feff;border-left:4px solid #27c5ca;padding:12px;border-radius:4px;">
      <p style="font-size:1.05em;color:#19777e;font-weight:700;margin:0;">Tip: "Is there" = one/uncountable? <br>"Are there" = many? <br>"Isn't/aren't there" = nothing!</p>
    </div>
  `;
}
  // ...existing code...
// Custom chart builder for 'There is / There are'
function buildThereIsThereAreChart(data, isKorean = false) {
  // Split examples
  const singularExamples = data.filter(ex => ex.word === 'there_is').slice(0, 3);
  const pluralExamples = data.filter(ex => ex.word === 'there_are').slice(0, 3);
  const negativeExamples = data.filter(ex => ex.word === 'there_isn_t' || ex.word === 'there_aren_t').slice(0, 2);

  if (isKorean) {
    return `
      <div style="margin-bottom:18px;">
        <div style="background:#f6feff;border-left:4px solid #27c5ca;padding:12px;border-radius:4px;">
          <p style="margin:0 0 8px 0;font-size:1.05em;"><strong>There is</strong>는 <span style="color:#40d4de;font-weight:700;">한 개</span> 또는 <span style="color:#40d4de;font-weight:700;">셀 수 없는 것</span>을 말할 때 써요.<br><span style="color:#19777e;font-weight:700;">예: 물, 우유, 공기, 사랑</span></p>
          <p style="margin:0 0 8px 0;font-size:1.05em;"><strong>There are</strong>는 <span style="color:#ffb84d;font-weight:700;">여러 개</span>를 말할 때 써요.<br><span style="color:#19777e;font-weight:700;">예: 사과들, 책들, 학생들</span></p>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div>
          <h4 style="color:#40d4de;font-weight:700;margin:0 0 10px 0;font-size:1em;">There is 예시</h4>
          <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
            ${singularExamples.map(ex => `<li style="padding:8px;background:#e6f7f8;border-left:3px solid #40d4de;border-radius:4px;font-size:1em;display:flex;align-items:center;gap:8px;"><span style="font-size:1.3em;">${ex.emoji || '🍎'}</span><div style="display:flex;flex-direction:column;"><span style="font-weight:700;color:#19777e;">${ex.exampleSentence}</span><div style="font-size:0.98em;color:#555;margin-top:2px;">${ex.exampleSentenceKo}</div></div></li>`).join('')}
          </ul>
        </div>
        <div>
          <h4 style="color:#ffb84d;font-weight:700;margin:0 0 10px 0;font-size:1em;">There are 예시</h4>
          <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
            ${pluralExamples.map(ex => `<li style="padding:8px;background:#fff9e6;border-left:3px solid #ffb84d;border-radius:4px;font-size:1em;display:flex;align-items:center;gap:8px;"><span style="font-size:1.3em;">${ex.emoji || '🍏'}</span><div style="display:flex;flex-direction:column;"><span style="font-weight:700;color:#19777e;">${ex.exampleSentence}</span><div style="font-size:0.98em;color:#555;margin-top:2px;">${ex.exampleSentenceKo}</div></div></li>`).join('')}
          </ul>
        </div>
      </div>
      <div style="margin-top:18px;background:#fff7f7;border-left:4px solid #ff6fb0;padding:12px;border-radius:4px;">
        <h4 style="color:#ff6fb0;font-weight:700;margin:0 0 8px 0;">부정문 (없을 때)</h4>
        <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
          ${negativeExamples.map(ex => `<li style="padding:8px;background:#ffe6f5;border-left:3px solid #ff6fb0;border-radius:4px;font-size:1em;display:flex;align-items:center;gap:8px;"><span style="font-size:1.3em;">${ex.emoji || '❌'}</span><div style="display:flex;flex-direction:column;"><span style="font-weight:700;color:#19777e;">${ex.exampleSentence}</span><div style="font-size:0.98em;color:#555;margin-top:2px;">${ex.exampleSentenceKo}</div></div></li>`).join('')}
        </ul>
      </div>
      <div style="margin-top:18px;background:#f6feff;border-left:4px solid #27c5ca;padding:12px;border-radius:4px;">
        <p style="font-size:1.05em;color:#19777e;font-weight:700;margin:0;">팁: "There is" = 한 개/셀 수 없는 것!<br>"There are" = 여러 개!<br>"There isn't/aren't" = 없어요!</p>
      </div>
    `;
  }
  // English version
  return `
    <div style="margin-bottom:18px;">
      <div style="background:#f6feff;border-left:4px solid #27c5ca;padding:12px;border-radius:4px;">
        <p style="margin:0 0 8px 0;font-size:1.05em;"><strong>There is</strong> is for <span style="color:#40d4de;font-weight:700;">one thing</span> or <span style="color:#40d4de;font-weight:700;">uncountable nouns</span>.<br><span style="color:#19777e;font-weight:700;">Examples: water, milk, air, love</span></p>
        <p style="margin:0 0 8px 0;font-size:1.05em;"><strong>There are</strong> is for <span style="color:#ffb84d;font-weight:700;">more than one</span> (plural nouns).<br><span style="color:#19777e;font-weight:700;">Examples: apples, books, students</span></p>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div>
        <h4 style="color:#40d4de;font-weight:700;margin:0 0 10px 0;font-size:1em;">Examples with "There is"</h4>
        <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
          ${singularExamples.map(ex => `<li style="padding:8px;background:#e6f7f8;border-left:3px solid #40d4de;border-radius:4px;font-size:1em;display:flex;align-items:center;gap:8px;"><span style="font-size:1.3em;">${ex.emoji || '🍎'}</span><div style="display:flex;flex-direction:column;"><span style="font-weight:700;color:#19777e;">${ex.exampleSentence}</span><div style="font-size:0.98em;color:#555;margin-top:2px;">${ex.exampleSentenceKo}</div></div></li>`).join('')}
        </ul>
      </div>
      <div>
        <h4 style="color:#ffb84d;font-weight:700;margin:0 0 10px 0;font-size:1em;">Examples with "There are"</h4>
        <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
          ${pluralExamples.map(ex => `<li style="padding:8px;background:#fff9e6;border-left:3px solid #ffb84d;border-radius:4px;font-size:1em;display:flex;align-items:center;gap:8px;"><span style="font-size:1.3em;">${ex.emoji || '🍏'}</span><div style="display:flex;flex-direction:column;"><span style="font-weight:700;color:#19777e;">${ex.exampleSentence}</span><div style="font-size:0.98em;color:#555;margin-top:2px;">${ex.exampleSentenceKo}</div></div></li>`).join('')}
        </ul>
      </div>
    </div>
    <div style="margin-top:18px;background:#fff7f7;border-left:4px solid #ff6fb0;padding:12px;border-radius:4px;">
      <h4 style="color:#ff6fb0;font-weight:700;margin:0 0 8px 0;">Negative (when there is nothing)</h4>
      <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
        ${negativeExamples.map(ex => `<li style="padding:8px;background:#ffe6f5;border-left:3px solid #ff6fb0;border-radius:4px;font-size:1em;display:flex;align-items:center;gap:8px;"><span style="font-size:1.3em;">${ex.emoji || '❌'}</span><div style="display:flex;flex-direction:column;"><span style="font-weight:700;color:#19777e;">${ex.exampleSentence}</span><div style="font-size:0.98em;color:#555;margin-top:2px;">${ex.exampleSentenceKo}</div></div></li>`).join('')}
      </ul>
    </div>
    <div style="margin-top:18px;background:#f6feff;border-left:4px solid #27c5ca;padding:12px;border-radius:4px;">
      <p style="font-size:1.05em;color:#19777e;font-weight:700;margin:0;">Tip: "There is" = one/uncountable!<br>"There are" = many!<br>"There isn't/aren't" = nothing!</p>
    </div>
  `;
}
  if (hasContractions) {
    return buildBeContractionsChart(grammarData, isKorean, grammarName);
  } else if (name.includes('articles') || name.includes('a vs an')) {
    return buildArticlesChart(grammarData, isKorean);
  } else if (name.includes('want') || name.includes('wants') || name.includes('want vs wants') || name.includes('want vs wants')) {
    return buildWantWantsChart(grammarData, isKorean, grammarName);
  } else if (name.includes('like') || name.includes('likes') || name.includes('like vs likes')) {
    return buildLikeLikesChart(grammarData, isKorean, grammarName);
  } else if (name.includes('this') || name.includes('that') || name.includes('these') || name.includes('those')) {
    return buildDemonstrativesChart(grammarName, grammarData, isKorean);
  } else if (name.includes('in_on_under') || name.includes('in vs on') || name.includes('in vs on vs under') || /\b(in|on|under)\b/.test(name)) {
    return buildInOnUnderChart(grammarData, isKorean, grammarName);
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
// Kid-friendly chart for 'Some vs Any'
function buildSomeAnyChart(data, isKorean = false) {
  const someExamples = data.filter(item => item.article === 'some').slice(0, 4);
  const anyExamples = data.filter(item => item.article === 'any').slice(0, 4);
        if (isKorean) {
          return `
            <div style="margin-bottom:18px;">
              <div style="background:#f6feff;border-left:4px solid #27c5ca;padding:12px;border-radius:4px;">
                <p style="margin:0 0 8px 0;font-size:1.05em;"><strong>some</strong>은 <span style="color:#40d4de;font-weight:700;">긍정문</span>에서 써요. 조금, 몇 개라는 뜻이에요.<br><span style="color:#19777e;font-weight:700;">무언가가 있거나 원할 때 "some"을 써요!</span></p>
                <p style="margin:0 0 8px 0;font-size:1.05em;"><strong>any</strong>는 <span style="color:#ffb84d;font-weight:700;">질문</span>과 <span style="color:#ff6fb0;font-weight:700;">부정문</span>에서 써요.<br><span style="color:#19777e;font-weight:700;">무언가가 없거나 물어볼 때 "any"를 써요!</span></p>
              </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
              <div>
                <h4 style="color:#40d4de;font-weight:700;margin:0 0 10px 0;font-size:1em;">some 예시</h4>
                <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
                  ${someExamples.map(item => `<li style="padding:8px;background:#e6f7f8;border-left:3px solid #40d4de;border-radius:4px;font-size:1em;display:flex;align-items:center;gap:8px;"><span style="font-size:1.3em;">${item.emoji || '🍎'}</span><div style="display:flex;flex-direction:column;"><span style="font-weight:700;color:#19777e;">${item.exampleSentence}</span><div style="font-size:0.98em;color:#555;margin-top:2px;">${item.exampleSentenceKo}</div></div></li>`).join('')}
                </ul>
              </div>
              <div>
                <h4 style="color:#ffb84d;font-weight:700;margin:0 0 10px 0;font-size:1em;">any 예시</h4>
                <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
                  ${anyExamples.map(item => `<li style="padding:8px;background:#fff9e6;border-left:3px solid #ffb84d;border-radius:4px;font-size:1em;display:flex;align-items:center;gap:8px;"><span style="font-size:1.3em;">${item.emoji || '❓'}</span><div style="display:flex;flex-direction:column;"><span style="font-weight:700;color:#19777e;">${item.exampleSentence}</span><div style="font-size:0.98em;color:#555;margin-top:2px;">${item.exampleSentenceKo}</div></div></li>`).join('')}
                </ul>
              </div>
            </div>
            <div style="margin-top:18px;background:#f6feff;border-left:4px solid #27c5ca;padding:12px;border-radius:4px;">
              <p style="font-size:1.05em;color:#19777e;font-weight:700;margin:0;">팁: "some" = 네, 있어요! <br> "any" = 있어요? / 아니요, 없어요!</p>
            </div>
          `;
        }
        return `
          <div style="margin-bottom:18px;">
            <h3 style="color:#19777e;font-weight:700;margin:0 0 12px 0;font-size:1.2em;">Easy Rule</h3>
            <div style="background:#f6feff;border-left:4px solid #27c5ca;padding:12px;border-radius:4px;">
              <p style="margin:0 0 8px 0;font-size:1.05em;"><strong>Some</strong> is for <span style="color:#40d4de;font-weight:700;">positive sentences</span>. It means a little or a few. <br> <span style="color:#19777e;font-weight:700;">We use "some" when we have or want something!</span></p>
              <p style="margin:0 0 8px 0;font-size:1.05em;"><strong>Any</strong> is for <span style="color:#ffb84d;font-weight:700;">questions</span> and <span style="color:#ff6fb0;font-weight:700;">negative sentences</span>. <br> <span style="color:#19777e;font-weight:700;">We use "any" when we ask or say we don't have something!</span></p>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
            <div>
              <h4 style="color:#40d4de;font-weight:700;margin:0 0 10px 0;font-size:1em;">Examples with "some"</h4>
              <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
                ${someExamples.map(item => `<li style="padding:8px;background:#e6f7f8;border-left:3px solid #40d4de;border-radius:4px;font-size:1em;display:flex;align-items:center;gap:8px;"><span style="font-size:1.3em;">${item.emoji || '🍎'}</span><span style="font-weight:700;color:#19777e;">${item.exampleSentence}</span></li>`).join('')}
              </ul>
            </div>
            <div>
              <h4 style="color:#ffb84d;font-weight:700;margin:0 0 10px 0;font-size:1em;">Examples with "any"</h4>
              <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
                ${anyExamples.map(item => `<li style="padding:8px;background:#fff9e6;border-left:3px solid #ffb84d;border-radius:4px;font-size:1em;display:flex;align-items:center;gap:8px;"><span style="font-size:1.3em;">${item.emoji || '❓'}</span><span style="font-weight:700;color:#19777e;">${item.exampleSentence}</span></li>`).join('')}
              </ul>
            </div>
          </div>
          <div style="margin-top:18px;background:#f6feff;border-left:4px solid #27c5ca;padding:12px;border-radius:4px;">
            <p style="font-size:1.05em;color:#19777e;font-weight:700;margin:0;">Tip: "Some" = Yes, I have! <br> "Any" = Do you have? / No, I don't!</p>
          </div>
        `;
}
}

function buildWantWantsChart(data, isKorean = false, grammarName = '') {
  const wantExamples = data ? data.filter(item => (item.article || '').toLowerCase() === 'want').slice(0, 4) : [];
  const wantsExamples = data ? data.filter(item => (item.article || '').toLowerCase() === 'wants').slice(0, 4) : [];

  if (isKorean) {
    return `
      <div style="margin-bottom:18px;">
        <h3 style="color:#19777e;font-weight:700;margin:0 0 12px 0;font-size:1.2em;">규칙</h3>
        <div style="background:#f6feff;border-left:4px solid #27c5ca;padding:12px;border-radius:4px;">
          <p style="margin:0 0 8px 0;"><strong>want</strong>는 I, you, we, they, 그리고 복수 명사와 함께 사용됩니다.</p>
          <p style="margin:0;"><strong>wants</strong>는 he, she, it, 또는 단수 명사와 함께 사용됩니다.</p>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div>
          <h4 style="color:#40d4de;font-weight:700;margin:0 0 10px 0;font-size:0.95em;">want (복수/I/you)</h4>
          <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
            ${wantExamples.map(item => `<li style="padding:8px;background:#e6f7f8;border-left:3px solid #40d4de;border-radius:4px;font-size:0.95em;display:flex;align-items:center;gap:8px;"><span style="font-size:1.2em;">${item.emoji || '•'}</span><div><div style="font-weight:700;color:#19777e;">${item.word || ''} — ${item.exampleSentenceKo || item.exampleSentence || ''}</div><div style="font-size:0.85em;color:#666;">${item.explanationKo || item.explanation || ''}</div></div></li>`).join('')}
          </ul>
        </div>
        <div>
          <h4 style="color:#ffb84d;font-weight:700;margin:0 0 10px 0;font-size:0.95em;">wants (단수/he/she/it)</h4>
          <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
            ${wantsExamples.map(item => `<li style="padding:8px;background:#fff9e6;border-left:3px solid #ffb84d;border-radius:4px;font-size:0.95em;display:flex;align-items:center;gap:8px;"><span style="font-size:1.2em;">${item.emoji || '•'}</span><div><div style="font-weight:700;color:#19777e;">${item.word || ''} — ${item.exampleSentenceKo || item.exampleSentence || ''}</div><div style="font-size:0.85em;color:#666;">${item.explanationKo || item.explanation || ''}</div></div></li>`).join('')}
          </ul>
        </div>
      </div>
    `;
  }

  return `
    <div style="margin-bottom:18px;">
      <h3 style="color:#19777e;font-weight:700;margin:0 0 12px 0;font-size:1.2em;">Rule</h3>
      <div style="background:#f6feff;border-left:4px solid #27c5ca;padding:12px;border-radius:4px;">
        <p style="margin:0 0 8px 0;"><strong>want</strong> is used with I, you, we, they, or plural nouns.</p>
        <p style="margin:0;"><strong>wants</strong> is used with he, she, it, or singular nouns.</p>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div>
        <h4 style="color:#40d4de;font-weight:700;margin:0 0 10px 0;font-size:0.95em;">want (I/you/we/they)</h4>
        <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
          ${wantExamples.map(item => `<li style="padding:8px;background:#e6f7f8;border-left:3px solid #40d4de;border-radius:4px;font-size:0.95em;display:flex;align-items:center;gap:8px;"><span style="font-size:1.2em;">${item.emoji || '•'}</span><div><div style="font-weight:700;color:#19777e;">${item.word || ''} — ${item.exampleSentence || ''}</div><div style="font-size:0.85em;color:#666;">${item.explanation || ''}</div></div></li>`).join('')}
        </ul>
      </div>
      <div>
        <h4 style="color:#ffb84d;font-weight:700;margin:0 0 10px 0;font-size:0.95em;">wants (he/she/it)</h4>
        <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
          ${wantsExamples.map(item => `<li style="padding:8px;background:#fff9e6;border-left:3px solid #ffb84d;border-radius:4px;font-size:0.95em;display:flex;align-items:center;gap:8px;"><span style="font-size:1.2em;">${item.emoji || '•'}</span><div><div style="font-weight:700;color:#19777e;">${item.word || ''} — ${item.exampleSentence || ''}</div><div style="font-size:0.85em;color:#666;">${item.explanation || ''}</div></div></li>`).join('')}
        </ul>
      </div>
    </div>
  `;
}

function buildLikeLikesChart(data, isKorean = false, grammarName = '') {
  const likeExamples = data ? data.filter(item => (item.article || '').toLowerCase() === 'like').slice(0, 4) : [];
  const likesExamples = data ? data.filter(item => (item.article || '').toLowerCase() === 'likes').slice(0, 4) : [];

  if (isKorean) {
    return `
      <div style="margin-bottom:18px;">
        <h3 style="color:#19777e;font-weight:700;margin:0 0 12px 0;font-size:1.2em;">규칙</h3>
        <div style="background:#f6feff;border-left:4px solid #27c5ca;padding:12px;border-radius:4px;">
          <p style="margin:0 0 8px 0;"><strong>like</strong>는 I, you, we, they, 그리고 복수 명사와 함께 사용됩니다.</p>
          <p style="margin:0;"><strong>likes</strong>는 he, she, it, 또는 단수 명사와 함께 사용됩니다.</p>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div>
          <h4 style="color:#40d4de;font-weight:700;margin:0 0 10px 0;font-size:0.95em;">like (복수/I/you)</h4>
          <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
            ${likeExamples.map(item => `<li style="padding:8px;background:#e6f7f8;border-left:3px solid #40d4de;border-radius:4px;font-size:0.95em;display:flex;align-items:center;gap:8px;"><span style="font-size:1.2em;">${item.emoji || '•'}</span><div><div style="font-weight:700;color:#19777e;">${item.word || ''} — ${item.exampleSentenceKo || item.exampleSentence || ''}</div><div style="font-size:0.85em;color:#666;">${item.explanationKo || item.explanation || ''}</div></div></li>`).join('')}
          </ul>
        </div>
        <div>
          <h4 style="color:#ffb84d;font-weight:700;margin:0 0 10px 0;font-size:0.95em;">likes (단수/he/she/it)</h4>
          <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
            ${likesExamples.map(item => `<li style="padding:8px;background:#fff9e6;border-left:3px solid #ffb84d;border-radius:4px;font-size:0.95em;display:flex;align-items:center;gap:8px;"><span style="font-size:1.2em;">${item.emoji || '•'}</span><div><div style="font-weight:700;color:#19777e;">${item.word || ''} — ${item.exampleSentenceKo || item.exampleSentence || ''}</div><div style="font-size:0.85em;color:#666;">${item.explanationKo || item.explanation || ''}</div></div></li>`).join('')}
          </ul>
        </div>
      </div>
    `;
  }

  return `
    <div style="margin-bottom:18px;">
      <h3 style="color:#19777e;font-weight:700;margin:0 0 12px 0;font-size:1.2em;">Rule</h3>
      <div style="background:#f6feff;border-left:4px solid #27c5ca;padding:12px;border-radius:4px;">
        <p style="margin:0 0 8px 0;"><strong>like</strong> is used with I, you, we, they, or plural nouns.</p>
        <p style="margin:0;"><strong>likes</strong> is used with he, she, it, or singular nouns.</p>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div>
        <h4 style="color:#40d4de;font-weight:700;margin:0 0 10px 0;font-size:0.95em;">like (I/you/we/they)</h4>
        <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
          ${likeExamples.map(item => `<li style="padding:8px;background:#e6f7f8;border-left:3px solid #40d4de;border-radius:4px;font-size:0.95em;display:flex;align-items:center;gap:8px;"><span style="font-size:1.2em;">${item.emoji || '•'}</span><div><div style="font-weight:700;color:#19777e;">${item.word || ''} — ${item.exampleSentence || ''}</div><div style="font-size:0.85em;color:#666;">${item.explanation || ''}</div></div></li>`).join('')}
        </ul>
      </div>
      <div>
        <h4 style="color:#ffb84d;font-weight:700;margin:0 0 10px 0;font-size:0.95em;">likes (he/she/it)</h4>
        <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
          ${likesExamples.map(item => `<li style="padding:8px;background:#fff9e6;border-left:3px solid #ffb84d;border-radius:4px;font-size:0.95em;display:flex;align-items:center;gap:8px;"><span style="font-size:1.2em;">${item.emoji || '•'}</span><div><div style="font-weight:700;color:#19777e;">${item.word || ''} — ${item.exampleSentence || ''}</div><div style="font-size:0.85em;color:#666;">${item.explanation || ''}</div></div></li>`).join('')}
        </ul>
      </div>
    </div>
  `;
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

function buildBeContractionsChart(data, isKorean = false, grammarName = '') {
  if (!data || !data.length) return buildGenericChart(data, isKorean);

  // Normalize entries and ensure we have pronoun, fullForm, contraction and examples
  const entries = data.map(item => ({
    pronoun: item.pronoun || item.word || '',
    fullForm: `${item.pronoun || item.word || ''} ${item.fullForm || item.article || ''}`.trim(),
    contraction: item.contraction || item.ending || '',
    example: item.exampleSentence || item.example || '',
    exampleKo: item.exampleSentenceKo || item.exampleKo || ''
  }));

  if (isKorean) {
    return `
      <div style="margin-bottom:18px;">
        <h3 style="color:#19777e;font-weight:700;margin:0 0 12px 0;font-size:1.2em;">규칙</h3>
        <div style="background:#f6feff;border-left:4px solid #27c5ca;padding:12px;border-radius:4px;">
          <p style="margin:0 0 6px 0;">주어와 be 동사를 결합해 줄여 말할 때 쓰는 표현이에요. 예: <strong>I am → I\'m</strong></p>
          <p style="margin:0;">단축형은 말할 때 자주 쓰이며, 공식 문서에서는 약간 덜 사용될 수 있어요.</p>
        </div>
      </div>
        <div style="margin-bottom:10px;display:flex;align-items:center;gap:8px;">
          <div style="background:#e6f7f8;padding:8px 12px;border-radius:8px;border:2px solid #40d4de;font-weight:700;color:#19777e;">${grammarName || "I am → I'm"}</div>
          <div style="font-size:0.93em;color:#666;">주어 + be 동사의 줄임말을 연습해요: 'm, 're, 's</div>
        </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;">
        ${entries.map(e => `
          <div style="background:#fff; border-left:4px solid #27c5ca;border-radius:8px;padding:10px;">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px;">
              <strong style="color:#19777e;">${e.pronoun}</strong>
              <span style="font-size:0.95em;color:#666;">${e.fullForm} → <span style="background:#e6f7f8;padding:3px 6px;border-radius:4px;color:#19777e;">${e.contraction}</span></span>
            </div>
            <div style="font-size:0.9em;color:#444;">${e.exampleKo || e.example || ''}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  return `
    <div style="margin-bottom:18px;">
      <h3 style="color:#19777e;font-weight:700;margin:0 0 12px 0;font-size:1.2em;">Rule</h3>
      <div style="background:#f6feff;border-left:4px solid #27c5ca;padding:12px;border-radius:4px;">
        <p style="margin:0 0 6px 0;">Contractions combine a pronoun and the verb "be". For example: <strong>I am → I'm</strong>.</p>
        <p style="margin:0;">They are common in speech and informal writing. Use the correct contraction to match the subject.</p>
      </div>
    </div>
      <div style="margin-bottom:10px;display:flex;align-items:center;gap:8px;">
        <div style="background:#e6f7f8;padding:8px 12px;border-radius:8px;border:2px solid #40d4de;font-weight:700;color:#19777e;">${grammarName || "I am → I'm"}</div>
        <div style="font-size:0.93em;color:#666;">Try: choose the correct contraction to match the subject and meaning.</div>
      </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;">
      ${entries.map(e => `
        <div style="background:#fff;border-left:4px solid #27c5ca;border-radius:8px;padding:10px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px;">
            <strong style="color:#19777e;">${e.pronoun}</strong>
            <span style="font-size:0.95em;color:#444;">${e.fullForm} → <span style="background:#e6f7f8;padding:3px 6px;border-radius:4px;color:#19777e;font-weight:700;">${e.contraction}</span></span>
          </div>
          <div style="font-size:0.9em;color:#666;">${e.example || ''}</div>
        </div>
      `).join('')}
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

function buildInOnUnderChart(data, isKorean = false, grammarName = '') {
  const inExamples = data ? data.filter(item => (item.article || '').toLowerCase() === 'in').slice(0, 2) : [];
  const onExamples = data ? data.filter(item => (item.article || '').toLowerCase() === 'on').slice(0, 2) : [];
  const underExamples = data ? data.filter(item => (item.article || '').toLowerCase() === 'under').slice(0, 2) : [];

  if (isKorean) {
    return `
      <div style="margin-bottom:18px;">
        <h3 style="color:#19777e;font-weight:700;margin:0 0 12px 0;font-size:1.2em;">규칙</h3>
        <div style="background:#f6feff;border-left:4px solid #27c5ca;padding:12px;border-radius:4px;">
          <p style="margin:0 0 8px 0;">위치 전치사: 간단한 번역과 예제만 보여줍니다.</p>
          <p style="margin:0 0 4px 0;"><strong>in</strong> — 안에</p>
          <p style="margin:0 0 4px 0;"><strong>on</strong> — 위에</p>
          <p style="margin:0;"><strong>under</strong> — 아래에</p>
        </div>
      </div>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
        <div>
          <h4 style="color:#40d4de;font-weight:700;margin:0 0 10px 0;font-size:0.95em;">in — 안에</h4>
          <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
            ${inExamples.map(item => `<li style="padding:8px;background:#e6f7f8;border-left:3px solid #40d4de;border-radius:4px;font-size:0.95em;display:flex;gap:8px;"><span style="font-size:1.2em;">${item.emoji || '•'}</span><div><div style="font-weight:700;color:#19777e;">${item.word || ''}</div><div style="font-size:0.9em;color:#666;">${item.exampleSentenceKo || item.exampleSentence || ''}</div><div style="font-size:0.85em;color:#777;">${item.explanationKo || item.explanation || ''}</div></div></li>`).join('')}
          </ul>
        </div>
        <div>
          <h4 style="color:#ffb84d;font-weight:700;margin:0 0 10px 0;font-size:0.95em;">on — 위에</h4>
          <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
            ${onExamples.map(item => `<li style="padding:8px;background:#fff9e6;border-left:3px solid #ffb84d;border-radius:4px;font-size:0.95em;display:flex;gap:8px;"><span style="font-size:1.2em;">${item.emoji || '•'}</span><div><div style="font-weight:700;color:#19777e;">${item.word || ''}</div><div style="font-size:0.9em;color:#666;">${item.exampleSentenceKo || item.exampleSentence || ''}</div><div style="font-size:0.85em;color:#777;">${item.explanationKo || item.explanation || ''}</div></div></li>`).join('')}
          </ul>
        </div>
        <div>
          <h4 style="color:#ff85d0;font-weight:700;margin:0 0 10px 0;font-size:0.95em;">under — 아래에</h4>
          <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
            ${underExamples.map(item => `<li style="padding:8px;background:#ffe6f5;border-left:3px solid #ff85d0;border-radius:4px;font-size:0.95em;display:flex;gap:8px;"><span style="font-size:1.2em;">${item.emoji || '•'}</span><div><div style="font-weight:700;color:#19777e;">${item.word || ''}</div><div style="font-size:0.9em;color:#666;">${item.exampleSentenceKo || item.exampleSentence || ''}</div><div style="font-size:0.85em;color:#777;">${item.explanationKo || item.explanation || ''}</div></div></li>`).join('')}
          </ul>
        </div>
      </div>
    `;
  }

  return `
  <div style="margin-bottom:18px;">
      <h3 style="color:#19777e;font-weight:700;margin:0 0 12px 0;font-size:1.2em;">Rule</h3>
      <div style="background:#f6feff;border-left:4px solid #27c5ca;padding:12px;border-radius:4px;">
  <p style="margin:0 0 8px 0;">Prepositions that describe position.</p>
  <p style="margin:0 0 4px 0;"><strong>in</strong> - inside a space</p>
  <p style="margin:0 0 4px 0;"><strong>on</strong> - on a surface</p>
  <p style="margin:0;"><strong>under</strong> - below an object</p>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
      <div>
        <h4 style="color:#40d4de;font-weight:700;margin:0 0 10px 0;font-size:0.95em;">in</h4>
        <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
          ${inExamples.map(item => `<li style="padding:8px;background:#e6f7f8;border-left:3px solid #40d4de;border-radius:4px;font-size:0.95em;display:flex;gap:8px;"><span style="font-size:1.2em;">${item.emoji || '•'}</span><div><div style="font-weight:700;color:#19777e;">${item.word || ''}</div><div style="font-size:0.9em;color:#666;">${item.exampleSentence || ''}</div><div style="font-size:0.85em;color:#777;">${item.explanation || ''}</div></div></li>`).join('')}
        </ul>
      </div>
      <div>
        <h4 style="color:#ffb84d;font-weight:700;margin:0 0 10px 0;font-size:0.95em;">on</h4>
        <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
          ${onExamples.map(item => `<li style="padding:8px;background:#fff9e6;border-left:3px solid #ffb84d;border-radius:4px;font-size:0.95em;display:flex;gap:8px;"><span style="font-size:1.2em;">${item.emoji || '•'}</span><div><div style="font-weight:700;color:#19777e;">${item.word || ''}</div><div style="font-size:0.9em;color:#666;">${item.exampleSentence || ''}</div><div style="font-size:0.85em;color:#777;">${item.explanation || ''}</div></div></li>`).join('')}
        </ul>
      </div>
      <div>
        <h4 style="color:#ff85d0;font-weight:700;margin:0 0 10px 0;font-size:0.95em;">under</h4>
        <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
          ${underExamples.map(item => `<li style="padding:8px;background:#ffe6f5;border-left:3px solid #ff85d0;border-radius:4px;font-size:0.95em;display:flex;gap:8px;"><span style="font-size:1.2em;">${item.emoji || '•'}</span><div><div style="font-weight:700;color:#19777e;">${item.word || ''}</div><div style="font-size:0.9em;color:#666;">${item.exampleSentence || ''}</div><div style="font-size:0.85em;color:#777;">${item.explanation || ''}</div></div></li>`).join('')}
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

// ==========================================
// Level 3 Tense Chart Builders
// ==========================================

// Be Going To Future chart builder
function buildBeGoingToFutureChart(data, isKorean = false) {
  const iExamples = data.filter(ex => ex.word && ex.word.startsWith('i_am_going_to')).slice(0, 2);
  const sheHeExamples = data.filter(ex => ex.word && (ex.word.startsWith('she_is_going_to') || ex.word.startsWith('he_is_going_to'))).slice(0, 2);
  const weTheyExamples = data.filter(ex => ex.word && (ex.word.startsWith('we_are_going_to') || ex.word.startsWith('they_are_going_to'))).slice(0, 2);

  if (isKorean) {
    return `
      <div style="margin-bottom:18px;">
        <div style="background:#e8f5e9;border-left:4px solid #4caf50;padding:12px;border-radius:4px;">
          <p style="margin:0 0 8px 0;font-size:1.05em;">
            <strong>"Be going to"</strong>는 <span style="color:#4caf50;font-weight:700;">미래의 계획</span>을 말할 때 써요.<br>
            <span style="color:#19777e;font-weight:700;">예: I am going to visit my aunt. (나는 이모를 방문할 예정이에요.)</span>
          </p>
          <p style="margin:0 0 8px 0;font-size:1.05em;">
            <strong>구조:</strong> <span style="color:#ff6fb0;font-weight:700;">주어 + am/is/are + going to + 동사원형</span>
          </p>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
        <div>
          <h4 style="color:#4caf50;font-weight:700;margin:0 0 10px 0;font-size:0.95em;">I am going to... (나는 ~할 거예요)</h4>
          <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
            ${iExamples.map(ex => `<li style="padding:8px;background:#e8f5e9;border-left:3px solid #4caf50;border-radius:4px;font-size:0.95em;display:flex;align-items:center;gap:8px;"><span style="font-size:1.3em;">${ex.emoji || '🚀'}</span><div style="display:flex;flex-direction:column;"><span style="font-weight:700;color:#19777e;">${ex.en}</span><div style="font-size:0.9em;color:#555;margin-top:2px;">${ex.ko}</div></div></li>`).join('')}
          </ul>
        </div>
        <div>
          <h4 style="color:#2196f3;font-weight:700;margin:0 0 10px 0;font-size:0.95em;">He/She is going to... (그/그녀는 ~할 거예요)</h4>
          <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
            ${sheHeExamples.map(ex => `<li style="padding:8px;background:#e3f2fd;border-left:3px solid #2196f3;border-radius:4px;font-size:0.95em;display:flex;align-items:center;gap:8px;"><span style="font-size:1.3em;">${ex.emoji || '📚'}</span><div style="display:flex;flex-direction:column;"><span style="font-weight:700;color:#19777e;">${ex.en}</span><div style="font-size:0.9em;color:#555;margin-top:2px;">${ex.ko}</div></div></li>`).join('')}
          </ul>
        </div>
        <div>
          <h4 style="color:#ff9800;font-weight:700;margin:0 0 10px 0;font-size:0.95em;">We/They are going to... (우리/그들은 ~할 거예요)</h4>
          <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
            ${weTheyExamples.map(ex => `<li style="padding:8px;background:#fff3e0;border-left:3px solid #ff9800;border-radius:4px;font-size:0.95em;display:flex;align-items:center;gap:8px;"><span style="font-size:1.3em;">${ex.emoji || '🎫'}</span><div style="display:flex;flex-direction:column;"><span style="font-weight:700;color:#19777e;">${ex.en}</span><div style="font-size:0.9em;color:#555;margin-top:2px;">${ex.ko}</div></div></li>`).join('')}
          </ul>
        </div>
      </div>
      <div style="margin-top:18px;background:#e8f5e9;border-left:4px solid #4caf50;padding:12px;border-radius:4px;">
        <p style="font-size:1.05em;color:#19777e;font-weight:700;margin:0;">팁: I → am | He/She/It → is | We/You/They → are<br>+ going to + 동사원형!</p>
      </div>
    `;
  }
  // English version
  return `
    <div style="margin-bottom:18px;">
      <div style="background:#e8f5e9;border-left:4px solid #4caf50;padding:12px;border-radius:4px;">
        <p style="margin:0 0 8px 0;font-size:1.05em;">
          <strong>"Be going to"</strong> is used to talk about <span style="color:#4caf50;font-weight:700;">future plans and intentions</span>.<br>
          <span style="color:#19777e;font-weight:700;">Example: I am going to visit my aunt.</span>
        </p>
        <p style="margin:0 0 8px 0;font-size:1.05em;">
          <strong>Structure:</strong> <span style="color:#ff6fb0;font-weight:700;">Subject + am/is/are + going to + base verb</span>
        </p>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
      <div>
        <h4 style="color:#4caf50;font-weight:700;margin:0 0 10px 0;font-size:0.95em;">I am going to...</h4>
        <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
          ${iExamples.map(ex => `<li style="padding:8px;background:#e8f5e9;border-left:3px solid #4caf50;border-radius:4px;font-size:0.95em;display:flex;align-items:center;gap:8px;"><span style="font-size:1.3em;">${ex.emoji || '🚀'}</span><div style="display:flex;flex-direction:column;"><span style="font-weight:700;color:#19777e;">${ex.en}</span><div style="font-size:0.9em;color:#555;margin-top:2px;">${ex.ko}</div></div></li>`).join('')}
        </ul>
      </div>
      <div>
        <h4 style="color:#2196f3;font-weight:700;margin:0 0 10px 0;font-size:0.95em;">He/She is going to...</h4>
        <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
          ${sheHeExamples.map(ex => `<li style="padding:8px;background:#e3f2fd;border-left:3px solid #2196f3;border-radius:4px;font-size:0.95em;display:flex;align-items:center;gap:8px;"><span style="font-size:1.3em;">${ex.emoji || '📚'}</span><div style="display:flex;flex-direction:column;"><span style="font-weight:700;color:#19777e;">${ex.en}</span><div style="font-size:0.9em;color:#555;margin-top:2px;">${ex.ko}</div></div></li>`).join('')}
        </ul>
      </div>
      <div>
        <h4 style="color:#ff9800;font-weight:700;margin:0 0 10px 0;font-size:0.95em;">We/They are going to...</h4>
        <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
          ${weTheyExamples.map(ex => `<li style="padding:8px;background:#fff3e0;border-left:3px solid #ff9800;border-radius:4px;font-size:0.95em;display:flex;align-items:center;gap:8px;"><span style="font-size:1.3em;">${ex.emoji || '🎫'}</span><div style="display:flex;flex-direction:column;"><span style="font-weight:700;color:#19777e;">${ex.en}</span><div style="font-size:0.9em;color:#555;margin-top:2px;">${ex.ko}</div></div></li>`).join('')}
        </ul>
      </div>
    </div>
    <div style="margin-top:18px;background:#e8f5e9;border-left:4px solid #4caf50;padding:12px;border-radius:4px;">
      <p style="font-size:1.05em;color:#19777e;font-weight:700;margin:0;">Tip: I → am | He/She/It → is | We/You/They → are<br>+ going to + base verb!</p>
    </div>
  `;
}

// Be Going To Questions chart builder
function buildBeGoingToQuestionsChart(data, isKorean = false) {
  const areYouExamples = data.filter(ex => ex.word && ex.word.startsWith('are_you_going_to')).slice(0, 2);
  const isHeExamples = data.filter(ex => ex.word && (ex.word.startsWith('is_she_going_to') || ex.word.startsWith('is_he_going_to'))).slice(0, 2);
  const areWeTheyExamples = data.filter(ex => ex.word && (ex.word.startsWith('are_we_going_to') || ex.word.startsWith('are_they_going_to'))).slice(0, 2);

  if (isKorean) {
    return `
      <div style="margin-bottom:18px;">
        <div style="background:#fce4ec;border-left:4px solid #e91e63;padding:12px;border-radius:4px;">
          <p style="margin:0 0 8px 0;font-size:1.05em;">
            <strong>"Be going to" 의문문</strong>은 <span style="color:#e91e63;font-weight:700;">미래 계획을 물어볼 때</span> 써요.<br>
            <span style="color:#19777e;font-weight:700;">예: Are you going to eat pizza? (피자 먹을 거예요?)</span>
          </p>
          <p style="margin:0 0 8px 0;font-size:1.05em;">
            <strong>구조:</strong> <span style="color:#ff6fb0;font-weight:700;">Am/Is/Are + 주어 + going to + 동사원형?</span>
          </p>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
        <div>
          <h4 style="color:#e91e63;font-weight:700;margin:0 0 10px 0;font-size:0.95em;">Are you going to...? (너는 ~할 거야?)</h4>
          <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
            ${areYouExamples.map(ex => `<li style="padding:8px;background:#fce4ec;border-left:3px solid #e91e63;border-radius:4px;font-size:0.95em;display:flex;align-items:center;gap:8px;"><span style="font-size:1.3em;">${ex.emoji || '❓'}</span><div style="display:flex;flex-direction:column;"><span style="font-weight:700;color:#19777e;">${ex.en}</span><div style="font-size:0.9em;color:#555;margin-top:2px;">${ex.ko}</div></div></li>`).join('')}
          </ul>
        </div>
        <div>
          <h4 style="color:#9c27b0;font-weight:700;margin:0 0 10px 0;font-size:0.95em;">Is he/she going to...? (그/그녀는 ~할 거야?)</h4>
          <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
            ${isHeExamples.map(ex => `<li style="padding:8px;background:#f3e5f5;border-left:3px solid #9c27b0;border-radius:4px;font-size:0.95em;display:flex;align-items:center;gap:8px;"><span style="font-size:1.3em;">${ex.emoji || '🤔'}</span><div style="display:flex;flex-direction:column;"><span style="font-weight:700;color:#19777e;">${ex.en}</span><div style="font-size:0.9em;color:#555;margin-top:2px;">${ex.ko}</div></div></li>`).join('')}
          </ul>
        </div>
        <div>
          <h4 style="color:#673ab7;font-weight:700;margin:0 0 10px 0;font-size:0.95em;">Are we/they going to...? (우리/그들은 ~할 거야?)</h4>
          <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
            ${areWeTheyExamples.map(ex => `<li style="padding:8px;background:#ede7f6;border-left:3px solid #673ab7;border-radius:4px;font-size:0.95em;display:flex;align-items:center;gap:8px;"><span style="font-size:1.3em;">${ex.emoji || '🎮'}</span><div style="display:flex;flex-direction:column;"><span style="font-weight:700;color:#19777e;">${ex.en}</span><div style="font-size:0.9em;color:#555;margin-top:2px;">${ex.ko}</div></div></li>`).join('')}
          </ul>
        </div>
      </div>
      <div style="margin-top:18px;background:#fce4ec;border-left:4px solid #e91e63;padding:12px;border-radius:4px;">
        <p style="font-size:1.05em;color:#19777e;font-weight:700;margin:0;">팁: Am/Is/Are를 문장 앞으로!<br>Am I...? | Is he/she/it...? | Are you/we/they...?</p>
      </div>
    `;
  }
  // English version
  return `
    <div style="margin-bottom:18px;">
      <div style="background:#fce4ec;border-left:4px solid #e91e63;padding:12px;border-radius:4px;">
        <p style="margin:0 0 8px 0;font-size:1.05em;">
          <strong>"Be going to" questions</strong> are used to <span style="color:#e91e63;font-weight:700;">ask about future plans</span>.<br>
          <span style="color:#19777e;font-weight:700;">Example: Are you going to eat pizza?</span>
        </p>
        <p style="margin:0 0 8px 0;font-size:1.05em;">
          <strong>Structure:</strong> <span style="color:#ff6fb0;font-weight:700;">Am/Is/Are + subject + going to + base verb?</span>
        </p>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
      <div>
        <h4 style="color:#e91e63;font-weight:700;margin:0 0 10px 0;font-size:0.95em;">Are you going to...?</h4>
        <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
          ${areYouExamples.map(ex => `<li style="padding:8px;background:#fce4ec;border-left:3px solid #e91e63;border-radius:4px;font-size:0.95em;display:flex;align-items:center;gap:8px;"><span style="font-size:1.3em;">${ex.emoji || '❓'}</span><div style="display:flex;flex-direction:column;"><span style="font-weight:700;color:#19777e;">${ex.en}</span><div style="font-size:0.9em;color:#555;margin-top:2px;">${ex.ko}</div></div></li>`).join('')}
        </ul>
      </div>
      <div>
        <h4 style="color:#9c27b0;font-weight:700;margin:0 0 10px 0;font-size:0.95em;">Is he/she going to...?</h4>
        <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
          ${isHeExamples.map(ex => `<li style="padding:8px;background:#f3e5f5;border-left:3px solid #9c27b0;border-radius:4px;font-size:0.95em;display:flex;align-items:center;gap:8px;"><span style="font-size:1.3em;">${ex.emoji || '🤔'}</span><div style="display:flex;flex-direction:column;"><span style="font-weight:700;color:#19777e;">${ex.en}</span><div style="font-size:0.9em;color:#555;margin-top:2px;">${ex.ko}</div></div></li>`).join('')}
        </ul>
      </div>
      <div>
        <h4 style="color:#673ab7;font-weight:700;margin:0 0 10px 0;font-size:0.95em;">Are we/they going to...?</h4>
        <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
          ${areWeTheyExamples.map(ex => `<li style="padding:8px;background:#ede7f6;border-left:3px solid #673ab7;border-radius:4px;font-size:0.95em;display:flex;align-items:center;gap:8px;"><span style="font-size:1.3em;">${ex.emoji || '🎮'}</span><div style="display:flex;flex-direction:column;"><span style="font-weight:700;color:#19777e;">${ex.en}</span><div style="font-size:0.9em;color:#555;margin-top:2px;">${ex.ko}</div></div></li>`).join('')}
        </ul>
      </div>
    </div>
    <div style="margin-top:18px;background:#fce4ec;border-left:4px solid #e91e63;padding:12px;border-radius:4px;">
      <p style="font-size:1.05em;color:#19777e;font-weight:700;margin:0;">Tip: Move Am/Is/Are to the front!<br>Am I...? | Is he/she/it...? | Are you/we/they...?</p>
    </div>
  `;
}

// Past Simple Regular chart builder
function buildPastSimpleRegularChart(data, isKorean = false) {
  const iExamples = data.filter(ex => ex.word && ex.word.startsWith('i_')).slice(0, 2);
  const sheHeExamples = data.filter(ex => ex.word && (ex.word.startsWith('she_') || ex.word.startsWith('he_'))).slice(0, 2);
  const weTheyExamples = data.filter(ex => ex.word && (ex.word.startsWith('we_') || ex.word.startsWith('they_'))).slice(0, 2);

  if (isKorean) {
    return `
      <div style="margin-bottom:18px;">
        <div style="background:#e3f2fd;border-left:4px solid #2196f3;padding:12px;border-radius:4px;">
          <p style="margin:0 0 8px 0;font-size:1.05em;">
            <strong>규칙 동사의 과거형</strong>은 동사 뒤에 <span style="color:#2196f3;font-weight:700;">-ed</span>를 붙여요.<br>
            <span style="color:#19777e;font-weight:700;">예: walk → walked, play → played, clean → cleaned</span>
          </p>
          <p style="margin:0 0 8px 0;font-size:1.05em;">
            <strong>규칙:</strong><br>
            • 대부분: +ed (walked, played)<br>
            • e로 끝나면: +d (liked, moved)<br>
            • 자음+y: y를 i로 바꾸고 +ed (studied, cried)
          </p>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
        <div>
          <h4 style="color:#2196f3;font-weight:700;margin:0 0 10px 0;font-size:0.95em;">I + 과거형 (나는 ~했어요)</h4>
          <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
            ${iExamples.map(ex => `<li style="padding:8px;background:#e3f2fd;border-left:3px solid #2196f3;border-radius:4px;font-size:0.95em;display:flex;align-items:center;gap:8px;"><span style="font-size:1.3em;">${ex.emoji || '🚶'}</span><div style="display:flex;flex-direction:column;"><span style="font-weight:700;color:#19777e;">${ex.en}</span><div style="font-size:0.9em;color:#555;margin-top:2px;">${ex.ko}</div></div></li>`).join('')}
          </ul>
        </div>
        <div>
          <h4 style="color:#00bcd4;font-weight:700;margin:0 0 10px 0;font-size:0.95em;">He/She + 과거형 (그/그녀는 ~했어요)</h4>
          <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
            ${sheHeExamples.map(ex => `<li style="padding:8px;background:#e0f7fa;border-left:3px solid #00bcd4;border-radius:4px;font-size:0.95em;display:flex;align-items:center;gap:8px;"><span style="font-size:1.3em;">${ex.emoji || '🎹'}</span><div style="display:flex;flex-direction:column;"><span style="font-weight:700;color:#19777e;">${ex.en}</span><div style="font-size:0.9em;color:#555;margin-top:2px;">${ex.ko}</div></div></li>`).join('')}
          </ul>
        </div>
        <div>
          <h4 style="color:#009688;font-weight:700;margin:0 0 10px 0;font-size:0.95em;">We/They + 과거형 (우리/그들은 ~했어요)</h4>
          <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
            ${weTheyExamples.map(ex => `<li style="padding:8px;background:#e0f2f1;border-left:3px solid #009688;border-radius:4px;font-size:0.95em;display:flex;align-items:center;gap:8px;"><span style="font-size:1.3em;">${ex.emoji || '🎬'}</span><div style="display:flex;flex-direction:column;"><span style="font-weight:700;color:#19777e;">${ex.en}</span><div style="font-size:0.9em;color:#555;margin-top:2px;">${ex.ko}</div></div></li>`).join('')}
          </ul>
        </div>
      </div>
      <div style="margin-top:18px;background:#e3f2fd;border-left:4px solid #2196f3;padding:12px;border-radius:4px;">
        <p style="font-size:1.05em;color:#19777e;font-weight:700;margin:0;">팁: 규칙 동사는 모든 주어에 같은 형태!<br>I walked = She walked = They walked</p>
      </div>
    `;
  }
  // English version
  return `
    <div style="margin-bottom:18px;">
      <div style="background:#e3f2fd;border-left:4px solid #2196f3;padding:12px;border-radius:4px;">
        <p style="margin:0 0 8px 0;font-size:1.05em;">
          <strong>Regular past tense verbs</strong> add <span style="color:#2196f3;font-weight:700;">-ed</span> to the base form.<br>
          <span style="color:#19777e;font-weight:700;">Examples: walk → walked, play → played, clean → cleaned</span>
        </p>
        <p style="margin:0 0 8px 0;font-size:1.05em;">
          <strong>Spelling rules:</strong><br>
          • Most verbs: +ed (walked, played)<br>
          • Ends in e: +d (liked, moved)<br>
          • Consonant + y: change y to i, +ed (studied, cried)
        </p>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
      <div>
        <h4 style="color:#2196f3;font-weight:700;margin:0 0 10px 0;font-size:0.95em;">I + past verb</h4>
        <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
          ${iExamples.map(ex => `<li style="padding:8px;background:#e3f2fd;border-left:3px solid #2196f3;border-radius:4px;font-size:0.95em;display:flex;align-items:center;gap:8px;"><span style="font-size:1.3em;">${ex.emoji || '🚶'}</span><div style="display:flex;flex-direction:column;"><span style="font-weight:700;color:#19777e;">${ex.en}</span><div style="font-size:0.9em;color:#555;margin-top:2px;">${ex.ko}</div></div></li>`).join('')}
        </ul>
      </div>
      <div>
        <h4 style="color:#00bcd4;font-weight:700;margin:0 0 10px 0;font-size:0.95em;">He/She + past verb</h4>
        <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
          ${sheHeExamples.map(ex => `<li style="padding:8px;background:#e0f7fa;border-left:3px solid #00bcd4;border-radius:4px;font-size:0.95em;display:flex;align-items:center;gap:8px;"><span style="font-size:1.3em;">${ex.emoji || '🎹'}</span><div style="display:flex;flex-direction:column;"><span style="font-weight:700;color:#19777e;">${ex.en}</span><div style="font-size:0.9em;color:#555;margin-top:2px;">${ex.ko}</div></div></li>`).join('')}
        </ul>
      </div>
      <div>
        <h4 style="color:#009688;font-weight:700;margin:0 0 10px 0;font-size:0.95em;">We/They + past verb</h4>
        <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
          ${weTheyExamples.map(ex => `<li style="padding:8px;background:#e0f2f1;border-left:3px solid #009688;border-radius:4px;font-size:0.95em;display:flex;align-items:center;gap:8px;"><span style="font-size:1.3em;">${ex.emoji || '🎬'}</span><div style="display:flex;flex-direction:column;"><span style="font-weight:700;color:#19777e;">${ex.en}</span><div style="font-size:0.9em;color:#555;margin-top:2px;">${ex.ko}</div></div></li>`).join('')}
        </ul>
      </div>
    </div>
    <div style="margin-top:18px;background:#e3f2fd;border-left:4px solid #2196f3;padding:12px;border-radius:4px;">
      <p style="font-size:1.05em;color:#19777e;font-weight:700;margin:0;">Tip: Regular past tense is the SAME for all subjects!<br>I walked = She walked = They walked</p>
    </div>
  `;
}

// Past vs Future chart builder
function buildPastVsFutureChart(data, isKorean = false) {
  const examples = data.slice(0, 4);

  if (isKorean) {
    return `
      <div style="margin-bottom:18px;">
        <div style="background:#fff3e0;border-left:4px solid #ff9800;padding:12px;border-radius:4px;">
          <p style="margin:0 0 8px 0;font-size:1.05em;">
            <strong>과거 vs 미래</strong> - 시제를 비교해요!<br>
            <span style="color:#9c27b0;font-weight:700;">과거:</span> 이미 일어난 일 (yesterday, last week)<br>
            <span style="color:#4caf50;font-weight:700;">미래:</span> 앞으로 일어날 일 (tomorrow, next week)
          </p>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div>
          <h4 style="color:#9c27b0;font-weight:700;margin:0 0 10px 0;font-size:1em;">⏪ 과거 (Past)</h4>
          <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
            ${examples.map(ex => {
              const pastPart = ex.en.split('.')[0] + '.';
              return `<li style="padding:8px;background:#f3e5f5;border-left:3px solid #9c27b0;border-radius:4px;font-size:0.95em;display:flex;align-items:center;gap:8px;"><span style="font-size:1.3em;">${ex.emoji || '⏳'}</span><span style="font-weight:600;color:#19777e;">${pastPart}</span></li>`;
            }).join('')}
          </ul>
        </div>
        <div>
          <h4 style="color:#4caf50;font-weight:700;margin:0 0 10px 0;font-size:1em;">⏩ 미래 (Future)</h4>
          <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
            ${examples.map(ex => {
              const parts = ex.en.split('.');
              const futurePart = parts.length > 1 ? parts[1].trim() + '.' : parts[0];
              return `<li style="padding:8px;background:#e8f5e9;border-left:3px solid #4caf50;border-radius:4px;font-size:0.95em;display:flex;align-items:center;gap:8px;"><span style="font-size:1.3em;">${ex.emoji || '🚀'}</span><span style="font-weight:600;color:#19777e;">${futurePart}</span></li>`;
            }).join('')}
          </ul>
        </div>
      </div>
      <div style="margin-top:18px;background:#fff3e0;border-left:4px solid #ff9800;padding:12px;border-radius:4px;">
        <p style="font-size:1.05em;color:#19777e;font-weight:700;margin:0;">팁: 과거 = -ed / 불규칙 동사<br>미래 = will + 동사원형</p>
      </div>
    `;
  }
  // English version
  return `
    <div style="margin-bottom:18px;">
      <div style="background:#fff3e0;border-left:4px solid #ff9800;padding:12px;border-radius:4px;">
        <p style="margin:0 0 8px 0;font-size:1.05em;">
          <strong>Past vs Future</strong> - Compare the tenses!<br>
          <span style="color:#9c27b0;font-weight:700;">Past:</span> Already happened (yesterday, last week)<br>
          <span style="color:#4caf50;font-weight:700;">Future:</span> Will happen (tomorrow, next week)
        </p>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div>
        <h4 style="color:#9c27b0;font-weight:700;margin:0 0 10px 0;font-size:1em;">⏪ Past</h4>
        <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
          ${examples.map(ex => {
            const pastPart = ex.en.split('.')[0] + '.';
            return `<li style="padding:8px;background:#f3e5f5;border-left:3px solid #9c27b0;border-radius:4px;font-size:0.95em;display:flex;align-items:center;gap:8px;"><span style="font-size:1.3em;">${ex.emoji || '⏳'}</span><span style="font-weight:600;color:#19777e;">${pastPart}</span></li>`;
          }).join('')}
        </ul>
      </div>
      <div>
        <h4 style="color:#4caf50;font-weight:700;margin:0 0 10px 0;font-size:1em;">⏩ Future</h4>
        <ul style="list-style:none;padding:0;margin:0;gap:8px;display:flex;flex-direction:column;">
          ${examples.map(ex => {
            const parts = ex.en.split('.');
            const futurePart = parts.length > 1 ? parts[1].trim() + '.' : parts[0];
            return `<li style="padding:8px;background:#e8f5e9;border-left:3px solid #4caf50;border-radius:4px;font-size:0.95em;display:flex;align-items:center;gap:8px;"><span style="font-size:1.3em;">${ex.emoji || '🚀'}</span><span style="font-weight:600;color:#19777e;">${futurePart}</span></li>`;
          }).join('')}
        </ul>
      </div>
    </div>
    <div style="margin-top:18px;background:#fff3e0;border-left:4px solid #ff9800;padding:12px;border-radius:4px;">
      <p style="font-size:1.05em;color:#19777e;font-weight:700;margin:0;">Tip: Past = -ed / irregular verb<br>Future = will + base verb</p>
    </div>
  `;
}

// All Tenses Practice chart builder
function buildAllTensesPracticeChart(data, isKorean = false) {
  const examples = data.slice(0, 3);

  if (isKorean) {
    return `
      <div style="margin-bottom:18px;">
        <div style="background:#ffebee;border-left:4px solid #f44336;padding:12px;border-radius:4px;">
          <p style="margin:0 0 8px 0;font-size:1.05em;">
            <strong>4가지 시제 연습!</strong><br>
            <span style="color:#9c27b0;font-weight:700;">과거:</span> ~했어요 (played, studied)<br>
            <span style="color:#2196f3;font-weight:700;">현재:</span> ~해요 (play, study)<br>
            <span style="color:#4caf50;font-weight:700;">미래:</span> ~할 거예요 (will play, will study)<br>
            <span style="color:#ff9800;font-weight:700;">현재진행:</span> ~하고 있어요 (am/is/are playing)
          </p>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">
        <div>
          <h4 style="color:#9c27b0;font-weight:700;margin:0 0 8px 0;font-size:0.85em;">⏪ Past</h4>
          <ul style="list-style:none;padding:0;margin:0;gap:6px;display:flex;flex-direction:column;font-size:0.85em;">
            ${examples.map(ex => `<li style="padding:6px;background:#f3e5f5;border-left:2px solid #9c27b0;border-radius:3px;">${ex.emoji || '📝'} played</li>`).join('')}
          </ul>
        </div>
        <div>
          <h4 style="color:#2196f3;font-weight:700;margin:0 0 8px 0;font-size:0.85em;">📍 Present</h4>
          <ul style="list-style:none;padding:0;margin:0;gap:6px;display:flex;flex-direction:column;font-size:0.85em;">
            ${examples.map(ex => `<li style="padding:6px;background:#e3f2fd;border-left:2px solid #2196f3;border-radius:3px;">${ex.emoji || '📝'} play</li>`).join('')}
          </ul>
        </div>
        <div>
          <h4 style="color:#4caf50;font-weight:700;margin:0 0 8px 0;font-size:0.85em;">⏩ Future</h4>
          <ul style="list-style:none;padding:0;margin:0;gap:6px;display:flex;flex-direction:column;font-size:0.85em;">
            ${examples.map(ex => `<li style="padding:6px;background:#e8f5e9;border-left:2px solid #4caf50;border-radius:3px;">${ex.emoji || '📝'} will play</li>`).join('')}
          </ul>
        </div>
        <div>
          <h4 style="color:#ff9800;font-weight:700;margin:0 0 8px 0;font-size:0.85em;">🔄 Continuous</h4>
          <ul style="list-style:none;padding:0;margin:0;gap:6px;display:flex;flex-direction:column;font-size:0.85em;">
            ${examples.map(ex => `<li style="padding:6px;background:#fff3e0;border-left:2px solid #ff9800;border-radius:3px;">${ex.emoji || '📝'} is playing</li>`).join('')}
          </ul>
        </div>
      </div>
      <div style="margin-top:18px;background:#ffebee;border-left:4px solid #f44336;padding:12px;border-radius:4px;">
        <p style="font-size:0.95em;color:#19777e;font-weight:700;margin:0;">
          과거 = -ed | 현재 = 원형 | 미래 = will + 원형 | 진행 = be + -ing
        </p>
      </div>
    `;
  }
  // English version
  return `
    <div style="margin-bottom:18px;">
      <div style="background:#ffebee;border-left:4px solid #f44336;padding:12px;border-radius:4px;">
        <p style="margin:0 0 8px 0;font-size:1.05em;">
          <strong>Practice 4 Tenses!</strong><br>
          <span style="color:#9c27b0;font-weight:700;">Past:</span> Already happened (played, studied)<br>
          <span style="color:#2196f3;font-weight:700;">Present:</span> Happens regularly (play, study)<br>
          <span style="color:#4caf50;font-weight:700;">Future:</span> Will happen (will play, will study)<br>
          <span style="color:#ff9800;font-weight:700;">Continuous:</span> Happening now (am/is/are playing)
        </p>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">
      <div>
        <h4 style="color:#9c27b0;font-weight:700;margin:0 0 8px 0;font-size:0.85em;">⏪ Past</h4>
        <ul style="list-style:none;padding:0;margin:0;gap:6px;display:flex;flex-direction:column;font-size:0.85em;">
          ${examples.map(ex => `<li style="padding:6px;background:#f3e5f5;border-left:2px solid #9c27b0;border-radius:3px;">${ex.emoji || '📝'} played</li>`).join('')}
        </ul>
      </div>
      <div>
        <h4 style="color:#2196f3;font-weight:700;margin:0 0 8px 0;font-size:0.85em;">📍 Present</h4>
        <ul style="list-style:none;padding:0;margin:0;gap:6px;display:flex;flex-direction:column;font-size:0.85em;">
          ${examples.map(ex => `<li style="padding:6px;background:#e3f2fd;border-left:2px solid #2196f3;border-radius:3px;">${ex.emoji || '📝'} play</li>`).join('')}
        </ul>
      </div>
      <div>
        <h4 style="color:#4caf50;font-weight:700;margin:0 0 8px 0;font-size:0.85em;">⏩ Future</h4>
        <ul style="list-style:none;padding:0;margin:0;gap:6px;display:flex;flex-direction:column;font-size:0.85em;">
          ${examples.map(ex => `<li style="padding:6px;background:#e8f5e9;border-left:2px solid #4caf50;border-radius:3px;">${ex.emoji || '📝'} will play</li>`).join('')}
        </ul>
      </div>
      <div>
        <h4 style="color:#ff9800;font-weight:700;margin:0 0 8px 0;font-size:0.85em;">🔄 Continuous</h4>
        <ul style="list-style:none;padding:0;margin:0;gap:6px;display:flex;flex-direction:column;font-size:0.85em;">
          ${examples.map(ex => `<li style="padding:6px;background:#fff3e0;border-left:2px solid #ff9800;border-radius:3px;">${ex.emoji || '📝'} is playing</li>`).join('')}
        </ul>
      </div>
    </div>
    <div style="margin-top:18px;background:#ffebee;border-left:4px solid #f44336;padding:12px;border-radius:4px;">
      <p style="font-size:0.95em;color:#19777e;font-weight:700;margin:0;">
        Past = -ed | Present = base | Future = will + base | Continuous = be + -ing
      </p>
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
