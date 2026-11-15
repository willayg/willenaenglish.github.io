// P3 Character Collection — presentation only. Reuses profile overview data;
 // no additional points queries, mutations, purchases or unlock writes.
import {charactersInMenu} from '/students/characters-v2/character-registry.js?v=20261115-modular-p2-2';
import {characterThumbnailMarkup} from '/students/characters-v2/character-runtime.js?v=20261115-unique-svg-resources1';
import {createCharacterCelebration} from './celebration-card.js?v=20261116-p4-visible-scenery2';
const root=document.getElementById('characterCollection');
const celebrationNames={bunny:'BUNNY FOX',pigfish:'PIGFISH',willi:'WILLO',willy:'AI WILLI 2',dusk:'DUSK',steve:'SERGEANT STEVE'};
const number=n=>Math.max(0,Math.floor(Number(n)||0)).toLocaleString();
let verifiedPoints=NaN;
const isUnlocked=(c,points)=>c.unlockPoints===0||(Number.isFinite(points)&&points>=c.unlockPoints);
function draw(points){
 if(!root)return;
 root.replaceChildren();
 const valid=Number.isFinite(points);
 verifiedPoints=valid?points:NaN;
 const characters=charactersInMenu();
 const fragment=document.createDocumentFragment();
 for(const c of characters){
  const earned=valid&&points>=c.unlockPoints;
  const unlocked=isUnlocked(c,points);
  const card=document.createElement('button');card.type='button';card.className='collection-character';card.dataset.character=c.id;
  card.dataset.locked=String(!unlocked);
  card.disabled=!unlocked;
  card.setAttribute('aria-label',unlocked?'Play '+c.name+' celebration':'Locked mystery character');
  const art=document.createElement('div');art.className='collection-art';
  art.innerHTML=characterThumbnailMarkup(c.id,'collection-'+c.id);
  const title=document.createElement('strong');title.textContent=unlocked?c.name:'???';
  const detail=document.createElement('span');
  if(!valid&&!unlocked)detail.textContent='Checking points…';
  else if(c.unlockPoints===0)detail.textContent='Available';
  else if(c.unlockPoints>0&&!earned)detail.textContent='Unlock at '+number(c.unlockPoints)+' points';
  else detail.textContent='Unlocked';
  const progress=document.createElement('div');progress.className='collection-progress';
  const bar=document.createElement('div');bar.style.width=valid?(c.unlockPoints===0?'100%':Math.min(100,points/c.unlockPoints*100)+'%'):'0%';
  progress.append(bar);
  progress.setAttribute('role','progressbar');progress.setAttribute('aria-valuemin','0');
  progress.setAttribute('aria-valuemax','100');
  progress.setAttribute('aria-valuenow',String(valid?(c.unlockPoints===0?100:Math.min(100,Math.round(points/c.unlockPoints*100))):0));
  const caption=document.createElement('small');
  caption.textContent=!valid?'Points unavailable':c.unlockPoints===0?'Ready to use':earned?'Milestone reached':number(points)+' / '+number(c.unlockPoints)+' points';
  if(unlocked)card.dataset.available='true';
  if(earned)card.dataset.earned='true';
  card.append(art,title,detail,progress,caption);
  if(unlocked)card.addEventListener('click',()=>playCollectionCelebration(c));
  fragment.append(card);
 }
 root.append(fragment);
 const status=document.getElementById('characterCollectionStatus');
 if(status)status.textContent=valid?'Your characters and point milestones':'Character points unavailable';
}
document.addEventListener('willena:profile-overview',event=>{
 const p=Number(event.detail?.points);
 draw(event.detail?.points==null?NaN:p);
});
function playCollectionCelebration(c){
 // The UI and its click handler both enforce the same cached unlock state.
 // Never show a locked character's original artwork or celebration.
 if(!isUnlocked(c,verifiedPoints))return;
 const existing=document.querySelector('.ft-character-unlock-celebration.collection-replay');
 if(existing)existing.remove();
 // Replay is cosmetic: no unlock claims, points changes, or authentication calls.
 const {root:overlay,next:close,listen}=createCharacterCelebration(c.id,{replay:true});
 // The replay is decorative and never issues a paid audio or points request.
 listen.hidden=true;
 document.body.append(overlay);
 const previousFocus=document.activeElement;
 const dismiss=()=>{overlay.remove();document.removeEventListener('keydown',onKey);previousFocus?.focus?.({preventScroll:true})};
 const onKey=e=>{if(e.key==='Escape')dismiss()};
 document.addEventListener('keydown',onKey);
 close.addEventListener('click',dismiss);
 overlay.addEventListener('click',e=>{if(e.target===overlay)dismiss()});
 close.focus({preventScroll:true});
}
if(window.__willenaDashboardOverview)draw(window.__willenaDashboardOverview.points==null?NaN:Number(window.__willenaDashboardOverview.points));
else draw(NaN);
