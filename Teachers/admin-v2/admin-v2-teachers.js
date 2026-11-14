// Restricted teacher account manager. Authorization is enforced server-side.
const API='/.netlify/functions/teacher_management';
const root=document.getElementById('view-teachers-manager');
const nav=document.querySelector('[data-view="teachers-manager"]');
const $=(s,r=root)=>r.querySelector(s);
let people=[],loaded=false;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;'}[c]));
async function request(action,body){
 const fn=window.WillenaAPI?.fetch||window.fetch.bind(window);
 const response=await fn(API+'?action='+encodeURIComponent(action),{method:body?'POST':'GET',credentials:'include',cache:'no-store',headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 const data=await response.json().catch(()=>({}));
 if(!response.ok||data.success!==true)throw Error(data.error||'Teacher manager request failed ('+response.status+')');
 return data;
}
function message(value,error=false){const el=$('#tmMessage');el.textContent=value;el.style.color=error?'#b83d64':'#53757f';}
function render(){
 $('#tmCount').textContent=people.filter(x=>x.approved).length+' active · '+people.filter(x=>!x.approved).length+' retired';
 const q=$('#tmSearch').value.trim().toLowerCase(),filter=$('#tmFilter').value;
 const items=people.filter(x=>(filter==='all'||(filter==='active'?x.approved:!x.approved))&&[x.name,x.username,x.email].join(' ').toLowerCase().includes(q));
 const list=$('#tmList');list.replaceChildren();
 for(const teacher of items){
  const item=document.createElement('div');item.className='tm-person';
  const details=document.createElement('div');details.className='tm-person-details';
  const title=document.createElement('strong');title.textContent=teacher.name||teacher.username||'Teacher';
  const sub=document.createElement('small');sub.textContent=[teacher.username,teacher.email,teacher.role==='admin'?'Admin':''].filter(Boolean).join(' · ');
  details.append(title,sub);
  const status=document.createElement('span');status.className='tm-state '+(teacher.approved?'active':'retired');status.textContent=teacher.approved?'Active':'Retired';
  item.append(details,status);
  if(teacher.role==='teacher'){
   const action=document.createElement('button');action.type='button';action.className='control';
   action.textContent=teacher.approved?'Retire':'Reactivate';
   action.onclick=async()=>{
    const next=!teacher.approved;
    if(!confirm((next?'Reactivate ':'Retire ')+(teacher.name||teacher.username)+'?'+(next?'':' Their account access will be blocked but their history will be retained.')))return;
    action.disabled=true;message('Updating teacher…');
    try{await request('update',{user_id:teacher.id,approved:next});await refresh();message((teacher.name||'Teacher')+(next?' reactivated.':' retired.'))}
    catch(e){message(e.message,true);action.disabled=false}
   };
   item.append(action);
  }
  else{const protectedLabel=document.createElement('small');protectedLabel.textContent='Admin account';item.append(protectedLabel)}
  list.append(item);
 }
 if(!items.length)list.textContent='No matching teachers.';
}
async function refresh(){const data=await request('list');people=data.teachers||[];loaded=true;render();}
export async function checkAccess(){
 if(!root||!nav)return;
 try{await refresh();nav.hidden=false;nav.style.removeProperty('display');}
 catch(e){nav.hidden=true;nav.style.display='none';root.innerHTML='<p class="tm-denied">Teacher Manager is available only to designated administrators.</p>';}
}
export async function open(){
 if(!loaded)await checkAccess();
 if(loaded)await refresh().catch(e=>message(e.message,true));
}
$('#tmSearch')?.addEventListener('input',render);
$('#tmFilter')?.addEventListener('change',render);
$('#tmRefresh')?.addEventListener('click',()=>refresh().catch(e=>message(e.message,true)));
$('#tmCreateForm')?.addEventListener('submit',async e=>{
 e.preventDefault();const form=e.currentTarget;const button=$('#tmCreate');button.disabled=true;message('Creating teacher…');
 try{
  const payload={name:$('#tmName').value.trim(),email:$('#tmEmail').value.trim(),username:$('#tmUsername').value.trim(),password:$('#tmPassword').value};
  if(!payload.name||!payload.email||payload.password.length<8)throw Error('Provide a name, email and password of at least 8 characters.');
  await request('create',payload);form.reset();await refresh();message('Teacher added successfully.');
 }catch(err){message(err.message,true)}
 finally{button.disabled=false}
});
