(function(global){
'use strict';
var PREFIX='willena-study-v2-daily-pending:v1:';
var ENDPOINT='https://api.willenaenglish.com/api/daily-study';
var draining=false,timer=null;
function text(v){return String(v==null?'':v).trim();}
function arr(v){return Array.isArray(v)?v:[];}
function parse(v){try{var x=JSON.parse(v||'[]');return Array.isArray(x)?x:[];}catch(_){return[];}}
function same(a,b){return String(a&&a.daily_key||'')===String(b&&b.daily_key||'');}
function mergeUnique(items){var seen={},out=[];arr(items).forEach(function(x){var k=text(x&&x.daily_key);if(!k||seen[k])return;seen[k]=1;out.push(x);});return out;}
function pendingKeys(){var out=[];try{for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k&&k.indexOf(PREFIX)===0)out.push(k);}}catch(_){}return out;}
function readKey(k){try{return parse(localStorage.getItem(k));}catch(_){return[];}}
function writeKey(k,q){try{if(q.length)localStorage.setItem(k,JSON.stringify(q));else localStorage.removeItem(k);}catch(_){} }
function installStorageGuard(){
  try{
    var proto=Storage.prototype,origSet=proto.setItem,origRemove=proto.removeItem;if(proto.__v3DailyGuard)return;proto.__v3DailyGuard=true;
    proto.setItem=function(key,value){
      if(this===global.localStorage&&String(key).indexOf(PREFIX)===0){
        try{
          var current=parse(origSet===proto.setItem?null:this.getItem(key)),incoming=parse(value);
          current=parse(this.getItem(key));
          if(current.length&&incoming.length){
            var first=current[0],firstStill=incoming.some(function(x){return same(x,first);});
            var base=firstStill?current:current.slice(1);
            value=JSON.stringify(mergeUnique(incoming.concat(base)));
          }
        }catch(_){}
      }
      return origSet.call(this,key,value);
    };
    proto.removeItem=function(key){
      if(this===global.localStorage&&String(key).indexOf(PREFIX)===0){
        try{var current=parse(this.getItem(key));if(current.length>1){return origSet.call(this,key,JSON.stringify(current.slice(1)));}}catch(_){}
      }
      return origRemove.call(this,key);
    };
  }catch(e){console.warn('[V3 Daily Sync] storage guard unavailable',e);}
}
function keyFor(item){return text(item&&item.daily_key||item&&item.id);}
async function request(date,track,method,body){
  var url=ENDPOINT+'?date='+encodeURIComponent(date)+'&track='+encodeURIComponent(track)+'&_='+Date.now();
  var init={method:method,credentials:'include',cache:'no-store',headers:{Accept:'application/json'}};
  if(body){init.headers['Content-Type']='application/json';init.body=JSON.stringify(body);}
  var r=await fetch(url,init),d=await r.json().catch(function(){return{};});if(!r.ok)throw new Error(d.error||('Daily sync '+r.status));return d;
}
function planIndex(session,key){var plan=arr(session&&session.plan);for(var i=0;i<plan.length;i++)if(keyFor(plan[i])===key)return i;return-1;}
async function drainKey(storageKey){
  var q=readKey(storageKey);if(!q.length)return;
  var sample=q[0],date=text(sample.date),track=text(sample.track||'live');if(!date)return;
  for(var guard=0;guard<40;guard++){
    q=readKey(storageKey);if(!q.length)return;
    var data=await request(date,track,'GET'),s=data&&data.session;if(!s)return;
    var cursor=Math.max(0,Number(s.cursor)||0),plan=arr(s.plan);
    q=q.filter(function(x){var idx=planIndex(s,text(x.daily_key));return idx<0||idx>=cursor;});
    writeKey(storageKey,q);if(!q.length)return;
    var current=plan[cursor],currentKey=keyFor(current);if(!currentKey)return;
    var pos=q.findIndex(function(x){return text(x.daily_key)===currentKey;});if(pos<0)return;
    var item=q[pos];
    var saved=await request(date,track,'POST',{action:'answer',daily_key:item.daily_key,correct:!!item.correct});
    if(!saved||saved.success===false)throw new Error(saved&&saved.error||'Daily answer was not saved');
    q=readKey(storageKey).filter(function(x){return text(x.daily_key)!==text(item.daily_key);});writeKey(storageKey,q);
  }
}
async function drain(){if(draining)return;draining=true;try{var keys=pendingKeys();for(var i=0;i<keys.length;i++)await drainKey(keys[i]);}catch(e){console.warn('[V3 Daily Sync] rescue deferred',e);}finally{draining=false;}}
function schedule(){clearTimeout(timer);timer=setTimeout(drain,900);}
installStorageGuard();
global.addEventListener('willena:activity-answer',function(){try{if(document.body.classList.contains('study-v2-daily-mode'))schedule();}catch(_){} });
window.addEventListener('pageshow',schedule);
setTimeout(schedule,1400);
})(window);
