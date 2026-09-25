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
