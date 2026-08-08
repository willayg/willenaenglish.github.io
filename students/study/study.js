(function(){
'use strict';
var CONTENT_URL='https://gxwfsqxyuufqtitspfqg.supabase.co';
var CONTENT_KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
var CONTENT_HEADERS={apikey:CONTENT_KEY,Authorization:'Bearer '+CONTENT_KEY};
var AUTH_ENDPOINT='/.netlify/functions/supabase_auth';
var lang='ko',engine=null,activityIndex=0,activities=[],vocab=[],units=[],assignment=null,currentUnit=null,student=null,classInfo=null;
var grid=document.getElementById('skillGrid'),panel=document.getElementById('practicePanel'),root=document.getElementById('activityRoot'),langBtn=document.getElementById('languageBtn'),skillLabel=document.getElementById('practiceSkill'),title=document.getElementById('practiceTitle');

var copy={
 ko:{continue:'어휘 연습 이어하기',browse:'단원 보기',choose:'연습할 영역을 선택하세요',vocabulary:'어휘',next:'다음',back:'뒤로',meaning:'뜻 고르기',recall:'영어 단어 입력하기',chooseKo:'한국어 뜻을 고르세요.',typeEn:'영어 단어를 입력하세요.',loading:'불러오는 중…',coming:'곧 연결 예정',words:'개 단어'},
 en:{continue:'Continue vocabulary',browse:'Browse units',choose:'Choose a skill',vocabulary:'Vocabulary',next:'Next',back:'Back',meaning:'Choose the meaning',recall:'Type the English word',chooseKo:'Choose the Korean meaning.',typeEn:'Type the English word.',loading:'Loading…',coming:'Coming next',words:'words'}
};
function t(k){return copy[lang][k]||k;}
function signin(){location.replace('/students/signin.html?next='+encodeURIComponent('/students/study/'));}
function shuffle(items){return items.slice().sort(function(){return Math.random()-.5;});}
function unique(items){var out=[];items.forEach(function(x){if(x&&out.indexOf(x)<0)out.push(x);});return out;}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
async function authRequest(action,params){
 var query=new URLSearchParams(Object.assign({action:action,_:Date.now()},params||{}));
 var response=await WillenaAPI.fetch(AUTH_ENDPOINT+'?'+query.toString(),{credentials:'include',cache:'no-store'});
 var data=await response.json().catch(function(){return{}});
 return{response:response,data:data};
}
async function refreshSession(){
 var result=await authRequest('refresh');
 if(!result.response.ok||!result.data.success)return false;
 if(result.data.access_token&&window.WillenaAPI&&WillenaAPI.setLocalTokens)WillenaAPI.setLocalTokens(result.data.access_token,result.data.refresh_token);
 return true;
}
async function currentUser(){
 var result=await authRequest('whoami');
 if(result.response.ok&&result.data.success&&(result.data.user_id||result.data.id))return result.data;
 if(!await refreshSession())return null;
 result=await authRequest('whoami');
 return result.response.ok&&result.data.success&&(result.data.user_id||result.data.id)?result.data:null;
}
async function loadStudentAssignment(){
 var response=await WillenaAPI.fetch('/.netlify/functions/student_study_current?_='+Date.now(),{credentials:'include',cache:'no-store'});
 var data=await response.json().catch(function(){return{}});
 if(response.status===401){
  if(await refreshSession()){
   response=await WillenaAPI.fetch('/.netlify/functions/student_study_current?_='+Date.now(),{credentials:'include',cache:'no-store'});
   data=await response.json().catch(function(){return{}});
  }
 }
 if(response.status===401){signin();throw new Error('Sign in required');}
 if(!response.ok||!data.success)throw new Error(data.error||'Could not load your class book.');
 return data;
}
async function contentGet(path){
 var response=await fetch(CONTENT_URL+'/rest/v1/'+path,{headers:CONTENT_HEADERS,cache:'no-store'});
 if(!response.ok)throw new Error('Content DB request failed ('+response.status+').');
 return response.json();
}
function resolveUnit(rows,unitHint){
 if(!rows.length)return null;
 var hint=String(unitHint||'').trim().toLowerCase();
 if(hint){
  var number=(hint.match(/\d+/)||[])[0];
  var matched=rows.find(function(u){return String(u.unit_number)===number||String(u.title||'').trim().toLowerCase()===hint;});
  if(matched)return matched;
 }
 return rows[0];
}
async function loadUnits(bookId){
 return contentGet('content_units?select=id,unit_number,title,source_key&book_id=eq.'+encodeURIComponent(bookId)+'&status=eq.published&order=unit_number.asc');
}
async function loadVocabulary(unitId){
 var occurrences=await contentGet('source_content_occurrences?select=id,lexical_entry_id,source_text&page_number=not.is.null&unit_id=eq.'+encodeURIComponent(unitId)+'&occurrence_type=eq.lexical_entry&status=eq.published&order=page_number.asc');
 if(!occurrences.length){
  occurrences=await contentGet('source_content_occurrences?select=id,lexical_entry_id,source_text&unit_id=eq.'+encodeURIComponent(unitId)+'&occurrence_type=eq.lexical_entry&status=eq.published');
 }
 var ids=unique(occurrences.map(function(o){return o.lexical_entry_id;}).filter(Boolean));
 if(!ids.length)return[];
 var inList='('+ids.join(',')+')';
 var entries=await contentGet('lexical_entries?select=id,canonical_text,translation_ko,emoji,status&id=in.'+encodeURIComponent(inList)+'&status=eq.published');
 var byId={};entries.forEach(function(e){byId[e.id]=e;});
 return occurrences.map(function(o){var e=byId[o.lexical_entry_id];if(!e)return null;return{id:e.id,occurrenceId:o.id,word:String(e.canonical_text||o.source_text||'').trim(),ko:String(e.translation_ko||'').trim(),emoji:e.emoji||null};}).filter(function(x){return x&&x.word&&x.ko;});
}
function distractorsFor(item){
 var others=shuffle(unique(vocab.filter(function(v){return v.id!==item.id;}).map(function(v){return v.ko;}))).slice(0,3);
 return shuffle(unique([item.ko].concat(others))).slice(0,4);
}
function buildActivities(){
 activities=[];
 shuffle(vocab).forEach(function(item){
  var choices=distractorsFor(item);
  if(choices.length===4){
   activities.push({title:t('meaning'),activity:{id:'vocab-meaning-'+item.occurrenceId,sourceType:'lexical_entry',sourceId:item.id,skill:'vocabulary',usage:['practice'],stimulus:{type:'text',prompt:(item.emoji?item.emoji+'  ':'')+item.word,context:t('chooseKo')},response:{type:'multiple_choice',choices:choices},answer:item.ko,metadata:{unit_id:currentUnit.id,book_id:assignment.book_id,occurrence_id:item.occurrenceId}}});
  }
  activities.push({title:t('recall'),activity:{id:'vocab-recall-'+item.occurrenceId,sourceType:'lexical_entry',sourceId:item.id,skill:'vocabulary',usage:['practice'],stimulus:{type:'text',prompt:(item.emoji?item.emoji+'  ':'')+item.ko,context:t('typeEn')},response:{type:'typed_answer'},answer:item.word,metadata:{unit_id:currentUnit.id,book_id:assignment.book_id,occurrence_id:item.occurrenceId}}});
 });
 activityIndex=0;
}
function drawSkills(){
 var rows=[
  {id:'vocabulary',icon:'Aa',label:t('vocabulary'),desc:vocab.length?vocab.length+' '+t('words'):t('loading'),enabled:vocab.length>0},
  {id:'spelling',icon:'ABC',label:lang==='ko'?'철자':'Spelling',desc:t('coming')},
  {id:'grammar',icon:'✓',label:lang==='ko'?'문법':'Grammar',desc:t('coming')},
  {id:'sentence',icon:'↔',label:lang==='ko'?'문장 만들기':'Sentence Building',desc:t('coming')},
  {id:'listening',icon:'♪',label:lang==='ko'?'듣기':'Listening',desc:t('coming')},
  {id:'reading',icon:'¶',label:lang==='ko'?'읽기':'Reading',desc:t('coming')}
 ];
 grid.innerHTML='';
 rows.forEach(function(skill){var b=document.createElement('button');b.type='button';b.className='skill-card'+(skill.enabled?'':' is-disabled');b.disabled=!skill.enabled;b.innerHTML='<span class="skill-icon">'+skill.icon+'</span><span><strong>'+esc(skill.label)+'</strong><small>'+esc(skill.desc)+'</small></span>';if(skill.enabled)b.addEventListener('click',function(){openPractice(0);});grid.appendChild(b);});
}
function renderPreview(){
 var holder=document.getElementById('vocabPreview');
 if(!vocab.length){holder.innerHTML='<div class="study-loading">No vocabulary found for this unit.</div>';return;}
 holder.innerHTML=vocab.slice(0,8).map(function(v){return '<div class="review-row static"><span class="review-icon">'+esc(v.emoji||'Aa')+'</span><span><strong>'+esc(v.word)+'</strong><small>'+esc(v.ko)+'</small></span></div>';}).join('');
}
function updateHero(){
 document.getElementById('studentGreeting').textContent=(student&&student.name?student.name+' · ':'')+(classInfo&&(classInfo.display_name||classInfo.name)||'Willena');
 document.getElementById('bookTitle').textContent=assignment&&assignment.book_title||'No book assigned';
 document.getElementById('unitTitle').textContent=currentUnit?'Unit '+currentUnit.unit_number+' · '+(currentUnit.title||''):'No unit available';
 document.getElementById('vocabCount').textContent=String(vocab.length);
 document.getElementById('progressTitle').textContent='Vocabulary loaded';
 document.getElementById('progressCopy').textContent=vocab.length+' real words from the Content Database.';
 document.getElementById('unitWordCount').textContent=String(vocab.length);
 document.getElementById('unitNumberStat').textContent=currentUnit?String(currentUnit.unit_number):'—';
 document.getElementById('classStat').textContent=classInfo?(classInfo.display_name||classInfo.name||'—').slice(0,8):'—';
 document.getElementById('connectionTitle').textContent=vocab.length?'Live curriculum connected':'No vocabulary found';
 document.getElementById('contentStatus').textContent=vocab.length?'Real content from '+(assignment.book_title||'assigned book')+' · Unit '+currentUnit.unit_number:'No vocabulary available';
 document.getElementById('continueBtn').disabled=!activities.length;
}
function openPractice(index){
 if(!activities.length)return;
 activityIndex=Number(index)||0;var row=activities[activityIndex%activities.length];skillLabel.textContent=t('vocabulary').toUpperCase();title.textContent=row.title;panel.hidden=false;
 if(!window.WillenaActivityEngine){root.innerHTML='<p>Activity engine failed to load.</p>';return;}
 engine=new WillenaActivityEngine(root,{onAnswer:function(){}});engine.setActivity(row.activity);panel.scrollIntoView({behavior:'smooth',block:'start'});
}
function next(){if(!activities.length)return;activityIndex=(activityIndex+1)%activities.length;openPractice(activityIndex);}
async function selectUnit(unit){
 currentUnit=unit;panel.hidden=true;document.getElementById('contentStatus').textContent='Loading Unit '+unit.unit_number+' vocabulary…';
 vocab=await loadVocabulary(unit.id);buildActivities();updateHero();drawSkills();renderPreview();
}
function browseUnits(){
 var holder=document.getElementById('vocabPreview');
 holder.innerHTML=units.map(function(u){return '<button class="unit-pick" type="button" data-unit-id="'+esc(u.id)+'"><strong>Unit '+esc(u.unit_number)+'</strong><span>'+esc(u.title||'')+'</span></button>';}).join('');
 holder.querySelectorAll('.unit-pick').forEach(function(b){b.addEventListener('click',function(){var unit=units.find(function(u){return u.id===b.dataset.unitId;});if(unit)selectUnit(unit).catch(showError);});});
 holder.scrollIntoView({behavior:'smooth',block:'center'});
}
function showError(error){
 console.error('[WillenaStudy]',error);
 document.getElementById('bookTitle').textContent='Could not load study content';
 document.getElementById('unitTitle').textContent=error&&error.message||'Please try again.';
 document.getElementById('contentStatus').textContent='Connection failed';
 document.getElementById('connectionTitle').textContent='Connection error';
 document.getElementById('progressCopy').textContent=error&&error.message||'Study data could not be loaded.';
}
async function init(){
 try{
  drawSkills();
  var who=await currentUser();
  if(!who){signin();return;}
  var data=await loadStudentAssignment();student=data.student;classInfo=data.class;assignment=data.assignment;
  if(!assignment||!assignment.book_id)throw new Error('No active book is assigned to this student.');
  units=await loadUnits(assignment.book_id);if(!units.length)throw new Error('No published units were found for '+assignment.book_title+'.');
  currentUnit=resolveUnit(units,assignment.current_unit||assignment.starting_unit);
  vocab=await loadVocabulary(currentUnit.id);buildActivities();updateHero();drawSkills();renderPreview();
 }catch(error){showError(error);}
}

document.getElementById('continueBtn').addEventListener('click',function(){openPractice(activityIndex);});
document.getElementById('changeUnitBtn').addEventListener('click',browseUnits);
document.getElementById('closePractice').addEventListener('click',function(){panel.hidden=true;document.querySelector('.section-block').scrollIntoView({behavior:'smooth'});});
document.getElementById('nextActivity').addEventListener('click',next);
langBtn.addEventListener('click',function(){lang=lang==='ko'?'en':'ko';langBtn.textContent=lang==='ko'?'English':'한국어';document.getElementById('continueBtn').textContent=t('continue');document.getElementById('changeUnitBtn').textContent=t('browse');document.querySelector('.section-heading h2').textContent=t('choose');document.getElementById('nextActivity').textContent=t('next');document.getElementById('closePractice').textContent='← '+t('back');buildActivities();drawSkills();if(!panel.hidden)openPractice(activityIndex);});
init();
})();