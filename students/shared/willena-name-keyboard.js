// Reusable inline Willena name keyboard. No login/auth logic or stored personal data.
const EN_ROWS=['qwertyuiop','asdfghjkl','zxcvbnm'];
const KO_ROWS=['ㅂㅈㄷㄱㅅㅛㅕㅑㅐㅔ','ㅁㄴㅇㄹㅎㅗㅓㅏㅣ','ㅋㅌㅊㅍㅠㅜㅡ'];
const L='ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const V='ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
const T=['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const vowelPairs={'ㅗㅏ':'ㅘ','ㅗㅐ':'ㅙ','ㅗㅣ':'ㅚ','ㅜㅓ':'ㅝ','ㅜㅔ':'ㅞ','ㅜㅣ':'ㅟ','ㅡㅣ':'ㅢ'};
const finalPairs={'ㄱㅅ':'ㄳ','ㄴㅈ':'ㄵ','ㄴㅎ':'ㄶ','ㄹㄱ':'ㄺ','ㄹㅁ':'ㄻ','ㄹㅂ':'ㄼ','ㄹㅅ':'ㄽ','ㄹㅌ':'ㄾ','ㄹㅍ':'ㄿ','ㄹㅎ':'ㅀ','ㅂㅅ':'ㅄ'};
const splitFinal=Object.fromEntries(Object.entries(finalPairs).map(([k,v])=>[v,[...k]]));
const SHIFT_KO={'ㅂ':'ㅃ','ㅈ':'ㅉ','ㄷ':'ㄸ','ㄱ':'ㄲ','ㅅ':'ㅆ','ㅐ':'ㅒ','ㅔ':'ㅖ'};
function isVowel(j){return V.includes(j)}
function syllable(l,v,t=''){
 const a=L.indexOf(l),b=V.indexOf(v),c=T.indexOf(t);
 return a<0||b<0||c<0?l+v+t:String.fromCharCode(0xac00+(a*21+b)*28+c);
}
function combineState(state,j){
 const {l,v,t}=state;
 if(isVowel(j)){
  if(!l)return {prefix:syllable('ㅇ',j),state:{l:'ㅇ',v:j,t:''},replace:false};
  if(!v)return {state:{l,v:j,t:''}};
  if(!t){
   const merged=vowelPairs[v+j];
   if(merged)return {state:{l,v:merged,t:''}};
   return {commit:true,state:{l:'ㅇ',v:j,t:''}};
  }
  const pair=splitFinal[t];
  if(pair)return {commit:true,commitState:{l,v,t:pair[0]},state:{l:pair[1],v:j,t:''}};
  return {commit:true,commitState:{l,v,t:''},state:{l:t,v:j,t:''}};
 }
 if(!l)return {state:{l:j,v:'',t:''}};
 if(!v)return {commit:true,state:{l:j,v:'',t:''}};
 if(!t){
  if(T.includes(j))return {state:{l,v,t:j}};
  return {commit:true,state:{l:j,v:'',t:''}};
 }
 const compound=finalPairs[t+j];
 if(compound)return {state:{l,v,t:compound}};
 return {commit:true,state:{l:j,v:'',t:''}};
}
function stateText(s){return !s.l?'':s.v?syllable(s.l,s.v,s.t):s.l}
function mountStyles(){
 if(document.getElementById('willenaNameKeyboardStyles'))return;
 const sheet=document.createElement('style');sheet.id='willenaNameKeyboardStyles';
 sheet.textContent='.wnk{display:grid;gap:6px;margin:12px 0 4px;touch-action:manipulation}.wnk-row{display:flex;gap:4px;justify-content:center}.wnk-key{flex:1;min-width:0;min-height:47px;border:1px solid #c3e6e9;border-radius:9px;background:white;color:#24535b;font:800 clamp(.85rem,3.7vw,1.2rem) Poppins,system-ui,sans-serif;touch-action:manipulation}.wnk-key:active{background:#eaf9fa}.wnk-key.wnk-special{flex:1.5;font-size:.85rem;background:#f2fafb}.wnk-key.wnk-next{background:#ecfbfc;border:2px solid #67cfd5;color:#dc5595}.wnk-key.wnk-shift-on{background:#ffeef6;border-color:#e665a2}.wnk-hint{font-size:.78rem;color:#687c87;text-align:center;margin:3px 0}@media(max-height:700px){.wnk{gap:4px;margin-top:6px}.wnk-key{min-height:37px}}';
 document.head.append(sheet);
}
export function mountWillenaNameKeyboard({input,container,language='en',onConfirm}={}){
 if(!(input instanceof HTMLInputElement)||!container)throw new Error('A name input and container are required');
 mountStyles();container.replaceChildren();
 const pad=document.createElement('div');pad.className='wnk';pad.setAttribute('role','group');
 pad.setAttribute('aria-label',language==='ko'?'한국어 이름 키보드':'English name keyboard');
 const korean=language==='ko';let shifted=false;
 let committed='',state={l:'',v:'',t:''},history=[];
 const setText=()=>{
  input.value=korean?committed+stateText(state):committed;
  input.dispatchEvent(new Event('input',{bubbles:true}));
 };
 const snapshot=()=>history.push({committed,state:{...state}});
 const push=char=>{
  snapshot();
  if(!korean){committed+=shifted?char.toUpperCase():char;shifted=false;setText();draw();return}
  const j=shifted?(SHIFT_KO[char]||char):char;
  if(shifted){shifted=false}
  const out=combineState(state,j);
  if(out.commit){committed+=stateText(out.commitState||state);state=out.state}
  else state=out.state;
  setText();draw();
 };
 const back=()=>{
  if(!history.length){committed='';state={l:'',v:'',t:''};setText();return}
  const prev=history.pop();committed=prev.committed;state=prev.state;setText();
 };
 const space=()=>{snapshot();committed+=korean?stateText(state)+' ':' ';state={l:'',v:'',t:''};setText()};
 const make=(label,fn,cls='')=>{
  const button=document.createElement('button');button.type='button';
  button.className='wnk-key '+cls;button.textContent=label;
  button.addEventListener('pointerdown',e=>e.preventDefault());
  button.addEventListener('click',fn);return button;
 };
 const draw=()=>{
  pad.replaceChildren();
  const rows=korean?KO_ROWS:EN_ROWS;
  rows.forEach((row,i)=>{
   const line=document.createElement('div');line.className='wnk-row';
   if(i===2)line.append(make('⇧',()=>{shifted=!shifted;draw()},'wnk-special'+(shifted?' wnk-shift-on':'')));
   for(const char of row){
    const label=korean&&shifted?(SHIFT_KO[char]||char):shifted?char.toUpperCase():char;
    line.append(make(label,()=>push(char)));
   }
   if(i===2)line.append(make('⌫',back,'wnk-special'));
   pad.append(line);
  });
  const bottom=document.createElement('div');bottom.className='wnk-row';
  bottom.append(make('space',space,'wnk-special'),make('확인',()=>onConfirm?.(input.value),'wnk-special wnk-next'));
  pad.append(bottom);
 };
 draw();container.append(pad);
 input.value=input.value||'';
 if(input.value)committed=input.value;
 input.readOnly=true;input.setAttribute('inputmode','none');input.setAttribute('autocomplete','off');
 return {element:pad,destroy:()=>{pad.remove();input.readOnly=false;input.removeAttribute('inputmode')}};
}
