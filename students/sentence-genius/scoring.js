// Reuse Word Genius's canonical star thresholds and repeat-until-correct policy.
// This store is an optimistic per-student cache; every submitted attempt is also
// sent to the existing authenticated study recorder (tracking.js).
import {snapshotPercent,snapshotStars} from '/students/vocab-study/vocab-progress-snapshot.js';
import {repeatUntilCorrect} from '/students/vocab-study/vocab-pass-flow.js';
import {speakingStars} from '/students/shared/speaking-smart-grade.js?v=20261111-1';
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
          passed:!!(before.passed||row.passed),qualityPoints:before.qualityPoints??(row.passed?4:0)};
      }
      write();
    },
    attempt(mode,id,{correct,hintsUsed=0,assisted=false,almostRight=false,gradePoints=null}={}){
      if(!states[mode])throw Error('Unknown skill');
      const previous=states[mode][id]||{attempts:0,passed:false,firstCorrect:null};
      const listened=mode==='speaking'&&!!assisted;
      const grade=(mode==='unscramble')?(correct?4:0):
        Math.max(0,Math.min(4,Number(gradePoints??(correct?4:almostRight?2:0))||0));
      const mastered=!!correct&&grade>=2;
      // A lime/yellow answer is a real pass. Listening may cap its points,
      // but it never forces a successful child to repeat an entire question.
      const first=Number(previous.attempts||0)===0;
      const points=previous.passed?0:mastered?
        (listened?Math.min(2,grade):mode==='coach'?Math.max(1,grade-Math.min(2,Number(hintsUsed)||0)):grade):0;
      const firstCorrect=previous.firstCorrect==null?mastered:previous.firstCorrect;
      const updated={attempts:(Number(previous.attempts)||0)+1,
        passed:previous.passed||mastered,firstCorrect,
        qualityPoints:first?(mastered?grade:0):(previous.qualityPoints??0),
        lastGradePoints:grade,lastGradeLevel:grade===4?'green':grade===3?'lime':grade===2?'yellow':'red'};
      states[mode][id]=updated;write();
      return {retryCount:Number(previous.attempts)||0,firstCorrect:first,
        previouslyPassed:!!previous.passed,mastered,assisted:listened,
        almostRight:grade===2||grade===3,gradePoints:grade,gradeLevel:updated.lastGradeLevel,
        points,repeat:repeatUntilCorrect(mastered)};
    },
    passed(mode,id){return !!states[mode]?.[id]?.passed},
    percent(mode,items){
      const passed=items.filter(i=>states[mode]?.[i.id]?.passed).length;
      return Math.round(snapshotPercent({[mode]:{passed_count:passed}},mode,items.map(i=>i.id)));
    },
    stars(mode,items){
      const count=items.filter(i=>states[mode]?.[i.id]?.passed).length;
      if(mode==='unscramble')return snapshotStars({[mode]:{passed_count:count}},mode,items.map(i=>i.id));
      const total=items.reduce((sum,i)=>sum+Math.max(0,Math.min(4,Number(states[mode]?.[i.id]?.qualityPoints??(states[mode]?.[i.id]?.passed?4:0))||0)),0);
      return speakingStars(items.length?100*total/(4*items.length):0);
    },
    gold(items){return items.length>0&&REQUIRED.every(mode=>items.every(i=>states[mode]?.[i.id]?.passed))},
    pending(mode,items){return items.filter(item=>!states[mode]?.[item.id]?.passed)}
  };
}
export function normalizeAnswer(s){return String(s??'').toLowerCase().replace(/[’‘]/g,"'").replace(/[^a-z0-9' ]/g,' ').replace(/\s+/g,' ').trim()}
export function checkOrder(response,target){return normalizeAnswer(response)===normalizeAnswer(target)}
