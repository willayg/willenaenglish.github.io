(()=>{
  const apiUrl='/.netlify/functions/admin_classes';
  const text={
    ko:{addClass:'반 추가',className:'반 이름',book1:'교재 1',book2:'교재 2',book3:'교재 3',fallbackLevel:'교재가 없을 때 레벨',noLevel:'레벨 없음',mixed:'혼합',cancel:'취소',create:'반 만들기',hint:'두 글자 이상 입력하면 커리큘럼 DB의 최신 교재를 검색합니다. 목록에 없는 교재는 직접 입력으로 저장하고 나중에 DB 교재와 연결할 수 있습니다.',required:'반 이름을 입력해 주세요.',duplicate:'이미 사용 중인 반 이름입니다.',failed:'반을 만들지 못했습니다',students:'명',viewRoster:'학생 명단 보기',books:'교재',level:'레벨',catalogBook:'커리큘럼 DB 교재',manualBook:'직접 입력 · 나중에 DB 연결 가능',manualOption:'직접 입력으로 사용',typeToSearch:'두 글자 이상 입력하세요',searching:'교재 검색 중…',noMatches:'일치하는 DB 교재가 없습니다.',searchFailed:'교재 검색에 실패했습니다.',manualBadge:'수동',catalogBadge:'DB'},
    en:{addClass:'Add class',className:'Class name',book1:'Book 1',book2:'Book 2',book3:'Book 3',fallbackLevel:'Level when no book is assigned',noLevel:'No level',mixed:'Mixed',cancel:'Cancel',create:'Create class',hint:'Type at least two characters to search the latest curriculum database. A title not in the list can be saved manually and linked to the database later.',required:'Enter a class name.',duplicate:'That class name already exists.',failed:'Could not create class',students:'students',viewRoster:'View roster',books:'Books',level:'Level',catalogBook:'Curriculum database book',manualBook:'Manual entry · can be linked later',manualOption:'Use as manual entry',typeToSearch:'Type at least 2 characters',searching:'Searching books…',noMatches:'No matching database books.',searchFailed:'Book search failed.',manualBadge:'Manual',catalogBadge:'DB'}
  };
  const lang=()=>window.AdminI18n?.language||'ko';
  const tr=k=>text[lang()]?.[k]||text.en[k]||k;
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const page=document.getElementById('classes');if(!page)return;
  const bar=document.createElement('div');bar.className='toolbar';bar.innerHTML='<div style="flex:1"></div><button class="btn primary" id="addClassBtn"></button>';page.insertBefore(bar,document.getElementById('classGrid'));
  const button=bar.querySelector('button');
  const modal=document.createElement('div');modal.className='modal-bg';modal.id='addClassModal';document.body.appendChild(modal);
  let classRows=[];
  const selectedBooks=new Map();
  const searchCache=new Map();
  const searchTimers=new Map();
  const searchControllers=new Map();
  const CACHE_MS=60000;
  const levelOptions=()=>`<option value="">${tr('noLevel')}</option><option>S1</option><option>S2</option>${Array.from({length:10},(_,i)=>`<option>${i+1}</option>`).join('')}<option value="Mixed">${tr('mixed')}</option>`;
  const displayBook=b=>b.series?`${b.series} — ${b.title}`:b.title;

  function statusFor(id){
    const input=document.getElementById(id),status=document.getElementById(`${id}Status`);if(!input||!status)return;
    const value=input.value.trim(),found=selectedBooks.get(id);
    if(!value){status.textContent='';status.className='book-source-status';return}
    status.textContent=found?`${tr('catalogBook')}${found.level?` · ${found.level}`:''}`:tr('manualBook');
    status.className=`book-source-status ${found?'catalog':'manual'}`;
  }
  function syncLevel(){
    const hasBooks=['newBook1','newBook2','newBook3'].some(id=>document.getElementById(id)?.value.trim());
    const level=document.getElementById('newClassLevel');if(!level)return;level.disabled=hasBooks;if(hasBooks)level.value='';
  }
  function closeMenus(except=''){document.querySelectorAll('.book-suggestions.show').forEach(el=>{if(el.id!==except)el.classList.remove('show')})}
  function renderSuggestions(id,books,message=''){
    const input=document.getElementById(id),menu=document.getElementById(`${id}Menu`);if(!input||!menu)return;
    const typed=input.value.trim();
    let html=message?`<div class="book-suggestion-message">${esc(message)}</div>`:'';
    html+=books.map((b,i)=>`<button type="button" class="book-suggestion" data-book-index="${i}"><b>${esc(b.title)}</b><span>${esc([b.series,b.publisher,b.level?`Level ${b.level}`:''].filter(Boolean).join(' · '))}</span></button>`).join('');
    if(typed)html+=`<button type="button" class="book-suggestion manual" data-manual="1"><b>${esc(typed)}</b><span>${tr('manualOption')}</span></button>`;
    menu.innerHTML=html;menu.classList.add('show');closeMenus(menu.id);
    menu.querySelectorAll('[data-book-index]').forEach(btn=>btn.onclick=()=>{
      const b=books[Number(btn.dataset.bookIndex)];selectedBooks.set(id,b);input.value=displayBook(b);menu.classList.remove('show');statusFor(id);syncLevel();
    });
    const manual=menu.querySelector('[data-manual]');if(manual)manual.onclick=()=>{selectedBooks.delete(id);input.value=typed;menu.classList.remove('show');statusFor(id);syncLevel()};
  }
  async function searchBooks(id){
    const input=document.getElementById(id);if(!input)return;
    const q=input.value.trim();selectedBooks.delete(id);statusFor(id);syncLevel();
    if(q.length<2){renderSuggestions(id,[],tr('typeToSearch'));return}
    const key=q.toLowerCase();const cached=searchCache.get(key);
    if(cached&&Date.now()-cached.time<CACHE_MS){renderSuggestions(id,cached.books);return}
    searchControllers.get(id)?.abort();const controller=new AbortController();searchControllers.set(id,controller);
    renderSuggestions(id,[],tr('searching'));
    try{
      const data=await api(`${apiUrl}?action=search_books&q=${encodeURIComponent(q)}`,{signal:controller.signal});
      if(input.value.trim()!==q)return;
      const books=data.books||[];searchCache.set(key,{time:Date.now(),books});
      renderSuggestions(id,books,books.length?'':tr('noMatches'));
    }catch(e){if(e.name!=='AbortError')renderSuggestions(id,[],tr('searchFailed'))}
  }
  function bindPicker(id){
    const input=document.getElementById(id);if(!input)return;
    input.addEventListener('input',()=>{selectedBooks.delete(id);clearTimeout(searchTimers.get(id));searchTimers.set(id,setTimeout(()=>searchBooks(id),250));statusFor(id);syncLevel()});
    input.addEventListener('focus',()=>{if(input.value.trim().length>=2)searchBooks(id);else renderSuggestions(id,[],tr('typeToSearch'))});
    input.addEventListener('keydown',e=>{if(e.key==='Escape')document.getElementById(`${id}Menu`)?.classList.remove('show')});
  }
  function renderModal(){
    selectedBooks.clear();
    modal.innerHTML=`<div class="modal class-create-modal"><div class="modal-head"><h3>${tr('addClass')}</h3><button class="close" id="closeAddClass">×</button></div><div class="modal-body"><div class="class-form-grid"><div class="full"><label>${tr('className')}</label><input id="newClassName" maxlength="80"></div>${[1,2,3].map(n=>`<div class="book-picker-field"><label>${tr(`book${n}`)}</label><div class="book-autocomplete"><input id="newBook${n}" autocomplete="off" placeholder="${tr('typeToSearch')}"><div id="newBook${n}Menu" class="book-suggestions"></div></div><div id="newBook${n}Status" class="book-source-status"></div></div>`).join('')}<div class="full"><label>${tr('fallbackLevel')}</label><select id="newClassLevel">${levelOptions()}</select></div><div class="form-hint full">${tr('hint')}</div><div class="msg full" id="addClassMsg"></div></div></div><div class="modal-foot"><button class="btn" id="cancelAddClass">${tr('cancel')}</button><button class="btn primary" id="confirmAddClass">${tr('create')}</button></div></div>`;
    ['newBook1','newBook2','newBook3'].forEach(bindPicker);
    document.getElementById('closeAddClass').onclick=close;document.getElementById('cancelAddClass').onclick=close;document.getElementById('confirmAddClass').onclick=createClass;
  }
  function open(){renderModal();modal.classList.add('show');setTimeout(()=>document.getElementById('newClassName')?.focus(),20)}
  function close(){modal.classList.remove('show');closeMenus();searchControllers.forEach(c=>c.abort())}
  async function loadClasses(){try{const data=await api(apiUrl);classRows=data.classes||[];const names=classRows.map(c=>c.name).filter(Boolean);if(names.length){canonical.splice(0,canonical.length,...names);buildFilters();renderClasses()}}catch(e){console.error(e)}}
  window.renderClasses=function(){const counts=Object.fromEntries(canonical.map(c=>[c,0]));students.forEach(s=>{if(counts[s.class]!==undefined)counts[s.class]++});const byName=new Map(classRows.map(c=>[c.name,c]));document.getElementById('classGrid').innerHTML=canonical.map(name=>{const row=byName.get(name)||{},books=(row.books||[]).filter(b=>b.book_title);const meta=books.length?`<div class="class-meta"><b>${tr('books')}:</b> ${books.map(b=>`<span class="book-chip ${b.source_type==='manual'?'manual':''}">${esc(b.book_title)} <small>${b.source_type==='manual'?tr('manualBadge'):tr('catalogBadge')}</small></span>`).join(' ')}</div>`:row.level?`<div class="class-meta"><b>${tr('level')}:</b> ${esc(row.level)}</div>`:'';return`<div class="card class-card"><h3>${esc(name)}</h3>${meta}<div class="count">${counts[name]||0}</div><div class="mut">${tr('students')}</div><button data-view-class="${esc(name)}">${tr('viewRoster')}</button></div>`}).join('');document.querySelectorAll('[data-view-class]').forEach(b=>b.onclick=()=>{document.getElementById('classFilter').value=b.dataset.viewClass;apply();setPage('students')})};
  function selectedBook(id){const value=document.getElementById(id).value.trim();if(!value)return null;const found=selectedBooks.get(id);return found?{book_id:found.book_id,title:found.title,series:found.series,level:found.level,source_type:'catalog'}:{book_id:null,title:value,series:null,level:null,source_type:'manual'}}
  async function createClass(){const name=document.getElementById('newClassName').value.trim().replace(/\s+/g,' '),books=['newBook1','newBook2','newBook3'].map(selectedBook).filter(Boolean),level=document.getElementById('newClassLevel').value,msg=document.getElementById('addClassMsg');if(!name){msg.textContent=tr('required');return}if(canonical.some(c=>c.toLowerCase()===name.toLowerCase())){msg.textContent=tr('duplicate');return}close();const temp={name,books:books.map((b,i)=>({id:`temp-${i}`,book_id:b.book_id,book_title:b.title,source_type:b.source_type,catalog_series:b.series,catalog_level:b.level})),level:books.length?null:(level||null)};try{await window.AdminOptimistic.run({key:`class:${name.toLowerCase()}`,apply:()=>{classRows.push(temp);canonical.push(name);canonical.sort((a,b)=>a.localeCompare(b));buildFilters();renderClasses()},request:()=>api(apiUrl,{method:'POST',body:JSON.stringify({name,books,level:books.length?null:level})}),rollback:()=>{classRows=classRows.filter(c=>c!==temp);const i=canonical.indexOf(name);if(i>=0)canonical.splice(i,1);buildFilters();renderClasses()},commit:r=>{const i=classRows.indexOf(temp);if(i>=0)classRows[i]=r.class},onError:e=>showToast(`${tr('failed')}: ${e.message}`,{error:true,duration:6500})})}catch{}}
  function applyLanguage(){button.textContent=tr('addClass');if(modal.classList.contains('show'))renderModal();renderClasses()}
  button.onclick=open;modal.onclick=e=>{if(e.target===modal)close()};document.addEventListener('click',e=>{if(!e.target.closest('.book-autocomplete'))closeMenus()});document.addEventListener('willena-language-change',applyLanguage);document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal.classList.contains('show'))close()});applyLanguage();loadClasses();
})();
