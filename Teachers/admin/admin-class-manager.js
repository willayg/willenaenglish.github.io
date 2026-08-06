(()=>{
  const CLASS_API='https://fiieuiktlsivwfgyivai.supabase.co/functions/v1/admin_classes';
  const CONTENT_API='https://gxwfsqxyuufqtitspfqg.supabase.co/functions/v1/source_content_admin';
  const text={
    ko:{addClass:'반 추가',className:'반 이름',book1:'교재 1',book2:'교재 2',book3:'교재 3',fallbackLevel:'교재가 없을 때 레벨',noLevel:'레벨 없음',mixed:'혼합',cancel:'취소',create:'반 만들기',hint:'두 글자 이상 입력하면 커리큘럼 DB의 최신 교재를 검색합니다. 목록에 없는 교재는 직접 입력으로 저장하고 나중에 DB 교재와 연결할 수 있습니다.',required:'반 이름을 입력해 주세요.',duplicate:'이미 사용 중인 반 이름입니다.',failed:'반을 만들지 못했습니다',students:'명',viewRoster:'학생 명단 보기',books:'교재',level:'레벨',catalogBook:'커리큘럼 DB 교재',manualBook:'직접 입력 · 나중에 DB 연결 가능',manualOption:'직접 입력으로 사용',typeToSearch:'두 글자 이상 입력하세요',searching:'교재 검색 중…',noMatches:'일치하는 DB 교재가 없습니다.',searchFailed:'교재 검색에 실패했습니다.',manualBadge:'수동',catalogBadge:'DB'},
    en:{addClass:'Add class',className:'Class name',book1:'Book 1',book2:'Book 2',book3:'Book 3',fallbackLevel:'Level when no book is assigned',noLevel:'No level',mixed:'Mixed',cancel:'Cancel',create:'Create class',hint:'Type at least two characters to search the latest curriculum database. A title not in the list can be saved manually and linked to the database later.',required:'Enter a class name.',duplicate:'That class name already exists.',failed:'Could not create class',students:'students',viewRoster:'View roster',books:'Books',level:'Level',catalogBook:'Curriculum database book',manualBook:'Manual entry · can be linked later',manualOption:'Use as manual entry',typeToSearch:'Type at least 2 characters',searching:'Searching books…',noMatches:'No matching database books.',searchFailed:'Book search failed.',manualBadge:'Manual',catalogBadge:'DB'}
  };
  const lang=()=>window.AdminI18n?.language||'ko',tr=k=>text[lang()]?.[k]||text.en[k]||k;
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const page=document.getElementById('classes');if(!page)return;
  let userId='',classRows=[];
  const selectedBooks=new Map(),searchCache=new Map(),timers=new Map(),controllers=new Map();
  async function resolveUserId(){
    if(userId)return userId;
    userId=localStorage.getItem('userId')||localStorage.getItem('profile_id')||'';
    if(userId)return userId;
    for(const action of ['whoami','get_profile']){
      try{const d=await api(`/.netlify/functions/supabase_auth?action=${action}`);userId=d?.user?.id||d?.user_id||d?.profile?.id||d?.id||'';if(userId){localStorage.setItem('userId',userId);return userId}}catch{}
    }
    throw new Error('No authenticated user ID');
  }
  async function edge(url,options={}){
    const id=await resolveUserId();
    const headers={...(options.headers||{}),'x-user-id':id};
    if(options.body)headers['Content-Type']='application/json';
    const r=await fetch(url,{...options,headers,credentials:'omit',cache:'no-store'});
    const d=await r.json().catch(()=>({}));
    if(!r.ok||d?.success===false||d?.error)throw new Error(d?.error||`Request failed ${r.status}`);
    return d;
  }
  const bar=document.createElement('div');bar.className='toolbar';bar.innerHTML='<div style="flex:1"></div><button class="btn primary" id="addClassBtn"></button>';page.insertBefore(bar,document.getElementById('classGrid'));
  const button=bar.querySelector('button');
  const modal=document.createElement('div');modal.className='modal-bg';document.body.appendChild(modal);
  const levelOptions=()=>`<option value="">${tr('noLevel')}</option><option>S1</option><option>S2</option>${Array.from({length:10},(_,i)=>`<option>${i+1}</option>`).join('')}<option value="Mixed">${tr('mixed')}</option>`;
  const displayBook=b=>b.series?`${b.series} — ${b.title}`:b.title;
  function closeMenus(except=''){document.querySelectorAll('.book-suggestions.show').forEach(el=>{if(el.id!==except)el.classList.remove('show')})}
  function syncLevel(){const has=['newBook1','newBook2','newBook3'].some(id=>document.getElementById(id)?.value.trim());const el=document.getElementById('newClassLevel');if(el){el.disabled=has;if(has)el.value=''}}
  function status(id){const input=document.getElementById(id),el=document.getElementById(`${id}Status`),b=selectedBooks.get(id);if(!input||!el)return;el.textContent=input.value.trim()?(b?`${tr('catalogBook')}${b.level?` · ${b.level}`:''}`:tr('manualBook')):'';el.className=`book-source-status ${input.value.trim()?(b?'catalog':'manual'):''}`}
  function menu(id,books,message=''){
    const input=document.getElementById(id),m=document.getElementById(`${id}Menu`);if(!input||!m)return;const typed=input.value.trim();
    m.innerHTML=(message?`<div class="book-suggestion-message">${esc(message)}</div>`:'')+books.map((b,i)=>`<button type="button" class="book-suggestion" data-i="${i}"><b>${esc(b.title)}</b><span>${esc([b.series,b.publisher,b.level?`Level ${b.level}`:''].filter(Boolean).join(' · '))}</span></button>`).join('')+(typed?`<button type="button" class="book-suggestion manual" data-manual="1"><b>${esc(typed)}</b><span>${tr('manualOption')}</span></button>`:'');
    m.classList.add('show');closeMenus(m.id);
    m.querySelectorAll('[data-i]').forEach(btn=>btn.onclick=()=>{const b=books[Number(btn.dataset.i)];selectedBooks.set(id,b);input.value=displayBook(b);m.classList.remove('show');status(id);syncLevel()});
    const manual=m.querySelector('[data-manual]');if(manual)manual.onclick=()=>{selectedBooks.delete(id);m.classList.remove('show');status(id);syncLevel()};
  }
  async function searchBooks(id){
    const input=document.getElementById(id);if(!input)return;const q=input.value.trim();selectedBooks.delete(id);status(id);syncLevel();
    if(q.length<2){menu(id,[],tr('typeToSearch'));return}
    const key=q.toLowerCase(),cached=searchCache.get(key);if(cached&&Date.now()-cached.time<60000){menu(id,cached.books);return}
    controllers.get(id)?.abort();const controller=new AbortController();controllers.set(id,controller);menu(id,[],tr('searching'));
    try{const d=await edge(CONTENT_API,{method:'POST',signal:controller.signal,body:JSON.stringify({action:'search_books',q})});if(input.value.trim()!==q)return;const books=d.data||[];searchCache.set(key,{time:Date.now(),books});menu(id,books,books.length?'':tr('noMatches'))}catch(e){if(e.name!=='AbortError')menu(id,[],tr('searchFailed'))}
  }
  function bind(id){const input=document.getElementById(id);input.addEventListener('input',()=>{selectedBooks.delete(id);clearTimeout(timers.get(id));timers.set(id,setTimeout(()=>searchBooks(id),250));status(id);syncLevel()});input.addEventListener('focus',()=>input.value.trim().length>=2?searchBooks(id):menu(id,[],tr('typeToSearch')))}
  function renderModal(){selectedBooks.clear();modal.innerHTML=`<div class="modal class-create-modal"><div class="modal-head"><h3>${tr('addClass')}</h3><button class="close" id="closeAddClass">×</button></div><div class="modal-body"><div class="class-form-grid"><div class="full"><label>${tr('className')}</label><input id="newClassName" maxlength="80"></div>${[1,2,3].map(n=>`<div class="book-picker-field"><label>${tr(`book${n}`)}</label><div class="book-autocomplete"><input id="newBook${n}" autocomplete="off" placeholder="${tr('typeToSearch')}"><div id="newBook${n}Menu" class="book-suggestions"></div></div><div id="newBook${n}Status" class="book-source-status"></div></div>`).join('')}<div class="full"><label>${tr('fallbackLevel')}</label><select id="newClassLevel">${levelOptions()}</select></div><div class="form-hint full">${tr('hint')}</div><div class="msg full" id="addClassMsg"></div></div></div><div class="modal-foot"><button class="btn" id="cancelAddClass">${tr('cancel')}</button><button class="btn primary" id="confirmAddClass">${tr('create')}</button></div></div>`;['newBook1','newBook2','newBook3'].forEach(bind);document.getElementById('closeAddClass').onclick=close;document.getElementById('cancelAddClass').onclick=close;document.getElementById('confirmAddClass').onclick=createClass}
  function open(){renderModal();modal.classList.add('show');setTimeout(()=>document.getElementById('newClassName')?.focus(),20)}
  function close(){modal.classList.remove('show');closeMenus();controllers.forEach(c=>c.abort())}
  async function loadClasses(){try{const d=await edge(CLASS_API);classRows=d.classes||[];window.__adminClassRows=classRows;const names=classRows.map(c=>c.name).filter(Boolean);if(names.length){canonical.splice(0,canonical.length,...names);buildFilters();renderClasses()}}catch(e){console.error(e);showToast(e.message,{error:true})}}
  window.renderClasses=function(){const counts=Object.fromEntries(canonical.map(c=>[c,0]));students.forEach(s=>{if(counts[s.class]!==undefined)counts[s.class]++});const byName=new Map(classRows.map(c=>[c.name,c]));document.getElementById('classGrid').innerHTML=canonical.map(name=>{const row=byName.get(name)||{},books=(row.books||[]).filter(b=>b.book_title);const meta=books.length?`<div class="class-meta"><b>${tr('books')}:</b> ${books.map(b=>`<span class="book-chip ${b.source_type==='manual'?'manual':''}">${esc(b.book_title)} <small>${b.source_type==='manual'?tr('manualBadge'):tr('catalogBadge')}</small></span>`).join(' ')}</div>`:row.level?`<div class="class-meta"><b>${tr('level')}:</b> ${esc(row.level)}</div>`:'';return`<div class="card class-card" data-class-id="${esc(row.id||'')}"><h3>${esc(name)}</h3>${meta}<div class="count">${counts[name]||0}</div><div class="mut">${tr('students')}</div><button data-view-class="${esc(name)}">${tr('viewRoster')}</button></div>`}).join('');document.querySelectorAll('[data-view-class]').forEach(b=>b.onclick=()=>{document.getElementById('classFilter').value=b.dataset.viewClass;apply();setPage('students')})};
  function bookPayload(id){const value=document.getElementById(id).value.trim();if(!value)return null;const b=selectedBooks.get(id);return b?{book_id:b.book_id,title:b.title,series:b.series,level:b.level,source_type:'catalog'}:{book_id:null,title:value,source_type:'manual'}}
  async function createClass(){const name=document.getElementById('newClassName').value.trim().replace(/\s+/g,' '),books=['newBook1','newBook2','newBook3'].map(bookPayload).filter(Boolean),level=document.getElementById('newClassLevel').value,msg=document.getElementById('addClassMsg');if(!name){msg.textContent=tr('required');return}if(canonical.some(c=>c.toLowerCase()===name.toLowerCase())){msg.textContent=tr('duplicate');return}try{const d=await edge(CLASS_API,{method:'POST',body:JSON.stringify({action:'create_class',name,books,level:books.length?null:level})});classRows.push(d.class);window.__adminClassRows=classRows;canonical.push(name);canonical.sort((a,b)=>a.localeCompare(b));buildFilters();renderClasses();close()}catch(e){msg.textContent=`${tr('failed')}: ${e.message}`}}
  function applyLanguage(){button.textContent=tr('addClass');if(modal.classList.contains('show'))renderModal();renderClasses()}
  window.AdminClassEdge={edge,resolveUserId,CLASS_API,CONTENT_API,refresh:loadClasses};
  button.onclick=open;modal.onclick=e=>{if(e.target===modal)close()};document.addEventListener('click',e=>{if(!e.target.closest('.book-autocomplete'))closeMenus()});document.addEventListener('willena-language-change',applyLanguage);applyLanguage();loadClasses();
})();