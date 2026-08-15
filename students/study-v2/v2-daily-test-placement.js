(function(){
'use strict';

var IS_STAGING=location.hostname==='staging.willenaenglish.com';
if(!IS_STAGING)return;

var launcher=null;
var observer=null;

function isTestMode(){
  try{return !!(window.WillenaStudyV2Daily&&window.WillenaStudyV2Daily.isTestMode&&window.WillenaStudyV2Daily.isTestMode());}
  catch(_){return false;}
}

function ensureLauncher(app){
  if(launcher&&launcher.isConnected)return launcher;
  launcher=document.createElement('button');
  launcher.id='v2DailyTestLauncher';
  launcher.type='button';
  launcher.textContent='Algorithm tester';
  launcher.style.cssText='display:block;margin:18px auto 6px;padding:7px 12px;border:1px solid #cbd5e1;border-radius:999px;background:#fff;color:#64748b;font:600 12px/1.2 Poppins,system-ui,sans-serif;cursor:pointer;box-shadow:none;';
  launcher.addEventListener('click',function(){
    var panel=document.getElementById('v2DailyTestPanel');
    var toggle=panel&&panel.querySelector('[data-test-action="toggle"]');
    if(toggle)toggle.click();
  });
  app.appendChild(launcher);
  return launcher;
}

function syncPlacement(){
  var app=document.getElementById('app');
  var panel=document.getElementById('v2DailyTestPanel');
  if(!app)return;

  var button=ensureLauncher(app);
  if(panel){
    if(panel.parentNode!==app||panel.nextSibling!==button){
      app.appendChild(panel);
      app.appendChild(button);
    }
    var on=isTestMode();
    panel.hidden=!on;
    panel.style.display=on?'':'none';
    button.hidden=on;
    button.style.display=on?'none':'block';

    if(!observer){
      observer=new MutationObserver(function(){setTimeout(syncPlacement,0);});
      observer.observe(panel,{childList:true,subtree:true});
    }
  }else{
    button.hidden=false;
    button.style.display='block';
  }
}

function start(){
  syncPlacement();
  var app=document.getElementById('app');
  if(app){
    new MutationObserver(function(){setTimeout(syncPlacement,0);}).observe(app,{childList:true});
  }
  setTimeout(syncPlacement,100);
  setTimeout(syncPlacement,500);
  setTimeout(syncPlacement,1500);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
else start();
})();
