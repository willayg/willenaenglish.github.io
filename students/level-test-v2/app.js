const app=document.querySelector('#app');
const subtitle=document.querySelector('#brandSubtitle');
const footer=document.querySelector('#footerText');
const choices=[...document.querySelectorAll('[data-language-choice]')];
let lang='ko';
const T={ko:{brand:'무료 영어 레벨 테스트',footer:'Willena English · 스테이징 진단 테스트',title:'레벨 테스트',start:'시작하기',preview:'V2 준비 중',previewText:'새로운 레벨 테스트 구조가 준비되었습니다.',back:'처음으로'},en:{brand:'Free Level Test',footer:'Willena English · Staging assessment',title:'Level Test',start:'Start',preview:'V2 shell ready',previewText:'The new Level Test structure is ready for the next build phase.',back:'Back to start'}};
const tx=k=>T[lang][k]||k;
function setLanguage(next){lang=next;document.documentElement.lang=lang;subtitle.textContent=tx('brand');footer.textContent=tx('footer');choices.forEach(b=>b.classList.toggle('is-active',b.dataset.languageChoice===lang));renderWelcome();}
function screen(html){app.classList.add('is-swapping');app.innerHTML=`<section class="screen screen-safe-in">${html}</section>`;requestAnimationFrame(()=>requestAnimationFrame(()=>{app.querySelector('.screen')?.classList.add('screen-safe-ready');app.classList.remove('is-swapping');}));}
function renderWelcome(){document.body.classList.add('welcome-mode');screen(`<div class="welcome-layout"><img class="welcome-logo" src="/Assets/Images/Logo.png" alt="Willena English Academy"><div class="welcome-panel"><h1>${tx('title')}</h1><button class="welcome-start" id="welcomeStart" type="button">${tx('start')}</button></div></div>`);}
function renderPreview(){document.body.classList.remove('welcome-mode');screen(`<div class="eyebrow">Level Test v2</div><h2>${tx('preview')}</h2><div class="question-meta"><span>Visual parity shell</span><span>Phase 1</span></div><div class="progress"><i style="width:16%"></i></div><div class="question-card"><p class="prompt">${tx('previewText')}</p><div class="choices"><button class="choice" type="button">Reading</button><button class="choice" type="button">Listening</button></div></div><div class="actions"><button class="btn btn-ghost" id="previewBack" type="button">${tx('back')}</button></div>`);}
choices.forEach(b=>b.addEventListener('click',()=>setLanguage(b.dataset.languageChoice)));
app.addEventListener('click',e=>{if(e.target.closest('#welcomeStart'))renderPreview();if(e.target.closest('#previewBack'))renderWelcome();});
renderWelcome();
