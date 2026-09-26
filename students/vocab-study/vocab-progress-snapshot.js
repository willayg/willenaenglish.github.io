function arr(v){return Array.isArray(v)?v:[]}
function txt(v){return String(v==null?'':v).trim()}
function clampPercent(v){return Math.max(0,Math.min(100,Number(v)||0))}

export function snapshotPercent(snapshot,skill,eligibleIds){
  const total=arr(eligibleIds).map(txt).filter(Boolean).length;
  if(!total)return 0;
  const block=snapshot&&snapshot[skill]||{};
  if(skill==='spelling'){
    return clampPercent((Number(block.test_passed_count)||0)*100/total);
  }
  return clampPercent((Number(block.passed_count)||0)*100/total);
}

export function snapshotStars(snapshot,skill,eligibleIds){
  const percent=snapshotPercent(snapshot,skill,eligibleIds);
  if(percent>=100)return 5;
  if(percent>=90)return 4;
  if(percent>=80)return 3;
  if(percent>=70)return 2;
  if(percent>=60)return 1;
  return 0;
}

export function snapshotRetryCount(snapshot,skill){
  const block=snapshot&&snapshot[skill]||{};
  if(skill==='spelling')return Math.max(0,Number(block.test_review_count)||0);
  return Math.max(0,Number(block.review_count)||0);
}

export function snapshotPassedCount(snapshot,skill){
  const block=snapshot&&snapshot[skill]||{};
  if(skill==='spelling')return Math.max(0,Number(block.test_passed_count)||0);
  return Math.max(0,Number(block.passed_count)||0);
}

export async function loadVocabSnapshot(bookId,unitId){
  const recorder=window.WillenaStudyProgress;
  if(!recorder||typeof recorder.getVocabSnapshot!=='function'){
    throw new Error('Vocab snapshot reader unavailable');
  }
  return recorder.getVocabSnapshot(bookId,unitId);
}


export function skillStateMap(snapshot,skill,mode=null){
  const map=new Map();
  arr(snapshot?.states).forEach(row=>{
    if(txt(row?.skill)!==txt(skill))return;
    if(mode&&txt(row?.mode)!==txt(mode))return;
    const id=txt(row?.lexical_entry_id);
    if(id)map.set(id,row);
  });
  return map;
}

export function nextSkillTargets(snapshot,skill,items,getId=item=>item?.id,mode=null){
  const source=arr(items).filter(Boolean);
  const states=skillStateMap(snapshot,skill,mode);
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
