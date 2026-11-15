import {CHARACTER_REGISTRY,registryDiagnostics} from './character-registry.js?v=20261115-cmpreview1';
import {mountCharacter,characterThumbnailMarkup,validateCharacterAssets} from './character-runtime.js?v=20261115-cmpreview1';
const $=s=>document.querySelector(s);
let current=null;
let characterStage=null;
let effectTimer=null;
const portrait=(c,instance)=>characterThumbnailMarkup(c.id,instance);
function selectCharacter(id){
 const c=CHARACTER_REGISTRY.find(c=>c.id===id);if(!c)return;
 current=c;
 for(const node of document.querySelectorAll('.character'))node.setAttribute('aria-pressed',String(node.dataset.id===id));
 const stage=$('#stage');if(effectTimer){clearTimeout(effectTimer);effectTimer=null}
 characterStage?.destroy?.();characterStage=mountCharacter(stage,c.id);
 $('#name').textContent=c.name;$('#personality').textContent=c.personality;
 const info=$('#info');info.replaceChildren();
 const fields=[['Character ID',c.id],['Unlock points',c.unlockPoints.toLocaleString()],['Voice provider',c.voiceProvider],['Voice ID',c.voiceId],['Animation states',c.states.join(', ')],['Publishing status',c.status]];
 for(const [key,value]of fields){const label=document.createElement('dt'),out=document.createElement('dd');label.textContent=key;out.textContent=value;info.append(label,out)}
 const controls=$('#states');controls.replaceChildren();
 const available=c.states.slice();
 if(c.id==='willy')available.push('happy','sad','angry','cat');
 if(c.id==='dusk')available.push('squint','glance','nod','shake','spark','aura');
 if(c.id==='steve')available.push('grumpy');
 for(const state of [...new Set(available)]){
  const b=document.createElement('button');b.type='button';b.textContent=state;b.dataset.state=state;b.setAttribute('aria-pressed',String(state==='idle'));
  b.onclick=()=>{
   if(effectTimer){clearTimeout(effectTimer);effectTimer=null}
   const actor=characterStage.actor;
   const dusk=actor.querySelector('.ft-dusk-actor');
   if(dusk)delete dusk.dataset.duskEffect;
   actor.dataset.mood='neutral';
   if(['happy','sad','angry','cat'].includes(state)){
     characterStage.setPhase('speaking');actor.dataset.mood=state;
   }else if(['squint','glance','nod','shake','spark','aura'].includes(state)){
     characterStage.setPhase('idle');
     if(dusk){
       // Restart one-shot CSS keyframes when the same reaction is pressed twice.
       void dusk.offsetWidth;
       dusk.dataset.duskEffect=state;
       if(state!=='squint'&&state!=='glance')effectTimer=setTimeout(()=>{if(dusk.isConnected)delete dusk.dataset.duskEffect},1800);
     }
   }else if(state==='grumpy'){
     characterStage.setPhase('idle');actor.dataset.steveMood='stern';
   }else{
     characterStage.setPhase(state);
   }
   for(const button of controls.children)button.setAttribute('aria-pressed',String(button===b));
   $('#previewStatus').textContent='Preview: '+state+' · using Free Talking animation rules';
  };
  controls.append(b);
 }
 $('#previewStatus').textContent='Preview: idle · live animation styles';
}
function mount(){
 const issues=[...registryDiagnostics(),...validateCharacterAssets()];
 $('#health').textContent=issues.length?issues.length+' registry issues':'✓ '+CHARACTER_REGISTRY.length+' registered characters';
 $('#health').title=issues.join('\n');
 const box=$('#characters');
 for(const c of CHARACTER_REGISTRY){
  const button=document.createElement('button');button.type='button';button.className='character';button.dataset.id=c.id;button.setAttribute('aria-pressed','false');
  const icon=document.createElement('span');icon.className='portrait';icon.innerHTML=portrait(c,'picker-'+c.id);
  const details=document.createElement('span');const name=document.createElement('strong'),small=document.createElement('small');name.textContent=c.name;small.textContent=c.unlockPoints.toLocaleString()+' points · '+c.status;details.append(name,small);button.append(icon,details);button.onclick=()=>selectCharacter(c.id);box.append(button);
 }
 $('#copy').onclick=()=>{if(!current)return;navigator.clipboard?.writeText(JSON.stringify(current,null,2)).then(()=>{$('#previewStatus').textContent='Configuration copied'},()=>{$('#previewStatus').textContent='Clipboard unavailable'})};
 selectCharacter('steve');
}
async function checkStaff(){
 try{
  const request=async(path)=>{const target=window.WillenaAPI?.getApiUrl?.(path)||path;const res=await fetch(target,{credentials:'include'});const data=await res.json();if(!res.ok||data.success===false)throw Error(data.error||'Not authenticated');return data};
  const who=await request('/.netlify/functions/supabase_auth?action=whoami');
  if(!who.user_id)throw Error('Please sign in as a teacher');
  const role=await request('/.netlify/functions/supabase_auth?action=get_role&user_id='+encodeURIComponent(who.user_id));
  if(!['teacher','admin','owner'].includes(String(role.role||'').toLowerCase()))throw Error('Teacher access required');
  $('#identity').textContent='Staff preview only';$('#main').hidden=false;mount();
 }catch(error){$('#identity').textContent='Access restricted';$('#access').textContent=String(error.message||error)+'. Sign in through the Teachers Dashboard first.'}
}
mount();