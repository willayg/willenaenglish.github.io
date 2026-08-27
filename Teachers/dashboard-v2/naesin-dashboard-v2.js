(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];

function addStyles(){
  if($('#naesinDashboardV2Styles')) return;
  const style=document.createElement('style');
  style.id='naesinDashboardV2Styles';
  style.textContent=`
  #view-naesin .page-head{align-items:center;margin:0 0 22px!important}
  #view-naesin .page-head h1{font-size:1.6rem!important;letter-spacing:-.02em}
  #view-naesin .page-head p{font-size:.78rem!important;max-width:620px}
  #view-naesin .na-grid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:18px!important;align-items:start}
  #view-naesin .na-test-card{position:relative!important;background:#fff!important;border:1.5px solid #dfe5e9!important;border-radius:24px!important;padding:20px!important;min-height:220px!important;box-shadow:0 9px 26px rgba(38,42,55,.065)!important;cursor:pointer!important;transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease!important;overflow:hidden!important}
  #view-naesin .na-test-card:hover,#view-naesin .na-test-card:focus-visible{transform:translateY(-2px)!important;border-color:#84d5df!important;box-shadow:0 16px 38px rgba(38,42,55,.11)!important;outline:none}
  #view-naesin .na-test-card:before{content:'';position:absolute;left:0;top:0;bottom:0;width:5px;background:#58c3d2;opacity:.9}
  #view-naesin .na-test-card:after{content:'학생 열기';position:absolute;right:18px;bottom:18px;font-size:.66rem;font-weight:700;color:#318c97;background:#eef9fb;border:1px solid #c8edf1;padding:7px 10px;border-radius:10px;pointer-events:none}
  #view-naesin .na-test-card.open:after{content:'학생 닫기'}
  #view-naesin .na-test-top{gap:16px!important}
  #view-naesin .na-test-title{font-size:1.05rem!important;line-height:1.4;color:#303442}
  #view-naesin .na-test-sub{font-size:.72rem!important;margin-top:5px!important;color:#7c8490}
  #view-naesin .na-test-date{font-size:.67rem!important;padding:6px 9px!important;background:#f5f6f8!important;border:1px solid #eceef1}
  #view-naesin .na-test-meta{margin-top:15px!important;gap:7px!important}
  #view-naesin .na-badge{padding:6px 9px!important;font-size:.65rem!important}
  #view-naesin .na-card-actions{margin-top:18px!important;padding-right:90px;gap:8px!important}
  #view-naesin .na-task,#view-naesin .na-edit{min-height:40px;border-radius:11px!important;padding:9px 12px!important}
  #view-naesin .na-track{display:none!important}
  #view-naesin .na-members{margin-top:18px!important;padding-top:15px!important;border-top:1px solid #e9edf0!important}
  #view-naesin .na-members:before{content:'학생 활동';display:block;font-size:.68rem;font-weight:700;color:#707883;margin-bottom:9px;text-transform:uppercase;letter-spacing:.05em}
  #view-naesin .na-member{position:relative!important;display:grid!important;grid-template-columns:minmax(0,1fr) auto auto!important;gap:13px!important;align-items:center!important;padding:13px 42px 13px 13px!important;margin:7px 0!important;border:1px solid #e7ebee!important;border-radius:14px!important;background:#fbfcfd!important;cursor:pointer!important;transition:background .13s ease,border-color .13s ease,transform .13s ease!important}
  #view-naesin .na-member:hover,#view-naesin .na-member:focus-visible{background:#fff!important;border-color:#9edce4!important;transform:translateX(2px);outline:none}
  #view-naesin .na-member:after{content:'›';position:absolute;right:15px;top:50%;transform:translateY(-50%);font-size:22px;color:#8c9aa3}
  #view-naesin .na-member b{font-size:.8rem!important;color:#313844}
  #view-naesin .na-member small{font-size:.63rem!important;margin-top:3px!important;color:#858d96}
  #view-naesin .na-member>div:nth-child(2){font-size:.72rem;font-weight:700;color:#53616b;background:#f1f4f6;border-radius:9px;padding:6px 8px;white-space:nowrap}
  #view-naesin .na-member>div:nth-child(3){font-size:.72rem;font-weight:700;color:#287b85;background:#eef9fb;border-radius:9px;padding:6px 8px;min-width:48px;text-align:center;white-space:nowrap}
  @media(max-width:980px){#view-naesin .na-grid{grid-template-columns:1fr!important}}
  @media(max-width:700px){#view-naesin .na-test-card{padding:17px!important;min-height:200px!important}#view-naesin .na-card-actions{padding-right:0;padding-bottom:45px}}
  `;
  document.head.appendChild(style);
}

async function openStudentFromNaesin(row){
  if(window.WillenaNaesinDiagnostic?.open){
    try{
      await window.WillenaNaesinDiagnostic.open(row);
    }catch(e){
      console.error('[naesin-ui] Test Prep diagnostic failed',e);
      const name=row.querySelector('b')?.textContent?.trim()||'Student';
      $('#drawerBg')?.classList.add('open');
      if($('#drawerName')) $('#drawerName').textContent=name;
      if($('#drawerMeta')) $('#drawerMeta').textContent='Test Prep';
      if($('#drawerBody')) $('#drawerBody').innerHTML=`<div class="empty">${String(e?.message||e||'Could not load Test Prep data.')}</div>`;
    }
    return;
  }
  console.error('[naesin-ui] Test Prep diagnostic module not loaded');
}

function enhanceCards(){
  const root=$('#view-naesin');
  if(!root) return;
  $$('.na-test-card',root).forEach(card=>{
    if(!card.dataset.clickCardBound){
      card.dataset.clickCardBound='1';
      card.tabIndex=0;
      card.setAttribute('role','button');
      card.setAttribute('aria-label','학생 목록 열기');
      card.addEventListener('click',e=>{
        if(e.target.closest('button')||e.target.closest('.na-member')) return;
        card.classList.toggle('open');
      });
      card.addEventListener('keydown',e=>{
        if((e.key==='Enter'||e.key===' ')&&!e.target.closest('button')){
          e.preventDefault();
          card.classList.toggle('open');
        }
      });
    }
  });
  $$('.na-member',root).forEach(row=>{
    if(row.dataset.studentDetailBound) return;
    row.dataset.studentDetailBound='1';
    row.tabIndex=0;
    row.setAttribute('role','button');
    row.setAttribute('aria-label',`${row.querySelector('b')?.textContent?.trim()||'학생'} Test Prep 분석 보기`);
    row.addEventListener('click',e=>{e.stopPropagation();openStudentFromNaesin(row)});
    row.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();openStudentFromNaesin(row)}});
  });
}

let scheduled=false;
function scan(){scheduled=false;addStyles();enhanceCards()}
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(scan)}
function boot(){scan();const root=$('#view-naesin');if(root)new MutationObserver(schedule).observe(root,{childList:true,subtree:true});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();