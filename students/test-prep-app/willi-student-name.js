(function(){
'use strict';
function studentName(){const u=window.WillenaTestPrepAuth?.state?.user||{};return String(u.korean_name||u.name||u.username||'').trim()}
window.WillenaWilliStudentName=studentName;
function injectGrammarContext(){const section=String(window.WillenaTestPrepQuestionEngine?.section||'').toLowerCase();if(!['grammar','reading'].includes(section)||!document.querySelector('#card .feedback.bad'))return;const name=studentName(),e=document.querySelector('#card #explanation');if(!name||!e||e.querySelector('.tp-willi-student-name-context'))return;const s=document.createElement('span');s.className='tp-willi-student-name-context';s.style.display='none';s.setAttribute('aria-hidden','true');s.textContent=`학생 이름: ${name}. 이름은 설명에서 자연스러울 때 최대 한 번만 사용하고, 이름에 임의의 호칭이나 성별 표현을 붙이지 마세요.`;e.appendChild(s)}

document.addEventListener('click',e=>{if(e.target instanceof Element&&e.target.closest('#check'))setTimeout(injectGrammarContext,0)},false);

function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function inlineMarkdown(v){
  let s=esc(v);
  s=s.replace(/`([^`]+)`/g,'<code>$1</code>');
  s=s.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
  return s;
}
function formatWilliResult(){
  const out=document.getElementById('tpAskWilliGrammarResult');
  if(!out||out.classList.contains('error'))return;
  const raw=String(out.textContent||'').trim();
  if(!raw||!/(\*\*|`|(?:^|\n)\s*[-*]\s+)/m.test(raw))return;
  const blocks=[];
  for(const line of raw.split(/\n/)){
    const t=line.trim();
    if(!t)continue;
    const bullet=t.match(/^[-*]\s+(.+)$/);
    if(bullet)blocks.push(`<div class="tp-willi-md-bullet"><span>•</span><div>${inlineMarkdown(bullet[1])}</div></div>`);
    else blocks.push(`<p>${inlineMarkdown(t)}</p>`);
  }
  out.innerHTML=blocks.join('');
}
function installWilliFormatter(){
  if(!document.getElementById('tpWilliMarkdownStyle')){
    const s=document.createElement('style');
    s.id='tpWilliMarkdownStyle';
    s.textContent='#tpAskWilliGrammarResult{white-space:normal!important}#tpAskWilliGrammarResult p{margin:0 0 10px}#tpAskWilliGrammarResult p:last-child{margin-bottom:0}#tpAskWilliGrammarResult strong{font-weight:800;color:#18363d}#tpAskWilliGrammarResult code{padding:1px 4px;border-radius:5px;background:#e7f5f7;color:#18363d;font:700 .96em/1.5 ui-monospace,SFMono-Regular,Consolas,monospace}#tpAskWilliGrammarResult .tp-willi-md-bullet{display:grid;grid-template-columns:16px minmax(0,1fr);gap:5px;margin:0 0 9px}#tpAskWilliGrammarResult .tp-willi-md-bullet>span{font-weight:900;color:#15aab5}';
    document.head.appendChild(s);
  }
  const observer=new MutationObserver(()=>formatWilliResult());
  observer.observe(document.body,{childList:true,subtree:true,characterData:true});
  formatWilliResult();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installWilliFormatter,{once:true});else installWilliFormatter();
})();