// Free Talking V2 native host.
// The V1 conversation engine runs in a ShadowRoot, inside the original student
// document: one persistent header, no iframe and no independent page history.
const ENGINE='/students/free-talking-genius/free-talking-v2-engine.js?v=20261114-menu-startfix1';
const TEMPLATE='/students/free-talking-hybrid-lab/index.html';
let workspace=null;
let loading=null;

function stylesheet(href){
 const el=document.createElement('link');el.rel='stylesheet';el.href=href;return el;
}
async function mount(header){
 const response=await fetch(TEMPLATE,{cache:'no-store'});
 if(!response.ok)throw Error('Free Talking workspace could not load ('+response.status+')');
 const doc=new DOMParser().parseFromString(await response.text(),'text/html');
 const intro=doc.getElementById('ftReleaseIntro'),demo=doc.getElementById('demo');
 const styles=[...doc.querySelectorAll('style')];
 if(!intro||!demo||!doc.getElementById('ftReleaseNativeMenu')||styles.length<2)
  throw Error('V1 workspace template is incomplete');
 const element=document.createElement('div');element.id='ftNativeV2Host';
 element.hidden=true;
 element.style.cssText='position:fixed;inset:0;z-index:2147483000;background:#ebfafb;overflow:hidden;';
 const root=element.attachShadow({mode:'open'});
 const reset=document.createElement('style');
 reset.textContent=':host{display:block;color:#275b66;font:14px Poppins,Arial,sans-serif}:host([hidden]){display:none!important}*,*::before,*::after{box-sizing:border-box}[hidden]{display:none!important}';
 const v1style=document.createElement('style');
 // Reuse the actual V1 presentation. ShadowRoot prevents those historical
 // !important overrides from affecting Speaking, student header, or textbooks.
 v1style.textContent=styles.map(s=>s.textContent).join('\n').replace(/body\.ft-release\b/g,':host')+'\n'+
 '#demo{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;}'+
 '#demo .wrap{height:100%!important;max-height:100%!important;}'+
 '#demo .control-dock{position:absolute!important;}'+
 '#demo .ft-layer{position:absolute!important;inset:0!important;}'+
 '#ftReleaseIntro{min-height:100%!important;height:100%!important;max-height:100%!important;overflow:auto!important;padding:16px!important;}';
 root.append(reset);
 for(const file of [
  '/students/free-talking-genius/styles.css?v=20261114-p4-visual1',
  '/students/free-talking-genius/character-animations.css?v=20261114-shared-finish-v1',
  '/students/free-talking-genius/dusk-character.css?v=20261114-clone-transparent3',
  '/students/free-talking-genius/live-animal-ui.css?v=20261113-willy-animal1',
  '/students/free-talking-genius/guide.css?v=20261107-guide-kids2',
  '/students/free-talking-hybrid-lab/shared-character-stage.css?v=20261114-willo-restored1'
 ])root.append(stylesheet(file));
 // Native release-specific responsive rules are injected LAST, after
 // legacy V1 selectors. A single narrow column avoids the portrait/name
 // collisions caused by inherited 2-column mobile overrides. Only the
 // shadow-root menu is affected; Speaking and its layout remain untouched.
 const nativeMenuStyle=document.createElement('style');
 nativeMenuStyle.textContent=`
 #ftReleaseIntro.free-talking-genius #ftCharacter.ft-character-screen{
   display:block!important;width:100%!important;max-width:100%!important;
   padding:0!important;min-height:0!important;
 }
 #ftReleaseIntro.free-talking-genius #ftCharacter .ft-character-panel{
   width:min(620px,100%)!important;max-width:100%!important;
   padding:18px 14px!important;margin:0 auto!important;gap:13px!important;
 }
 #ftReleaseIntro.free-talking-genius #ftCharacter .ft-character-options{
   display:grid!important;grid-template-columns:minmax(0,1fr)!important;
   width:100%!important;gap:10px!important;margin:0!important;
   align-items:stretch!important;justify-items:stretch!important;
 }
 #ftReleaseIntro.free-talking-genius #ftCharacter .ft-character-option,
 #ftReleaseIntro.free-talking-genius #ftCharacter .ft-character-option[aria-pressed="true"]{
   display:grid!important;grid-template-columns:82px minmax(0,1fr)!important;
   grid-template-rows:auto auto!important;align-items:center!important;
   justify-content:stretch!important;column-gap:14px!important;
   row-gap:2px!important;position:relative!important;inset:auto!important;
   grid-column:auto!important;grid-row:auto!important;
   width:100%!important;max-width:100%!important;min-width:0!important;
   height:auto!important;min-height:94px!important;
   padding:7px 8px!important;margin:0!important;
   border:0!important;box-shadow:none!important;background:transparent!important;
   transform:none!important;text-align:left!important;
 }
 #ftReleaseIntro.free-talking-genius #ftCharacter .ft-character-option .ft-character-symbol{
   display:grid!important;grid-column:1!important;grid-row:1 / span 2!important;
   width:78px!important;height:78px!important;min-width:0!important;
   max-width:78px!important;max-height:78px!important;
   margin:0!important;padding:0!important;position:relative!important;
   border-radius:50%!important;flex:none!important;transform:none!important;
 }
 #ftReleaseIntro.free-talking-genius #ftCharacter .ft-character-option strong{
   display:block!important;grid-column:2!important;grid-row:1!important;
   width:100%!important;min-width:0!important;max-width:100%!important;
   margin:0!important;padding:0!important;position:static!important;
   font-size:clamp(16px,4.2vw,19px)!important;line-height:1.25!important;
   white-space:normal!important;overflow-wrap:break-word!important;text-align:left!important;
 }
 #ftReleaseIntro.free-talking-genius #ftCharacter .ft-character-option .ft-dusk-lock{
   display:block!important;grid-column:2!important;grid-row:2!important;
   min-width:0!important;margin:0!important;padding:0!important;
   position:static!important;text-align:left!important;font-size:12px!important;
 }
 #ftReleaseIntro.free-talking-genius #ftCharacter .ft-character-option .ft-dusk-lock[hidden]{display:none!important}
 #ftReleaseIntro.free-talking-genius #ftCharacter .ft-character-option[hidden]{display:none!important}
 #ftReleaseIntro.free-talking-genius #ftCharacter .ft-character-start-container{
   width:100%!important;margin:0!important;
 }
 @media(min-width:650px){
   #ftReleaseIntro.free-talking-genius #ftCharacter .ft-character-options{
     grid-template-columns:repeat(2,minmax(0,1fr))!important;
   }
 }
 @media(min-width:1100px){
   #ftReleaseIntro.free-talking-genius #ftCharacter .ft-character-options{
     grid-template-columns:repeat(4,minmax(0,1fr))!important;
   }
   #ftReleaseIntro.free-talking-genius #ftCharacter .ft-character-option,
   #ftReleaseIntro.free-talking-genius #ftCharacter .ft-character-option[aria-pressed="true"]{
     display:flex!important;flex-direction:column!important;justify-content:flex-start!important;
     min-height:145px!important;text-align:center!important;gap:8px!important;
   }
   #ftReleaseIntro.free-talking-genius #ftCharacter .ft-character-option strong{
     text-align:center!important;
   }
 }
 `;
 root.append(v1style,stylesheet('/students/free-talking-genius/shared-character-menu.css?v=20261114-dusk-unlock1'),nativeMenuStyle,document.importNode(intro,true),document.importNode(demo,true));
 document.body.append(element);
 const state={element,root,header,context:null,active:false,reopen:null,shutdown:null,onExit:null,bodyOverflow:'',headerZIndex:'',exit({notify=true}={}){
  if(!state.active)return;
  state.active=false;
  // Shutdown only this conversation; never replace the parent document.
  try{state.shutdown?.()}catch(error){console.error('[Free Talking V2] shutdown',error)}
  element.hidden=true;
  // The native overlay and the student header were in the same top-level
  // stacking order. Restore header layering on exit so other apps are unchanged.
  if(state.header)state.header.style.zIndex=state.headerZIndex;
  document.body.style.overflow=state.bodyOverflow;
  if(notify)state.onExit?.();
 }};
 window.__WillenaFTNativeHost=state;
 try{
  await import(ENGINE);
  if(typeof state.reopen!=='function'||typeof state.shutdown!=='function')
   throw Error('V1 conversation lifecycle was not registered');
 }catch(error){
  element.remove();
  if(window.__WillenaFTNativeHost===state)delete window.__WillenaFTNativeHost;
  throw error;
 }
 return state;
}
export async function openV1NativeConversation({bookId,unitId,header,onExit}){
 if(!bookId||!unitId)throw Error('Select a textbook and unit first');
 if(!workspace){
  if(!loading)loading=mount(header).catch(error=>{loading=null;throw error});
  workspace=await loading;
 }
 if(workspace.active)return;
 workspace.header=header;
 // Lift the existing student header ABOVE this fixed native workspace.
 // The account dropdown lives in the header's ShadowRoot, so a z-index on
 // the dropdown alone cannot escape the header's lower stacking context.
 workspace.headerZIndex=header?.style.zIndex||'';
 if(header)header.style.zIndex='2147483200';
 workspace.context={bookId,unitId};
 workspace.onExit=onExit;
 workspace.bodyOverflow=document.body.style.overflow;
 // The persistent header lives OUTSIDE this component and remains mounted.
 // The textbook menu may be scrolled when V2 opens. Restore the original
 // page's top position so its existing student header stays above V2.
 window.scrollTo({top:0,behavior:'instant'});
 await new Promise(resolve=>requestAnimationFrame(resolve));
 const headerRect=header?.getBoundingClientRect();
 const bottom=Math.ceil(Math.max(headerRect?.bottom||0,headerRect?.height||0));
 workspace.element.style.top=Math.max(0,bottom)+'px';
 workspace.element.hidden=false;
 document.body.style.overflow='hidden';
 workspace.active=true;
 try{await workspace.reopen(workspace.context)}
 catch(error){
  workspace.exit({notify:false});
  throw error;
 }
}
export function closeV1NativeConversation({notify=false}={}){
 workspace?.exit({notify});
}
export function isV1NativeConversationOpen(){return Boolean(workspace?.active)}
