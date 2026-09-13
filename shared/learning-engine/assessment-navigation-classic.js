(function(){
'use strict';
var instances={};

function sessionFor(mode){
 var store=window.WillenaAssessmentSessionStore;
 if(!store||typeof store.get!=='function')return null;
 try{var s=store.get();return s&&(!mode||s.mode===mode)?s:null}catch(_){return null}
}
function create(options){
 options=options||{};
 var mode=options.mode||'classic';
 if(instances[mode])return instances[mode];
 var active=false,complete=false,allowExit=false,modalOpen=false,guardPushed=false;
 var exitUrl=options.exitUrl||'/';
 function modal(){return document.getElementById(options.modalId||'leaveGuard')}
 function sessionActive(){var s=sessionFor(mode);return !!(s&&s.status==='in_progress'&&s.phase==='test')}
 function isActive(){return !complete&&(active||sessionActive())}
 function show(){
  if(!isActive()||allowExit||modalOpen)return;
  var box=modal();if(!box)return;
  modalOpen=true;box.hidden=false;document.body.style.overflow='hidden';
  var stay=document.getElementById(options.stayId||'leaveGuardStay');if(stay)setTimeout(function(){stay.focus()},0);
 }
 function hide(){var box=modal();modalOpen=false;if(box)box.hidden=true;document.body.style.overflow=''}
 function activate(){
  if(complete)return;
  active=true;allowExit=false;
  if(!guardPushed){history.pushState({willenaAssessmentGuard:true,mode:mode},'',location.href);guardPushed=true}
 }
 function deactivate(){active=false;allowExit=true;hide()}
 function permitExit(){allowExit=true;hide()}
 function markComplete(){complete=true;deactivate()}
 function reset(){complete=false;active=false;allowExit=false;guardPushed=false;hide()}
 function state(){return{mode:mode,active:isActive(),localActive:active,sessionActive:sessionActive(),complete:complete,allowExit:allowExit,modalOpen:modalOpen,guardPushed:guardPushed}}

 window.addEventListener('popstate',function(){
  if(!isActive()||allowExit)return;
  history.pushState({willenaAssessmentGuard:true,mode:mode},'',location.href);guardPushed=true;show();
 });
 window.addEventListener('beforeunload',function(event){if(!isActive()||allowExit)return;event.preventDefault();event.returnValue=''});
 document.addEventListener('click',function(event){
  var target=event.target;if(!target)return;
  if(target.id===(options.stayId||'leaveGuardStay')){hide();return}
  if(target.id===(options.exitId||'leaveGuardExit')){deactivate();location.href=exitUrl}
 });
 document.addEventListener('keydown',function(event){if(event.key==='Escape'&&modalOpen){event.preventDefault();hide()}});
 window.addEventListener('willena:session-changed',function(event){
  var s=event&&event.detail&&event.detail.session;
  if(!s||s.mode!==mode)return;
  if(s.status==='complete'||s.phase==='results')markComplete();
 });

 var api={activate:activate,deactivate:deactivate,permitExit:permitExit,complete:markComplete,reset:reset,show:show,hide:hide,isActive:isActive,state:state};
 instances[mode]=api;
 return api;
}
window.WillenaAssessmentNavigation={create:create,get:function(mode){return instances[mode]||null}};
})();
