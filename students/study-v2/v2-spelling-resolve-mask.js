(function(global){
'use strict';
var DB='https://gxwfsqxyuufqtitspfqg.supabase.co';
var KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
var LOW_INTERNAL_MAX=4;
var LOW_PUBLIC_MAX=2;
var cache={};

function numberFrom(meta,keys){
  for(var i=0;i<keys.length;i++){
    var raw=meta&&meta[keys[i]];
    if(raw==null||raw==='')continue;
    var n=Number(raw);
    if(Number.isFinite(n))return n;
  }
  return null;
}
function levelInfo(source){
  source=source||{};
  var meta=source.metadata||source;
  var internal=numberFrom(source,['internal_level_id','internal_level','internalLevel','willena_internal_level','level_internal']);
  var pub=numberFrom(source,['public_level','publicLevel','willena_public_level','level_public']);
  if(internal==null)internal=numberFrom(meta,['internal_level_id','internal_level','internalLevel','willena_internal_level','level_internal']);
  if(pub==null)pub=numberFrom(meta,['public_level','publicLevel','willena_public_level','level_public']);
  return{internal:internal,publicLevel:pub};
}
function isLow(info){
  if(!info)return false;
  if(info.internal!=null)return info.internal<=LOW_INTERNAL_MAX;
  if(info.publicLevel!=null)return info.publicLevel<=LOW_PUBLIC_MAX;
  return false;
}
async function resolveLevel(engine){
  var current=engine&&engine.current||{},meta=current.metadata||{};
  var local=levelInfo(meta);
  if(local.internal!=null||local.publicLevel!=null)return local;
  var bookId=meta.book_id||current.book_id||current.bookId||'';
  if(!bookId)return local;
  if(cache[bookId])return cache[bookId];
  cache[bookId]=(async function(){
    try{
      var url=DB+'/rest/v1/content_books?id=eq.'+encodeURIComponent(bookId)+'&select=id,internal_level_id,public_level,metadata&limit=1';
      var r=await fetch(url,{headers:{apikey:KEY,Authorization:'Bearer '+KEY},cache:'no-store'});
      if(!r.ok)return local;
      var rows=await r.json();
      return levelInfo(rows&&rows[0]||{});
    }catch(_){return local;}
  })();
  return cache[bookId];
}
function ensureStyle(){
  if(document.getElementById('v2SpellingResolveMaskStyle'))return;
  var s=document.createElement('style');
  s.id='v2SpellingResolveMaskStyle';
  s.textContent='.activity-letter-order.is-spelling-resolving .activity-spelling-controls,.activity-letter-order.is-spelling-resolving .activity-letter-slots,.activity-letter-order.is-spelling-resolving .activity-letter-bank,.activity-letter-order.is-spelling-resolving .activity-spelling-keyboard-hint{visibility:hidden!important;animation:none!important}';
  document.head.appendChild(s);
}
function install(){
  ensureStyle();
  var Engine=global.WillenaActivityEngine;
  if(!Engine||!Engine.prototype)return false;
  var proto=Engine.prototype;
  if(proto.__v2SpellingResolveMask)return true;
  proto.__v2SpellingResolveMask=true;
  var original=proto.renderLetterOrder;
  proto.renderLetterOrder=function(card,tokens,wordLengths){
    var result=original.call(this,card,tokens,wordLengths);
    var wrap=card&&card.querySelector&&card.querySelector('.activity-letter-order');
    if(!wrap)return result;
    wrap.classList.add('is-spelling-resolving');
    var engine=this,done=false,observer=null;
    function reveal(){
      if(done)return;
      done=true;
      if(observer)observer.disconnect();
      wrap.classList.remove('is-spelling-resolving');
    }
    resolveLevel(engine).then(function(info){
      if(!document.body.contains(card))return;
      if(!isLow(info)){reveal();return;}
      if(wrap.classList.contains('is-chunk-mode')){reveal();return;}
      observer=new MutationObserver(function(){
        if(wrap.classList.contains('is-chunk-mode'))reveal();
      });
      observer.observe(wrap,{attributes:true,attributeFilter:['class']});
      /* If chunk construction genuinely fails, do not leave spelling hidden forever. */
      setTimeout(function(){if(document.body.contains(card))reveal();},4000);
    }).catch(reveal);
    return result;
  };
  return true;
}
var tries=0,t=setInterval(function(){tries++;if(install()||tries>200)clearInterval(t);},20);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})(window);
