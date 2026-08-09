(function(global){
'use strict';
function safeGenerated(activity){
  if(!activity||!activity.id)return false;
  var id=String(activity.id);
  if(activity.metadata&&activity.metadata.structured_dialogue)return true;
  return /^pool-(vocab-|spell-|listen-word-|listen-sentence-|sentence-|dialogue-)/.test(id);
}
function install(){
  var pool=global.WillenaPracticePool;
  if(!pool||pool.__willenaSafePolicy)return false;
  var original=pool.loadUnitPool;
  pool.loadUnitPool=async function(options){
    var pack=await original.call(pool,options);
    pack.activities=(pack.activities||[]).filter(safeGenerated);
    return pack;
  };
  pool.__willenaSafePolicy=true;
  pool.questionPolicy='safe-generated-v1';
  return true;
}
if(!install()){
  var tries=0,t=setInterval(function(){tries++;if(install()||tries>40)clearInterval(t);},50);
}
})(window);
