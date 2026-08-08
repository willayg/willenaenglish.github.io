(function(){
'use strict';
var TARGET=12;
var card=document.querySelector('.unit-progress-card'),ring=document.querySelector('.progress-ring'),title=document.getElementById('progressTitle'),copy=document.getElementById('progressCopy');
function dateKey(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function context(){var b=document.getElementById('bookTitle'),u=document.getElementById('unitTitle');return{book:String(b&&b.textContent||'').trim(),unit:String(u&&u.textContent||'').trim()};}
function unitNumber(text){var m=String(text||'').match(/Unit\s*(\d+)/i);return m?m[1]:'';}
function key(){var c=context();return'willena-smart-daily-v1|'+dateKey()+'|'+c.book+'|'+c.unit;}
function readCount(){try{var n=Number(JSON.parse(localStorage.getItem(key())||'0'));return Number.isFinite(n)?n:0;}catch(_){return 0;}}
function ready(){var c=context();return c.book&&!/^Loading/i.test(c.book)&&unitNumber(c.unit);}
function paint(){if(!ring||!ready())return;var pct=Math.round(readCount()/TARGET*100),fill=Math.min(100,pct);ring.style.background='conic-gradient(var(--pink) 0 '+fill+'%,#dff5f7 '+fill+'% 100%)';var s=ring.querySelector('span');if(s)s.textContent=pct+'%';if(title)title.textContent='Smart Study';if(copy)copy.textContent='오늘 목표 '+TARGET+'문항 · 탭해서 시작';}
function open(){if(!ready())return;var c=context();location.href='./smart.html?book='+encodeURIComponent(c.book)+'&unit='+encodeURIComponent(unitNumber(c.unit));}
if(!card)return;card.setAttribute('role','button');card.setAttribute('tabindex','0');card.setAttribute('aria-label','Start Smart Study');card.style.cursor='pointer';card.addEventListener('click',open);card.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}});var tries=0,t=setInterval(function(){tries++;paint();if(ready()&&tries>5||tries>30)clearInterval(t);},350);window.addEventListener('pageshow',function(){setTimeout(paint,100);});
})();