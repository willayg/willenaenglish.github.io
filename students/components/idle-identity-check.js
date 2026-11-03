/* Willena shared idle identity check · v1
 * Safety policy: never interrupt an active learning activity.
 * The five-minute check is deferred until a safe screen or navigation boundary.
 * No periodic modals, automatic logout, or changes to scoring.
 */
(function(){
"use strict";
if(window.WillenaIdleIdentity)return;
const IDLE_MS=5*60*1000;
const KEY="willena:idle-identity:last-interaction:v1";
const SIGNIN="/students/signin.html";
const blockedSelectors=[
 "#vocabStudySession","#grammarRound","#session","#wgDiaryFlow","#wgEditor","#spRound",
 "#grammarQuestionEngineMount","#grammarResult","#gameArea","#wgPaperScreen"
];
let last=Date.now(),busy=false,prompting=false,pendingCheck=false,lastWrite=0,dialog=null;
try{const stored=Number(sessionStorage.getItem(KEY));if(Number.isFinite(stored)&&stored>0&&stored<=Date.now())last=stored;}catch{}
const now=()=>Date.now();
function record(t=now()){
 last=t;
 if(t-lastWrite>1500){lastWrite=t;try{sessionStorage.setItem(KEY,String(t));}catch{}}
}
function visible(el){
 if(!el||el.hidden||el.closest('[hidden],[aria-hidden="true"]'))return false;
 const s=getComputedStyle(el);
 return s.display!=="none"&&s.visibility!=="hidden"&&el.getClientRects().length>0;
}
function working(){
 const path=location.pathname;
 const focus=document.activeElement;
 if(focus?.matches?.('input,textarea,[contenteditable="true"],[role="textbox"]'))return true;
 if(path.includes("/Games/english_arcade/play"))return true;
 if(path.includes("/students/test-prep-v2/")){
  const route=history.state?.app==="willena-test-prep-v2"?history.state.route||{}:{};
  // Protect question, mock and performance pages and their result transitions.
  if(["practice","mock","performance","result","review"].includes(route.view))return true;
  const search=new URLSearchParams(location.search);
  if(["practice","mock","performance","result","review"].includes(search.get("view")))return true;
 }
 if(path.includes("/students/grammar-foundations/")){
  const screen=document.querySelector("#screen");
  if(screen && /question|exercise|activity|practice|quiz|test/i.test(String(screen.className||"")))return true;
  if(document.querySelector("#screen input,#screen textarea,#screen [contenteditable=true]"))return true;
 }
 if(path.includes("/students/wordsearch/")&&visible(document.querySelector("#gameArea")))return true;
 return blockedSelectors.some(selector=>visible(document.querySelector(selector)));
}
function eligible(){return !prompting&&!busy&&!document.hidden&&(pendingCheck||now()-last>=IDLE_MS)&&!working();}
async function profile(){
 const api=window.WillenaAPI;
 if(!api?.fetch)return null;
 const result=await api.fetch('/.netlify/functions/supabase_auth?action=get_profile_name',{credentials:'include',cache:'no-store'});
 if(!result.ok)return null;
 const data=await result.json().catch(()=>null);
 if(!data?.success||!data?.name)return null;
 return {name:String(data.name).trim().slice(0,65),className:String(data.class||"").trim().slice(0,60)};
}
function mount(){
 if(dialog)return dialog;
 const style=document.createElement("style");style.textContent=`
#wil-idle-check{position:fixed!important;inset:0!important;z-index:2147483647!important;background:rgba(21,40,52,.51)!important;display:grid!important;place-items:center!important;padding:20px!important;box-sizing:border-box!important;font-family:Poppins,Arial,sans-serif!important}
#wil-idle-check[hidden]{display:none!important}
#wil-idle-check .wil-idle-panel{box-sizing:border-box!important;width:min(390px,100%)!important;background:#fff!important;color:#293d46!important;border:3px solid #83d9e1!important;border-radius:22px!important;box-shadow:0 18px 55px rgba(10,32,46,.2)!important;text-align:center!important;padding:28px 22px!important}
#wil-idle-check h2{margin:0 0 9px!important;color:#d84991!important;font-size:23px!important;line-height:1.35!important;font-weight:800!important}
#wil-idle-check p{font-size:15px!important;line-height:1.5!important;margin:0 0 22px!important;color:#526671!important}
#wil-idle-check .wil-idle-actions{display:grid!important;gap:10px!important}
#wil-idle-check button{cursor:pointer!important;min-height:47px!important;border-radius:12px!important;background:white!important;border:2px solid #89dce5!important;color:#c83d85!important;font:700 15px Poppins,Arial,sans-serif!important}
#wil-idle-check button.wil-yes{background:#eafafb!important;border-color:#63cbd8!important}
#wil-idle-check button:focus-visible{outline:3px solid #f3a5cc!important;outline-offset:2px!important}
`;document.head.appendChild(style);
 const root=document.createElement("div");root.id="wil-idle-check";root.hidden=true;
 root.setAttribute("role","dialog");root.setAttribute("aria-modal","true");root.setAttribute("aria-labelledby","wil-idle-title");
 const panel=document.createElement("div");panel.className="wil-idle-panel";
 const title=document.createElement("h2");title.id="wil-idle-title";
 const sub=document.createElement("p");
 const actions=document.createElement("div");actions.className="wil-idle-actions";
 const yes=document.createElement("button");yes.type="button";yes.className="wil-yes";yes.textContent="Yes, it's me · 네, 맞아요";
 const no=document.createElement("button");no.type="button";no.textContent="No, log out · 아니요, 로그아웃";
 actions.append(yes,no);panel.append(title,sub,actions);root.append(panel);document.body.appendChild(root);
 yes.addEventListener("click",()=>{root.hidden=true;prompting=false;pendingCheck=false;record();});
 no.addEventListener("click",async()=>{
  yes.disabled=true;no.disabled=true;no.textContent="Signing out…";
  try{
   const {logoutStudent}=await import('/students/shared/student-header-actions.js?v=1.0.1');
   await logoutStudent({redirect:SIGNIN});
  }catch(error){
   console.warn("[Idle Identity] shared sign-out unavailable",error);
   try{window.WillenaAPI?.clearLocalTokens?.();await window.WillenaAPI?.fetch?.('/.netlify/functions/supabase_auth?action=logout',{method:'POST'});}catch{}
   location.assign(SIGNIN);
  }
 });
 root.addEventListener("keydown",e=>{if(e.key==="Escape"){e.preventDefault();e.stopPropagation();}});
 dialog={root,title,sub,yes,no};return dialog;
}
async function ask(){
 if(!eligible())return;
 busy=true;
 try{
  const person=await profile();
  if(!person){pendingCheck=false;record();return;}
  if(document.hidden||working()||prompting)return;
  const ui=mount();ui.title.textContent=person.name+", is that you?";
  ui.sub.textContent=person.className?person.className+" · 본인이 맞나요?":"본인이 맞나요?";
  ui.yes.disabled=false;ui.no.disabled=false;ui.no.textContent="No, log out · 아니요, 로그아웃";
  ui.root.hidden=false;prompting=true;ui.yes.focus();
 }catch(e){console.warn("[Idle Identity] check unavailable",e);pendingCheck=false;record();}
 finally{busy=false;}
}
function onInteraction(e){
 if(prompting)return;
 if(e.isTrusted===false)return;
 if(now()-last>=IDLE_MS)pendingCheck=true;
 if(busy){
  if(e.cancelable)e.preventDefault();
  e.stopImmediatePropagation?.();
  return;
 }
 if(pendingCheck&&!working()){
  // Defer confirmation until a non-working state; this interaction stays blocked.
  if(e.cancelable)e.preventDefault();
  e.stopImmediatePropagation?.();
  ask();return;
 }
 record();
}
["pointerdown","keydown","touchstart","click","submit"].forEach(type=>addEventListener(type,onInteraction,{capture:true,passive:false}));
const observer=new MutationObserver(()=>{
 if(!document.hidden&&pendingCheck&&!working())ask();
});
function observe(){if(document.body)observer.observe(document.body,{attributes:true,subtree:true,attributeFilter:["hidden","class","aria-hidden"]});}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",observe,{once:true});else observe();
document.addEventListener("visibilitychange",()=>{
 if(!document.hidden){if(now()-last>=IDLE_MS)pendingCheck=true;if(eligible())ask();}
});
window.addEventListener("pageshow",()=>{if(now()-last>=IDLE_MS)pendingCheck=true;if(eligible())ask();});
window.WillenaIdleIdentity={check:ask,isPending:()=>pendingCheck||now()-last>=IDLE_MS,isShowing:()=>prompting};
})();
