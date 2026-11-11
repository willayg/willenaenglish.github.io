const root=document.getElementById('view-enquiries');
const api='/api/enquiries';
const $=selector=>root.querySelector(selector);
const STATUS={new:'신규',contacted:'연락 완료',consultation:'상담 예약',enrolled:'등록 완료',closed:'종료'};
const TYPES={level_test:'레벨 테스트',tuition:'수강료',classes:'수업 / 시간표',other:'기타'};
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[char]));
let rows=[],selected=null,lastFetch=0,busy=false,started=false;
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
function render(){
 const display=filtered(),list=$('#enqList');
 $('#enqCount').textContent=display.length+'건';
 $('#enqNewCount').textContent=rows.filter(x=>x.status==='new').length;
 const rail=document.querySelector('#adminEnquiryCount');
 if(rail)rail.textContent=String(rows.filter(x=>x.status==='new').length);
 list.replaceChildren();
 if(!display.length)list.innerHTML='<div class="enq-empty">표시할 문의가 없습니다.</div>';
 display.forEach(x=>{
   const button=document.createElement('button');button.type='button';
   button.className='enq-row'+(x.id===selected?' active':'');
   button.innerHTML='<strong>'+esc(x.parent_name)+'</strong><span class="enq-badge '+esc(x.status)+'">'+esc(STATUS[x.status]||x.status)+'</span><small>'+esc(x.student_grade)+' · '+esc(TYPES[x.enquiry_type]||x.enquiry_type)+' · '+new Date(x.created_at).toLocaleString('ko-KR')+'</small><span class="preview">'+esc(x.message)+'</span>';
   button.onclick=()=>{selected=x.id;render()};
   list.append(button);
 });
 detail();
}
function detail(){
 const x=rows.find(r=>r.id===selected),pane=$('#enqDetail');
 if(!x){pane.innerHTML='<div class="enq-empty">왼쪽에서 문의를 선택하세요.</div>';return}
 pane.innerHTML='<h2 style="margin:2px 0 15px">'+esc(x.parent_name)+' 님 문의</h2><div class="enq-meta"><div><small>학생 학년</small>'+esc(x.student_grade)+'</div><div><small>문의 유형</small>'+esc(TYPES[x.enquiry_type]||x.enquiry_type)+'</div><div><small>전화번호</small><a href="tel:'+esc(x.phone)+'">'+esc(x.phone)+'</a></div><div><small>접수일</small>'+new Date(x.created_at).toLocaleString('ko-KR')+'</div></div><div class="enq-detail-message">'+esc(x.message)+'</div><label for="enqStatus">진행 상태</label><select id="enqStatus">'+Object.entries(STATUS).map(([k,v])=>'<option value="'+k+'"'+(k===x.status?' selected':'')+'>'+v+'</option>').join('')+'</select><label for="enqNotes">내부 상담 메모</label><textarea id="enqNotes" maxlength="6000" placeholder="통화 내용, 상담 예약, 후속 조치 등을 기록하세요.">'+esc(x.admin_notes||'')+'</textarea><button id="enqSave" type="button" class="control admin-primary" style="margin-top:12px">변경사항 저장</button><p id="enqSaveResult" class="enq-feedback" role="status"></p>';
 $('#enqSave').addEventListener('click',async()=>{
   const save=$('#enqSave'),newStatus=$('#enqStatus').value,notes=$('#enqNotes').value;
   save.disabled=true;$('#enqSaveResult').textContent='저장 중…';
   try{await request('update',{id:x.id,status:newStatus,admin_notes:notes});
     x.status=newStatus;x.admin_notes=notes;render();$('#enqSaveResult').style.color='#16816d';$('#enqSaveResult').textContent='저장했습니다.';
   }catch(error){$('#enqSaveResult').textContent=error.message;save.disabled=false}
 });
}
export async function refreshEnquiries(force=false){
 if(busy)return;if(!force&&Date.now()-lastFetch<12000)return;
 busy=true;$('#enqRefresh').disabled=true;$('#enqMessage').textContent='';
 try{const data=await request('list');rows=Array.isArray(data.enquiries)?data.enquiries:[];lastFetch=Date.now();
   if(!rows.some(x=>x.id===selected))selected=rows[0]?.id||null;render();
 }catch(error){$('#enqMessage').textContent=error.message;
   if(!lastFetch){$('#enqList').innerHTML='<div class="enq-empty">문의 내역을 불러오지 못했습니다.</div>';}
 }finally{busy=false;$('#enqRefresh').disabled=false}
}
export function mountEnquiries(){
 if(!root)return;
 if(!started){
   started=true;
   $('#enqFilter').addEventListener('change',render);
   $('#enqSearch').addEventListener('input',render);
   $('#enqRefresh').addEventListener('click',()=>refreshEnquiries(true));
   document.addEventListener('visibilitychange',()=>{if(!document.hidden&&root.classList.contains('active'))refreshEnquiries()});
   setInterval(()=>{if(!document.hidden&&root.classList.contains('active'))refreshEnquiries(true)},60000);
 }
 return refreshEnquiries(true);
}
