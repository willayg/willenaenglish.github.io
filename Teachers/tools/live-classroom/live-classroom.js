// Live Classroom P2: read-only monitoring. Never changes homework or student accounts.
const API="/api/live-presence";
const $=id=>document.getElementById(id);
const CLASS_ORDER=["Brown","Stanford","Manchester","NY","Hawaii","Boston","Sydney","Berkeley","Chicago","Cambridge","Yale","Prince","Oxford","MIT","Pre"];
const state={students:[],sessions:[],filter:"",appFilter:"",rosterOk:false,presenceOk:false,refreshing:false};
const clean=s=>String(s??"").trim();
const time=()=>new Date().toLocaleTimeString("en-KR",{hour:"2-digit",minute:"2-digit"});
function node(tag,className,text){const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=text;return n;}
function showNotice(message,error=false){const n=$("notice");n.textContent=message;n.className="notice"+(error?" error":"");n.hidden=!message;}
function classOrder(a,b){const ai=CLASS_ORDER.findIndex(s=>s.toLowerCase()===a.toLowerCase()),bi=CLASS_ORDER.findIndex(s=>s.toLowerCase()===b.toLowerCase());return (ai===-1?999:ai)-(bi===-1?999:bi)||a.localeCompare(b);}
async function fetchJson(url) {
 const res=await fetch(url,{credentials:"include",cache:"no-store"});
 const js=await res.json().catch(()=>({}));
 if(!res.ok || js.success===false || js.ok===false) throw new Error(js.error||"Request failed ("+res.status+")");
 return js;
}
async function checkTeacher(){
 const who=await fetchJson(window.WillenaAPI.getApiUrl("/.netlify/functions/supabase_auth?action=whoami"));
 if(!who.user_id)throw Error("Please sign in as a teacher.");
 const profile=await fetchJson(window.WillenaAPI.getApiUrl("/.netlify/functions/supabase_auth?action=get_profile&user_id="+encodeURIComponent(who.user_id)));
 if(!["teacher","admin"].includes(clean(profile.role).toLowerCase())||profile.approved!==true)throw Error("Teacher access required.");
}
async function loadRoster(){
 const js=await fetchJson(window.WillenaAPI.getApiUrl("/.netlify/functions/teacher_admin?action=list_students"));
 if(!Array.isArray(js.students))throw Error("Student roster unavailable");
 state.students=js.students.filter(s=>clean(s.class)&&s.id&&s.approved!==false&&clean(s.role||"student").toLowerCase()==="student").map(s=>({id:clean(s.id),name:clean(s.name||s.username||"Student"),class:clean(s.class)}));
 state.rosterOk=true;
 const classes=[...new Set(state.students.map(x=>x.class))].sort(classOrder),previous=$("class-filter").value;
 $("class-filter").replaceChildren(new Option("All Classes",""),...classes.map(x=>new Option(x,x)));
 $("class-filter").value=classes.includes(previous)?previous:"";
}
async function loadPresence(){
 const js=await fetchJson(API);
 if(!Array.isArray(js.sessions))throw Error("Presence data unavailable");
 state.sessions=js.sessions;
 state.presenceOk=true;
}
function render(){
 const selected=state.filter;
 const students=state.students.filter(s=>!selected||s.class===selected);
 const sessions=new Map();
 for(const s of state.sessions){
  if(!s.student_id)continue;
  const prev=sessions.get(s.student_id);
  if(!prev || String(s.seen_at)>String(prev.seen_at))sessions.set(s.student_id,s);
 }
 const counts={active:0,idle:0,offline:0};
 const groups=new Map();
 for(const s of students){
  const online=sessions.get(s.id);
  // App filtering applies only to currently reported sessions; offline students
  // have no verifiable current app and are omitted in 내신-only mode.
  if(state.appFilter && online?.app!==state.appFilter)continue;
  const status=!state.presenceOk?"unavailable":online?.status==="active"?"active":online?"idle":"offline";
  if(status!=="unavailable")counts[status]++;
  if(!groups.has(s.class))groups.set(s.class,[]);
  groups.get(s.class).push({...s,online,status});
 }
 for(const status of Object.keys(counts))$(status+"-count").textContent=state.presenceOk?counts[status]:"—";
 const root=$("classes");root.replaceChildren();
 if(!state.rosterOk){root.append(node("p","muted","Student roster unavailable."));return;}
 for(const cls of [...groups.keys()].sort(classOrder)){
  const people=groups.get(cls).sort((a,b)=>({active:0,idle:1,offline:2,unavailable:3}[a.status]-{active:0,idle:1,offline:2,unavailable:3}[b.status])||a.name.localeCompare(b.name));
  const h=node("div","class-head");h.append(node("h2","",cls),node("span","count",people.length+" students"));root.append(h);
  const grid=node("div","grid");
  const head=node("div","student table-heading");
  for(const h of ["Student","Status","Current app","Activity","Assigned"])head.append(node("span","",h));
  grid.append(head);
  for(const person of people){
    const row=node("div","student");
    row.append(node("strong","name-cell",person.name));
    const statusText=person.status==="active"?"● Active":person.status==="idle"?"● Idle":person.status==="unavailable"?"— Unavailable":"○ Offline";
    const cell=node("span","status-cell");
    cell.append(node("span","status "+person.status,statusText));row.append(cell);
    const online=person.online;
    const names={word:"Word Genius",grammar:"Grammar Genius",sentence:"Sentence Genius",writing:"Writing Genius",puzzles:"Puzzles",test_prep:"내신 명중",dashboard:"Dashboard"};
    row.append(node("span","app-cell",online?(names[online.app]||clean(online.app)||"—"):"—"));
    const activity=online?clean(online.activity):"";
    row.append(node("span","activity-cell",activity||"—"));
    const assigned=online?(online.assignment_match===true||online.entered_via_homework===true?"Yes":online.assignment_id?"Yes":"—"):"—";
    row.append(node("span","assigned-cell",assigned));
    grid.append(row);
  }
  root.append(grid);
 }
 if(!groups.size)root.append(node("p","muted",state.appFilter?"No students currently online in 내신 명중.":"No students in this selection."));
}
// Load roster and presence independently. A slow auth check must never leave the page blank.
let accessGranted=false;
async function refresh(){
 if(state.refreshing||!accessGranted||document.hidden)return;
 state.refreshing=true;
 try{
  await loadPresence();
  $("last-refresh").textContent="Updated "+time();
  showNotice(state.sessions.length?"":"No current sessions yet.");
 }catch(error){
  state.presenceOk=false;
  showNotice("Presence service: "+error.message,true);
 }finally{
  state.refreshing=false;
  try{render();}catch(error){console.error("[Live Classroom] render",error);showNotice("Could not draw student list. Please refresh.",true);}
 }
}
function registerUI(){
 $("class-filter").addEventListener("change",()=>{state.filter=$("class-filter").value;render();});
 $("app-filter").addEventListener("change",()=>{state.appFilter=$("app-filter").value;render();});
 $("refresh").addEventListener("click",async()=>{
  try{await loadRoster();}catch(error){showNotice("Roster: "+error.message,true);}
  await refresh();
 });
 setInterval(refresh,15000);
 document.addEventListener("visibilitychange",()=>{if(!document.hidden)refresh();});
}
async function boot(){
 registerUI();
 const watchdog=setTimeout(()=>{if(!state.rosterOk)showNotice("Still loading student roster. Check your connection or tap Refresh.",true);},12000);
 try{
  // Roster endpoint checks teacher access itself; never gate UI on extra sequential
  // whoami and profile requests that could fail during cookie refresh.
  await loadRoster();
  accessGranted=true;
  render();
  await refresh();
 }catch(error){
  console.error("[Live Classroom] startup",error);
  showNotice("Student roster: "+error.message,true);
  try{render();}catch(ignore){}
 }finally{clearTimeout(watchdog);}
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});
else boot();
