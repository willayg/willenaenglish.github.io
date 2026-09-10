const EVENT='testprep:v2-activity-snapshot';
export function requestActivitySnapshot(){try{window.dispatchEvent(new CustomEvent(EVENT))}catch(_){}}
export function onActivitySnapshotRequest(handler){if(typeof handler!=='function')return()=>{};window.addEventListener(EVENT,handler);return()=>window.removeEventListener(EVENT,handler)}
