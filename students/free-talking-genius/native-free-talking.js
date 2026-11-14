// Native Free Talking workspace pilot (opt in with ?nativeFT=1).
// The student header, textbook data, and browser history remain in the parent app.
// The separate conversation engine mounts inside this document's ShadowRoot.
let entry=null;
const ENGINE='/students/free-talking-hybrid-lab/extension.js?v=20261114-native-lifecycle1';
const TEMPLATE='/students/free-talking-hybrid-lab/index.html';
function makeLink(href){
 const link=document.createElement('link');link.rel='stylesheet';link.href=href;return link;
}
async function createWorkspace({header}){
 const response=await fetch(TEMPLATE,{cache:'no-store'});
 if(!response.ok)throw Error('Free Talking workspace HTTP '+response.status);
 const doc=new DOMParser().parseFromString(await response.text(),'text/html');
 const intro=doc.getElementById('ftReleaseIntro');
 const demo=doc.getElementById('demo');
 const inline=doc.querySelector('style');
 if(!intro||!demo||!inline)throw Error('Live workspace markup is incomplete');
 const element=document.createElement('div');
 element.id='ftNativeWorkspace';
 element.hidden=true;
 element.style.cssText='position:fixed;inset:0;z-index:2147483000;background:#e9fbfc;overflow:hidden;';
 const root=element.attachShadow({mode:'open'});
 const base=document.createElement('style');
 base.textContent=':host{display:block;font:14px Poppins,Arial,sans-serif;color:#263c50;box-sizing:border-box}*{box-sizing:border-box}';
 const style=document.createElement('style');
 // Original workspace styles remain sourced from their own live-page template.
 // Shadow DOM scopes them so they cannot alter Speaking or the student header.
 style.textContent=inline.textContent+'\n'+
 '#demo{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;}'+
 '#demo .wrap{height:100%!important;max-height:100%!important;}'+
 '#demo .ft-layer{position:absolute!important;inset:0!important;}'+
 '#ftReleaseIntro{height:100%!important;min-height:100%!important;max-height:100%!important;overflow-y:auto!important;padding-top:14px!important;}';
 root.append(base);
 for(const url of [
  '/students/free-talking-genius/styles.css?v=20261113-willy-option1',
  '/students/free-talking-genius/character-animations.css?v=20261114-shared-finish-v1',
  '/students/free-talking-genius/live-animal-ui.css?v=20261113-willy-animal1',
  '/students/free-talking-genius/guide.css?v=20261107-guide-kids2',
  '/students/free-talking-hybrid-lab/shared-character-stage.css?v=20261113-restore-old-shared1'
 ])root.append(makeLink(url));
 root.append(style,document.importNode(intro,true),document.importNode(demo,true));
 document.body.append(element);
 const native={element,root,header,context:null,active:false,onExit:null,shutdown:null,reopen:null,exit(){
  if(!native.active)return;
  native.shutdown?.();
  native.active=false;
  element.hidden=true;
  document.body.classList.remove('ft-native-active');
  document.body.style.removeProperty('overflow');
  native.onExit?.();
 }};
 window.__WillenaFTNativeHost=native;
 window.WillenaFTNativePilot?.claim({active:false,close:()=>native.exit()});
 await import(ENGINE);
 // Retain one mounted engine instance for subsequent activity opens.
 if(!native.reopen)throw Error('Native Free Talking lifecycle was not registered');
 return native;
}
export async function openNativeFreeTalking({bookId,unitId,header,onExit}){
 if(!bookId||!unitId)throw Error('Choose a textbook and unit first');
 if(!entry)entry=await createWorkspace({header});
 if(entry.active)return;
 entry.context={bookId,unitId};
 entry.onExit=onExit;
 entry.active=true;
 const headerHeight=Math.ceil(header?.getBoundingClientRect().bottom||0);
 entry.element.style.top=Math.max(0,headerHeight)+'px';
 entry.element.hidden=false;
 document.body.classList.add('ft-native-active');
 document.body.style.overflow='hidden';
 window.WillenaFTNativePilot?.claim({active:true,close:()=>entry.exit()});
 window.WillenaFTNativePilot?.enter();
 await entry.reopen(entry.context);
}
