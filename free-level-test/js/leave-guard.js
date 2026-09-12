(function(){
'use strict';
var fallbackActive=false,allowPageExit=false,modalOpen=false;
function modal(){return document.getElementById('leaveGuard')}
function sharedSession(){
 var store=window.WillenaAssessmentSessionStore;
 if(!store||typeof store.get!=='function')return null;
 try{return store.get()}catch(_){return null}
}
function testIsActive(){
 var session=sharedSession();
 if(session)return session.status==='in_progress'&&session.phase==='test';
 return fallbackActive;
}
function show(){
 if(!testIsActive()||allowPageExit||modalOpen)return;
 var box=modal();if(!box)return;
 modalOpen=true;box.hidden=false;document.body.style.overflow='hidden';
 var stay=document.getElementById('leaveGuardStay');if(stay)setTimeout(function(){stay.focus()},0);
}
function hide(){
 var box=modal();modalOpen=false;if(box)box.hidden=true;document.body.style.overflow='';
}
function activate(){
 if(fallbackActive)return;
 fallbackActive=true;
 history.pushState({willenaFreeLevelTestGuard:true},'',location.href);
}
function deactivate(){fallbackActive=false;allowPageExit=true;hide()}
window.addEventListener('popstate',function(){
 if(!testIsActive()||allowPageExit)return;
 history.pushState({willenaFreeLevelTestGuard:true},'',location.href);show();
});
window.addEventListener('beforeunload',function(event){
 if(!testIsActive()||allowPageExit)return;
 event.preventDefault();event.returnValue='';
});
document.addEventListener('click',function(event){
 var target=event.target;
 if(target&&target.id==='leaveGuardStay'){hide();return}
 if(target&&target.id==='leaveGuardExit'){
  deactivate();location.href='/';return;
 }
 var option=target&&target.closest&&target.closest('.setup-options[data-key="length"] .setup-option');
 if(option)setTimeout(activate,0);
 var finished=target&&target.closest&&target.closest('#retry,#home');
 if(finished)deactivate();
},true);
document.addEventListener('keydown',function(event){
 if(event.key==='Escape'&&modalOpen){event.preventDefault();hide()}
});
window.addEventListener('willena:session-changed',function(event){
 var session=event&&event.detail&&event.detail.session;
 if(session&&(session.status==='complete'||session.phase==='results'))deactivate();
});
new MutationObserver(function(){
 if(testIsActive()&&document.querySelector('#retry,#home,.report-card,.result-layout'))deactivate();
}).observe(document.documentElement,{childList:true,subtree:true});
})();
