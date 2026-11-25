import {studentIdentity,signedInProfile,assignedBooks,loadUnits,loadSentences} from '/students/sentence-genius/content.js';
const by=id=>document.getElementById(id),hero=document.querySelector('.hero');
const root=by('learningUpgrade');
if(root&&!document.documentElement.classList.contains('leaderboard-only')){
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let books=[],identity=null,loading=false,version=0,loaded=false,selectedBook='',lastMap=null;
const api=async path=>{const r=await window.WillenaAPI.fetch(path,{cache:'no-store'});if(!r.ok)throw Error('Request failed');return r.json()};
const profile=async()=>{if(identity)return identity;const who=await studentIdentity();const p=await signedInProfile(who.id);if(p.role!=='student'||!p.approved)throw Error('Student account required');return identity={...who,...p}};
async function energy(){
try{await profile();const snap=await safe(studentRead('student_achievement_snapshots?select=gold_word,gold_sentence,gold_writing&student_id=eq.'+encodeURIComponent((await profile()).id)+'&limit=1'));const row=snap?.[0];if(!row)throw Error('Snapshot unavailable');const count=(Number(row.gold_word)||0)+(Number(row.gold_sentence)||0)+(Number(row.gold_writing)||0);const value=(count%4)*25;by('luEnergyText').textContent=value+'%';by('luEnergyBar').setAttribute('aria-valuenow',value);by('luEnergyBar').firstElementChild.style.width=value+'%';by('luEnergyNote').textContent='Preview · 4 gold units = 1 jelly';}catch(e){by('luEnergyNote').textContent='Energy data unavailable · preview only';}}
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
 const r=await fetch('https://fiieuiktlsivwfgyivai.supabase.co/rest/v1/'+path,{cache:'no-store',headers:{apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{method:'POST',body:JSON.stringify(body)}:{})});
 if(!r.ok)throw Error('Progress source unavailable');return r.json();
}
async function contentRead(path){
 const key=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
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

function cell(label,p,url,state='unknown',tone='cyan'){
 const value=p==null||p<0?null:Math.max(0,Math.min(100,p));
 const text=value===null?'—':value+'%';
 const progress=value===null?0:value;
 const gold=state==='gold';
 const ring='<svg class="lu-ring" viewBox="0 0 64 68" aria-hidden="true"><circle class="lu-ring-depth" cx="32" cy="35" r="27"/><circle class="lu-ring-track" cx="32" cy="32" r="27"/>'+
 (progress>0?'<circle class="lu-ring-progress" cx="32" cy="32" r="27" pathLength="100" stroke-dasharray="'+progress+' 100" transform="rotate(-90 32 32)"/>':'')+
 (gold?'<path class="lu-ring-star" d="M32 18l4.2 9 9.8 1.2-7.1 7 1.7 9.8-8.6-4.7-8.6 4.7 1.7-9.8-7.1-7 9.8-1.2z"/>':'<text x="32" y="33" dominant-baseline="middle" text-anchor="middle">'+esc(text)+'</text>')+'</svg>';
 const attrs=' class="lu-cell" data-state="'+state+'" aria-label="'+esc(gold?'100% · Completed':text+(value===null?' · '+label:''))+'"';
 return url?'<a'+attrs+' href="'+esc(url)+'">'+ring+'</a>':'<span'+attrs+'>'+ring+'</span>';
}
function render(book,units,wordGold,sentenceResults){
lastMap={book,units,wordGold,sentenceResults};
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
return cell(label,p,url,state,'cyan');
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
let initial=false;try{initial=localStorage.getItem('willena-staging-dashboard-view')==='map'}catch{}view(initial);void energy();window.addEventListener('pageshow',e=>{if(e.persisted){void energy();if(!by('luMap').hidden)void loadBook()}});
}
