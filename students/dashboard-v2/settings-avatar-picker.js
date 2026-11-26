(()=>{
'use strict';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const trigger=$('#settingsModal #profileAvatar'),modal=$('#avatarModal');
if(!trigger||!modal)return;
let selectedAvatar='wa11',characterPoints=NaN,avatarLab=null,saving=false;
const avatarRender=(el,value)=>window.WillenaAvatar.render(el,value);
function status(message,tone=''){const el=$('#dashboardAvatarStatus');if(el){el.textContent=message||'';el.dataset.tone=tone}}
function syncPoints(){const p=window.__willenaDashboardOverview?.points;characterPoints=p==null?NaN:Number(p);refreshCharacterLocks();avatarLab?.sync()}
function openAvatar(){
 if(saving||!trigger.dataset.avatarValue||!window.WillenaAvatar?.characters)return;
 buildEmojiGrid();syncPoints();selectedAvatar=window.WillenaAvatar.normalize(trigger.dataset.avatarValue);
 $$('.emoji-btn',modal).forEach(b=>b.classList.toggle('selected',b.dataset.e===selectedAvatar&&!b.disabled));
 avatarLab?.reset();status('');modal.classList.add('open');modal.setAttribute('aria-hidden','false');$('#avatarClose')?.focus();
}
function closeAvatar(){if(saving)return;modal.classList.remove('open');modal.setAttribute('aria-hidden','true');status('');trigger.focus()}
function refreshCharacterLocks(){const grid=$('#emojiGrid');if(!grid)return;for(const b of $$('.emoji-btn[data-character]',grid)){const c=window.WillenaAvatar.characters.find(x=>x.id===b.dataset.e),locked=!window.WillenaAvatar.eligible(c.id,characterPoints);b.disabled=locked;b.dataset.locked=String(locked);b.title=locked?c.name+' · Unlock at '+c.unlockPoints.toLocaleString()+' points':c.name;b.setAttribute('aria-label',locked?b.title:'Choose '+c.name);}}
function buildEmojiGrid(){const grid=$('#emojiGrid');if(!grid||grid.dataset.ready)return;const options=window.WillenaAvatar.choices;const make=(o)=>{const b=document.createElement('button');b.type='button';b.className='emoji-btn';b.dataset.e=o.id;b.title=o.name;b.setAttribute('aria-label','Choose '+o.name);avatarRender(b,o.id);if(o.character)b.dataset.character=o.character;return b};const list=document.createDocumentFragment();const title=document.createElement('h3');title.className='avatar-category-title';title.textContent='Free Talking Characters';list.append(title);for(const c of window.WillenaAvatar.characters.filter((x,i)=>i%3===0)){const group=document.createElement('section');group.className='ft-avatar-group';const label=document.createElement('div');label.className='ft-avatar-label';label.textContent=c.characterName+(c.unlockPoints?' · '+c.unlockPoints.toLocaleString()+' points':' · Available');const row=document.createElement('div');row.className='ft-avatar-row';row.append(...options.filter(x=>x.character===c.character).map(make));group.append(label,row);list.append(group)}const other=document.createElement('h3');other.className='avatar-category-title';other.textContent='All avatars';list.append(other,...options.filter(x=>!x.character).map(make));grid.replaceChildren(list);grid.dataset.ready='1';refreshCharacterLocks();avatarLab=window.WillenaAvatarLab?.mount({modal:$('#avatarModal'),getSelected:()=>selectedAvatar,getPoints:()=>characterPoints,onChoose:value=>{selectedAvatar=value;$$('.emoji-btn',$('#emojiGrid')).forEach(x=>x.classList.remove('selected'))}})||null;grid.addEventListener('click',e=>{const b=e.target.closest('.emoji-btn');if(!b||b.disabled||!window.WillenaAvatar.eligible(b.dataset.e,characterPoints))return;selectedAvatar=b.dataset.e;$$('.emoji-btn',grid).forEach(x=>x.classList.toggle('selected',x===b));avatarLab?.sync()})}

async function saveAvatar(){
 if(saving)return;syncPoints();
 if(!window.WillenaAvatar.eligible(selectedAvatar,characterPoints)){status('Unlock this character first.','error');return}
 const value=selectedAvatar,btn=$('#avatarSave');saving=true;btn.disabled=true;status('Saving…');
 try{
  const r=await window.WillenaAPI.fetch('/.netlify/functions/supabase_auth?action=update_profile_avatar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({avatar:value})});
  const d=await r.json().catch(()=>({}));if(!r.ok||!d.success)throw Error(d.error||'Could not save avatar.');
  avatarRender(trigger,value);avatarRender($('.header .avatar'),value);
  try{localStorage.setItem('selectedEmojiAvatar',value);localStorage.setItem('avatar',value)}catch{}
  window.dispatchEvent(new CustomEvent('willena:avatar-changed',{detail:{avatar:value}}));
  saving=false;closeAvatar();
 }catch(e){status(e.message||'Could not save avatar.','error')}finally{saving=false;btn.disabled=false}
}
trigger.addEventListener('click',openAvatar);
$('#avatarClose')?.addEventListener('click',closeAvatar);
$('#avatarCancel')?.addEventListener('click',closeAvatar);
$('#avatarSave')?.addEventListener('click',saveAvatar);
modal.addEventListener('click',e=>{if(e.target===modal)closeAvatar()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal.classList.contains('open')){e.preventDefault();e.stopImmediatePropagation();if(avatarLab?.isOpen())avatarLab.back();else closeAvatar()}},true);
document.addEventListener('willena:profile-overview',()=>{if(modal.classList.contains('open'))syncPoints()});
})();