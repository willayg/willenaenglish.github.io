// Writing Genius rewards: use Word Genius's exact 0–5 star cutoffs.
// The first AI check fixes the session's stars. A successful correction clears
// mastery without rewriting the first-check score. Golden Units persist via
// Supabase's server-calculated unit rewards, not a localStorage flag.
const normalize=s=>String(s||'').toLowerCase().replace(/[’‘]/g,"'").replace(/[^a-z0-9]/g,'');
export function firstCheckPercent(responses=[],total=10){
 const points=responses.slice(0,total).reduce((sum,r)=>{
  const grade=(r?.firstFeedback||r?.feedback)?.grade;
  return sum+(grade==='correct'?4:grade==='almost'?2:0);
 },0);
 return total?Math.round(points*100/(4*total)):0;
}
export function starsForPercent(percent){
 const p=Math.max(0,Math.min(100,Number(percent)||0));
 return p>=100?5:p>=90?4:p>=80?3:p>=70?2:p>=60?1:0;
}
export function masteredAnswer(response={}){
 // Writing is mastered after an accepted AI/database check (not merely by
 // typing the visible model into the answer box without submitting it).
 return response?.feedback?.grade==='correct';
}
export function sessionSummary(session){
 const responses=Array.isArray(session?.responses)?session.responses:[];
 const questions=Array.isArray(session?.questions)?session.questions:[];
 const total=questions.length;
 const percent=firstCheckPercent(responses,total);
 const stars=starsForPercent(percent);
 const mastered=questions.filter((q,i)=>masteredAnswer(responses[i])).length;
 const eligible=total>0&&total<=10&&questions.every(q=>q.sourceUnitId===session?.unit_id);
 const checked=questions.filter((q,i)=>!!responses[i]?.firstFeedback||!!responses[i]?.feedback).length;
 return {percent,stars,mastered,eligible,checked,total,
  gold:eligible&&checked===total&&mastered===total};
}
// Canonical Genius reward record: same reward-only progress_summary path
// as Sentence Genius and Word Genius. Session UUID keeps retries idempotent.
export async function publishGeniusStars(session,summary,unitLabel){
 const payload={
  reward_only:true,session_id:session.id,
  client_attempt_id:session.id,book_id:session.book_id,unit_id:session.unit_id,
  skill:'writing_sentence',response_type:'reward',activity_id:'writing-genius-reward',
  reward_mode:'writing_make',reward_list_name:
   'Writing Genius · '+session.book_title+' · '+unitLabel,
  reward_list_size:summary.total,reward_started_at:session.created_at,
  reward_summary:{
   completed:true,stars:summary.stars,percent:summary.percent,
   accuracy:summary.percent/100,score:summary.percent,total:100,
   points_earned:0,book_id:session.book_id,unit_id:session.unit_id,
   writing_mode:'make',reward_scheme:'writing-genius-v2',
   star_cap:5,session_source:'student'
  }
 };
 const fn=window.WillenaAPI?.fetch?window.WillenaAPI.fetch.bind(window.WillenaAPI):fetch;
 const response=await fn('/.netlify/functions/progress_summary?section=study_attempt&_='+Date.now(),{
  method:'POST',credentials:'include',cache:'no-store',
  headers:{'Content-Type':'application/json'},body:JSON.stringify({payload})
 });
 const data=await response.json().catch(()=>null);
 if(!response.ok||data?.success!==true)throw Error(data?.error||'Stars could not sync with the Genius leaderboard');
 window.dispatchEvent(new CustomEvent('session:ended',{detail:{session_id:session.id,mode:'writing_make'}}));
 window.dispatchEvent(new CustomEvent('stars:refresh',{detail:{earned:summary.stars}}));
 try{localStorage.setItem('stars:refresh',String(Date.now()))}catch{}
 return true;
}
