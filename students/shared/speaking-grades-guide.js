// Shared speech-grade onboarding for Word Genius and Sentence Genius.
export function createSpeakingGradesGuide({app='word',host=null}={}){
 const key='willena-speaking-guide-hidden-v1:'+app;
 const shown=new Set();
 let open=false,focusBefore=null,never=false;
 const colors=[
  ['#168345','#eafff0','초록','4점','원어민 수준! · 통과'],
  ['#79a921','#f1fad9','연두','3점','통과'],
  ['#ae830f','#fff8db','노랑','2점','통과'],
  ['#b9631a','#fff0df','주황','1점','통과'],
  ['#ce4053','#fff0f2','빨강','0점','다시 해 봐요']
 ];
 const overlay=document.createElement('div');overlay.className='sgg-overlay';overlay.hidden=true;
 overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','말하기 색깔 안내');
 const card=document.createElement('section');card.className='sgg-card';
 overlay.appendChild(card);document.body.appendChild(overlay);
 const help=document.createElement('button');help.type='button';help.className='sgg-help';if(!host)help.classList.add('sgg-help-float');help.hidden=true;help.textContent='? 말하기 도움말';help.setAttribute('aria-label','말하기 색깔 도움말 다시 보기');
 (host||document.body).appendChild(help);
 function visual(){
  return '<div class="sgg-color-list">'+colors.map(([fg,bg,name,points,desc])=>
   '<div class="sgg-color-row" style="--grade:'+fg+';--wash:'+bg+'"><span class="sgg-dot"></span><span class="sgg-color-name">'+name+'</span><span class="sgg-points">'+points+'</span><small>'+desc+'</small></div>').join('')+'</div>';
 }
 function hide(){
  open=false;overlay.hidden=true;
  if(focusBefore?.isConnected)focusBefore.focus({preventScroll:true});
 }
 function render(){
  card.replaceChildren();
  const top=document.createElement('div');top.className='sgg-top';
  const label=document.createElement('span');label.textContent='말하기 안내';
  const close=document.createElement('button');close.type='button';close.className='sgg-close';close.textContent='닫기';close.onclick=hide;
  top.append(label,close);
  const title=document.createElement('h2');title.textContent='말하기 색깔';
  const sub=document.createElement('p');sub.className='sgg-sub';sub.textContent='노란색이어도 괜찮아요! 빨강만 다시 말해요.';
  const graphic=document.createElement('div');graphic.className='sgg-visual';graphic.innerHTML=visual();
  const note=document.createElement('p');note.className='sgg-sub';note.textContent='통과하면 다음 문제로! 숙제도 완료할 수 있어요.';
  const remember=document.createElement('label');remember.className='sgg-never';
  const check=document.createElement('input');check.type='checkbox';check.checked=never;check.onchange=()=>{never=check.checked};
  remember.append(check,document.createTextNode('다음부터 보지 않기'));
  const nav=document.createElement('div');nav.className='sgg-nav';
  const start=document.createElement('button');start.type='button';start.textContent='시작하기';start.onclick=()=>{
    if(never){try{localStorage.setItem(key,'1')}catch{}}
    hide();
  };
  nav.append(start);
  card.append(top,title,sub,graphic,note,remember,nav);
 }
 function show(){focusBefore=document.activeElement;never=false;open=true;render();overlay.hidden=false;card.querySelector('.sgg-close')?.focus({preventScroll:true})}
 help.addEventListener('click',show);
 overlay.addEventListener('click',e=>{if(e.target===overlay)hide()});
 document.addEventListener('keydown',e=>{if(open&&e.key==='Escape'){e.preventDefault();hide()}});
 return {show,showOnSessionStart(id){
  const session=String(id||'unknown');help.hidden=false;if(shown.has(session))return;shown.add(session);
  try{if(localStorage.getItem(key)==='1')return}catch{}
  show();
 }};
}
