import { getStudentRoster } from '/Teachers/shared/student-roster.js?v=20260917-p21';

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const CLASS_API='https://fiieuiktlsivwfgyivai.supabase.co/functions/v1/admin_classes';
const CONTENT_API='https://gxwfsqxyuufqtitspfqg.supabase.co/functions/v1/source_content_admin';
const ORDER_API='https://fiieuiktlsivwfgyivai.supabase.co/functions/v1/admin_class_order';
let userId='';
let rows=[];
let loaded=false;
let activeClass=null;
let drawerMode='edit';
let selectedBooks=new Map();
let searchCache=new Map();
let catalogPromise=null;
let activeBookSearch='';
let timers=new Map();
let controllers=new Map();
let orderEditing=false;
let orderBefore=[];
let draggedCard=null;
let dragPlaceholder=null;

function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]))}
function roster(){return getStudentRoster()?.students||[]}
function countFor(name){return roster().filter(s=>s.class===name).length}
function displayBook(b){return b?.title||''}

async function resolveUserId(){
  if(userId)return userId;
  userId=localStorage.getItem('userId')||localStorage.getItem('profile_id')||'';
  if(userId)return userId;
  const fn=window.WillenaAPI?.fetch||window.fetch.bind(window);
  const r=await fn('/.netlify/functions/supabase_auth?action=whoami',{credentials:'include',cache:'no-store'});
  const d=await r.json().catch(()=>({}));
  userId=d.user_id||d?.user?.id||'';
  if(userId)localStorage.setItem('userId',userId);
  if(!userId)throw new Error('No authenticated user ID');
  return userId;
}

async function edge(url,options={}){
  const id=await resolveUserId();
  const headers={...(options.headers||{}),'x-user-id':id};
  if(options.body)headers['Content-Type']='application/json';
  const r=await fetch(url,{...options,headers,credentials:'omit',cache:'no-store'});
  const d=await r.json().catch(()=>({}));
  if(!r.ok||d?.success===false||d?.error)throw new Error(d?.error||`Request failed (${r.status})`);
  return d;
}

function orderStatus(text='',error=false){const el=$('#classOrderStatusV2');if(!el)return;el.textContent=text;el.style.color=error?'var(--red)':''}
function currentOrderIds(){return $$('.admin-class-card',$('#classGridV2')).map(card=>card.dataset.classId).filter(Boolean)}
function reorderRowsFromDom(){const rank=new Map(currentOrderIds().map((id,i)=>[id,i]));rows.sort((a,b)=>(rank.get(String(a.id))??9999)-(rank.get(String(b.id))??9999))}
function renderCards(){
  const grid=$('#classGridV2');
  if(!grid)return;
  if(!rows.length){grid.innerHTML='<div class="empty">No classes found.</div>';return}
  grid.innerHTML=rows.map(row=>{
    const books=(row.books||[]).filter(b=>b.book_title);
    const meta=books.length?`<div class="class-meta">${books.map(b=>`<span class="book-chip">${esc(b.book_title)} <small>${b.source_type==='manual'?'Manual':'DB'}</small></span>`).join('')}</div>`:(row.level?`<div class="class-meta">Level: ${esc(row.level)}</div>`:'');
    return `<div class="class-card admin-class-card" data-class-id="${esc(row.id||'')}" data-class-name="${esc(row.name||'')}"><button class="class-order-handle" type="button" aria-label="Move ${esc(row.name||'')}">☰</button><div class="class-top"><div class="class-name">${esc(row.name||'')}</div><div class="class-count">${countFor(row.name)} students</div></div>${meta}<div class="class-stats"><div class="class-stat"><b>${countFor(row.name)}</b><span>students</span></div><div class="class-stat"><b>${books.length||'—'}</b><span>books</span></div></div><div class="class-link">Manage class →</div></div>`;
  }).join('');
  grid.classList.toggle('class-order-editing',orderEditing);
  $$('.admin-class-card',grid).forEach(card=>{
    card.onclick=()=>{if(!orderEditing)openEdit(card.dataset.className)};
    const handle=$('.class-order-handle',card);
    if(handle)handle.onpointerdown=e=>startDrag(e,card);
  });
}

async function loadSavedOrder(){
  try{
    const d=await edge(ORDER_API);
    const saved=Array.isArray(d.order)?d.order:[];
    if(!saved.length)return;
    const rank=new Map(saved.map((x,i)=>[String(x.id||x),i]));
    rows.sort((a,b)=>(rank.get(String(a.id))??9999)-(rank.get(String(b.id))??9999));
  }catch(e){console.warn('[Admin V2] class order unavailable',e)}
}

async function loadClasses(force=false){
  if(loaded&&!force){renderCards();return rows}
  const grid=$('#classGridV2');if(grid)grid.innerHTML='<div class="empty">Loading classes…</div>';
  const d=await edge(CLASS_API);
  rows=d.classes||[];
  await loadSavedOrder();
  loaded=true;
  renderCards();
  return rows;
}

function beginOrder(){
  if(orderEditing)return;
  orderEditing=true;orderBefore=rows.map(r=>String(r.id));
  $('#classOrderEditV2').hidden=true;$('#classOrderCancelV2').hidden=false;$('#classOrderDoneV2').hidden=false;
  $('#classAddV2').disabled=true;$('#classRefreshV2').disabled=true;
  orderStatus('Drag classes into the order you want.');renderCards();
}
function restoreOrder(ids){const rank=new Map(ids.map((id,i)=>[String(id),i]));rows.sort((a,b)=>(rank.get(String(a.id))??9999)-(rank.get(String(b.id))??9999))}
function cancelOrder(){if(!orderEditing)return;restoreOrder(orderBefore);finishOrderMode();renderCards()}
function finishOrderMode(){orderEditing=false;orderBefore=[];$('#classOrderEditV2').hidden=false;$('#classOrderCancelV2').hidden=true;$('#classOrderDoneV2').hidden=true;$('#classAddV2').disabled=false;$('#classRefreshV2').disabled=false;orderStatus('')}
async function saveOrder(){
  if(!orderEditing)return;
  reorderRowsFromDom();const order=rows.map(r=>String(r.id)).filter(Boolean);const done=$('#classOrderDoneV2');done.disabled=true;orderStatus('Saving…');
  try{const d=await edge(ORDER_API,{method:'POST',body:JSON.stringify({order})});if(Array.isArray(d.order)&&d.order.length){const rank=new Map(d.order.map((x,i)=>[String(x.id||x),i]));rows.sort((a,b)=>(rank.get(String(a.id))??9999)-(rank.get(String(b.id))??9999))}finishOrderMode();renderCards();orderStatus('Saved');setTimeout(()=>orderStatus(''),1200)}catch(e){orderStatus('Could not save order',true)}finally{done.disabled=false}
}
function startDrag(e,card){
  if(!orderEditing)return;e.preventDefault();e.stopPropagation();draggedCard=card;
  const grid=$('#classGridV2'),rect=card.getBoundingClientRect();dragPlaceholder=document.createElement('div');dragPlaceholder.className='class-order-placeholder';dragPlaceholder.style.height=`${rect.height}px`;grid.insertBefore(dragPlaceholder,card);card.classList.add('dragging');card.style.width=`${rect.width}px`;card.style.position='fixed';card.style.left=`${rect.left}px`;card.style.top=`${rect.top}px`;card.style.zIndex='1000';card.style.pointerEvents='none';document.body.appendChild(card);
  const offsetY=e.clientY-rect.top;const move=ev=>{if(!draggedCard)return;draggedCard.style.top=`${ev.clientY-offsetY}px`;const cards=$$('.admin-class-card',grid);let placed=false;for(const row of cards){const r=row.getBoundingClientRect();if(ev.clientY<r.top+r.height/2){grid.insertBefore(dragPlaceholder,row);placed=true;break}}if(!placed)grid.appendChild(dragPlaceholder)};
  const end=()=>{document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',end);if(!draggedCard)return;dragPlaceholder.replaceWith(draggedCard);draggedCard.classList.remove('dragging');draggedCard.removeAttribute('style');draggedCard=null;dragPlaceholder=null};
  document.addEventListener('pointermove',move);document.addEventListener('pointerup',end,{once:true});
}

function levelOptions(current=''){
  return `<option value=""${!current?' selected':''}>No level</option><option${current==='S1'?' selected':''}>S1</option><option${current==='S2'?' selected':''}>S2</option>${Array.from({length:10},(_,i)=>`<option${current===String(i+1)?' selected':''}>${i+1}</option>`).join('')}<option value="Mixed"${current==='Mixed'?' selected':''}>Mixed</option>`;
}
function currentBook(row,i){const b=row?.books?.[i];return b?{book_id:b.book_id,title:b.book_title,series:b.catalog_series||'',level:b.catalog_level||'',source_type:b.source_type||'manual'}:null}
function drawerEls(){return {bg:$('#classDrawerBgV2'),drawer:$('#classDrawerV2'),body:$('#classDrawerBodyV2'),title:$('#classDrawerTitleV2'),meta:$('#classDrawerMetaV2')}}
function closeDrawer(){activeBookSearch='';const {bg,drawer}=drawerEls();bg?.classList.remove('open');drawer?.classList.remove('open');document.body.style.overflow='';hideMenus();controllers.forEach(c=>c.abort());timers.forEach(t=>clearTimeout(t));timers.clear();activeClass=null;selectedBooks.clear()}

function renderDrawer(row,mode='edit'){
  drawerMode=mode;activeClass=row||null;selectedBooks.clear();
  const {bg,drawer,body,title,meta}=drawerEls();
  const isAdd=mode==='add';
  title.textContent=isAdd?'Add class':row.name;
  meta.textContent=isAdd?'Create a class and assign books':`${countFor(row.name)} students`;
  for(let i=0;i<3;i++){const b=currentBook(row,i);if(b?.book_id)selectedBooks.set(`classBook${i+1}`,b)}
  const rs=isAdd?[]:roster().filter(s=>s.class===row.name);
  body.innerHTML=`<section class="admin-class-section"><h3>${isAdd?'Class setup':'Book assignments'}</h3><div class="admin-form-grid">${isAdd?`<label class="admin-form-field full"><span>Class name</span><input id="classNameV2" maxlength="80"></label>`:''}<div class="full admin-book-grid">${[0,1,2].map(i=>{const b=currentBook(row,i);return `<label class="admin-form-field"><span>Book ${i+1}</span><div class="admin-book-picker"><input id="classBook${i+1}" autocomplete="off" value="${esc(b?displayBook(b):'')}" placeholder="Type at least 2 characters"><div id="classBook${i+1}Menu" class="admin-book-suggestions"></div></div><div id="classBook${i+1}Status" class="admin-book-status">${b?(b.book_id?'Curriculum DB book':'Manual entry'):''}</div></label>`}).join('')}</div><label class="admin-form-field full"><span>Fallback level</span><select id="classLevelV2">${levelOptions(row?.level||'')}</select></label></div><div class="admin-modal-error" id="classDrawerErrorV2"></div><button class="admin-class-save" id="classSaveV2">${isAdd?'Create class':'Save changes'}</button></section>${isAdd?'':`<section class="admin-class-section"><h3>Roster</h3><div class="admin-class-roster">${rs.length?rs.map(s=>`<div><b>${esc(s.name||s.korean_name||s.username)}</b><span>${esc(s.korean_name||s.username||'')}</span></div>`).join(''):'<div class="empty">No students assigned.</div>'}</div></section>`}`;
  [1,2,3].forEach(n=>bindBook(`classBook${n}`));syncLevel();$('#classSaveV2').onclick=saveDrawer;bg.classList.add('open');drawer.classList.add('open');document.body.style.overflow='hidden';hideMenus();drawer.setAttribute('tabindex','-1');drawer.focus({preventScroll:true});
}

function openEdit(name){const row=rows.find(r=>r.name===name);if(row)renderDrawer(row,'edit')}
function openAdd(){renderDrawer({name:'',books:[],level:null},'add')}
function syncLevel(){const has=[1,2,3].some(n=>$('#classBook'+n)?.value.trim());const level=$('#classLevelV2');if(level){level.disabled=has;if(has)level.value=''}}
function bookStatus(id){const input=$('#'+id),el=$('#'+id+'Status'),b=selectedBooks.get(id);if(!input||!el)return;el.textContent=input.value.trim()?(b?.book_id?'Linked to curriculum DB':'Select a database book from the search results'):''}
function hideMenus(except=''){
  $$('.admin-book-suggestions.show').forEach(menu=>{if(menu.id!==except)menu.classList.remove('show')});
  if(!except)activeBookSearch='';
}
async function catalogBooks(){
  if(!catalogPromise)catalogPromise=edge(CONTENT_API,{method:'POST',body:JSON.stringify({action:'list_books'})})
    .then(d=>(d.data||[]).filter(b=>['review','published'].includes(b.status)).map(b=>({
      book_id:b.id,title:b.title||'',series:b.content_series?.name||'',
      level:b.public_level!=null?String(b.public_level):b.internal_level_id!=null?String(b.internal_level_id):''
    })))
    .catch(e=>{catalogPromise=null;throw e});
  return catalogPromise;
}
function showMenu(id,books,message=''){
  const input=$('#'+id),menu=$('#'+id+'Menu');
  if(!input||!menu||activeBookSearch!==id||document.activeElement!==input)return;
  menu.innerHTML=(message?`<div class="admin-book-menu-message">${esc(message)}</div>`:'')+
    books.map((b,i)=>`<button type="button" data-i="${i}"><b>${esc(b.title)}</b><span>${esc([b.series,b.level?`Level ${b.level}`:''].filter(Boolean).join(' · '))}</span></button>`).join('');
  hideMenus(menu.id);menu.classList.toggle('show',!!menu.children.length);
  $$('[data-i]',menu).forEach(btn=>{
    btn.onpointerdown=e=>e.preventDefault();
    btn.onclick=()=>{
      const b=books[Number(btn.dataset.i)];
      selectedBooks.set(id,b);input.value=displayBook(b);
      hideMenus();bookStatus(id);syncLevel();
    };
  });
}
async function searchBooks(id){
  const input=$('#'+id);
  if(!input||activeBookSearch!==id||document.activeElement!==input)return;
  const q=input.value.trim(),key=q.toLocaleLowerCase();
  const cached=searchCache.get(key);
  if(cached){showMenu(id,cached);return}
  showMenu(id,[],'Loading books…');
  try{
    const all=await catalogBooks();
    if(!input.isConnected||document.activeElement!==input||activeBookSearch!==id||input.value.trim()!==q)return;
    const terms=key.split(/\s+/).filter(Boolean);
    const books=all.filter(b=>terms.every(t=>`${b.title} ${b.series}`.toLocaleLowerCase().includes(t)))
      .sort((a,b)=>Number(b.title.toLocaleLowerCase().startsWith(key))-Number(a.title.toLocaleLowerCase().startsWith(key))||a.title.localeCompare(b.title))
      .slice(0,61);
    searchCache.set(key,books);
    showMenu(id,books,books.length?'':'No matching database books');
  }catch(e){
    if(input.isConnected&&document.activeElement===input&&activeBookSearch===id)showMenu(id,[],'Could not load books');
  }
}
function bindBook(id){
  const input=$('#'+id);
  input.addEventListener('focus',()=>{
    activeBookSearch=id;hideMenus(id+'Menu');
    if(selectedBooks.has(id)){input.value='';input.placeholder='Search or select a database book';}
    searchBooks(id);
  });
  input.addEventListener('input',()=>{
    activeBookSearch=id;hideMenus(id+'Menu');
    selectedBooks.delete(id);clearTimeout(timers.get(id));
    timers.set(id,setTimeout(()=>searchBooks(id),160));
    bookStatus(id);syncLevel();
  });
  input.addEventListener('keydown',e=>{
    if(e.key==='Escape'){hideMenus();input.blur();}
  });
  input.addEventListener('blur',()=>{
    clearTimeout(timers.get(id));hideMenus();
    const b=selectedBooks.get(id);
    if(b?.book_id){input.value=displayBook(b);input.placeholder='Type to filter database books';}
  });
}
function bookPayload(id){
  const value=$('#'+id).value.trim();if(!value)return null;
  const b=selectedBooks.get(id);
  if(!b?.book_id)throw new Error('Select a curriculum DB book for Book '+id.slice(-1));
  return {book_id:b.book_id,title:b.title,series:b.series,level:b.level,source_type:'catalog'};
}

async function saveDrawer(){
  const error=$('#classDrawerErrorV2');error.textContent='';const btn=$('#classSaveV2');btn.disabled=true;let books;try{books=[1,2,3].map(n=>bookPayload(`classBook${n}`)).filter(Boolean);}catch(e){error.textContent=e.message;btn.disabled=false;return}const level=books.length?null:$('#classLevelV2').value;
  try{if(drawerMode==='add'){const name=$('#classNameV2').value.trim().replace(/\s+/g,' ');if(!name)throw new Error('Enter a class name');if(rows.some(r=>String(r.name).toLowerCase()===name.toLowerCase()))throw new Error('That class already exists');const d=await edge(CLASS_API,{method:'POST',body:JSON.stringify({action:'create_class',name,books,level})});rows.push(d.class)}else{const d=await edge(CLASS_API,{method:'POST',body:JSON.stringify({action:'update_class',class_id:activeClass.id,books,level})});const i=rows.findIndex(r=>r.id===d.class.id);if(i>=0)rows[i]=d.class}renderCards();closeDrawer()}catch(e){error.textContent=e.message;btn.disabled=false}
}

export async function mountClasses(){
  if($('#classAddV2')?.dataset.bound!=='1'){
    $('#classAddV2').dataset.bound='1';$('#classAddV2').onclick=openAdd;$('#classRefreshV2').onclick=()=>loadClasses(true);$('#classDrawerCloseV2').onclick=e=>{e.preventDefault();e.stopPropagation();closeDrawer()};$('#classDrawerBgV2').onclick=e=>{if(e.target===$('#classDrawerBgV2'))closeDrawer()};document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#classDrawerV2')?.classList.contains('open'))closeDrawer()});document.addEventListener('pointerdown',e=>{if(!e.target.closest?.('.admin-book-picker'))hideMenus()});$('#classOrderEditV2').onclick=beginOrder;$('#classOrderCancelV2').onclick=cancelOrder;$('#classOrderDoneV2').onclick=saveOrder;
  }
  return loadClasses(false);
}
