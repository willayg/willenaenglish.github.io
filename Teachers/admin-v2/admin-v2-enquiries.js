const root=document.getElementById('view-enquiries');
const api='/api/enquiries';
const $=selector=>root.querySelector(selector)||document.querySelector(selector);
const STATUS={new:'신규',contacted:'연락 완료',consultation:'상담 예약',enrolled:'등록 완료',closed:'종료'};
const TYPES={level_test:'레벨 테스트',tuition:'수강료',classes:'수업 / 시간표',other:'기타'};
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[char]));
let rows=[],selected=null,lastFetch=0,busy=false,started=false,drawerReturnFocus=null;
async function request(action,body){
 const options={credentials:'include',cache:'no-store',headers:{'Content-Type':'application/json'}};
 if(body){options.method='POST';options.body=JSON.stringify(body)}
 let response=await fetch(api+'?action='+encodeURIComponent(action),options);
 // Existing session repair helper, only on an expired cookie.
 if(response.status===401&&window.ensureTeacherSession){
   const session=await window.ensureTeacherSession();
   if(session?.success)response=await fetch(api+'?action='+encodeURIComponent(action),options);
 }
 const payload=await response.json().catch(()=>({}));
 if(!response.ok||!payload.success)throw Error(payload.error||'문의 내역을 불러오지 못했습니다.');
 return payload;
}
function filtered(){
 const q=$('#enqSearch').value.trim().toLowerCase(),state=$('#enqFilter').value;
 return rows.filter(x=>(!state||x.status===state)&&(!q||[x.parent_name,x.phone,x.student_grade,x.message].some(v=>String(v||'').toLowerCase().includes(q))));
}
function unreadBadge(){
 const n=rows.filter(x=>x.status==='new').length;
 const counter=$('#enqNewCount');if(counter){counter.textContent=String(n);counter.hidden=n===0}
 for(const id of ['adminEnquiryCount','mobileEnquiryCount']){
  const badge=document.getElementById(id);
  if(badge){badge.textContent=n>99?'99+':String(n);badge.hidden=n===0;badge.setAttribute('aria-label',n+' new enquiries')}
 }
}
function render(){
 const display=filtered(),list=$('#enqList');
 $('#enqCount').textContent=display.length+'건';
 unreadBadge();
 list.replaceChildren();
 if(!display.length)list.innerHTML='<div class="enq-empty">표시할 문의가 없습니다.</div>';
 display.forEach(x=>{
  const button=document.createElement('button');button.type='button';button.className='enq-row';
  button.innerHTML='<span class="enq-row-top"><strong>'+esc(x.parent_name)+'</strong><span class="enq-badge '+esc(x.status)+'">'+esc(STATUS[x.status]||x.status)+'</span><span class="enq-row-arrow" aria-hidden="true">›</span></span><small>'+esc(x.student_grade)+' · '+esc(TYPES[x.enquiry_type]||x.enquiry_type)+' · '+new Date(x.created_at).toLocaleString('ko-KR')+'</small><span class="preview">'+esc(x.message)+'</span>';
  button.onclick=()=>openDetail(x.id,button);
  list.append(button);
 });
}
function closeDetail(){
 const drawer=document.getElementById('enqDrawerBg');
 if(!drawer.classList.contains('open'))return;
 drawer.classList.remove('open');
 document.body.classList.remove('enq-drawer-open');
 selected=null;
 $('#enqDetail').replaceChildren();
 if(drawerReturnFocus?.isConnected)drawerReturnFocus.focus({preventScroll:true});
 drawerReturnFocus=null;
}
function openDetail(id,trigger){
 const x=rows.find(r=>r.id===id);if(!x)return;
 selected=id;
 drawerReturnFocus=trigger||document.activeElement;
 const drawer=document.getElementById('enqDrawerBg');
 drawer.classList.add('open');
 document.body.classList.add('enq-drawer-open');
 document.getElementById('enqDrawerName').textContent=x.parent_name+' 님 문의';
 document.getElementById('enqDrawerMeta').textContent=(TYPES[x.enquiry_type]||'상담 문의')+' · '+new Date(x.created_at).toLocaleString('ko-KR');
 detail();
 document.getElementById('enqClose').focus({preventScroll:true});
}
function detail(){
 const x=rows.find(r=>r.id===selected),pane=$('#enqDetail');if(!x)return;
 pane.innerHTML='<div class="enq-meta"><div><small>학생 학년</small>'+esc(x.student_grade)+'</div><div><small>문의 유형</small>'+esc(TYPES[x.enquiry_type]||x.enquiry_type)+'</div><div><small>전화번호</small><a href="tel:'+esc(x.phone)+'">'+esc(x.phone)+'</a></div><div><small>접수일</small>'+new Date(x.created_at).toLocaleString('ko-KR')+'</div></div><div class="enq-detail-message">'+esc(x.message)+'</div><label for="enqStatus">진행 상태</label><select id="enqStatus">'+Object.entries(STATUS).map(([k,v])=>'<option value="'+k+'"'+(k===x.status?' selected':'')+'>'+v+'</option>').join('')+'</select><label for="enqNotes">내부 상담 메모</label><textarea id="enqNotes" maxlength="6000" placeholder="통화 내용, 상담 예약, 후속 조치 등을 기록하세요.">'+esc(x.admin_notes||'')+'</textarea><button id="enqSave" type="button" class="control admin-primary" style="margin-top:12px">변경사항 저장</button><p id="enqSaveResult" class="enq-feedback" role="status"></p>';
 $('#enqSave').addEventListener('click',async()=>{
  const save=$('#enqSave'),newStatus=$('#enqStatus').value,notes=$('#enqNotes').value;
  save.disabled=true;$('#enqSaveResult').textContent='저장 중…';
  try{
   await request('update',{id:x.id,status:newStatus,admin_notes:notes});
   x.status=newStatus;x.admin_notes=notes;
   render();closeDetail();
  }catch(error){$('#enqSaveResult').textContent=error.message;save.disabled=false}
 });
}
export async function refreshEnquiries(force=false){
 if(busy)return;if(!force&&Date.now()-lastFetch<12000)return;
 busy=true;$('#enqRefresh').disabled=true;$('#enqMessage').textContent='';
 try{const data=await request('list');rows=Array.isArray(data.enquiries)?data.enquiries:[];lastFetch=Date.now();
   if(selected&&!rows.some(x=>x.id===selected))closeDetail();render();
 }catch(error){$('#enqMessage').textContent=error.message;
   if(!lastFetch){$('#enqList').innerHTML='<div class="enq-empty">문의 내역을 불러오지 못했습니다.</div>';}
 }finally{busy=false;$('#enqRefresh').disabled=false}
}
export function closeEnquiriesDrawer(){closeDetail()}
export function mountEnquiries(){
 if(!root)return;
 if(!started){
   started=true;
   $('#enqFilter').addEventListener('change',render);
   $('#enqSearch').addEventListener('input',render);
   $('#enqRefresh').addEventListener('click',()=>refreshEnquiries(true));
   document.getElementById('enqClose').addEventListener('click',closeDetail);
   document.getElementById('enqDrawerBg').addEventListener('click',e=>{if(e.target.id==='enqDrawerBg')closeDetail()});
   document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.getElementById('enqDrawerBg').classList.contains('open'))closeDetail()});
   document.addEventListener('visibilitychange',()=>{if(!document.hidden&&root.classList.contains('active'))refreshEnquiries()});
   setInterval(()=>{if(!document.hidden&&root.classList.contains('active'))refreshEnquiries(true)},60000);
 }
 return refreshEnquiries(true);
}

// Unread count is available even before the enquiries view is opened.
export async function refreshEnquiryBadge(){
 if(busy)return;
 try{const data=await request('list');rows=Array.isArray(data.enquiries)?data.enquiries:[];lastFetch=Date.now();unreadBadge();}
 catch(error){console.debug('[Enquiries] Badge refresh unavailable',error.message)}
}
