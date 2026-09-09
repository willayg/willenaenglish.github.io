const DB='https://fiieuiktlsivwfgyivai.supabase.co';
const API_KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const TABLE='test_prep_practice_flags';
const STORE='willena_question_flags_v1';
const DUPLICATE_MS=24*60*60*1000;
const REASONS=['정답이 이상함','문제가 애매함','영어가 이상함','한국어가 이상함','문장이 이상하게 잘림','시험 범위와 안 맞음','반복 문제','화면/표시 문제','기타'];
let installedRoot=null,getContext=()=>({}),active=null,reason='',sending=false,rendererClass=null,originalRender=null,originalSetDisabled=null;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const now=()=>Date.now();
function token(){return window.WillenaAPI?.getLocalAccessToken?.()||localStorage.getItem('sb_access_token')||''}
function readStore(){try{const v=JSON.parse(localStorage.getItem(STORE)||'{}');return v&&typeof v==='object'&&!Array.isArray(v)?v:{}}catch(_){return{}}}
function writeStore(v){try{localStorage.setItem(STORE,JSON.stringify(v))}catch(_){}}
function pruneStore(){const src=readStore(),cut=now()-DUPLICATE_MS*7,out={};for(const [k,v] of Object.entries(src)){if(Number(v?.at)||0>=cut)out[k]=v}writeStore(out);return out}
function canonicalId(q){return String(q?.tracking?.questionId||q?.id||q?.masteryKey||'').trim()}
function sourceId(q){const base=canonicalId(q);if(!base)return'';const mode=String(q?.metadata?.vocab_mode||'').trim(),type=String(q?.tracking?.questionType||'').trim();return mode?`${base}:${type||mode}`:base}
function duplicateKey(studentId,q){const id=sourceId(q);return studentId&&id?`${studentId}:${id}`:''}
function recentlyFlagged(studentId,q){const key=duplicateKey(studentId,q);if(!key)return false;const row=readStore()[key];return !!row&&now()-Number(row.at||0)<DUPLICATE_MS}
function markFlagged(studentId,q,meta={}){const key=duplicateKey(studentId,q);if(!key)return;const store=pruneStore();store[key]={at:now(),reason:meta.reason||null};writeStore(store)}
function refreshToken(){
  const fetcher=window.WillenaAPI?.fetch?window.WillenaAPI.fetch.bind(window.WillenaAPI):fetch;
  return fetcher(`/.netlify/functions/supabase_auth?action=refresh&_=${Date.now()}`,{credentials:'include',cache:'no-store'})
    .then(r=>r.json().catch(()=>({}))).then(d=>{if(d?.success&&d.access_token){window.WillenaAPI?.setLocalTokens?.(d.access_token,d.refresh_token||'');return d.access_token}return''}).catch(()=> '');
}
function toast(message){
  let el=document.getElementById('willenaQuestionFlagToast');
  if(!el){el=document.createElement('div');el.id='willenaQuestionFlagToast';el.className='wqf-toast';document.body.appendChild(el)}
  el.textContent=message;el.classList.add('show');clearTimeout(el._timer);el._timer=setTimeout(()=>el.classList.remove('show'),1900);
}
function ensureUi(){
  if(!document.getElementById('willenaQuestionFlagStyles')){
    const st=document.createElement('style');st.id='willenaQuestionFlagStyles';st.textContent=`
.wqf-host{position:relative}.wqf-host>.prompt{padding-right:48px}
.wqf-button{position:absolute;top:10px;right:10px;z-index:8;width:36px;height:36px;border:2px solid #67d4da;border-radius:50%;background:#fff;color:#ee5f91;display:grid;place-items:center;padding:0;font-size:17px;line-height:1;font-weight:900;box-shadow:0 3px 10px rgba(21,170,181,.10)}
.wqf-button.flagged{background:#fff4f8;border-color:#ee5f91}.wqf-button:active{transform:scale(.96)}
.wqf-overlay{position:fixed;inset:0;z-index:120000;background:rgba(20,22,29,.40);display:none;align-items:flex-end;justify-content:center;padding:12px}.wqf-overlay.open{display:flex}
.wqf-modal,.wqf-modal *{font-family:Poppins,"Noto Sans KR",system-ui,sans-serif}.wqf-modal{width:min(560px,100%);background:#fff;border:2px solid #67d4da;border-radius:22px;padding:18px;box-shadow:0 18px 60px rgba(20,22,29,.24)}
.wqf-modal h3{margin:0 0 5px;font-size:18px}.wqf-modal p{margin:0 0 13px;color:#78878e;font-size:11px;line-height:1.5}.wqf-reasons{display:flex;flex-wrap:wrap;gap:8px}.wqf-reason{border:1.5px solid #67d4da;background:#fff;color:#ee5f91;border-radius:999px;padding:9px 11px;font-size:11px;font-weight:800}.wqf-reason.on{background:#fff2f7;border-color:#ee5f91}
.wqf-note{width:100%;min-height:78px;margin-top:12px;border:1.5px solid #9de2e7;border-radius:12px;padding:11px;resize:vertical;outline:none}.wqf-note:focus{border-color:#07888d;box-shadow:0 0 0 3px rgba(21,170,181,.10)}
.wqf-actions{display:flex;gap:8px;margin-top:12px}.wqf-actions button{flex:1;border:2px solid #9de2e7;background:#fff;border-radius:13px;padding:11px 13px;font-weight:900;color:#203039}.wqf-actions .send{color:#ee5f91}.wqf-actions button:disabled{opacity:.4}
.wqf-toast{position:fixed;left:50%;bottom:84px;transform:translate(-50%,12px);z-index:120001;background:#203039;color:#fff;padding:9px 13px;border-radius:999px;font:800 12px/1.2 Poppins,"Noto Sans KR",sans-serif;opacity:0;pointer-events:none;transition:.16s}.wqf-toast.show{opacity:.96;transform:translate(-50%,0)}
@media(max-width:680px){.wqf-button{top:8px;right:8px;width:34px;height:34px}.wqf-host>.prompt{padding-right:44px}.wqf-modal{padding:16px}.wqf-actions{flex-direction:column}}
`;document.head.appendChild(st)
  }
  if(document.getElementById('willenaQuestionFlagOverlay'))return;
  const overlay=document.createElement('div');overlay.id='willenaQuestionFlagOverlay';overlay.className='wqf-overlay';overlay.innerHTML=`<div class="wqf-modal" role="dialog" aria-modal="true" aria-labelledby="wqfTitle"><h3 id="wqfTitle">이 문제에 문제가 있나요? 🚩</h3><p>이유를 골라 주세요. 문제 번호와 현재 화면 정보가 함께 저장됩니다.</p><div class="wqf-reasons" id="wqfReasons"></div><textarea class="wqf-note" id="wqfNote" maxlength="500" placeholder="추가 메모 (선택)"></textarea><div class="wqf-actions"><button type="button" id="wqfCancel">취소</button><button type="button" class="send" id="wqfSend" disabled>신고하기</button></div></div>`;
  document.body.appendChild(overlay);overlay.addEventListener('click',e=>{if(e.target===overlay)close()});document.getElementById('wqfCancel').onclick=close;document.getElementById('wqfSend').onclick=send;
}
function setBusy(on){sending=!!on;['wqfCancel','wqfSend'].forEach(id=>{const b=document.getElementById(id);if(b)b.disabled=on||(id==='wqfSend'&&!reason)})}
function close(){if(sending)return;document.getElementById('willenaQuestionFlagOverlay')?.classList.remove('open');active=null;reason=''}
function open(detail){
  ensureUi();const context={...(getContext?.()||{})},studentId=String(context.studentId||'');
  if(recentlyFlagged(studentId,detail.question)){toast('이 문제는 이미 신고했어요.');return}
  active={...detail,context};reason='';sending=false;const wrap=document.getElementById('wqfReasons'),note=document.getElementById('wqfNote');note.value='';wrap.innerHTML=REASONS.map(x=>`<button type="button" class="wqf-reason" data-reason="${esc(x)}">${esc(x)}</button>`).join('');
  wrap.querySelectorAll('[data-reason]').forEach(b=>b.onclick=()=>{reason=b.dataset.reason||'';wrap.querySelectorAll('[data-reason]').forEach(x=>x.classList.toggle('on',x===b));setBusy(false)});setBusy(false);document.getElementById('willenaQuestionFlagOverlay').classList.add('open');
}
function sourceType(q,c){
  if(c.reviewMode)return'wrong_review';const p=String(c.practiceType||q?.tracking?.practiceType||q?.skill||'').toLowerCase();
  if(p==='vocabulary')return'vocab_practice';if(p==='vocab_test')return'vocab_test';if(p==='passage')return'sentence_unscramble';return'exam_question';
}
function snapshotOf(q,renderer,c){
  let response=null;try{response=renderer?.getResponse?.()??null}catch(_){}
  return{app:'test-prep-v2',app_revision:c.appRevision||null,page:location.pathname,review_mode:!!c.reviewMode,plan_id:c.planId||null,lesson:c.lesson||null,practice_type:c.practiceType||q?.tracking?.practiceType||q?.skill||null,question_id:canonicalId(q)||null,mastery_key:q?.masteryKey||null,skill:q?.skill||null,form:q?.form||null,question_type:q?.tracking?.questionType||null,source:q?.source||null,prompt:q?.prompt||null,context:q?.context||{},choices:Array.isArray(q?.choices)?q.choices:[],correct_answer:Array.isArray(q?.answer)?q.answer:[],targets:Array.isArray(q?.tracking?.targets)?q.tracking.targets:[],student_response:response,metadata:q?.metadata||{}};
}
async function postFlag(payload,access){return fetch(`${DB}/rest/v1/${TABLE}`,{method:'POST',headers:{apikey:API_KEY,Authorization:`Bearer ${access}`,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify(payload)})}
async function send(){
  if(!active||sending)return;if(!reason){toast('이유를 하나 골라 주세요.');return}
  const current=active,c=current.context||{},studentId=String(c.studentId||'');if(!studentId){toast('로그인이 필요합니다.');return}
  const q=current.question||{},sid=sourceId(q)||null,payload={student_id:studentId,plan_id:c.planId||null,unit_key:c.lesson||null,practice_type:String(c.practiceType||q?.tracking?.practiceType||q?.skill||'unknown'),source_type:sourceType(q,c),source_id:sid,reason,note:document.getElementById('wqfNote')?.value.trim()||null,snapshot:snapshotOf(q,current.renderer,c),status:'open'};
  setBusy(true);try{
    let access=token();if(!access)access=await refreshToken();if(!access)throw new Error('로그인이 필요합니다.');let r=await postFlag(payload,access);if(r.status===401){access=await refreshToken();if(access)r=await postFlag(payload,access)}if(!r.ok)throw new Error(await r.text());
    markFlagged(studentId,q,{reason});const btn=current.host?.querySelector?.('[data-question-flag]');if(btn){btn.classList.add('flagged');btn.setAttribute('aria-label','신고 완료');btn.title='신고 완료'}sending=false;document.getElementById('willenaQuestionFlagOverlay')?.classList.remove('open');active=null;reason='';toast('신고했습니다. 고마워요!');
  }catch(e){console.error('[question-flags] save failed',e);sending=false;setBusy(false);toast('신고 저장에 실패했습니다.')}
}
function mount(detail){
  const host=detail?.host,q=detail?.question;if(!host||!q||!host.isConnected)return;ensureUi();host.classList.add('wqf-host');host.querySelector('[data-question-flag]')?.remove();const c=getContext?.()||{},studentId=String(c.studentId||'');const b=document.createElement('button');b.type='button';b.className='wqf-button';b.dataset.questionFlag='1';b.dataset.questionUtility='1';b.textContent='⚑';b.title='문제 신고';b.setAttribute('aria-label','문제 신고');if(recentlyFlagged(studentId,q)){b.classList.add('flagged');b.title='신고 완료';b.setAttribute('aria-label','신고 완료')}b.onclick=ev=>{ev.preventDefault();ev.stopPropagation();open(detail)};host.appendChild(b);
}
function instrument(Renderer){
  if(!Renderer?.prototype||rendererClass===Renderer)return;
  rendererClass=Renderer;originalRender=Renderer.prototype.render;originalSetDisabled=Renderer.prototype.setDisabled;
  Renderer.prototype.render=function(...args){const out=originalRender.apply(this,args);mount({host:this.host,question:this.question,renderer:this});return out};
  if(typeof originalSetDisabled==='function')Renderer.prototype.setDisabled=function(...args){const out=originalSetDisabled.apply(this,args);this.host?.querySelectorAll?.('[data-question-flag]').forEach(b=>{b.disabled=false});return out};
}
export function installQuestionFlags({root=document,contextProvider=null,Renderer=null}={}){uninstallQuestionFlags();installedRoot=root||document;getContext=typeof contextProvider==='function'?contextProvider:()=>({});ensureUi();pruneStore();instrument(Renderer);return{uninstall:uninstallQuestionFlags}}
export function uninstallQuestionFlags(){if(rendererClass?.prototype&&originalRender)rendererClass.prototype.render=originalRender;if(rendererClass?.prototype&&originalSetDisabled)rendererClass.prototype.setDisabled=originalSetDisabled;rendererClass=null;originalRender=null;originalSetDisabled=null;installedRoot=null;active=null;reason='';sending=false}
export {REASONS};