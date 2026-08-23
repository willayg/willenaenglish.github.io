(function(global){
'use strict';

if(location.hostname!=='staging.willenaenglish.com')return;
if(!global.WillenaActivityEngine||!global.WillenaActivityEngine.prototype)return;
if(global.__WillenaStudyV3QuestionFlagger)return;
global.__WillenaStudyV3QuestionFlagger=true;

var SUPABASE_URL='https://gxwfsqxyuufqtitspfqg.supabase.co';
var SUPABASE_KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
var TABLE='study_question_flags';
var STORAGE_PREFIX='willena-study-v3-flagged:';
var activeActivity=null;
var activeButton=null;

var REASONS=[
  ['wrong_answer','Wrong answer'],
  ['unclear_wording','Weird / unclear wording'],
  ['broken_prompt','Broken / missing prompt'],
  ['bad_distractors','Bad answer choices'],
  ['audio_problem','Audio problem'],
  ['difficulty','Too hard / too easy'],
  ['duplicate','Duplicate / repetitive'],
  ['wrong_mapping','Wrong book / unit / skill'],
  ['other','Other']
];

function text(v){return String(v==null?'':v).trim();}
function token(){
  try{
    if(global.WillenaAPI&&typeof global.WillenaAPI.getLocalAccessToken==='function'){
      var t=text(global.WillenaAPI.getLocalAccessToken());if(t)return t;
    }
    return text(localStorage.getItem('sb_access_token')||sessionStorage.getItem('sb_access_token'));
  }catch(_){return'';}
}
function sourceKey(a){return text(a&&a.sourceType||'activity')+':'+text(a&&a.sourceId||a&&a.id);}
function isLocallyFlagged(a){try{return localStorage.getItem(STORAGE_PREFIX+sourceKey(a))==='1';}catch(_){return false;}}
function rememberFlag(a){try{localStorage.setItem(STORAGE_PREFIX+sourceKey(a),'1');}catch(_){}}
function modeFor(root){
  if(root&&root.closest&&root.closest('#aiCoachPracticeOverlay'))return'ai_coach';
  if(root&&root.closest&&root.closest('#v2PracticePanel'))return'daily_or_book_practice';
  if(root&&root.closest&&root.closest('#bookPracticeArea'))return'book_practice';
  return'study_v3';
}
function safeJson(v){try{return JSON.parse(JSON.stringify(v));}catch(_){return null;}}
function injectStyles(){
  if(document.getElementById('v3QuestionFlaggerStyles'))return;
  var s=document.createElement('style');s.id='v3QuestionFlaggerStyles';
  s.textContent='\
.activity-card{position:relative}\
.v3-qflag-btn{position:absolute;top:10px;right:10px;width:30px;height:30px;border-radius:50%;border:1px solid rgba(15,23,42,.13);background:rgba(255,255,255,.94);color:#64748b;display:grid;place-items:center;padding:0;font-size:16px;line-height:1;box-shadow:0 2px 8px rgba(15,23,42,.07);z-index:8;cursor:pointer}\
.v3-qflag-btn:hover{background:#fff;color:#e11d48}.v3-qflag-btn.is-flagged{background:#fff1f2;border-color:#fecdd3;color:#e11d48}\
.v3-qflag-backdrop{position:fixed;inset:0;background:rgba(15,23,42,.38);z-index:99990;display:flex;align-items:flex-end;justify-content:center;padding:14px}\
.v3-qflag-sheet{width:min(520px,100%);background:#fff;border-radius:22px;padding:18px;box-shadow:0 22px 60px rgba(15,23,42,.28);max-height:min(82vh,700px);overflow:auto}\
.v3-qflag-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}.v3-qflag-head strong{font:700 17px/1.2 Poppins,sans-serif;color:#172033}.v3-qflag-close{border:0;background:#f1f5f9;width:32px;height:32px;border-radius:50%;font-size:20px;color:#64748b}\
.v3-qflag-preview{font:500 13px/1.45 Poppins,sans-serif;color:#64748b;background:#f8fafc;border-radius:12px;padding:10px 12px;margin-bottom:12px;max-height:82px;overflow:hidden}\
.v3-qflag-reasons{display:grid;grid-template-columns:1fr 1fr;gap:8px}.v3-qflag-reason{border:1px solid #e2e8f0;background:#fff;border-radius:12px;padding:10px;text-align:left;font:600 13px/1.25 Poppins,sans-serif;color:#334155}.v3-qflag-reason.is-selected{border-color:#fb7185;background:#fff1f2;color:#be123c}\
.v3-qflag-note{width:100%;box-sizing:border-box;margin-top:10px;border:1px solid #e2e8f0;border-radius:12px;min-height:72px;padding:10px 12px;resize:vertical;font:500 14px/1.4 Poppins,sans-serif;color:#172033;outline:none}.v3-qflag-note:focus{border-color:#fda4af;box-shadow:0 0 0 3px rgba(251,113,133,.12)}\
.v3-qflag-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:12px}.v3-qflag-cancel,.v3-qflag-save{border:0;border-radius:12px;padding:10px 14px;font:700 13px/1 Poppins,sans-serif}.v3-qflag-cancel{background:#f1f5f9;color:#475569}.v3-qflag-save{background:#e11d48;color:#fff}.v3-qflag-save:disabled{opacity:.45}\
.v3-qflag-status{min-height:18px;margin-top:8px;font:600 12px/1.3 Poppins,sans-serif;color:#be123c}\
@media(max-width:520px){.v3-qflag-reasons{grid-template-columns:1fr}.v3-qflag-sheet{border-radius:20px 20px 16px 16px;padding:16px}.v3-qflag-btn{top:8px;right:8px}}';
  document.head.appendChild(s);
}
function closeSheet(){var x=document.getElementById('v3QuestionFlaggerBackdrop');if(x)x.remove();activeActivity=null;activeButton=null;}
function openSheet(activity,button,root){
  closeSheet();
  activeActivity=activity;activeButton=button;
  var backdrop=document.createElement('div');backdrop.id='v3QuestionFlaggerBackdrop';backdrop.className='v3-qflag-backdrop';
  var sheet=document.createElement('div');sheet.className='v3-qflag-sheet';
  var head=document.createElement('div');head.className='v3-qflag-head';head.innerHTML='<strong>Flag this question</strong><button class="v3-qflag-close" type="button" aria-label="Close">×</button>';
  var preview=document.createElement('div');preview.className='v3-qflag-preview';preview.textContent=text(activity&&activity.stimulus&&activity.stimulus.prompt)||text(activity&&activity.q)||'(No prompt text)';
  var reasons=document.createElement('div');reasons.className='v3-qflag-reasons';
  var selected='';
  REASONS.forEach(function(pair){var b=document.createElement('button');b.type='button';b.className='v3-qflag-reason';b.dataset.reason=pair[0];b.textContent=pair[1];b.addEventListener('click',function(){selected=pair[0];reasons.querySelectorAll('.v3-qflag-reason').forEach(function(x){x.classList.toggle('is-selected',x===b);});save.disabled=false;});reasons.appendChild(b);});
  var note=document.createElement('textarea');note.className='v3-qflag-note';note.placeholder='Optional note…';
  var status=document.createElement('div');status.className='v3-qflag-status';
  var actions=document.createElement('div');actions.className='v3-qflag-actions';
  var cancel=document.createElement('button');cancel.type='button';cancel.className='v3-qflag-cancel';cancel.textContent='Cancel';
  var save=document.createElement('button');save.type='button';save.className='v3-qflag-save';save.textContent='Save flag';save.disabled=true;
  actions.appendChild(cancel);actions.appendChild(save);
  sheet.appendChild(head);sheet.appendChild(preview);sheet.appendChild(reasons);sheet.appendChild(note);sheet.appendChild(status);sheet.appendChild(actions);backdrop.appendChild(sheet);document.body.appendChild(backdrop);
  head.querySelector('.v3-qflag-close').addEventListener('click',closeSheet);cancel.addEventListener('click',closeSheet);backdrop.addEventListener('click',function(e){if(e.target===backdrop)closeSheet();});
  save.addEventListener('click',async function(){
    if(!selected||!activeActivity)return;
    save.disabled=true;save.textContent='Saving…';status.textContent='';
    try{
      await saveFlag(activeActivity,selected,note.value,modeFor(root));
      rememberFlag(activeActivity);
      if(activeButton){activeButton.classList.add('is-flagged');activeButton.setAttribute('aria-label','Question flagged');activeButton.title='Flag saved';}
      save.textContent='Saved ✓';
      setTimeout(closeSheet,350);
    }catch(e){
      console.warn('[Study V3 flagger]',e);
      status.textContent=e&&e.message?e.message:'Could not save flag.';
      save.disabled=false;save.textContent='Try again';
    }
  });
}
async function saveFlag(a,reason,note,mode){
  var access=token();if(!access)throw new Error('Not signed in — flag was not saved.');
  var payload={
    reason:reason,
    note:text(note)||null,
    activity_id:text(a&&a.id)||null,
    source_type:text(a&&a.sourceType)||null,
    source_id:text(a&&a.sourceId)||null,
    book_id:a&&a.bookId!=null?String(a.bookId):null,
    unit_id:a&&a.unitId!=null?String(a.unitId):null,
    section_id:a&&a.sectionId!=null?String(a.sectionId):null,
    skill:text(a&&a.skill)||null,
    mode:mode,
    prompt_snapshot:text(a&&a.stimulus&&a.stimulus.prompt)||text(a&&a.q)||null,
    context_snapshot:text(a&&a.stimulus&&a.stimulus.context)||text(a&&a.meaning)||null,
    answer_snapshot:safeJson(a&&a.answer!==undefined?a.answer:a&&a.a),
    response_type:text(a&&a.response&&a.response.type||a&&a.type)||null,
    page_url:location.href,
    metadata:safeJson(a&&a.metadata)||{}
  };
  var r=await fetch(SUPABASE_URL+'/rest/v1/'+TABLE,{method:'POST',headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+access,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify(payload),cache:'no-store'});
  if(!r.ok){var body=await r.text().catch(function(){return'';});throw new Error('Could not save flag ('+r.status+')'+(body?' · '+body.slice(0,120):''));}
}
function injectFlag(engine){
  var a=engine&&engine.current,root=engine&&engine.root;if(!a||!root)return;
  var card=root.querySelector('.activity-card');if(!card)return;
  var old=card.querySelector('.v3-qflag-btn');if(old)return;
  var b=document.createElement('button');b.type='button';b.className='v3-qflag-btn'+(isLocallyFlagged(a)?' is-flagged':'');b.innerHTML='⚑';b.title=isLocallyFlagged(a)?'Flag saved':'Flag weird question';b.setAttribute('aria-label',b.title);
  b.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();openSheet(a,b,root);});
  card.appendChild(b);
}

injectStyles();
var proto=global.WillenaActivityEngine.prototype;
if(!proto.__v3FlaggerRender){
  var originalRender=proto.render;
  proto.render=function(){var result=originalRender.apply(this,arguments);try{injectFlag(this);}catch(e){console.debug('[Study V3 flagger] inject skipped',e);}return result;};
  proto.__v3FlaggerRender=true;
}

})(window);
