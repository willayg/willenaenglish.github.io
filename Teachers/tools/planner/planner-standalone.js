  // Add PDF function for header link
  const pdfHeaderLink = document.getElementById('pdfLessonPlanLink');
  if (pdfHeaderLink) {
    pdfHeaderLink.addEventListener('click', function(e) {
      e.preventDefault();
      const preview = document.getElementById('lessonPlanOutput');
      if (!preview || !preview.innerHTML.trim() || preview.innerHTML.includes('Ready to Create')) {
        alert('Please generate a lesson plan first.');
        return;
      }
      const pdfWindow = window.open('', '_blank');
      pdfWindow.document.write(`<!DOCTYPE html><html><head><title>Lesson Plan PDF</title><link href='https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css' rel='stylesheet'><style>body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:white;}</style></head><body>${preview.innerHTML}<script>window.onload=function(){window.print();}</script></body></html>`);
      pdfWindow.document.close();
      pdfWindow.focus();
    });
  }
// Willena Lesson Planner - Standalone Version
document.addEventListener('DOMContentLoaded', function() {
  console.log('Willena Lesson Planner loaded');
  
  // State management
  let currentLanguage = 'english';
  let currentMode = 'fullPlan';
  
  // DOM elements
  const englishMode = document.getElementById('englishMode');
  const koreanMode = document.getElementById('koreanMode');
  const fullPlanMode = document.getElementById('fullPlanMode');
  const activityMode = document.getElementById('activityMode');
  const fullPlanControls = document.getElementById('fullPlanControls');
  const activityControls = document.getElementById('activityControls');
  const generateLessonBtn = document.getElementById('generateLessonPlan');
  const generateActivitiesBtn = document.getElementById('generateActivities');
  const durationSelect = document.getElementById('plannerDuration');
  const customDurationDiv = document.getElementById('customDuration');
  
  // Set today's date
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('plannerDate').value = today;
  
  // Language switching
  englishMode.addEventListener('click', function() {
    currentLanguage = 'english';
    updateLanguageButtons();
  });
  
  koreanMode.addEventListener('click', function() {
    currentLanguage = 'korean';
    updateLanguageButtons();
  });
  
  function updateLanguageButtons() {
    if (currentLanguage === 'english') {
      englishMode.className = 'toggle-btn active';
      koreanMode.className = 'toggle-btn inactive';
    } else {
      englishMode.className = 'toggle-btn inactive';
      koreanMode.className = 'toggle-btn active';
    }
  }
  
  // Mode switching
  fullPlanMode.addEventListener('click', function() {
    currentMode = 'fullPlan';
    updateModeButtons();
    fullPlanControls.style.display = 'block';
    activityControls.style.display = 'none';
  });
  
  activityMode.addEventListener('click', function() {
    currentMode = 'activity';
    updateModeButtons();
    fullPlanControls.style.display = 'none';
    activityControls.style.display = 'block';
  });
  
  function updateModeButtons() {
    if (currentMode === 'fullPlan') {
      fullPlanMode.className = 'toggle-btn active';
      activityMode.className = 'toggle-btn inactive';
    } else {
      fullPlanMode.className = 'toggle-btn inactive';
      activityMode.className = 'toggle-btn active';
    }
  }
  
  // Custom duration toggle
  durationSelect.addEventListener('change', function() {
    if (this.value === 'custom') {
      customDurationDiv.style.display = 'block';
    } else {
      customDurationDiv.style.display = 'none';
    }
  });
  
  // Generate lesson plan
  generateLessonBtn.addEventListener('click', async function() {
    const className = document.getElementById('plannerClassName').value.trim();
    const date = document.getElementById('plannerDate').value;
    const duration = document.getElementById('plannerDuration').value;
    const topic = document.getElementById('plannerTopic').value.trim();
    const activities = document.getElementById('plannerActivities').value.trim();
    
    if (!topic) {
      alert(currentLanguage === 'korean' ? '수업 주제를 입력해주세요.' : 'Please enter a lesson topic.');
      return;
    }
    
    const actualDuration = duration === 'custom' ? 
      document.getElementById('customDurationInput').value : duration;
    
    this.disabled = true;
    this.textContent = currentLanguage === 'korean' ? '수업 계획 생성 중...' : 'Creating lesson plan...';
    
    try {
      const lessonPlan = await generateLessonPlan(className, date, actualDuration, topic, activities, currentLanguage);
      displayLessonPlan(lessonPlan);
    } catch (error) {
      console.error('Error:', error);
      alert(currentLanguage === 'korean' ? '수업 계획 생성에 실패했습니다. 예시로 대체합니다.' : 'Failed to generate lesson plan. Using example instead.');
      displayLessonPlan(createExampleLessonPlan(className, date, actualDuration, topic, currentLanguage));
    }
    
    this.disabled = false;
    this.textContent = currentLanguage === 'korean' ? '수업 계획 생성' : 'Generate Full Lesson Plan';
  });
    // Generate activities
  generateActivitiesBtn.addEventListener('click', async function() {
    const currentActivity = document.getElementById('currentActivity').value.trim();
    const activityCount = document.getElementById('activityCount').value;
    
    if (!currentActivity) {
      alert(currentLanguage === 'korean' ? '가르칠 내용을 설명해주세요.' : 'Please describe what you want to teach.');
      return;
    }
    
    this.disabled = true;
    this.textContent = currentLanguage === 'korean' ? '활동 아이디어 생성 중...' : 'Getting activity ideas...';
    
    try {
      const activities = await generateActivityIdeas(currentActivity, activityCount, currentLanguage);
      displayActivityIdeas(activities);
    } catch (error) {
      console.error('Error:', error);
      alert(currentLanguage === 'korean' ? '활동 아이디어 생성에 실패했습니다. 예시로 대체합니다.' : 'Failed to generate activities. Using example instead.');
      displayActivityIdeas(createExampleActivities(currentActivity, currentLanguage));
    }
    
    this.disabled = false;
    this.textContent = currentLanguage === 'korean' ? '활동 아이디어 받기' : 'Get Activity Ideas';
  });
  
  // Setup action buttons
  setupEditButton();
  setupPrintButton();
  setupSaveButton();

  // Add print function for header link
  const printHeaderLink = document.getElementById('printLessonPlanLink');
  if (printHeaderLink) {
    printHeaderLink.addEventListener('click', function(e) {
      e.preventDefault();
      const preview = document.getElementById('lessonPlanOutput');
      if (!preview || !preview.innerHTML.trim() || preview.innerHTML.includes('Ready to Create')) {
        alert('Please generate a lesson plan first.');
        return;
      }
      const printWindow = window.open('', '_blank');
      printWindow.document.write(`<!DOCTYPE html><html><head><title>Lesson Plan</title><link href='https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css' rel='stylesheet'><style>body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:white;}</style></head><body>${preview.innerHTML}<script>window.onload=function(){window.print();}</script></body></html>`);
      printWindow.document.close();
      printWindow.focus();
    });
  }
});

// OpenAI Integration
async function generateLessonPlan(className, date, duration, topic, activities, language = 'english') {
  try {
    let prompt, systemMessage;
    
    if (language === 'korean') {
      prompt = `${duration}분짜리 ESL 수업 계획을 "${topic}"에 대해 만들어주세요. 다음과 같이 섹션별로 구성해주세요:

## 준비 활동 (5분)
[활동 세부사항]

## 제시 (${Math.round(duration * 0.25)}분)  
[활동 세부사항]

## 연습 (${Math.round(duration * 0.5)}분)
[활동 세부사항]

## 활용 (${Math.round(duration * 0.15)}분)
[활동 세부사항]

## 정리 (5분)
[활동 세부사항]

각 섹션마다 다음을 포함해주세요:
- 교사가 하는 일
- 학생들이 하는 일  
- 필요한 준비물
- 활동의 목적

실용적이고 초보 교사도 쉽게 따라할 수 있게 만들어주세요.${activities ? `\n\n교사 선호사항: ${activities}` : ''}`;

      systemMessage = '당신은 도움이 되는 ESL 교사 멘토입니다. 새로운 교사들이 쉽게 따라할 수 있는 명확하고 잘 구성된 수업 계획을 한국어로 만들어주세요. 실용적인 활동을 제공해주세요.';
    } else {
      prompt = `Create a ${duration}-minute ESL lesson plan for "${topic}". Format it clearly with sections:

## Warm-up (5 minutes)
[activity details]

## Presentation (${Math.round(duration * 0.25)} minutes)  
[activity details]

## Practice (${Math.round(duration * 0.5)} minutes)
[activity details]

## Production (${Math.round(duration * 0.15)} minutes)
[activity details]

## Wrap-up (5 minutes)
[activity details]

For each section, include:
- What the teacher does
- What students do  
- Materials needed
- Purpose of the activity

Make it practical and beginner-teacher friendly.${activities ? `\n\nTeacher preferences: ${activities}` : ''}`;

      systemMessage = 'You are a helpful ESL teacher mentor. Create clear, well-structured lesson plans with practical activities that new teachers can easily follow.';
    }

    const response = await fetch('/.netlify/functions/openai_proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: 'chat/completions',
        payload: {
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: systemMessage
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 1000,
          temperature: 0.7
        }
      })
    });

    if (!response.ok) throw new Error('Network error');
    
    const result = await response.json();
    return formatAIResponse(result.data.choices[0].message.content, className, date, duration, topic, language);
    
  } catch (error) {
    console.log('OpenAI not available, using example');
    throw error;
  }
}

async function generateActivityIdeas(currentActivity, count = 4, language = 'english') {
  try {
    let prompt, systemMessage;
    
    const countText = language === 'korean' ? `${count}가지` : count;
    const activityWord = language === 'korean' ? '활동' : (count === 1 ? 'activity' : 'activities');
    
    if (language === 'korean') {
      prompt = `"${currentActivity}"에 기반하여 ${count}가지 창의적이고 실용적인 ESL 활동 아이디어를 만들어주세요.

각 활동을 다음과 같이 구성해주세요:`;

      // Add activity template based on count
      for (let i = 1; i <= count; i++) {
        prompt += `

## 활동 ${i}: [창의적인 이름]
**교사가 하는 일:** [교사를 위한 단계별 설명]
**학생들이 하는 일:** [학생 활동] 
**준비물:** [필요한 것들]
**효과적인 이유:** [학습에 주는 이익]`;
      }

      prompt += `

활동들을 흥미롭고, 연령에 적합하며, 구현하기 쉽게 만들어주세요. 말하기와 상호작용에 중점을 두세요.`;

      systemMessage = '당신은 창의적인 ESL 활동 디자이너입니다. 아이들과 초보자들에게 잘 맞는 재미있고 실용적인 활동을 만들어주세요. 참여와 말하기 연습에 중점을 두세요.';
    } else {
      prompt = `Create ${count} creative, practical ESL ${activityWord} based on: "${currentActivity}"

Format each activity like this:`;

      // Add activity template based on count
      for (let i = 1; i <= count; i++) {
        prompt += `

## Activity ${i}: [Creative Name]
**What you do:** [step-by-step for teacher]
**What students do:** [student actions] 
**Materials:** [what you need]
**Why it works:** [benefit for learning]`;      }

      prompt += `

Make the activities engaging, age-appropriate, and easy to implement. Focus on speaking and interaction.`;

      systemMessage = 'You are a creative ESL activity designer. Create fun, practical activities that work well with children and beginners. Focus on engagement and speaking practice.';
    }

    const response = await fetch('/.netlify/functions/openai_proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: 'chat/completions',
        payload: {
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: systemMessage
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 800,
          temperature: 0.8
        }
      })
    });

    if (!response.ok) throw new Error('Network error');
    
    const result = await response.json();
    return formatActivityResponse(result.data.choices[0].message.content, language);
    
  } catch (error) {
    console.log('OpenAI not available, using example');
    throw error;
  }
}

// Display functions
function displayLessonPlan(content) {
  document.getElementById('lessonPlanOutput').innerHTML = content;
}

function displayActivityIdeas(content) {
  document.getElementById('lessonPlanOutput').innerHTML = content;
}

// Example generators
function createExampleLessonPlan(className, date, duration, topic, language = 'english') {
  const formatDate = (dateStr) => {
    if (!dateStr) return new Date().toLocaleDateString();
    return new Date(dateStr).toLocaleDateString();
  };

  if (language === 'korean') {
    return `
      <div class="lesson-header">
        <h2>수업 계획서</h2>
      </div>
      
      <div class="lesson-info">
        <p><strong>반:</strong> ${className || '영어 수업'}</p>
        <p><strong>날짜:</strong> ${formatDate(date)}</p>
        <p><strong>수업 시간:</strong> ${duration}분</p>
        <p><strong>주제:</strong> ${topic}</p>
      </div>

      <div class="activity-box">
        <div class="time-box">5분</div>
        <div class="content-box">
          <div class="section-title">준비 활동</div>
          <strong>인사 나누기</strong><br>
          • 교사: "Good morning everyone! How are you feeling today?"<br>
          • 학생들: 간단한 단어로 기분 표현하기<br>
          • 목적: 긍정적인 수업 분위기 조성
        </div>
      </div>

      <div class="activity-box">
        <div class="time-box">${Math.round(duration * 0.15)}분</div>
        <div class="content-box">
          <div class="section-title">제시</div>
          <strong>주제 소개</strong><br>
          • 교사: 시각 자료를 사용하여 "${topic}" 소개<br>
          • 학생들: 듣기, 핵심 어휘 따라하기<br>
          • 목적: 기초 이해력 구축
        </div>
      </div>

      <div class="activity-box">
        <div class="time-box">${Math.round(duration * 0.55)}분</div>
        <div class="content-box">
          <div class="section-title">연습</div>
          <strong>상호작용 연습</strong><br>
          • 교사: 구조화된 연습 활동 안내<br>
          • 학생들: 짝을 이뤄 새로운 언어 연습<br>
          • 목적: 안전한 환경에서 언어 사용
        </div>
      </div>

      <div class="activity-box">
        <div class="time-box">${Math.round(duration * 0.2)}분</div>
        <div class="content-box">
          <div class="section-title">활용</div>
          <strong>창의적 적용</strong><br>
          • 교사: 오늘 주제를 활용한 창의적 과제 제시<br>
          • 학생들: 새로운 언어를 창의적으로 사용<br>
          • 목적: 자신감 구축
        </div>
      </div>

      <div class="activity-box">
        <div class="time-box">5분</div>
        <div class="content-box">
          <div class="section-title">정리</div>
          <strong>복습 및 성찰</strong><br>
          • 교사: "What did we learn today?"<br>
          • 학생들: 오늘 배운 것 중 하나씩 나누기<br>
          • 목적: 학습 내용 강화
        </div>
      </div>
    `;
  }

  return `
    <div class="lesson-header">
      <h2>Lesson Plan</h2>
    </div>
    
    <div class="lesson-info">
      <p><strong>Class:</strong> ${className || 'English Class'}</p>
      <p><strong>Date:</strong> ${formatDate(date)}</p>
      <p><strong>Duration:</strong> ${duration} minutes</p>
      <p><strong>Topic:</strong> ${topic}</p>
    </div>

    <div class="activity-box">
      <div class="time-box">5 min</div>
      <div class="content-box">
        <div class="section-title">WARM-UP</div>
        <strong>Greeting Circle</strong><br>
        • T: "Good morning everyone! How are you feeling today?"<br>
        • Ss: Share feelings using simple words<br>
        • Purpose: Creates positive atmosphere
      </div>
    </div>

    <div class="activity-box">
      <div class="time-box">${Math.round(duration * 0.15)} min</div>
      <div class="content-box">
        <div class="section-title">PRESENTATION</div>
        <strong>Topic Introduction</strong><br>
        • T: Introduce "${topic}" using visual aids<br>
        • Ss: Listen, repeat key vocabulary<br>
        • Purpose: Builds foundation understanding
      </div>
    </div>

    <div class="activity-box">
      <div class="time-box">${Math.round(duration * 0.55)} min</div>
      <div class="content-box">
        <div class="section-title">PRACTICE</div>
        <strong>Interactive Practice</strong><br>
        • T: Guide students through structured practice<br>
        • Ss: Work in pairs to practice new language<br>
        • Purpose: Safe space to use new language
      </div>
    </div>

    <div class="activity-box">
      <div class="time-box">${Math.round(duration * 0.2)} min</div>
      <div class="content-box">
        <div class="section-title">PRODUCTION</div>
        <strong>Creative Application</strong><br>
        • T: Set up creative task using today's topic<br>
        • Ss: Use new language creatively<br>
        • Purpose: Builds confidence
      </div>
    </div>

    <div class="activity-box">
      <div class="time-box">5 min</div>
      <div class="content-box">
        <div class="section-title">WRAP-UP</div>
        <strong>Review & Reflection</strong><br>
        • T: "What did we learn today?"<br>
        • Ss: Share one new thing they learned<br>
        • Purpose: Reinforces learning
      </div>
    </div>
  `;
}

function createExampleActivities(currentActivity, language = 'english') {
  if (language === 'korean') {
    return `
      <div class="lesson-header">
        <h2>활동 아이디어</h2>
      </div>
      
      <div class="lesson-info">
        <p><strong>기반:</strong> ${currentActivity}</p>
      </div>

      <div class="activity-item">
        <h3>활동 1: 단어 탐정 게임</h3>
        <p><strong>교사가 하는 일:</strong> 어휘 카드를 교실 곳곳에 숨기고 힌트 제공</p>
        <p><strong>학생들이 하는 일:</strong> 카드를 찾아 단어로 문장 만들기</p>
        <p><strong>준비물:</strong> 어휘 카드, 타이머</p>
        <p><strong>효과적인 이유:</strong> 움직임과 발견이 학습을 기억에 남게 함</p>
      </div>

      <div class="activity-item">
        <h3>활동 2: 이야기 연결하기</h3>
        <p><strong>교사가 하는 일:</strong> 한 문장으로 이야기 시작, 학생 참여 안내</p>
        <p><strong>학생들이 하는 일:</strong> 각자 한 문장씩 추가하여 반 이야기 완성</p>
        <p><strong>준비물:</strong> 특별한 준비물 없음</p>
        <p><strong>효과적인 이유:</strong> 창의성과 자연스러운 언어 사용 격려</p>
      </div>

      <div class="activity-item">
        <h3>활동 3: 레스토랑 역할놀이</h3>
        <p><strong>교사가 하는 일:</strong> 가상 레스토랑 설정, 역할 배정</p>
        <p><strong>학생들이 하는 일:</strong> 음식 주문하기와 서빙 연습</p>
        <p><strong>준비물:</strong> 메뉴 소품, 가짜 돈</p>
        <p><strong>효과적인 이유:</strong> 실제 상황 연습으로 자신감 구축</p>
      </div>

      <div class="activity-item">
        <h3>활동 4: 음악 어휘 활동</h3>
        <p><strong>교사가 하는 일:</strong> 음악 틀기, 어휘 범주 부르기</p>
        <p><strong>학생들이 하는 일:</strong> 다양한 단어 유형에 따라 모서리로 이동</p>
        <p><strong>준비물:</strong> 음악 플레이어, 범주 표지판</p>
        <p><strong>효과적인 이유:</strong> 신체 활동이 운동감각 학습자에게 도움</p>
      </div>
    `;
  }

  return `
    <div class="lesson-header">
      <h2>Activity Ideas</h2>
    </div>
    
    <div class="lesson-info">
      <p><strong>Based on:</strong> ${currentActivity}</p>
    </div>

    <div class="activity-item">
      <h3>ACTIVITY 1: Word Detective Game</h3>
      <p><strong>What you do:</strong> Hide vocabulary cards around the room and give clues</p>
      <p><strong>What students do:</strong> Find cards and use words in sentences</p>
      <p><strong>Materials:</strong> Vocabulary cards, timer</p>
      <p><strong>Why it works:</strong> Movement + discovery makes learning memorable</p>
    </div>

    <div class="activity-item">
      <h3>ACTIVITY 2: Story Chain Building</h3>
      <p><strong>What you do:</strong> Start a story with one sentence, guide contributions</p>
      <p><strong>What students do:</strong> Add one sentence each to build a class story</p>
      <p><strong>Materials:</strong> None needed</p>
      <p><strong>Why it works:</strong> Encourages creativity and natural language use</p>
    </div>

    <div class="activity-item">
      <h3>ACTIVITY 3: Role-Play Restaurant</h3>
      <p><strong>What you do:</strong> Set up mock restaurant, assign roles</p>
      <p><strong>What students do:</strong> Practice ordering food and serving</p>
      <p><strong>Materials:</strong> Menu props, play money</p>
      <p><strong>Why it works:</strong> Real-world practice builds confidence</p>
    </div>

    <div class="activity-item">
      <h3>ACTIVITY 4: Musical Vocabulary</h3>
      <p><strong>What you do:</strong> Play music, call out vocabulary categories</p>
      <p><strong>What students do:</strong> Move to corners for different word types</p>
      <p><strong>Materials:</strong> Music player, category signs</p>
      <p><strong>Why it works:</strong> Physical movement helps kinesthetic learners</p>
    </div>
  `;
}

// Formatting functions
function formatAIResponse(aiContent, className, date, duration, topic, language = 'english') {
  const formatDate = (dateStr) => {
    if (!dateStr) return new Date().toLocaleDateString();
    return new Date(dateStr).toLocaleDateString();
  };

  // Clean and format markdown content more safely
  let cleanContent = aiContent
    // Remove any CSS or style leakage first
    .replace(/style\s*=\s*["'][^"']*["']/gi, '')
    // Convert headers (do this BEFORE paragraph processing)
    .replace(/###\s*(.+)/g, '<h3 style="color: #2e2b3f; margin: 20px 0 10px 0; font-size: 1.3rem;">$1</h3>')
    .replace(/##\s*(.+)/g, '<h2 style="color: #2e2b3f; margin: 25px 0 15px 0; font-size: 1.4rem;">$1</h2>')
    .replace(/^#\s*(.+)/gm, '<h1 style="color: #2e2b3f; margin: 30px 0 20px 0; font-size: 1.5rem;">$1</h1>')
    // Bold and italic
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>')
    // Convert paragraphs (split by double newlines)
    .split('\n\n')
    .map(paragraph => {
      if (paragraph.trim() === '') return '';
      // Don't wrap headers in paragraphs
      if (paragraph.includes('<h1>') || paragraph.includes('<h2>') || paragraph.includes('<h3>')) {
        return paragraph.replace(/\n/g, '<br>');
      }
      return `<p style="margin: 12px 0; line-height: 1.6; font-size: 1rem;">${paragraph.replace(/\n/g, '<br>')}</p>`;
    })
    .join('\n');

  const headerText = language === 'korean' ? '윌레나 수업 계획서' : 'Willena Lesson Plan';
  const classLabel = language === 'korean' ? '반:' : 'Class:';
  const dateLabel = language === 'korean' ? '날짜:' : 'Date:';
  const durationLabel = language === 'korean' ? '수업 시간:' : 'Duration:';
  const topicLabel = language === 'korean' ? '주제:' : 'Topic:';
  const minutesText = language === 'korean' ? '분' : 'minutes';

  return `
    <div class="lesson-header">
      <h2>${headerText}</h2>
    </div>
    
    <div class="lesson-info">
      <p><strong>${classLabel}</strong> ${className || (language === 'korean' ? '영어 수업' : 'English Class')}</p>
      <p><strong>${dateLabel}</strong> ${formatDate(date)}</p>
      <p><strong>${durationLabel}</strong> ${duration} ${minutesText}</p>
      <p><strong>${topicLabel}</strong> ${topic}</p>
    </div>

    <div style="padding: 25px; background: #f8f9fa; border-radius: 12px; margin-top: 20px; line-height: 1.7; font-size: 1rem;">
      ${cleanContent}
    </div>
  `;
}

function formatActivityResponse(aiContent, language = 'english') {
  // Clean and format markdown content more safely
  let cleanContent = aiContent
    // Remove any CSS or style leakage first
    .replace(/style\s*=\s*["'][^"']*["']/gi, '')
    // Convert headers (do this BEFORE paragraph processing)
    .replace(/###\s*(.+)/g, '<h3 style="color: #2e2b3f; margin: 20px 0 10px 0; font-size: 1.3rem;">$1</h3>')
    .replace(/##\s*(.+)/g, '<h2 style="color: #2e2b3f; margin: 25px 0 15px 0; font-size: 1.4rem;">$1</h2>')
    .replace(/^#\s*(.+)/gm, '<h1 style="color: #2e2b3f; margin: 30px 0 20px 0; font-size: 1.5rem;">$1</h1>')
    // Bold and italic
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>')
    // Convert paragraphs (split by double newlines)
    .split('\n\n')
    .map(paragraph => {
      if (paragraph.trim() === '') return '';
      // Don't wrap headers in paragraphs
      if (paragraph.includes('<h1>') || paragraph.includes('<h2>') || paragraph.includes('<h3>')) {
        return paragraph.replace(/\n/g, '<br>');
      }
      return `<p style="margin: 12px 0; line-height: 1.6; font-size: 1rem;">${paragraph.replace(/\n/g, '<br>')}</p>`;
    })    .join('\n');

  const headerText = language === 'korean' ? '윌레나 활동 아이디어' : 'Willena Activity Ideas';

  return `
    <div class="lesson-header">
      <h2>${headerText}</h2>
    </div>

    <div style="padding: 25px; background: #f8f9fa; border-radius: 12px; margin-top: 20px; line-height: 1.7; font-size: 1rem;">
      ${cleanContent}
    </div>
  `;
}

// Action button functions
function setupEditButton() {
  const editBtn = document.getElementById('editLessonPlan');
  if (editBtn) {
    editBtn.addEventListener('click', function() {
      const output = document.getElementById('lessonPlanOutput');
      const currentContent = output.innerHTML;
      
      if (this.textContent === 'Edit') {
        const textarea = document.createElement('textarea');
        textarea.style.width = '100%';
        textarea.style.height = '400px';
        textarea.style.padding = '16px';
        textarea.style.border = '2px solid #e5e7eb';
        textarea.style.borderRadius = '8px';
        textarea.style.fontSize = '1rem';
        textarea.style.lineHeight = '1.5';
        textarea.value = currentContent.replace(/<br>/g, '\n').replace(/<[^>]*>/g, '');
        
        output.innerHTML = '';
        output.appendChild(textarea);
        this.textContent = 'Save';
      } else {
        const textarea = output.querySelector('textarea');
        const newContent = textarea.value.replace(/\n/g, '<br>');
        output.innerHTML = `<div style="padding: 25px; background: #f8f9fa; border-radius: 12px; line-height: 1.7; font-size: 1rem;">${newContent}</div>`;
        this.textContent = 'Edit';
      }
    });
  }
}

function setupPrintButton() {
  const printBtn = document.getElementById('printLessonPlan');
  if (printBtn) {
    printBtn.addEventListener('click', function() {
      const content = document.getElementById('lessonPlanOutput').innerHTML;
      if (!content || content.includes('Ready to Create')) {
        alert('Please generate a lesson plan first.');
        return;
      }
      
      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Lesson Plan</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; margin: 20px; }
            .lesson-header { background: #2e2b3f; color: white; padding: 20px; border-radius: 8px; }
            .lesson-info { background: #f8f9fa; padding: 20px; border: 1px solid #ddd; margin: 15px 0; }
            .activity-box { display: flex; border: 1px solid #ddd; margin: 15px 0; border-radius: 8px; overflow: hidden; }
            .time-box { background: #4f46e5; color: white; padding: 20px; width: 120px; text-align: center; font-weight: bold; }
            .content-box { padding: 20px; flex: 1; }
            .activity-item { margin: 20px 0; padding: 20px; background: #f8f9fa; border: 1px solid #ddd; border-radius: 8px; }
            h2, h3 { color: #2e2b3f; }
            .section-title { font-weight: bold; color: #2e2b3f; margin-bottom: 10px; }
          </style>
        </head>
        <body>${content}</body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    });
  }
}

function setupSaveButton() {
  const saveBtn = document.getElementById('saveLessonPlan');
  if (saveBtn) {
    saveBtn.addEventListener('click', function() {
      const content = document.getElementById('lessonPlanOutput').innerHTML;
      if (!content || content.includes('Ready to Create')) {
        alert('Please generate a lesson plan first.');
        return;
      }
      
      const plainText = content.replace(/<[^>]*>/g, '').replace(/\n\s*\n/g, '\n');
      const blob = new Blob([plainText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'lesson-plan.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }
}

// Feedback modal loader for burger menu integration
window.showFeedbackModal = function() {
  // Prevent multiple modals
  if (document.getElementById('feedback-modal-bg')) return;
  // Try to find the template in DOM first
  let template = document.getElementById('feedback-modal-template');
  if (!template) {
    // If not found, fetch and inject it
    fetch('/Teachers/components/feedback-modal.html')
      .then(resp => resp.text())
      .then(html => {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        document.body.appendChild(tempDiv.firstElementChild);
        showFeedbackModal(); // Call again now that template is present
      });
    return;
  }
  // Clone and show modal
  const modalNode = template.content.cloneNode(true);
  document.body.appendChild(modalNode);
  // Add close/cancel handlers
  const bg = document.getElementById('feedbackModalBg');
  if (!bg) return;
  const closeBtn = bg.querySelector('#feedbackModalCloseBtn');
  const cancelBtn = bg.querySelector('#feedbackCancelBtn');
  function closeModal() { bg.remove(); }
  if (closeBtn) closeBtn.onclick = closeModal;
  if (cancelBtn) cancelBtn.onclick = closeModal;
  // Optional: focus textarea
  const textarea = bg.querySelector('textarea');
  if (textarea) textarea.focus();

  // Feedback submit handler
  const submitBtn = bg.querySelector('#feedbackSubmitBtn');
  if (submitBtn) {
    submitBtn.onclick = async function() {
      const feedbackText = textarea.value.trim();
      if (!feedbackText) {
        alert('Please enter your feedback.');
        textarea.focus();
        return;
      }
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending...';
      // Prepare feedback payload
      // Gather tool state (settings)
      let toolState = {};
      try {
        toolState = {
          className: document.getElementById('plannerClassName')?.value || '',
          date: document.getElementById('plannerDate')?.value || '',
          duration: document.getElementById('plannerDuration')?.value || '',
          topic: document.getElementById('plannerTopic')?.value || '',
          activities: document.getElementById('plannerActivities')?.value || '',
          mode: document.getElementById('fullPlanMode')?.classList.contains('active') ? 'full' : 'activity'
        };
      } catch (e) { toolState = {}; }
      const payload = {
        feedback: feedbackText,
        module: 'planner',
        page_url: window.location.pathname,
        tool_state: toolState,
        user_id: null // Optionally set if you have auth
      };
      try {
        const resp = await fetch('/.netlify/functions/supabase_proxy?feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'insert_feedback',
            data: payload
          })
        });
        const result = await resp.json();
        if (resp.ok && result.success) {
          submitBtn.textContent = 'Sent!';
          setTimeout(closeModal, 900);
        } else {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Send';
          alert('Error sending feedback: ' + (result.error || 'Unknown error'));
        }
      } catch (err) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send';
        alert('Network error: ' + err.message);
      }
    };
  }
};
