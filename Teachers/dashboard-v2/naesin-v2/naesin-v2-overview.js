(function(){
'use strict';
const RPC='https://fiieuiktlsivwfgyivai.supabase.co/rest/v1/rpc/test_prep_teacher_activity_overview_v1';
const KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const kstDay=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const isoDate=(daysBack)=>{const d=new Date(kstDay()+'T12:00:00+09:00');d.setDate(d.getDate()-daysBack);return d.toISOString().slice(0,10)};
let period=7,rows=[],members=[],loading=false,lastLoaded=0,tab='overview',requestId=0;
function mount(){
 const shell=document.querySelector('#view-naesin-v2 .na2-shell');
 if(!shell||shell.querySelector('#na2Overview'))return;
 const tabs=document.createElement('div');tabs.className='na2-ov-tabs';tabs.innerHTML='<button type="button" data-ov-tab="overview" class="active">Overview</button><button type="button" data-ov-tab="exams">시험 현황</button>';
 shell.insertBefore(tabs,shell.firstChild);
 const box=document.createElement('section');box.id='na2Overview';box.className='na2-ov';
 box.innerHTML='<div class="na2-ov-top"><div><h2>일일 활동</h2><p>문제 풀이 수 · 정답률</p></div><div class="na2-ov-actions"><select id="na2OvPeriod" aria-label="기간"><option value="7" selected>7일</option><option value="30">30일</option><option value="60">60일</option><option value="90">90일</option></select><button id="na2OvRefresh" type="button">새로고침</button></div></div><div id="na2OvSummary" class="na2-ov-summary"></div><div id="na2OvChart" class="na2-ov-student-charts" aria-label="Student daily activity charts">데이터 불러오는 중…</div><div class="na2-ov-table-head"><strong>학생별 활동</strong><input type="search" id="na2OvSearch" placeholder="학생 검색" aria-label="학생 검색"></div><div id="na2OvTable" class="na2-ov-table-wrap"></div><p class="na2-ov-note">날짜는 한국 시간 기준 · 정답률은 정답 수 ÷ 시도 수 · 재시도 포함</p>';
 tabs.after(box);
 tabs.addEventListener('click',e=>{const b=e.target.closest('[data-ov-tab]');if(b)setTab(b.dataset.ovTab)});
 document.getElementById('na2OvPeriod').addEventListener('change',e=>{period=Number(e.target.value)||30;load(true)});
 document.getElementById('na2OvRefresh').addEventListener('click',()=>load(true));
 document.getElementById('na2OvSearch').addEventListener('input',render);
 setTab('overview');
 load();
}
function setTab(next){tab=next;
 document.querySelectorAll('.na2-ov-tabs button').forEach(b=>b.classList.toggle('active',b.dataset.ovTab===tab));
 const shell=document.querySelector('#view-naesin-v2 .na2-shell');if(!shell)return;
 Array.from(shell.children).forEach(el=>{if(el.classList.contains('na2-ov-tabs'))return;el.style.display=el.id==='na2Overview'?(tab==='overview'?'':'none'):(tab==='overview'?'none':'')});
 if(tab==='overview'&&Date.now()-lastLoaded>60000)load();
}
async function fetchData(){
 let token=window.WillenaAPI?.getLocalAccessToken?.()||localStorage.getItem('sb_access_token')||'';
 if(!token){const r=await window.WillenaAPI?.fetch?.('/.netlify/functions/supabase_auth?action=refresh');const j=await r?.json().catch(()=>({}));token=j?.access_token||'';if(token)window.WillenaAPI?.setLocalTokens?.(token,j.refresh_token||'')}
 if(!token)throw new Error('로그인이 필요합니다.');
 const run=t=>fetch(RPC,{method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+t,'Content-Type':'application/json'},body:JSON.stringify({p_days:Math.max(30,period)}),cache:'no-store'});
 let response=await run(token);
 if(response.status===401||response.status===403){const refresh=await (window.WillenaAPI?.fetch?window.WillenaAPI.fetch('/.netlify/functions/supabase_auth?action=refresh'):fetch('/.netlify/functions/supabase_auth?action=refresh',{credentials:'include'}));const j=await refresh.json().catch(()=>({}));if(j?.access_token){window.WillenaAPI?.setLocalTokens?.(j.access_token,j.refresh_token||'');response=await run(j.access_token)}}
 const value=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(value?.message||value?.error||'활동 데이터를 불러올 수 없습니다.');
 return value;
}
async function load(force=false){
 if(loading&&!force)return;
 const id=++requestId;loading=true;
 const chart=document.getElementById('na2OvChart');
 if(chart)chart.textContent='활동 데이터를 불러오는 중…';
 try{
  const [data,groups]=await Promise.all([fetchData(),window.NaesinV2Data?.loadGroups?.()||[]]);
  if(id!==requestId)return;
  rows=Array.isArray(data.rows)?data.rows:[];
  const byPlan=new Map();
  for(const group of groups)for(const m of group.members||[]){
    const plan=String(m.plan_id||'');if(!plan)continue;
    const st=m.student||{},g=group.group||{};
    const label=[g.school, g.term ? g.term+'학기' : '',g.exam_type==='final'?'기말고사':g.exam_type==='midterm'?'중간고사':'',g.book_label||g.book_key].filter(Boolean).join(' · ')||'시험';
    const current=byPlan.get(plan)||{plan,studentId:String(m.student_id||st.id||''),name:st.english_name||st.korean_name||st.name||st.username||m.english_name||m.korean_name||'Student',tests:[]};
    if(!current.tests.includes(label))current.tests.push(label);
    byPlan.set(plan,current);
  }
  members=[...byPlan.values()];lastLoaded=Date.now();render();
 }catch(err){if(id===requestId&&chart)chart.innerHTML='<div class="na2-ov-error">'+esc(err.message)+'</div>';console.warn('[Naesin Overview]',err)}
 finally{if(id===requestId)loading=false}
}
function collect(list,start){let questions=0,correct=0,active=new Set();for(const r of list){if(r.date<start)continue;questions+=Number(r.questions)||0;correct+=Number(r.correct)||0;if(Number(r.questions)>0)active.add(r.student_id)}return {questions,correct,active:active.size,accuracy:questions?Math.round(100*correct/questions)+'%':'—'}}
function statsFor(plan,days){return collect(rows.filter(r=>String(r.plan_id)===plan),isoDate(days-1))}
function studentChart(m,planRows){
 const byDay=new Map();
 for(const r of planRows){const key=String(r.date);const prev=byDay.get(key)||{questions:0,correct:0};prev.questions+=Number(r.questions)||0;prev.correct+=Number(r.correct)||0;byDay.set(key,prev)}
 const daily=[];for(let i=period-1;i>=0;i--){const date=isoDate(i);daily.push({date,...(byDay.get(date)||{questions:0,correct:0})})}
 const max=Math.max(5,...daily.map(d=>d.questions)),ceiling=Math.ceil(max/5)*5;
 const width=760,height=176,left=42,right=12,top=12,bottom=32,cw=width-left-right,ch=height-top-bottom;
 const xy=(v,i)=>({x:left+i*cw/Math.max(1,period-1),y:top+ch-v/ceiling*ch});
 let svg='<svg viewBox="0 0 760 176" role="img" aria-label="'+esc(m.name)+' 일일 문제 풀이 수">';
 for(let i=0;i<=4;i++){const y=top+i*ch/4;svg+='<line x1="'+left+'" x2="'+(width-right)+'" y1="'+y+'" y2="'+y+'" stroke="#e3eef0"/><text x="'+(left-7)+'" y="'+(y+4)+'" text-anchor="end" font-size="10" fill="#789099">'+Math.round(ceiling*(4-i)/4)+'</text>'}
 svg+='<polyline points="'+daily.map((d,i)=>{const p=xy(d.questions,i);return p.x+','+p.y}).join(' ')+'" fill="none" stroke="#57cba4" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>';
 daily.forEach((d,i)=>{const p=xy(d.questions,i);svg+='<circle cx="'+p.x+'" cy="'+p.y+'" r="'+(period<=30?4:2.5)+'" fill="#71369b" stroke="white" stroke-width="1"><title>'+d.date+' · '+d.questions+'문제 · '+(d.questions?Math.round(100*d.correct/d.questions)+'%':'—')+' 정답률</title></circle>';if(i===0||i===period-1||(period<=7||i%(period<=30?5:period<=60?10:15)===0))svg+='<text x="'+p.x+'" y="'+(height-9)+'" text-anchor="middle" font-size="10" fill="#71878c">'+d.date.slice(5)+'</text>'});
 return svg+'</svg>';
}
function render(){
 const box=document.getElementById('na2OvChart');if(!box)return;
 const needle=(document.getElementById('na2OvSearch')?.value||'').trim().toLowerCase();
 const visible=members.filter(m=>m.name.toLowerCase().includes(needle)).sort((a,b)=>a.name.localeCompare(b.name));
 const permitted=new Set(visible.map(m=>m.plan)),valid=rows.filter(r=>permitted.has(String(r.plan_id)));
 const overall=collect(valid,isoDate(period-1));
 document.getElementById('na2OvSummary').innerHTML=[['문제 수',overall.questions.toLocaleString()],['정답률',overall.accuracy],['활동 학생',overall.active+'명']].map(([name,val])=>'<div><span>'+name+'</span><strong>'+val+'</strong></div>').join('');
 const byPlan=new Map();for(const r of valid){const key=String(r.plan_id);if(!byPlan.has(key))byPlan.set(key,[]);byPlan.get(key).push(r)}
 box.innerHTML=visible.length?visible.map(m=>{const planRows=byPlan.get(m.plan)||[],st=collect(planRows,isoDate(period-1));return '<article class="na2-ov-student-card"><div class="na2-ov-student-head"><strong>'+esc(m.name)+'</strong><span>'+st.questions.toLocaleString()+'문제 · '+st.accuracy+' 정답률</span></div><div class="na2-ov-student-graph">'+studentChart(m,planRows)+'</div><div class="na2-ov-test-labels">'+(m.tests||[]).map((test,i)=>'<span><b>'+String.fromCharCode(65+i)+'.</b> '+esc(test)+'</span>').join('')+'</div></article>'}).join(''):'<div class="na2-ov-error">표시할 학생이 없습니다.</div>';
 document.getElementById('na2OvTable').innerHTML='<table><thead><tr><th>학생</th><th>오늘 문제</th><th>정답률</th><th>7일 문제</th><th>정답률</th><th>30일 문제</th><th>정답률</th></tr></thead><tbody>'+visible.map(m=>{const t=statsFor(m.plan,1),w=statsFor(m.plan,7),mo=statsFor(m.plan,30);return '<tr><td>'+esc(m.name)+'</td><td>'+t.questions+'</td><td>'+t.accuracy+'</td><td>'+w.questions+'</td><td>'+w.accuracy+'</td><td>'+mo.questions+'</td><td>'+mo.accuracy+'</td></tr>'}).join('')+'</tbody></table>';
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
window.NaesinV2Overview={refresh:()=>load(true),show:()=>setTab('overview')};
})();
