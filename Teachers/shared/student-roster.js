// Shared teacher/admin student directory loader.
// The admin-protected roster endpoint doubles as the Admin V2 authorization gate.
const ROSTER_ENDPOINT='/.netlify/functions/teacher_admin?action=list_students';
let inFlight=null;
let memory=null;

function apiFetch(path,options={}){
  const fn=window.WillenaAPI?.fetch||window.fetch.bind(window);
  return fn(path,{credentials:'include',cache:'no-store',...options});
}

export function normalizeStudent(row={}){
  return {
    ...row,
    id:row.id||row.user_id||'',
    name:String(row.name||row.english_name||'').trim(),
    korean_name:String(row.korean_name||row.koreanName||'').trim(),
    username:String(row.username||'').trim(),
    class:String(row.class||row.class_name||'').trim(),
    grade:row.grade==null?'':String(row.grade).trim(),
    school:String(row.school||'').trim(),
    phone:String(row.phone||'').trim(),
    role:String(row.role||'student').toLowerCase(),
    approved:row.approved!==false
  };
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
  const students=(data.students||[]).map(normalizeStudent).filter(s=>s.role==='student');
  memory={students,loadedAt:Date.now(),raw:data};
  return memory;
}

export async function loadStudentRoster({force=false,repairSession=true}={}){
  if(memory&&!force)return memory;
  if(inFlight&&!force)return inFlight;
  inFlight=(async()=>{
    try{return await requestRoster()}
    catch(firstError){
      if(!repairSession||![401,403].includes(Number(firstError.status)))throw firstError;
      const mod=await import('/Teachers/auth-refresh.js?v=20260917-adminv2-p2');
      const session=await mod.ensureTeacherSession();
      if(!session?.user_id)throw firstError;
      return requestRoster();
    }
    finally{inFlight=null}
  })();
  return inFlight;
}

export function getStudentRoster(){return memory}
export function clearStudentRoster(){memory=null;inFlight=null}
