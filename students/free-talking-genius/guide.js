// Session-only illustrated help for Free Talking Genius. No app business logic.
import {BUNNY_FOX_ART,PIGFISH_ART} from './character-art.js?v=20261107-pig-original4';
export function createFreeTalkingGuide(){
 const shown=new Set();
 const optsKey=id=>'ft_guide_never_'+String(id||'unknown');
 let studentId='',page=0,open=false;
 const overlay=document.createElement('div');
 overlay.className='ft-guide-overlay';overlay.hidden=true;
 overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');
 overlay.setAttribute('aria-label','프리토킹 지니어스 이용 안내');
 const container=document.createElement('div');container.className='ft-guide-card';
 overlay.appendChild(container);document.body.appendChild(overlay);
 const help=document.createElement('button');
 help.className='ft-guide-help';help.type='button';
 help.setAttribute('aria-label','프리토킹 사용법 보기');help.textContent='? 도움말';
 const footer=document.querySelector('.ft-footer-version');
 if(footer)footer.appendChild(help);
 else document.body.appendChild(help);
 const pages=[
  {tag:'01 / 05',title:'친구를 고르세요',desc:'친구를 한 번 눌러 선택하고, 한 번 더 누르면 시작해요.'},
  {tag:'02 / 05',title:'듣고 말해요',desc:'분홍색은 듣기, 하늘색은 말하기예요. 30초 안에 답해 보세요.'},
  {tag:'03 / 05',title:'한 마디 더 해 볼까요?',desc:'짧은 문장도 좋아요! 느낌이나 다른 이야기를 하나 더 붙이면 더 멋져져요.'},
  {tag:'04 / 05',title:'점수와 힌트',desc:'8점부터 통과! 첫 번째 힌트는 무료, 추가 힌트는 하나당 1점씩 감점돼요.'},
  {tag:'05 / 05',title:'다시 도전할 수 있어요',desc:'새 아이디어로 다시 답하거나 고친 문장을 녹음할 수 있어요. 건너뛰면 점수가 없고 완료로 세지 않아요.'}
 ];
 const selection=()=>{
  const portrait=BUNNY_FOX_ART;
  return '<div class="ft-guide-mini ft-guide-choice"><div class="ft-guide-mini-title">친구를 골라요!</div><div class="ft-guide-mini-avatar">'+portrait+'</div><span class="ft-guide-mini-label">Bunny Fox</span><span class="ft-guide-mini-select">시작하기</span></div>';
 };
 const listen=()=>{
  // Use a fresh SVG with unique gradient IDs; the hidden selection portrait
  // must never steal Pigfish's pink body gradients on Android.
  const portrait=PIGFISH_ART.replaceAll('pigBody','pigBody-tutorial').replaceAll('pigBelly','pigBelly-tutorial');
  return '<div class="ft-guide-mini ft-guide-talk"><div class="ft-guide-mini-avatar">'+portrait+'</div><div class="ft-guide-mini-action pink">눌러서 듣기</div><div class="ft-guide-mini-action cyan">눌러서 말하기 <strong>30s</strong></div></div>';
 };
 const sentence=()=>'<div class="ft-guide-mini ft-guide-sentence"><div class="ft-guide-example simple"><small>좋아요!</small><b>I am hungry.</b></div><div class="ft-guide-example better"><small>더 좋아요!</small><b>I am hungry and tired.</b></div><div class="ft-guide-example best"><small>정말 좋아요!</small><b>I am hungry, but I\'m not sad.</b></div></div>';
 const points=()=>'<div class="ft-guide-mini ft-guide-points"><strong>8 out of 10</strong><span>PASS</span><div class="ft-guide-mini-bonuses"><b>9점 +1</b><b>10점 +2</b></div><p>첫 힌트 무료 · 다음부터 −1</p><div class="ft-guide-mini-creative">특별한 아이디어 +5</div></div>';
 const retry=()=>'<div class="ft-guide-mini ft-guide-retry"><div class="ft-guide-mini-score">6 out of 10</div><div class="ft-guide-example good"><small>고친 문장</small><b>I went to the park yesterday.</b></div><div class="ft-guide-mini-buttons"><span>문장 고치기</span><span>새 아이디어</span><span>건너뛰기 · 0점</span></div></div>';
 const previews=[selection,listen,sentence,points,retry];
 function render(){
  const p=pages[page];
  container.replaceChildren();
  const close=document.createElement('button');close.type='button';close.className='ft-guide-close';close.textContent='닫기';
  close.onclick=hide;
  const top=document.createElement('div');top.className='ft-guide-top';
  const tag=document.createElement('span');tag.textContent=p.tag;top.append(tag,close);
  const title=document.createElement('h2');title.textContent=p.title;
  const visual=document.createElement('div');visual.className='ft-guide-visual';visual.innerHTML=previews[page]();
  const desc=document.createElement('p');desc.className='ft-guide-description';desc.textContent=p.desc;
  const foot=document.createElement('div');foot.className='ft-guide-navigation';
  const back=document.createElement('button');back.type='button';back.textContent='이전';back.disabled=page===0;back.onclick=()=>{page--;render()};
  const next=document.createElement('button');next.type='button';next.textContent=page===pages.length-1?'시작하기':'다음';next.onclick=()=>{if(page===pages.length-1){if(container.querySelector('#ftGuideNever')?.checked){try{localStorage.setItem(optsKey(studentId),'1')}catch{}}hide()}else{page++;render()}};
  foot.append(back,next);
  container.append(top,title,visual,desc);
  if(page===pages.length-1){
   const row=document.createElement('label');row.className='ft-guide-never';
   const check=document.createElement('input');check.type='checkbox';check.id='ftGuideNever';
   row.append(check,document.createTextNode('다음부터 이 안내를 보지 않기'));
   container.appendChild(row);
  }
  container.appendChild(foot);
 }
 function show(){page=0;open=true;render();overlay.hidden=false;}
 function hide(){open=false;overlay.hidden=true;}
 help.addEventListener('click',()=>show());
 document.addEventListener('keydown',e=>{if(open&&e.key==='Escape')hide()});
 return {
  show,
  showOnSessionStart(id,sessionId){
   if(!sessionId)return;
   studentId=String(id||'unknown');
   if(shown.has(sessionId))return;
   shown.add(sessionId);
   try{if(localStorage.getItem(optsKey(studentId))==='1')return}catch{}
   show();
  }
 };
}
