/* Willena shared live classroom presence P3. Read-only, no answer or homework mutations.
 * All apps share one per-tab identity/session via sessionStorage.
 * Apps can publish precise activity using WillenaPresence.setActivity({book,unit,activity,assignment_id,...}).
 */
(function(){
"use strict";
if(window.WillenaPresence)return;
const routes=[
 [/\/students\/vocab-study\//,"word"],
 [/\/students\/grammar-books\//,"grammar"],
 [/\/students\/grammar-foundations\//,"grammar"],
 [/\/students\/sentence-genius\//,"sentence"],
 [/\/students\/writing-genius\//,"writing"],
 [/\/students\/wordsearch\//,"puzzles"],
 [/\/students\/test-prep-v2\//,"test_prep"],
 [/\/students\/dashboard(?:\.html|\/|$)/,"dashboard"]
];
const app=routes.find(([pattern])=>pattern.test(location.pathname))?.[1]||"other";
const ENDPOINT="/api/live-presence/heartbeat", DISCONNECT="/api/live-presence/disconnect";
const HEARTBEAT=30000, UUID=/^[0-9a-f-]{36}$/i;
let sessionId;
try{
 sessionId=sessionStorage.getItem("willena:presence:session");
 if(!UUID.test(sessionId||"")){sessionId=crypto.randomUUID();sessionStorage.setItem("willena:presence:session",sessionId);}
}catch{sessionId=crypto.randomUUID();}
let lastActivity=Date.now(),lastSent=0,lastPayload="",pending=false,stopped=false,manual=null,timeout=null;
const cleanup=()=>{if(timeout){clearTimeout(timeout);timeout=null;}};
function visible(id){const el=document.getElementById(id);if(!el||el.hidden)return false;const style=getComputedStyle(el);return style.display!=="none"&&style.visibility!=="hidden"&&!!el.getClientRects().length;}
function value(id){const el=document.getElementById(id);if(!el)return "";const txt=el.tagName==="SELECT"?(el.selectedOptions?.[0]?.textContent||""):el.textContent;return String(txt||"").replace(/\s+/g," ").trim().slice(0,85);}
function label(s){return String(s||"").replace(/[\x00-\x1f]/g," ").trim().slice(0,100);}
function pickValue(names){for(const name of names){const t=value(name);if(t)return t;}return "";}
function detect(){
 let book="",unit="",activity="";
 if(app==="word"){
  // Prefer canonical Word Genius state over placeholder selector text.
  const state=window.WillenaVocabStudy?.getState?.();
  const session=visible("vocabStudySession");
  book=String(state?.book?.book_title||state?.book?.title||"");
  unit=state?.unit?.unit_number!=null?"Unit "+state.unit.unit_number:"";
  if(session){
    activity=state?.speakingSession?"Speaking":state?.spellingTest?"Spelling":state?.spellingPractice?"Spelling Coach":"Quiz";
  }else if(visible("vocabWordTestScreen"))activity="Word Test";
  else if(visible("vocabBookScreen"))activity="Select Unit";
  else activity="Home";
 }else if(app==="grammar"){
  if(location.pathname.includes("grammar-books")){
   book=pickValue(["grammarBookTitle"]);unit=pickValue(["grammarUnitTitle"]);
   activity=visible("grammarRound")?pickValue(["grammarRoundTitle"])||"Grammar quiz":visible("grammarResult")?"Results":"Selecting grammar";
  }else activity="Grammar Genius practice";
 }else if(app==="sentence"){
  book=pickValue(["bookName"]);unit=pickValue(["unitTitle"]);
  activity=visible("session")?pickValue(["sessionTitle","instruction"])||"Sentence practice":visible("bookScreen")?"Selecting unit":"Sentence Genius home";
 }else if(app==="writing"){
  book=pickValue(["spBook"]);unit=pickValue(["spUnitTitle"]);
  activity=visible("wgDiaryFlow")?"Diary / topic writing":visible("wgPortfolio")?"Writing history":visible("spRound")?"Sentence writing":visible("wgEditor")?"Writing editor":"Writing Genius home";
 }else if(app==="puzzles"){
  activity=pickValue(["modeLabel","listTitle"])||"Puzzles";
 }else if(app==="test_prep"){
  activity="내신 practice";unit=new URLSearchParams(location.search).get("lesson")||"";
 }else if(app==="dashboard")activity="Student dashboard";
 return {book:label(book),unit:label(unit),activity:label(activity)};
}
function context(){
 const d={...detect(),...(manual||{})};
 // Explicit assigned Word Genius runs are available through its canonical state.
 const wordState=app==="word"?window.WillenaVocabStudy?.getState?.():null;
 if(wordState?.activeTeacherAssignment && visible("vocabStudySession")){
   const assignment=wordState.activeTeacherAssignment.assignment||{};
   if(assignment.id)d.assignment_id=assignment.id;
   d.entered_via_homework=true;
 }
 const query=new URLSearchParams(location.search);
 const hash=new URLSearchParams(location.hash.slice(1).replace(/^\?/,""));
 const saved=history.state&&typeof history.state==="object"?history.state:{};
 const assignmentId=d.assignment_id||query.get("assignment_id")||query.get("assignmentId")||query.get("teacherAssignmentId")||hash.get("assignment_id")||hash.get("teacherAssignmentId")||saved.assignment_id||saved.teacherAssignmentId||null;
 const match=UUID.test(assignmentId||"")?assignmentId:null;
 return {session_id:sessionId,app,book:label(d.book),unit:label(d.unit),activity:label(d.activity),
  assignment_id:match,assignment_match:false,entered_via_homework:d.entered_via_homework===true||!!match,
  last_interaction_age_ms:Math.min(Date.now()-lastActivity,3600000)};
}
async function send(force=false){
 if(stopped||document.hidden||pending)return;
 const body=context(),signature=JSON.stringify({...body,last_interaction_age_ms:0});
 if(!force && Date.now()-lastSent<HEARTBEAT-1000 && signature===lastPayload)return;
 pending=true;
 try{
  const res=await fetch(ENDPOINT,{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),cache:"no-store"});
  if(res.ok){lastSent=Date.now();lastPayload=signature;}else if(res.status===401||res.status===403){cleanup();stopped=true;}
 }catch{}finally{pending=false;}
}
function schedule(){cleanup();timeout=setTimeout(()=>send(),1800);}
function interact(e){
 // Presence is observational. No popups, session resets or input interception.
 if(e.isTrusted!==false){lastActivity=Date.now();}
 if(e.type==="click"||e.type==="submit"||e.type==="change")schedule();
}
["pointerdown","keydown","input","click","change","submit","touchstart"].forEach(t=>addEventListener(t,interact,{passive:true,capture:true}));
document.addEventListener("visibilitychange",()=>{if(!document.hidden){lastActivity=Date.now();send(true);}});
addEventListener("pageshow",()=>{if(!document.hidden)send(true);});
function disconnect(){
 // Avoid false online while the tab is closed. Navigations may start a new heartbeat shortly.
 try{fetch(DISCONNECT,{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({session_id:sessionId}),keepalive:true}).catch(()=>{});}catch{}
}
// No automatic disconnect on pagehide: navigation to a different app in the same tab
// can race the next heartbeat. The server expires closed sessions after 90 seconds.
window.WillenaPresence={
 setActivity(fields){manual={...(manual||{}),...fields};schedule();},
 clearActivity(){manual=null;schedule();},
 refresh(){send(true);},
 getSessionId(){return sessionId;}
};
const observer=new MutationObserver(()=>{if(document.hidden||manual)return; if(Date.now()-lastSent>12000)schedule();});
document.addEventListener("DOMContentLoaded",()=>{observer.observe(document.body,{attributes:true,subtree:true,attributeFilter:["hidden","class","aria-hidden"]});send(true);},{once:true});
if(document.readyState!=="loading"){observer.observe(document.body,{attributes:true,subtree:true,attributeFilter:["hidden","class","aria-hidden"]});send(true);}
setInterval(()=>send(true),HEARTBEAT);
})();
