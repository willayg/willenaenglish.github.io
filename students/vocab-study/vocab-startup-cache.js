const PREFIX='willena-vocab-startup-v1:';

function now(){return Date.now()}
function key(parts){return PREFIX+parts.map(v=>String(v??'')).join(':')}
function readRaw(storageKey){
  try{
    const raw=localStorage.getItem(storageKey);
    if(!raw)return null;
    const parsed=JSON.parse(raw);
    if(!parsed||typeof parsed!=='object'||!('savedAt' in parsed))return null;
    return parsed;
  }catch(_){return null}
}
function writeRaw(storageKey,value){
  try{
    localStorage.setItem(storageKey,JSON.stringify({savedAt:now(),value}));
    return true;
  }catch(_){return false}
}
function get(parts,maxAgeMs){
  const row=readRaw(key(parts));
  if(!row)return null;
  if(Number.isFinite(maxAgeMs)&&maxAgeMs>=0&&(now()-Number(row.savedAt||0))>maxAgeMs)return null;
  return row.value;
}
function set(parts,value){return writeRaw(key(parts),value)}

export const TTL={
  assignment:10*60*1000,
  bookMeta:6*60*60*1000,
  vocabulary:6*60*60*1000
};

export function getAssignment(className){
  return get(['assignment',className],TTL.assignment);
}
export function setAssignment(className,value){
  return set(['assignment',className],value);
}
export function getBookMeta(bookId){
  return get(['book-meta',bookId],TTL.bookMeta);
}
export function setBookMeta(bookId,value){
  return set(['book-meta',bookId],value);
}
export function getVocabulary(bookId,unitId){
  return get(['vocab',bookId,unitId],TTL.vocabulary);
}
export function setVocabulary(bookId,unitId,value){
  return set(['vocab',bookId,unitId],value);
}

export function background(task,label='refresh'){
  Promise.resolve().then(task).catch(error=>{
    console.warn('[Vocab Study cache]',label,'failed',error);
  });
}
