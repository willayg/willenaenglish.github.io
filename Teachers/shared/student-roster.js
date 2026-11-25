// Shared teacher/admin student directory loader.
// The admin-protected roster endpoint doubles as the Admin V2 authorization gate.
const ROSTER_ENDPOINT='/.netlify/functions/teacher_admin?action=list_students';
const CACHE_KEY='willena:shared-student-roster:v2';
const CACHE_MAX_AGE_MS=12*60*60*1000;
let inFlight=null;
let memory=null;

function apiFetch(path,options={}){
  const fn=window.WillenaAPI?.fetch||window.fetch.bind(window);
  return fn(path,{credentials:'include',cache:'no-store',...options});
}

export function normalizeStudent(row={}){
  return {
    id:row.id||row.user_id||'',
    name:String(row.name||row.english_name||'').trim(),
    korean_name:String(row.korean_name||row.koreanName||'').trim(),
    username:String(row.username||'').trim(),
    email:String(row.email||'').trim(),
    class:String(row.class||row.class_name||'').trim(),
    grade:row.grade==null?'':String(row.grade).trim(),
    school:String(row.school||'').trim(),
    phone:String(row.phone||'').trim(),
    role:String(row.role||'student').toLowerCase(),
    approved:row.approved!==false
  };
}

function compactRoster(students){return students.map(normalizeStudent).filter(s=>s.role==='student')}

function readPersistentCache(){
  try{
    const raw=sessionStorage.getItem(CACHE_KEY);if(!raw)return null;
    const parsed=JSON.parse(raw);
    if(!parsed||!Array.isArray(parsed.students)||!Number(parsed.loadedAt))return null;
    if(Date.now()-Number(parsed.loadedAt)>CACHE_MAX_AGE_MS){sessionStorage.removeItem(CACHE_KEY);return null}
    return {students:compactRoster(parsed.students),loadedAt:Number(parsed.loadedAt),source:'cache'};
  }catch{return null}
}

function writePersistentCache(snapshot){
  try{sessionStorage.setItem(CACHE_KEY,JSON.stringify({students:compactRoster(snapshot.students||[]),loadedAt:Number(snapshot.loadedAt)||Date.now()}))}catch{}
}

async function requestRoster(){
  const response=await apiFetch(ROSTER_ENDPOINT);
  let data={};
  try{data=await response.json()}catch{}
  if(!response.ok||data?.success===false){
    const error=new Error(data?.error||`Roster request failed (${response.status})`);
    error.status=response.status;
    throw error;
  }
  const students=compactRoster(data.students||[]);
  memory={students,loadedAt:Date.now(),raw:data,source:'network'};
  writePersistentCache(memory);
  return memory;
}

async function requestWithRepair(repairSession=true){
  try{return await requestRoster()}
  catch(firstError){
    if(!repairSession||![401,403].includes(Number(firstError.status)))throw firstError;
    const mod=await import('/Teachers/auth-refresh.js?v=20260917-adminv2-p21');
    const session=await mod.ensureTeacherSession();
    if(!session?.user_id)throw firstError;
    return requestRoster();
  }
}

function startRevalidate(repairSession=true){
  if(inFlight)return inFlight;
  inFlight=(async()=>{try{return await requestWithRepair(repairSession)}finally{inFlight=null}})();
  return inFlight;
}

export async function loadStudentRoster({force=false,repairSession=true,onRefresh=null}={}){
  if(force)return startRevalidate(repairSession);
  if(memory){
    startRevalidate(repairSession).then(fresh=>onRefresh?.(fresh)).catch(()=>{});
    return {...memory,source:memory.source||'memory'};
  }
  const cached=readPersistentCache();
  if(cached){
    memory=cached;
    startRevalidate(repairSession).then(fresh=>onRefresh?.(fresh)).catch(()=>{});
    return cached;
  }
  return startRevalidate(repairSession);
}

export function getStudentRoster(){return memory||readPersistentCache()}
export function clearStudentRoster(){memory=null;inFlight=null;try{sessionStorage.removeItem(CACHE_KEY)}catch{}}
export function replaceStudentRoster(students){memory={students:compactRoster(students||[]),loadedAt:Date.now(),source:'local'};writePersistentCache(memory);return memory}
