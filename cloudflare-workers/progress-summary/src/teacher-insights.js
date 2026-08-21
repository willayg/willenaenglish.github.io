const DAY_MS = 24 * 60 * 60 * 1000;

function safeObj(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try { return JSON.parse(value) || {}; } catch { return {}; }
}

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
function pct(correct, total) { return total ? Math.round((correct / total) * 100) : null; }
function localDateKey(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function startOfDay(d = new Date()) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function daysAgoIso(days) { return new Date(Date.now() - days * DAY_MS).toISOString(); }

function attemptExtra(a) { return safeObj(a && a.extra); }
function nested(obj, path) {
  let cur = obj;
  for (const k of path) { if (!cur || typeof cur !== 'object') return null; cur = cur[k]; }
  return cur == null ? null : cur;
}

function normalizedSkill(a) {
  const ex = attemptExtra(a);
  const candidates = [
    ex.skill, ex.response_type, ex.content_type,
    nested(ex, ['metadata','skill']), nested(ex, ['metadata','response_type']),
    nested(ex, ['payload','skill']), nested(ex, ['payload','response_type']),
    a && a.mode
  ].filter(Boolean).map(v => String(v).toLowerCase());
  const text = candidates.join(' ');
  if (/spell|dictat|typing|type_word|word_build/.test(text)) return 'spelling';
  if (/listen|audio|hearing/.test(text)) return 'listening';
  if (/grammar|pattern|sentence|syntax|fill.?blank|reorder/.test(text)) return 'grammar';
  if (/read|comprehension|passage/.test(text)) return 'reading';
  if (/vocab|meaning|word|picture|choice|matching/.test(text)) return 'vocabulary';
  if (/speak|pronun|speech/.test(text)) return 'speaking';
  if (/writ/.test(text)) return 'writing';
  return candidates[0] ? candidates[0].replace(/[^a-z0-9]+/g, '_') : 'practice';
}

function evidenceText(a) {
  const ex = attemptExtra(a);
  const stimulus = ex.stimulus_snapshot || nested(ex, ['payload','stimulus_snapshot']) || {};
  const prompt = stimulus.prompt || stimulus.text || stimulus.question || ex.prompt || ex.question || a.word || null;
  const answer = a.answer ?? ex.student_answer ?? nested(ex, ['payload','student_answer']) ?? null;
  const correct = a.correct_answer ?? ex.correct_answer ?? nested(ex, ['payload','correct_answer']) ?? null;
  const metadata = ex.metadata || nested(ex, ['payload','metadata']) || {};
  return {
    prompt: prompt == null ? null : String(prompt),
    student_answer: answer == null ? null : String(answer),
    correct_answer: correct == null ? null : String(correct),
    book_id: metadata.book_id || ex.book_id || nested(ex, ['payload','book_id']) || null,
    unit_id: metadata.unit_id || ex.unit_id || nested(ex, ['payload','unit_id']) || null,
    response_type: ex.response_type || nested(ex, ['payload','response_type']) || null,
  };
}

function currentStreak(dateKeys) {
  if (!dateKeys.length) return 0;
  const keys = [...new Set(dateKeys)].sort().reverse();
  const parse = s => { const [y,m,d] = s.split('-').map(Number); return new Date(y,m-1,d); };
  const today = startOfDay();
  let cur = parse(keys[0]);
  const gap = Math.round((today - cur) / DAY_MS);
  if (gap > 1) return 0;
  let streak = 1;
  for (let i = 1; i < keys.length; i++) {
    const next = parse(keys[i]);
    if (Math.round((cur - next) / DAY_MS) !== 1) break;
    streak += 1; cur = next;
  }
  return streak;
}

function habitRating(attempts, sessions) {
  const dates30 = [...new Set([
    ...attempts.map(a => localDateKey(a.created_at)),
    ...sessions.map(s => localDateKey(s.ended_at || s.started_at))
  ].filter(Boolean))].sort().reverse();
  const cutoff7 = Date.now() - 7 * DAY_MS;
  const active7 = dates30.filter(k => { const [y,m,d]=k.split('-').map(Number); return new Date(y,m-1,d).getTime() >= cutoff7; }).length;
  const active30 = dates30.length;
  const streak = currentStreak(dates30);
  const lastDate = dates30[0] || null;
  let daysSince = null;
  if (lastDate) { const [y,m,d]=lastDate.split('-').map(Number); daysSince = Math.max(0, Math.floor((startOfDay() - new Date(y,m-1,d)) / DAY_MS)); }
  const consistency = clamp(active7 / 5, 0, 1) * 45;
  const breadth = clamp(active30 / 18, 0, 1) * 20;
  const streakPts = clamp(streak / 5, 0, 1) * 15;
  const recency = daysSince == null ? 0 : daysSince === 0 ? 20 : daysSince === 1 ? 18 : daysSince === 2 ? 14 : daysSince === 3 ? 9 : daysSince === 4 ? 4 : 0;
  const score = Math.round(consistency + breadth + streakPts + recency);
  let label = 'Not enough data';
  if (attempts.length || sessions.length) label = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 35 ? 'Developing' : 'Needs attention';
  const dailyCounts = {};
  attempts.forEach(a => { const k=localDateKey(a.created_at); if(k) dailyCounts[k]=(dailyCounts[k]||0)+1; });
  const counts = Object.values(dailyCounts);
  const maxDay = counts.length ? Math.max(...counts) : 0;
  const spread = attempts.length ? Math.round((1 - (maxDay / attempts.length)) * 100) : 0;
  return { label, score, active_days_7:active7, active_days_30:active30, current_streak:streak, days_since_last_study:daysSince, attempts:attempts.length, completed_sessions:sessions.length, spread_score:clamp(spread,0,100), last_active_date:lastDate };
}

function learningRating(attempts) {
  const total = attempts.length, correct = attempts.filter(a => a.is_correct).length;
  const overall = pct(correct,total);
  const bySkill = new Map();
  attempts.forEach(a => {
    const skill = normalizedSkill(a);
    const cur = bySkill.get(skill) || { skill, attempts:0, correct:0, recent:[], previous:[] };
    cur.attempts += 1; if (a.is_correct) cur.correct += 1;
    const age = Date.now() - new Date(a.created_at).getTime();
    if (age <= 14*DAY_MS) cur.recent.push(a); else if (age <= 28*DAY_MS) cur.previous.push(a);
    bySkill.set(skill,cur);
  });
  const skills = [...bySkill.values()].map(s => {
    const accuracy = pct(s.correct,s.attempts);
    const recentAcc = pct(s.recent.filter(a=>a.is_correct).length,s.recent.length);
    const prevAcc = pct(s.previous.filter(a=>a.is_correct).length,s.previous.length);
    const trend = recentAcc == null || prevAcc == null ? null : recentAcc - prevAcc;
    const label = s.attempts < 3 ? 'Limited evidence' : accuracy >= 85 ? 'Strong' : accuracy >= 75 ? 'Secure' : accuracy >= 60 ? 'Building' : 'Needs attention';
    return { skill:s.skill, attempts:s.attempts, correct:s.correct, accuracy, label, recent_accuracy:recentAcc, previous_accuracy:prevAcc, trend };
  }).sort((a,b)=>(a.accuracy ?? 101)-(b.accuracy ?? 101));
  const priorityWeaknesses = skills.filter(s => s.attempts >= 4 && s.accuracy != null && s.accuracy < 60);
  let label = 'Not enough data';
  if (total >= 5) {
    if (priorityWeaknesses.length) label = 'Needs attention';
    else if (overall >= 85) label = 'Strong';
    else if (overall >= 70) label = 'Building';
    else label = 'Needs attention';
  }
  const recent = attempts.filter(a => Date.now()-new Date(a.created_at).getTime() <= 14*DAY_MS);
  const previous = attempts.filter(a => { const age=Date.now()-new Date(a.created_at).getTime(); return age>14*DAY_MS && age<=28*DAY_MS; });
  const recentAcc = pct(recent.filter(a=>a.is_correct).length,recent.length);
  const prevAcc = pct(previous.filter(a=>a.is_correct).length,previous.length);
  return { label, accuracy:overall, attempts:total, correct, skills, priority_weaknesses:priorityWeaknesses, recent_accuracy:recentAcc, previous_accuracy:prevAcc, trend:recentAcc==null||prevAcc==null?null:recentAcc-prevAcc };
}

function dailyProof(attempts, sessions) {
  const map = new Map();
  const ensure = k => { if(!map.has(k)) map.set(k,{date:k,attempts:0,correct:0,sessions:0}); return map.get(k); };
  attempts.forEach(a=>{const k=localDateKey(a.created_at); if(!k)return; const d=ensure(k); d.attempts++; if(a.is_correct)d.correct++;});
  sessions.forEach(s=>{const k=localDateKey(s.ended_at||s.started_at); if(!k)return; ensure(k).sessions++;});
  return [...map.values()].map(d=>({...d,accuracy:pct(d.correct,d.attempts)})).sort((a,b)=>b.date.localeCompare(a.date));
}

async function fetchPaged(select, env, table, queryBase, pageSize=1000, maxPages=30) {
  const out=[];
  for(let page=0;page<maxPages;page++){
    const offset=page*pageSize;
    const rows=await select(env,table,`${queryBase}&limit=${pageSize}&offset=${offset}`);
    if(!Array.isArray(rows)||!rows.length)break;
    out.push(...rows); if(rows.length<pageSize)break;
  }
  return out;
}

async function requireTeacher(env,userId,select){
  const rows=await select(env,'profiles',`id=eq.${encodeURIComponent(userId)}&select=id,role,approved,name,username`);
  const p=rows&&rows[0];
  if(!p || !['teacher','admin'].includes(String(p.role||'').toLowerCase()) || p.approved===false) return null;
  return p;
}

async function studentRows(env,select,className){
  let q='role=eq.student&approved=eq.true&select=id,name,username,korean_name,class';
  if(className)q+=`&class=eq.${encodeURIComponent(className)}`;
  const rows=await select(env,'profiles',q);
  return (rows||[]).filter(p=>!p.username||String(p.username).length>1);
}

async function fetchEvidence(env,select,userIds,days){
  if(!userIds.length)return{attempts:[],sessions:[]};
  const since=daysAgoIso(days);
  const attempts=[],sessions=[];
  for(let i=0;i<userIds.length;i+=60){
    const ids=userIds.slice(i,i+60).join(',');
    const [a,s]=await Promise.all([
      fetchPaged(select,env,'progress_attempts',`user_id=in.(${ids})&created_at=gte.${encodeURIComponent(since)}&select=user_id,session_id,mode,word,is_correct,answer,correct_answer,points,attempt_index,duration_ms,extra,created_at&order=created_at.desc`),
      fetchPaged(select,env,'progress_sessions',`user_id=in.(${ids})&ended_at=not.is.null&ended_at=gte.${encodeURIComponent(since)}&select=user_id,session_id,mode,list_name,list_size,started_at,ended_at,summary&order=ended_at.desc`)
    ]);
    attempts.push(...a); sessions.push(...s);
  }
  return{attempts,sessions};
}

function studentInsight(profile,attempts,sessions,includeDetail=false){
  const habits=habitRating(attempts,sessions),learning=learningRating(attempts),proof=dailyProof(attempts,sessions);
  const wrong=attempts.filter(a=>!a.is_correct).slice(0,includeDetail?20:5).map(a=>({created_at:a.created_at,skill:normalizedSkill(a),...evidenceText(a)}));
  const lastSession=sessions[0]||null;
  return {
    user_id:profile.id,name:profile.name||profile.username||'Student',korean_name:profile.korean_name||null,class:profile.class||null,
    habits,learning,
    attention: learning.label==='Needs attention' ? 'learning' : habits.label==='Needs attention' ? 'habits' : habits.label==='Developing' ? 'habits_watch' : null,
    last_activity:lastSession?.ended_at || attempts[0]?.created_at || null,
    recent_mistakes:wrong,
    ...(includeDetail?{proof,recent_sessions:sessions.slice(0,20).map(s=>({session_id:s.session_id,mode:s.mode,list_name:s.list_name,list_size:s.list_size,started_at:s.started_at,ended_at:s.ended_at,summary:safeObj(s.summary)}))}:{}),
  };
}

export async function handleTeacherInsights({ request, env, userId, section, origin, jsonResponse, supabaseSelect }) {
  if(!section.startsWith('teacher_')) return null;
  const teacher=await requireTeacher(env,userId,supabaseSelect);
  if(!teacher)return jsonResponse({success:false,error:'Teacher or admin access required'},403,origin,0);
  const url=new URL(request.url);
  const days=clamp(Number(url.searchParams.get('days')||30)||30,7,90);

  if(section==='teacher_classes'){
    const rows=await studentRows(env,supabaseSelect,null);
    const map=new Map(); rows.forEach(s=>{if(!s.class)return; const cur=map.get(s.class)||0; map.set(s.class,cur+1);});
    const classes=[...map.entries()].map(([name,student_count])=>({name,student_count})).sort((a,b)=>a.name.localeCompare(b.name));
    return jsonResponse({success:true,classes},200,origin,30);
  }

  if(section==='teacher_class_insights'){
    const className=String(url.searchParams.get('class')||'').trim();
    if(!className)return jsonResponse({success:false,error:'Missing class'},400,origin,0);
    const profiles=await studentRows(env,supabaseSelect,className),ids=profiles.map(p=>p.id);
    const {attempts,sessions}=await fetchEvidence(env,supabaseSelect,ids,days);
    const aBy=new Map(),sBy=new Map();
    attempts.forEach(a=>{if(!aBy.has(a.user_id))aBy.set(a.user_id,[]);aBy.get(a.user_id).push(a)});
    sessions.forEach(s=>{if(!sBy.has(s.user_id))sBy.set(s.user_id,[]);sBy.get(s.user_id).push(s)});
    const students=profiles.map(p=>studentInsight(p,aBy.get(p.id)||[],sBy.get(p.id)||[],false));
    const classAttempts=attempts.length,classCorrect=attempts.filter(a=>a.is_correct).length;
    return jsonResponse({success:true,class:className,days,summary:{students:students.length,active_students:students.filter(s=>s.habits.active_days_30>0).length,needs_learning_attention:students.filter(s=>s.learning.label==='Needs attention').length,needs_habit_attention:students.filter(s=>s.habits.label==='Needs attention').length,attempts:classAttempts,accuracy:pct(classCorrect,classAttempts)},students},200,origin,20);
  }

  if(section==='teacher_student_insights'){
    const studentId=String(url.searchParams.get('student_id')||'').trim();
    if(!studentId)return jsonResponse({success:false,error:'Missing student_id'},400,origin,0);
    const rows=await supabaseSelect(env,'profiles',`id=eq.${encodeURIComponent(studentId)}&role=eq.student&select=id,name,username,korean_name,class`);
    const profile=rows&&rows[0]; if(!profile)return jsonResponse({success:false,error:'Student not found'},404,origin,0);
    const {attempts,sessions}=await fetchEvidence(env,supabaseSelect,[studentId],days);
    return jsonResponse({success:true,days,student:studentInsight(profile,attempts,sessions,true)},200,origin,10);
  }

  return jsonResponse({success:false,error:'Unknown teacher insights section'},400,origin,0);
}
