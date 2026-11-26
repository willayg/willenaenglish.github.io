import {studentIdentity,signedInProfile,assignedBooks,loadUnits,loadSentences} from '/students/sentence-genius/content.js';
const by=id=>document.getElementById(id),hero=document.querySelector('.hero');
const root=by('learningUpgrade');
if(root&&!document.documentElement.classList.contains('leaderboard-only')){
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let starLaunching=false;
let books=[],identity=null,identityPending=null,loading=false,version=0,loaded=false,selectedBook='',lastMap=null;
const api=async path=>{const r=await window.WillenaAPI.fetch(path,{cache:'no-store'});if(!r.ok)throw Error('Request failed');return r.json()};
const profile=async()=>{if(identity)return identity;if(identityPending)return identityPending;identityPending=(async()=>{const who=await studentIdentity();const p=await signedInProfile(who.id);if(p.role!=='student'||!p.approved)throw Error('Student account required');return identity={...who,...p}})().finally(()=>{identityPending=null});return identityPending};
// The backend remains the source of truth for available jellies.
let jellyEnergyPending=null,lastJellyCheck=0,jellyGoldKeys=null;
const jellySeenInMemory=new Map();
const jellySeenKey=id=>'willena:jelly-energy:celebrated:v1:'+id;
function readJellySeen(id){
 try{const raw=localStorage.getItem(jellySeenKey(id));if(raw!==null&&/^\d+$/.test(raw))return Number(raw)}catch{}
 return jellySeenInMemory.get(id);
}
function rememberJellySeen(id,n){
 const value=Math.max(readJellySeen(id)??0,n);
 jellySeenInMemory.set(id,value);
 try{localStorage.setItem(jellySeenKey(id),String(value))}catch{}
}
function jellyIcon(face=0){
 const eyes=face===1?'<path d="M13 28q4-5 8 0" fill="none" stroke="#8e3565" stroke-width="2.5" stroke-linecap="round"/><circle cx="31" cy="28" r="2.5" fill="#8e3565"/>':face===2?'<path d="M13 28q4-5 8 0m6 0q4-5 8 0m-15 5q4 4 8 0" fill="none" stroke="#8e3565" stroke-width="2.3" stroke-linecap="round"/>':'<circle cx="17" cy="28" r="2.5" fill="#8e3565"/><circle cx="31" cy="28" r="2.5" fill="#8e3565"/>';
 return '<g><path d="M9 26C5 15 12 5 24 5s19 10 15 21c7 10 1 17-15 17S2 36 9 26Z" fill="#ed76ad" stroke="#d04f94" stroke-width="2.5"/><ellipse cx="17" cy="13" rx="6" ry="3" fill="#fff" opacity=".85"/>'+eyes+'</g>';
}
function renderJellyInventory(count){
 const icons=by('luJellyIcons'),total=by('luJellyCount'),compact=by('luJellyCompact');
 if(!icons||!total||!compact)return;
 icons.innerHTML=Array.from({length:Math.max(1,Math.min(count,3))},(_,i)=>'<svg viewBox="0 0 48 48" aria-hidden="true">'+jellyIcon(i%3)+'</svg>').join('');
 icons.classList.toggle('is-empty',count===0);
 total.textContent=count+'개';total.classList.toggle('is-empty',count===0);
 by('luJellyCompactCount').textContent=count+'개';compact.hidden=false;
 by('luEnergyNote').setAttribute('aria-label','받을 젤리 '+count+'개');
}
function showJellyCelebration(delta,count){
 const modal=by('luJellyCelebration');
 if(!modal||modal.open||typeof modal.showModal!=='function')return false;
 by('luJellyAwardCount').textContent='+'+delta;
 by('luJellyJarCount').textContent='받을 젤리 '+count+'개';
 const positions=[[32,75],[65,75],[99,75],[47,48],[84,48],[110,48]];
 by('luJellyJarContents').innerHTML=positions.slice(0,Math.min(count,positions.length)).map(([x,y],i)=>'<g transform="translate('+x+' '+y+') scale(.72)">'+jellyIcon(i%3)+'</g>').join('');
 const colors=['#ed76ad','#f7bf39','#42c7cf','#f69cc8'];
 by('luJellyConfetti').innerHTML=Array.from({length:24},(_,i)=>{
  const x=5+((i*37+7)%90),y=6+((i*23+11)%86),rotation=(i*53)%180-90;
  return '<i style="left:'+x+'%;top:'+y+'%;background:'+colors[i%colors.length]+';--lu-spin:'+rotation+'deg;animation-delay:'+(i%6)*.06+'s"></i>';
 }).join('');
 try{modal.showModal();return true}catch(e){console.warn('[Jelly celebration]',e);return false}
}
const jellyDialog=by('luJellyCelebration');
if(jellyDialog){
 by('luJellyConfirm')?.addEventListener('click',()=>jellyDialog.close());
 by('luJellyView')?.addEventListener('click',()=>{
  jellyDialog.close();
  by('luEnergyPanel')?.dispatchEvent(new Event('willena:show-jellies'));
  by('luEnergyPanel')?.scrollIntoView({block:'center',behavior:'auto'});
 });
}
function energy(){
 if(jellyEnergyPending)return jellyEnergyPending;
 lastJellyCheck=Date.now();
 jellyEnergyPending=(async()=>{
  try{
   const p=await profile(),summary=await studentRead('jelly-energy-v1',{});
   const row=summary?.students?.find(x=>String(x.student_id)===String(p.id));
   if(!row||!Number.isFinite(row.energy_percent)||![row.earned,row.given,row.owed].every(n=>Number.isSafeInteger(n)&&n>=0))throw Error('Jelly Energy unavailable');
   const value=row.energy_percent;
   by('luEnergyText').textContent=value+'%';
   by('luEnergyBar').setAttribute('aria-valuenow',value);
   by('luEnergyBar').firstElementChild.style.width=value+'%';
   renderJellyInventory(row.owed);
   if(Number(summary.rules_version)>=3&&Array.isArray(row.verified_gold_keys)){
    jellyGoldKeys=new Set(row.verified_gold_keys);
    if(lastMap&&!by('luMap').hidden)render(lastMap.book,lastMap.units,lastMap.wordGold,lastMap.sentenceResults);
   }
   // On first use, already collected jellies are not announced again.
   // Existing unclaimed rewards are announced once, as are later increases.
   const seen=readJellySeen(p.id),baseline=Math.max(seen??row.given,row.given);
   const delta=Math.min(row.owed,Math.max(0,row.earned-baseline));
   if(delta>0){
    if(showJellyCelebration(delta,row.owed))rememberJellySeen(p.id,row.earned);
   }else rememberJellySeen(p.id,row.earned);
  }catch(e){console.warn('[Jelly Energy]',e);}
 })().finally(()=>{jellyEnergyPending=null});
 return jellyEnergyPending;
}
document.addEventListener('visibilitychange',()=>{
 if(document.visibilityState==='visible'&&Date.now()-lastJellyCheck>15000)void energy();
});
const apps=[
 {label:'Words',path:'/students/vocab-study/',kind:'word',icon:'word-genius.svg'},
 {label:'Sentences',path:'/students/sentence-genius/',kind:'sentence',icon:'sentence-genius.svg'},
 {label:'Grammar',path:'/students/grammar-books/',kind:'grammar'},
 {label:'Free Talking',path:'/students/free-talking-genius/',kind:'talk',icon:'free-talking-bunny-fox.svg'},
 {label:'Writing',path:'/students/writing-genius/',kind:'writing'},
 {label:'Puzzles',path:'/students/wordsearch/',kind:'puzzles'}
];
const headerIcons=["<img class=\"lu-app-icon\" src=\"/students/assets/icons/word-genius.svg?v=20260927-1\" alt=\"\">","<img class=\"lu-app-icon\" src=\"/students/assets/icons/sentence-genius.svg?v=20261025-sentence-path-1\" alt=\"\">","<svg class=\"lu-app-icon\" viewBox=\"0 0 80 80\" aria-hidden=\"true\"><path d=\"M39 12c-10-8-25-2-25 10-9 5-9 18-1 23-4 11 3 21 14 21 5 6 13 5 13-2V20c0-4-1-6-1-8Z\" fill=\"#e9fbfc\" stroke=\"#28b7c4\" stroke-width=\"4\" stroke-linejoin=\"round\"/><path d=\"M41 12c10-8 25-2 25 10 9 5 9 18 1 23 4 11-3 21-14 21-5 6-13 5-13-2V20c0-4 1-6 1-8Z\" fill=\"#ffe7f3\" stroke=\"#ed61a7\" stroke-width=\"4\" stroke-linejoin=\"round\"/><path d=\"M25 24c9 0 12 6 12 13m-19 6c11-4 18 0 20 10M55 24c-9 0-12 6-12 13m19 6c-11-4-18 0-20 10\" fill=\"none\" stroke=\"#d04f94\" stroke-width=\"3\" stroke-linecap=\"round\"/></svg>","<img class=\"lu-app-icon\" src=\"/students/assets/icons/free-talking-bunny-fox.svg?v=20261108-1\" alt=\"\">","<svg class=\"lu-app-icon\" viewBox=\"0 0 80 80\" aria-hidden=\"true\"><path d=\"M17 12h36l11 11v43a5 5 0 0 1-5 5H17a5 5 0 0 1-5-5V17a5 5 0 0 1 5-5Z\" fill=\"#fff\" stroke=\"#ff67ad\" stroke-width=\"4\" stroke-linejoin=\"round\"/><path d=\"M53 12v12h11M23 34h25M23 45h18\" fill=\"none\" stroke=\"#ff67ad\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"m38 61 22-22 7 7-22 22-10 3Z\" fill=\"#72dce3\" stroke=\"#267f89\" stroke-width=\"2.5\" stroke-linejoin=\"round\"/></svg>","<img class=\"lu-app-icon\" src=\"/students/shared/assets/puzzles.png?v=20260928-4\" alt=\"Puzzles\">"];
const courseKeys={'8e949813-fa91-4adc-a709-905efc980d8b':'buzz6','8543cf9b-a5ea-477e-8479-8a32ebcf98cb':'buzz1','552afb86-40ca-4cfe-8980-956982da1799':'eu2','23e0ff51-d41c-4a28-bf2f-8d51e320b5d6':'buzz3','1a591740-46d2-4375-a22e-fb4b5ec6737d':'buzz4','c437909b-f399-468a-bc31-996147d82fd8':'eu5','89872c50-a590-4879-aa0c-7273aabcaf8c':'eu6'};
const ten='1e3a2112-07be-45e2-a8fc-ce20011e0e57';
async function studentRead(path,body){
 const p=await profile();
 const token=window.WillenaAPI.getLocalAccessToken?.()||p.data?.access_token;
 if(!token)throw Error('No student token');
 const key='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
 const jelly=path==='jelly-energy-v1';
 const r=await fetch('https://fiieuiktlsivwfgyivai.supabase.co/'+(jelly?'functions/v1/':'rest/v1/')+path,{cache:'no-store',headers:{apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json',...(jelly?{'x-catalog-key':contentKey}:{})},...(body?{method:'POST',body:JSON.stringify(body)}:{})});
 if(!r.ok)throw Error('Progress source unavailable');return r.json();
}
const contentKey=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
async function contentRead(path){
 const key=contentKey;
 const r=await fetch('https://gxwfsqxyuufqtitspfqg.supabase.co/rest/v1/'+path,{headers:{apikey:key,Authorization:'Bearer '+key},cache:'no-store'});
 if(!r.ok)throw Error('Content unavailable');return r.json();
}
const safe=p=>p.catch(e=>{console.warn('[learning map]',e);return null});
const pct=(n,d)=>Math.max(0,Math.min(100,Math.round(n*100/d)));
let extra={};
const cache=new Map(),catalogPending=new Map(),readPending=new Map();
let cacheKey='';
const catalogPrefix='willena-learning-catalog-v1:';
const manualReload=performance.getEntriesByType?.('navigation')?.[0]?.type==='reload';
if(manualReload)try{for(let i=sessionStorage.length-1;i>=0;i--){const k=sessionStorage.key(i);if(k?.startsWith(catalogPrefix))sessionStorage.removeItem(k)}}catch{}
function catalogMemo(key,task){if(catalogPending.has(key))return catalogPending.get(key);try{const stored=JSON.parse(sessionStorage.getItem(catalogPrefix+key)||'null');if(stored&&Date.now()-stored.at<86400000)return Promise.resolve(stored.data)}catch{}const p=Promise.resolve().then(task).then(data=>{try{sessionStorage.setItem(catalogPrefix+key,JSON.stringify({at:Date.now(),data}))}catch{}return data}).finally(()=>catalogPending.delete(key));catalogPending.set(key,p);return p}
function shortRead(key,task,force=false){const old=readPending.get(key);if(!force&&old&&Date.now()-old.at<30000)return old.promise;const promise=Promise.resolve().then(task);readPending.set(key,{at:Date.now(),promise});promise.catch(()=>{if(readPending.get(key)?.promise===promise)readPending.delete(key)});return promise}
async function mapPool(tasks,limit=4){let cursor=0;await Promise.all(Array.from({length:Math.min(limit,tasks.length)},async()=>{while(cursor<tasks.length){const task=tasks[cursor++];await task()}}))}
const restore=()=>{try{const raw=JSON.parse(sessionStorage.getItem(cacheKey)||'null');if(!raw||Date.now()-raw.at>900000)return;for(const [k,m] of raw.maps||[])cache.set(k,{...m,gold:new Set(m.gold)});if(books.some(b=>String(b.id)===raw.selected))selectedBook=raw.selected;}catch{}};
function remember(book,units,gold,results){cache.set(String(book.id),{at:Date.now(),book,units,gold,results,extra:{...extra}});try{sessionStorage.setItem(cacheKey,JSON.stringify({at:Date.now(),selected:selectedBook,maps:[...cache].map(([k,m])=>[k,{...m,gold:[...m.gold]}])}));}catch{}}

function cell(label,p,url,state='unknown',tone='cyan',mission=false,launch=null){
 const value=p==null||p<0?null:Math.max(0,Math.min(100,p));
 const text=value===null||value===0?'':value+'%';
 const progress=value===null?0:value;
 const gold=state==='gold';
 const starter=!gold&&progress===0&&Boolean(url);
 const ring='<svg class="lu-ring" viewBox="0 0 64 68" aria-hidden="true"><circle class="lu-ring-depth" cx="32" cy="32" r="30.5"/><circle class="lu-ring-track" cx="32" cy="32" r="27"/>'+
 (progress>0?'<circle class="lu-ring-progress" cx="32" cy="32" r="27" pathLength="100" stroke-dasharray="'+progress+' 100" transform="rotate(-90 32 32)"/>':'')+
 (gold?'<path class="lu-ring-star" d="M32 18l4.2 9 9.8 1.2-7.1 7 1.7 9.8-8.6-4.7-8.6 4.7 1.7-9.8-7.1-7 9.8-1.2z"/>':starter?'<path class="lu-start-star" d="M32 21l3.3 7 7.7 1-5.5 5.4 1.3 7.6-6.8-3.6-6.8 3.6 1.3-7.6-5.5-5.4 7.7-1z"/>':'<text x="32" y="33" dominant-baseline="middle" text-anchor="middle">'+esc(text)+'</text>')+'</svg>';
 const attrs=' class="lu-cell" data-state="'+state+'" data-mission="'+mission+'" aria-label="'+esc((gold?'100% · Completed':value===null?label:value+'%')+(mission?' · Active mission':''))+'"';
 return url?'<a'+attrs+(launch?' data-launch-app="'+esc(launch.app)+'" data-launch-book="'+esc(launch.book)+'" data-launch-unit="'+esc(launch.unit)+'"':'')+' href="'+esc(url)+'">'+ring+'</a>':'<span'+attrs+'>'+ring+'</span>';
}
function render(book,units,wordGold,sentenceResults){
if(starLaunching)return;
lastMap={book,units,wordGold,sentenceResults};
const missions=window.WillenaMissionBasket?.getMapMissions?.()||[];
const names={word:'Word Genius',sentence:'Sentence Genius',grammar:'Grammar Genius Books',talk:'Free Talking Genius',writing:'Writing Genius',puzzles:'Puzzles'};
const q=u=>'?book='+encodeURIComponent(book.id)+'&unit='+encodeURIComponent(u.id);
by('luGrid').innerHTML='<strong>Unit</strong>'+apps.map((a,i)=>'<strong class="lu-col">'+headerIcons[i]+esc(a.label)+'</strong>').join('')+units.map((u,i)=>{
return '<div class="lu-label" title="'+esc(u.title)+'"><strong>'+esc(u.unit_number)+'</strong></div>'+apps.map((app,j)=>{
let p=null, label='Open',state='unknown',url=app.path;
if(app.kind==='word'){if(wordGold.has(String(u.id))){p=100;label='Gold';state='gold';}url+=q(u);}
if(app.kind==='sentence'){p=sentenceResults[i];url+=q(u);label=p===100?'Gold':p===null?'Open':p===-1?'N/A':p===0?'Start':'Continue';state=p===100?'gold':p===null||p===-1?'unknown':'progress';}
if(app.kind==='word'&&p===null){p=extra.word?.[i]??null;}
if(app.kind==='grammar'){p=extra.grammar?.[i]??null;url+='?book='+encodeURIComponent(book.id)+'&unit='+encodeURIComponent(u.unit_number);}
if(app.kind==='talk'){p=extra.talk?.[i]??null;url+=q(u);}
if(app.kind==='writing'){p=extra.writing?.[i]??null;url+=q(u);}
if(app.kind==='puzzles'){url+=q(u);}
const goldApp=app.kind==='talk'?'freeconversation':app.kind;
if(jellyGoldKeys!==null&&app.kind!=='puzzles'){
 if(jellyGoldKeys.has('gold:'+goldApp+':'+book.id+':'+u.id)){p=100;state='gold';label='Gold';}
 else if(p!==null&&p>=0){state=p===0?'idle':'progress';label=p===0?'Start':'Continue';}
}else if(p!==null&&p>=0&&state!=='gold'){state=p===100?'gold':p===0?'idle':'progress';label=p===100?'Done':p===0?'Start':'Continue';}
if(p===-1)return cell('Unavailable',null,null,'unknown');
const mission=missions.some(m=>m.app===names[app.kind]&&m.book===String(book.id)&&(m.unit?m.unit===String(u.id):m.number===String(u.unit_number)));
return cell(label,p,url,state,'cyan',mission,{app:app.kind,book:book.title,unit:app.kind==='puzzles'?'':u.unit_number});
}).join('');
}).join('');
}
function bookTabs(){
by('luBooks').innerHTML=books.map(b=>'<button type="button" data-book="'+esc(b.id)+'" aria-pressed="'+(String(b.id)===selectedBook)+'">'+esc(b.title)+'</button>').join('');
}

async function loadBook(force=false){
const ticket=++version,book=books.find(x=>String(x.id)===selectedBook)||books[0];if(!book)return;
const cached=cache.get(String(book.id));
if(cached){extra=cached.extra;render(book,cached.units,cached.gold,cached.results);if(!force&&!manualReload&&Date.now()-(cached.at||0)<30000){by('luStatus').textContent='';by('luGrid').removeAttribute('aria-busy');by('luGrid').style.opacity='';return}by('luStatus').textContent='Updating…';}else{lastMap=null;extra={};by('luGrid').innerHTML='';by('luStatus').textContent='Loading unit progress…';by('luGrid').setAttribute('aria-busy','true');by('luGrid').style.opacity='.55';}
let pendingExtra={};
try{
const bid=encodeURIComponent(book.id),uid=encodeURIComponent((await profile()).id);
if(ticket!==version)return;
const unitsTask=catalogMemo('units:'+book.id,()=>loadUnits(book.id));
const wordsTask=safe(shortRead(uid+':word-gold',()=>api('/.netlify/functions/progress_summary?section=vocab_motivation'),force));
const masteryTask=safe(window.WillenaStudyProgress.getContentMastery(book.id));
const grammarTask=safe(book.id===ten?window.WillenaMissionBasket.getGrammarBookProgress():courseKeys[book.id]?shortRead(uid+':grammar',()=>studentRead('rpc/get_grammar_coursebook_progress_v1',{}),force):Promise.resolve([]));
const writingTask=safe(studentRead('writing_genius_sentence_sessions?select=unit_id,questions,responses&student_id=eq.'+uid+'&book_id=eq.'+bid+'&assignment_id=is.null&limit=1000'));
const rewardsTask=safe(shortRead(uid+':writing-rewards',()=>studentRead('rpc/wg_sentence_unit_rewards_v1',{}),force));
const questionsTask=safe(catalogMemo('talk-questions:'+book.id,()=>contentRead('free_talking_questions?select=unit_id&book_id=eq.'+bid+'&is_published=eq.true&limit=1000')));
const units=await unitsTask;
if(ticket!==version)return;
const previous=new Map((cached?.units||[]).map((u,i)=>[String(u.id),i]));
const fromCache=(u,key)=>{const i=previous.get(String(u.id));return i==null?null:cached?.extra?.[key]?.[i]??null};
const results=units.map(u=>{const i=previous.get(String(u.id));return i==null?null:cached.results[i]??null});
let gold=new Set(cached?.gold||[]);
pendingExtra={word:units.map(u=>fromCache(u,'word')),talk:units.map(u=>fromCache(u,'talk')),grammar:units.map(u=>fromCache(u,'grammar')),writing:units.map(u=>fromCache(u,'writing'))};
extra={...pendingExtra};render(book,units,gold,results);by('luGrid').style.opacity='';by('luStatus').textContent='Updating progress…';
const targetsTask=units.length?safe(catalogMemo('word-targets:'+book.id+':'+units.map(u=>u.id).join(','),()=>contentRead('unit_vocab_targets?select=unit_id,lexical_entry_id&active=eq.true&unit_id=in.('+units.map(u=>u.id).join(',')+')&limit=10000'))):Promise.resolve([]);
const [words,mastery,grammar,writing,rewards,targets,questions]=await Promise.all([wordsTask,masteryTask,grammarTask,writingTask,rewardsTask,targetsTask,questionsTask]);
if(words)gold=new Set((words.golden_units||[]).map(x=>String(x.unit_id)));
if(ticket!==version)return;
pendingExtra.grammar=units.map(u=>{
 if(book.id!==ten&&!courseKeys[book.id])return -1;
 if(!Array.isArray(grammar))return fromCache(u,'grammar');
 const modes=['choose','check','hunt'],n=Number(u.unit_number),size=book.id===ten?8:5;
 return pct(modes.reduce((sum,mode)=>{const row=grammar.find(r=>Number(r.chapter_number)===n&&r.mode===mode&&(book.id===ten||r.book_key===courseKeys[book.id]));return sum+(book.id===ten&&n>=2?(row?.mastered_question_ids||[]).filter(id=>id.startsWith('gt2-c'+n+'-'+mode+'-')&&id.endsWith('-r2')).length:Math.min(size,Number(row?.best_correct)||0))},0),size*3);
});
pendingExtra.writing=units.map(u=>{
 if(Array.isArray(rewards)&&rewards.some(r=>String(r.book_id)===String(book.id)&&String(r.unit_id)===String(u.id)&&r.golden===true))return 100;
 if(!Array.isArray(writing))return fromCache(u,'writing');
 const rows=writing.filter(r=>String(r.unit_id)===String(u.id));
 return rows.length?Math.max(...rows.map(r=>r.questions?.length?pct((r.responses||[]).slice(0,r.questions.length).filter(x=>x?.feedback?.grade==='correct').length,r.questions.length):0)):null;
});
extra={...pendingExtra};render(book,units,gold,results);
const targetMap=new Map();for(const r of targets||[]){const k=String(r.unit_id);if(!targetMap.has(k))targetMap.set(k,new Set());targetMap.get(k).add(r.lexical_entry_id)}
const questionUnits=new Set((questions||[]).map(r=>String(r.unit_id)));
const passedMap=new Map();for(const x of mastery?.items||[]){if(x.content_type!=='sentence'||Number(x.accuracy)<=0)continue;const k=String(x.unit_id);if(!passedMap.has(k))passedMap.set(k,new Set());passedMap.get(k).add(x.skill+':'+x.content_id)}
const tasks=[];
let paintQueued=false;
function updateMap(){if(paintQueued)return;paintQueued=true;requestAnimationFrame(()=>{paintQueued=false;if(ticket===version){extra={...pendingExtra};render(book,units,gold,results)}})}
units.forEach((u,i)=>{
 const ids=targetMap.get(String(u.id));
 if(ids?.size&&!gold.has(String(u.id)))tasks.push(async()=>{if(ticket!==version)return;const snap=await safe(window.WillenaStudyProgress.getVocabSnapshot(book.id,u.id));if(snap&&snap.vocabulary&&snap.spelling&&snap.speaking)pendingExtra.word[i]=pct((Number(snap.vocabulary.passed_count)||0)+(Number(snap.spelling.test_passed_count)||0)+(Number(snap.speaking.passed_count)||0),ids.size*3);updateMap()});
 if(Array.isArray(questions)&&!questionUnits.has(String(u.id)))pendingExtra.talk[i]=-1;
 else if(Array.isArray(questions))tasks.push(async()=>{if(ticket!==version)return;const data=await safe((async()=>{const t=window.WillenaAPI.getLocalAccessToken?.();if(!t)throw Error('No token');const r=await fetch('/api/free-talking-hybrid-lab',{method:'POST',cache:'no-store',headers:{Authorization:'Bearer '+t,'Content-Type':'application/json'},body:JSON.stringify({action:'progress',book_id:book.id,unit_id:u.id})});if(!r.ok)throw Error('Conversation progress unavailable');return r.json()})());if(data&&typeof data.contributions==='number')pendingExtra.talk[i]=pct(data.contributions,8);updateMap()});
 if(mastery?.success&&Array.isArray(mastery.items))tasks.push(async()=>{if(ticket!==version)return;try{const ids=await catalogMemo('sentence-ids:'+book.id+':'+u.id,async()=>(await loadSentences(book.id,u.id,u)).map(x=>x.id));if(!ids.length)results[i]=-1;else{const passed=passedMap.get(String(u.id))||new Set();const n=ids.reduce((sum,id)=>sum+['sentence_coach','sentence_unscramble','sentence_speaking'].filter(k=>passed.has(k+':'+id)).length,0);results[i]=Math.round(n*100/(ids.length*3))}updateMap()}catch{}});
});
await mapPool(tasks,4);
if(ticket!==version)return;extra=pendingExtra;render(book,units,gold,results);remember(book,units,gold,results);by('luStatus').textContent=units.length?'':'No units available.';
}catch(e){if(ticket===version)by('luStatus').textContent='Could not load progress. Try Refresh.';}finally{if(ticket===version){by('luGrid').removeAttribute('aria-busy');by('luGrid').style.opacity='';}}
}
async function load(){if(loading)return;loading=true;try{const p=await profile();books=await assignedBooks(p.className);if(!cacheKey){cacheKey='willena-learning-map-v4:'+p.id;restore()}if(!books.some(b=>String(b.id)===selectedBook))selectedBook=String(books[0]?.id||'');bookTabs();if(!books.length){by('luStatus').textContent='No assigned books.';return}await loadBook();loaded=true;}catch(e){by('luStatus').textContent='Curriculum unavailable. Try Refresh.';}finally{loading=false}}
function view(map){by('luApps').setAttribute('aria-pressed',String(!map));by('luMapTab').setAttribute('aria-pressed',String(map));hero.hidden=map;by('luMap').hidden=!map;try{localStorage.setItem('willena-staging-dashboard-view',map?'map':'apps')}catch{}if(map&&!loaded)void load()}
by('luApps').onclick=()=>view(false);by('luMapTab').onclick=()=>view(true);by('luBooks').onclick=e=>{const b=e.target.closest('[data-book]');if(!b)return;if(selectedBook===b.dataset.book)return;selectedBook=b.dataset.book;bookTabs();void loadBook()};
window.addEventListener('willena:map-missions',()=>{if(!starLaunching&&lastMap){const {book,units,wordGold,sentenceResults}=lastMap;render(book,units,wordGold,sentenceResults)}});
const launchTitles={word:'Word Genius',sentence:'Sentence Genius',grammar:'Grammar Genius Books',talk:'Free Talking Genius',writing:'Writing Genius',puzzles:'Puzzles'};
let portalTimer=null,launchTimer=null;
function clearMapLaunch(){
 clearTimeout(portalTimer);clearTimeout(launchTimer);
 portalTimer=null;launchTimer=null;starLaunching=false;
 document.querySelectorAll('.lu-star-burst,.lu-neon-portal').forEach(el=>el.remove());
 by('luGrid').classList.remove('lu-star-launching');
 by('luGrid').querySelectorAll('.lu-star-shattered').forEach(el=>{el.classList.remove('lu-star-shattered');const star=el.querySelector('.lu-start-star');if(star)star.style.opacity=''});
}
function showNeonPortal(link,x,y,mainApp=null){
 const appIndex=apps.findIndex(a=>a.kind===link.dataset.launchApp);
 const title=mainApp?.title||launchTitles[link.dataset.launchApp];
 const icon=mainApp?.icon||(appIndex>=0?headerIcons[appIndex]:'');
 if(!title||!icon)return;
 const portal=document.createElement('div');
 portal.className='lu-neon-portal';
 portal.setAttribute('role','status');
 portal.setAttribute('aria-label',title+' loading');
 const w=window.innerWidth,h=window.innerHeight;
 const scale=Math.max(12,Math.hypot(Math.max(x,w-x),Math.max(y,h-y))/24+2);
 portal.style.setProperty('--lu-portal-x',x+'px');
 portal.style.setProperty('--lu-portal-y',y+'px');
 portal.style.setProperty('--lu-portal-scale',String(scale));
 portal.innerHTML='<div class="lu-neon-cover"></div><div class="lu-neon-rings" aria-hidden="true">'+Array.from({length:5},(_,i)=>'<i style="--lu-delay:'+i*65+'ms"></i>').join('')+'</div><div class="lu-neon-intro"><div class="lu-neon-halo" aria-hidden="true"></div><div class="lu-neon-mission"></div><div class="lu-neon-icon" aria-hidden="true">'+icon+'</div><div class="lu-neon-name"></div><div class="lu-neon-book"></div><div class="lu-neon-unit"></div><div class="lu-neon-loading" aria-hidden="true"><i></i></div></div>';
 const mission=portal.querySelector('.lu-neon-mission');
 mission.textContent='미션';mission.hidden=!!mainApp||link.dataset.mission!=='true';
 portal.querySelector('.lu-neon-name').textContent=title.toUpperCase();
 const book=portal.querySelector('.lu-neon-book'),unit=portal.querySelector('.lu-neon-unit');
 book.textContent=mainApp?'':link.dataset.launchBook||'';book.hidden=!!mainApp;
 unit.textContent=mainApp?'':link.dataset.launchUnit?'UNIT '+link.dataset.launchUnit:'WHOLE BOOK';unit.hidden=!!mainApp;
 document.body.appendChild(portal);
}
by('luGrid').addEventListener('click',event=>{
 const link=event.target.closest('a.lu-cell');
 if(!link||event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
 if(window.matchMedia('(prefers-reduced-motion: reduce)').matches||!Element.prototype.animate)return;
 if(!link.dataset.launchApp)return;
 event.preventDefault();
 if(starLaunching)return;
 starLaunching=true;
 const url=link.href,star=link.querySelector('.lu-start-star'),rect=(star||link.querySelector('.lu-ring')||link).getBoundingClientRect();
 const x=rect.left+rect.width/2,y=rect.top+rect.height/2;
 by('luGrid').classList.add('lu-star-launching');
 // Navigation always proceeds, even if an animation or icon fails.
 launchTimer=setTimeout(()=>{try{window.location.assign(url)}catch(error){clearMapLaunch();console.warn('[Learning map launch]',error)}},star?1240:1040);
 try{
  if(star){
 const burst=document.createElement('div');burst.className='lu-star-burst';burst.setAttribute('aria-hidden','true');
 const colors=['#f5c84d','#ffdf78','#28b7c4','#ed76ad','#ffffff'];
 link.classList.add('lu-star-shattered');star.style.opacity='0';
 for(let i=0;i<100;i++){
  const p=document.createElement('span'),angle=i*2.39996323,d=20+Math.random()*Math.min(115,window.innerWidth*.28),size=3+Math.random()*8;
  p.style.cssText='left:'+x+'px;top:'+y+'px;width:'+size+'px;height:'+size+'px;background:'+colors[i%colors.length]+';';
  burst.appendChild(p);
  const dx=Math.cos(angle)*d,dy=Math.sin(angle)*d;
  p.animate([{transform:'translate(-50%,-50%) scale(.5)',opacity:1},{transform:'translate('+dx*.65+'px,'+dy*.65+'px) rotate('+i*13+'deg) scale(1)',opacity:1,offset:.48},{transform:'translate('+dx+'px,'+(dy+20)+'px) rotate('+i*29+'deg) scale(.15)',opacity:0}],{duration:490+Math.random()*210,easing:'cubic-bezier(.16,.7,.4,1)',fill:'forwards'});
 }
 document.body.appendChild(burst);
  }
  portalTimer=setTimeout(()=>{try{showNeonPortal(link,x,y)}catch(error){console.warn('[Learning map portal]',error)}},star?200:0);
 }catch(error){console.warn('[Learning map animation]',error)}
});
// App home cards share the exact same portal; no textbook or unit is
// invented before the student has selected one.
hero?.addEventListener('click',event=>{
 const link=event.target.closest('a.node-link[href]');
 if(!link||event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||link.hasAttribute('download')||(link.target&&link.target!=='_self'))return;
 if(window.matchMedia('(prefers-reduced-motion: reduce)').matches||by('motionToggle')?.checked===false)return;
 const url=new URL(link.href,location.href);
 if(url.origin!==location.origin)return;
 const kind=apps.find(a=>url.pathname===a.path)?.kind;
 const source=link.querySelector('img,svg');
 const title=launchTitles[kind]||link.getAttribute('aria-label')||source?.getAttribute('alt')||'';
 if(!title||!source)return;
 const appIndex=apps.findIndex(a=>a.kind===kind);
 const copy=source.cloneNode(true);
 copy.setAttribute('class','lu-app-icon');copy.removeAttribute('id');copy.setAttribute('aria-hidden','true');
 const icon=appIndex>=0?headerIcons[appIndex]:copy.outerHTML;
 event.preventDefault();
 if(starLaunching)return;
 starLaunching=true;
 const rect=source.getBoundingClientRect(),x=rect.left+rect.width/2,y=rect.top+rect.height/2;
 launchTimer=setTimeout(()=>{try{window.location.assign(url.href)}catch(error){clearMapLaunch();console.warn('[App portal launch]',error)}},1040);
 try{showNeonPortal(link,x,y,{title,icon})}catch(error){console.warn('[App portal]',error)}
});
window.addEventListener('pagehide',clearMapLaunch);
let initial=false;try{initial=localStorage.getItem('willena-staging-dashboard-view')==='map'}catch{}view(initial);void energy();window.addEventListener('pageshow',e=>{if(e.persisted){clearMapLaunch();void energy();if(!by('luMap').hidden)void loadBook(true)}});
}
