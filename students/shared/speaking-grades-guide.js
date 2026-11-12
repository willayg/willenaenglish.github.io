// Shared speech-grade onboarding for Word Genius and Sentence Genius.
export function createSpeakingGradesGuide({app='word',host=null}={}){
 const key='willena-speaking-guide-hidden-v1:'+app;
 const shown=new Set();
 let open=false,focusBefore=null,never=false,page=0;
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
  if(page===1){
   const title=app==='word'?'발음 에너지':'정확도 에너지';
   return '<div class="sgg-energy-demo">'+
     '<div class="sgg-energy-title">'+title+'</div>'+
     '<div class="sgg-energy-track"><div class="sgg-energy-fill"></div></div>'+
     '<p>에너지가 낮아도 괜찮아요!</p>'+
     '<strong>나중에 다시 연습하면 돼요.</strong>'+
     '<small>숙제는 그대로 완료할 수 있어요.</small>'+
   '</div>';
  }
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
  const label=document.createElement('span');label.textContent='말하기 안내 · '+(page+1)+' / 2';
  const close=document.createElement('button');close.type='button';close.className='sgg-close';close.textContent='닫기';close.onclick=hide;
  top.append(label,close);
  const title=document.createElement('h2');title.textContent=page===0?'말하기 색깔':app==='word'?'발음 에너지':'정확도 에너지';
  const sub=document.createElement('p');sub.className='sgg-sub';sub.textContent=page===0?'노란색이어도 괜찮아요! 빨강만 다시 말해요.':'에너지가 낮아도 괜찮아요!';
  const graphic=document.createElement('div');graphic.className='sgg-visual';graphic.innerHTML=visual();
  card.append(top,title,sub,graphic);
  if(page===0){
   const note=document.createElement('p');note.className='sgg-sub';note.textContent='통과하면 다음 문제로! 숙제도 완료할 수 있어요.';
   card.append(note);
  }
  if(page===1){
   const remember=document.createElement('label');remember.className='sgg-never';
   const check=document.createElement('input');check.type='checkbox';check.checked=never;check.onchange=()=>{never=check.checked};
   remember.append(check,document.createTextNode('다음부터 보지 않기'));card.append(remember);
  }
  const nav=document.createElement('div');nav.className='sgg-nav';
  if(page===1){
   const back=document.createElement('button');back.type='button';back.textContent='이전';back.onclick=()=>{page=0;render()};
   nav.append(back);
  }
  const next=document.createElement('button');next.type='button';next.textContent=page===0?'다음':'시작하기';next.onclick=()=>{
   if(page===0){page=1;render();return;}
   if(never){try{localStorage.setItem(key,'1')}catch{}}
   hide();
  };
  nav.append(next);card.append(nav);
 }
 function show(){focusBefore=document.activeElement;page=0;never=false;open=true;render();overlay.hidden=false;card.querySelector('.sgg-close')?.focus({preventScroll:true})}
 help.addEventListener('click',show);
 overlay.addEventListener('click',e=>{if(e.target===overlay)hide()});
 document.addEventListener('keydown',e=>{if(open&&e.key==='Escape'){e.preventDefault();hide()}});
 return {show,showOnSessionStart(id){
  const session=String(id||'unknown');help.hidden=false;if(shown.has(session))return;shown.add(session);
  try{if(localStorage.getItem(key)==='1')return}catch{}
  show();
 }};
}
