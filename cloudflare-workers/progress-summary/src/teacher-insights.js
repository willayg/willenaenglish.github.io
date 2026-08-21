const DAY_MS = 24 * 60 * 60 * 1000;
const SEOUL_DATE = new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Seoul', year:'numeric', month:'2-digit', day:'2-digit' });

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
function pct(correct, total) { return total ? Math.round((correct / total) * 100) : null; }
function daysAgoIso(days) { return new Date(Date.now() - days * DAY_MS).toISOString(); }
function dateKey(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return SEOUL_DATE.format(d);
}
function keyMs(key) {
  if (!key) return NaN;
  const [y,m,d]=key.split('-').map(Number);
  return Date.UTC(y,m-1,d);
}
function dayDiff(newerKey, olderKey) {
  const a=keyMs(newerKey),b=keyMs(olderKey);
  return Number.isFinite(a)&&Number.isFinite(b)?Math.round((a-b)/DAY_MS):null;
}
function todayKey(){ return dateKey(new Date()); }
function valueText(value) {
  if (value == null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  try { return JSON.stringify(value); } catch { return String(value); }
}

function normalizedSkill(a) {
  const raw = String(a?.skill || a?.response_type || 'practice').trim().toLowerCase();
  if (!raw) return 'practice';
  if (/spell/.test(raw)) return 'spelling';
  if (/listen|audio/.test(raw)) return 'listening';
  if (/grammar/.test(raw)) return 'grammar';
  if (/sentence.?build|token.?order/.test(raw)) return 'sentence_building';
  if (/vocab|meaning/.test(raw)) return 'vocabulary';
  if (/read|comprehension/.test(raw)) return 'reading';
  if (/conversation|response/.test(raw)) return 'conversation';
  if (/speak|pronun/.test(raw)) return 'speaking';
  if (/writ/.test(raw)) return 'writing';
  return raw.replace(/[^a-z0-9]+/g,'_');
}

function currentStreak(dateKeys) {
  const keys=[...new Set(dateKeys)].sort().reverse();
  if(!keys.length)return 0;
  const gap=dayDiff(todayKey(),keys[0]);
  if(gap==null||gap>1)return 0;
  let streak=1,cur=keys[0];
  for(let i=1;i<keys.length;i++){
    if(dayDiff(cur,keys[i])!==1)break;
    streak++;cur=keys[i];
  }
  return streak;
}

function median(values) {
  const v=values.filter(Number.isFinite).sort((a,b)=>a-b);
  if(!v.length)return null;
  const m=Math.floor(v.length/2);
  return v.length%2?v[m]:Math.round((v[m-1]+v[m])/2);
}

function habitRating(attempts) {
  const dates=[...new Set(attempts.map(a=>dateKey(a.created_at)).filter(Boolean))].sort().reverse();
  const today=todayKey();
  const active7=dates.filter(k=>{const d=dayDiff(today,k);return d!=null&&d>=0&&d<=6;}).length;
  const activePeriod=dates.length;
  const streak=currentStreak(dates);
  const lastDate=dates[0]||null;
  const daysSince=lastDate?Math.max(0,dayDiff(today,lastDate)):null;

  const consistency=clamp(active7/5,0,1)*45;
  const breadth=clamp(activePeriod/18,0,1)*20;
  const streakPts=clamp(streak/5,0,1)*15;
  const recency=daysSince==null?0:daysSince===0?20:daysSince===1?18:daysSince===2?14:daysSince===3?9:daysSince===4?4:0;
  const score=Math.round(consistency+breadth+streakPts+recency);
  let label='Not enough data';
  if(attempts.length)label=score>=80?'Excellent':score>=60?'Good':score>=35?'Developing':'Needs attention';

  const dailyCounts={};
  attempts.forEach(a=>{const k=dateKey(a.created_at);if(k)dailyCounts[k]=(dailyCounts[k]||0)+1;});
  const dayCounts=Object.values(dailyCounts),maxDay=dayCounts.length?Math.max(...dayCounts):0;
  const spreadScore=attempts.length?clamp(Math.round((1-maxDay/attempts.length)*100),0,100):0;
  const sessions=new Set(attempts.map(a=>a.session_id).filter(Boolean)).size;
  const responseTimes=attempts.map(a=>Number(a.response_time_ms)).filter(v=>Number.isFinite(v)&&v>0&&v<300000);
  const hints=attempts.reduce((n,a)=>n+(Number(a.hints_used)||0),0);
  const retries=attempts.reduce((n,a)=>n+(Number(a.retry_count)||0),0);

  return {
    label,score,
    active_days_7:active7,
    active_days_period:activePeriod,
    active_days_30:activePeriod,
    current_streak:streak,
    days_since_last_study:daysSince,
    attempts:attempts.length,
    study_sessions:sessions,
    completed_sessions:sessions,
    spread_score:spreadScore,
    last_active_date:lastDate,
    median_response_time_ms:median(responseTimes),
    hints_used:hints,
    retries,
  };
}

function learningRating(attempts) {
  const total=attempts.length,correct=attempts.filter(a=>a.is_correct).length,overall=pct(correct,total);
  const bySkill=new Map();
  attempts.forEach(a=>{
    const skill=normalizedSkill(a);
    const cur=bySkill.get(skill)||{skill,attempts:0,correct:0,recent:[],previous:[]};
    cur.attempts++;if(a.is_correct)cur.correct++;
    const age=Date.now()-new Date(a.created_at).getTime();
    if(age<=14*DAY_MS)cur.recent.push(a);else if(age<=28*DAY_MS)cur.previous.push(a);
    bySkill.set(skill,cur);
  });
  const skills=[...bySkill.values()].map(s=>{
    const accuracy=pct(s.correct,s.attempts);
    const recentAccuracy=pct(s.recent.filter(a=>a.is_correct).length,s.recent.length);
    const previousAccuracy=pct(s.previous.filter(a=>a.is_correct).length,s.previous.length);
    const trend=recentAccuracy==null||previousAccuracy==null?null:recentAccuracy-previousAccuracy;
    const label=s.attempts<3?'Limited evidence':accuracy>=85?'Strong':accuracy>=75?'Secure':accuracy>=60?'Building':'Needs attention';
    return {skill:s.skill,attempts:s.attempts,correct:s.correct,accuracy,label,recent_accuracy:recentAccuracy,previous_accuracy:previousAccuracy,trend};
  }).sort((a,b)=>(a.accuracy??101)-(b.accuracy??101));
  const priorityWeaknesses=skills.filter(s=>s.attempts>=4&&s.accuracy!=null&&s.accuracy<60);
  let label='Not enough data';
  if(total>=5){
    if(priorityWeaknesses.length)label='Needs attention';
    else if(overall>=85)label='Strong';
    else if(overall>=70)label='Building';
    else label='Needs attention';
  }
  const recent=attempts.filter(a=>Date.now()-new Date(a.created_at).getTime()<=14*DAY_MS);
  const previous=attempts.filter(a=>{const age=Date.now()-new Date(a.created_at).getTime();return age>14*DAY_MS&&age<=28*DAY_MS;});
  const recentAccuracy=pct(recent.filter(a=>a.is_correct).length,recent.length);
  const previousAccuracy=pct(previous.filter(a=>a.is_correct).length,previous.length);
  return {label,accuracy:overall,attempts:total,correct,skills,priority_weaknesses:priorityWeaknesses,recent_accuracy:recentAccuracy,previous_accuracy:previousAccuracy,trend:recentAccuracy==null||previousAccuracy==null?null:recentAccuracy-previousAccuracy};
}

function dailyProof(attempts) {
  const map=new Map();
  attempts.forEach(a=>{
    const k=dateKey(a.created_at);if(!k)return;
    if(!map.has(k))map.set(k,{date:k,attempts:0,correct:0,session_ids:new Set()});
    const d=map.get(k);d.attempts++;if(a.is_correct)d.correct++;if(a.session_id)d.session_ids.add(a.session_id);
  });
  return [...map.values()].map(d=>({date:d.date,attempts:d.attempts,correct:d.correct,accuracy:pct(d.correct,d.attempts),sessions:d.session_ids.size})).sort((a,b)=>b.date.localeCompare(a.date));
}

function mistakeEvidence(a) {
  const stimulus=a.stimulus_snapshot&&typeof a.stimulus_snapshot==='object'?a.stimulus_snapshot:{};
  const meta=a.metadata&&typeof a.metadata==='object'?a.metadata:{};
  return {
    created_at:a.created_at,
    skill:normalizedSkill(a),
    response_type:a.response_type||null,
    prompt:valueText(stimulus.prompt??stimulus.question??stimulus.text??stimulus.word??a.activity_id),
    student_answer:valueText(a.student_answer),
    correct_answer:valueText(a.correct_answer),
    book_id:a.book_id||null,
    unit_id:a.unit_id||null,
    activity_id:a.activity_id||null,
    study_context:a.study_context||null,
    daily_role:meta.daily_role||null,
  };
}

async function fetchPaged(select,env,table,queryBase,pageSize=1000,maxPages=30){
  const out=[];
  for(let page=0;page<maxPages;page++){
    const rows=await select(env,table,`${queryBase}&limit=${pageSize}&offset=${page*pageSize}`);
    if(!Array.isArray(rows)||!rows.length)break;
    out.push(...rows);if(rows.length<pageSize)break;
  }
  return out;
}

async function requireTeacher(env,userId,select){
  const rows=await select(env,'profiles',`id=eq.${encodeURIComponent(userId)}&select=id,role,approved,name,username`);
  const p=rows&&rows[0];
  if(!p||!['teacher','admin'].includes(String(p.role||'').toLowerCase())||p.approved===false)return null;
  return p;
}

async function studentRows(env,select,className){
  let q='role=eq.student&approved=eq.true&select=id,name,username,korean_name,class';
  if(className)q+=`&class=eq.${encodeURIComponent(className)}`;
  const rows=await select(env,'profiles',q);
  return(rows||[]).filter(p=>!p.username||String(p.username).length>1);
}

async function fetchAttempts(env,select,userIds,days){
  if(!userIds.length)return[];
  const since=daysAgoIso(days),out=[];
  for(let i=0;i<userIds.length;i+=60){
    const ids=userIds.slice(i,i+60).join(',');
    const q=`student_id=in.(${ids})&created_at=gte.${encodeURIComponent(since)}&select=student_id,session_id,book_id,unit_id,skill,response_type,activity_id,stimulus_snapshot,student_answer,correct_answer,is_correct,response_time_ms,hints_used,retry_count,metadata,study_context,created_at&order=created_at.desc`;
    out.push(...await fetchPaged(select,env,'study_attempts',q));
  }
  return out;
}

function studentInsight(profile,attempts,includeDetail=false){
  const habits=habitRating(attempts),learning=learningRating(attempts),proof=dailyProof(attempts);
  const wrong=attempts.filter(a=>!a.is_correct).slice(0,includeDetail?24:6).map(mistakeEvidence);
  return {
    user_id:profile.id,name:profile.name||profile.username||'Student',korean_name:profile.korean_name||null,class:profile.class||null,
    habits,learning,
    attention:learning.label==='Needs attention'?'learning':habits.label==='Needs attention'?'habits':habits.label==='Developing'?'habits_watch':null,
    last_activity:attempts[0]?.created_at||null,
    recent_mistakes:wrong,
    ...(includeDetail?{proof,recent_attempts:attempts.slice(0,30).map(a=>({created_at:a.created_at,skill:normalizedSkill(a),response_type:a.response_type,is_correct:!!a.is_correct,response_time_ms:a.response_time_ms,study_context:a.study_context,book_id:a.book_id,unit_id:a.unit_id}))}:{}),
  };
}

export async function handleTeacherInsights({request,env,userId,section,origin,jsonResponse,supabaseSelect}){
  if(!section.startsWith('teacher_'))return null;
  const teacher=await requireTeacher(env,userId,supabaseSelect);
  if(!teacher)return jsonResponse({success:false,error:'Teacher or admin access required'},403,origin,0);
  const url=new URL(request.url),days=clamp(Number(url.searchParams.get('days')||30)||30,7,90);

  if(section==='teacher_classes'){
    const rows=await studentRows(env,supabaseSelect,null),map=new Map();
    rows.forEach(s=>{if(s.class)map.set(s.class,(map.get(s.class)||0)+1);});
    const classes=[...map.entries()].map(([name,student_count])=>({name,student_count})).sort((a,b)=>a.name.localeCompare(b.name));
    return jsonResponse({success:true,classes},200,origin,30);
  }

  if(section==='teacher_class_insights'){
    const className=String(url.searchParams.get('class')||'').trim();
    if(!className)return jsonResponse({success:false,error:'Missing class'},400,origin,0);
    const profiles=await studentRows(env,supabaseSelect,className),ids=profiles.map(p=>p.id),attempts=await fetchAttempts(env,supabaseSelect,ids,days);
    const byStudent=new Map();attempts.forEach(a=>{if(!byStudent.has(a.student_id))byStudent.set(a.student_id,[]);byStudent.get(a.student_id).push(a);});
    const students=profiles.map(p=>studentInsight(p,byStudent.get(p.id)||[],false));
    const total=attempts.length,correct=attempts.filter(a=>a.is_correct).length;
    return jsonResponse({success:true,class:className,days,summary:{students:students.length,active_students:students.filter(s=>s.habits.active_days_period>0).length,needs_learning_attention:students.filter(s=>s.learning.label==='Needs attention').length,needs_habit_attention:students.filter(s=>s.habits.label==='Needs attention').length,attempts:total,accuracy:pct(correct,total)},students},200,origin,20);
  }

  if(section==='teacher_student_insights'){
    const studentId=String(url.searchParams.get('student_id')||'').trim();
    if(!studentId)return jsonResponse({success:false,error:'Missing student_id'},400,origin,0);
    const rows=await supabaseSelect(env,'profiles',`id=eq.${encodeURIComponent(studentId)}&role=eq.student&select=id,name,username,korean_name,class`),profile=rows&&rows[0];
    if(!profile)return jsonResponse({success:false,error:'Student not found'},404,origin,0);
    const attempts=await fetchAttempts(env,supabaseSelect,[studentId],days);
    return jsonResponse({success:true,days,student:studentInsight(profile,attempts,true)},200,origin,10);
  }

  return jsonResponse({success:false,error:'Unknown teacher insights section'},400,origin,0);
}
