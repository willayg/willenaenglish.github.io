(function(){
'use strict';
const oldText=window.text,oldBlock=window.block,oldArr=window.arr,oldObj=window.obj;
if(typeof oldText!=='function'||typeof oldBlock!=='function'||typeof oldArr!=='function'||typeof oldObj!=='function')return;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LABELS={korean:'우리말',sentence:'문장',text:'',question:'질문',answer:'답',from:'원문',to:'바꾼 문장',label:'',value:'',given:'주어진 말',hint:'힌트'};
const quietKeys=new Set(['sentence','text','value']);
function any(v,u=[]){
  if(v==null||v==='')return'';
  if(Array.isArray(v))return v.map(x=>any(x,u)).filter(Boolean).join('<hr>');
  if(typeof v==='object'){
    const priority=['korean','sentence','text','question','answer','from','to','given','hint','label','value'];
    const keys=[...priority.filter(k=>Object.prototype.hasOwnProperty.call(v,k)),...Object.keys(v).filter(k=>!priority.includes(k))];
    return keys.map(k=>{
      const val=v[k];
      if(val==null||val==='')return'';
      const label=quietKeys.has(k)?'':(LABELS[k]??k);
      return `<div class="structured-value">${label?`<b>${esc(label)}</b> `:''}${any(val,u)}</div>`;
    }).filter(Boolean).join('');
  }
  return oldText(v,u);
}
window.block=function(title,v,u=[]){
  if(v==null||v==='')return'';
  return `<div class="context">${title?`<div class="context-title">${esc(title)}</div>`:''}${any(v,u)}</div>`;
};
window.arr=function(title,a,u=[]){
  if(!Array.isArray(a)||!a.length)return'';
  return `<div class="context">${title?`<div class="context-title">${esc(title)}</div>`:''}<div class="items">${a.map(x=>`<div class="item">${any(x,u)}</div>`).join('')}</div></div>`;
};
window.obj=function(title,o,cls='segment',u=[]){
  if(!o||typeof o!=='object'||Array.isArray(o))return'';
  return `<div class="context">${title?`<div class="context-title">${esc(title)}</div>`:''}<div class="${cls==='claim'?'claims':'segments'}">${Object.entries(o).map(([k,v])=>`<div class="${cls}"><b>${esc(k)}</b> ${any(v,u)}</div>`).join('')}</div></div>`;
};
window.WillenaTestPrepSafeRender={renderValue:any};
})();
