(() => {
  const API = '/.netlify/functions/student_level_test';
  const $ = id => document.getElementById(id);
  const screens = ['loadingScreen','startScreen','testScreen','thanksScreen','fatalScreen'];
  const state = { attemptId:null, question:null, shownAt:0, resume:null };

  function show(id){
    screens.forEach(name => $(name)?.classList.toggle('active', name === id));
    window.scrollTo({top:0,behavior:'smooth'});
  }
  function setFatal(message){ $('fatalMessage').textContent = message || 'Please try again.'; show('fatalScreen'); }
  async function request(action, options = {}){
    const separator = API.includes('?') ? '&' : '?';
    const url = `${API}${separator}action=${encodeURIComponent(action)}&_=${Date.now()}`;
    const response = await WillenaAPI.fetch(url, { credentials:'include', ...options });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      location.replace('/students/signin.html?next=' + encodeURIComponent(location.pathname));
      throw new Error('Student login required.');
    }
    if (!response.ok || !data.success) throw new Error(data.error || `Request failed (${response.status})`);
    return data;
  }
  function speak(text){
    if (!text || !('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = .86;
    speechSynthesis.speak(utterance);
  }
  function renderQuestion(question){
    state.question = question;
    state.shownAt = Date.now();
    $('errorBox').classList.add('hidden');
    $('progressText').textContent = `Question ${question.index} of ${question.total}`;
    $('sectionText').textContent = (question.type || 'English').replaceAll('_',' ');
    $('progressBar').style.width = `${Math.max(3, ((question.index - 1) / question.total) * 100)}%`;
    $('promptText').textContent = question.prompt || 'Choose the best answer.';
    const context = question.context || '';
    $('contextText').textContent = context;
    $('contextText').classList.toggle('hidden', !context || question.type === 'listening');
    const hasAudio = question.type === 'listening' && question.transcript;
    $('audioWrap').classList.toggle('hidden', !hasAudio);
    $('listenBtn').onclick = () => speak(question.transcript);

    const options = $('options');
    options.innerHTML = '';
    const answers = Array.isArray(question.options) && question.options.length ? question.options : question.tokens;
    answers.forEach(answer => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'option';
      button.textContent = answer;
      button.addEventListener('click', () => submitAnswer(answer));
      options.appendChild(button);
    });
    show('testScreen');
    if (hasAudio) setTimeout(() => speak(question.transcript), 350);
  }
  function disableOptions(disabled){
    document.querySelectorAll('.option').forEach(button => { button.disabled = disabled; });
  }
  async function submitAnswer(answer){
    if (!state.attemptId || !state.question) return;
    disableOptions(true);
    try {
      const data = await request('answer', {
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({
          attempt_id:state.attemptId,
          question_id:state.question.id,
          answer,
          response_time_ms:Date.now() - state.shownAt
        })
      });
      if (data.complete) {
        state.attemptId = null;
        state.question = null;
        $('progressBar').style.width = '100%';
        show('thanksScreen');
      } else {
        renderQuestion(data.question);
      }
    } catch (error) {
      $('errorBox').textContent = error.message;
      $('errorBox').classList.remove('hidden');
      disableOptions(false);
    }
  }
  async function startTest(){
    $('startBtn').disabled = true;
    $('resumeBtn').disabled = true;
    show('loadingScreen');
    try {
      const data = await request('start', { method:'POST', headers:{'content-type':'application/json'}, body:'{}' });
      state.attemptId = data.attempt_id;
      renderQuestion(data.question);
    } catch (error) {
      setFatal(error.message);
    } finally {
      $('startBtn').disabled = false;
      $('resumeBtn').disabled = false;
    }
  }
  async function resumeTest(){
    if (!state.resume) return startTest();
    state.attemptId = state.resume.attempt.id;
    renderQuestion(state.resume.question);
  }
  async function initialize(){
    show('loadingScreen');
    try {
      const me = await request('me');
      const student = me.student || {};
      $('studentName').textContent = student.name || student.korean_name || '';
      const resume = await request('resume');
      state.resume = resume.attempt ? resume : null;
      $('resumeBtn').classList.toggle('hidden', !state.resume);
      $('startBtn').textContent = state.resume ? 'Start a New Test' : 'Start Test';
      show('startScreen');
    } catch (error) {
      setFatal(error.message);
    }
  }

  $('startBtn').addEventListener('click', async () => {
    if (state.resume?.attempt?.id) {
      try {
        await request('restart', {
          method:'POST', headers:{'content-type':'application/json'},
          body:JSON.stringify({attempt_id:state.resume.attempt.id})
        });
        state.resume = null;
      } catch (_) {}
    }
    startTest();
  });
  $('resumeBtn').addEventListener('click', resumeTest);
  $('againBtn').addEventListener('click', startTest);
  $('reloadBtn').addEventListener('click', () => location.reload());
  initialize();
})();
