import {ensureTeacherSession} from '/Teachers/auth-refresh.js?v=20261021-sessionfix1';

const root = document.querySelector('#view-admissions');
const byId = id => root.querySelector('#admission-'+id);
const detail = byId('detail');
const dateFormat = new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
const date = value => value ? dateFormat.format(new Date(value)) : '—';
const phone = number => number.replace(/^(0\d{1,2})(\d{3,4})(\d{4})$/,'$1-$2-$3');
let year = 2027, tab = 'wait', records = [], requestNumber = 0, loaded = false, bound = false, changing = false;

async function request(action, cohort, id) {
  const url = '/api/admissions?' + new URLSearchParams({action,year:cohort});
  const options = {credentials:'same-origin',cache:'no-store'};
  if (id) Object.assign(options,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});
  let response = await fetch(url,options);
  if (response.status === 401) {
    const session = await ensureTeacherSession();
    if (session?.success) response = await fetch(url,options);
  }
  const result = await response.json().catch(()=>({}));
  if (!response.ok || result.success !== true) throw new Error(result.error || '입학 관리 서버에 연결할 수 없습니다.');
  return result;
}

function element(tag, text, className) {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (className) el.className = className;
  return el;
}
function button(label, handler, style) {
  const el = element('button',label,style);
  el.type = 'button'; el.addEventListener('click',handler); return el;
}
function badge(label,done) { return element('span',label,'adm-badge'+(done?' done':'')); }
function addCells(row, values) {
  values.forEach(value => {
    const cell = element('td');
    if (value instanceof Node) cell.append(value); else cell.textContent = value;
    row.append(cell);
  });
}

function draw() {
  const seminar = tab === 'seminar';
  for (const b of root.querySelectorAll('[data-admission-tab]')) b.setAttribute('aria-pressed',String(b.dataset.admissionTab === tab));
  for (const b of root.querySelectorAll('[data-cohort]')) b.setAttribute('aria-pressed',String(Number(b.dataset.cohort) === year));
  byId('title').textContent = seminar ? year+'년 신입생 입학설명회' : year+'년 대기 명단';
  const event = byId('event'); event.hidden = !seminar;
  event.textContent = year===2027 ? '2027년 1월 9일(토) 오전 11시 · 대은로 83 루비프라자 6층' : '등록된 설명회 일정이 없습니다.';
  const confirmed = records.filter(row => row.confirmed_at);
  const list = seminar ? confirmed : records;
  const counts = seminar
    ? [['안내 대상',confirmed.length],['안내 완료',confirmed.filter(r=>r.notified_at).length],['신청 완료',confirmed.filter(r=>r.seminar_applied_at).length]]
    : [['접수',records.length],['확인 대기',records.length-confirmed.length],['연장 확정',confirmed.length]];
  byId('counts').replaceChildren(...(loaded ? counts.map(([label,n])=>{
    const span=element('span',label); span.append(element('b',n+'명'));return span;
  }) : []));
  const columns = seminar ? ['학생 이름','보호자 연락처','안내 상태','설명회 신청'] : ['학생 이름','출생연도 / 학년','보호자 연락처','접수 일시','연장 상태','설명회 안내'];
  byId('head').replaceChildren(...columns.map(title=>{const th=element('th',title);th.scope='col';return th;}));
  const q = byId('search').value.replace(/[\s-]/g,'').toLowerCase();
  const matches = list.filter(r=>!q||r.student_name.replace(/\s/g,'').toLowerCase().includes(q)||r.guardian_phone.includes(q));
  byId('body').replaceChildren(...matches.map(r=>{
    const row=element('tr'), name=button(r.student_name,()=>openDetail(r),'adm-row-btn');
    if(seminar) addCells(row,[name,phone(r.guardian_phone),badge(r.notified_at?'안내 완료':'안내 전',!!r.notified_at),badge(r.seminar_applied_at?'신청 완료':'미신청',!!r.seminar_applied_at)]);
    else addCells(row,[name,r.birth_grade,phone(r.guardian_phone),date(r.created_at),badge(r.confirmed_at?'연장 확정':'확인 대기',!!r.confirmed_at),r.confirmed_at?'안내 대상':'—']);
    return row;
  }));
  const empty=byId('empty');
  empty.hidden=!loaded||matches.length>0;
  empty.textContent=q?'검색 결과가 없습니다.':(seminar?'대기 연장이 확정된 학생이 여기에 표시됩니다.':'접수된 대기 연장 신청이 없습니다.');
}

async function refresh({silent=false}={}) {
  const ticket=++requestNumber, requestedYear=year;
  if(!silent) byId('message').textContent='신청 내역을 불러오고 있습니다.';
  try {
    const {records:rows}=await request('list',requestedYear);
    if(ticket!==requestNumber||requestedYear!==year)return;
    records=rows; loaded=true; byId('message').textContent=''; draw();
  } catch(e) {
    if(ticket!==requestNumber)return;
    records=[];loaded=false; if(detail.open)detail.close();
    byId('message').textContent=e.message; draw();
  }
}

function openDetail(row) {
  const fields=byId('fields');
  const pairs=[['출생연도 / 학년',row.birth_grade],['보호자 연락처',phone(row.guardian_phone)],['현재 유치원 또는 학교',row.school],['접수 일시',date(row.created_at)],['학원에 전할 내용',row.parent_note||'—']];
  if(row.confirmed_at)pairs.push(['연장 확정',date(row.confirmed_at)]);
  if(row.notified_at)pairs.push(['안내 완료',date(row.notified_at)]);
  if(row.seminar_applied_at)pairs.push(['설명회 신청',date(row.seminar_applied_at)]);
  byId('detail-name').textContent=row.student_name;
  fields.replaceChildren(...pairs.flatMap(([label,value])=>[element('dt',label),element('dd',value)]));
  byId('link-label').hidden=true; byId('link').value=''; byId('action-status').textContent='';
  const actions=byId('actions'); actions.replaceChildren();
  if(!row.confirmed_at) actions.append(button('연장 확정',()=>change('confirm',row),'primary'));
  if(row.confirmed_at && tab==='seminar' && row.invitation_key) {
    const url = 'https://willenaenglish.com/admissions/briefing-2027/#'+row.invitation_key;
    actions.append(button('초대 링크 복사',async()=>{
      try { await navigator.clipboard.writeText(url); byId('action-status').textContent='개별 초대 링크를 복사했습니다.'; }
      catch { byId('link-label').hidden=false;const link=byId('link');link.value=url;link.select();byId('action-status').textContent='선택된 링크를 복사해 주세요.'; }
    },'primary'));
    if(!row.notified_at)actions.append(button('안내 완료 표시',()=>change('notified',row)));
  }
  actions.append(button('신청 삭제',()=>change('remove',row),'danger'));
  if(!detail.open)detail.showModal();
}

async function change(action,row) {
  if(changing)return;
  if(action==='remove'&&!window.confirm(row.student_name+' 학생의 대기 연장 신청과 설명회 내역을 삭제할까요?'))return;
  if(action==='confirm'&&!window.confirm(row.student_name+' 학생을 기존 대기 명단과 대조하셨나요? 확정하면 설명회 안내 대상이 됩니다.'))return;
  changing=true; const cohort=year;
  byId('actions').querySelectorAll('button').forEach(b=>{b.disabled=true;});byId('action-status').textContent='저장 중…';
  try {
    await request(action,cohort,row.id);
    if(detail.open)detail.close();
    await refresh();
  } catch(e) {
    byId('action-status').textContent=e.message;
    byId('actions').querySelectorAll('button').forEach(b=>{b.disabled=false;});
  } finally { changing=false; }
}

function refreshVisible() {
  if(root.classList.contains('active')&&!document.hidden&&!detail.open&&!changing) refresh({silent:true});
}
export function openAdmissions() {
  if(!root.classList.contains('active'))return;
  if(!bound){
    bound=true;
    for(const b of root.querySelectorAll('[data-cohort]')) b.addEventListener('click',()=>{
      const next=Number(b.dataset.cohort); if(year===next)return;year=next;records=[];loaded=false;draw();refresh();
    });
    for(const b of root.querySelectorAll('[data-admission-tab]')) b.addEventListener('click',()=>{tab=b.dataset.admissionTab;draw();refresh({silent:loaded});});
    byId('search').addEventListener('input',draw);
    byId('close').addEventListener('click',()=>detail.close());
    detail.addEventListener('close',()=>{byId('link').value='';byId('actions').replaceChildren();byId('fields').replaceChildren();});
    byId('refresh').addEventListener('click',()=>refresh());
    document.addEventListener('visibilitychange',refreshVisible);
    window.addEventListener('focus',refreshVisible);
    setInterval(refreshVisible,15000);
  }
  draw();return refresh();
}
