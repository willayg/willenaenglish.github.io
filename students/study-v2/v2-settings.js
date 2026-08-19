(function(global){
'use strict';
var KEY='willena-study-v2-settings:v1';
var DEFAULTS={theme:'pink',sounds:true};
var THEMES={
  pink:{accent:'#ff6fb0',soft:'#fff3f8',ring:'#f1d5e2',glow:'rgba(255,111,176,.32)',shadow:'rgba(255,111,176,.14)',badge:'#ffc6df',badgeText:'#d44e8d',motif:'star'},
  cyan:{accent:'#25cfe6',soft:'#effcff',ring:'#d8f2f6',glow:'rgba(37,207,230,.30)',shadow:'rgba(37,207,230,.14)',badge:'#bcecf3',badgeText:'#159fb3',motif:'bolt'},
  blue:{accent:'#4f86ff',soft:'#f1f5ff',ring:'#dce5f7',glow:'rgba(79,134,255,.30)',shadow:'rgba(79,134,255,.14)',badge:'#c9d8ff',badgeText:'#3d6fd1',motif:'rocket'},
  orange:{accent:'#ff8a3d',soft:'#fff4eb',ring:'#f7dfcf',glow:'rgba(255,138,61,.30)',shadow:'rgba(255,138,61,.14)',badge:'#ffd4b8',badgeText:'#df6b20',motif:'fire'}
};
var state=load();
var rightAudio=null,wrongAudio=null;
function load(){try{var saved=JSON.parse(localStorage.getItem(KEY)||'{}');return{theme:THEMES[saved.theme]?saved.theme:DEFAULTS.theme,sounds:typeof saved.sounds==='boolean'?saved.sounds:DEFAULTS.sounds};}catch(_){return{theme:DEFAULTS.theme,sounds:DEFAULTS.sounds};}}
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch(_){}}
function korean(){var b=document.getElementById('languageBtn');return !b||String(b.textContent||'').trim()==='English';}
function motifSvg(kind,color,small){
  var opacity=small?'.13':'.17',svg='';
  if(kind==='bolt')svg="<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><path d='M58 7 24 55h24l-8 38 36-52H52z' fill='none' stroke='"+color+"' stroke-opacity='"+opacity+"' stroke-width='7' stroke-linejoin='round'/></svg>";
  else if(kind==='rocket')svg="<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><g fill='none' stroke='"+color+"' stroke-opacity='"+opacity+"' stroke-width='5.5' stroke-linecap='round' stroke-linejoin='round'><path d='M57 15c13-6 23-5 28-4 1 5 2 15-4 28L57 63 37 43z'/><path d='M37 43 23 45 13 55l22 2M57 63l-2 14-10 10-2-22'/><circle cx='67' cy='29' r='7'/><path d='m35 65-11 11m17-5-13 13m4-25-13 13'/></g></svg>";
  else if(kind==='fire')svg="<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><path d='M54 10c4 18-5 24-3 38 2-6 8-10 13-15 3 8 14 19 14 32 0 17-13 28-29 28S20 82 20 65c0-18 14-27 23-40 4-6 8-11 11-15Z' fill='none' stroke='"+color+"' stroke-opacity='"+opacity+"' stroke-width='6' stroke-linejoin='round'/><path d='M50 55c6 8 11 13 11 21 0 7-5 12-12 12S37 83 37 76c0-7 6-13 13-21Z' fill='none' stroke='"+color+"' stroke-opacity='"+opacity+"' stroke-width='5'/></svg>";
  else svg="<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><path d='M50 5 59 38 92 50 59 62 50 95 41 62 8 50 41 38Z' fill='none' stroke='"+color+"' stroke-opacity='"+opacity+"' stroke-width='4' stroke-linejoin='round'/></svg>";
  return 'url("data:image/svg+xml,'+encodeURIComponent(svg)+'")';
}
function applyTheme(){
  var t=THEMES[state.theme]||THEMES.pink,shell=document.querySelector('.study-v2-top-actions'),card=document.getElementById('dailyWorkoutCard');
  if(!shell||!card)return;
  shell.dataset.studyTheme=state.theme;card.dataset.studyTheme=state.theme;
  [shell,card].forEach(function(el){el.style.setProperty('--study-theme-accent',t.accent);el.style.setProperty('--study-theme-soft',t.soft);el.style.setProperty('--study-theme-ring',t.ring);el.style.setProperty('--study-theme-glow',t.glow);el.style.setProperty('--study-theme-shadow',t.shadow);el.style.setProperty('--study-theme-badge',t.badge);el.style.setProperty('--study-theme-badge-text',t.badgeText);el.style.setProperty('--study-theme-art-large',motifSvg(t.motif,t.accent,false));el.style.setProperty('--study-theme-art-small',motifSvg(t.motif,t.accent,true));});
  document.querySelectorAll('.study-theme-choice').forEach(function(btn){var active=btn.dataset.theme===state.theme;btn.classList.toggle('is-active',active);btn.setAttribute('aria-pressed',active?'true':'false');});
}
function setupAudio(){try{rightAudio=new Audio('/Games/english_arcade/assets/audio/right-answer.mp3');wrongAudio=new Audio('/Games/english_arcade/assets/audio/wrong-answer.mp3');[rightAudio,wrongAudio].forEach(function(a){a.preload='auto';a.volume=.45;});}catch(_){}}
function playAnswerSound(correct){if(!state.sounds)return;var a=correct?rightAudio:wrongAudio;if(!a)return;try{a.pause();a.currentTime=0;a.volume=.45;var p=a.play();if(p&&p.catch)p.catch(function(){});}catch(_){}}
function syncCopy(){var ko=korean(),open=document.getElementById('studySettingsBtn'),title=document.getElementById('studySettingsTitle'),themeLabel=document.getElementById('studyThemeLabel'),soundLabel=document.getElementById('studySoundLabel'),soundState=document.getElementById('studySoundState'),toggle=document.getElementById('studySoundToggle');if(open)open.textContent=ko?'설정':'Settings';if(title)title.textContent=ko?'설정':'Settings';if(themeLabel)themeLabel.textContent=ko?'테마':'Theme';if(soundLabel)soundLabel.textContent=ko?'정답 효과음':'Answer sounds';if(soundState)soundState.textContent=state.sounds?(ko?'켜짐':'On'):(ko?'꺼짐':'Off');if(toggle){toggle.setAttribute('aria-label',ko?'정답 효과음 켜기/끄기':'Turn answer sounds on or off');toggle.setAttribute('aria-pressed',state.sounds?'true':'false');}}
function closeSettings(){var back=document.getElementById('studySettingsBackdrop');if(back)back.hidden=true;var btn=document.getElementById('studySettingsBtn');if(btn)btn.focus();}
function openSettings(){var back=document.getElementById('studySettingsBackdrop');if(back){back.hidden=false;var close=back.querySelector('.study-settings-close');if(close)close.focus();}}
function buildUi(){
  var top=document.querySelector('.study-v2-top-actions'),ai=document.getElementById('aiRecommendations');
  if(!top||!ai||document.getElementById('studySettingsBtn'))return;
  var open=document.createElement('button');open.type='button';open.id='studySettingsBtn';open.setAttribute('aria-haspopup','dialog');top.insertAdjacentElement('afterend',open);
  var back=document.createElement('div');back.id='studySettingsBackdrop';back.className='study-settings-backdrop';back.hidden=true;
  back.innerHTML='<section class="study-settings-panel" role="dialog" aria-modal="true" aria-labelledby="studySettingsTitle"><div class="study-settings-head"><strong id="studySettingsTitle"></strong><button class="study-settings-close" type="button" aria-label="Close">×</button></div><div class="study-settings-group"><span id="studyThemeLabel" class="study-settings-label"></span><div class="study-theme-options"><button type="button" class="study-theme-choice" data-theme="pink" aria-label="Pink"></button><button type="button" class="study-theme-choice" data-theme="cyan" aria-label="Cyan"></button><button type="button" class="study-theme-choice" data-theme="blue" aria-label="Blue"></button><button type="button" class="study-theme-choice" data-theme="orange" aria-label="Orange"></button></div></div><div class="study-settings-group"><span id="studySoundLabel" class="study-settings-label"></span><div class="study-sound-row"><span id="studySoundState" class="study-sound-state"></span><button id="studySoundToggle" class="study-sound-toggle" type="button" aria-pressed="true"></button></div></div></section>';
  document.body.appendChild(back);open.addEventListener('click',openSettings);back.querySelector('.study-settings-close').addEventListener('click',closeSettings);back.addEventListener('click',function(e){if(e.target===back)closeSettings();});document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!back.hidden)closeSettings();});back.querySelectorAll('.study-theme-choice').forEach(function(btn){btn.addEventListener('click',function(){state.theme=btn.dataset.theme;save();applyTheme();});});back.querySelector('#studySoundToggle').addEventListener('click',function(){state.sounds=!state.sounds;save();syncCopy();});var lang=document.getElementById('languageBtn');if(lang)lang.addEventListener('click',function(){setTimeout(syncCopy,0);});syncCopy();applyTheme();
}
function bind(){buildUi();setupAudio();applyTheme();global.addEventListener('willena:activity-answer',function(e){var detail=e&&e.detail||{},result=detail.result||{};if(typeof result.correct==='boolean')playAnswerSound(result.correct);});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})(window);
