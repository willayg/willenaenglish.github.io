// Sentence Genius manage-homework view: uses existing homework API and its
// Sentence Genius-specific Coach/Unscramble/Speaking mastery calculation.
const $=id=>document.getElementById(id);
const escapeText=s=>String(s??'');
async function api(url){
  const fn=window.WillenaAPI?.fetch?.bind(window.WillenaAPI)||fetch;
  const r=await fn(url,{credentials:'include',cache:'no-store'});
  const j=await r.json().catch(()=>({}));
  if(!r.ok||!j.success)throw Error(j.error||'Request failed');
  return j;
}
async function refresh(){
  const root=$('sgtAssignments');
  const cls=$('sgtClass')?.value||$('classSelect')?.value||'';
  root.replaceChildren();
  if(!cls){root.textContent='Select a class first.';return}
  root.textContent='Loading assignments…';
  try{
    const all=await api('/.netlify/functions/homework_api?action=list_assignments&class='+encodeURIComponent(cls));
    const assignments=(all.assignments||[]).filter(x=>{
      let m=x.list_meta||{};
      if(typeof m==='string'){try{m=JSON.parse(m)}catch{m={}}}
      return m.app==='sentence_genius'&&x.active!==false;
    });
    root.replaceChildren();
    if(!assignments.length){root.textContent='No active Sentence Genius assignments for '+cls;return}
    for(const assignment of assignments){
      const article=document.createElement('article');
      article.style.cssText='border:1px solid #d8e2e4;border-radius:14px;padding:14px;background:#fff';
      const title=document.createElement('strong');title.textContent=assignment.title||'Sentence Genius';
      const body=document.createElement('div');body.textContent='Loading class progress…';
      article.append(title,body);root.append(article);
      try{
        const p=await api('/.netlify/functions/homework_api?action=assignment_progress&assignment_id='+encodeURIComponent(assignment.id));
        body.replaceChildren();
        for(const row of p.progress||[]){
          const line=document.createElement('div');
          line.style.cssText='padding:9px 0;border-top:1px solid #eef2f3;font-size:.88rem';
          line.textContent=(row.name||row.korean_name||'Student')+' · '+(row.completion||0)+'% · '+
            (row.status||'In Progress')+' · '+(row.modes||[]).map(m=>m.mode+' '+m.passed+'/'+m.total).join(' / ');
          body.append(line);
        }
        if(!p.progress?.length)body.textContent='No enrolled students.';
      }catch(err){body.textContent='Progress unavailable: '+err.message}
    }
  }catch(err){root.textContent='Unable to load assignments: '+err.message}
}
$('sgtAssignmentsRefresh')?.addEventListener('click',()=>void refresh());
$('sgtClass')?.addEventListener('change',()=>void refresh());
