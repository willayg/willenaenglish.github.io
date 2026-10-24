// Reuse Word Genius's canonical star thresholds and repeat-until-correct policy.
// This store is an optimistic per-student cache; every submitted attempt is also
// sent to the existing authenticated study recorder (tracking.js).
import {snapshotPercent,snapshotStars} from '/students/vocab-study/vocab-progress-snapshot.js';
import {repeatUntilCorrect} from '/students/vocab-study/vocab-pass-flow.js';
export const MODES=Object.freeze({coach:'coach',unscramble:'unscramble',speaking:'speaking'});
export const REQUIRED=['coach','unscramble','speaking'];
const pref=(user,unit)=>'willena-sentence-genius-v1:'+user+':'+unit;
export function openUnit(user,unit,{preview=false}={}){
  const key=pref(user,unit);let saved={};
  if(!preview){try{saved=JSON.parse(localStorage.getItem(key)||'{}')}catch{}}
  if(!saved||typeof saved!=='object')saved={};
  const states={unscramble:saved.unscramble||{},speaking:saved.speaking||{},coach:saved.coach||{}};
  const write=()=>{if(preview)return;try{localStorage.setItem(key,JSON.stringify(states))}catch(error){console.warn('[Sentence Genius] local cache unavailable',error)}};
  return {
    states,
    hydrateServer(rows){
      for(const row of rows||[]){
        if(!states[row.mode]||!row.id)continue;
        const before=states[row.mode][row.id]||{attempts:0,passed:false,firstCorrect:null};
        states[row.mode][row.id]={...before,attempts:Math.max(before.attempts||0,row.attempts||0),
          passed:!!(before.passed||row.passed)};
      }
      write();
    },
    attempt(mode,id,{correct,hintsUsed=0,assisted=false,almostRight=false}={}){
      if(!states[mode])throw Error('Unknown skill');
      const previous=states[mode][id]||{attempts:0,passed:false,firstCorrect:null};
      // Listening does not consume mastery. A correct assisted answer earns
      // two points EVERY time; the next independent correct answer earns four.
      // Almost Right is separate: award two once, then the remaining two
      // when the sentence is independently corrected.
      const listened=mode==='speaking'&&!!assisted;
      const mastered=!!correct&&!listened;
      const nearMiss=!correct&&!!almostRight&&!listened;
      const partialAwarded=!!previous.partialAwarded;
      let points=0;
      if(!previous.passed){
        if(listened)points=correct?2:0;
        else if(nearMiss)points=partialAwarded?0:2;
        else if(mastered)points=mode==='coach'?
          Math.max(1,3-Math.min(2,Number(hintsUsed)||0)):
          partialAwarded?2:4;
      }
      const firstCorrect=previous.firstCorrect==null?mastered:previous.firstCorrect;
      const updated={attempts:(Number(previous.attempts)||0)+1,
        passed:previous.passed||mastered,firstCorrect,
        partialAwarded:partialAwarded||(nearMiss&&points>0)};
      states[mode][id]=updated;write();
      return {retryCount:Number(previous.attempts)||0,firstCorrect:previous.firstCorrect==null,
        previouslyPassed:!!previous.passed,mastered,assisted:listened,almostRight:nearMiss,
        points,repeat:repeatUntilCorrect(mastered)};
    },
    passed(mode,id){return !!states[mode]?.[id]?.passed},
    percent(mode,items){
      const passed=items.filter(i=>states[mode]?.[i.id]?.passed).length;
      return Math.round(snapshotPercent({[mode]:{passed_count:passed}},mode,items.map(i=>i.id)));
    },
    stars(mode,items){
      const count=items.filter(i=>states[mode]?.[i.id]?.passed).length;
      return snapshotStars({[mode]:{passed_count:count}},mode,items.map(i=>i.id));
    },
    gold(items){return items.length>0&&REQUIRED.every(mode=>items.every(i=>states[mode]?.[i.id]?.passed))},
    pending(mode,items){return items.filter(item=>!states[mode]?.[item.id]?.passed)}
  };
}
export function normalizeAnswer(s){return String(s??'').toLowerCase().replace(/[’‘]/g,"'").replace(/[^a-z0-9' ]/g,' ').replace(/\s+/g,' ').trim()}
export function checkOrder(response,target){return normalizeAnswer(response)===normalizeAnswer(target)}
