(function(){
'use strict';
if(location.hostname!=='staging.willenaenglish.com')return;
var s=document.createElement('script');
s.src='./v2-ai-debug.js?v=20260818-coachdebug1';
s.defer=true;
document.head.appendChild(s);
})();
