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
function buildTimeline(events,daily,windowSize){
 const groups=new Map();
 for(const e of events){
   const id=daily?dayKey(e.time):e.sessionId;
   if(!id)continue;
   const group=groups.get(id)||{key:id,date:dayKey(e.time),timestamp:new Date(e.time).getTime(),events:[]};
   group.events.push(e);
   if(new Date(e.time).getTime()>group.timestamp)group.timestamp=new Date(e.time).getTime();
   groups.set(id,group);
 }
 const ordered=[...groups.values()].sort((a,b)=>a.timestamp-b.timestamp||a.key.localeCompare(b.key));
 let window=[],rowIndex=0;
 return ordered.map(group=>{
   let groupTotal=0,groupCorrect=0,retries=0;
   for(const e of group.events){
     if(e.type==='first'){
       window.push(e.original);groupTotal++;
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
   return {
     key:group.key,date:group.date,time:group.timestamp,index:++rowIndex,
     correct:groupCorrect,total:groupTotal,retries,
     first:pct(firstCorrect,total),after:pct(firstCorrect+fixed,total),
     windowCorrect:firstCorrect,windowTotal:total,fixed,retriedWrong,notRetried,
     raw:pct(groupCorrect,groupTotal)
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
function chartMarkup(points,{rolling,showRetries,windowSize,daily}){
 if(!points.length)return '<div class="na2-detail-empty">그래프에 표시할 기록이 없습니다.</div>';
 const W=750,left=50,right=22,top=22,bottom=178,height=bottom-top;
 const locate=(i)=>left+(points.length===1?(W-left-right)/2:i*(W-left-right)/(points.length-1));
 const xy=(val,i)=>locate(i).toFixed(1)+','+(bottom-num(val)*height/100).toFixed(1);
 const segments=field=>{
   let segments=[],ongoing=[];
   points.forEach((p,i)=>{
     if(p[field]==null){if(ongoing.length)segments.push(ongoing);ongoing=[]}
     else ongoing.push(xy(p[field],i));
   });
   if(ongoing.length)segments.push(ongoing);
   return segments.map(arr=>'<polyline fill="none" stroke="'+(field==='after'?'#de6999':'#13a4ac')+'" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="'+arr.join(' ')+'"/>').join('');
 };
 const dots=(field,color,open=false)=>points.length>75?'':points.map((p,i)=>{
   if(p[field]==null)return '';
   const y=bottom-num(p[field])*height/100;
   const radius=open?Math.min(7,2.5+Math.sqrt(p.total)*.58):3.7;
   const label=(daily?p.date:p.label)+': '+(field==='after'?'수정 후 ':field==='first'?'최초 ':field==='raw'?'해당 회차 ':'')+showPct(p[field]);
   return '<circle cx="'+locate(i).toFixed(1)+'" cy="'+y.toFixed(1)+'" r="'+radius.toFixed(1)+'" fill="'+(open?'#fff':color)+'" stroke="'+(open?color:'none')+'" stroke-width="1.7"><title>'+esc(label)+'</title></circle>';
 }).join('');
 const first=points[0],last=points[points.length-1];
 const label1=daily?first.date.slice(5):'1회',label2=daily?last.date.slice(5):points.length+'회';
 const labels=points.length>1?'<text x="'+left+'" y="208" text-anchor="start">'+esc(label1)+'</text><text x="'+(W-right)+'" y="208" text-anchor="end">'+esc(label2)+'</text>':'';
 const rawDots=rolling?dots('raw','#92a6ab',true):'';
 return '<svg viewBox="0 0 750 220" role="img" aria-label="'+esc(rolling?'이동 평균 정확도와 오답 수정 그래프':'날짜별 정확도와 오답 수정 그래프')+'" style="width:100%;height:auto;display:block">'+
  '<g font-size="12" fill="#677"><text x="7" y="27">100%</text><text x="15" y="104">50%</text><text x="24" y="182">0%</text>'+labels+'</g>'+
  '<path d="M '+left+' '+top+' V '+bottom+' H '+(W-right)+'" stroke="#b9cbd0" fill="none"/>'+
  '<line x1="'+left+'" x2="'+(W-right)+'" y1="'+((top+bottom)/2)+'" y2="'+((top+bottom)/2)+'" stroke="#e8eff0" stroke-dasharray="3 5"/>'+
  rawDots+segments('first')+dots('first','#13a4ac')+
  (showRetries?segments('after')+dots('after','#de6999'):'')+'</svg>';
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
 const showRetries=state.progressShowRetries!==false;
 const rawSeries=originalSeries(items,daily);
 const {events,unmatched}=answerEvents(state.progressAttemptHistory,book,lesson,skill);
 const rollingSeries=buildTimeline(events,daily,windowSize);
 const lastRolling=rollingSeries[rollingSeries.length-1]||null;
 const byKey=new Map(rollingSeries.map(r=>[r.key,r]));
 const points=rolling?rollingSeries.map(row=>({
   ...row,label:daily?row.date:dateLabel(row.time),
   // Correct/total of each period for size-weighted grey markers.
   raw:row.raw
 })):rawSeries.map(row=>{
   const event=byKey.get(row.key);
   return{...row,first:pct(row.correct,row.total),
     after:event&&row.total?Math.max(pct(row.correct,row.total)||0,pct(row.correct+Math.min(row.total-row.correct,event.fixed||0),row.total)):null,
     raw:pct(row.correct,row.total)};
 });
 const option=(value,label,active)=>'<option value="'+esc(value)+'"'+(value===active?' selected':'')+'>'+esc(label)+'</option>';
 const select=(key,values,active,formatter)=>'<select data-progress-filter="'+key+'" style="width:100%;min-width:0;padding:10px;border:1px solid #d0e2e7;border-radius:9px;background:var(--surface,#fff);color:inherit">'+values.map(v=>option(v,formatter(v),active)).join('')+'</select>';
 const filters='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:12px;margin-bottom:14px">'+
   '<label>레슨'+select('lesson',[ALL,...lessons],lesson,v=>v===ALL?'전체 레슨':v)+'</label>'+
   '<label>영역'+select('skill',[ALL,...skills],skill,v=>v===ALL?'전체 영역':SKILL_NAMES[v]||v)+'</label></div>';
 const modes='<div class="na2-progress-modes" role="group" aria-label="정확도 표시 방식">'+
  '<button type="button" data-progress-mode="rolling" class="'+(rolling?'active':'')+'" aria-pressed="'+rolling+'">최근 '+windowSize+'문항 이동 평균</button>'+
  '<button type="button" data-progress-mode="raw" class="'+(!rolling?'active':'')+'" aria-pressed="'+(!rolling)+'">기존 정확도</button>'+
  '<label class="na2-progress-retry-toggle"><input type="checkbox" data-progress-retries '+(showRetries?'checked':'')+'> 오답 수정 표시</label></div>';
 const itemCorrect=items.reduce((sum,r)=>sum+num(r.correct),0);
 const itemTotal=items.reduce((sum,r)=>sum+num(r.total),0);
 const cards=rolling?
   card(showPct(lastRolling?.first),'최초 정답률',lastRolling?lastRolling.windowCorrect+' / '+lastRolling.windowTotal:'기록 없음')+
   (showRetries?card(showPct(lastRolling?.after),'수정 후 정답률',lastRolling?(lastRolling.windowCorrect+lastRolling.fixed)+' / '+lastRolling.windowTotal:'기록 없음'):'')
   :daily?card(showPct(pct(itemCorrect,itemTotal)),'선택 범위 정확도',itemCorrect+' / '+itemTotal)+card(items.length,'완료한 연습','')
   :card(showPct(pct(items[0]?.correct,items[0]?.total)),'첫 회차',items[0]?items[0].correct+' / '+items[0].total:'')+card(showPct(pct(items[items.length-1]?.correct,items[items.length-1]?.total)),'최근 회차',items.length?items[items.length-1].correct+' / '+items[items.length-1].total:'');
 let correction='';
 if(showRetries){
   const fixed=lastRolling?.fixed||0,still=lastRolling?.retriedWrong||0,missing=lastRolling?.notRetried||0;
   const wrong=fixed+still+missing;
   correction='<div class="na2-progress-correction">'+card(wrong?showPct(pct(fixed,wrong)):'—','오답 수정률',fixed+' / '+wrong+'개 수정')+
     '<p>수정 완료 <strong>'+fixed+'</strong> · 재시도했지만 오답 <strong>'+still+'</strong> · 아직 재시도 안 함 <strong>'+missing+'</strong></p></div>';
 }
 const displayed=rolling?rollingSeries:rawSeries;
 const heads=(daily?['날짜','정답','정답률','연습 횟수','재시도']:['일시','정답','정답률','재시도']);
 if(rolling){heads.splice(3,0,'최근 '+windowSize+'문항');if(showRetries)heads.splice(4,0,'수정 후');}
 const dataRows=displayed.map((row,i)=>{
   const base=rolling?row:rawSeries[i];
   const cell=(v)=>'<td>'+esc(v)+'</td>';
   const cols=[daily?base.date:(rolling?dateLabel(base.time):base.label),
      base.correct+' / '+base.total,showPct(pct(base.correct,base.total))];
   if(rolling){cols.push(showPct(row.first)+' ('+row.windowTotal+'/'+windowSize+')');if(showRetries)cols.push(showPct(row.after));}
   if(daily)cols.push(String(rolling?'—':base.sessions));
   cols.push(String(base.retries));
   return '<tr style="border-top:1px solid #e0ebee">'+cols.map((v,j)=>'<td style="'+(j===0?'padding:9px 5px;':'')+'">'+esc(v)+'</td>').join('')+'</tr>';
 }).join('');
 const title=rolling?'최근 '+windowSize+'문항 이동 평균':daily?'일별 정확도':'회차별 정확도';
 const note=rolling?'청록: 최초 정답률 · 분홍: 수정 후 정답률 · 회색 점: 해당 날짜의 실제 정답률. ': '청록: 기존 정답률 · 분홍: 해당 기간 내 확인된 수정 후 정확도. ';
 const caption=note+(rolling?'문항 수가 '+windowSize+'개 미만이면 실제 풀이 수로 계산. ':'')+'재시도는 새로운 질문으로 계산하지 않습니다.';
 body.innerHTML=filters+modes+
 (displayed.length?'<div class="na2-kpi-grid">'+cards+'</div>'+correction+
 '<section class="na2-detail-section"><div class="na2-section-head"><h3>'+title+'</h3><span>최초 응답 기준 · '+items.length+'회</span></div>'+
 chartMarkup(points,{rolling,showRetries,windowSize,daily})+
 '<p class="na2-progress-chart-note">'+esc(caption)+(unmatched?' · 연결되지 않은 과거 재시도 '+unmatched+'개 제외':'')+'</p>'+
 '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;text-align:left;font-size:13px"><thead><tr>'+heads.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+dataRows+'</tbody></table></div></section>'
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
 body.querySelector('[data-progress-retries]')?.addEventListener('change',e=>{
   state.progressShowRetries=e.target.checked;
   render({state,body});
 });
}
let currentState=null;
function isCurrent(state){return currentState===state}
function show({state,body}){
 currentState=state;
 render({state,body});
}
window.NaesinV2Progress={render:show,version:'r14.69-retry-graph'};
})();
