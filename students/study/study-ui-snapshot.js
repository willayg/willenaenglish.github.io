(function(global){
'use strict';
var PREFIX='willena-study-cache:v1:';
var SNAP='ui-snapshot';
var MAX_AGE=7*24*60*60*1000;
function text(v){return String(v==null?'':v).trim();}
function uid(){try{return text(localStorage.getItem('user_id')||sessionStorage.getItem('user_id')||localStorage.getItem('userId')||sessionStorage.getItem('userId'));}catch(_){return'';}}
function cacheKey(){var u=uid();return u?PREFIX+u+':'+SNAP:'';}
function get(id){return document.getElementById(id);}
function safeHtml(id){var el=get(id);return el?el.innerHTML:'';}
function safeText(id){var el=get(id);return el?el.textContent:'';}
function read(){var k=cacheKey();if(!k)return null;try{var raw=localStorage.getItem(k);if(!raw)return null;var o=JSON.parse(raw);if(!o||!o.t||Date.now()-o.t>MAX_AGE){localStorage.removeItem(k);return null;}return o.v||null;}catch(_){return null;}}
function write(v){var k=cacheKey();if(!k||!v)return;try{localStorage.setItem(k,JSON.stringify({t:Date.now(),v:v}));}catch(_){}}
function capture(){var book=safeText('bookTitle'),unit=safeText('unitTitle');if(!book||/^Loading/i.test(book)||!unit)return;
 write({
  bookTitle:book,unitTitle:unit,
  learningMap:safeHtml('learningMap'),skillGrid:safeHtml('skillGrid'),vocabPreview:safeHtml('vocabPreview'),
  contentStatus:safeText('contentStatus'),unitWordCount:safeText('unitWordCount'),unitNumberStat:safeText('unitNumberStat'),classStat:safeText('classStat'),
  connectionTitle:safeText('connectionTitle'),connectionCopy:safeText('connectionCopy'),vocabCount:safeText('vocabCount'),progressTitle:safeText('progressTitle'),progressCopy:safeText('progressCopy')
 });
}
function setHtml(id,value){var el=get(id);if(el&&value)el.innerHTML=value;}
function setText(id,value){var el=get(id);if(el&&value!=null&&value!=='')el.textContent=value;}
function restore(){var s=read();if(!s)return false;
 setText('bookTitle',s.bookTitle);setText('unitTitle',s.unitTitle);
 setHtml('learningMap',s.learningMap);setHtml('skillGrid',s.skillGrid);setHtml('vocabPreview',s.vocabPreview);
 setText('contentStatus',s.contentStatus);setText('unitWordCount',s.unitWordCount);setText('unitNumberStat',s.unitNumberStat);setText('classStat',s.classStat);
 setText('connectionTitle',s.connectionTitle);setText('connectionCopy',s.connectionCopy);setText('vocabCount',s.vocabCount);setText('progressTitle',s.progressTitle);setText('progressCopy',s.progressCopy);
 var cont=get('continueBtn');if(cont)cont.disabled=false;
 try{document.documentElement.dataset.studySnapshot='restored';}catch(_){}
 return true;
}
function scheduleCapture(){capture();setTimeout(capture,250);setTimeout(capture,900);setTimeout(capture,1800);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',restore,{once:true});else restore();
global.addEventListener('willena:study-unit-changed',scheduleCapture);
global.addEventListener('willena:study-cache-revalidated',function(e){if(e&&e.detail&&e.detail.changed)setTimeout(capture,1200);});
global.WillenaStudyUISnapshot={version:'study-ui-snapshot-v1',restore:restore,capture:capture};
})(window);
