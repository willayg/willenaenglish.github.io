// P3 Character Collection — presentation only. Reuses profile overview data;
 // no additional points queries, mutations, purchases or unlock writes.
import {charactersInMenu} from '/students/characters-v2/character-registry.js?v=20261115-modular-p2-2';
import {characterThumbnailMarkup} from '/students/characters-v2/character-runtime.js?v=20261115-unique-svg-resources1';
const root=document.getElementById('characterCollection');
const number=n=>Math.max(0,Math.floor(Number(n)||0)).toLocaleString();
function draw(points){
 if(!root)return;
 root.replaceChildren();
 const valid=Number.isFinite(points);
 const characters=charactersInMenu();
 const fragment=document.createDocumentFragment();
 for(const c of characters){
  const earned=valid&&points>=c.unlockPoints;
  const available=c.unlockPoints===0||c.id==='bunny'||c.id==='pigfish';
  const card=document.createElement('article');card.className='collection-character';
  const art=document.createElement('div');art.className='collection-art';
  art.innerHTML=characterThumbnailMarkup(c.id,'collection-'+c.id);
  const title=document.createElement('strong');title.textContent=c.name;
  const detail=document.createElement('span');
  if(!valid)detail.textContent='Checking points…';
  else if(c.unlockPoints===0)detail.textContent='Available';
  else if(c.id==='bunny'||c.id==='pigfish')detail.textContent=number(c.unlockPoints)+' point milestone';
  else detail.textContent=earned?'Unlocked':'Unlock at '+number(c.unlockPoints)+' points';
  const progress=document.createElement('div');progress.className='collection-progress';
  const bar=document.createElement('div');bar.style.width=valid?(c.unlockPoints===0?'100%':Math.min(100,points/c.unlockPoints*100)+'%'):'0%';
  progress.append(bar);
  progress.setAttribute('role','progressbar');progress.setAttribute('aria-valuemin','0');
  progress.setAttribute('aria-valuemax','100');
  progress.setAttribute('aria-valuenow',String(valid?(c.unlockPoints===0?100:Math.min(100,Math.round(points/c.unlockPoints*100))):0));
  const caption=document.createElement('small');
  caption.textContent=!valid?'Points unavailable':c.unlockPoints===0?'Ready to use':earned?'Milestone reached':number(points)+' / '+number(c.unlockPoints)+' points';
  if(available)card.dataset.available='true';
  if(earned)card.dataset.earned='true';
  card.append(art,title,detail,progress,caption);fragment.append(card);
 }
 root.append(fragment);
 const status=document.getElementById('characterCollectionStatus');
 if(status)status.textContent=valid?'Your characters and point milestones':'Character points unavailable';
}
document.addEventListener('willena:profile-overview',event=>{
 const p=Number(event.detail?.points);
 draw(event.detail?.points==null?NaN:p);
});
draw(NaN);
