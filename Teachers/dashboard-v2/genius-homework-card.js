/* Compact shared Genius homework management card. Does not modify Grammar or 내신. */
(()=>{'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function dday(value){
 if(!value)return 'No deadline';
 const due=new Date(value);if(Number.isNaN(due.getTime()))return 'No deadline';
 const now=new Date(),at=d=>Date.UTC(d.getFullYear(),d.getMonth(),d.getDate());
 const diff=Math.round((at(due)-at(now))/86400000);
 return diff===0?'D-Day':diff>0?'D-'+diff:'D+'+Math.abs(diff);
}
function card({className,task,dueAt,teacher,progressLabel='Progress',progressPercent=null,body='',action='',id='' }){
 const pct=Number(progressPercent),valid=progressPercent!==null&&progressPercent!==undefined&&Number.isFinite(pct);
 return '<article class="genius-homework-card" data-genius-card="'+esc(id)+'">'+
 '<div class="ghc-top"><strong class="ghc-class">'+esc(className||'Class unavailable')+'</strong><span class="ghc-day">'+esc(dday(dueAt))+'</span></div>'+
 '<div class="ghc-task">'+esc(task||'Homework')+'</div>'+
 '<div class="ghc-teacher">'+esc(teacher||'Teacher unavailable')+'</div>'+
 (valid?'<div class="ghc-meter" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+Math.max(0,Math.min(100,pct))+'"><span style="width:'+Math.max(0,Math.min(100,pct))+'%"></span></div>':'')+
 '<details class="ghc-details"><summary><span>'+esc(progressLabel)+'</span><span class="ghc-chevron">▾</span></summary><div class="ghc-content">'+body+action+'</div></details></article>';
}
window.WillenaGeniusHomeworkCard={card,dday,escape:esc};
})();