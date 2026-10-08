(function(){
'use strict';
/* Standalone learning-growth feature. The detail drawer only supplies a student state and host. */
const ALL='__all__';
const SKILL_NAMES={vocabulary:'단어 학습',vocab_test:'어휘 문제',grammar:'문법',sentences:'본문',communication:'의사소통',reading:'독해',constructed_response:'서술형'};
const SKILL_ORDER=['vocabulary','vocab_test','grammar','sentences','communication','reading','constructed_response'];
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=x=>Number.isFinite(Number(x))?Number(x):0;
const pct=(correct,total)=>num(total)>0?num(correct)/num(total)*100:null;
const showPct=x=>x==null?'—':Math.round(x)+'%';
const dateParts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'});
function dayKey(value){
 const d=new Date(value);if(!value||Number.isNaN(d.getTime()))return '';
 const p=Object.fromEntries(dateParts.formatToParts(d).map(x=>[x.type,x.value]));
 return p.year+'-'+p.month+'-'+p.day;
}
function dateLabel(value){
 if(!value)return '—';
 const d=new Date(value);
 return Number.isNaN(d.getTime())?'—':d.toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
}
function card(value,label,sub=''){
 return '<div class="na2-kpi"><strong>'+esc(value)+'</strong><span>'+esc(label)+'</span><small>'+esc(sub)+'</small></div>';
}
function answerEvents(attempts,book,lesson,skill){
 const ordered=(Array.isArray(attempts)?attempts:[]).filter(a=>String(a.book_key||'')===book&&a.attempted_at&&a.completed_at&&a.question_id)
   .sort((a,b)=>new Date(a.attempted_at)-new Date(b.attempted_at));
 const latest=new Map(),result=[],counted={unmatched:0};
 for(const a of ordered){
   const key=book+'\u0001'+String(a.question_id);
   if(a.is_retry===false){
     const original={key,correct:a.is_correct===true,lesson:String(a.unit_key||''),skill:String(a.practice_type||''),corrected:false,retried:false};
     latest.set(key,original);
     if((lesson===ALL||original.lesson===lesson)&&(skill===ALL||original.skill===skill))
       result.push({type:'first',original,sessionId:String(a.session_id||''),time:a.completed_at});
   }else if(a.is_retry===true){
     const original=latest.get(key);
     if(!original){counted.unmatched++;continue}
     if((lesson===ALL||original.lesson===lesson)&&(skill===ALL||original.skill===skill))
       result.push({type:'retry',original,correct:a.is_correct===true,sessionId:String(a.session_id||''),time:a.completed_at});
   }
 }
 return{events:result,unmatched:counted.unmatched};
}
/* Attempt-based timeline: every submitted first answer and retry contributes one result.
   The original-question association is used for filter classification only. */
function attemptSequence(attempts,book,lesson,skill){
 const firstByQuestion=new Map(),included=[];
 const all=(Array.isArray(attempts)?attempts:[])
   .filter(a=>String(a.book_key||'')===book&&a.attempted_at&&(a.is_correct===true||a.is_correct===false))
   .sort((a,b)=>new Date(a.attempted_at)-new Date(b.attempted_at));
 for(const a of all){
   const question=String(a.question_id||'');
   const key=book+'\u0001'+question;
   const first=!a.is_retry;
   const own={lesson:String(a.unit_key||''),skill:String(a.practice_type||'')};
   if(first&&question)firstByQuestion.set(key,own);
   const scope=first?own:firstByQuestion.get(key)||own;
   if((lesson!==ALL&&scope.lesson!==lesson)||(skill!==ALL&&scope.skill!==skill))continue;
   included.push({
     sessionId:String(a.session_id||''),time:a.attempted_at,
     isRetry:!first,isCorrect:a.is_correct===true,
     questionId:question,lesson:scope.lesson,skill:scope.skill
   });
 }
 return included;
}
function buildAttemptRolling(attempts,daily,windowSize){
 const groups=new Map();
 for(const a of attempts){
   const id=daily?dayKey(a.time):a.sessionId;
   if(!id)continue;
   const when=new Date(a.time).getTime();
   const group=groups.get(id)||{key:id,date:dayKey(a.time),time:when,events:[],sessions:new Set()};
   group.events.push(a);group.sessions.add(a.sessionId);
   group.time=Math.max(group.time,when);
   groups.set(id,group);
 }
 const ordered=[...groups.values()].sort((a,b)=>a.time-b.time||a.key.localeCompare(b.key));
 const recent=[];
 return ordered.map(group=>{
   let correct=0,retries=0;
   for(const a of group.events){
     recent.push(a);
     if(recent.length>windowSize)recent.shift();
     if(a.isCorrect)correct++;
     if(a.isRetry)retries++;
   }
   const rollingCorrect=recent.filter(a=>a.isCorrect).length;
   const firsts=recent.filter(a=>!a.isRetry);
   const retryRows=recent.filter(a=>a.isRetry);
   const firstCorrect=firsts.filter(a=>a.isCorrect).length;
   const retryCorrect=retryRows.filter(a=>a.isCorrect).length;
   return{
     key:group.key,date:group.date,time:group.time,label:daily?group.date:dateLabel(group.time),
     correct,total:group.events.length,retries,sessions:group.sessions.size,
     first:pct(firstCorrect,firsts.length),after:pct(rollingCorrect,recent.length),
     rollingCorrect,windowTotal:recent.length,
     firstCorrect,firstTotal:firsts.length,retryCorrect,retryTotal:retryRows.length,
     raw:pct(correct,group.events.length)
   };
 });
}
function buildTimeline(events,daily,windowSize){
 const groups=new Map();
 for(const e of events){
   const id=daily?dayKey(e.time):e.sessionId;
   if(!id)continue;
   const group=groups.get(id)||{key:id,date:dayKey(e.time),timestamp:new Date(e.time).getTime(),events:[],sessions:new Set()};
   group.events.push(e);group.sessions.add(e.sessionId);
   if(new Date(e.time).getTime()>group.timestamp)group.timestamp=new Date(e.time).getTime();
   groups.set(id,group);
 }
 const ordered=[...groups.values()].sort((a,b)=>a.timestamp-b.timestamp||a.key.localeCompare(b.key));
 let window=[],rowIndex=0;
 return ordered.map(group=>{
   let groupTotal=0,groupCorrect=0,retries=0;const groupFirsts=[];
   for(const e of group.events){
     if(e.type==='first'){
       window.push(e.original);groupFirsts.push(e.original);groupTotal++;
       if(e.original.correct)groupCorrect++;
       if(window.length>windowSize)window=window.slice(-windowSize);
     }else{
       retries++;
       if(!e.original.correct){
         e.original.retried=true;
         if(e.correct)e.original.corrected=true;
       }
     }
   }
   const firstCorrect=window.filter(a=>a.correct).length;
   const fixed=window.filter(a=>!a.correct&&a.corrected).length;
   const retriedWrong=window.filter(a=>!a.correct&&a.retried&&!a.corrected).length;
   const notRetried=window.filter(a=>!a.correct&&!a.retried).length;
   const total=window.length;
   const groupFixed=groupFirsts.filter(a=>!a.correct&&a.corrected).length;
   return {
     key:group.key,date:group.date,time:group.timestamp,index:++rowIndex,
     correct:groupCorrect,total:groupTotal,retries,sessions:group.sessions.size,groupFixed,
     first:pct(firstCorrect,total),after:pct(firstCorrect+fixed,total),
     windowCorrect:firstCorrect,windowTotal:total,fixed,retriedWrong,notRetried,
     raw:pct(groupCorrect,groupTotal),groupAfter:pct(groupCorrect+groupFixed,groupTotal)
   };
 });
}
function originalSeries(rows,daily){
 if(!daily)return [...rows].sort((a,b)=>new Date(a.completed_at)-new Date(b.completed_at))
   .map(r=>({key:String(r.session_id),date:dayKey(r.completed_at),time:new Date(r.completed_at).getTime(),correct:num(r.correct),total:num(r.total),retries:num(r.retries),sessions:1,label:dateLabel(r.completed_at)}));
 const map=new Map();
 for(const r of rows){
   const key=dayKey(r.completed_at);
   if(!key)continue;
   const v=map.get(key)||{key,date:key,time:new Date(r.completed_at).getTime(),correct:0,total:0,retries:0,sessions:0,label:key};
   v.correct+=num(r.correct);v.total+=num(r.total);v.retries+=num(r.retries);v.sessions++;
   map.set(key,v);
 }
 return [...map.values()].sort((a,b)=>a.date.localeCompare(b.date));
}
function chartMarkup(points,{daily,compare=false,metric='after'}){
 if(!points.length)return '<div class="na2-detail-empty">그래프에 표시할 기록이 없습니다.</div>';
 const W=750,left=50,right=22,top=22,bottom=178,height=bottom-top;
 const locate=i=>left+(points.length===1?(W-left-right)/2:i*(W-left-right)/(points.length-1));
 const label=p=>daily?p.date:(p.label||dateLabel(p.time));
 const xy=(val,i)=>locate(i).toFixed(1)+','+(bottom-num(val)*height/100).toFixed(1);
 function plot(field,color,title){
   const sections=[];let part=[];
   for(let i=0;i<points.length;i++){
     const value=points[i][field];
     if(value==null){if(part.length)sections.push(part);part=[]}
     else part.push(xy(value,i));
   }
   if(part.length)sections.push(part);
   const lines=sections.map(arr=>arr.length>1?'<polyline fill="none" stroke="'+color+'" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" points="'+arr.join(' ')+'"/>':'').join('');
   const dots=points.length>70?'':points.map((p,i)=>p[field]==null?'':'<circle cx="'+locate(i).toFixed(1)+'" cy="'+(bottom-num(p[field])*height/100).toFixed(1)+'" r="3.7" fill="'+color+'"><title>'+esc(label(p)+': '+title+' '+showPct(p[field]))+'</title></circle>').join('');
   return lines+dots;
 }
 const first=points[0],last=points[points.length-1];
 const firstText=daily?first.date?.slice(5):'1회',lastText=daily?last.date?.slice(5):points.length+'회';
 const labels=points.length>1?'<text x="'+left+'" y="208" text-anchor="start">'+esc(firstText)+'</text><text x="'+(W-right)+'" y="208" text-anchor="end">'+esc(lastText)+'</text>':'';
 const title=compare?'최초 정답률 및 수정 후 정답률 비교':metric==='after'?'재시도 반영 정확도':'최초 정확도';
 return '<svg viewBox="0 0 750 220" role="img" aria-label="'+esc(title)+'" style="width:100%;height:auto;display:block">'+
  '<g font-size="12" fill="#677"><text x="7" y="27">100%</text><text x="15" y="104">50%</text><text x="24" y="182">0%</text>'+labels+'</g>'+
  '<path d="M '+left+' '+top+' V '+bottom+' H '+(W-right)+'" stroke="#b9cbd0" fill="none"/>'+
  '<line x1="'+left+'" x2="'+(W-right)+'" y1="'+((top+bottom)/2)+'" y2="'+((top+bottom)/2)+'" stroke="#e8eff0" stroke-dasharray="3 5"/>'+
  (compare?plot('first','#13a4ac','최초 정답률')+plot('after','#de6999','수정 후 정답률')
          :plot(metric,'#13a4ac',metric==='after'?'수정 후 정답률':'기존 정확도'))+'</svg>';
}
function render({state,body}){
 const data=window.NaesinV2Data;
 if(!data){body.innerHTML='<div class="na2-detail-error">학습 데이터를 불러올 수 없습니다.</div>';return}
 if(!state.progressRows||!state.progressAttemptHistory){
   body.innerHTML='<div class="na2-detail-loading">학습 성장 기록을 불러오는 중…</div>';
   if(state.progressLoading)return;
   state.progressLoading=true;
   const opened=state;
   Promise.all([
     state.progressRows?Promise.resolve(state.progressRows):data.loadSessionHistory(state.planId),
     state.progressAttemptHistory?Promise.resolve(state.progressAttemptHistory):data.loadAttemptHistory(state.planId)
   ]).then(([rows,attempts])=>{
     if(!isCurrent(opened))return;
     state.progressRows=Array.isArray(rows)?rows:[];
     state.progressAttemptHistory=Array.isArray(attempts)?attempts:[];
     if(state.tab==='progress')render({state,body});
   }).catch(err=>{
     if(!isCurrent(opened)||state.tab!=='progress')return;
     body.innerHTML='<div class="na2-detail-error">'+esc(err.message||'기록을 불러오지 못했습니다.')+' <button type="button" data-progress-retry>다시 시도</button></div>';
     body.querySelector('[data-progress-retry]')?.addEventListener('click',()=>render({state,body}));
   }).finally(()=>{state.progressLoading=false});
   return;
 }
 const rows=state.progressRows.filter(r=>num(r.total)>0&&r.completed_at);
 const bookKey=String(state.data?.group?.book_key||state.data?.stats?.book_key||'');
 const book=rows.some(r=>String(r.book_key||'')===bookKey)?bookKey:String(rows[0]?.book_key||bookKey);
 const scoped=rows.filter(r=>String(r.book_key||'')===book);
 const unique=arr=>[...new Set(arr.filter(Boolean))];
 const lessons=unique(scoped.map(r=>String(r.unit_key||''))).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
 const lesson=lessons.includes(state.progressFilters?.lesson)?state.progressFilters.lesson:ALL;
 const byLesson=lesson===ALL?scoped:scoped.filter(r=>r.unit_key===lesson);
 const skills=unique(byLesson.map(r=>String(r.practice_type||''))).sort((a,b)=>(SKILL_ORDER.indexOf(a)<0?99:SKILL_ORDER.indexOf(a))-(SKILL_ORDER.indexOf(b)<0?99:SKILL_ORDER.indexOf(b)));
 const skill=skills.includes(state.progressFilters?.skill)?state.progressFilters.skill:ALL;
 state.progressFilters={lesson,skill};
 const items=(skill===ALL?byLesson:byLesson.filter(r=>r.practice_type===skill));
 const daily=lesson===ALL||skill===ALL;
 const windowSize=lesson===ALL&&skill===ALL?50:20;
 const rolling=state.progressMode!=='raw';
 const rawSeries=originalSeries(items,daily);
 const {events,unmatched}=answerEvents(state.progressAttemptHistory,book,lesson,skill);
 const attemptRows=attemptSequence(state.progressAttemptHistory,book,lesson,skill);
 const rollingSeries=buildAttemptRolling(attemptRows,daily,windowSize);
 const lastRolling=rollingSeries[rollingSeries.length-1]||null;
 const correctionSeries=buildTimeline(events,daily,windowSize);
 const lastCorrection=correctionSeries[correctionSeries.length-1]||null;
 const comparisonPoints=rollingSeries.map(row=>({...row,label:daily?row.date:dateLabel(row.time)}));
 const mainPoints=rolling?comparisonPoints:rawSeries.map(row=>({...row,first:pct(row.correct,row.total)}));
 const option=(value,label,active)=>'<option value="'+esc(value)+'"'+(value===active?' selected':'')+'>'+esc(label)+'</option>';
 const select=(key,values,active,formatter)=>'<select data-progress-filter="'+key+'" style="width:100%;min-width:0;padding:10px;border:1px solid #d0e2e7;border-radius:9px;background:var(--surface,#fff);color:inherit">'+values.map(v=>option(v,formatter(v),active)).join('')+'</select>';
 const filters='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:12px;margin-bottom:14px">'+
   '<label>레슨'+select('lesson',[ALL,...lessons],lesson,v=>v===ALL?'전체 레슨':v)+'</label>'+
   '<label>영역'+select('skill',[ALL,...skills],skill,v=>v===ALL?'전체 영역':SKILL_NAMES[v]||v)+'</label></div>';
 const modes='<div class="na2-progress-modes" role="group" aria-label="정확도 표시 방식">'+
  '<button type="button" data-progress-mode="rolling" class="'+(rolling?'active':'')+'" aria-pressed="'+rolling+'">최근 '+windowSize+'문항 이동 평균</button>'+
  '<button type="button" data-progress-mode="raw" class="'+(!rolling?'active':'')+'" aria-pressed="'+(!rolling)+'">기존 정확도</button></div>';
 const firstCorrect=num(lastRolling?.windowCorrect),sample=num(lastRolling?.windowTotal),fixed=num(lastRolling?.fixed);
 const wrong=sample-firstCorrect,still=num(lastRolling?.retriedWrong),missing=num(lastRolling?.notRetried);
 const cards=card(showPct(lastRolling?.after),'현재 정답률','최근 '+windowSize+'문항 · '+(firstCorrect+fixed)+' / '+sample)+
   card(showPct(lastRolling?.first),'최초 정답률','최근 '+windowSize+'문항 · '+firstCorrect+' / '+sample)+
   card(fixed+' / '+wrong,'수정한 오답','최근 '+windowSize+'문항 중 틀린 문제');
 const displayed=rolling?rollingSeries:rawSeries;
 const heads=daily?['날짜','정답','정답률','연습 횟수','재시도']:['일시','정답','정답률','재시도'];
 if(rolling){heads.splice(3,0,'최근 '+windowSize+'문항');heads.splice(4,0,'수정 후');}
 const dataRows=displayed.map((row,i)=>{
   const base=rolling?row:rawSeries[i];
   const cols=[daily?base.date:(rolling?dateLabel(base.time):base.label),base.correct+' / '+base.total,showPct(pct(base.correct,base.total))];
   if(rolling){cols.push(showPct(row.first)+' ('+row.windowTotal+'/'+windowSize+')');cols.push(showPct(row.after));}
   if(daily)cols.push(String(base.sessions||0));
   cols.push(String(base.retries));
   return '<tr style="border-top:1px solid #e0ebee">'+cols.map((value,j)=>'<td style="'+(j===0?'padding:9px 5px;':'')+'">'+esc(value)+'</td>').join('')+'</tr>';
 }).join('');
 const analysisOpen=state.progressAnalysisOpen===true;
 const correctionRate=wrong?showPct(pct(fixed,wrong)):'—';
 const analysis='<details class="na2-progress-analysis" data-progress-analysis'+(analysisOpen?' open':'')+'>'+
  '<summary><span><strong>오답 분석</strong><small>최초 정답률과 오답 수정 후 정답률 비교</small></span><span class="na2-progress-analysis-chevron" aria-hidden="true">⌄</span></summary>'+
  '<div class="na2-progress-analysis-body">'+
  '<div class="na2-progress-analysis-legend"><span class="first">최초 정답률</span><span class="after">오답 수정 후</span></div>'+
  chartMarkup(comparisonPoints,{daily,compare:true})+
  '<p class="na2-progress-chart-note">최근 '+windowSize+'문항을 같은 기준으로 비교합니다. 오답은 수정한 날짜부터 반영됩니다.</p>'+
  '<div class="na2-progress-correction">'+card(correctionRate,'오답 수정률',fixed+' / '+wrong+'개 수정')+
  '<p>수정 완료 <strong>'+fixed+'</strong> · 재시도했지만 오답 <strong>'+still+'</strong> · 아직 재시도 안 함 <strong>'+missing+'</strong></p></div>'+
  '</div></details>';
 const title=rolling?'최근 '+windowSize+'문항 학습 정확도':daily?'일별 정확도':'회차별 정확도';
 const caption=rolling?'오답을 수정한 날짜부터 정확도에 반영됩니다. 각 문제는 한 번만 계산합니다. 문항 수가 '+windowSize+'개 미만이면 실제 문항 수를 사용합니다.'
  :'기존 방식: 해당 날짜나 회차의 첫 응답 정답률입니다. 오답 수정은 위 요약과 아래 오답 분석에서 확인할 수 있습니다.';
 body.innerHTML=filters+modes+
 (mainPoints.length?'<div class="na2-kpi-grid na2-progress-summary">'+cards+'</div>'+
  '<section class="na2-detail-section"><div class="na2-section-head"><h3>'+title+'</h3><span>'+(rolling?'재시도 반영 · ':'첫 응답 기준 · ')+items.length+'회</span></div>'+
  chartMarkup(mainPoints,{daily,metric:rolling?'after':'first'})+
  '<p class="na2-progress-chart-note">'+esc(caption)+'</p></section>'+
  analysis+
  '<section class="na2-detail-section na2-progress-records"><div class="na2-section-head"><h3>학습 기록</h3><span>최초 응답 · 재시도 횟수</span></div>'+
  '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;text-align:left;font-size:13px"><thead><tr>'+
  heads.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+dataRows+'</tbody></table></div></section>'+
  (unmatched?'<p class="na2-progress-chart-note">원래 질문과 연결되지 않은 과거 재시도 '+unmatched+'개는 제외했습니다.</p>':'')
  :'<div class="na2-detail-empty">선택한 레슨과 영역의 학습 기록이 없습니다.</div>');
 body.querySelectorAll('[data-progress-filter]').forEach(el=>el.addEventListener('change',()=>{
   state.progressFilters[el.dataset.progressFilter]=el.value;
   if(el.dataset.progressFilter==='lesson')state.progressFilters.skill=ALL;
   render({state,body});
 }));
 body.querySelectorAll('[data-progress-mode]').forEach(el=>el.addEventListener('click',()=>{
   state.progressMode=el.dataset.progressMode==='raw'?'raw':'rolling';
   render({state,body});
 }));
 body.querySelector('[data-progress-analysis]')?.addEventListener('toggle',e=>{
   if(isCurrent(state))state.progressAnalysisOpen=e.target.open;
 });
}
let currentState=null;
function isCurrent(state){return currentState===state}
function show({state,body}){
 currentState=state;
 render({state,body});
}
window.NaesinV2Progress={render:show,version:'r14.70-separate-mistake-analysis'};
})();
