import {capturePointOrigin,showPointAward} from '/students/components/student-point-feedback.js?v=20260927-startup2';
import {playStudentSfx,preloadStudentSfx} from '/students/shared/student-sfx.js?v=20260927-startup2';

const CONTENT_URL='https://gxwfsqxyuufqtitspfqg.supabase.co';
const CONTENT_KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
const OP_URL='https://fiieuiktlsivwfgyivai.supabase.co';
const OP_KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const ACTIVE_BOOK_KEY='willena-study-v2-active-book';
const GRID_TARGET=12;
const WORD_TARGET=10;
const POINTS_PER_WORD=1;

const $=id=>document.getElementById(id);
const gridEl=$('grid');
const wordListEl=$('wordList');
const bookSelect=$('bookSelect');
const bookLabel=$('bookLabel');
const progressEl=$('puzzleProgress');
const sessionPointsEl=$('sessionPoints');
const loadingCard=$('loadingCard');
const errorCard=$('errorCard');
const errorMessage=$('errorMessage');
const gameArea=$('gameArea');
const completeCard=$('completeCard');
const completePoints=$('completePoints');

const state={
  auth:null,books:[],book:null,words:[],grid:[],size:GRID_TARGET,placements:[],
  found:new Set(),drag:null,sessionId:null,startedAt:null,saving:false
};

function txt(v){return String(v??'').trim()}
function unique(values){return [...new Set(values.map(txt).filter(Boolean))]}
function shuffle(items){
  const a=items.slice();
  for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}
  return a;
}
function normalizeWord(word){return txt(word).toUpperCase().replace(/[^A-Z]/g,'')}
function withTimeout(promise,ms=12000,label='Request'){
  let timer;
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(label+' timed out.')),ms)})
  ]).finally(()=>clearTimeout(timer));
}
function apiFetch(url,opts){
  const fn=window.WillenaAPI&&typeof window.WillenaAPI.fetch==='function'?window.WillenaAPI.fetch.bind(window.WillenaAPI):window.fetch.bind(window);
  return withTimeout(fn(url,Object.assign({credentials:'include',cache:'no-store'},opts||{})),12000,'Student API');
}
async function apiJson(url,opts){
  const r=await apiFetch(url,opts);
  const d=await r.json().catch(()=>({}));
  if(!r.ok||(d&&d.success===false))throw new Error(d?.error||('Request failed ('+r.status+').'));
  return d;
}
async function content(path){
  const out=[];let offset=0;const pageSize=1000;
  while(true){
    const sep=path.includes('?')?'&':'?';
    const r=await withTimeout(fetch(CONTENT_URL+'/rest/v1/'+path+sep+'limit='+pageSize+'&offset='+offset,{
      headers:{apikey:CONTENT_KEY,Authorization:'Bearer '+CONTENT_KEY},cache:'no-store'
    }),12000,'Content DB');
    if(!r.ok)throw new Error('Content DB '+r.status);
    const rows=await r.json();
    if(!Array.isArray(rows))throw new Error('Content DB returned invalid data.');
    out.push(...rows);
    if(rows.length<pageSize)break;
    offset+=pageSize;
  }
  return out;
}
async function assignedBooks(className){
  const r=await withTimeout(fetch(OP_URL+'/rest/v1/rpc/get_study_assignment_for_class',{
    method:'POST',
    headers:{apikey:OP_KEY,Authorization:'Bearer '+OP_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({p_class_name:className}),cache:'no-store'
  }),12000,'Assigned book lookup');
  const d=await r.json().catch(()=>({}));
  if(!r.ok||!d.success)throw new Error(d.error||'Could not load assigned books.');
  const list=(Array.isArray(d.assignments)&&d.assignments.length?d.assignments:(d.assignment?[d.assignment]:[]))
    .filter(x=>x&&x.book_id);
  if(!list.length)throw new Error('No active book is assigned.');
  return list;
}

function showLoading(){
  loadingCard.hidden=false;errorCard.hidden=true;gameArea.hidden=true;completeCard.hidden=true;
}
function showError(error){
  loadingCard.hidden=true;gameArea.hidden=true;completeCard.hidden=true;errorCard.hidden=false;
  errorMessage.textContent=error?.message||String(error||'Unknown error');
}
function showGame(){loadingCard.hidden=true;errorCard.hidden=true;gameArea.hidden=false}

async function loadBookWords(book){
  const units=await content('content_units?select=id,unit_number,title&book_id=eq.'+encodeURIComponent(book.book_id)+'&status=in.(review,published)&order=unit_number.asc');
  if(!units.length)throw new Error('This book has no available units.');
  const unitIds=units.map(u=>u.id);

  let targets=await content('unit_vocab_targets?select=unit_id,lexical_entry_id,priority&unit_id=in.'+encodeURIComponent('('+unitIds.join(',')+')')+'&active=eq.true&order=priority.desc').catch(()=>[]);
  let lexIds=unique(targets.map(r=>r.lexical_entry_id));
  let rows=[];

  if(lexIds.length){
    rows=await content('lexical_entries?select=id,canonical_text,translation_ko&id=in.'+encodeURIComponent('('+lexIds.join(',')+')')+'&status=in.(review,published)');
  }

  if(!rows.length){
    const occ=await content('source_content_occurrences?select=unit_id,lexical_entry_id&unit_id=in.'+encodeURIComponent('('+unitIds.join(',')+')')+'&occurrence_type=eq.lexical_entry&status=in.(review,published)').catch(()=>[]);
    lexIds=unique(occ.map(r=>r.lexical_entry_id));
    if(lexIds.length){
      rows=await content('lexical_entries?select=id,canonical_text,translation_ko&id=in.'+encodeURIComponent('('+lexIds.join(',')+')')+'&status=in.(review,published)');
    }
  }

  if(!rows.length){
    const collections=await content('collections?select=id,unit_id,metadata&collection_type=eq.word_builder&book_id=eq.'+encodeURIComponent(book.book_id)).catch(()=>[]);
    const collectionIds=unique(collections.map(r=>r.id));
    if(collectionIds.length){
      const items=await content('collection_items?select=content_id&content_type=eq.lexical_entry&collection_id=in.'+encodeURIComponent('('+collectionIds.join(',')+')')).catch(()=>[]);
      lexIds=unique(items.map(r=>r.content_id));
      if(lexIds.length){
        rows=await content('lexical_entries?select=id,canonical_text,translation_ko&id=in.'+encodeURIComponent('('+lexIds.join(',')+')')+'&status=in.(review,published)');
      }
    }
  }

  const seen=new Set();
  return shuffle(rows.map(row=>{
    const display=txt(row.canonical_text);
    const clean=normalizeWord(display);
    return{id:row.id,display,clean,ko:txt(row.translation_ko)};
  }).filter(item=>{
    if(item.clean.length<3||item.clean.length>14)return false;
    const key=item.clean;
    if(seen.has(key))return false;
    seen.add(key);
    return true;
  }));
}

const DIRECTIONS=[
  [0,1],[0,-1],[1,0],[-1,0],
  [1,1],[1,-1],[-1,1],[-1,-1]
];

function emptyGrid(size){return Array.from({length:size},()=>Array(size).fill(''))}
function canPlace(grid,word,row,col,dr,dc){
  const size=grid.length;
  const endRow=row+dr*(word.length-1),endCol=col+dc*(word.length-1);
  if(endRow<0||endRow>=size||endCol<0||endCol>=size)return false;
  for(let i=0;i<word.length;i++){
    const r=row+dr*i,c=col+dc*i,current=grid[r][c];
    if(current&&current!==word[i])return false;
  }
  return true;
}
function placeWord(grid,entry){
  const directions=shuffle(DIRECTIONS);
  const cells=Array.from({length:grid.length*grid.length},(_,i)=>[Math.floor(i/grid.length),i%grid.length]);
  for(const [row,col] of shuffle(cells)){
    for(const [dr,dc] of directions){
      if(!canPlace(grid,entry.clean,row,col,dr,dc))continue;
      const coords=[];
      for(let i=0;i<entry.clean.length;i++){
        const r=row+dr*i,c=col+dc*i;
        grid[r][c]=entry.clean[i];coords.push([r,c]);
      }
      return{...entry,row,col,dr,dc,coords};
    }
  }
  return null;
}
function fillGrid(grid){
  const letters='ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for(let r=0;r<grid.length;r++)for(let c=0;c<grid.length;c++){
    if(!grid[r][c])grid[r][c]=letters[Math.floor(Math.random()*letters.length)];
  }
}
function generatePuzzle(pool){
  const candidates=shuffle(pool).sort((a,b)=>b.clean.length-a.clean.length);
  for(let attempt=0;attempt<40;attempt++){
    const chosen=shuffle(candidates).slice(0,Math.min(WORD_TARGET,candidates.length)).sort((a,b)=>b.clean.length-a.clean.length);
    const maxLen=Math.max(...chosen.map(x=>x.clean.length),8);
    const size=Math.max(10,Math.min(14,Math.max(GRID_TARGET,maxLen)));
    const grid=emptyGrid(size),placements=[];
    let ok=true;
    for(const entry of chosen){
      const placed=placeWord(grid,entry);
      if(!placed){ok=false;break}
      placements.push(placed);
    }
    if(ok&&placements.length>=Math.min(6,WORD_TARGET)){
      fillGrid(grid);
      return{grid,size,placements};
    }
  }
  throw new Error('I could not fit enough words into a puzzle. Try another book.');
}

function renderPuzzle(){
  state.found.clear();
  state.drag=null;
  state.sessionId=crypto.randomUUID?.()||('wordsearch-'+Date.now());
  state.startedAt=new Date().toISOString();
  gridEl.style.setProperty('--size',state.size);
  gridEl.innerHTML='';
  for(let r=0;r<state.size;r++)for(let c=0;c<state.size;c++){
    const cell=document.createElement('button');
    cell.type='button';cell.className='cell';cell.textContent=state.grid[r][c];
    cell.dataset.row=r;cell.dataset.col=c;cell.setAttribute('role','gridcell');
    gridEl.appendChild(cell);
  }
  wordListEl.innerHTML=state.placements.map((p,i)=>
    '<div class="word-chip" data-word-index="'+i+'"><strong>'+escapeHtml(p.display)+'</strong><small>'+escapeHtml(p.ko||'found')+'</small></div>'
  ).join('');
  updateProgress();
}
function escapeHtml(v){return txt(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function updateProgress(){
  progressEl.textContent=state.found.size+' / '+state.placements.length+' found';
  sessionPointsEl.textContent='+'+(state.found.size*POINTS_PER_WORD)+' pts';
}
function cellAt(row,col){return gridEl.querySelector('.cell[data-row="'+row+'"][data-col="'+col+'"]')}
function coordsBetween(start,end){
  const dr=end.row-start.row,dc=end.col-start.col;
  if(dr===0&&dc===0)return[[start.row,start.col]];
  const steps=Math.max(Math.abs(dr),Math.abs(dc));
  if(!(dr===0||dc===0||Math.abs(dr)===Math.abs(dc)))return[];
  const sr=Math.sign(dr),sc=Math.sign(dc),out=[];
  for(let i=0;i<=steps;i++)out.push([start.row+sr*i,start.col+sc*i]);
  return out;
}
function clearPreview(){gridEl.querySelectorAll('.cell.preview').forEach(el=>el.classList.remove('preview'))}
function preview(coords){
  clearPreview();
  coords.forEach(([r,c])=>cellAt(r,c)?.classList.add('preview'));
}
function coordsKey(coords){return coords.map(([r,c])=>r+','+c).join('|')}
function samePath(a,b){
  if(a.length!==b.length)return false;
  const ak=coordsKey(a),bk=coordsKey(b),br=coordsKey(b.slice().reverse());
  return ak===bk||ak===br;
}
function pointToCell(clientX,clientY){
  const hit=document.elementFromPoint(clientX,clientY)?.closest?.('.cell');
  if(!hit||!gridEl.contains(hit))return null;
  return{row:Number(hit.dataset.row),col:Number(hit.dataset.col),el:hit};
}
function beginDrag(point){
  state.drag={start:{row:point.row,col:point.col},end:{row:point.row,col:point.col}};
  preview([[point.row,point.col]]);
}
function moveDrag(point){
  if(!state.drag)return;
  state.drag.end={row:point.row,col:point.col};
  preview(coordsBetween(state.drag.start,state.drag.end));
}
async function endDrag(originEl){
  if(!state.drag)return;
  const coords=coordsBetween(state.drag.start,state.drag.end);
  state.drag=null;clearPreview();
  if(coords.length<2)return;
  const index=state.placements.findIndex((p,i)=>!state.found.has(i)&&samePath(coords,p.coords));
  if(index<0)return;
  await markFound(index,originEl);
}
async function markFound(index,originEl){
  if(state.found.has(index))return;
  state.found.add(index);
  const placement=state.placements[index];
  placement.coords.forEach(([r,c])=>cellAt(r,c)?.classList.add('found'));
  const chip=wordListEl.querySelector('[data-word-index="'+index+'"]');
  chip?.classList.add('found','just-found');
  setTimeout(()=>chip?.classList.remove('just-found'),450);
  updateProgress();
  playStudentSfx('correct');
  showPointAward({amount:POINTS_PER_WORD,origin:capturePointOrigin(originEl||cellAt(...placement.coords[placement.coords.length-1]))});
  if(state.found.size===state.placements.length){
    await finishPuzzle();
  }
}
async function finishPuzzle(){
  playStudentSfx('complete');
  completePoints.textContent='You earned '+(state.found.size*POINTS_PER_WORD)+' points.';
  completeCard.hidden=false;
  completeCard.scrollIntoView({behavior:'smooth',block:'center'});
  await saveReward();
}
async function saveReward(){
  if(state.saving||!state.book||!state.sessionId)return;
  state.saving=true;
  const points=state.found.size*POINTS_PER_WORD;
  try{
    const payload={
      reward_only:true,
      session_id:state.sessionId,
      client_attempt_id:crypto.randomUUID?.()||('wordsearch-reward-'+Date.now()),
      book_id:state.book.book_id,
      unit_id:null,
      skill:'vocabulary',
      response_type:'reward',
      activity_id:'wordsearch',
      reward_mode:'wordsearch',
      reward_list_name:'Word Search · '+txt(state.book.book_title||state.book.title||'Book'),
      reward_list_size:state.placements.length,
      reward_started_at:state.startedAt,
      reward_summary:{
        completed:true,stars:0,accuracy:1,percent:100,
        score:state.placements.length,total:state.placements.length,
        points_earned:points,book_id:state.book.book_id,unit_id:null,
        assignment_id:null,session_source:'student',vocab_mode:'wordsearch',
        reward_scheme:'wordsearch-v1',star_cap:0
      }
    };
    await apiJson('/.netlify/functions/progress_summary?section=study_attempt&_='+Date.now(),{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({payload})
    });
    window.dispatchEvent(new CustomEvent('session:ended',{detail:{session_id:state.sessionId,mode:'wordsearch',list_size:state.placements.length}}));
  }catch(error){
    console.warn('[Word Search] reward save failed',error);
  }finally{state.saving=false}
}

function wireGrid(){
  gridEl.addEventListener('pointerdown',e=>{
    const point=pointToCell(e.clientX,e.clientY);if(!point)return;
    e.preventDefault();gridEl.setPointerCapture?.(e.pointerId);beginDrag(point);
  });
  gridEl.addEventListener('pointermove',e=>{
    if(!state.drag)return;
    const point=pointToCell(e.clientX,e.clientY);if(point)moveDrag(point);
  });
  gridEl.addEventListener('pointerup',e=>{
    const point=pointToCell(e.clientX,e.clientY);
    if(point)moveDrag(point);
    endDrag(point?.el||e.target);
  });
  gridEl.addEventListener('pointercancel',()=>{state.drag=null;clearPreview()});
}

async function buildForBook(bookId){
  showLoading();
  try{
    state.book=state.books.find(b=>String(b.book_id)===String(bookId))||state.books[0];
    if(!state.book)throw new Error('No book selected.');
    try{localStorage.setItem(ACTIVE_BOOK_KEY,state.book.book_id)}catch(_){}
    const pool=await loadBookWords(state.book);
    if(pool.length<6)throw new Error('This book does not have enough puzzle words yet.');
    const puzzle=generatePuzzle(pool);
    state.words=pool;state.grid=puzzle.grid;state.size=puzzle.size;state.placements=puzzle.placements;
    bookLabel.textContent=txt(state.book.book_title||state.book.title||'YOUR BOOK').toUpperCase();
    renderPuzzle();showGame();
  }catch(error){console.error('[Word Search]',error);showError(error)}
}
function renderBooks(){
  bookSelect.innerHTML=state.books.map(b=>'<option value="'+escapeHtml(b.book_id)+'">'+escapeHtml(b.book_title||b.title||'Vocabulary')+'</option>').join('');
  let wanted='';try{wanted=localStorage.getItem(ACTIVE_BOOK_KEY)||''}catch(_){}
  if(state.books.some(b=>String(b.book_id)===String(wanted)))bookSelect.value=wanted;
}
async function boot(){
  preloadStudentSfx();showLoading();
  try{
    let who=null;
    if(window.WillenaVocabStudyAuthReady){
      who=await withTimeout(window.WillenaVocabStudyAuthReady,15000,'Student sign-in');
      if(!who)return;
    }else{
      who=await apiJson('/.netlify/functions/supabase_auth?action=whoami&_='+Date.now());
    }
    state.auth=who;
    if(!who?.success||!who?.class)throw new Error('No active student class was found.');
    loadingCard.querySelector('strong').textContent='Finding your book…';
    state.books=await assignedBooks(who.class);
    renderBooks();
    loadingCard.querySelector('strong').textContent='Loading puzzle words…';
    await buildForBook(bookSelect.value||state.books[0].book_id);
  }catch(error){
    console.error('[Word Search boot]',error);
    showError(error);
  }
}

bookSelect.addEventListener('change',()=>buildForBook(bookSelect.value));
$('newPuzzleBtn').addEventListener('click',()=>buildForBook(bookSelect.value));
$('retryBtn').addEventListener('click',()=>buildForBook(bookSelect.value));
$('playAgainBtn').addEventListener('click',()=>buildForBook(bookSelect.value));
wireGrid();
boot();
