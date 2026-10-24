// Same reward-only route and first-attempt star thresholds used by Word Genius.
// Does not grant a second set of points; correct attempts are already saved by
// the canonical study recorder (tracking.js).
const now=()=>new Date().toISOString();
const starsForPercent=p=>p>=100?5:p>=90?4:p>=80?3:p>=70?2:p>=60?1:0;
const id=()=>window.crypto?.randomUUID?.()||'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{
  const r=Math.random()*16|0;return(c==='x'?r:(r&3|8)).toString(16);
});
export function rewardSession(book,unit,mode){
  const startedAt=now(),sessionId=id();
  const record={mode,firstTotal:0,firstCorrect:0,points:0,completed:false,stars:0,percent:0};
  return {
    get summary(){return {...record}},
    note(correct,retryCount,points){
      if(record.completed)return;
      record.points+=Math.max(0,Number(points)||0);
      if(!retryCount){record.firstTotal++;if(correct)record.firstCorrect++}
    },
    async finish(){
      if(record.completed)return {...record};
      record.completed=true;
      record.percent=record.firstTotal?Math.round(100*record.firstCorrect/record.firstTotal):0;
      // Coach is an optional skill, so it earns practice points but no golden stars.
      record.stars=mode==='coach'?0:starsForPercent(record.percent);
      const payload={
        reward_only:true,session_id:sessionId,client_attempt_id:id(),
        book_id:book.id,unit_id:unit.id,
        skill:mode==='unscramble'?'sentence_unscramble':mode==='speaking'?'sentence_speaking':'sentence_coach',
        response_type:'reward',activity_id:'sentence-genius-reward',
        reward_mode:'sentence_'+mode,
        reward_list_name:'Sentence Genius · '+book.title+' · Unit '+unit.unit_number,
        reward_list_size:record.firstTotal,reward_started_at:startedAt,
        reward_summary:{
          completed:true,stars:record.stars,percent:record.percent,
          accuracy:record.firstTotal?record.firstCorrect/record.firstTotal:0,
          score:record.firstCorrect,total:record.firstTotal,
          points_earned:record.points,book_id:book.id,unit_id:unit.id,
          sentence_mode:mode,reward_scheme:'sentence-genius-v1',star_cap:5,
          session_source:'student'
        }
      };
      const fn=window.WillenaAPI?.fetch?window.WillenaAPI.fetch.bind(window.WillenaAPI):fetch;
      const response=await fn('/.netlify/functions/progress_summary?section=study_attempt&_='+Date.now(),{
        method:'POST',credentials:'include',cache:'no-store',
        headers:{'Content-Type':'application/json'},body:JSON.stringify({payload})
      });
      const result=await response.json().catch(()=>({}));
      if(!response.ok||result?.success!==true)throw Error(result?.error||'Could not save reward session');
      window.dispatchEvent(new CustomEvent('session:ended',{detail:{session_id:sessionId,mode:'sentence_'+mode}}));
      window.dispatchEvent(new CustomEvent('stars:refresh',{detail:{earned:record.stars}}));
      try{localStorage.setItem('stars:refresh',String(Date.now()))}catch{}
      return {...record};
    }
  };
}
