// P3 Character Collection — presentation only. Reuses profile overview data;
 // no additional points queries, mutations, purchases or unlock writes.
import {charactersInMenu} from '/students/characters-v2/character-registry.js?v=20261115-modular-p2-2';
import {characterThumbnailMarkup} from '/students/characters-v2/character-runtime.js?v=20261115-unique-svg-resources1';
const root=document.getElementById('characterCollection');
const celebrationNames={bunny:'BUNNY FOX',pigfish:'PIGFISH',willi:'WILLO',willy:'AI WILLI 2',dusk:'DUSK',steve:'SERGEANT STEVE'};
const number=n=>Math.max(0,Math.floor(Number(n)||0)).toLocaleString();
let verifiedPoints=NaN;
const isUnlocked=(c,points)=>c.unlockPoints===0||c.id==='bunny'||c.id==='pigfish'||(Number.isFinite(points)&&points>=c.unlockPoints);
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
 const overlay=document.createElement('section');
 overlay.className='ft-character-unlock-celebration collection-replay'+(c.id==='dusk'?' is-dusk':'');
 overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');
 overlay.setAttribute('aria-label',c.name+' character celebration');
 const confetti=document.createElement('div');confetti.className='ft-milestone-confetti';confetti.setAttribute('aria-hidden','true');
 for(let i=0;i<9;i++)confetti.append(document.createElement('i'));
 const content=document.createElement('div');content.className='ft-milestone-card';
 const eyebrow=document.createElement('div');eyebrow.className='ft-milestone-eyebrow';eyebrow.textContent='CHARACTER CELEBRATION!';
 const portrait=document.createElement('div');portrait.className='ft-milestone-art';
 const artwork=document.createElement('span');artwork.className='ft-milestone-dusk';
 artwork.innerHTML=characterThumbnailMarkup(c.id,'celebrate-'+c.id+'-'+Date.now());portrait.append(artwork);
 const heading=document.createElement('h2');heading.textContent=celebrationNames[c.id]||c.name;
 const subtitle=document.createElement('p');subtitle.className='ft-milestone-points';subtitle.textContent=c.unlockPoints?number(c.unlockPoints)+' POINTS':'FREE CHARACTER';
 const note=document.createElement('p');note.className='ft-milestone-korean';note.textContent='캐릭터 축하 애니메이션';
 const actions=document.createElement('div');actions.className='ft-milestone-actions';
 const close=document.createElement('button');close.type='button';close.className='ft-milestone-continue';close.textContent='닫기 · Close';actions.append(close);
 content.append(eyebrow,portrait,heading,subtitle,note,actions);overlay.append(confetti,content);
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
