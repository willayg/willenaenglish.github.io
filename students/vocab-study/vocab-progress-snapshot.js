function arr(v){return Array.isArray(v)?v:[]}
function txt(v){return String(v==null?'':v).trim()}
function clampPercent(v){return Math.max(0,Math.min(100,Number(v)||0))}

export function snapshotPercent(snapshot,skill,eligibleIds){
  const total=arr(eligibleIds).map(txt).filter(Boolean).length;
  if(!total)return 0;
  const block=snapshot&&snapshot[skill]||{};
  return clampPercent((Number(block.passed_count)||0)*100/total);
}

export async function loadVocabSnapshot(bookId,unitId){
  const recorder=window.WillenaStudyProgress;
  if(!recorder||typeof recorder.getVocabSnapshot!=='function'){
    throw new Error('Vocab snapshot reader unavailable');
  }
  return recorder.getVocabSnapshot(bookId,unitId);
}


export function skillStateMap(snapshot,skill){
  const map=new Map();
  arr(snapshot?.states).forEach(row=>{
    if(txt(row?.skill)!==txt(skill))return;
    const id=txt(row?.lexical_entry_id);
    if(id)map.set(id,row);
  });
  return map;
}

export function nextSkillTargets(snapshot,skill,items,getId=item=>item?.id){
  const source=arr(items).filter(Boolean);
  const states=skillStateMap(snapshot,skill);
  const unseen=[];
  const incomplete=[];
  source.forEach(item=>{
    const id=txt(getId(item));
    if(!id)return;
    const row=states.get(id);
    if(!row){unseen.push(item);return;}
    if(!row.passed)incomplete.push(item);
  });
  return unseen.length?unseen:incomplete;
}
