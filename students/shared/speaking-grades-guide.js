// Shared speech-grade onboarding for Word Genius and Sentence Genius.
export function createSpeakingGradesGuide({app='word',host=null}={}){
 const key='willena-speaking-guide-hidden-v1:'+app;
 const shown=new Set();
 let page=0,open=false,focusBefore=null,never=false;
 const pages=[
  {title:'말하기 색깔을 알아봐요!',subtitle:'말하면 색깔이 바뀌어요. 초록색이 가장 좋아요!',type:'colors'},
  {title:'노란색도 통과예요!',subtitle:'초록, 연두, 노랑, 주황은 모두 통과! 다음 문제로 넘어가도 돼요. 빨강은 다시 말해 봐요.',type:'progress'},
  {title:'정확도는 어떻게 나올까요?',subtitle:'한 문제당 최대 4점! 받은 점수를 평균 내서 정확도를 계산해요. 숙제는 계속 완료할 수 있어요.',type:'accuracy'}
 ];
 const colors=[
  ['#168345','#eafff0','초록','4/4 · 100%','원어민 수준! 아주 잘했어요!'],
  ['#79a921','#f1fad9','연두','3/4 · 75%','거의 완벽해요!'],
  ['#ae830f','#fff8db','노랑','2/4 · 50%','잘했어요! 통과!'],
  ['#b9631a','#fff0df','주황','1/4 · 25%','조금 알아들었어요. 통과!'],
  ['#ce4053','#fff0f2','빨강','0/4 · 0%','한 번 더 말해 봐요!']
 ];
 const overlay=document.createElement('div');overlay.className='sgg-overlay';overlay.hidden=true;
 overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','말하기 색깔 안내');
 const card=document.createElement('section');card.className='sgg-card';
 overlay.appendChild(card);document.body.appendChild(overlay);
 const help=document.createElement('button');help.type='button';help.className='sgg-help';help.textContent='? 말하기 도움말';help.setAttribute('aria-label','말하기 색깔 도움말 다시 보기');
 (host||document.body).appendChild(help);
 function visual(type){
  if(type==='colors')return '<div class="sgg-color-list">'+colors.map(([fg,bg,name,points,desc])=>
   '<div class="sgg-color-row" style="--grade:'+fg+';--wash:'+bg+'"><span class="sgg-dot"></span><span class="sgg-color-name">'+name+'</span><span class="sgg-points">'+points+'</span><small>'+desc+'</small></div>').join('')+'</div>';
  if(type==='progress')return '<div class="sgg-example"><div class="sgg-example-row"><span class="sgg-demo-chip">노랑 · 2/4</span><strong>✓ 통과!</strong></div><div class="sgg-example-big">계속 해도 돼요!</div><p>노란색이어도 멈출 필요 없어요.</p><div class="sgg-example-progress"><div></div></div><b>숙제 완료 100% 가능!</b></div>';
  return '<div class="sgg-example"><div class="sgg-example-big">정확도 75%</div><div class="sgg-example-progress"><div style="width:75%"></div></div><p>4점 + 3점 + 2점 = 9점</p><b>9 ÷ (3 × 4) × 100 = 75%</b><p>별점은 정확도에 따라 달라져요.</p></div>';
 }
 function hide(){
  open=false;overlay.hidden=true;
  if(focusBefore?.isConnected)focusBefore.focus({preventScroll:true});
 }
 function render(){
  const data=pages[page];card.replaceChildren();
  const top=document.createElement('div');top.className='sgg-top';
  const count=document.createElement('span');count.textContent=String(page+1).padStart(2,'0')+' / 03';
  const close=document.createElement('button');close.type='button';close.className='sgg-close';close.textContent='닫기';close.onclick=hide;
  top.append(count,close);
  const title=document.createElement('h2');title.textContent=data.title;
  const sub=document.createElement('p');sub.className='sgg-sub';sub.textContent=data.subtitle;
  const graphic=document.createElement('div');graphic.className='sgg-visual';graphic.innerHTML=visual(data.type);
  const nav=document.createElement('div');nav.className='sgg-nav';
  const back=document.createElement('button');back.type='button';back.textContent='이전';back.disabled=page===0;back.onclick=()=>{page--;render()};
  const next=document.createElement('button');next.type='button';next.textContent=page===pages.length-1?'시작하기':'다음';next.onclick=()=>{
   if(page===pages.length-1){if(never){try{localStorage.setItem(key,'1')}catch{}}hide();}
   else{page++;render();}
  };
  nav.append(back,next);
  card.append(top,title,sub,graphic);
  if(page===pages.length-1){
   const label=document.createElement('label');label.className='sgg-never';
   const check=document.createElement('input');check.type='checkbox';check.checked=never;check.onchange=()=>{never=check.checked};
   label.append(check,document.createTextNode('다음부터 이 안내를 보지 않기'));card.append(label);
  }
  card.append(nav);
 }
 function show(){focusBefore=document.activeElement;page=0;never=false;open=true;render();overlay.hidden=false;card.querySelector('.sgg-close')?.focus({preventScroll:true})}
 help.addEventListener('click',show);
 overlay.addEventListener('click',e=>{if(e.target===overlay)hide()});
 document.addEventListener('keydown',e=>{if(open&&e.key==='Escape'){e.preventDefault();hide()}});
 return {show,showOnSessionStart(id){
  const session=String(id||'unknown');if(shown.has(session))return;shown.add(session);
  try{if(localStorage.getItem(key)==='1')return}catch{}
  show();
 }};
}
