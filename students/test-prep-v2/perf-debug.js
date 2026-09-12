export function createPerfDebug({getStatsDiagnostics}={}){
  const startedAt=performance.now();
  const marks={auth:null,ui:null,stats:null};
  const fmt=v=>v==null?'…':v<1000?`${Math.round(v)}ms`:`${(v/1000).toFixed(2)}s`;
  function ensure(){
    let el=document.getElementById('tpSpeedHud');
    if(el)return el;
    el=document.createElement('div');
    el.id='tpSpeedHud';
    el.style.cssText='position:fixed;left:12px;bottom:58px;z-index:2147483645;padding:4px 7px;border-radius:8px;background:rgba(32,48,57,.82);color:#fff;font:700 8px/1.35 Poppins,sans-serif;letter-spacing:.01em;pointer-events:none;opacity:.78;white-space:nowrap';
    document.body.appendChild(el);
    return el;
  }
  function update(){
    const d=typeof getStatsDiagnostics==='function'?getStatsDiagnostics():{};
    const el=ensure();
    el.textContent=`AUTH ${fmt(marks.auth)} · UI ${fmt(marks.ui)} · STATS ${fmt(marks.stats)} · CACHE ${d?.unitCacheHits??0}/${d?.unitCacheMisses??0}`;
  }
  function mark(name){
    if(Object.prototype.hasOwnProperty.call(marks,name))marks[name]=performance.now()-startedAt;
    update();
    return marks[name];
  }
  return{update,mark};
}
