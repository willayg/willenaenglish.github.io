import {capturePointOrigin,showPointAward} from '/students/components/student-point-feedback.js?v=20260927-startup2';
import {playStudentSfx,preloadStudentSfx} from '/students/shared/student-sfx.js?v=20260927-startup2';

const CONTENT_URL='https://gxwfsqxyuufqtitspfqg.supabase.co';
const CONTENT_KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
const OP_URL='https://fiieuiktlsivwfgyivai.supabase.co';
const OP_KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const GRID_TARGET=12;
const WORD_TARGET=10;
const POINTS_PER_WORD=1;
const BOGGLE_SIZE=5;
const BOGGLE_TARGET=8;
const MIX_MATCH_TARGET=6;

const $=id=>document.getElementById(id);
const gridEl=$('grid');
const wordGridStage=$('wordGridStage');
const boggleCanvas=$('boggleCanvas');
const mixMatchGrid=$('mixMatchGrid');
const clueStripWrap=$('clueStripWrap');
const wordSearchSizeControl=$('wordSearchSizeControl');
const gameHelpBtn=$('gameHelpBtn');
const gameHelpDialog=$('gameHelpDialog');
const crosswordGridEl=$('crosswordGrid');
const crosswordEntry=$('crosswordEntry');
const wordListEl=$('wordList');
const modeLabel=$('modeLabel');
const listEyebrow=$('listEyebrow');
const listTitle=$('listTitle');
const dragHint=$('dragHint');
const progressEl=$('puzzleProgress');
const sessionPointsEl=$('sessionPoints');
const loadingCard=$('loadingCard');
const errorCard=$('errorCard');
const errorMessage=$('errorMessage');
const gameArea=$('gameArea');
const completeCard=$('completeCard');
const completePoints=$('completePoints');
const rewardCelebration=$('rewardCelebration');
const cheatFinishBtn=$('cheatFinishBtn');
const CHEAT_MODE=new URLSearchParams(location.search).get('cheat')==='1';

const state={
  auth:null,books:[],book:null,words:[],pool:[],crosswordPool:[],studentLevel:null,rewardContext:null,ready:false,buildToken:0,grid:[],size:GRID_TARGET,placements:[],
  found:new Set(),gimmes:new Set(),bogglePaths:new Map(),drag:null,sessionId:null,startedAt:null,saving:false,mode:'boggle',gridSize:8,activeCrossword:null,crosswordCursor:0,cheatCompletion:false,matchFirst:null,matchLocked:false,
  modeSnapshots:new Map()
};

function txt(v){return String(v??'').trim()}
function unique(values){return [...new Set(values.map(txt).filter(Boolean))]}
function shuffle(items){
  const a=items.slice();
  for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}
  return a;
}
function normalizeWord(word){return txt(word).toUpperCase().replace(/[^A-Z]/g,'')}
function scrambleLetters(word){
  const chars=word.split('');
  if(chars.length<2)return word;
  for(let tries=0;tries<8;tries++){
    const mixed=shuffle(chars).join('');
    if(mixed!==word)return mixed;
  }
  return chars.slice(1).concat(chars[0]).join('');
}
let crosswordWordAudio=null;
const crosswordWordAudioCache=new Map();

function cleanBrowserTtsText(text){
  return txt(text)
    .replace(/_+/g,' ')
    .replace(/[~～]+/g,' ')
    .replace(/[\\/|]+/g,' ')
    .replace(/[()[\]{}<>]+/g,' ')
    .replace(/[•·…]+/g,' ')
    .replace(/[-–—]{2,}/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}
function browserTtsWord(text){
  if(!('speechSynthesis' in window)||!window.SpeechSynthesisUtterance)return false;
  try{
    const spoken=cleanBrowserTtsText(text);
    if(!spoken)return false;
    speechSynthesis.cancel();
    const utterance=new SpeechSynthesisUtterance(spoken);
    utterance.lang='en-US';
    utterance.rate=.9;
    speechSynthesis.speak(utterance);
    return true;
  }catch(_){return false}
}
async function speakHintWord(word){
  const text=txt(word);
  if(!text)return false;
  try{speechSynthesis?.cancel?.()}catch(_){}
  try{
    if(crosswordWordAudio){
      try{crosswordWordAudio.pause()}catch(_){}
      crosswordWordAudio=null;
    }
    let objectUrl=crosswordWordAudioCache.get(text.toLowerCase())||'';
    if(!objectUrl){
      const endpoint='https://get-audio-urls.willena.workers.dev/word-audio?word='+encodeURIComponent(text);
      const response=await fetch(endpoint,{cache:'force-cache'});
      if(!response.ok)throw new Error('R2 audio '+response.status);
      const blob=await response.blob();
      if(!blob.size)throw new Error('Empty R2 audio');
      objectUrl=URL.createObjectURL(blob);
      crosswordWordAudioCache.set(text.toLowerCase(),objectUrl);
    }
    const audio=new Audio(objectUrl);
    crosswordWordAudio=audio;
    await audio.play();
    audio.addEventListener('ended',()=>{if(crosswordWordAudio===audio)crosswordWordAudio=null},{once:true});
    return true;
  }catch(error){
    console.debug('[Word Games] R2 word audio unavailable; using browser TTS',text,error);
    return browserTtsWord(text);
  }
}
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

function setPuzzleControlsEnabled(enabled){
  document.querySelectorAll('.puzzle-tab').forEach(btn=>{btn.disabled=!enabled});
  const newBtn=$('newPuzzleBtn');
  const retry=$('retryBtn');
  if(newBtn)newBtn.disabled=!enabled;
  if(retry)retry.disabled=!enabled;
}

function closeWinModal(){
  if(completeCard?.open)completeCard.close();
}
function showLoading(){
  closeWinModal();
  loadingCard.hidden=false;errorCard.hidden=true;gameArea.hidden=true;
}
function showError(error){
  closeWinModal();
  loadingCard.hidden=true;gameArea.hidden=true;errorCard.hidden=false;
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


async function resolveStudentLevel(books){
  const ids=unique(books.map(b=>b.book_id));
  if(!ids.length)return null;
  const rows=await content('content_books?select=id,internal_level_id,public_level&id=in.'+
    encodeURIComponent('('+ids.join(',')+')')+'&status=in.(review,published)').catch(()=>[]);
  const levels=rows.map(r=>Number(r.internal_level_id)||Number(r.public_level)||0).filter(n=>n>0);
  return levels.length?Math.max(...levels):null;
}
async function loadLevelCrosswordWords(level){
  if(!Number.isFinite(Number(level))||Number(level)<=0)return[];
  const rows=await content(
    'lexical_entries?select=id,canonical_text,translation_ko,definition_en,level_id'+
    '&level_id=lte.'+encodeURIComponent(level)+
    '&status=in.(review,published)&order=canonical_text.asc'
  ).catch(()=>[]);
  const seen=new Set();
  return rows.map(row=>{
    const display=txt(row.canonical_text);
    const clean=normalizeWord(display);
    return{
      id:row.id,display,clean,ko:txt(row.translation_ko),
      definition:txt(row.definition_en),level:Number(row.level_id)||null
    };
  }).filter(item=>{
    if(!item.ko||!/^[A-Za-z]+$/.test(item.display))return false;
    if(item.clean.length<3||item.clean.length>11)return false;
    if(seen.has(item.clean))return false;
    seen.add(item.clean);
    return true;
  });
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
function generatePuzzle(pool,size=GRID_TARGET){
  const boardSize=[8,10,12].includes(Number(size))?Number(size):GRID_TARGET;
  const target=boardSize===8?6:(boardSize===10?8:WORD_TARGET);
  const candidates=shuffle(pool.filter(x=>x.clean.length<=boardSize)).sort((a,b)=>b.clean.length-a.clean.length);
  if(candidates.length<Math.min(6,target))throw new Error('Not enough short words for this grid size. Try a larger grid.');
  for(let attempt=0;attempt<70;attempt++){
    const chosen=shuffle(candidates).slice(0,Math.min(target,candidates.length)).sort((a,b)=>b.clean.length-a.clean.length);
    const grid=emptyGrid(boardSize),placements=[];
    let ok=true;
    for(const entry of chosen){
      const placed=placeWord(grid,entry);
      if(!placed){ok=false;break}
      placements.push(placed);
    }
    if(ok&&placements.length>=Math.min(6,target)){
      fillGrid(grid);
      return{grid,size:boardSize,placements};
    }
  }
  throw new Error('I could not fit enough words into this grid. Try a larger grid or a new puzzle.');
}


function boggleNeighbors(row,col,size=BOGGLE_SIZE){
  const out=[];
  for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){
    if(!dr&&!dc)continue;
    const r=row+dr,c=col+dc;
    if(r>=0&&c>=0&&r<size&&c<size)out.push([r,c]);
  }
  return shuffle(out);
}
function bogglePlaceWord(board,entry){
  const size=board.length;
  const starts=shuffle(Array.from({length:size*size},(_,i)=>[Math.floor(i/size),i%size]));

  function dfs(index,row,col,used,path){
    const key=row+','+col;
    if(used.has(key))return null;
    const current=board[row][col];
    if(current&&current!==entry.clean[index])return null;

    const nextUsed=new Set(used);nextUsed.add(key);
    const nextPath=path.concat([[row,col]]);
    if(index===entry.clean.length-1)return nextPath;

    for(const [nr,nc] of boggleNeighbors(row,col,size)){
      const found=dfs(index+1,nr,nc,nextUsed,nextPath);
      if(found)return found;
    }
    return null;
  }

  for(const [r,c] of starts){
    const path=dfs(0,r,c,new Set(),[]);
    if(!path)continue;
    path.forEach(([pr,pc],i)=>{board[pr][pc]=entry.clean[i]});
    return{...entry,coords:path};
  }
  return null;
}

const BOGGLE_LINE_COLORS=['#e75e9f','#31bccc','#7e67d8','#ef9b3e','#55a86c','#d56060','#3f82c4','#b4772f'];

function clearBoggleCanvas(){
  state.bogglePaths.clear();
  if(!boggleCanvas)return;
  const ctx=boggleCanvas.getContext('2d');
  ctx?.clearRect(0,0,boggleCanvas.width,boggleCanvas.height);
}
function sizeBoggleCanvas(){
  if(!boggleCanvas||!wordGridStage)return;
  const rect=wordGridStage.getBoundingClientRect();
  const dpr=Math.max(1,window.devicePixelRatio||1);
  const w=Math.max(1,Math.round(rect.width));
  const h=Math.max(1,Math.round(rect.height));
  const rw=Math.max(1,Math.round(w*dpr));
  const rh=Math.max(1,Math.round(h*dpr));
  if(boggleCanvas.width!==rw||boggleCanvas.height!==rh){
    boggleCanvas.width=rw;
    boggleCanvas.height=rh;
    boggleCanvas.style.width=w+'px';
    boggleCanvas.style.height=h+'px';
  }
  const ctx=boggleCanvas.getContext('2d');
  if(ctx)ctx.setTransform(dpr,0,0,dpr,0,0);
}
function pointInBoggleStage(clientX,clientY){
  const rect=wordGridStage?.getBoundingClientRect();
  if(!rect)return null;
  return{x:clientX-rect.left,y:clientY-rect.top};
}
function boggleCellCenter(row,col){
  const el=cellAt(row,col);
  const stageRect=wordGridStage?.getBoundingClientRect();
  const rect=el?.getBoundingClientRect();
  if(!stageRect||!rect)return null;
  return{
    x:rect.left-stageRect.left+rect.width/2,
    y:rect.top-stageRect.top+rect.height/2
  };
}
function snappedBogglePoints(coords,pointerTail=null){
  const points=(coords||[]).map(([r,c])=>boggleCellCenter(r,c)).filter(Boolean);
  if(pointerTail&&points.length){
    const lastCoord=coords[coords.length-1];
    const lastCenter=points[points.length-1];
    const target=pointInBoggleStage(pointerTail.clientX,pointerTail.clientY);
    if(target&&lastCoord){
      const dx=target.x-lastCenter.x;
      const dy=target.y-lastCenter.y;
      const angle=Math.atan2(dy,dx);
      const octant=Math.round(angle/(Math.PI/4));
      const snappedAngle=octant*(Math.PI/4);
      const len=Math.hypot(dx,dy);
      if(len>4){
        points.push({
          x:lastCenter.x+Math.cos(snappedAngle)*len,
          y:lastCenter.y+Math.sin(snappedAngle)*len
        });
      }
    }
  }
  return points;
}

function drawCanvasPath(ctx,points,color,width,alpha=1){
  if(!ctx||!points?.length)return;
  ctx.save();
  ctx.globalAlpha=alpha;
  ctx.strokeStyle=color;
  ctx.lineWidth=width;
  ctx.lineCap='round';
  ctx.lineJoin='round';
  ctx.beginPath();
  ctx.moveTo(points[0].x,points[0].y);
  for(let i=1;i<points.length;i++)ctx.lineTo(points[i].x,points[i].y);
  ctx.stroke();
  ctx.restore();
}
function renderBoggleCanvas(){
  if(!boggleCanvas||state.mode!=='boggle')return;
  sizeBoggleCanvas();
  const rect=wordGridStage.getBoundingClientRect();
  const ctx=boggleCanvas.getContext('2d');
  if(!ctx)return;
  ctx.clearRect(0,0,rect.width,rect.height);

  [...state.bogglePaths.entries()].forEach(([index,path])=>{
    drawCanvasPath(ctx,snappedBogglePoints(path.coords),BOGGLE_LINE_COLORS[index%BOGGLE_LINE_COLORS.length],11,.72);
  });
  if(state.drag?.coords?.length){
    drawCanvasPath(ctx,snappedBogglePoints(state.drag.coords,state.drag.pointer),'#e75e9f',12,.86);
  }
}
function rememberBogglePath(index,coords){
  state.bogglePaths.set(index,{coords:coords.map(([r,c])=>[r,c])});
  renderBoggleCanvas();
}

function generateBoggle(pool){
  const candidates=shuffle(pool.filter(x=>{
    const raw=txt(x.display);
    return x.ko&&/^[A-Za-z]+$/.test(raw)&&x.clean.length>=3&&x.clean.length<=7;
  }));

  for(let attempt=0;attempt<100;attempt++){
    const board=Array.from({length:BOGGLE_SIZE},()=>Array(BOGGLE_SIZE).fill(''));
    const placements=[];
    const chosen=shuffle(candidates).slice(0,Math.min(60,candidates.length));

    for(const entry of chosen){
      if(placements.length>=BOGGLE_TARGET)break;
      const placed=bogglePlaceWord(board,entry);
      if(placed)placements.push(placed);
    }
    if(placements.length<6)continue;

    fillGrid(board);
    return{grid:board,size:BOGGLE_SIZE,placements};
  }
  throw new Error('I could not build a Boggle board from this vocabulary. Try a new puzzle.');
}
function renderBoggle(){
  state.found.clear();
  state.gimmes.clear();
  clearBoggleCanvas();
  state.drag=null;
  state.sessionId=crypto.randomUUID?.()||('boggle-'+Date.now());
  state.startedAt=new Date().toISOString();

  gridEl.classList.add('boggle-grid');
  if(boggleCanvas)boggleCanvas.hidden=false;
  gridEl.style.setProperty('--size',state.size);
  gridEl.innerHTML='';
  for(let r=0;r<state.size;r++)for(let c=0;c<state.size;c++){
    const cell=document.createElement('button');
    cell.type='button';cell.className='cell boggle-cell';
    const letter=document.createElement('span');
    letter.className='boggle-letter';
    letter.textContent=state.grid[r][c];
    cell.appendChild(letter);
    cell.dataset.row=r;cell.dataset.col=c;cell.setAttribute('role','gridcell');
    gridEl.appendChild(cell);
  }

  wordListEl.innerHTML=state.placements.map((p,i)=>
    '<div class="word-chip boggle-target" data-word-index="'+i+'">'+
      '<strong>'+escapeHtml(p.ko||'단어')+'</strong>'+
      '<small>'+p.clean.length+' letters</small>'+
    '</div>'
  ).join('');
  updateProgress();
  requestAnimationFrame(renderBoggleCanvas);
}
function isAdjacentCoord(a,b){
  if(!a||!b)return false;
  const dr=Math.abs(a[0]-b[0]),dc=Math.abs(a[1]-b[1]);
  return dr<=1&&dc<=1&&(dr+dc)>0;
}
function boggleBegin(point,pointer){
  state.drag={coords:[[point.row,point.col]],pointer};
  preview(state.drag.coords);
  renderBoggleCanvas();
}
function boggleMove(point,pointer){
  if(!state.drag)return;

  state.drag.pointer=pointer;

  const coords=state.drag.coords;
  const last=coords[coords.length-1];
  if(!last){renderBoggleCanvas();return}

  const next=[point.row,point.col];
  if(next[0]===last[0]&&next[1]===last[1]){
    renderBoggleCanvas();return;
  }

  const prev=coords.length>1?coords[coords.length-2]:null;
  if(prev&&next[0]===prev[0]&&next[1]===prev[1]){
    coords.pop();
    preview(coords);
    renderBoggleCanvas();
    return;
  }

  if(coords.some(([r,c])=>r===next[0]&&c===next[1])){
    renderBoggleCanvas();return;
  }
  if(!isAdjacentCoord(last,next)){
    renderBoggleCanvas();return;
  }

  coords.push(next);
  preview(coords);
  renderBoggleCanvas();
}
async function boggleEnd(originEl){
  const coords=(state.drag?.coords||[]).map(([r,c])=>[r,c]);
  state.drag=null;clearPreview();
  renderBoggleCanvas();
  if(coords.length<3)return;
  const letters=coords.map(([r,c])=>txt(cellAt(r,c)?.textContent).toUpperCase()).join('');
  const index=state.placements.findIndex((p,i)=>!state.found.has(i)&&p.clean===letters);
  if(index<0){
    playStudentSfx('wrong');
    return;
  }
  rememberBogglePath(index,coords);
  await markFound(index,originEl,coords);
}

function renderMixMatch(pool){
  const candidates=shuffle(pool.filter(x=>x.ko&&x.clean.length>=2)).slice(0,Math.min(MIX_MATCH_TARGET,pool.length));
  if(candidates.length<4)throw new Error('Not enough vocabulary for Mix & Match yet.');
  state.placements=candidates;
  state.found.clear();
  state.gimmes.clear();
  state.matchFirst=null;
  state.matchLocked=false;
  state.sessionId=crypto.randomUUID?.()||('mixmatch-'+Date.now());
  state.startedAt=new Date().toISOString();

  const cards=shuffle(candidates.flatMap((p,i)=>[
    {pair:i,type:'en',text:p.display},
    {pair:i,type:'ko',text:p.ko}
  ]));
  mixMatchGrid.innerHTML=cards.map(card=>
    '<button type="button" class="mix-card '+card.type+'" data-pair="'+card.pair+'" data-side="'+card.type+'" role="gridcell" aria-label="Hidden match card" aria-pressed="false">'+
      '<span class="mix-card-inner">'+
        '<span class="mix-card-face mix-card-back" aria-hidden="true"><span class="mix-card-mark">?</span></span>'+
        '<span class="mix-card-face mix-card-front"><span>'+escapeHtml(card.text)+'</span></span>'+
      '</span>'+
    '</button>'
  ).join('');
  updateProgress();
}

async function chooseMatchCard(card){
  if(state.mode!=='mixmatch'||state.matchLocked||card.classList.contains('matched')||card===state.matchFirst)return;
  card.classList.add('selected','flipped');
  card.setAttribute('aria-pressed','true');
  card.setAttribute('aria-label',txt(card.querySelector('.mix-card-front')?.textContent)||'Revealed match card');
  if(!state.matchFirst){state.matchFirst=card;return}

  const first=state.matchFirst;
  state.matchFirst=null;
  if(first.dataset.pair===card.dataset.pair&&first.dataset.side!==card.dataset.side){
    const index=Number(card.dataset.pair);
    first.classList.remove('selected');card.classList.remove('selected');
    first.classList.add('matched','flipped');card.classList.add('matched','flipped');
    first.setAttribute('aria-pressed','true');card.setAttribute('aria-pressed','true');
    state.found.add(index);
    updateProgress();
    playStudentSfx('correct');
    showPointAward({amount:POINTS_PER_WORD,origin:capturePointOrigin(card)});
    if(state.found.size===state.placements.length)await finishPuzzle();
    return;
  }

  state.matchLocked=true;
  playStudentSfx('wrong');
  first.classList.add('wrong');card.classList.add('wrong');
  setTimeout(()=>{
    first.classList.remove('selected','wrong','flipped');
    card.classList.remove('selected','wrong','flipped');
    first.setAttribute('aria-pressed','false');
    card.setAttribute('aria-pressed','false');
    first.setAttribute('aria-label','Hidden match card');
    card.setAttribute('aria-label','Hidden match card');
    state.matchLocked=false;
  },850);
}

function renderPuzzle(){
  gridEl.classList.remove('boggle-grid');
  clearBoggleCanvas();
  if(boggleCanvas)boggleCanvas.hidden=true;
  state.found.clear();
  state.gimmes.clear();
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
function earnedPuzzlePoints(){
  return Math.max(0,(state.found.size-state.gimmes.size)*POINTS_PER_WORD);
}
function puzzleStarCap(){
  if(state.mode!=='wordsearch')return 5;
  return state.gridSize===8?3:(state.gridSize===10?4:5);
}
function earnedPuzzleStars(){
  return Math.max(0,puzzleStarCap()-state.gimmes.size);
}
function updateProgress(){
  const verb=state.mode==='crossword'?'solved':(state.mode==='mixmatch'?'matched':'found');
  progressEl.textContent=state.found.size+' / '+state.placements.length+' '+verb;
  sessionPointsEl.textContent='+'+earnedPuzzlePoints()+' pts';
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
}function boggleCellFromPointer(clientX,clientY){
  const cells=[...gridEl.querySelectorAll('.cell')];
  if(!cells.length)return null;

  let best=null,bestDist=Infinity;
  for(const el of cells){
    const rect=el.getBoundingClientRect();
    const cx=rect.left+rect.width/2;
    const cy=rect.top+rect.height/2;
    const radius=Math.min(rect.width,rect.height)*0.24;
    const d=Math.hypot(clientX-cx,clientY-cy);

    // Only the small center area around the letter counts as a hit.
    if(d>radius)continue;
    if(d<bestDist){
      bestDist=d;
      best={row:Number(el.dataset.row),col:Number(el.dataset.col),el};
    }
  }
  return best;
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
async function markFound(index,originEl,selectedCoords=null){
  if(state.found.has(index))return;
  state.found.add(index);
  const placement=state.placements[index];
  const paintCoords=selectedCoords||placement.coords;
  paintCoords.forEach(([r,c])=>cellAt(r,c)?.classList.add('found'));
  const chip=wordListEl.querySelector('[data-word-index="'+index+'"]');
  chip?.classList.add('found','just-found');
  chip?.scrollIntoView?.({behavior:'smooth',block:'nearest',inline:'center'});
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
  const points=earnedPuzzlePoints();
  const stars=earnedPuzzleStars();
  const completeLabel=state.mode==='crossword'?'Crossword complete!':(state.mode==='boggle'?'Boggle complete!':(state.mode==='mixmatch'?'Mix & Match complete!':'Word search complete!'));
  completePoints.textContent=completeLabel+' You earned '+stars+' star'+(stars===1?'':'s')+'.';
  rewardCelebration.innerHTML=
    '<student-reward-celebration percent="100" stars="'+stars+'" star-max="5" points="'+points+'" label="PUZZLE REWARD"></student-reward-celebration>';
  if(typeof completeCard.showModal==='function')completeCard.showModal();
  else completeCard.setAttribute('open','');
  await saveReward();
}
async function resolvePuzzleRewardContext(){
  if(state.rewardContext)return state.rewardContext;
  const book=state.books[0];
  if(!book?.book_id)throw new Error('No assigned book available for puzzle rewards.');
  const units=await content('content_units?select=id,unit_number&book_id=eq.'+
    encodeURIComponent(book.book_id)+'&status=in.(review,published)&order=unit_number.asc&limit=1');
  const unit=units[0];
  if(!unit?.id)throw new Error('No assigned unit available for puzzle rewards.');
  state.rewardContext={book_id:book.book_id,unit_id:unit.id};
  return state.rewardContext;
}
async function saveReward(){
  if(state.saving||!state.sessionId)return;
  state.saving=true;
  const points=earnedPuzzlePoints();
  const stars=earnedPuzzleStars();
  try{
    const ctx=await resolvePuzzleRewardContext();

    if(points>0){
      const pointPayload={
        session_id:state.sessionId,
        client_attempt_id:crypto.randomUUID?.()||('puzzle-points-'+Date.now()),
        book_id:ctx.book_id,
        unit_id:ctx.unit_id,
        skill:'puzzle',
        response_type:'completion',
        activity_id:state.mode+'-completion',
        content_type:'puzzle',
        is_correct:true,
        score:1,
        study_context:'independent',
        metadata:{points_override:points,puzzle_mode:state.mode,gimmes_used:state.gimmes.size}
      };
      await apiJson('/.netlify/functions/progress_summary?section=study_attempt&_='+Date.now(),{
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({payload:pointPayload})
      });
    }

    const listBase=state.mode==='crossword'?'Crossword':(state.mode==='boggle'?'Boggle':(state.mode==='mixmatch'?'Mix & Match':'Word Search'));
    const payload={
      reward_only:true,
      session_id:state.sessionId,
      client_attempt_id:crypto.randomUUID?.()||((state.mode||'wordsearch')+'-reward-'+Date.now()),
      book_id:ctx.book_id,
      unit_id:ctx.unit_id,
      skill:'puzzle',
      response_type:'reward',
      activity_id:state.mode,
      reward_mode:state.mode,
      reward_list_name:listBase+' · '+state.sessionId,
      reward_list_size:state.placements.length,
      reward_started_at:state.startedAt,
      reward_summary:{
        completed:true,stars,accuracy:1,percent:100,
        score:state.placements.length-state.gimmes.size,total:state.placements.length,
        points_earned:points,book_id:ctx.book_id,unit_id:ctx.unit_id,
        assignment_id:null,session_source:'student',vocab_mode:state.mode,
        reward_scheme:(state.mode||'wordsearch')+'-v2',star_cap:puzzleStarCap(),
        gimmes_used:state.gimmes.size
      }
    };
    await apiJson('/.netlify/functions/progress_summary?section=study_attempt&_='+Date.now(),{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({payload})
    });
    window.dispatchEvent(new CustomEvent('session:ended',{detail:{session_id:state.sessionId,mode:state.mode,list_size:state.placements.length}}));
    window.dispatchEvent(new CustomEvent('stars:refresh',{detail:{earned:stars}}));
    window.dispatchEvent(new CustomEvent('points:refresh',{detail:{earned:points}}));
    try{localStorage.setItem('stars:refresh',String(Date.now()))}catch(_){}
  }catch(error){
    console.warn('[Word Games] reward save failed',error);
  }finally{state.saving=false}
}

function makeCrossword(pool){
  const candidates=shuffle(pool.filter(x=>{
    const raw=txt(x.display);
    return x.ko&&/^[A-Za-z]+$/.test(raw)&&x.clean.length>=3&&x.clean.length<=10;
  }));
  const SIZE=19;
  const target=Math.min(8,candidates.length);

  function newBoard(){
    return Array.from({length:SIZE},()=>Array.from({length:SIZE},()=>null));
  }
  function put(board,word,row,col,dr,dc){
    const coords=[];
    for(let i=0;i<word.length;i++){
      const r=row+dr*i,c=col+dc*i;
      if(!board[r][c])board[r][c]={letter:word[i],dirs:new Set()};
      board[r][c].dirs.add(dr===0?'A':'D');
      coords.push([r,c]);
    }
    return coords;
  }
  function validPlacement(board,word,row,col,dr,dc){
    const er=row+dr*(word.length-1),ec=col+dc*(word.length-1);
    if(row<0||col<0||er<0||ec<0||er>=SIZE||ec>=SIZE)return false;

    const beforeR=row-dr,beforeC=col-dc,afterR=er+dr,afterC=ec+dc;
    if(beforeR>=0&&beforeR<SIZE&&beforeC>=0&&beforeC<SIZE&&board[beforeR][beforeC])return false;
    if(afterR>=0&&afterR<SIZE&&afterC>=0&&afterC<SIZE&&board[afterR][afterC])return false;

    const dir=dr===0?'A':'D';
    const perpendicular=dr===0?'D':'A';
    let crossings=0;

    for(let i=0;i<word.length;i++){
      const r=row+dr*i,c=col+dc*i,cell=board[r][c];
      if(cell){
        if(cell.letter!==word[i])return false;
        if(cell.dirs.has(dir))return false;
        if(!cell.dirs.has(perpendicular))return false;
        crossings++;
        if(crossings>1)return false;
      }else{
        if(dr===0){
          if((r>0&&board[r-1][c])||(r<SIZE-1&&board[r+1][c]))return false;
        }else{
          if((c>0&&board[r][c-1])||(c<SIZE-1&&board[r][c+1]))return false;
        }
      }
    }
    return crossings===1;
  }

  for(let attempt=0;attempt<140;attempt++){
    const board=newBoard();
    const placed=[];
    const first=candidates[attempt%candidates.length];
    if(!first)break;
    const row=Math.floor(SIZE/2),col=Math.floor((SIZE-first.clean.length)/2);
    const firstCoords=put(board,first.clean,row,col,0,1);
    placed.push({...first,row,col,dr:0,dc:1,coords:firstCoords,direction:'Across'});

    for(const entry of shuffle(candidates.filter(x=>x.id!==first.id))){
      if(placed.length>=target)break;
      const options=[];
      for(const existing of placed){
        const dr=existing.dr===0?1:0,dc=existing.dr===0?0:1;
        for(let ei=0;ei<existing.clean.length;ei++){
          const crossR=existing.row+existing.dr*ei;
          const crossC=existing.col+existing.dc*ei;
          for(let ni=0;ni<entry.clean.length;ni++){
            if(existing.clean[ei]!==entry.clean[ni])continue;
            const sr=crossR-dr*ni,sc=crossC-dc*ni;
            if(validPlacement(board,entry.clean,sr,sc,dr,dc)){
              options.push({sr,sc,dr,dc});
            }
          }
        }
      }
      if(!options.length)continue;
      const chosen=shuffle(options)[0];
      const coords=put(board,entry.clean,chosen.sr,chosen.sc,chosen.dr,chosen.dc);
      placed.push({
        ...entry,row:chosen.sr,col:chosen.sc,dr:chosen.dr,dc:chosen.dc,coords,
        direction:chosen.dr===0?'Across':'Down'
      });
    }

    if(placed.length<6)continue;

    let minR=SIZE,maxR=0,minC=SIZE,maxC=0;
    placed.forEach(p=>p.coords.forEach(([r,c])=>{
      minR=Math.min(minR,r);maxR=Math.max(maxR,r);minC=Math.min(minC,c);maxC=Math.max(maxC,c);
    }));

    const startMap=new Map(),cells=new Map();
    placed.forEach((p,i)=>{
      const startKey=p.row+','+p.col;
      if(!startMap.has(startKey))startMap.set(startKey,[]);
      startMap.get(startKey).push(i);
      p.coords.forEach(([r,c],letterIndex)=>{
        const key=r+','+c;
        if(!cells.has(key))cells.set(key,{r,c,solution:p.clean[letterIndex],words:[]});
        cells.get(key).words.push(i);
      });
    });
    const starts=[...startMap.keys()].map(k=>k.split(',').map(Number)).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
    const numberFor=new Map(starts.map((rc,i)=>[rc.join(','),i+1]));
    placed.forEach(p=>{
      p.number=numberFor.get(p.row+','+p.col);
      const types=['scramble','audio','korean'];
      p.hintType=types[Math.floor(Math.random()*types.length)];
      p.hintText=p.hintType==='scramble'?scrambleLetters(p.clean):(p.hintType==='korean'?p.ko:'▶ Play word');
    });
    return{placed,cells,minR,maxR,minC,maxC};
  }
  throw new Error('I could not build a clean crossword from these words. Try a new puzzle.');
}

function gameHelpSeenKey(mode=state.mode){
  const id=txt(state.auth?.user_id||state.auth?.id||state.auth?.student_id||'browser');
  return 'word-games-help-seen:'+mode+':'+id;
}
function markGameHelpSeen(mode=state.mode){
  try{localStorage.setItem(gameHelpSeenKey(mode),'1')}catch(_){}
}
function openGameHelp({mode=state.mode,markSeen=true}={}){
  const dialog=$('gameHelpDialog');
  if(!dialog)return;
  if(markSeen)markGameHelpSeen(mode);

  dialog.querySelectorAll('[data-help-mode]').forEach(panel=>{
    panel.hidden=panel.dataset.helpMode!==mode;
  });
  const kicker=$('gameHelpKicker');
  if(kicker)kicker.textContent=mode==='crossword'?'CROSSWORD':(mode==='boggle'?'BOGGLE':(mode==='mixmatch'?'MIX & MATCH':'WORD SEARCH'));

  try{
    if(typeof dialog.showModal==='function'){
      if(!dialog.open)dialog.showModal();
    }else{
      dialog.setAttribute('open','');
    }
  }catch(error){
    console.warn('[Word Games] help dialog fallback',error);
    dialog.setAttribute('open','');
  }
}
function closeGameHelp(){
  const dialog=$('gameHelpDialog');
  if(!dialog)return;
  try{
    if(typeof dialog.close==='function'&&dialog.open)dialog.close();
    else dialog.removeAttribute('open');
  }catch(_){
    dialog.removeAttribute('open');
  }
}
function maybeShowFirstGameHelp(mode=state.mode){
  let seen=false;
  try{seen=localStorage.getItem(gameHelpSeenKey(mode))==='1'}catch(_){}
  if(!seen)setTimeout(()=>openGameHelp({mode,markSeen:true}),180);
}


function snapshotCurrentMode(){
  if(!state.mode||!state.sessionId)return;
  if(state.drag){
    state.drag=null;
    clearPreview();
  }
  const snap={
    mode:state.mode,
    gridSize:state.gridSize,
    grid:state.grid.map(row=>row.slice()),
    size:state.size,
    placements:state.placements,
    found:[...state.found],
    gimmes:[...state.gimmes],
    bogglePaths:[...state.bogglePaths.entries()].map(([k,v])=>[k,{coords:v.coords.map(rc=>rc.slice())}]),
    sessionId:state.sessionId,
    startedAt:state.startedAt,
    activeCrossword:state.activeCrossword,
    crosswordCursor:state.crosswordCursor,
    gridHtml:gridEl.innerHTML,
    gridClass:gridEl.className,
    gridSizeStyle:gridEl.style.getPropertyValue('--size'),
    wordListHtml:wordListEl.innerHTML,
    crosswordHtml:crosswordGridEl.innerHTML,
    crosswordCols:crosswordGridEl.style.getPropertyValue('--cw-cols'),
    mixHtml:mixMatchGrid?.innerHTML||''
  };
  state.modeSnapshots.set(state.mode,snap);
}

function restoreModeSnapshot(mode){
  const snap=state.modeSnapshots.get(mode);
  if(!snap)return false;
  state.mode=mode;
  state.gridSize=snap.gridSize||state.gridSize;
  state.grid=(snap.grid||[]).map(row=>row.slice());
  state.size=snap.size;
  state.placements=snap.placements||[];
  state.found=new Set(snap.found||[]);
  state.gimmes=new Set(snap.gimmes||[]);
  state.bogglePaths=new Map((snap.bogglePaths||[]).map(([k,v])=>[k,{coords:(v.coords||[]).map(rc=>rc.slice())}]));
  state.sessionId=snap.sessionId;
  state.startedAt=snap.startedAt;
  state.activeCrossword=snap.activeCrossword;
  state.crosswordCursor=snap.crosswordCursor||0;
  state.drag=null;
  state.matchLocked=false;

  gridEl.className=snap.gridClass||'word-grid';
  gridEl.innerHTML=snap.gridHtml||'';
  gridEl.style.setProperty('--size',snap.gridSizeStyle||state.size||GRID_TARGET);
  wordListEl.innerHTML=snap.wordListHtml||'';
  crosswordGridEl.innerHTML=snap.crosswordHtml||'';
  if(snap.crosswordCols)crosswordGridEl.style.setProperty('--cw-cols',snap.crosswordCols);
  if(mixMatchGrid)mixMatchGrid.innerHTML=snap.mixHtml||'';

  state.matchFirst=state.mode==='mixmatch'?mixMatchGrid?.querySelector('.mix-card.selected.flipped')||null:null;
  document.querySelectorAll('[data-grid-size]').forEach(btn=>{
    btn.classList.toggle('active',Number(btn.dataset.gridSize)===state.gridSize);
  });
  setModeUI();
  updateProgress();
  showGame();
  if(state.mode==='boggle')requestAnimationFrame(renderBoggleCanvas);
  return true;
}

function clearModeSnapshot(mode=state.mode){
  state.modeSnapshots.delete(mode);
}

function setModeUI(){
document.querySelectorAll('.puzzle-tab').forEach(btn=>{
    const active=btn.dataset.mode===state.mode;
    btn.classList.toggle('active',active);
    btn.setAttribute('aria-selected',active?'true':'false');
  });

  const isCrossword=state.mode==='crossword';
  const isBoggle=state.mode==='boggle';
  const isWordSearch=state.mode==='wordsearch';
  const isMixMatch=state.mode==='mixmatch';
  wordGridStage?.classList.toggle('is-boggle',isBoggle);
  wordGridStage?.classList.toggle('is-wordsearch',isWordSearch);
  modeLabel.textContent=isCrossword?'CROSSWORD':(isBoggle?'BOGGLE':(isMixMatch?'MIX & MATCH':'WORD SEARCH'));
  listEyebrow.textContent=isCrossword?'CLUES':(isBoggle?'FIND WORDS':'FIND THESE');
  listTitle.textContent=isCrossword?'Crossword':(isBoggle?'Meanings':'Words');

  wordGridStage.hidden=isCrossword||isMixMatch;
  gridEl.hidden=isCrossword||isMixMatch;
  crosswordGridEl.hidden=!isCrossword;
  mixMatchGrid.hidden=!isMixMatch;
  clueStripWrap.hidden=isMixMatch;
  wordSearchSizeControl.hidden=!isWordSearch;
  if(boggleCanvas)boggleCanvas.hidden=!isBoggle;
  if(crosswordEntry)crosswordEntry.disabled=!isCrossword;
  if(gameHelpBtn)gameHelpBtn.hidden=false;

  dragHint.textContent=isCrossword
    ?'Tap a clue, then type the English word.'
    :(isBoggle?'Drag through touching letters. Diagonals are allowed.':(isMixMatch?'Match each English word with its Korean meaning.':'Drag in a straight line ↔ ↕ ↗ ↘'));
}

function renderCrossword(cw){
  state.found.clear();
  state.gimmes.clear();
  state.drag=null;
  state.activeCrossword=null;
  state.sessionId=crypto.randomUUID?.()||('crossword-'+Date.now());
  state.startedAt=new Date().toISOString();
  state.placements=cw.placed;

  const rows=cw.maxR-cw.minR+1,cols=cw.maxC-cw.minC+1;
  crosswordGridEl.style.setProperty('--cw-cols',cols);
  crosswordGridEl.innerHTML='';
  const startNums=new Map(state.placements.map(p=>[p.row+','+p.col,p.number]));
  for(let r=cw.minR;r<=cw.maxR;r++){
    for(let c=cw.minC;c<=cw.maxC;c++){
      const info=cw.cells.get(r+','+c);
      const cell=document.createElement('div');
      cell.className='cw-cell'+(info?'':' block');
      if(info){
        cell.dataset.row=r;cell.dataset.col=c;
        cell.dataset.words=info.words.join(',');
        const num=startNums.get(r+','+c);
        if(num){
          const n=document.createElement('span');n.className='cw-number';n.textContent=num;cell.appendChild(n);
        }
        const letter=document.createElement('span');
        letter.className='cw-letter';
        letter.dataset.solution=info.solution;
        letter.textContent='';
        cell.appendChild(letter);
      }
      crosswordGridEl.appendChild(cell);
    }
  }

  const ordered=state.placements.map((p,i)=>({...p,index:i})).sort((a,b)=>a.number-b.number||a.direction.localeCompare(b.direction));
  wordListEl.innerHTML=ordered.map(p=>{
    const arrow=p.direction==='Across'?'→':'↓';
    return '<div class="crossword-clue hint-'+p.hintType+'" data-word-index="'+p.index+'" data-hint-type="'+p.hintType+'">'+
      '<button type="button" class="crossword-clue-main" data-clue-word="'+p.index+'">'+
        '<strong>'+p.number+' '+arrow+'</strong>'+
        '<span>'+escapeHtml(p.hintText)+'</span>'+
      '</button>'+
      '<button type="button" class="gimme-btn" data-gimme-word="'+p.index+'">Gimme</button>'+
    '</div>';
  }).join('');
  updateProgress();
  setModeUI();
  activateCrosswordWord(ordered[0]?.index??0,{focus:false});
}

function crosswordCell(row,col){
  return crosswordGridEl.querySelector('.cw-cell[data-row="'+row+'"][data-col="'+col+'"]');
}
function crosswordLetter(row,col){
  return crosswordCell(row,col)?.querySelector('.cw-letter');
}
function cellLetter(row,col){
  return txt(crosswordLetter(row,col)?.textContent).toUpperCase();
}
function setCellLetter(row,col,value){
  const el=crosswordLetter(row,col);
  if(el)el.textContent=txt(value).toUpperCase().replace(/[^A-Z]/g,'').slice(0,1);
}
function firstEditableIndex(p){
  const empty=p.coords.findIndex(([r,c])=>!cellLetter(r,c));
  return empty>=0?empty:0;
}
function systemKeyboardInset(){
  const vv=window.visualViewport;
  if(!vv)return 0;
  return Math.max(0,Math.round(window.innerHeight-vv.height-vv.offsetTop));
}
function updateSystemKeyboardSpace(){
  const inset=systemKeyboardInset();
  document.documentElement.style.setProperty('--system-keyboard-inset',inset+'px');
  document.body.classList.toggle('system-kb-open',inset>120);
}
function keepActiveCrosswordVisible({smooth=true}={}){
  if(state.mode!=='crossword'||!Number.isFinite(state.activeCrossword))return;
  const p=state.placements[state.activeCrossword];
  if(!p)return;
  const coord=p.coords[Math.min(state.crosswordCursor,p.coords.length-1)];
  const cell=coord?crosswordCell(...coord):null;
  if(!cell)return;

  const vv=window.visualViewport;
  const viewTop=(vv?.offsetTop||0)+90;
  const viewHeight=vv?.height||window.innerHeight;
  const targetY=(vv?.offsetTop||0)+Math.max(130,viewHeight*.38);
  const rect=cell.getBoundingClientRect();
  const cellCenter=rect.top+rect.height/2;
  const delta=cellCenter-targetY;

  if(Math.abs(delta)>24){
    window.scrollBy({top:delta,behavior:smooth?'smooth':'auto'});
  }
}
function onViewportKeyboardChange(){
  updateSystemKeyboardSpace();
  if(document.activeElement===crosswordEntry&&systemKeyboardInset()>120){
    requestAnimationFrame(()=>keepActiveCrosswordVisible({smooth:false}));
  }
}

function focusCrosswordKeyboard(){
  if(state.mode!=='crossword'||!crosswordEntry)return;
  try{
    crosswordEntry.value='';
    crosswordEntry.focus({preventScroll:true});
  }catch(_){
    try{crosswordEntry.focus()}catch(__){}
  }
  setTimeout(()=>{
    updateSystemKeyboardSpace();
    keepActiveCrosswordVisible({smooth:true});
  },120);
  setTimeout(()=>keepActiveCrosswordVisible({smooth:false}),320);
}
function activateCrosswordWord(index,{focus=true}={}){
  if(!state.placements[index])return;
  state.activeCrossword=index;
  const p=state.placements[index];
  state.crosswordCursor=firstEditableIndex(p);

  crosswordGridEl.querySelectorAll('.cw-cell.active,.cw-cell.cursor').forEach(x=>x.classList.remove('active','cursor'));
  wordListEl.querySelectorAll('.crossword-clue.active').forEach(x=>x.classList.remove('active'));
  p.coords.forEach(([r,c])=>crosswordCell(r,c)?.classList.add('active'));
  const cursorCoord=p.coords[Math.min(state.crosswordCursor,p.coords.length-1)];
  if(cursorCoord)crosswordCell(...cursorCoord)?.classList.add('cursor');

  const activeClue=wordListEl.querySelector('[data-word-index="'+index+'"]');
  activeClue?.classList.add('active');
  activeClue?.scrollIntoView?.({behavior:'smooth',block:'nearest',inline:'center'});
  if(focus)focusCrosswordKeyboard();
}
function moveCrosswordCursor(delta){
  const p=state.placements[state.activeCrossword];
  if(!p)return;
  state.crosswordCursor=Math.max(0,Math.min(p.coords.length-1,state.crosswordCursor+delta));
  crosswordGridEl.querySelectorAll('.cw-cell.cursor').forEach(x=>x.classList.remove('cursor'));
  const coord=p.coords[state.crosswordCursor];
  if(coord)crosswordCell(...coord)?.classList.add('cursor');
  if(document.activeElement===crosswordEntry&&systemKeyboardInset()>120){
    requestAnimationFrame(()=>keepActiveCrosswordVisible({smooth:false}));
  }
}
async function checkCrosswordWord(index,origin){
  if(state.found.has(index))return;
  const p=state.placements[index];
  const solved=p.coords.every(([r,c],i)=>cellLetter(r,c)===p.clean[i]);
  if(!solved)return;
  state.found.add(index);
  p.coords.forEach(([r,c])=>crosswordCell(r,c)?.classList.add('solved'));
  const clue=wordListEl.querySelector('.crossword-clue[data-word-index="'+index+'"]');
  clue?.classList.add('found');
  updateProgress();
  playStudentSfx('correct');
  showPointAward({amount:POINTS_PER_WORD,origin:capturePointOrigin(origin||clue)});
  if(state.found.size===state.placements.length)await finishPuzzle();
}
function writeCrosswordLetter(letter){
  const index=state.activeCrossword;
  const p=state.placements[index];
  if(!p||state.found.has(index))return;
  const coord=p.coords[state.crosswordCursor];
  if(!coord)return;
  setCellLetter(...coord,letter);
  checkCrosswordWord(index,crosswordEntry);
  if(state.crosswordCursor<p.coords.length-1)moveCrosswordCursor(1);
}
function eraseCrosswordLetter(){
  const p=state.placements[state.activeCrossword];
  if(!p||state.found.has(state.activeCrossword))return;
  const coord=p.coords[state.crosswordCursor];
  if(coord&&cellLetter(...coord)){
    setCellLetter(...coord,'');
    return;
  }
  if(state.crosswordCursor>0){
    moveCrosswordCursor(-1);
    const prev=p.coords[state.crosswordCursor];
    if(prev)setCellLetter(...prev,'');
  }
}
async function useCrosswordGimme(index,origin){
  if(state.mode!=='crossword'||state.found.has(index))return;
  const p=state.placements[index];
  if(!p)return;
  state.gimmes.add(index);
  p.coords.forEach(([r,c],i)=>{
    setCellLetter(r,c,p.clean[i]);
    crosswordCell(r,c)?.classList.add('solved','gimme');
  });
  state.found.add(index);
  const clue=wordListEl.querySelector('.crossword-clue[data-word-index="'+index+'"]');
  clue?.classList.add('found','used-gimme');
  updateProgress();
  playStudentSfx('correct');
  if(state.found.size===state.placements.length)await finishPuzzle();
}
function wireCrossword(){
  wordListEl.addEventListener('click',e=>{
    const gimme=e.target.closest('[data-gimme-word]');
    if(gimme){
      e.stopPropagation();
      useCrosswordGimme(Number(gimme.dataset.gimmeWord),gimme);
      return;
    }
    const main=e.target.closest('[data-clue-word]');
    if(!main)return;
    const index=Number(main.dataset.clueWord);
    const clue=main.closest('.crossword-clue');
    activateCrosswordWord(index);
    const p=state.placements[index];
    if(clue?.dataset.hintType==='audio'&&p)speakHintWord(p.display);
  });

  crosswordGridEl.addEventListener('pointerdown',e=>{
    const cell=e.target.closest('.cw-cell');
    if(!cell||cell.classList.contains('block'))return;
    e.preventDefault();
    const words=txt(cell.dataset.words).split(',').map(Number).filter(Number.isFinite);
    const pick=words.includes(state.activeCrossword)?state.activeCrossword:words[0];
    if(!Number.isFinite(pick))return;
    activateCrosswordWord(pick,{focus:false});
    const p=state.placements[pick];
    const pos=p.coords.findIndex(([r,c])=>r===Number(cell.dataset.row)&&c===Number(cell.dataset.col));
    if(pos>=0)state.crosswordCursor=pos;
    crosswordGridEl.querySelectorAll('.cw-cell.cursor').forEach(x=>x.classList.remove('cursor'));
    cell.classList.add('cursor');
    focusCrosswordKeyboard();
  });

  crosswordEntry?.addEventListener('beforeinput',e=>{
    if(state.mode!=='crossword')return;
    if(e.inputType==='deleteContentBackward'){
      e.preventDefault();
      eraseCrosswordLetter();
      crosswordEntry.value='';
    }
  });
  crosswordEntry?.addEventListener('input',e=>{
    if(state.mode!=='crossword')return;
    const letters=txt(e.target.value).toUpperCase().replace(/[^A-Z]/g,'');
    e.target.value='';
    if(!letters)return;
    for(const ch of letters)writeCrosswordLetter(ch);
  });
  crosswordEntry?.addEventListener('keydown',e=>{
    if(state.mode!=='crossword')return;
    if(e.key==='Backspace'){
      e.preventDefault();
      eraseCrosswordLetter();
      crosswordEntry.value='';
    }else if(e.key==='ArrowLeft'||e.key==='ArrowUp'){
      e.preventDefault();moveCrosswordCursor(-1);
    }else if(e.key==='ArrowRight'||e.key==='ArrowDown'){
      e.preventDefault();moveCrosswordCursor(1);
    }
  });
}

function wireGrid(){
  gridEl.addEventListener('pointerdown',e=>{
    const point=pointToCell(e.clientX,e.clientY);if(!point)return;
    e.preventDefault();gridEl.setPointerCapture?.(e.pointerId);
    if(state.mode==='boggle')boggleBegin(point,e);
    else beginDrag(point);
  });
  gridEl.addEventListener('pointermove',e=>{
    if(!state.drag)return;
    if(state.mode==='boggle'){
      const point=boggleCellFromPointer(e.clientX,e.clientY);
      state.drag.pointer=e;
      if(point)boggleMove(point,e);
      else renderBoggleCanvas();
      return;
    }
    const point=pointToCell(e.clientX,e.clientY);
    if(point)moveDrag(point);
  });
  gridEl.addEventListener('pointerup',e=>{
    const point=state.mode==='boggle'
      ?boggleCellFromPointer(e.clientX,e.clientY)
      :pointToCell(e.clientX,e.clientY);
    if(point){
      if(state.mode==='boggle')boggleMove(point,e);
      else moveDrag(point);
    }
    if(state.mode==='boggle')boggleEnd(point?.el||e.target);
    else endDrag(point?.el||e.target);
  });
  gridEl.addEventListener('pointercancel',()=>{state.drag=null;clearPreview()});
}

async function buildPuzzle(){
  if(!state.ready||!state.books.length)return;
  const buildToken=++state.buildToken;
  state.cheatCompletion=false;
  showLoading();
  try{
    closeWinModal();
    if(!state.pool.length){
      loadingCard.querySelector('strong').textContent='Loading puzzle words…';
      const results=await Promise.allSettled(state.books.map(book=>loadBookWords(book)));
      const merged=[];const seen=new Set();
      results.forEach(result=>{
        if(result.status!=='fulfilled')return;
        result.value.forEach(item=>{
          const key=item.clean;
          if(!key||seen.has(key))return;
          seen.add(key);merged.push(item);
        });
      });
      if(merged.length<6){
        const failed=results.filter(r=>r.status==='rejected');
        if(failed.length===results.length)throw failed[0].reason;
        throw new Error('Your assigned books do not have enough puzzle words yet.');
      }
      state.pool=merged;
    }

    if(buildToken!==state.buildToken)return;
    state.book=null;
    state.words=state.pool;
    if(state.mode==='crossword'||state.mode==='boggle'){
      loadingCard.querySelector('strong').textContent='Finding level vocabulary…';
      if(!state.studentLevel)state.studentLevel=await resolveStudentLevel(state.books);
      if(!state.crosswordPool.length&&state.studentLevel){
        state.crosswordPool=await loadLevelCrosswordWords(state.studentLevel);
      }
      const levelSource=state.crosswordPool.length>=12?state.crosswordPool:state.pool;

      if(state.mode==='crossword'){
        loadingCard.querySelector('strong').textContent='Building your crossword…';
        const cw=makeCrossword(levelSource);
        renderCrossword(cw);maybeShowFirstGameHelp('crossword');
      }else{
        loadingCard.querySelector('strong').textContent='Building your Boggle board…';
        const puzzle=generateBoggle(levelSource);
        state.grid=puzzle.grid;state.size=puzzle.size;state.placements=puzzle.placements;
        renderBoggle();setModeUI();maybeShowFirstGameHelp('boggle');
      }
    }else if(state.mode==='mixmatch'){
      loadingCard.querySelector('strong').textContent='Building Mix & Match…';
      renderMixMatch(state.pool);setModeUI();maybeShowFirstGameHelp('mixmatch');
    }else{
      loadingCard.querySelector('strong').textContent='Building your word search…';
      const puzzle=generatePuzzle(state.pool,state.gridSize);
      state.grid=puzzle.grid;state.size=puzzle.size;state.placements=puzzle.placements;
      renderPuzzle();setModeUI();maybeShowFirstGameHelp('wordsearch');
    }
    if(buildToken!==state.buildToken)return;
    showGame();
  }catch(error){
    if(buildToken!==state.buildToken)return;
    console.error('[Word Games]',error);
    showError(error);
  }
}
async function boot(){
  preloadStudentSfx();
  state.ready=false;
  setPuzzleControlsEnabled(false);
  showLoading();
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
    loadingCard.querySelector('strong').textContent='Finding your books…';
    state.books=await assignedBooks(who.class);
    state.ready=true;
    setPuzzleControlsEnabled(true);
    await buildPuzzle();
  }catch(error){
    state.ready=false;
    setPuzzleControlsEnabled(false);
    console.error('[Word Search boot]',error);
    showError(error);
  }
}

async function cheatFinishPuzzle(){
  if(!CHEAT_MODE||!state.placements.length)return;
  state.cheatCompletion=true;
  state.gimmes.clear();
  state.found=new Set(state.placements.map((_,i)=>i));

  if(state.mode==='crossword'){
    state.placements.forEach((p,index)=>{
      p.coords.forEach(([r,c],i)=>{
        setCellLetter(r,c,p.clean[i]);
        crosswordCell(r,c)?.classList.add('solved');
      });
      wordListEl.querySelector('[data-word-index="'+index+'"]')?.classList.add('found');
    });
  }else{
    state.placements.forEach((p,index)=>{
      p.coords.forEach(([r,c])=>cellAt(r,c)?.classList.add('found'));
      if(state.mode==='boggle'){
        state.bogglePaths.set(index,{coords:p.coords.map(([r,c])=>[r,c])});
      }
      wordListEl.querySelector('[data-word-index="'+index+'"]')?.classList.add('found');
    });
    if(state.mode==='boggle')renderBoggleCanvas();
  }

  updateProgress();
  await finishPuzzle();
}

if(CHEAT_MODE&&cheatFinishBtn){
  cheatFinishBtn.hidden=false;
  cheatFinishBtn.addEventListener('click',cheatFinishPuzzle);
}


mixMatchGrid?.addEventListener('click',e=>{
  const card=e.target.closest('.mix-card');
  if(card)chooseMatchCard(card);
});
document.querySelectorAll('[data-grid-size]').forEach(btn=>btn.addEventListener('click',()=>{
  const size=Number(btn.dataset.gridSize);
  if(!state.ready||state.mode!=='wordsearch'||size===state.gridSize)return;
  clearModeSnapshot('wordsearch');
  state.gridSize=size;
  document.querySelectorAll('[data-grid-size]').forEach(b=>b.classList.toggle('active',Number(b.dataset.gridSize)===size));
  buildPuzzle();
}));
document.querySelectorAll('.puzzle-tab').forEach(btn=>btn.addEventListener('click',()=>{
  if(!state.ready||btn.dataset.mode===state.mode)return;
  snapshotCurrentMode();
  const nextMode=btn.dataset.mode;
  state.mode=nextMode;
  if(!restoreModeSnapshot(nextMode)){
    setModeUI();
    buildPuzzle();
  }
}));
document.addEventListener('click',e=>{
  const help=e.target.closest?.('#gameHelpBtn');
  if(help){
    e.preventDefault();
    e.stopPropagation();
    openGameHelp({mode:state.mode,markSeen:true});
    return;
  }
  if(e.target.closest?.('#gameHelpCloseBtn,#gameHelpGotItBtn')){
    e.preventDefault();
    closeGameHelp();
  }
});
gameHelpDialog?.addEventListener('click',e=>{if(e.target===gameHelpDialog)closeGameHelp()});
$('newPuzzleBtn').addEventListener('click',()=>{
  if(!state.ready)return;
  clearModeSnapshot();
  buildPuzzle();
});
$('retryBtn').addEventListener('click',()=>{
  if(!state.ready)return;
  clearModeSnapshot();
  buildPuzzle();
});
$('playAgainBtn').addEventListener('click',()=>{
  closeWinModal();
  clearModeSnapshot();
  buildPuzzle();
});
completeCard?.addEventListener('click',e=>{
  if(e.target===completeCard)closeWinModal();
});
wireGrid();
wireCrossword();
window.addEventListener('resize',()=>{if(state.mode==='boggle')requestAnimationFrame(renderBoggleCanvas)});
if(window.visualViewport){
  window.visualViewport.addEventListener('resize',onViewportKeyboardChange);
  window.visualViewport.addEventListener('scroll',onViewportKeyboardChange);
}
crosswordEntry?.addEventListener('focus',()=>{
  updateSystemKeyboardSpace();
  setTimeout(()=>keepActiveCrosswordVisible({smooth:true}),140);
});
crosswordEntry?.addEventListener('blur',()=>{
  setTimeout(()=>{
    updateSystemKeyboardSpace();
    if(systemKeyboardInset()<120)document.body.classList.remove('system-kb-open');
  },120);
});
updateSystemKeyboardSpace();
setPuzzleControlsEnabled(false);
setModeUI();
boot();
