(function(global){
'use strict';

var SESSION_SIZE=12;
var CONTENT_URL='https://gxwfsqxyuufqtitspfqg.supabase.co';
var CONTENT_KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
var OP_URL='https://fiieuiktlsivwfgyivai.supabase.co';
var OP_KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
var ACTIVE_BOOK_KEY='willena-study-v2-active-book';

var statusEl=document.getElementById('vocabStudyStatus');
var bookTitleEl=document.getElementById('vocabBookTitle');
var unitTitleEl=document.getElementById('vocabUnitTitle');
var itemCountEl=document.getElementById('vocabItemCount');
var startBtn=document.getElementById('vocabStudyStart');
var homeEl=document.getElementById('vocabStudyHome');
var sessionEl=document.getElementById('vocabStudySession');
var root=document.getElementById('vocabActivityRoot');
var closeBtn=document.getElementById('vocabStudyClose');
var nextBtn=document.getElementById('vocabStudyNext');
var progressEl=document.getElementById('vocabStudyProgress');
var titleEl=document.getElementById('vocabStudyTitle');

var state={
  book:null,
  unit:null,
  items:[],
  sessionItems:[],
  index:0,
  answered:false,
  engine:null
};

function txt(v){return String(v==null?'':v).trim();}
function arr(v){return Array.isArray(v)?v:[];}
function shuffle(items){return items.slice().sort(function(){return Math.random()-.5;});}
function unique(items){
  var out=[];
  items.forEach(function(x){var v=txt(x);if(v&&out.indexOf(v)<0)out.push(v);});
  return out;
}
function setStatus(message){if(statusEl)statusEl.textContent=message;}

async function api(url,opts){
  var fn=global.WillenaAPI&&typeof global.WillenaAPI.fetch==='function'
    ?global.WillenaAPI.fetch.bind(global.WillenaAPI)
    :global.fetch.bind(global);
  var r=await fn(url,Object.assign({credentials:'include',cache:'no-store'},opts||{}));
  var d=await r.json().catch(function(){return{};});
  if(!r.ok||(d&&d.success===false))throw new Error(d&&d.error||('Request failed ('+r.status+').'));
  return d;
}

async function profile(){
  return api('/.netlify/functions/progress_summary?section=my_progress&_='+Date.now());
}

async function assignments(className){
  var r=await fetch(OP_URL+'/rest/v1/rpc/get_study_assignment_for_class',{
    method:'POST',
    headers:{apikey:OP_KEY,Authorization:'Bearer '+OP_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({p_class_name:className}),
    cache:'no-store'
  });
  var d=await r.json().catch(function(){return{};});
  if(!r.ok||!d.success)throw new Error(d.error||'Could not load assigned books.');
  return d;
}

async function content(path){
  var out=[],offset=0,pageSize=1000;
  while(true){
    var sep=path.indexOf('?')>=0?'&':'?';
    var r=await fetch(CONTENT_URL+'/rest/v1/'+path+sep+'limit='+pageSize+'&offset='+offset,{
      headers:{apikey:CONTENT_KEY,Authorization:'Bearer '+CONTENT_KEY},
      cache:'no-store'
    });
    if(!r.ok)throw new Error('Content DB '+r.status);
    var rows=await r.json();
    if(!Array.isArray(rows))throw new Error('Content DB returned invalid data.');
    out=out.concat(rows);
    if(rows.length<pageSize)break;
    offset+=pageSize;
    if(offset>100000)throw new Error('Content DB pagination safety limit exceeded.');
  }
  return out;
}

function resolveUnit(rows,assignment){
  if(!rows.length)return null;
  var saved='';
  try{saved=localStorage.getItem('willena-study-v2-unit:'+assignment.book_id)||'';}catch(_){}
  var hint=saved||assignment.current_unit||assignment.starting_unit||'';
  var n=(String(hint).match(/\d+/)||[])[0];
  return rows.find(function(u){
    return String(u.id)===String(hint)||String(u.unit_number)===String(n);
  })||rows[0];
}

async function resolveBookAndUnit(){
  var me=await profile();
  var className=txt(me.class);
  if(!className)throw new Error('No active class is assigned.');

  var a=await assignments(className);
  var list=Array.isArray(a.assignments)&&a.assignments.length?a.assignments:(a.assignment?[a.assignment]:[]);
  if(!list.length)throw new Error('No active book is assigned.');

  var wanted='';
  try{wanted=localStorage.getItem(ACTIVE_BOOK_KEY)||'';}catch(_){}
  var assignment=list.find(function(x){return String(x.book_id)===String(wanted);})||a.assignment||list[0];

  var loaded=await Promise.all([
    content('content_books?select=id,title,book_title,public_level,internal_level_id&id=eq.'+encodeURIComponent(assignment.book_id)+'&status=in.(review,published)'),
    content('content_units?select=id,unit_number,title,metadata&book_id=eq.'+encodeURIComponent(assignment.book_id)+'&status=in.(review,published)&order=unit_number.asc')
  ]);

  var meta=arr(loaded[0])[0]||{};
  var unit=resolveUnit(arr(loaded[1]),assignment);
  if(!unit)throw new Error('No unit is available for this book.');

  var book=Object.assign({},assignment,{
    book_id:assignment.book_id,
    book_title:txt(assignment.book_title||meta.book_title||meta.title||'Vocabulary'),
    public_level:Number(meta.public_level)||null,
    internal_level_id:Number(meta.internal_level_id)||null
  });

  return{book:book,unit:unit};
}

async function loadSourceVocabulary(unitId){
  var occ=await content(
    'source_content_occurrences?select=id,lexical_entry_id,source_text&unit_id=eq.'+
    encodeURIComponent(unitId)+
    '&occurrence_type=eq.lexical_entry&status=in.(review,published)'
  );
  var ids=unique(occ.map(function(o){return o.lexical_entry_id;}));
  if(!ids.length)return[];

  var rows=await content(
    'lexical_entries?select=id,canonical_text,translation_ko,emoji&id=in.'+
    encodeURIComponent('('+ids.join(',')+')')+
    '&status=in.(review,published)'
  );
  var by={};
  rows.forEach(function(r){by[r.id]=r;});
  return occ.map(function(o){
    var e=by[o.lexical_entry_id];
    if(!e)return null;
    return{
      id:e.id,
      occurrenceId:o.id,
      word:txt(e.canonical_text||o.source_text),
      ko:txt(e.translation_ko),
      emoji:e.emoji||null
    };
  }).filter(function(x){return x&&x.word&&x.ko;});
}

function sourceVocabularyActivities(book,unit,items){
  var out=[];
  var koPool=unique(items.map(function(x){return x.ko;}));
  var enPool=unique(items.map(function(x){return x.word;}));

  items.forEach(function(item){
    var koChoices=shuffle(unique(
      [item.ko].concat(shuffle(koPool.filter(function(x){return x!==item.ko;})).slice(0,3))
    ));
    if(koChoices.length>=2){
      out.push({
        id:'vocab-study-en-ko-'+item.occurrenceId,
        sourceType:'lexical_entry',
        sourceId:item.id,
        skill:'vocabulary',
        usage:['practice'],
        stimulus:{
          type:'text',
          prompt:(item.emoji?item.emoji+'  ':'')+item.word,
          context:'한국어 뜻을 고르세요.'
        },
        response:{type:'multiple_choice',choices:koChoices},
        answer:item.ko,
        metadata:{
          book_id:book.book_id,
          unit_id:unit.id,
          occurrence_id:item.occurrenceId,
          pool_source:'source_content',
          source_label:'Book vocabulary'
        }
      });
    }

    var enChoices=shuffle(unique(
      [item.word].concat(shuffle(enPool.filter(function(x){return x!==item.word;})).slice(0,3))
    ));
    if(enChoices.length>=2){
      out.push({
        id:'vocab-study-ko-en-'+item.occurrenceId,
        sourceType:'lexical_entry',
        sourceId:item.id,
        skill:'vocabulary',
        usage:['practice'],
        stimulus:{
          type:'text',
          prompt:item.ko,
          context:'알맞은 영어 표현을 고르세요.'
        },
        response:{type:'multiple_choice',choices:enChoices},
        answer:item.word,
        metadata:{
          book_id:book.book_id,
          unit_id:unit.id,
          occurrence_id:item.occurrenceId,
          pool_source:'source_content',
          source_label:'Book vocabulary'
        }
      });
    }
  });

  return out;
}

async function loadVocabularyItems(book,unit){
  var authoredPromise=global.WillenaStudyQuestionBank
    ?global.WillenaStudyQuestionBank.loadUnit(null,{
      bookId:book.book_id,
      unitId:unit.id,
      bookTitle:book.book_title,
      unitNumber:Number(unit.unit_number)
    }).catch(function(e){
      console.warn('[Vocab Study] authored bank unavailable',e);
      return[];
    })
    :Promise.resolve([]);

  var sourcePromise=loadSourceVocabulary(unit.id).catch(function(e){
    console.warn('[Vocab Study] source vocabulary unavailable',e);
    return[];
  });

  var both=await Promise.all([authoredPromise,sourcePromise]);
  var authored=arr(both[0]).filter(function(a){return a&&a.skill==='vocabulary';});
  var generated=sourceVocabularyActivities(book,unit,arr(both[1]));
  var seen={};

  return authored.concat(generated).filter(function(item){
    var key=txt(item&&item.id);
    if(!key||seen[key])return false;
    seen[key]=true;
    return true;
  });
}

function renderHome(){
  if(!state.book||!state.unit)return;
  if(bookTitleEl)bookTitleEl.textContent=state.book.book_title;
  if(unitTitleEl)unitTitleEl.textContent='Unit '+state.unit.unit_number+(state.unit.title?' · '+state.unit.title:'');
  if(itemCountEl)itemCountEl.textContent=state.items.length+'개의 단어 문제가 준비되어 있어요.';
  if(startBtn){
    startBtn.disabled=!state.items.length;
    startBtn.textContent='시작';
  }
  setStatus(state.items.length?'준비 완료':'이 단원에는 사용할 수 있는 단어 문제가 없어요.');
}

function ensureEngine(){
  if(state.engine)return state.engine;
  if(!global.WillenaActivityEngine)throw new Error('Shared activity engine is not ready.');
  state.engine=new global.WillenaActivityEngine(root,{
    onAnswer:function(){
      state.answered=true;
      if(nextBtn){
        nextBtn.hidden=false;
        nextBtn.textContent=state.index>=state.sessionItems.length-1?'완료':'다음';
      }
    }
  });
  return state.engine;
}

function showCurrent(){
  var item=state.sessionItems[state.index];
  if(!item)return finishSession();
  state.answered=false;
  if(nextBtn)nextBtn.hidden=true;
  if(progressEl)progressEl.textContent=(state.index+1)+' / '+state.sessionItems.length;
  ensureEngine().setActivity(item);
  if(sessionEl)sessionEl.scrollTop=0;
  try{window.scrollTo({top:0,behavior:'auto'});}catch(_){}
}

function startSession(){
  if(!state.items.length)return;
  state.sessionItems=shuffle(state.items).slice(0,Math.min(SESSION_SIZE,state.items.length));
  state.index=0;
  state.answered=false;
  if(titleEl)titleEl.textContent=state.book.book_title+' · Unit '+state.unit.unit_number;
  if(homeEl)homeEl.hidden=true;
  if(sessionEl)sessionEl.hidden=false;
  document.body.classList.add('study-v2-practice-mode');
  showCurrent();
}

function next(){
  if(!state.answered)return;
  if(state.index>=state.sessionItems.length-1){
    finishSession();
    return;
  }
  state.index++;
  showCurrent();
}

function finishSession(){
  if(root){
    root.innerHTML='<div class="smart-finish"><h2>잘했어요!</h2><p>'+state.sessionItems.length+'문제를 모두 끝냈어요.</p></div>';
  }
  if(progressEl)progressEl.textContent=state.sessionItems.length+' / '+state.sessionItems.length;
  if(nextBtn){
    nextBtn.hidden=false;
    nextBtn.textContent='돌아가기';
    nextBtn.onclick=closeSession;
  }
}

function closeSession(){
  document.body.classList.remove('study-v2-practice-mode');
  if(sessionEl)sessionEl.hidden=true;
  if(homeEl)homeEl.hidden=false;
  if(root)root.innerHTML='';
  if(nextBtn){
    nextBtn.hidden=true;
    nextBtn.onclick=null;
  }
  state.sessionItems=[];
  state.index=0;
  state.answered=false;
  try{window.scrollTo({top:0,behavior:'auto'});}catch(_){}
}

async function boot(){
  try{
    if(global.WillenaVocabStudyAuthReady){
      var ok=await global.WillenaVocabStudyAuthReady;
      if(!ok)return;
    }

    if(typeof global.WillenaActivityEngine!=='function'||!global.WillenaActivitySchema||!global.WillenaActivityScoring||!global.WillenaStudyQuestionBank){
      throw new Error('Shared Study components failed to load.');
    }

    var resolved=await resolveBookAndUnit();
    state.book=resolved.book;
    state.unit=resolved.unit;
    state.items=await loadVocabularyItems(state.book,state.unit);

    renderHome();

    if(startBtn)startBtn.addEventListener('click',startSession);
    if(closeBtn)closeBtn.addEventListener('click',closeSession);
    if(nextBtn)nextBtn.addEventListener('click',next);

    global.WillenaVocabStudy={
      version:'p2-vocab-session-20260923',
      getState:function(){return state;},
      start:startSession,
      close:closeSession
    };

    try{
      global.dispatchEvent(new CustomEvent('willena:vocab-study-ready',{
        detail:{
          version:'p2-vocab-session-20260923',
          bookId:state.book.book_id,
          unitId:state.unit.id,
          itemCount:state.items.length
        }
      }));
    }catch(_){}
  }catch(error){
    console.error('[Vocab Study] boot',error);
    setStatus(error&&error.message?error.message:'불러오지 못했습니다. 새로고침해 주세요.');
    if(bookTitleEl)bookTitleEl.textContent='Could not load vocabulary';
    if(unitTitleEl)unitTitleEl.textContent='Please try again.';
    if(startBtn)startBtn.disabled=true;
  }
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',boot,{once:true});
}else{
  boot();
}
})(window);
