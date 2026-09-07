(()=>{
'use strict';
if(window.__WillenaNaesinRecentAccuracyFix)return;
window.__WillenaNaesinRecentAccuracyFix=true;
const TRACKING_URL='https://fiieuiktlsivwfgyivai.supabase.co';
const TRACKING_KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const nativeFetch=window.fetch.bind(window);
const norm=v=>String(v||'').trim().toLowerCase();
function authHeader(init){
  const h=init?.headers;
  if(h instanceof Headers)return h.get('Authorization')||'';
  if(Array.isArray(h)){const hit=h.find(([k])=>norm(k)==='authorization');return hit?.[1]||'';}
  if(h&&typeof h==='object')return h.Authorization||h.authorization||'';
  return'';
}
function lessonNo(v){const m=norm(v).match(/\blesson\s*(\d+)\b/);return m?m[1]:'';}
function sameLesson(a,b){
  const na=norm(a),nb=norm(b);
  if(na===nb)return true;
  if(na.startsWith(nb+' —')||nb.startsWith(na+' —'))return true;
  const aa=lessonNo(a),bb=lessonNo(b);
  return !!aa&&aa===bb;
}
function findTarget(map,unitKey,practice){
  const exact=map?.[`${unitKey}||${practice}`];
  if(exact)return exact;
  const np=norm(practice);
  for(const [k,v] of Object.entries(map||{})){
    const cut=k.lastIndexOf('||');
    if(cut<0)continue;
    const lesson=k.slice(0,cut),p=k.slice(cut+2);
    if(norm(p)===np&&sameLesson(lesson,unitKey))return v;
  }
  return null;
}
window.fetch=async function(input,init){
  const url=typeof input==='string'?input:(input&&input.url)||'';
  const isDetail=url.includes('/functions/v1/test-prep-teacher-insights')&&url.includes('action=student_detail');
  const response=await nativeFetch(input,init);
  if(!isDetail||!response.ok)return response;
  try{
    const payload=await response.clone().json();
    const map=payload?.summary?.by_lesson_practice;
    if(!map)return response;
    const u=new URL(url,location.origin),gid=u.searchParams.get('group_id')||'';
    const exams=Array.isArray(payload?.exams)?payload.exams:[];
    const exam=exams.find(x=>gid&&String(x?.group_id||'')===String(gid))||(!gid&&exams.length===1?exams[0]:null);
    const planId=exam?.plan_id;
    const auth=authHeader(init);
    if(!planId||!auth)return response;

    // Discard values injected by the older dashboard bridge. They may belong to
    // another active plan when a student has more than one Test Prep exam.
    for(const target of Object.values(map)){
      if(target&&typeof target==='object'){
        target.recent_accuracy=null;
        target.recent_count=0;
      }
    }

    const rr=await nativeFetch(`${TRACKING_URL}/rest/v1/rpc/test_prep_teacher_card_stats`,{
      method:'POST',
      headers:{Authorization:auth,apikey:TRACKING_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({p_plan_id:planId}),
      credentials:'omit',cache:'no-store'
    });
    if(!rr.ok)return response;
    const rows=await rr.json().catch(()=>[]);
    if(!Array.isArray(rows))return response;
    for(const row of rows){
      let byPractice=row?.attempted_question_ids?.by_practice;
      if(typeof byPractice==='string'){try{byPractice=JSON.parse(byPractice)}catch{byPractice=null}}
      if(!byPractice||typeof byPractice!=='object')continue;
      for(const [practice,stats] of Object.entries(byPractice)){
        const target=findTarget(map,row.unit_key,practice);
        if(!target||!stats||typeof stats!=='object')continue;
        target.recent_accuracy=stats.recent_accuracy==null?null:Number(stats.recent_accuracy);
        target.recent_count=Number(stats.recent_count||0);
      }
    }
    const headers=new Headers(response.headers);headers.set('content-type','application/json');
    return new Response(JSON.stringify(payload),{status:response.status,statusText:response.statusText,headers});
  }catch(e){console.warn('[naesin recent accuracy fix]',e);return response;}
};
})();
