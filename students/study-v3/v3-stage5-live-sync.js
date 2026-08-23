(function(global){
'use strict';
var VERSION='coach-stage5-live-sync-v1.0',timer=0,busy=false;
async function sync(){if(busy)return;busy=true;try{var coach=global.WillenaAICoach,ctx=coach&&typeof coach.context==='function'?coach.context():null,h=global.WillenaCoachHistory,t=global.WillenaCoachStage5TargetHistory,jobs=[];if(ctx&&h&&typeof h.refresh==='function')jobs.push(Promise.resolve(h.refresh(ctx)));if(t&&typeof t.load==='function')jobs.push(Promise.resolve(t.load({force:true})));await Promise.all(jobs);if(coach&&typeof coach.refresh==='function'){var s=typeof coach.getState==='function'?coach.getState():null;if(!s||!s.view||s.view==='home')await coach.refresh();}global.dispatchEvent(new CustomEvent('willena:stage5-synced',{detail:{version:VERSION}}));}catch(e){console.warn('[Stage5 live sync]',e);}finally{busy=false;}}
function schedule(){clearTimeout(timer);timer=setTimeout(sync,900);}
global.addEventListener('willena:study-recording',function(e){if(e&&e.detail&&e.detail.status==='queued')return;schedule();});
global.addEventListener('willena:stage5-force-refresh',sync);
global.WillenaCoachStage5LiveSync={version:VERSION,sync:sync,schedule:schedule};
})(window);