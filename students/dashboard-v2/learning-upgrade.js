import {studentIdentity,signedInProfile,assignedBooks,loadUnits,loadSentences} from '/students/sentence-genius/content.js';
const by=id=>document.getElementById(id),hero=document.querySelector('.hero');
const root=by('learningUpgrade');
if(root&&!document.documentElement.classList.contains('leaderboard-only')){
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let starLaunching=false;
let books=[],identity=null,loading=false,version=0,loaded=false,selectedBook='',lastMap=null;
const api=async path=>{const r=await window.WillenaAPI.fetch(path,{cache:'no-store'});if(!r.ok)throw Error('Request failed');return r.json()};
const profile=async()=>{if(identity)return identity;const who=await studentIdentity();const p=await signedInProfile(who.id);if(p.role!=='student'||!p.approved)throw Error('Student account required');return identity={...who,...p}};
// The backend remains the source of truth for available jellies.
let jellyEnergyPending=null,lastJellyCheck=0;
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
// One-time UI-only test for the approved A / Test account.
const jellyPreviewId='5ff64b5e-85dc-4f3b-8438-1ae75084a0f4';
const jellyPreviewKey='willena:jelly-preview:20261126:'+jellyPreviewId;
let jellyPreviewShown=false;
function previewJellyPending(id){
 if(String(id)!==jellyPreviewId||jellyPreviewShown)return false;
 try{return localStorage.getItem(jellyPreviewKey)!=='1'}catch{return true}
}
function markJellyPreview(){
 jellyPreviewShown=true;
 try{localStorage.setItem(jellyPreviewKey,'1')}catch{}
}
function maybeJellyPreview(id,count=0){
 if(!previewJellyPending(id))return;
 if(showJellyCelebration(1,count+1))markJellyPreview();
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
   // On first use, already collected jellies are not announced again.
   // Existing unclaimed rewards are announced once, as are later increases.
   const seen=readJellySeen(p.id),baseline=Math.max(seen??row.given,row.given);
   const delta=Math.min(row.owed,Math.max(0,row.earned-baseline));
   if(delta>0){
    if(showJellyCelebration(delta,row.owed)){
     rememberJellySeen(p.id,row.earned);
     if(previewJellyPending(p.id))markJellyPreview();
    }
   }else{
    rememberJellySeen(p.id,row.earned);
    maybeJellyPreview(p.id,row.owed);
   }
  }catch(e){
   console.warn('[Jelly Energy]',e);
   if(identity)maybeJellyPreview(identity.id);
  }
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
const cache=new Map();
let cacheKey='';
const restore=()=>{try{const raw=JSON.parse(sessionStorage.getItem(cacheKey)||'null');if(!raw||Date.now()-raw.at>900000)return;for(const [k,m] of raw.maps||[])cache.set(k,{...m,gold:new Set(m.gold)});if(books.some(b=>String(b.id)===raw.selected))selectedBook=raw.selected;}catch{}};
function remember(book,units,gold,results){cache.set(String(book.id),{book,units,gold,results,extra:{...extra}});try{sessionStorage.setItem(cacheKey,JSON.stringify({at:Date.now(),selected:selectedBook,maps:[...cache].map(([k,m])=>[k,{...m,gold:[...m.gold]}])}));}catch{}}

function cell(label,p,url,state='unknown',tone='cyan',mission=false){
 const value=p==null||p<0?null:Math.max(0,Math.min(100,p));
 const text=value===null||value===0?'':value+'%';
 const progress=value===null?0:value;
 const gold=state==='gold';
 const starter=!gold&&progress===0&&Boolean(url);
 const ring='<svg class="lu-ring" viewBox="0 0 64 68" aria-hidden="true"><circle class="lu-ring-depth" cx="32" cy="32" r="30.5"/><circle class="lu-ring-track" cx="32" cy="32" r="27"/>'+
 (progress>0?'<circle class="lu-ring-progress" cx="32" cy="32" r="27" pathLength="100" stroke-dasharray="'+progress+' 100" transform="rotate(-90 32 32)"/>':'')+
 (gold?'<path class="lu-ring-star" d="M32 18l4.2 9 9.8 1.2-7.1 7 1.7 9.8-8.6-4.7-8.6 4.7 1.7-9.8-7.1-7 9.8-1.2z"/>':starter?'<path class="lu-start-star" d="M32 21l3.3 7 7.7 1-5.5 5.4 1.3 7.6-6.8-3.6-6.8 3.6 1.3-7.6-5.5-5.4 7.7-1z"/>':'<text x="32" y="33" dominant-baseline="middle" text-anchor="middle">'+esc(text)+'</text>')+'</svg>';
 const attrs=' class="lu-cell" data-state="'+state+'" data-mission="'+mission+'" aria-label="'+esc((gold?'100% · Completed':value===null?label:value+'%')+(mission?' · Active mission':''))+'"';
 return url?'<a'+attrs+' href="'+esc(url)+'">'+ring+'</a>':'<span'+attrs+'>'+ring+'</span>';
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
if(app.kind==='sentence'){p=sentenceResults[i];url+=q(u);label=p===100?'Gold':p===null?'Open':p===-1?'N/A':p===0?'Start':'Continue';state=p===100?'gold':p===null||p===-1?'unknown':'progress';if(p===-1)return cell('Unavailable',null,null,'unknown');}
if(app.kind==='word'&&p===null){p=extra.word?.[i]??null;}
if(app.kind==='grammar'){p=extra.grammar?.[i]??null;url+='?book='+encodeURIComponent(book.id)+'&unit='+encodeURIComponent(u.unit_number);}
if(app.kind==='talk'){p=extra.talk?.[i]??null;url+=q(u);}
if(app.kind==='writing'){p=extra.writing?.[i]??null;url+=q(u);}
if(app.kind==='puzzles'){url+=q(u);}
if(p===-1)return cell('Unavailable',null,null,'unknown');
if(p!==null&&state!=='gold'){state=p===100?'gold':p===0?'idle':'progress';label=p===100?'Done':p===0?'Start':'Continue';}
const mission=missions.some(m=>m.app===names[app.kind]&&m.book===String(book.id)&&(m.unit?m.unit===String(u.id):m.number===String(u.unit_number)));
return cell(label,p,url,state,'cyan',mission);
}).join('');
}).join('');
}
function bookTabs(){
by('luBooks').innerHTML=books.map(b=>'<button type="button" data-book="'+esc(b.id)+'" aria-pressed="'+(String(b.id)===selectedBook)+'">'+esc(b.title)+'</button>').join('');
}

async function loadBook(){
const ticket=++version,book=books.find(x=>String(x.id)===selectedBook)||books[0];if(!book)return;
const cached=cache.get(String(book.id));
if(cached){extra=cached.extra;render(book,cached.units,cached.gold,cached.results);by('luStatus').textContent='Updating…';}else{by('luStatus').textContent='Loading unit progress…';by('luGrid').setAttribute('aria-busy','true');by('luGrid').style.opacity='.55';}
let pendingExtra={};
try{
const [units,words,mastery]=await Promise.all([loadUnits(book.id),api('/.netlify/functions/progress_summary?section=vocab_motivation').catch(()=>null),window.WillenaStudyProgress.getContentMastery(book.id).catch(()=>null)]);
if(ticket!==version)return;
const gold=new Set((words?.golden_units||[]).map(x=>String(x.unit_id)));
const results=units.map((u,i)=>cached?.units[i]?.id===u.id?cached.results[i]:null);
const bid=encodeURIComponent(book.id),uid=encodeURIComponent((await profile()).id);
const [grammar,writing,rewards,targets,questions]=await Promise.all([
 safe(book.id===ten?window.WillenaMissionBasket.getGrammarBookProgress():courseKeys[book.id]?studentRead('rpc/get_grammar_coursebook_progress_v1',{}):Promise.resolve([])),
 safe(studentRead('writing_genius_sentence_sessions?select=unit_id,questions,responses&student_id=eq.'+uid+'&book_id=eq.'+bid+'&assignment_id=is.null&limit=1000')),
 safe(studentRead('rpc/wg_sentence_unit_rewards_v1',{})),
 safe(contentRead('unit_vocab_targets?select=unit_id,lexical_entry_id&active=eq.true&unit_id=in.('+units.map(u=>u.id).join(',')+')&limit=10000')),
 safe(contentRead('free_talking_questions?select=unit_id&book_id=eq.'+bid+'&is_published=eq.true&limit=1000'))
]);
if(ticket!==version)return;
pendingExtra.grammar=units.map(u=>{
 if(book.id!==ten&&!courseKeys[book.id])return -1;
 if(!Array.isArray(grammar))return null;
 const modes=['choose','check','hunt'],n=Number(u.unit_number),size=book.id===ten?8:5;
 return pct(modes.reduce((sum,mode)=>{const row=grammar.find(r=>Number(r.chapter_number)===n&&r.mode===mode&&(book.id===ten||r.book_key===courseKeys[book.id]));return sum+(book.id===ten&&n>=2?(row?.mastered_question_ids||[]).filter(id=>id.startsWith('gt2-c'+n+'-'+mode+'-')&&id.endsWith('-r2')).length:Math.min(size,Number(row?.best_correct)||0))},0),size*3);
});
pendingExtra.writing=units.map(u=>{
 if(Array.isArray(rewards)&&rewards.some(r=>String(r.book_id)===String(book.id)&&String(r.unit_id)===String(u.id)&&r.golden===true))return 100;
 if(!Array.isArray(writing))return null;
 const rows=writing.filter(r=>String(r.unit_id)===String(u.id));
 return rows.length?Math.max(...rows.map(r=>r.questions?.length?pct((r.responses||[]).slice(0,r.questions.length).filter(x=>x&&(x.feedback||x.firstFeedback)).length,r.questions.length):0)):null;
});
pendingExtra.word=units.map(()=>null);pendingExtra.talk=units.map(()=>null);
for(let i=0;i<units.length;i+=3){
 await Promise.all(units.slice(i,i+3).map(async(u,j)=>{
  const k=i+j;
  const ids=new Set((targets||[]).filter(r=>String(r.unit_id)===String(u.id)).map(r=>r.lexical_entry_id));
  if(ids.size&&!gold.has(String(u.id))){
   const snap=await safe(window.WillenaStudyProgress.getVocabSnapshot(book.id,u.id));
   if(snap&&snap.vocabulary&&snap.spelling&&snap.speaking)pendingExtra.word[k]=pct((Number(snap.vocabulary.passed_count)||0)+(Number(snap.spelling.test_passed_count)||0)+(Number(snap.speaking.passed_count)||0),ids.size*3);
  }
  if(Array.isArray(questions)&&!questions.some(r=>String(r.unit_id)===String(u.id)))pendingExtra.talk[k]=-1;
  else if(Array.isArray(questions)){
   const data=await safe((async()=>{const t=window.WillenaAPI.getLocalAccessToken?.();if(!t)throw Error('No token');const r=await fetch('/api/free-talking-hybrid-lab',{method:'POST',cache:'no-store',headers:{Authorization:'Bearer '+t,'Content-Type':'application/json'},body:JSON.stringify({action:'progress',book_id:book.id,unit_id:u.id})});if(!r.ok)throw Error('Conversation progress unavailable');return r.json()})());
   if(data&&typeof data.contributions==='number')pendingExtra.talk[k]=pct(data.contributions,8);
  }
 }));
 if(ticket!==version)return;
}

if(mastery?.success&&Array.isArray(mastery.items)){
for(let i=0;i<units.length;i+=3){await Promise.all(units.slice(i,i+3).map(async(u,j)=>{try{const items=await loadSentences(book.id,u.id,u);if(!items.length){results[i+j]=-1;return}const passed=new Set(mastery.items.filter(x=>String(x.unit_id)===String(u.id)&&x.content_type==='sentence'&&Number(x.accuracy)>0).map(x=>x.skill+':'+x.content_id));const n=items.reduce((sum,x)=>sum+['sentence_coach','sentence_unscramble','sentence_speaking'].filter(k=>passed.has(k+':'+x.id)).length,0);results[i+j]=Math.round(n*100/(items.length*3));}catch{}}));if(ticket!==version)return;}
}
if(ticket!==version)return;extra=pendingExtra;render(book,units,gold,results);remember(book,units,gold,results);by('luStatus').textContent=units.length?'':'No units available.';
}catch(e){if(ticket===version)by('luStatus').textContent='Could not load progress. Try Refresh.';}finally{if(ticket===version){by('luGrid').removeAttribute('aria-busy');by('luGrid').style.opacity='';}}
}
async function load(){if(loading)return;loading=true;try{const p=await profile();books=await assignedBooks(p.className);if(!cacheKey){cacheKey='willena-learning-map-v4:'+p.id;restore()}if(!books.some(b=>String(b.id)===selectedBook))selectedBook=String(books[0]?.id||'');bookTabs();if(!books.length){by('luStatus').textContent='No assigned books.';return}await loadBook();loaded=true;}catch(e){by('luStatus').textContent='Curriculum unavailable. Try Refresh.';}finally{loading=false}}
function view(map){by('luApps').setAttribute('aria-pressed',String(!map));by('luMapTab').setAttribute('aria-pressed',String(map));hero.hidden=map;by('luMap').hidden=!map;try{localStorage.setItem('willena-staging-dashboard-view',map?'map':'apps')}catch{}if(map&&!loaded)void load()}
by('luApps').onclick=()=>view(false);by('luMapTab').onclick=()=>view(true);by('luBooks').onclick=e=>{const b=e.target.closest('[data-book]');if(!b)return;if(selectedBook===b.dataset.book)return;selectedBook=b.dataset.book;bookTabs();void loadBook()};
window.addEventListener('willena:map-missions',()=>{if(!starLaunching&&lastMap){const {book,units,wordGold,sentenceResults}=lastMap;render(book,units,wordGold,sentenceResults)}});
by('luGrid').addEventListener('click',event=>{
 const link=event.target.closest('a.lu-cell');
 if(!link||!link.querySelector('.lu-start-star')||event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
 if(window.matchMedia('(prefers-reduced-motion: reduce)').matches||!Element.prototype.animate)return;
 event.preventDefault();
 if(starLaunching)return;
 starLaunching=true;
 const url=link.href,rect=link.querySelector('.lu-start-star').getBoundingClientRect();
 const x=rect.left+rect.width/2,y=rect.top+rect.height/2;
 const burst=document.createElement('div');burst.className='lu-star-burst';burst.setAttribute('aria-hidden','true');
 const colors=['#f5c84d','#ffdf78','#28b7c4','#ed76ad','#ffffff'];
 by('luGrid').classList.add('lu-star-launching');link.classList.add('lu-star-shattered');link.querySelector('.lu-start-star').style.opacity='0';
 for(let i=0;i<100;i++){
  const p=document.createElement('span'),angle=i*2.39996323,d=20+Math.random()*Math.min(115,window.innerWidth*.28),size=3+Math.random()*8;
  p.style.cssText='left:'+x+'px;top:'+y+'px;width:'+size+'px;height:'+size+'px;background:'+colors[i%colors.length]+';';
  burst.appendChild(p);
  const dx=Math.cos(angle)*d,dy=Math.sin(angle)*d;
  p.animate([{transform:'translate(-50%,-50%) scale(.5)',opacity:1},{transform:'translate('+dx*.65+'px,'+dy*.65+'px) rotate('+i*13+'deg) scale(1)',opacity:1,offset:.48},{transform:'translate('+dx+'px,'+(dy+20)+'px) rotate('+i*29+'deg) scale(.15)',opacity:0}],{duration:490+Math.random()*210,easing:'cubic-bezier(.16,.7,.4,1)',fill:'forwards'});
 }
 document.body.appendChild(burst);
 setTimeout(()=>{window.location.assign(url)},720);
});
let initial=false;try{initial=localStorage.getItem('willena-staging-dashboard-view')==='map'}catch{}view(initial);void energy();window.addEventListener('pageshow',e=>{if(e.persisted){starLaunching=false;document.querySelectorAll('.lu-star-burst').forEach(el=>el.remove());by('luGrid').classList.remove('lu-star-launching');by('luGrid').querySelectorAll('.lu-star-shattered').forEach(el=>{el.classList.remove('lu-star-shattered');const star=el.querySelector('.lu-start-star');if(star)star.style.opacity=''});void energy();if(!by('luMap').hidden)void loadBook()}});
}
