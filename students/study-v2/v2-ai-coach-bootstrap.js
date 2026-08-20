(function(global){
'use strict';
var coach=global.WillenaAICoach;
if(!coach||typeof coach.home!=='function'||typeof coach.context!=='function')return;

var root=document.documentElement;
root.classList.add('willena-coach-booting');
var style=document.createElement('style');
style.textContent=[
  '.willena-coach-booting #aiChatTranscript,.willena-coach-booting #aiChatPromptsLegacy,.willena-coach-booting #aiCoachChoices,.willena-coach-booting #aiChatCta{display:none!important;}',
  '#aiCoachBootLoader{display:none;min-height:150px;border-radius:20px;background:#4b4aa3;color:#f5f2ff;padding:22px 20px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;box-sizing:border-box;overflow:hidden;}',
  '.willena-coach-booting #aiCoachBootLoader{display:flex;flex-direction:column;justify-content:center;gap:14px;}',
  '#aiCoachBootLoader .coach-loader-title{font-size:15px;font-weight:800;letter-spacing:.08em;}',
  '#aiCoachBootLoader .coach-loader-copy{font-size:13px;line-height:1.45;opacity:.92;}',
  '#aiCoachBootLoader .coach-loader-bars{display:grid;grid-template-columns:repeat(8,1fr);height:18px;border-radius:4px;overflow:hidden;box-shadow:0 0 0 2px rgba(255,255,255,.15);}',
  '#aiCoachBootLoader .coach-loader-bars i:nth-child(1){background:#d45ca6}',
  '#aiCoachBootLoader .coach-loader-bars i:nth-child(2){background:#7fd0d4}',
  '#aiCoachBootLoader .coach-loader-bars i:nth-child(3){background:#6a5acd}',
  '#aiCoachBootLoader .coach-loader-bars i:nth-child(4){background:#f3d36a}',
  '#aiCoachBootLoader .coach-loader-bars i:nth-child(5){background:#ef8f5b}',
  '#aiCoachBootLoader .coach-loader-bars i:nth-child(6){background:#9bd46a}',
  '#aiCoachBootLoader .coach-loader-bars i:nth-child(7){background:#68a6df}',
  '#aiCoachBootLoader .coach-loader-bars i:nth-child(8){background:#f3a8c8}',
  '#aiCoachBootLoader .coach-loader-cursor{display:inline-block;width:8px;height:14px;background:currentColor;vertical-align:-2px;animation:coachLoaderBlink .75s steps(1,end) infinite;}',
  '@keyframes coachLoaderBlink{50%{opacity:0}}',
  '@media (prefers-reduced-motion:reduce){#aiCoachBootLoader .coach-loader-cursor{animation:none;}}'
].join('');
document.head.appendChild(style);

var started=false;
var failTimer=null;

function text(v){return String(v==null?'':v).trim();}
function isKo(){var b=document.getElementById('languageBtn');return !b||text(b.textContent)==='English';}
function ensureLoader(){
  var chat=document.getElementById('aiChat');
  if(!chat)return null;
  var loader=document.getElementById('aiCoachBootLoader');
  if(!loader){
    loader=document.createElement('div');
    loader.id='aiCoachBootLoader';
    loader.setAttribute('role','status');
    loader.setAttribute('aria-live','polite');
    loader.innerHTML='<div class="coach-loader-title"></div><div class="coach-loader-bars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><div class="coach-loader-copy"></div>';
    chat.appendChild(loader);
  }
  var title=loader.querySelector('.coach-loader-title'),copy=loader.querySelector('.coach-loader-copy');
  if(title)title.textContent=isKo()?'AI COACH LOADING...':'AI COACH LOADING...';
  if(copy)copy.innerHTML=isKo()?'학습 기록을 확인하고 있어요 <span class="coach-loader-cursor" aria-hidden="true"></span>':'CHECKING YOUR STUDY RECORDS <span class="coach-loader-cursor" aria-hidden="true"></span>';
  return loader;
}
function masteryReady(){
  var cards=Array.prototype.slice.call(document.querySelectorAll('#masteryGrid [data-skill]'));
  if(!cards.length)return false;
  return cards.some(function(card){var pct=card.querySelector('.header-skill-master-pct');return !!text(pct&&pct.textContent);});
}

async function startFromLive(){
  if(started)return false;
  var ctx=coach.context();
  if(!ctx)return false;
  started=true;
  if(failTimer){clearTimeout(failTimer);failTimer=null;}
  global.dispatchEvent(new CustomEvent('willena:coach-bootstrap-ready',{detail:{context:ctx,publicLevel:Number(ctx.publicLevel)||0,masteryReady:masteryReady(),source:'live'}}));
  await coach.home(true);
  root.classList.remove('willena-coach-booting');
  return true;
}

async function onStudyReady(e){
  var source=e&&e.detail&&e.detail.source||'';
  if(source!=='live')return;
  if(!started){await startFromLive();return;}
  var state=typeof coach.getState==='function'?coach.getState():null;
  if(state&&state.view&&state.view!=='home')return;
  await coach.refresh();
}

function boot(){
  ensureLoader();
  global.addEventListener('willena:study-v2-ready',onStudyReady);
  var lang=document.getElementById('languageBtn');
  if(lang)lang.addEventListener('click',function(){setTimeout(ensureLoader,0);});
  failTimer=setTimeout(function(){
    if(started)return;
    console.warn('[AI Coach bootstrap] Live Study V2 context did not become ready.');
    root.classList.remove('willena-coach-booting');
  },12000);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})(window);
