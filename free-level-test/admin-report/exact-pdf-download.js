(function(){
'use strict';
const ENDPOINT='https://fiieuiktlsivwfgyivai.supabase.co/functions/v1/prospective-level-test';
const ADMIN_ENDPOINT='/.netlify/functions/admin_classes';
const CURRICULUM_URL='https://gxwfsqxyuufqtitspfqg.supabase.co';
const CURRICULUM_KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
const params=new URLSearchParams(location.search),attemptId=params.get('attempt_id')||'',token=params.get('report_token')||params.get('session_token')||'',adminMode=params.get('admin')==='1',adminSource=params.get('source')||'';
const MAX_LEVEL=14,assessed=['vocabulary','grammar','listening','reading','sentence_building'],all=[...assessed,'speaking','writing'];
const labels={vocabulary:{ko:'어휘',en:'Vocabulary'},grammar:{ko:'문법',en:'Grammar'},listening:{ko:'듣기',en:'Listening'},reading:{ko:'읽기',en:'Reading'},sentence_building:{ko:'문장 구조 파악 능력',en:'Sentence building'},speaking:{ko:'말하기',en:'Speaking'},writing:{ko:'쓰기',en:'Writing'}};
const skillFor=t=>({vocabulary:'vocabulary',grammar:'grammar',grammar_error:'grammar',question_response:'grammar',listening:'listening',reading:'reading',sentence_unscramble:'sentence_building',speaking:'speaking',writing:'writing'}[t]||null);
let data=null,profiles=new Map(),evidence=[],sharedModel=null;
const clean=s=>String(s??'').replace(/\s+/g,' ').trim();
const apiFetch=(url,options)=>window.WillenaAPI?.fetch?window.WillenaAPI.fetch(url,options):fetch(url,options);
const esc=s=>clean(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const display=l=>l<=2?l:l-2;
const short=l=>l===1?'S1':l===2?'S2':String(l-2);
const name=(l,ko)=>l<=2?(ko?`스타터 ${l}`:`Starter ${l}`):(ko?`레벨 ${l-2}`:`Level ${l-2}`);
const profile=(l,s)=>profiles.get(`${l}:${s}`)||null;
const text=(r,f,ko,fb='')=>clean(r?.[`${f}_${ko?'ko':'en'}`])||fb;
function fallback(l,s,ko){return ko?`${name(l,true)}에서 익숙한 ${labels[s]?.ko||'영어'}를 이해하고 사용할 수 있습니다.`:`Can understand and use familiar ${labels[s]?.en.toLowerCase()||'English'} at ${name(l,false)}.`}
function overall(){return sharedModel.overall()}
function estimate(skill){return sharedModel.estimate(skill)}
function summary(l,ko){if(l===13)return ko?'영어로 수업하는 국제학교나 해외 고등학교에서 학업을 수행하며 학술적인 글, 수업 토론과 장문 과제를 다룰 수 있습니다.':'Can study successfully in an English-medium international or overseas high school, handling academic texts, class discussions and extended assignments.';if(l===14)return ko?'미국 대학교에서 강의를 이해하고 학술 자료를 읽으며 세미나에 참여하고 대학 수준의 과제를 작성할 수 있습니다.':'Can study at an American university, following lectures, reading academic texts, participating in seminars and producing university-level assignments.';return text(profile(l,'overall'),'summary',ko,fallback(l,'grammar',ko))}
function nextStep(l,ko){const weak=assessed.map(s=>({s,r:estimate(s)})).filter(x=>x.r.assessed).sort((a,b)=>a.r.level-b.r.level)[0];return weak?text(profile(weak.r.level,weak.s),'next_step',ko,ko?'다음 단계의 영어를 정확하게 사용할 수 있도록 꾸준히 연습해 주세요.':'Continue practising the next level with growing accuracy and independence.'):(ko?'다음 단계의 영어를 정확하게 사용할 수 있도록 꾸준히 연습해 주세요.':'Continue practising the next level with growing accuracy and independence.')}
function windowFor(best){const start=Math.max(1,Math.min(MAX_LEVEL-4,best-2));return Array.from({length:5},(_,i)=>start+i)}
function pathwayFor(best){const start=Math.max(1,Math.min(MAX_LEVEL-2,best-1));return Array.from({length:3},(_,i)=>start+i)}
function frame(n,title,c){return `<div class="willena-pdf-frame"></div><div class="willena-pdf-header"><div class="willena-pdf-brand">Willena English</div><div class="willena-pdf-subbrand">STUDENT LEVEL REPORT</div><div class="willena-pdf-student"><strong>${esc(c.student_name||'Student')}</strong><span>${esc([c.school_name,c.school_grade].filter(Boolean).join(' · '))}</span></div></div><div class="willena-pdf-title-line"><div class="willena-pdf-pill">${title}</div></div><div class="willena-pdf-footer"><span>WILLENA ENGLISH · PLACEMENT REPORT</span><b>${String(n).padStart(2,'0')}</b></div>`}
function hJourney(best,ko){const label=ko?`${best<=2?'스타터':name(best,true)} 배치 결과`:`${best<=2?'Starter':name(best,false)} placement result`,stages=ko?['스타터','기초','초급','중급','고급','숙련']:['Starter','Foundation','Elementary','Intermediate','Advanced','Proficient'];return `<div class="willena-pdf-placement-scale"><div class="willena-pdf-placement-pips" role="img" aria-label="${label}">${skillPips(best)}</div><div class="willena-pdf-placement-stages">${stages.map(stage=>`<span>${stage}</span>`).join('')}</div></div>`}
function skillPips(level){
 const current=Math.max(1,Math.min(MAX_LEVEL,Number(level)||1));
 const starter=`<i class="willena-pdf-segment starter ${current<=2?'current':'done'}"></i>`;
 const numbered=Array.from({length:12},(_,i)=>{
  const internalLevel=i+3;
  return `<i class="willena-pdf-segment ${internalLevel<current?'done':internalLevel===current?'current':''}"></i>`;
 }).join('');
 return starter+numbered;
}
function skillBlock(s,ko){const r=estimate(s),label=labels[s][ko?'ko':'en'];if(!r.assessed){const teacherAssessed=s==='speaking'||s==='writing',note=teacherAssessed?(ko?'이 영역은 담당 교사가 직접 평가합니다.':'This skill will be assessed directly by the teacher.'):(ko?'이 영역은 최소 세 문항이 필요합니다.':'At least three questions are required.');return `<div class="willena-pdf-skill unassessed"><div class="willena-pdf-skill-head"><strong>${label}</strong><span>${teacherAssessed?(ko?'교사 평가':'Teacher assessment'):(ko?'평가되지 않음':'Not assessed')}</span></div><p>${note}</p></div>`}return `<div class="willena-pdf-skill"><div class="willena-pdf-skill-head"><strong>${label}</strong><span>${name(r.level,ko)}${r.plus?'+':''}</span></div><div class="willena-pdf-segments">${skillPips(r.level)}</div><p>${esc(text(profile(r.level,s),'summary',ko,fallback(r.level,s,ko)))}</p></div>`}
function pathwaySummary(l,ko){const raw=summary(l,ko),parts=raw.split(/(?=【|\[)/).map(clean).filter(Boolean);if(parts.length<2)return esc(raw);return parts.map(part=>{const match=part.match(/^(【[^】]+】|\[[^\]]+\])\s*/);return match?`<span class="willena-pdf-summary-section"><strong>${esc(match[1])}</strong>${esc(part.slice(match[0].length))}</span>`:`<span class="willena-pdf-summary-section">${esc(part)}</span>`}).join('')}
function vJourney(best,ko){const lv=pathwayFor(best),idx=lv.indexOf(best);return lv.map((l,i)=>{const current=l===best,badge=current?(ko?'추천 시작 레벨':'Recommended level'):i<idx?(ko?'편안한 대안':'Comfortable alternative'):(ko?'도전 가능한 레벨':'Challenge level');return `<div class="willena-pdf-vrow ${current?'current':'adjacent'}"><div class="willena-pdf-vcard"><div class="willena-pdf-vbadge">${badge}</div><h3>${name(l,ko)}</h3><p>${pathwaySummary(l,ko)}</p></div></div>`}).join('')}
function otherRows(best,ko){const shown=pathwayFor(best),remaining=Array.from({length:MAX_LEVEL-2},(_,i)=>i+3).filter(l=>!shown.includes(l)),groups=[];let g=[],prev=0;remaining.forEach(l=>{if(prev&&l!==prev+1){groups.push(g);g=[]}g.push(l);prev=l});if(g.length)groups.push(g);return groups.map((group,gi)=>group.map((l,i)=>`<div class="willena-pdf-other-row ${i===group.length-1?'group-end':''}"><div class="willena-pdf-other-line"></div><div class="willena-pdf-other-marker">${short(l)}</div><div class="willena-pdf-other-card"><h3>${name(l,ko)}</h3><p>${esc(summary(l,ko))}</p></div></div>`).join('')+(gi<groups.length-1?'<div class="willena-pdf-gap"></div>':'')).join('')}
function build(){const ko=document.documentElement.lang!=='en',best=overall(),c=data.candidate||{},first=assessed.map(s=>({s,r:estimate(s)})).find(x=>x.r.assessed),canTitle=ko?'현재 할 수 있는 것':'What the learner can do',canHead=first?labels[first.s][ko?'ko':'en']:(ko?'기초 영어':'Core English'),canBody=first?text(profile(first.r.level,first.s),'summary',ko,fallback(first.r.level,first.s,ko)):summary(best,ko),stage=document.createElement('div');stage.className='willena-pdf-stage';stage.innerHTML=`<section class="willena-pdf-page">${frame(1,'PLACEMENT SUMMARY',c)}<div class="willena-pdf-hero-label">${ko?'추천 시작 레벨':'Recommended starting level'}</div><div class="willena-pdf-orbit"><span>${best<=2?(ko?'스타터':'STARTER'):(ko?'레벨':'LEVEL')}</span><strong>${display(best)}</strong></div>${hJourney(best,ko)}<div class="willena-pdf-one-card"><article class="willena-pdf-card willena-pdf-card-full"><div class="willena-pdf-bisect">${canTitle}</div><h3>${canHead}</h3><p>${esc(canBody)}</p></article></div></section><section class="willena-pdf-page">${frame(2,'SKILL PROFILE',c)}<h2 class="willena-pdf-heading">${ko?'영역별 예상 레벨':'Estimated level by skill'}</h2><div class="willena-pdf-skills">${all.map(s=>skillBlock(s,ko)).join('')}</div></section><section class="willena-pdf-page">${frame(3,'LEVEL PATHWAY',c)}<h2 class="willena-pdf-heading">${ko?'레벨 안내':'Level guide'}</h2><p class="willena-pdf-subtitle">${ko?'추천 레벨과 가장 가까운 단계를 함께 표시합니다.':'The recommended level and its closest alternatives are shown.'}</p><div class="willena-pdf-vjourney">${vJourney(best,ko)}</div></section><section class="willena-pdf-page">${frame(4,'OTHER LEVELS',c)}<h2 class="willena-pdf-heading">${ko?'다른 레벨 안내':'Other levels'}</h2><p class="willena-pdf-subtitle">${ko?'페이지 3에 표시되지 않은 나머지 단계입니다.':'The remaining levels not shown on page 3.'}</p><div class="willena-pdf-other">${otherRows(best,ko)}</div></section>`;document.body.appendChild(stage);return stage}
function loadScript(src,globalName){if(window[globalName])return Promise.resolve();return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;document.head.appendChild(s)})}
async function refreshAdminSession(){if(!adminMode)return;const options={credentials:'include',cache:'no-store'};let response=await apiFetch('/.netlify/functions/supabase_auth?action=whoami&_='+Date.now(),options),session=await response.json().catch(()=>({}));if(response.ok&&session.user_id)return;response=await apiFetch('/.netlify/functions/supabase_auth?action=refresh&_='+Date.now(),options);session=await response.json().catch(()=>({}));if(response.ok&&session.access_token&&window.WillenaAPI?.setLocalTokens)window.WillenaAPI.setLocalTokens(session.access_token,session.refresh_token)}
async function loadData(){if(data&&sharedModel)return;await refreshAdminSession();const adminHeaders={'content-type':'application/json'};if(adminMode){try{const access=localStorage.getItem('sb_access_token');if(access&&access.includes('.')&&access.length>50)adminHeaders.Authorization=`Bearer ${access}`}catch(_){}}const reportRequest=adminMode?apiFetch(ADMIN_ENDPOINT,{method:'POST',credentials:'include',headers:adminHeaders,body:JSON.stringify({action:'level_test_detail',attempt_id:attemptId,source:adminSource}),cache:'no-store'}):fetch(ENDPOINT,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'report',attempt_id:attemptId,session_token:token}),cache:'no-store'});const [rr,pr]=await Promise.all([reportRequest,fetch(`${CURRICULUM_URL}/rest/v1/assessment_report_profiles?select=level_id,skill,summary_en,summary_ko,next_step_en,next_step_ko&status=eq.published&order=level_id.asc,sort_order.asc`,{headers:{apikey:CURRICULUM_KEY,Authorization:`Bearer ${CURRICULUM_KEY}`},cache:'no-store'})]);data=await rr.json().catch(()=>({}));if(!rr.ok||!data.success)throw new Error(data.error||'Could not load report');if(window.WillenaLevelTestScoring)window.WillenaLevelTestScoring.repairPayload(data);if(pr.ok){const rows=await pr.json();profiles=new Map(rows.map(r=>[`${r.level_id}:${r.skill}`,r]))}sharedModel=window.WillenaLevelReportCalculation.create({attempt:data.attempt,responses:data.responses});evidence=sharedModel.evidence}
async function download(){
  const button=document.querySelector('#printReport'),old=button?.textContent||'',english=document.documentElement.lang==='en';
  const preview=window.open('','_blank');
  if(!preview){
    alert(english?'Please allow pop-ups so the PDF can open in a new tab.':'PDF를 새 탭에서 열려면 팝업을 허용해 주세요.');
    return;
  }
  preview.document.write(`<!doctype html><title>${english?'Building PDF…':'PDF 만드는 중…'}</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#fff;color:#214f59;font:700 17px system-ui}</style><body>${english?'Building the PDF…':'PDF를 만드는 중입니다…'}</body>`);
  preview.document.close();
  if(button){button.disabled=true;button.textContent=english?'Building PDF…':'PDF 만드는 중…'}
  const overlay=document.createElement('div');
  overlay.className='willena-pdf-working';
  overlay.textContent=english?'Building the exact A4 PDF…':'A4 PDF를 만드는 중입니다…';
  document.body.appendChild(overlay);
  let stage=null;
  try{
    await Promise.all([
      loadScript('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js','html2canvas'),
      loadScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js','jspdf')
    ]);
    await loadData();
    await document.fonts.ready;
    stage=build();
    const pages=[...stage.querySelectorAll('.willena-pdf-page')];
    const pdf=new window.jspdf.jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
    for(let i=0;i<pages.length;i++){
      const canvas=await window.html2canvas(pages[i],{scale:2,backgroundColor:'#ffffff',logging:false,useCORS:true,width:794,height:1123});
      if(i)pdf.addPage('a4','portrait');
      pdf.addImage(canvas.toDataURL('image/jpeg',.96),'JPEG',0,0,210,297,undefined,'FAST');
      canvas.width=1;
      canvas.height=1;
    }
    const blobUrl=URL.createObjectURL(pdf.output('blob'));
    preview.location.replace(blobUrl);
    setTimeout(()=>URL.revokeObjectURL(blobUrl),5*60*1000);
  }catch(err){
    console.error('[exact-pdf]',err);
    preview.close();
    alert(english?'Could not create the PDF. Please try again.':'PDF를 만들지 못했습니다. 다시 시도해 주세요.');
  }finally{
    stage?.remove();
    overlay.remove();
    if(button){button.disabled=false;button.textContent=old}
  }
}
function adoptSharedModel(){sharedModel=window.WillenaSharedReportModel||null;if(!sharedModel)return;data=sharedModel.data;profiles=sharedModel.profiles;evidence=sharedModel.evidence}
document.addEventListener('click',e=>{if(e.target.closest('#printReport'))adoptSharedModel()},true);
document.addEventListener('click',e=>{const b=e.target.closest('#printReport');if(!b)return;e.preventDefault();e.stopImmediatePropagation();download()},true);
window.WillenaExactPdf={download};
})();
