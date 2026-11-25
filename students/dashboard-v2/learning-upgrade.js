import {studentIdentity,signedInProfile,assignedBooks,loadUnits,loadSentences} from '/students/sentence-genius/content.js';
const by=id=>document.getElementById(id),hero=document.querySelector('.hero');
const root=by('learningUpgrade');
if(root&&!document.documentElement.classList.contains('leaderboard-only')){
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let books=[],identity=null,loading=false,version=0,loaded=false;
const api=async path=>{const r=await window.WillenaAPI.fetch(path,{cache:'no-store'});if(!r.ok)throw Error('Request failed');return r.json()};
const profile=async()=>{if(identity)return identity;const who=await studentIdentity();const p=await signedInProfile(who.id);if(p.role!=='student'||!p.approved)throw Error('Student account required');return identity={...who,...p}};
async function energy(){
try{await profile();const snap=await window.WillenaMissionBasket.getGoldSnapshot();if(!snap)throw Error('Snapshot unavailable');const count=snap.word+snap.sentence+snap.writing;const value=(count%4)*25;by('luEnergyText').textContent=value+'%';by('luEnergyBar').setAttribute('aria-valuenow',value);by('luEnergyBar').firstElementChild.style.width=value+'%';by('luEnergyNote').textContent='Preview · '+count+' recorded gold units · 4 gold units = 1 jelly';}catch(e){by('luEnergyNote').textContent='Energy data unavailable · preview only';}}
function cell(label,p,url,state='unknown'){return '<a class="lu-cell" data-state="'+state+'" href="'+esc(url)+'"><strong>'+esc(p==null?'—':p+'%')+'</strong><div class="lu-meter"><i style="width:'+Math.max(0,p||0)+'%"></i></div><small>'+esc(label)+'</small></a>'}
function render(book,units,wordGold,sentenceResults){
const q=u=>'?book='+encodeURIComponent(book.id)+'&unit='+encodeURIComponent(u.id);
by('luGrid').innerHTML='<strong>Unit</strong><strong>Words</strong><strong>Sentences</strong><strong>Grammar</strong>'+units.map((u,i)=>{
const gold=wordGold.has(String(u.id)),p=sentenceResults[i];
return '<div class="lu-label"><strong>Unit '+esc(u.unit_number)+'</strong><small>'+esc(u.title)+'</small></div>'+cell(gold?'Gold':'Open',gold?100:null,'/students/vocab-study/'+q(u),gold?'gold':'unknown')+cell(p===100?'Gold':p===null?'Open':p===-1?'No content':p===0?'Start':'Continue',p===-1?null:p,'/students/sentence-genius/'+q(u),p===100?'gold':p===null||p===-1?'unknown':'progress')+cell('Open',null,'/students/grammar-books/');
}).join('');
}
async function loadBook(){
const ticket=++version,book=books.find(x=>String(x.id)===by('luBooks').value)||books[0];if(!book)return;
by('luStatus').textContent='Loading unit progress…';by('luGrid').innerHTML='';
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
async function load(){if(loading)return;loading=true;try{const p=await profile();books=await assignedBooks(p.className);by('luBooks').innerHTML=books.map(b=>'<option value="'+esc(b.id)+'">'+esc(b.title)+'</option>').join('');by('luBooks').hidden=books.length<2;if(!books.length){by('luStatus').textContent='No assigned books.';return}await loadBook();loaded=true;}catch(e){by('luStatus').textContent='Curriculum unavailable. Try Refresh.';}finally{loading=false}}
function view(map){by('luApps').setAttribute('aria-pressed',String(!map));by('luMapTab').setAttribute('aria-pressed',String(map));hero.hidden=map;by('luMap').hidden=!map;try{localStorage.setItem('willena-staging-dashboard-view',map?'map':'apps')}catch{}if(map&&!loaded)void load()}
by('luApps').onclick=()=>view(false);by('luMapTab').onclick=()=>view(true);by('luBooks').onchange=loadBook;by('luRetry').onclick=()=>{void load();void energy()};
let initial=false;try{initial=localStorage.getItem('willena-staging-dashboard-view')==='map'}catch{}view(initial);void energy();window.addEventListener('pageshow',e=>{if(e.persisted){void energy();if(!by('luMap').hidden)void load()}});
}
