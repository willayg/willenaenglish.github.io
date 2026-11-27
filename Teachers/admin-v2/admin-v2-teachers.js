// Restricted teacher account manager. Authorization is enforced server-side.
const API='https://fiieuiktlsivwfgyivai.supabase.co/functions/v1/teacher-management-owner-v1';
const API_KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
let tokenRefresh=null;
const root=document.getElementById('view-teachers-manager');
const nav=document.querySelector('[data-view="teachers-manager"]');
const $=(s,r=root)=>r.querySelector(s);
let people=[],loaded=false,activeTab='active',actorId=null,actorIsOwner=false;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;'}[c]));
async function freshToken(){
 if(!tokenRefresh)tokenRefresh=(async()=>{
  const fn=window.WillenaAPI?.fetch||window.fetch.bind(window);
  const response=await fn('/.netlify/functions/supabase_auth?action=refresh&_='+Date.now(),{credentials:'include',cache:'no-store'});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||!data.success||!data.access_token)throw Error('Session could not be refreshed. Please sign in again.');
  window.WillenaAPI?.setLocalTokens?.(data.access_token,data.refresh_token||'');
  return data.access_token;
 })().finally(()=>{tokenRefresh=null});
 return tokenRefresh;
}
async function request(action,body){
 let token=window.WillenaAPI?.getLocalAccessToken?.()||null;
 if(!token)token=await freshToken();
 const send=t=>fetch(API+'?action='+encodeURIComponent(action),{method:body?'POST':'GET',credentials:'omit',cache:'no-store',headers:{'Content-Type':'application/json','apikey':API_KEY,'Authorization':'Bearer '+t},...(body?{body:JSON.stringify(body)}:{})});
 let response=await send(token);
 if(response.status===401){token=await freshToken();response=await send(token)}
 const data=await response.json().catch(()=>({}));
 if(!response.ok||data.success!==true)throw Error(data.error||data.message||'Teacher manager request failed ('+response.status+')');
 return data;
}
function message(value,error=false){const el=$('#tmMessage');el.textContent=value;el.style.color=error?'#b83d64':'#53757f';}
function render(){
 $('#tmCount').textContent=people.filter(x=>x.approved).length+' active · '+people.filter(x=>!x.approved).length+' retired';
 const q=$('#tmSearch').value.trim().toLowerCase();
 $('#tmActiveCount').textContent=people.filter(x=>x.approved).length;
 $('#tmArchiveCount').textContent=people.filter(x=>!x.approved).length;
 root.querySelectorAll('[data-tm-tab]').forEach(button=>{
  const active=button.dataset.tmTab===activeTab;button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active));
 });
 $('#tmAddPanel').hidden=activeTab==='archive';
 const items=people.filter(x=>(activeTab==='active'?x.approved:!x.approved)&&[x.name,x.username,x.email].join(' ').toLowerCase().includes(q));
 const list=$('#tmList');list.replaceChildren();
 for(const teacher of items){
  const item=document.createElement('div');item.className='tm-person';
  const details=document.createElement('div');details.className='tm-person-details';
  const title=document.createElement('strong');title.textContent=teacher.name||teacher.username||'Teacher';
  const sub=document.createElement('small');sub.textContent=[teacher.username,teacher.email,teacher.is_owner?'Owner':teacher.role==='admin'?'Admin':'Teacher'].filter(Boolean).join(' · ');
  details.append(title,sub);
  const status=document.createElement('span');status.className='tm-state '+(teacher.approved?'active':'retired');status.textContent=teacher.approved?'Active':'Retired';
  item.append(details,status);
  if(teacher.is_owner){const badge=document.createElement('span');badge.className='tm-state';badge.textContent='Owner';badge.style.cssText='background:#fff1c6;color:#93660a';item.append(badge)}
  const edit=document.createElement('button');edit.type='button';edit.className='control';edit.textContent='Edit';edit.onclick=()=>editTeacher(teacher);if(teacher.role==='teacher'||actorIsOwner||String(teacher.id)===String(actorId))item.append(edit);
  if(teacher.role==='teacher'&&!teacher.is_owner){
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
  else{const protectedLabel=document.createElement('small');protectedLabel.textContent=teacher.is_owner?'Protected account':'Admin account';item.append(protectedLabel)}
  list.append(item);
 }
 if(!items.length)list.textContent=q?'No matching teachers.':activeTab==='archive'?'No archived accounts.':'No active teachers.';
}

function roleField(value,locked=false){
 const label=document.createElement('label');label.textContent='Role';
 const select=document.createElement('select');select.className='control';select.setAttribute('aria-label','Role');
 select.style.cssText='width:100%;min-height:42px;box-sizing:border-box;background:#fff;color:#294b58;border:1px solid #d4e3e8;border-radius:10px;padding:10px;font:inherit';
 for(const [id,name] of [['teacher','Teacher'],['admin','Admin']]){const option=document.createElement('option');option.value=id;option.textContent=name;select.append(option)}
 select.value=value;select.disabled=locked;label.append(select);
 const hint=document.createElement('small');hint.textContent=locked?'Role changes are restricted.':'Admin grants administrative access.';label.append(hint);
 return {label,select};
}
function editTeacher(teacher){
 const dialog=document.createElement('dialog');
 dialog.setAttribute('aria-labelledby','tmEditTitle');
 Object.assign(dialog.style,{width:'min(440px, calc(100% - 32px))',maxHeight:'85dvh',overflow:'auto',boxSizing:'border-box',border:'1px solid #d4e3e8',borderRadius:'16px',padding:'22px',background:'#fff',color:'#294b58',boxShadow:'0 16px 60px #203b4933'});
 const title=document.createElement('h2');title.id='tmEditTitle';title.textContent='Edit teacher';title.style.margin='0 0 6px';
 const form=document.createElement('form');form.className='tm-form';
 const field=(label,value,options={})=>{
  const wrap=document.createElement('label');wrap.textContent=label;
  const input=document.createElement('input');Object.assign(input,options);input.value=value??'';wrap.append(input);form.append(wrap);return input;
 };
 const name=field('Full name',teacher.name,{required:true,maxLength:120,autocomplete:'off'});
 const username=field('Username',teacher.username,{maxLength:80,autocomplete:'off'});
 const email=field('Login email',teacher.email,{type:'email',readOnly:true});email.style.background='#f4f7f8';
 const ownAccount=!actorId||String(teacher.id)===String(actorId);
 const roleLocked=ownAccount||teacher.is_owner||!actorIsOwner;
 const {label:roleLabel,select:role}=roleField(teacher.role,roleLocked);if(teacher.is_owner){role.options[role.selectedIndex].textContent='Owner (Admin)';roleLabel.lastChild.textContent='Owner privileges are protected.'}form.append(roleLabel);
 const note=document.createElement('small');note.textContent='Login email is read-only. Teaching history and class assignments are preserved.';form.append(note);
 const feedback=document.createElement('small');feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');
 const actions=document.createElement('div');Object.assign(actions.style,{display:'flex',gap:'8px',flexWrap:'wrap'});
 const button=(label,type='button')=>{const b=document.createElement('button');b.type=type;b.className='control';b.textContent=label;return b};
 const save=button('Save changes','submit');save.classList.add('admin-primary');
 const cancel=button('Cancel');actions.append(save,cancel);form.append(actions);
 const divider=document.createElement('hr');divider.style.cssText='border:0;border-top:1px solid #e1e9ed;margin:18px 0 6px';
 const passwordForm=document.createElement('form');passwordForm.className='tm-form';
 const pwLabel=document.createElement('label');pwLabel.textContent='New password';
 const password=document.createElement('input');password.type='password';password.minLength=8;password.required=true;password.autocomplete='new-password';pwLabel.append(password);
 const pwNote=document.createElement('small');pwNote.textContent='Optional. Reset separately only when the teacher needs a new password.';
 const reset=button('Reset password','submit');passwordForm.append(pwLabel,pwNote,reset);
 dialog.append(title,form);if(teacher.role==='teacher')dialog.append(divider,passwordForm);dialog.append(feedback);root.append(dialog);
 let busy=false;
 const lock=value=>{busy=value;[name,username,password,save,cancel,reset].forEach(el=>el.disabled=value);role.disabled=value||roleLocked};
 const tell=(value,error=false)=>{feedback.textContent=value;feedback.style.color=error?'#b83d64':'#28785d'};
 cancel.onclick=()=>dialog.close();
 dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault()});
 dialog.addEventListener('close',()=>dialog.remove(),{once:true});
 form.addEventListener('submit',async e=>{
  e.preventDefault();if(busy)return;
  const nextName=name.value.trim(),nextUsername=username.value.trim();
  if(!nextName){tell('Full name is required.',true);return}
  const payload={user_id:teacher.id};
  if(nextName!==String(teacher.name??''))payload.name=nextName;
  if(nextUsername!==String(teacher.username??'')){
   if(!nextUsername){tell('Username cannot be blank when changing it.',true);return}
   payload.username=nextUsername;
  }
  if(!roleLocked&&role.value!==teacher.role){
   if(!['teacher','admin'].includes(role.value)){tell('Select a valid role.',true);return}
   if(!confirm('Change '+(teacher.name||teacher.username)+' to '+(role.value==='admin'?'Admin? This grants administrative access.':'Teacher? This removes administrative access.')))return;
   payload.role=role.value;
  }
  if(Object.keys(payload).length===1){dialog.close();return}
  lock(true);tell('Saving changes…');
  try{
   await request('update',payload);
   Object.assign(teacher,payload.name!==undefined?{name:payload.name}:{},payload.username!==undefined?{username:payload.username.toLowerCase()}:{},payload.role!==undefined?{role:payload.role}:{});
   render();dialog.close();message('Teacher details saved.');
   await refresh().catch(()=>message('Teacher details saved. Refresh the list if needed.'));
  }catch(err){tell(err.message,true)}
  finally{lock(false)}
 });
 passwordForm.addEventListener('submit',async e=>{
  e.preventDefault();if(busy)return;
  if(password.value.length<8){tell('Password must be at least 8 characters.',true);return}
  if(!confirm('Reset the password for '+(teacher.name||teacher.username)+'?'))return;
  lock(true);tell('Resetting password…');
  try{await request('reset_password',{user_id:teacher.id,password:password.value});password.value='';tell('Password reset successfully.');}
  catch(err){tell(err.message,true)}
  finally{lock(false)}
 });
 dialog.showModal();
}

async function refresh(){const data=await request('list');people=data.teachers||[];actorId=data.actor_id||null;actorIsOwner=data.actor_is_owner===true;loaded=true;if(createRole){createRole.options[1].disabled=!actorIsOwner;if(!actorIsOwner)createRole.value='teacher'}render();}
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
root.querySelectorAll('[data-tm-tab]').forEach(button=>button.addEventListener('click',()=>{activeTab=button.dataset.tmTab;render()}));
$('#tmRefresh')?.addEventListener('click',()=>refresh().catch(e=>message(e.message,true)));
const createForm=$('#tmCreateForm');
let createRole;
if(createForm){const field=roleField('teacher');createRole=field.select;createRole.options[1].disabled=true;createForm.insertBefore(field.label,$('#tmPassword').closest('label'));}
createForm?.addEventListener('submit',async e=>{
 e.preventDefault();const form=e.currentTarget;const button=$('#tmCreate');button.disabled=true;message('Creating teacher…');
 try{
  const payload={name:$('#tmName').value.trim(),email:$('#tmEmail').value.trim(),username:$('#tmUsername').value.trim(),password:$('#tmPassword').value,role:createRole?.value||'teacher'};
  if(!payload.name||!payload.email||payload.password.length<8)throw Error('Provide a name, email and password of at least 8 characters.');
  if(payload.role==='admin'&&!actorIsOwner)throw Error('Only owners can create admin accounts.');
  if(payload.role==='admin'&&!confirm('Create an Admin account with administrative access?'))return;
  await request('create',payload);form.reset();if(createRole)createRole.value='teacher';await refresh();message('Teacher added successfully.');
 }catch(err){message(err.message,true)}
 finally{button.disabled=false}
});
