(()=>{
  const apiUrl='/.netlify/functions/admin_classes';
  const text={
    ko:{addClass:'반 추가',className:'반 이름',level:'레벨',room:'교실',capacity:'정원',notes:'메모',cancel:'취소',create:'반 만들기',hint:'새 반은 즉시 화면에 표시되고 백그라운드에서 저장됩니다.',required:'반 이름을 입력해 주세요.',duplicate:'이미 사용 중인 반 이름입니다.',capacityError:'정원은 1~100 사이의 숫자여야 합니다.',failed:'반을 만들지 못했습니다',created:'{name} 반을 만들었습니다.'},
    en:{addClass:'Add class',className:'Class name',level:'Level',room:'Room',capacity:'Capacity',notes:'Notes',cancel:'Cancel',create:'Create class',hint:'The class appears immediately while it saves in the background.',required:'Enter a class name.',duplicate:'That class name already exists.',capacityError:'Capacity must be a number from 1 to 100.',failed:'Could not create class',created:'Created {name}.'}
  };
  const lang=()=>window.AdminI18n?.language||'ko';
  const tr=(k,v={})=>{let s=text[lang()]?.[k]||text.en[k]||k;for(const [a,b] of Object.entries(v))s=s.replaceAll(`{${a}}`,b);return s};
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  const classesPage=document.getElementById('classes');
  if(!classesPage)return;
  const bar=document.createElement('div');
  bar.className='toolbar';
  const spacer=document.createElement('div');spacer.style.flex='1';
  const button=document.createElement('button');button.className='btn primary';button.id='addClassBtn';
  bar.append(spacer,button);
  classesPage.insertBefore(bar,document.getElementById('classGrid'));

  const modal=document.createElement('div');modal.className='modal-bg';modal.id='addClassModal';document.body.appendChild(modal);
  let classRows=[];

  function renderModal(){
    modal.innerHTML=`<div class="modal"><div class="modal-head"><h3>${tr('addClass')}</h3><button class="close" id="closeAddClass">×</button></div><div class="modal-body"><div class="form"><div><label>${tr('className')}</label><input id="newClassName" maxlength="80"></div><div><label>${tr('level')}</label><input id="newClassLevel"></div><div><label>${tr('room')}</label><input id="newClassRoom"></div><div><label>${tr('capacity')}</label><input id="newClassCapacity" type="number" min="1" max="100"></div><div><label>${tr('notes')}</label><input id="newClassNotes"></div><div class="form-hint">${tr('hint')}</div><div class="msg" id="addClassMsg"></div></div></div><div class="modal-foot"><button class="btn" id="cancelAddClass">${tr('cancel')}</button><button class="btn primary" id="confirmAddClass">${tr('create')}</button></div></div>`;
    document.getElementById('closeAddClass').onclick=close;
    document.getElementById('cancelAddClass').onclick=close;
    document.getElementById('confirmAddClass').onclick=createClass;
  }
  function open(){renderModal();modal.classList.add('show');setTimeout(()=>document.getElementById('newClassName')?.focus(),20)}
  function close(){modal.classList.remove('show')}

  async function loadClasses(){
    try{
      const data=await api(apiUrl);
      classRows=data.classes||[];
      const names=classRows.map(c=>c.name).filter(Boolean);
      if(names.length){canonical.splice(0,canonical.length,...names);buildFilters();renderClasses()}
    }catch(e){console.error('Could not load classes',e)}
  }

  async function createClass(){
    const name=document.getElementById('newClassName').value.trim().replace(/\s+/g,' ');
    const level=document.getElementById('newClassLevel').value.trim();
    const room=document.getElementById('newClassRoom').value.trim();
    const rawCapacity=document.getElementById('newClassCapacity').value;
    const notes=document.getElementById('newClassNotes').value.trim();
    const msg=document.getElementById('addClassMsg');
    if(!name){msg.textContent=tr('required');return}
    if(canonical.some(c=>c.toLowerCase()===name.toLowerCase())){msg.textContent=tr('duplicate');return}
    if(rawCapacity!==''&&(Number(rawCapacity)<1||Number(rawCapacity)>100||!Number.isInteger(Number(rawCapacity)))){msg.textContent=tr('capacityError');return}
    close();
    const tempName=name;
    const apply=()=>{canonical.push(tempName);canonical.sort((a,b)=>a.localeCompare(b));buildFilters();renderClasses()};
    const rollback=()=>{const i=canonical.indexOf(tempName);if(i>=0)canonical.splice(i,1);buildFilters();renderClasses()};
    try{
      await window.AdminOptimistic.run({
        key:`class:${name.toLowerCase()}`,
        apply,
        request:()=>api(apiUrl,{method:'POST',body:JSON.stringify({name,level,room,capacity:rawCapacity===''?null:Number(rawCapacity),notes})}),
        rollback,
        commit:result=>{classRows.push(result.class)},
        onError:error=>showToast(`${tr('failed')}: ${error.message}`,{error:true,duration:6500})
      });
    }catch{}
  }

  function applyLanguage(){button.textContent=tr('addClass');if(modal.classList.contains('show'))renderModal()}
  button.onclick=open;modal.onclick=e=>{if(e.target===modal)close()};
  document.addEventListener('willena-language-change',applyLanguage);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal.classList.contains('show'))close()});
  applyLanguage();
  loadClasses();
})();
