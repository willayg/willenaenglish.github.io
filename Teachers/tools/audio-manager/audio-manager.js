(function(){
'use strict';
var CONTENT_ROOT='https://gxwfsqxyuufqtitspfqg.supabase.co/rest/v1/';
var CONTENT_KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
var API_ORIGIN='https://api.willenaenglish.com';
var HISTORY_KEY='willena_audio_manager_runs_v1';
var state={books:[],series:{},book:null,units:[],tasks:[],scanning:false,generating:false,uploaded:0,failed:0};
var $=function(id){return document.getElementById(id);};
var auth=$('auth'),authMsg=$('authMsg'),bookSelect=$('bookSelect'),unitFilter=$('unitFilter'),tbody=$('tbody'),emptyState=$('emptyState');
var totalCount=$('totalCount'),existingCount=$('existingCount'),missingCount=$('missingCount'),uploadedCount=$('uploadedCount'),failedCount=$('failedCount');
var progressLabel=$('progressLabel'),progressNumbers=$('progressNumbers'),progressBar=$('progressBar');

function text(v){return String(v==null?'':v).trim();}
function esc(v){return text(v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function uniq(values){var out=[],seen={};(values||[]).forEach(function(v){v=text(v);if(v&&!seen[v]){seen[v]=1;out.push(v);}});return out;}
function chunks(list,size){var out=[];for(var i=0;i<list.length;i+=size)out.push(list.slice(i,i+size));return out;}
function normalizeKey(v){
  return text(v).replace(/\.mp3$/i,'').toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_\-]/g,'');
}
function looksSentence(s){s=text(s);return !!s&&(/[.?!]$/.test(s)||/^(what|where|when|who|why|how|do|does|did|is|are|was|were|can|could|will|would|should|have|has|had|i|you|he|she|it|we|they)\b/i.test(s));}
function playablePattern(s){s=text(s);return looksSentence(s)&&!(/[+{}]|→/.test(s));}
function deterministicWordPrompt(word){
  var templates=['This one is {w}.','The word is {w}.','{w} is the word.','The word you want is {w}.',"Now, let's do {w}.",'How about {w}?','Do you know {w}?','This word is {w}.'];
  var h=2166136261>>>0;for(var i=0;i<word.length;i++){h^=word.charCodeAt(i);h=Math.imul(h,16777619);}return templates[(h>>>0)%templates.length].replace('{w}',word);
}
function toast(message,bad){
  var el=$('toast');el.textContent=message;el.style.background=bad?'#912018':'#101828';el.style.display='block';clearTimeout(el._t);el._t=setTimeout(function(){el.style.display='none';},3200);
}
function apiFetch(path,opts){
  if(window.WillenaAPI&&typeof window.WillenaAPI.fetch==='function')return window.WillenaAPI.fetch(path,opts);
  return fetch(path,opts);
}
async function verify(){
  try{
    var whoRes=await apiFetch('/.netlify/functions/supabase_auth?action=whoami&_='+Date.now());
    var who=await whoRes.json().catch(function(){return{};});
    if(!who||!who.success||!who.user_id){location.href='/Teachers/login.html?redirect='+encodeURIComponent(location.pathname+location.search);return false;}
    try{localStorage.setItem('userId',who.user_id);}catch(_){}
    var pr=await apiFetch('/.netlify/functions/supabase_auth?action=get_profile&user_id='+encodeURIComponent(who.user_id)+'&_='+Date.now());
    var profile=await pr.json().catch(function(){return{};});
    var role=text(profile.role).toLowerCase();
    if(!profile.success||profile.approved!==true||['teacher','admin'].indexOf(role)<0){location.href='/Teachers/profile.html';return false;}
    auth.hidden=true;$('connection').textContent='● Connected';return true;
  }catch(e){
    authMsg.textContent='Could not verify this account.';
    setTimeout(function(){location.href='/Teachers/login.html?redirect='+encodeURIComponent(location.pathname+location.search);},1000);
    return false;
  }
}
async function rest(table,params,paged){
  var all=[],offset=0,pageSize=1000;
  do{
    var u=new URL(CONTENT_ROOT+table);
    Object.keys(params||{}).forEach(function(k){if(params[k]!=null&&params[k]!=='')u.searchParams.set(k,params[k]);});
    if(paged!==false){u.searchParams.set('limit',pageSize);u.searchParams.set('offset',offset);}
    var r=await fetch(u.toString(),{headers:{apikey:CONTENT_KEY,Authorization:'Bearer '+CONTENT_KEY},cache:'no-store'});
    if(!r.ok)throw new Error('Content DB '+r.status+' ('+table+')');
    var rows=await r.json();if(!Array.isArray(rows))rows=[];
    all=all.concat(rows);
    if(paged===false||rows.length<pageSize)break;
    offset+=pageSize;if(offset>100000)throw new Error('Pagination safety limit');
  }while(true);
  return all;
}
async function fetchByIds(table,select,ids){
  ids=uniq(ids);if(!ids.length)return[];
  var out=[];for(var group of chunks(ids,80)){
    var rows=await rest(table,{select:select,id:'in.('+group.join(',')+')'},false);out=out.concat(rows);
  }return out;
}
async function fetchDialogueTurns(dialogueIds){
  dialogueIds=uniq(dialogueIds);if(!dialogueIds.length)return[];
  var out=[];for(var group of chunks(dialogueIds,80)){
    var rows=await rest('source_dialogue_turns',{select:'id,dialogue_id,turn_number,speaker_label,source_text,sentence_id,metadata',dialogue_id:'in.('+group.join(',')+')',order:'dialogue_id.asc,turn_number.asc'},true);out=out.concat(rows);
  }return out;
}
function byId(rows){var m={};(rows||[]).forEach(function(r){if(r&&r.id)m[String(r.id)]=r;});return m;}
function unitLabel(id){var u=state.units.find(function(x){return String(x.id)===String(id);});return u?'Unit '+u.unit_number+(u.title?' · '+u.title:''):'—';}
function setProgress(done,total,label){
  var pct=total?Math.round(done/total*100):0;progressBar.style.width=pct+'%';progressNumbers.textContent=total?(done+' / '+total):'';if(label)progressLabel.textContent=label;
}
async function loadBooks(){
  var both=await Promise.all([
    rest('content_series',{select:'id,name,source_key',order:'name.asc'},true),
    rest('content_books',{select:'id,series_id,title,book_number,source_key,status,internal_level_id,public_level',status:'in.(review,published)',order:'title.asc'},true)
  ]);
  state.series=byId(both[0]);state.books=both[1];
  state.books.sort(function(a,b){
    var sa=text((state.series[a.series_id]||{}).name),sb=text((state.series[b.series_id]||{}).name);
    return sa.localeCompare(sb)||Number(a.book_number||0)-Number(b.book_number||0)||text(a.title).localeCompare(text(b.title));
  });
  bookSelect.innerHTML='<option value="">Choose a book…</option>'+state.books.map(function(b){
    var s=state.series[b.series_id]||{};return '<option value="'+esc(b.id)+'">'+esc((s.name?s.name+' · ':'')+b.title)+'</option>';
  }).join('');
}
function addTask(map,raw){
  var key=text(raw.key||raw.spoken);var norm=normalizeKey(key);var spoken=text(raw.spoken);
  if(!norm||!spoken)return;
  var t=map[norm];
  if(!t){
    t=map[norm]={key:key,norm:norm,spoken:spoken,type:raw.type||'sentence',unitIds:[],tracks:[],activities:[],sources:[],state:'unchecked',url:'',selected:true,error:''};
  }
  t.unitIds=uniq(t.unitIds.concat(raw.unitId?[raw.unitId]:[]));
  t.tracks=uniq(t.tracks.concat(raw.track!=null&&raw.track!==''?[String(raw.track)]:[]));
  t.activities=uniq(t.activities.concat(raw.activity?[raw.activity]:[]));
  t.sources=uniq(t.sources.concat(raw.source?[raw.source]:[]));
  if(t.type==='sentence'&&raw.type==='listening')t.type='listening';
  if(t.type==='sentence'&&raw.type==='dialogue')t.type='dialogue';
}
async function loadManifest(bookId){
  state.book=state.books.find(function(b){return b.id===bookId;})||null;state.tasks=[];state.uploaded=0;state.failed=0;
  renderSummary();renderRows();$('scanBtn').disabled=true;$('generateBtn').disabled=true;
  if(!state.book)return;
  progressBar.style.width='0%';progressLabel.textContent='Reading '+state.book.title+' from the book database…';progressNumbers.textContent='';
  try{
    var base=await Promise.all([
      rest('content_units',{select:'id,book_id,unit_number,title,status,source_key',book_id:'eq.'+bookId,status:'in.(review,published)',order:'unit_number.asc'},true),
      rest('source_content_occurrences',{select:'id,unit_id,track_number,activity_label,occurrence_type,source_text,lexical_entry_id,sentence_id,passage_id,skill,status,metadata',book_id:'eq.'+bookId,status:'in.(review,published)',order:'unit_id.asc,page_number.asc.nullslast,track_number.asc.nullslast'},true),
      rest('assessment_items',{select:'id,unit_id,item_type,prompt_text,metadata,status',book_id:'eq.'+bookId,status:'in.(review,published)'},true),
      rest('source_dialogues',{select:'id,unit_id,title,track_number,activity_label,status,metadata',book_id:'eq.'+bookId,status:'in.(review,published)'},true)
    ]);
    state.units=base[0];var occ=base[1],assess=base[2],dialogues=base[3];
    unitFilter.innerHTML='<option value="">All units</option>'+state.units.map(function(u){return '<option value="'+esc(u.id)+'">'+esc('Unit '+u.unit_number+(u.title?' · '+u.title:''))+'</option>';}).join('');
    var lexicalIds=uniq(occ.map(function(o){return o.lexical_entry_id;}));
    var sentenceIds=uniq(occ.map(function(o){return o.sentence_id;}));
    var passageIds=uniq(occ.map(function(o){return o.passage_id;}));
    var details=await Promise.all([
      fetchByIds('lexical_entries','id,canonical_text,source_key,status',lexicalIds),
      fetchByIds('sentences','id,text,canonical_text,audio_key,source_key,status',sentenceIds),
      fetchByIds('passages','id,title,body,audio_key,source_key,status',passageIds),
      fetchDialogueTurns(dialogues.map(function(d){return d.id;}))
    ]);
    var lex=byId(details[0]),sent=byId(details[1]),pass=byId(details[2]),dialogueMap=byId(dialogues),map={};

    occ.forEach(function(o){
      var common={unitId:o.unit_id,track:o.track_number,activity:o.activity_label,source:'book content'};
      if(o.occurrence_type==='lexical_entry'){
        var l=lex[String(o.lexical_entry_id)]||{};var word=text(l.canonical_text||o.source_text);
        if(word)addTask(map,Object.assign({},common,{key:word,spoken:deterministicWordPrompt(word),type:'vocabulary'}));
      }else if(o.occurrence_type==='sentence'){
        var s=sent[String(o.sentence_id)]||{};var sentence=text(s.canonical_text||s.text||o.source_text);var key=text(s.audio_key)||sentence;
        if(sentence)addTask(map,Object.assign({},common,{key:key,spoken:sentence,type:o.skill==='listening'?'listening':'sentence'}));
      }else if(o.occurrence_type==='passage'){
        var p=pass[String(o.passage_id)]||{};var body=text(p.body||o.source_text),pkey=text(p.audio_key);
        if(body&&pkey)addTask(map,Object.assign({},common,{key:pkey,spoken:body,type:'passage'}));
      }else if(o.occurrence_type==='pattern'&&playablePattern(o.source_text)){
        addTask(map,Object.assign({},common,{key:o.source_text,spoken:o.source_text,type:'sentence'}));
      }
    });

    details[3].forEach(function(turn){
      var d=dialogueMap[String(turn.dialogue_id)]||{},sentence=text(turn.source_text);
      if(!sentence)return;
      addTask(map,{key:sentence,spoken:sentence,type:'dialogue',unitId:d.unit_id,track:d.track_number,activity:d.activity_label||d.title||'Dialogue',source:'dialogue turn'});
    });

    assess.forEach(function(row){
      if(text(row.item_type)!=='listening')return;
      var m=row.metadata||{},transcript=text(m.transcript||m.audio_text||m.tts_text);
      if(!transcript)return;
      var key=text(m.audio_key||m.audioKey||m.tts_key||m.ttsKey)||transcript;
      addTask(map,{key:key,spoken:transcript,type:'listening',unitId:row.unit_id,track:m.track_number,activity:text(row.prompt_text)||'Listening assessment',source:'assessment'});
    });

    state.tasks=Object.keys(map).map(function(k){return map[k];}).sort(function(a,b){
      var ua=state.units.findIndex(function(u){return a.unitIds.indexOf(u.id)>=0;}),ub=state.units.findIndex(function(u){return b.unitIds.indexOf(u.id)>=0;});
      return ua-ub||a.type.localeCompare(b.type)||a.norm.localeCompare(b.norm);
    });
    renderSummary();renderRows();$('scanBtn').disabled=!state.tasks.length;
    if(!state.tasks.length){progressLabel.textContent='No playable audio content found for this book.';return;}
    await scanR2();
  }catch(e){
    console.error(e);progressLabel.textContent='Could not build audio manifest.';toast(e.message,true);
  }
}
async function lookupExisting(tasks,onProgress){
  var results={};var groups=chunks(tasks,100),done=0;
  for(var group of groups){
    var words=group.map(function(t){return t.key;});
    var r=await apiFetch('/.netlify/functions/get_audio_urls',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',cache:'no-store',body:JSON.stringify({words:words})});
    if(!r.ok)throw new Error('R2 lookup failed ('+r.status+')');
    var d=await r.json();Object.keys(d.results||{}).forEach(function(k){results[k]=d.results[k];});
    done+=group.length;if(onProgress)onProgress(done,tasks.length);
  }
  return results;
}
async function directExists(taskOrKey){
  var norm=typeof taskOrKey==='string'?normalizeKey(taskOrKey):taskOrKey.norm;
  if(!norm)return{exists:false,url:''};
  var url=API_ORIGIN+'/audio/'+encodeURIComponent(norm+'.mp3')+'?_='+Date.now();
  try{
    var r=await fetch(url,{method:'HEAD',credentials:'include',cache:'no-store'});
    return{exists:r.ok,url:r.ok?url.replace(/[?].*$/,''):''};
  }catch(_){return{exists:false,url:''};}
}
async function scanR2(){
  if(state.scanning||!state.tasks.length)return;state.scanning=true;$('scanBtn').disabled=true;$('generateBtn').disabled=true;
  state.tasks.forEach(function(t){if(t.state!=='uploaded')t.state='checking';});
  renderRows();
  try{
    var results=await lookupExisting(state.tasks,function(done,total){setProgress(done,total,'Checking R2 for existing MP3 files…');});
    state.tasks.forEach(function(t){
      if(t.state==='uploaded')return;
      var info=results[t.key];
      if(info&&info.exists&&info.url){t.state='existing';t.url=info.url;t.selected=false;}
      else{t.state='missing';t.url='';t.selected=true;}
    });
    setProgress(state.tasks.length,state.tasks.length,'R2 scan complete. Only missing files are selected.');
  }catch(e){toast(e.message,true);progressLabel.textContent='R2 scan failed.';}
  finally{state.scanning=false;$('scanBtn').disabled=false;syncGenerateButton();renderSummary();renderRows();}
}
function syncGenerateButton(){
  $('generateBtn').disabled=state.generating||!state.tasks.some(function(t){return t.selected&&t.state==='missing';});
}
function currentTasks(){
  var q=text($('rowSearch').value).toLowerCase(),type=$('typeFilter').value,st=$('stateFilter').value,unit=unitFilter.value;
  return state.tasks.filter(function(t){
    if(type&&t.type!==type)return false;if(st&&t.state!==st)return false;if(unit&&t.unitIds.indexOf(unit)<0)return false;
    if(q){var hay=[t.spoken,t.key,t.norm,t.tracks.join(' '),t.activities.join(' ')].join(' ').toLowerCase();if(hay.indexOf(q)<0)return false;}
    return true;
  });
}
function renderRows(){
  if(!state.tasks.length){tbody.innerHTML='';emptyState.style.display='block';return;}
  emptyState.style.display='none';
  var rows=currentTasks();
  tbody.innerHTML=rows.map(function(t){
    var units=t.unitIds.map(unitLabel).join('<br>')||'—',tracks=t.tracks.length?'Track '+t.tracks.join(', '):'No track';
    var statusLabel={unchecked:'Not checked',checking:'Checking…',existing:'Existing',missing:'Missing',running:'Creating…',uploaded:'Uploaded',failed:'Failed'}[t.state]||t.state;
    var stateClass=t.state==='checking'?'running':t.state;
    return '<tr>'+
      '<td><input class="row-check" type="checkbox" data-key="'+esc(t.norm)+'" '+(t.selected?'checked':'')+' '+(['missing','failed'].indexOf(t.state)>=0?'':'disabled')+'></td>'+
      '<td class="main">'+esc(t.spoken)+'<div class="sub">'+esc(t.sources.join(' · '))+'</div></td>'+
      '<td><span class="chip">'+esc(t.type)+'</span></td>'+
      '<td>'+units+'<div class="sub">'+esc(tracks)+'</div></td>'+
      '<td>'+esc(t.activities.join(' · ')||'—')+'</td>'+
      '<td><code>'+esc(t.norm)+'.mp3</code></td>'+
      '<td><span class="chip '+esc(stateClass)+'">'+esc(statusLabel)+'</span>'+(t.error?'<div class="sub">'+esc(t.error)+'</div>':'')+'</td>'+
      '<td>'+(t.url?'<button class="play" data-play="'+esc(t.url)+'">▶ Play</button>':'—')+'</td>'+
    '</tr>';
  }).join('');
  tbody.querySelectorAll('.row-check').forEach(function(cb){cb.addEventListener('change',function(){var t=state.tasks.find(function(x){return x.norm===cb.dataset.key;});if(t)t.selected=cb.checked;syncGenerateButton();});});
  tbody.querySelectorAll('[data-play]').forEach(function(b){b.addEventListener('click',function(){playUrl(b.dataset.play,b);});});
}
function renderSummary(){
  totalCount.textContent=state.tasks.length;
  existingCount.textContent=state.tasks.filter(function(t){return t.state==='existing';}).length;
  missingCount.textContent=state.tasks.filter(function(t){return t.state==='missing';}).length;
  uploadedCount.textContent=state.uploaded;
  failedCount.textContent=state.failed;
}
function playUrl(url,button){
  try{if(window.__audioManagerAudio)window.__audioManagerAudio.pause();var a=new Audio(url);window.__audioManagerAudio=a;button.textContent='■ Playing';a.onended=function(){button.textContent='▶ Play';};a.onerror=function(){button.textContent='▶ Play';toast('Could not play that audio file.',true);};a.play();}catch(e){toast(e.message,true);}
}
async function tts(task){
  var voice=text($('voiceId').value);if(voice){try{localStorage.setItem('ttsVoiceId',voice);}catch(_){}}
  var payload={text:task.spoken,model_id:task.type==='vocabulary'?'eleven_v3':'eleven_turbo_v2_5'};
  if(voice)payload.voice_id=voice;
  var r=await apiFetch('/.netlify/functions/eleven_labs_proxy',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',cache:'no-store',body:JSON.stringify(payload)});
  var d=await r.json().catch(function(){return{};});if(!r.ok||!d.audio)throw new Error(d.error||'ElevenLabs failed ('+r.status+')');return d.audio;
}
async function upload(task,audio){
  var r=await apiFetch('/.netlify/functions/upload_audio',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',cache:'no-store',body:JSON.stringify({word:task.key,fileDataBase64:audio})});
  var d=await r.json().catch(function(){return{};});if(!r.ok)throw new Error(d.error||'R2 upload failed ('+r.status+')');return d.url||'';
}
async function processTask(task){
  task.state='running';task.error='';renderRows();
  try{
    var before=await directExists(task);
    if(before.exists){task.state='existing';task.url=before.url;task.selected=false;return{skipped:true};}
    var audio=await tts(task);
    var afterTts=await directExists(task);
    if(afterTts.exists){task.state='existing';task.url=afterTts.url;task.selected=false;return{skipped:true};}
    var url=await upload(task,audio);
    task.state='uploaded';task.url=url||API_ORIGIN+'/audio/'+encodeURIComponent(task.norm+'.mp3');task.selected=false;state.uploaded++;return{uploaded:true};
  }catch(e){
    task.state='failed';task.error=e.message||String(e);task.selected=true;state.failed++;return{failed:true};
  }finally{renderSummary();renderRows();}
}
async function generateMissing(){
  if(state.generating)return;
  var queue=state.tasks.filter(function(t){return t.selected&&(t.state==='missing'||t.state==='failed');});
  if(!queue.length)return;state.generating=true;state.uploaded=0;state.failed=0;$('generateBtn').disabled=true;$('scanBtn').disabled=true;
  var index=0,completed=0,skipped=0,workers=Math.max(1,Math.min(3,Number($('concurrency').value)||2,queue.length));
  setProgress(0,queue.length,'Creating only missing MP3 files…');
  async function worker(){
    while(index<queue.length){
      var task=queue[index++];var result=await processTask(task);if(result&&result.skipped)skipped++;
      completed++;setProgress(completed,queue.length,'Creating missing MP3 files…');
    }
  }
  await Promise.all(Array.from({length:workers},worker));
  state.generating=false;$('scanBtn').disabled=false;syncGenerateButton();
  setProgress(queue.length,queue.length,'Finished: '+state.uploaded+' uploaded, '+skipped+' already existed, '+state.failed+' failed.');
  saveHistory({book:state.book?state.book.title:'',attempted:queue.length,uploaded:state.uploaded,skipped:skipped,failed:state.failed,voice:text($('voiceId').value)||'default',at:new Date().toISOString()});
  renderHistory();renderRows();toast(state.failed?'Finished with '+state.failed+' failure(s).':'Audio update finished.',!!state.failed);
}
function saveHistory(item){
  try{var list=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');if(!Array.isArray(list))list=[];list.unshift(item);localStorage.setItem(HISTORY_KEY,JSON.stringify(list.slice(0,12)));}catch(_){}
}
function renderHistory(){
  var list=[];try{list=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');}catch(_){}
  if(!Array.isArray(list)||!list.length){$('history').innerHTML='<div class="sub">No runs yet.</div>';return;}
  $('history').innerHTML=list.map(function(x){
    var date='';try{date=new Date(x.at).toLocaleString();}catch(_){}
    return '<div class="history-item"><b>'+esc(x.book||'Book audio')+'</b><div>'+esc(date)+'</div><div>'+Number(x.uploaded||0)+' uploaded · '+Number(x.skipped||0)+' skipped · '+Number(x.failed||0)+' failed</div></div>';
  }).join('');
}
async function searchCandidates(q){
  var candidates=[],norm=normalizeKey(q);if(norm)candidates.push({key:q,spoken:q,source:'Exact key'});
  state.tasks.forEach(function(t){if(t.norm.indexOf(norm)>=0||t.spoken.toLowerCase().indexOf(q.toLowerCase())>=0)candidates.push({key:t.key,spoken:t.spoken,source:state.book?state.book.title:'Current book'});});
  var pattern='*'+q.replace(/[%*]/g,'')+'*';
  try{
    var data=await Promise.all([
      rest('lexical_entries',{select:'canonical_text,source_key',canonical_text:'ilike.'+pattern,status:'in.(review,published)',limit:'40'},false),
      rest('sentences',{select:'text,canonical_text,audio_key,source_key',text:'ilike.'+pattern,status:'in.(review,published)',limit:'40'},false),
      rest('passages',{select:'title,audio_key,source_key',audio_key:'ilike.'+pattern,status:'in.(review,published)',limit:'40'},false)
    ]);
    data[0].forEach(function(r){if(r.canonical_text)candidates.push({key:r.canonical_text,spoken:r.canonical_text,source:'Vocabulary DB'});});
    data[1].forEach(function(r){var spoken=text(r.canonical_text||r.text);if(spoken)candidates.push({key:text(r.audio_key)||spoken,spoken:spoken,source:'Sentence DB'});});
    data[2].forEach(function(r){if(r.audio_key)candidates.push({key:r.audio_key,spoken:r.title||r.audio_key,source:'Passage DB'});});
  }catch(e){console.warn('[AudioManager search DB]',e);}
  var map={};candidates.forEach(function(c){var n=normalizeKey(c.key);if(n&&!map[n])map[n]=Object.assign({norm:n},c);});
  return Object.keys(map).map(function(k){return map[k];}).slice(0,120);
}
async function searchR2(){
  var q=text($('r2Search').value);if(!q)return;
  $('searchStatus').textContent='Searching…';$('searchResults').innerHTML='';$('r2SearchBtn').disabled=true;
  try{
    var candidates=await searchCandidates(q),found=[];
    if(candidates.length){
      var pseudo=candidates.map(function(c){return{key:c.key};});
      var results=await lookupExisting(pseudo);
      candidates.forEach(function(c){var info=results[c.key];if(info&&info.exists)found.push(Object.assign({},c,{url:info.url}));});
      if(!found.some(function(x){return x.norm===normalizeKey(q);})){var exact=await directExists(q);if(exact.exists)found.unshift({key:q,norm:normalizeKey(q),spoken:q,source:'Exact R2 key',url:exact.url});}
    }
    $('searchStatus').textContent=found.length+' R2 file'+(found.length===1?'':'s')+' found from '+candidates.length+' candidate key'+(candidates.length===1?'':'s')+'.';
    $('searchResults').innerHTML=found.length?found.map(function(x){return '<div class="result"><div><strong>'+esc(x.norm)+'.mp3</strong><span class="sub">'+esc(x.source)+' · '+esc(x.spoken)+'</span></div><button class="play" data-r2-play="'+esc(x.url)+'">▶ Play</button></div>';}).join(''):'<div class="empty">No matching R2 audio found.</div>';
    $('searchResults').querySelectorAll('[data-r2-play]').forEach(function(b){b.addEventListener('click',function(){playUrl(b.dataset.r2Play,b);});});
  }catch(e){$('searchStatus').textContent='Search failed.';toast(e.message,true);}
  finally{$('r2SearchBtn').disabled=false;}
}
function bind(){
  document.querySelectorAll('.tab').forEach(function(b){b.addEventListener('click',function(){
    document.querySelectorAll('.tab').forEach(function(x){x.classList.toggle('active',x===b);});
    $('generatePanel').hidden=b.dataset.tab!=='generate';$('searchPanel').hidden=b.dataset.tab!=='search';
  });});
  bookSelect.addEventListener('change',function(){loadManifest(bookSelect.value);});
  $('scanBtn').addEventListener('click',scanR2);$('generateBtn').addEventListener('click',generateMissing);
  [$('rowSearch'),$('typeFilter'),$('stateFilter'),unitFilter].forEach(function(el){el.addEventListener(el.tagName==='INPUT'?'input':'change',renderRows);});
  $('selectAll').addEventListener('change',function(){
    var visible=new Set(currentTasks().map(function(t){return t.norm;}));state.tasks.forEach(function(t){if(visible.has(t.norm)&&(t.state==='missing'||t.state==='failed'))t.selected=$('selectAll').checked;});renderRows();syncGenerateButton();
  });
  $('voiceId').value=(function(){try{return localStorage.getItem('ttsVoiceId')||'';}catch(_){return'';}})();
  $('r2SearchBtn').addEventListener('click',searchR2);$('r2Search').addEventListener('keydown',function(e){if(e.key==='Enter')searchR2();});
}
(async function(){
  bind();renderHistory();
  if(!await verify())return;
  try{await loadBooks();progressLabel.textContent='Choose a book to build its audio manifest.';}catch(e){bookSelect.innerHTML='<option>Could not load books</option>';toast(e.message,true);}
})();
})();
