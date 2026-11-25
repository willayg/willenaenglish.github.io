import {studentIdentity,signedInProfile,assignedBooks,loadUnits,loadSentences} from '/students/sentence-genius/content.js';
const by=id=>document.getElementById(id),hero=document.querySelector('.hero');
const root=by('learningUpgrade');
if(root&&!document.documentElement.classList.contains('leaderboard-only')){
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let books=[],identity=null,loading=false,version=0,loaded=false,selectedBook='',selectedGroup=0,lastMap=null;
const api=async path=>{const r=await window.WillenaAPI.fetch(path,{cache:'no-store'});if(!r.ok)throw Error('Request failed');return r.json()};
const profile=async()=>{if(identity)return identity;const who=await studentIdentity();const p=await signedInProfile(who.id);if(p.role!=='student'||!p.approved)throw Error('Student account required');return identity={...who,...p}};
async function energy(){
try{await profile();const snap=await window.WillenaMissionBasket.getGoldSnapshot();if(!snap)throw Error('Snapshot unavailable');const count=snap.word+snap.sentence+snap.writing;const value=(count%4)*25;by('luEnergyText').textContent=value+'%';by('luEnergyBar').setAttribute('aria-valuenow',value);by('luEnergyBar').firstElementChild.style.width=value+'%';by('luEnergyNote').textContent='Preview · '+count+' recorded gold units · 4 gold units = 1 jelly';}catch(e){by('luEnergyNote').textContent='Energy data unavailable · preview only';}}
const groups=[
 [{label:'Words',path:'/students/vocab-study/',kind:'word',icon:'word-genius.svg'},{label:'Sentences',path:'/students/sentence-genius/',kind:'sentence',icon:'sentence-genius.svg'},{label:'Grammar',path:'/students/grammar-books/',kind:'grammar'}],
 [{label:'Speaking',path:'/students/free-talking-genius/',kind:'talk',icon:'free-talking-bunny-fox.svg'},{label:'Writing',path:'/students/writing-genius/',kind:'writing'},{label:'Listening',path:'/students/listening-genius/',kind:'listening',icon:'listening-genius.svg'}],
 [{label:'Puzzles',path:'/students/wordsearch/',kind:'puzzles'},{label:'내신 Grammar',path:'/students/grammar-foundations/?path=naesin',kind:'naesin',icon:'grammar-foundation-logo.png'},{label:'내신명중',path:'/students/test-prep-v2/',kind:'test',icon:'naesin-myeongjung-logo.png'}]
];
function cell(label,p,url,state='unknown',tone='cyan'){
return '<a class="lu-cell" data-state="'+state+'" data-tone="'+tone+'" href="'+esc(url)+'"><strong>'+esc(p==null?'—':p+'%')+'</strong><div class="lu-meter"><i style="width:'+Math.max(0,p||0)+'%"></i></div><small>'+esc(label)+'</small></a>';
}
function render(book,units,wordGold,sentenceResults){
lastMap={book,units,wordGold,sentenceResults};
const apps=groups[selectedGroup],q=u=>'?book='+encodeURIComponent(book.id)+'&unit='+encodeURIComponent(u.id);
by('luGrid').innerHTML='<strong>Unit</strong>'+apps.map(a=>'<strong class="lu-col">'+(a.icon?'<img alt="" src="/students/assets/icons/'+a.icon+'">':'')+esc(a.label)+'</strong>').join('')+units.map((u,i)=>{
return '<div class="lu-label" title="'+esc(u.title)+'"><strong>'+esc(u.unit_number)+'</strong></div>'+apps.map((app,j)=>{
let p=null, label='Open',state='unknown',url=app.path;
if(app.kind==='word'){if(wordGold.has(String(u.id))){p=100;label='Gold';state='gold';}url+=q(u);}
if(app.kind==='sentence'){p=sentenceResults[i];url+=q(u);label=p===100?'Gold':p===null?'Open':p===-1?'N/A':p===0?'Start':'Continue';state=p===100?'gold':p===null||p===-1?'unknown':'progress';if(p===-1)return '<span class="lu-cell" data-state="unknown"><strong>—</strong><small>N/A</small></span>';}
return cell(label,p,url,state,j===1?'pink':'cyan');
}).join('');
}).join('');
}
function bookTabs(){
by('luBooks').innerHTML=books.map(b=>'<button type="button" data-book="'+esc(b.id)+'" aria-pressed="'+(String(b.id)===selectedBook)+'">'+esc(b.title)+'</button>').join('');
}
function groupTabs(){
by('luGroups').innerHTML=['Core','Communication','Practice / 내신'].map((name,i)=>'<button type="button" data-group="'+i+'" aria-pressed="'+(i===selectedGroup)+'">'+name+'</button>').join('');
}
async function loadBook(){
const ticket=++version,book=books.find(x=>String(x.id)===selectedBook)||books[0];if(!book)return;
by('luStatus').textContent='Loading unit progress…';by('luGrid').innerHTML='';lastMap=null;
try{
const [units,words,mastery]=await Promise.all([loadUnits(book.id),api('/.netlify/functions/progress_summary?section=vocab_motivation').catch(()=>null),window.WillenaStudyProgress.getContentMastery(book.id).catch(()=>null)]);
if(ticket!==version)return;
const gold=new Set((words?.golden_units||[]).map(x=>String(x.unit_id)));
const results=units.map(()=>null);render(book,units,gold,results);
if(mastery?.success&&Array.isArray(mastery.items)){
for(let i=0;i<units.length;i+=3){await Promise.all(units.slice(i,i+3).map(async(u,j)=>{try{const items=await loadSentences(book.id,u.id,u);if(!items.length){results[i+j]=-1;return}const passed=new Set(mastery.items.filter(x=>String(x.unit_id)===String(u.id)&&x.content_type==='sentence'&&Number(x.accuracy)>0).map(x=>x.skill+':'+x.content_id));const n=items.reduce((sum,x)=>sum+['sentence_coach','sentence_unscramble','sentence_speaking'].filter(k=>passed.has(k+':'+x.id)).length,0);results[i+j]=Math.round(n*100/(items.length*3));}catch{}}));if(ticket!==version)return;render(book,units,gold,results);}
}
by('luStatus').textContent=units.length?'Choose a unit to study.':'No units available.';
}catch(e){if(ticket===version)by('luStatus').textContent='Could not load progress. Try Refresh.';}
}
async function load(){if(loading)return;loading=true;try{const p=await profile();books=await assignedBooks(p.className);if(!books.some(b=>String(b.id)===selectedBook))selectedBook=String(books[0]?.id||'');bookTabs();if(!books.length){by('luStatus').textContent='No assigned books.';return}await loadBook();loaded=true;}catch(e){by('luStatus').textContent='Curriculum unavailable. Try Refresh.';}finally{loading=false}}
function view(map){by('luApps').setAttribute('aria-pressed',String(!map));by('luMapTab').setAttribute('aria-pressed',String(map));hero.hidden=map;by('luMap').hidden=!map;try{localStorage.setItem('willena-staging-dashboard-view',map?'map':'apps')}catch{}if(map&&!loaded)void load()}
by('luApps').onclick=()=>view(false);by('luMapTab').onclick=()=>view(true);by('luBooks').onclick=e=>{const b=e.target.closest('[data-book]');if(!b)return;selectedBook=b.dataset.book;bookTabs();void loadBook()};by('luGroups').onclick=e=>{const b=e.target.closest('[data-group]');if(!b)return;selectedGroup=Number(b.dataset.group);groupTabs();if(lastMap)render(lastMap.book,lastMap.units,lastMap.wordGold,lastMap.sentenceResults)};groupTabs();by('luRetry').onclick=()=>{void load();void energy()};
let initial=false;try{initial=localStorage.getItem('willena-staging-dashboard-view')==='map'}catch{}view(initial);void energy();window.addEventListener('pageshow',e=>{if(e.persisted){void energy();if(!by('luMap').hidden)void load()}});
}
