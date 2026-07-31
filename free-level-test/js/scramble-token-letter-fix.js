(function(){
'use strict';
var attempts=0;
function install(){
 attempts++;
 if(typeof window.displayScrambleToken==='function'){
  window.displayScrambleToken=function(text,level){
   var value=String(text==null?'':text);
   if(Number(level)<6)return value;
   return value.toLowerCase().replace(/^\s+|\s+$/g,'').replace(/^[“”"‘’.,!?;:()]+|[“”"‘’.,!?;:()]+$/g,'');
  };
  return;
 }
 if(attempts<100)setTimeout(install,50);
}
install();
})();
