// Live Classroom P2: read-only monitoring. Never changes homework or student accounts.
const API="https://api.willenaenglish.com/api/live-presence";
const $=id=>document.getElementById(id);
const CLASS_ORDER=["Brown","Stanford","Manchester","NY","Hawaii","Boston","Sydney","Berkeley","Chicago","Cambridge","Yale","Prince","Oxford","MIT","Pre"];
const state={students:[],sessions:[],filter:"",rosterOk:false,presenceOk:false,refreshing:false};
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
  const status=online?.status==="active"?"active":online?"idle":"offline";
  counts[status]++;
  if(!groups.has(s.class))groups.set(s.class,[]);
  groups.get(s.class).push({...s,online,status});
 }
 for(const status of Object.keys(counts))$(status+"-count").textContent=counts[status];
 const root=$("classes");root.replaceChildren();
 if(!state.rosterOk){root.append(node("p","muted","Student roster unavailable."));return;}
 for(const cls of [...groups.keys()].sort(classOrder)){
  const people=groups.get(cls).sort((a,b)=>({active:0,idle:1,offline:2}[a.status]-{active:0,idle:1,offline:2}[b.status])||a.name.localeCompare(b.name));
  const h=node("div","class-head");h.append(node("h2","",cls),node("span","count",people.length+" students"));root.append(h);
  const grid=node("div","grid");
  for(const person of people){
   const card=node("article","student"),top=node("div","student-head"),label=node("span","status "+person.status,person.status==="active"?"● Active":person.status==="idle"?"● Idle":"○ Offline");
   top.append(node("strong","",person.name),label);card.append(top);
   const d=node("div","detail");
   if(person.online){
    d.append(node("div","app",clean(person.online.app)||"Online"));
    const activity=[person.online.book,person.online.unit,person.online.activity].map(clean).filter(Boolean).join(" · ");
    d.append(node("div","",activity||"No activity details yet"));
    if(person.online.assignment_match===true)d.append(node("span","homework","Matches homework"));
    else if(person.online.entered_via_homework===true)d.append(node("span","homework","Opened from homework"));
    else d.append(node("div","muted","Practice / assignment not confirmed"));
    d.append(node("div","muted","Seen "+new Date(person.online.seen_at).toLocaleTimeString("en-KR",{hour:"2-digit",minute:"2-digit"})));
   }else d.textContent="No current session";
   card.append(d);grid.append(card);
  }root.append(grid);
 }
 if(!students.length)root.append(node("p","muted","No students in this selection."));
}
let accessGranted=false;
async function refresh(){
 if(state.refreshing||!accessGranted||document.hidden)return;
 state.refreshing=true;
 try {
  await loadPresence();
  $("last-refresh").textContent="Updated "+time();
  showNotice(state.sessions.length?"":"No student apps are sending heartbeats yet. P3 will activate live activity reporting.");
 } catch(e){state.presenceOk=false;showNotice("Presence service: "+e.message,true);}
 finally{state.refreshing=false;render();}
}
(async()=>{
 try{
  await checkTeacher();
  accessGranted=true;
  try{await loadRoster();}catch(e){showNotice("Roster: "+e.message,true);}
  await refresh();
  $("class-filter").addEventListener("change",()=>{state.filter=$("class-filter").value;render();});
  $("refresh").addEventListener("click",()=>{refresh();});
  setInterval(refresh,15000);
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)refresh();});
 }catch(e){showNotice(e.message,true);}
})();
