(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>String(v??'').normalize('NFKC').toLowerCase().replace(/[’‘]/g,"'").replace(/[“”"]/g,'').replace(/[.!?,;:]/g,'').replace(/\s+/g,' ').trim();
function answers(v){const a=Array.isArray(v)?v:[v];return a.filter(x=>x!=null&&String(x).trim()!=='').map(x=>String(x).trim())}
function parseCorrection(answer){
 const raw=String(answer||'').trim(),m=raw.match(/^(.+?)\s*→\s*(.+)$/);if(!m)return null;
 let left=m[1].trim(),right=m[2].trim(),prefix='',label='';
 const pm=left.match(/^([①-⑳ⓐ-ⓩ]|\d+\s*:?)\s*(.*)$/u);
 if(pm&&pm[2]){prefix=pm[1].trim();left=pm[2].trim();label=prefix.replace(/:$/,'')}
 return{raw,wrong:left,right,prefix,label};
}
function serializeCorrection(parsed,wrong,right){const core=`${String(wrong||'').trim()} → ${String(right||'').trim()}`;return parsed?.prefix?`${parsed.prefix} ${core}`:core}
function detect(rawAnswers){const a=answers(rawAnswers),p=a.map(parseCorrection);if(a.length>1&&p.every(Boolean))return{kind:'multi_correction',answers:a,parsed:p};if(a.length===1&&p[0])return{kind:'correction',answers:a,parsed:p};if(a.length>1)return{kind:'multi',answers:a,parsed:[]};return{kind:'single',answers:a,parsed:[]}}
function ensureStyles(){if($('#willenaConstructedInputStyles'))return;const s=document.createElement('style');s.id='willenaConstructedInputStyles';s.textContent=`
.wcri-multi,.wcri-correction,.wcri-multi-corrections{display:grid;gap:10px;margin:0 0 14px}.wcri-row{display:grid;grid-template-columns:44px 1fr;align-items:center;gap:10px}.wcri-row label,.wcri-label{font-weight:800;color:#19777e;font-size:14px}.wcri-input{width:100%;box-sizing:border-box;border:2px solid #d9e2e5;border-radius:14px;padding:13px 14px;font:600 16px/1.45 inherit;outline:none;background:#fff;color:#303941}.wcri-input:focus{border-color:#58c3d2;box-shadow:0 0 0 3px rgba(88,195,210,.12)}.wcri-correction{grid-template-columns:1fr 34px 1fr;align-items:end}.wcri-cell{display:grid;gap:6px}.wcri-arrow{font-size:24px;font-weight:800;text-align:center;color:#7b8790;padding-bottom:10px}.wcri-multi-row{display:grid;grid-template-columns:40px minmax(0,1fr) 30px minmax(0,1fr);gap:8px;align-items:center}.wcri-multi-arrow{font-size:22px;font-weight:800;text-align:center;color:#7b8790}.wcri-textarea{width:100%;min-height:72px;box-sizing:border-box;border:2px solid #d9e2e5;border-radius:14px;padding:13px 14px;font:600 16px/1.45 inherit;resize:vertical;outline:none;background:#fff;color:#303941}.wcri-textarea:focus{border-color:#58c3d2;box-shadow:0 0 0 3px rgba(88,195,210,.12)}
@media(max-width:600px){.wcri-correction{grid-template-columns:1fr 26px 1fr}.wcri-row{grid-template-columns:36px 1fr}.wcri-multi-row{grid-template-columns:34px minmax(0,1fr) 24px minmax(0,1fr);gap:6px}}
`;document.head.appendChild(s)}
function mount(host,rawAnswers,opts={}){
 ensureStyles();if(!host)throw new Error('Constructed-response input host missing.');const spec=detect(rawAnswers);host.innerHTML='';let value='';
 const emit=()=>{opts.onChange?.(value,spec);return value};
 if(spec.kind==='multi_correction'){
  const box=document.createElement('div');box.className='wcri-multi-corrections';const fallback=['ⓐ','ⓑ','ⓒ','ⓓ'];
  spec.parsed.forEach((p,i)=>{const row=document.createElement('div');row.className='wcri-multi-row';row.innerHTML=`<div class="wcri-label">${esc(p.label||fallback[i]||i+1)}</div><input class="wcri-input wcri-wrong" autocomplete="off" spellcheck="false" placeholder="틀린 부분"><div class="wcri-multi-arrow">→</div><input class="wcri-input wcri-right" autocomplete="off" spellcheck="false" placeholder="고친 부분">`;box.appendChild(row)});host.appendChild(box);
  const sync=()=>{value=$$('.wcri-multi-row',box).map((row,i)=>serializeCorrection(spec.parsed[i],$('.wcri-wrong',row).value,$('.wcri-right',row).value)).join('\n');emit()};$$('.wcri-input',box).forEach(x=>x.addEventListener('input',sync));$('.wcri-input',box)?.focus();
 }else if(spec.kind==='correction'){
  const p=spec.parsed[0],box=document.createElement('div');box.className='wcri-correction';box.innerHTML=`<div class="wcri-cell"><div class="wcri-label">틀린 부분</div><input class="wcri-input wcri-wrong" autocomplete="off" spellcheck="false" placeholder="찾아 쓰기"></div><div class="wcri-arrow">→</div><div class="wcri-cell"><div class="wcri-label">고친 부분</div><input class="wcri-input wcri-right" autocomplete="off" spellcheck="false" placeholder="바르게 고치기"></div>`;host.appendChild(box);const a=$('.wcri-wrong',box),b=$('.wcri-right',box),sync=()=>{value=serializeCorrection(p,a.value,b.value);emit()};a.addEventListener('input',sync);b.addEventListener('input',sync);a.focus();
 }else if(spec.kind==='multi'){
  const box=document.createElement('div');box.className='wcri-multi';const marks=['ⓐ','ⓑ','ⓒ','ⓓ'];spec.answers.forEach((_,i)=>{const row=document.createElement('div');row.className='wcri-row';row.innerHTML=`<label>${marks[i]||i+1}</label><input class="wcri-input" autocomplete="off" spellcheck="false" placeholder="답 ${i+1}">`;box.appendChild(row)});host.appendChild(box);const sync=()=>{value=$$('.wcri-input',box).map(x=>x.value.trim()).join('\n');emit()};$$('.wcri-input',box).forEach(x=>x.addEventListener('input',sync));$('.wcri-input',box)?.focus();
 }else{
  const ta=document.createElement('textarea');ta.className='wcri-textarea';ta.autocomplete='off';ta.spellcheck=false;ta.placeholder=opts.placeholder||'답을 입력하세요';host.appendChild(ta);ta.addEventListener('input',()=>{value=ta.value;emit()});ta.focus();
 }
 return{spec,getValue:()=>value,setDisabled(disabled){$$('input,textarea',host).forEach(x=>x.disabled=!!disabled)},focus(){host.querySelector('input,textarea')?.focus()}};
}
function mountTextarea(textarea,rawAnswers){if(!textarea||textarea.dataset.wcriMounted==='1')return null;textarea.dataset.wcriMounted='1';textarea.style.display='none';const host=document.createElement('div');host.className='wcri-host';textarea.parentNode.insertBefore(host,textarea);return mount(host,rawAnswers,{onChange:value=>{textarea.value=value;textarea.dispatchEvent(new Event('input',{bubbles:true}))}})}
function matches(value,rawAnswers){const spec=detect(rawAnswers),mine=String(value??'');if(spec.answers.length<=1)return spec.answers.some(a=>norm(a)===norm(mine));const mineParts=mine.split(/[,\n;/]+/).map(norm).filter(Boolean).sort(),ans=spec.answers.map(norm).filter(Boolean).sort();return mineParts.length===ans.length&&mineParts.every((x,i)=>x===ans[i])}
window.WillenaConstructedResponseInput={answers,parseCorrection,serializeCorrection,detect,mount,mountTextarea,matches,ensureStyles};
console.log('[REV49c] shared constructed-response input component ready');
})();