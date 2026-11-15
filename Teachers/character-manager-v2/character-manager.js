import {CHARACTER_REGISTRY,registryDiagnostics} from '/students/characters-v2/character-registry.js?v=20261115-character-v2-1';
import {BUNNY_FOX_ART,PIGFISH_ART} from '/students/free-talking-genius/character-art.js?v=20261113-willy-wave3';
import {AI_WILLY_HEAD_SVG} from '/students/free-talking-genius/willy-svg.js?v=20261114-electric-cat-v3';
import {DUSK_ART} from '/students/free-talking-genius/dusk-character.js?v=20261114-no-legacy-card1';
import {STEVE_ART} from '/students/free-talking-genius/steve-character.js?v=20261115-steve-sleeve2';
const $=s=>document.querySelector(s);
let current=null;
const art={bunny:BUNNY_FOX_ART,pigfish:PIGFISH_ART,willy:AI_WILLY_HEAD_SVG,dusk:DUSK_ART,steve:STEVE_ART,willi:'<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="39" fill="none" stroke="#6bd6dc" stroke-width="8"/><circle cx="50" cy="50" r="20" fill="none" stroke="#c8eef1" stroke-width="7"/><path d="M50 30A20 20 0 0167 41" fill="none" stroke="#69bfc9" stroke-width="7"/></svg>'};
function clean(html,id){
 // All source artwork is repository-owned SVG. Scope SVG ids when displayed
 // simultaneously so gradients from the menu do not mask the stage on Android.
 const map=new Map();
 html=html.replace(/\bid="([^"]+)"/g,(m,value)=>{const replacement=value+'-manager-'+id;map.set(value,replacement);return 'id="'+replacement+'"'});
 for(const [before,after]of map)html=html.replaceAll('url(#'+before+')','url(#'+after+')');
 return html;
}
const portrait=(c,instance)=>clean(art[c.asset]||art.willi,instance);
function selectCharacter(id){
 const c=CHARACTER_REGISTRY.find(c=>c.id===id);if(!c)return;
 current=c;
 for(const node of document.querySelectorAll('.character'))node.setAttribute('aria-pressed',String(node.dataset.id===id));
 const stage=$('#stage');stage.dataset.character=c.id;stage.dataset.state='idle';stage.innerHTML=portrait(c,'stage');
 $('#name').textContent=c.name;$('#personality').textContent=c.personality;
 const info=$('#info');info.replaceChildren();
 const fields=[['Character ID',c.id],['Unlock points',c.unlockPoints.toLocaleString()],['Voice provider',c.voiceProvider],['Voice ID',c.voiceId],['Animation states',c.states.join(', ')],['Publishing status',c.status]];
 for(const [key,value]of fields){const label=document.createElement('dt'),out=document.createElement('dd');label.textContent=key;out.textContent=value;info.append(label,out)}
 const controls=$('#states');controls.replaceChildren();
 for(const state of c.states){const b=document.createElement('button');b.type='button';b.textContent=state;b.dataset.state=state;b.setAttribute('aria-pressed',String(state==='idle'));b.onclick=()=>{stage.dataset.state=state;for(const button of controls.children)button.setAttribute('aria-pressed',String(button===b));$('#previewStatus').textContent='Preview: '+state};controls.append(b)}
 $('#previewStatus').textContent='Preview: idle · static SVG test';
}
function mount(){
 const issues=registryDiagnostics();
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
void checkStaff();
