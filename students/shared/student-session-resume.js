const safeJsonParse=value=>{try{return JSON.parse(value)}catch{return null}};

function tokenSubject(){
  try{
    const token=window.WillenaAPI?.getLocalAccessToken?.()||localStorage.getItem('sb_access_token')||'';
    const payload=token.split('.')[1];
    if(!payload)return'local';
    const json=decodeURIComponent(atob(payload.replace(/-/g,'+').replace(/_/g,'/')).split('').map(c=>`%${('00'+c.charCodeAt(0).toString(16)).slice(-2)}`).join(''));
    return safeJsonParse(json)?.sub||'local';
  }catch{return'local'}
}

export function createStudentSessionResume({appId,maxAgeMs=7*24*60*60*1000}={}){
  if(!appId)throw new Error('Session resume requires appId.');
  const key=`willena.session.v1.${appId}.${tokenSubject()}`;
  let active=false;

  function load(){
    const row=safeJsonParse(localStorage.getItem(key));
    if(!row||row.appId!==appId)return null;
    if(maxAgeMs&&Date.now()-Number(row.updatedAt||0)>maxAgeMs){clear();return null}
    return row;
  }
  function save(data={}){
    const row={...data,appId,updatedAt:Date.now()};
    localStorage.setItem(key,JSON.stringify(row));
    active=true;
    return row;
  }
  function clear(){localStorage.removeItem(key);active=false}
  function setActive(value=true){active=Boolean(value)}
  function isActive(){return active||Boolean(load())}
  function matches(moduleId,stageId){const row=load();return Boolean(row&&String(row.moduleId)===String(moduleId)&&String(row.stageId)===String(stageId))}

  function confirmExit(message='진행 중인 학습이 저장되어 있습니다. 지금 나가도 다음에 이어서 할 수 있어요. 나가시겠어요?'){
    return window.confirm(message);
  }
  function installBeforeUnload(){
    const handler=e=>{if(!active)return;e.preventDefault();e.returnValue=''};
    window.addEventListener('beforeunload',handler);
    return()=>window.removeEventListener('beforeunload',handler);
  }

  return{load,save,clear,setActive,isActive,matches,confirmExit,installBeforeUnload,key};
}
