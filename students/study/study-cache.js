(function(global){
'use strict';
if(global.WillenaStudyCache)return;
var PREFIX='willena-study-cache:v1:';
var LAST_USER_KEY=PREFIX+'last-user';
var CONTENT_HOST='gxwfsqxyuufqtitspfqg.supabase.co';
var ASSIGNMENT_PATH='/rest/v1/rpc/get_study_assignment_for_class';
var MAX_ENTRY_AGE=7*24*60*60*1000;
var nativeFetch=global.fetch.bind(global);
function text(v){return String(v==null?'':v).trim();}
function currentUserId(){try{return text(localStorage.getItem('user_id')||sessionStorage.getItem('user_id')||localStorage.getItem('userId')||sessionStorage.getItem('userId'));}catch(_){return'';}}
function ns(uid){return PREFIX+uid+':';}
function key(uid,kind,id){return ns(uid)+kind+(id?':'+id:'');}
function readRaw(k){try{var raw=localStorage.getItem(k);if(!raw)return null;var obj=JSON.parse(raw);if(!obj||!obj.t||Date.now()-obj.t>MAX_ENTRY_AGE){localStorage.removeItem(k);return null;}return obj;}catch(_){return null;}}
function writeRaw(k,value){try{localStorage.setItem(k,JSON.stringify({t:Date.now(),v:value}));}catch(_){}}
function clearUser(uid){if(!uid)return;try{var p=ns(uid),remove=[];for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k&&k.indexOf(p)===0)remove.push(k);}remove.forEach(function(k){localStorage.removeItem(k);});if(localStorage.getItem(LAST_USER_KEY)===uid)localStorage.removeItem(LAST_USER_KEY);}catch(_){}}
function clearAll(){try{var remove=[];for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k&&(k===LAST_USER_KEY||k.indexOf(PREFIX)===0))remove.push(k);}remove.forEach(function(k){localStorage.removeItem(k);});}catch(_){}try{sessionStorage.removeItem('willena-study-cache:primed');}catch(_){}}
function responseFromJson(value,headers){var h=new Headers(headers||{});h.set('content-type','application/json');h.set('x-willena-study-cache','hit');return new Response(JSON.stringify(value),{status:200,headers:h});}
function stableRequestKey(url,init){try{var u=new URL(url,location.href);u.searchParams.delete('_');var method=String(init&&init.method||'GET').toUpperCase();var body=method==='GET'?'':text(init&&init.body);return method+'|'+u.origin+u.pathname+'?'+u.searchParams.toString()+'|'+body;}catch(_){return'';}}
function isCacheableContent(url,init){try{var u=new URL(url,location.href),method=String(init&&init.method||'GET').toUpperCase();if(method!=='GET'||u.hostname!==CONTENT_HOST||u.pathname.indexOf('/rest/v1/')!==0)return false;if(u.pathname.indexOf('/rest/v1/rpc/')===0)return false;return /content_books|content_units|source_content_occurrences|lexical_entries|patterns|sentences|source_dialogues|source_dialogue_turns|assessment_items/.test(u.pathname);}catch(_){return false;}}
function isAssignment(url,init){try{var u=new URL(url,location.href);return String(init&&init.method||'GET').toUpperCase()==='POST'&&u.pathname===ASSIGNMENT_PATH;}catch(_){return false;}}
function renderSummary(summary){if(!summary)return;var b=document.getElementById('bookTitle'),u=document.getElementById('unitTitle');if(b&&summary.bookTitle)b.textContent=summary.bookTitle;if(u&&summary.unitText)u.textContent=summary.unitText;}
function saveAssignmentSummary(uid,data){var a=data&&data.assignment;if(!uid||!a)return;var n=a.current_unit||a.starting_unit;var summary={bookTitle:text(a.book_title),bookId:text(a.book_id),unitText:n?'Unit '+text(n).replace(/^Unit\s*/i,''):'',unitHint:text(n)};writeRaw(key(uid,'summary'),summary);try{localStorage.setItem(LAST_USER_KEY,uid);}catch(_){}renderSummary(summary);}
function prime(){var uid=currentUserId();if(!uid)return false;var last='';try{last=localStorage.getItem(LAST_USER_KEY)||'';}catch(_){}if(last&&last!==uid)clearUser(last);var hit=readRaw(key(uid,'summary'));if(hit&&hit.v){renderSummary(hit.v);try{sessionStorage.setItem('willena-study-cache:primed','1');}catch(_){}return true;}return false;}
async function refreshAndStore(input,init,cacheKey,uid,kind){try{var r=await nativeFetch(input,init);if(!r.ok)return;var data=await r.clone().json();writeRaw(cacheKey,data);if(kind==='assignment')saveAssignmentSummary(uid,data);global.dispatchEvent(new CustomEvent('willena:study-cache-revalidated',{detail:{kind:kind,key:cacheKey}}));}catch(_){}}
global.fetch=async function(input,init){var url=typeof input==='string'?input:(input&&input.url)||'',uid=currentUserId();
 if(!uid)return nativeFetch(input,init);
 var assignment=isAssignment(url,init),content=isCacheableContent(url,init);
 if(!assignment&&!content)return nativeFetch(input,init);
 var reqKey=stableRequestKey(url,init);if(!reqKey)return nativeFetch(input,init);
 var cacheKey=key(uid,assignment?'assignment':'rest',encodeURIComponent(reqKey)),hit=readRaw(cacheKey);
 if(hit&&hit.v!=null){refreshAndStore(input,init,cacheKey,uid,assignment?'assignment':'content');return responseFromJson(hit.v);}
 var r=await nativeFetch(input,init);if(r.ok){try{var data=await r.clone().json();writeRaw(cacheKey,data);if(assignment)saveAssignmentSummary(uid,data);}catch(_){}}return r;
};
function wrapWillenaLogout(){if(!global.WillenaAPI||typeof global.WillenaAPI.fetch!=='function'||global.WillenaAPI.__studyCacheWrapped)return;var f=global.WillenaAPI.fetch.bind(global.WillenaAPI);global.WillenaAPI.fetch=function(url,opts){var s=text(url);if(s.indexOf('supabase_auth')>=0&&/[?&]action=logout(?:&|$)/.test(s))clearAll();return f(url,opts);};global.WillenaAPI.__studyCacheWrapped=true;}
var knownUser=currentUserId();
global.addEventListener('auth:changed',function(){setTimeout(function(){var now=currentUserId();if(!now){clearAll();knownUser='';return;}if(knownUser&&knownUser!==now)clearUser(knownUser);knownUser=now;prime();},0);});
global.addEventListener('storage',function(e){if(e.key==='user_id'||e.key==='userId'){var now=currentUserId();if(!now)clearAll();else if(knownUser&&knownUser!==now){clearUser(knownUser);knownUser=now;prime();}}});
prime();wrapWillenaLogout();setTimeout(wrapWillenaLogout,0);setTimeout(wrapWillenaLogout,500);
global.WillenaStudyCache={version:'study-cache-v1',prime:prime,clearUser:clearUser,clearAll:clearAll,currentUserId:currentUserId};
})(window);
