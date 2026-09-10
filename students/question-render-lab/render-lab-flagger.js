// Render Lab audit flagger. Keeps the lab renderer untouched and patches the shared renderer only in this page.
import {QuestionRenderer} from '../test-prep-v2/question-renderer.js';

const REASONS=['정답이 이상함','문제가 애매함','영어가 이상함','한국어가 이상함','문장이 이상하게 잘림','시험 범위와 안 맞음','반복 문제','화면/표시 문제','기타'];
let currentQuestion=null;
let sending=false;

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
const isUuid=s=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(s||''));

function toast(msg,bad=false){
  let t=document.getElementById('renderLabFlagToast');
  if(!t){t=document.createElement('div');t.id='renderLabFlagToast';document.body.appendChild(t)}
  t.textContent=msg;t.className=`rl-flag-toast show${bad?' bad':''}`;
  clearTimeout(t._timer);t._timer=setTimeout(()=>t.classList.remove('show'),1800);
}

function ensureUi(){
  if(document.getElementById('renderLabFlagStyles'))return;
  const st=document.createElement('style');st.id='renderLabFlagStyles';st.textContent=`
    .rl-flag-bar{display:flex;gap:8px;align-items:center;justify-content:flex-end;flex-wrap:wrap;margin:0 0 12px}
    .rl-flag-btn{border:1.5px solid #cfd8dc;background:#fff;color:#37474f;border-radius:10px;padding:8px 11px;font:700 12px/1.1 system-ui,sans-serif;cursor:pointer}
    .rl-flag-btn:hover{background:#f7fafb}.rl-flag-btn:disabled{opacity:.45;cursor:wait}
    .rl-underline-btn{border-color:#ef8f56;color:#b94c17;background:#fff8f3}.rl-underline-btn:hover{background:#ffefe4}.rl-underline-btn.done{border-color:#72b68d;color:#2f7a4c;background:#f1fbf4}
    .rl-flag-overlay{position:fixed;inset:0;background:rgba(20,22,29,.38);display:none;align-items:flex-end;justify-content:center;padding:12px;z-index:100100}.rl-flag-overlay.open{display:flex}
    .rl-flag-modal{width:min(560px,100%);background:#fff;border:2px solid #9ecbd0;border-radius:20px;padding:18px;font-family:system-ui,sans-serif}.rl-flag-modal h3{margin:0 0 5px;font-size:17px}.rl-flag-modal p{margin:0 0 13px;color:#6f7f86;font-size:12px}
    .rl-flag-reasons{display:flex;flex-wrap:wrap;gap:7px}.rl-flag-reason{border:1.5px solid #b8dadd;background:#fff;border-radius:999px;padding:8px 10px;font-size:11px;font-weight:700;cursor:pointer}.rl-flag-reason.on{background:#eefafa;border-color:#5fbfc7}
    .rl-flag-note{box-sizing:border-box;width:100%;min-height:72px;margin-top:12px;border:1.5px solid #b8dadd;border-radius:11px;padding:10px;resize:vertical}.rl-flag-actions{display:flex;gap:8px;margin-top:12px}.rl-flag-actions button{flex:1;border:1.5px solid #9ecbd0;background:#fff;border-radius:11px;padding:10px;font-weight:800;cursor:pointer}.rl-flag-actions .send{background:#297f86;color:#fff;border-color:#297f86}
    .rl-flag-toast{position:fixed;left:50%;bottom:82px;transform:translate(-50%,14px);opacity:0;pointer-events:none;z-index:100200;background:#263238;color:#fff;border-radius:999px;padding:9px 14px;font:700 12px system-ui,sans-serif;transition:.16s}.rl-flag-toast.show{opacity:1;transform:translate(-50%,0)}.rl-flag-toast.bad{background:#9d3b34}
  `;document.head.appendChild(st);
  const o=document.createElement('div');o.id='renderLabFlagOverlay';o.className='rl-flag-overlay';o.innerHTML=`<div class="rl-flag-modal"><h3>Flag this question 🚩</h3><p>Choose the problem. The current question details will be saved with it.</p><div id="renderLabFlagReasons" class="rl-flag-reasons"></div><textarea id="renderLabFlagNote" class="rl-flag-note" placeholder="Extra note (optional)"></textarea><div class="rl-flag-actions"><button id="renderLabFlagCancel">Cancel</button><button id="renderLabFlagSend" class="send">Save flag</button></div></div>`;document.body.appendChild(o);
  o.onclick=e=>{if(e.target===o)closeModal()};
  document.getElementById('renderLabFlagCancel').onclick=closeModal;
}

function questionMeta(q,quickFlag=null){
  return {
    page:location.pathname,
    render_lab:true,
    quick_flag:quickFlag,
    section:q?.tracking?.section||q?.section||document.getElementById('skill')?.value||null,
    source_label:q?.source?.label||q?.source?.code||q?.student_source_label||null,
    question_type:q?.tracking?.questionType||q?.questionType||null,
    source_question_number:q?.tracking?.sourceQuestionNumber||q?.sourceQuestionNumber||null,
    book_id:q?.bookId||null,
    form:q?.form||null
  };
}

async function saveFlag(q,reason,note,quickFlag=null){
  if(!q||!isUuid(q.id))throw new Error('This is a generated lab item, not a database question.');
  const api=window.__renderLabApi;
  if(!api?.base||!api?.headers)throw new Error('Render Lab database connection is not ready.');
  const payload={question_id:q.id,reason,note:note||null,selected_answer:[],correct_answer_snapshot:null,status:'open',metadata:questionMeta(q,quickFlag)};
  const headers={...api.headers,'Content-Type':'application/json',Prefer:'return=minimal'};
  const r=await fetch(`${api.base}/rest/v1/test_prep_question_flags`,{method:'POST',headers,body:JSON.stringify(payload)});
  if(!r.ok)throw new Error(await r.text()||`Flag save failed (${r.status})`);
  q._flagged=true;
}

function closeModal(){if(sending)return;document.getElementById('renderLabFlagOverlay')?.classList.remove('open')}
function openModal(q){
  ensureUi();currentQuestion=q;
  let selected='기타';const root=document.getElementById('renderLabFlagReasons');const note=document.getElementById('renderLabFlagNote');note.value='';
  root.innerHTML=REASONS.map(x=>`<button type="button" class="rl-flag-reason ${x==='기타'?'on':''}" data-reason="${esc(x)}">${esc(x)}</button>`).join('');
  root.querySelectorAll('.rl-flag-reason').forEach(b=>b.onclick=()=>{selected=b.dataset.reason;root.querySelectorAll('.rl-flag-reason').forEach(x=>x.classList.toggle('on',x===b))});
  document.getElementById('renderLabFlagSend').onclick=async()=>{if(sending)return;sending=true;setModalBusy(true);try{await saveFlag(currentQuestion,selected,note.value.trim()||null);document.getElementById('renderLabFlagOverlay').classList.remove('open');toast('Flag saved');updateBar(currentQuestion)}catch(e){console.error('[render lab flag]',e);toast(e.message||'Could not save flag',true)}finally{sending=false;setModalBusy(false)}};
  document.getElementById('renderLabFlagOverlay').classList.add('open');
}
function setModalBusy(on){['renderLabFlagCancel','renderLabFlagSend'].forEach(id=>{const b=document.getElementById(id);if(b)b.disabled=on})}

async function quickUnderline(q,button){
  if(sending)return;sending=true;button.disabled=true;const old=button.textContent;button.textContent='Saving…';
  try{await saveFlag(q,'화면/표시 문제','Underline broken','underline_broken');button.textContent='✓ Underline flagged';button.classList.add('done');toast('Underline problem flagged')}catch(e){console.error('[render lab underline flag]',e);button.textContent=old;button.disabled=false;toast(e.message||'Could not save flag',true);sending=false;return}
  button.disabled=true;sending=false;
}

function updateBar(q,host){
  ensureUi();host=host||document.getElementById('card');if(!host)return;
  host.querySelector('.rl-flag-bar')?.remove();
  const bar=document.createElement('div');bar.className='rl-flag-bar';
  const normal=document.createElement('button');normal.type='button';normal.className='rl-flag-btn';normal.textContent=q?._flagged?'🚩 Flag another issue':'🚩 Flag issue';normal.onclick=()=>openModal(q);
  const underline=document.createElement('button');underline.type='button';underline.className='rl-flag-btn rl-underline-btn';underline.textContent='Underline broken';underline.onclick=()=>quickUnderline(q,underline);
  if(!isUuid(q?.id)){normal.disabled=true;underline.disabled=true;normal.title=underline.title='Generated lab item — no database question ID';}
  bar.append(normal,underline);host.prepend(bar);
}

ensureUi();
const originalRender=QuestionRenderer.prototype.render;
QuestionRenderer.prototype.render=function(q,...args){
  currentQuestion=q;
  const result=originalRender.call(this,q,...args);
  queueMicrotask(()=>updateBar(q,this.root||this.container||document.getElementById('card')));
  return result;
};
