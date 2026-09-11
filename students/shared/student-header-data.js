// Shared student header data/service layer.
// No UI. Safe for app-specific headers to consume independently.

const listeners=new Set();
const state={
  ready:false,
  loading:false,
  userId:null,
  name:null,
  avatar:null,
  role:null,
  points:null,
  stars:null,
  lastUpdated:0
};

let started=false;
let inFlight=null;
let refreshTimer=0;

function snapshot(){return{...state}}
function emit(){const value=snapshot();listeners.forEach(fn=>{try{fn(value)}catch(e){console.warn('[student-header-data] listener failed',e)}})}
function setState(patch){Object.assign(state,patch);emit()}
function apiFetch(url,options){
  if(!window.WillenaAPI?.fetch)throw new Error('WillenaAPI unavailable');
  return window.WillenaAPI.fetch(url,options);
}
function localIdentity(){
  try{
    return{
      userId:localStorage.getItem('user_id')||null,
      name:localStorage.getItem('user_name')||localStorage.getItem('username')||null,
      avatar:localStorage.getItem('selectedEmojiAvatar')||localStorage.getItem('avatar')||null,
      role:localStorage.getItem('user_role')||null
    };
  }catch{return{userId:null,name:null,avatar:null,role:null}}
}
function persistIdentity(){
  try{
    if(state.userId)localStorage.setItem('user_id',state.userId);
    if(state.name){localStorage.setItem('user_name',state.name);localStorage.setItem('username',state.name)}
    if(state.avatar){localStorage.setItem('selectedEmojiAvatar',state.avatar);localStorage.setItem('avatar',state.avatar)}
    if(state.role)localStorage.setItem('user_role',state.role);
  }catch{}
}

async function fetchIdentity(){
  const whoRes=await apiFetch(`/.netlify/functions/supabase_auth?action=whoami&_=${Date.now()}`);
  const who=await whoRes.json().catch(()=>null);
  if(!who?.success)return null;
  const identity={
    userId:who.user_id||who.id||null,
    role:who.role||null,
    name:who.name||who.full_name||who.username||who.display_name||null,
    avatar:who.avatar||null
  };
  try{
    const profileRes=await apiFetch(`/.netlify/functions/supabase_auth?action=get_profile_name&_=${Date.now()}`);
    const profile=await profileRes.json().catch(()=>null);
    if(profile?.success){
      identity.name=profile.name||profile.username||identity.name;
      identity.avatar=profile.avatar||identity.avatar;
    }
  }catch{}
  return identity;
}

async function fetchOverview(){
  try{
    const res=await apiFetch(`/.netlify/functions/progress_summary?section=overview&_=${Date.now()}`);
    if(!res.ok)return null;
    const data=await res.json().catch(()=>null);
    if(!data)return null;
    return{
      points:Number.isFinite(Number(data.points))?Number(data.points):null,
      stars:Number.isFinite(Number(data.stars))?Number(data.stars):null
    };
  }catch{return null}
}

export async function refreshStudentHeaderData({identity=true,overview=true}={}){
  if(inFlight)return inFlight;
  inFlight=(async()=>{
    state.loading=true;emit();
    try{
      const [id,ov]=await Promise.all([
        identity?fetchIdentity().catch(()=>null):Promise.resolve(null),
        overview?fetchOverview():Promise.resolve(null)
      ]);
      if(id)Object.assign(state,id);
      if(ov){if(ov.points!=null)state.points=ov.points;if(ov.stars!=null)state.stars=ov.stars}
      state.ready=true;state.lastUpdated=Date.now();persistIdentity();emit();
      return snapshot();
    }finally{state.loading=false;emit();inFlight=null}
  })();
  return inFlight;
}

function scheduleRefresh(){
  clearTimeout(refreshTimer);
  refreshStudentHeaderData({identity:false,overview:true});
  refreshTimer=setTimeout(()=>refreshStudentHeaderData({identity:false,overview:true}),900);
}
function onPointsUpdate(e){const total=e?.detail?.total;if(typeof total==='number')setState({points:total})}
function onPointsBump(e){const delta=Number(e?.detail?.delta??1);if(Number.isFinite(delta)){const base=typeof state.points==='number'?state.points:0;setState({points:base+delta})}}
function onStarsBump(e){const delta=Number(e?.detail?.delta??1);if(Number.isFinite(delta)){const base=typeof state.stars==='number'?state.stars:0;setState({stars:base+delta})}}
function onAuthChanged(){Object.assign(state,{userId:null,name:null,avatar:null,role:null});refreshStudentHeaderData()}
function onStorage(e){if(['user_name','username','user_id','selectedEmojiAvatar','avatar','user_role'].includes(e.key)){Object.assign(state,localIdentity());emit()}}
function onFocus(){refreshStudentHeaderData()}

export function startStudentHeaderData(){
  if(started)return;
  started=true;
  Object.assign(state,localIdentity());emit();
  window.addEventListener('points:update',onPointsUpdate);
  window.addEventListener('points:optimistic-bump',onPointsBump);
  window.addEventListener('stars:optimistic-bump',onStarsBump);
  window.addEventListener('stars:refresh',scheduleRefresh);
  window.addEventListener('session:ended',scheduleRefresh);
  window.addEventListener('auth:changed',onAuthChanged);
  window.addEventListener('storage',onStorage);
  window.addEventListener('focus',onFocus);
  refreshStudentHeaderData();
}

export function subscribeStudentHeaderData(listener,{immediate=true}={}){
  if(typeof listener!=='function')return()=>{};
  listeners.add(listener);
  if(immediate)listener(snapshot());
  return()=>listeners.delete(listener);
}

export function getStudentHeaderData(){return snapshot()}
