from pathlib import Path

p = Path('students/study-v2/v2-daily.js')
s = p.read_text(encoding='utf-8')
old = """async function submitAnswer(correct){var key=dailyKey(current),data=await request('POST',{action:'answer',daily_key:key,correct:!!correct});if(data&&data.stale){sessionFrom(data);showCurrent();return;}if(!data||data.success===false)throw new Error(data&&data.error||'Daily answer was not saved.');sessionFrom(data);if(IS_STAGING)renderTestPanel();}\nasync function onAnswer(e){\n  if(!document.body.classList.contains('study-v2-daily-mode')||!current||answerLocked)return;\n  var d=e.detail||{},a=d.activity||{},r=d.result||{};if(String(a.id)!==String(current.id))return;answerLocked=true;\n  try{await submitAnswer(!!r.correct);if(session&&session.status==='completed'){replaceCheck(langKo()?'완료':'Done',finish);return;}replaceCheck(langKo()?'계속':'Continue',showCurrent);}\n  catch(error){console.warn('[Daily Study] answer save',error);answerLocked=false;var check=root&&root.querySelector('.activity-check');if(check){check.disabled=false;check.textContent=langKo()?'저장 다시 시도':'Retry save';}}\n}\n"""
new = """var PENDING_PREFIX='willena-study-v2-daily-pending:v1:';\nvar pendingSync=null;\nfunction pendingKey(){return PENDING_PREFIX+(uid()||'anon')+':'+activeTrack()+':'+activeDate();}\nfunction loadPending(){try{var q=JSON.parse(localStorage.getItem(pendingKey())||'[]');return Array.isArray(q)?q:[];}catch(_){return[];}}\nfunction savePending(q){try{if(q&&q.length)localStorage.setItem(pendingKey(),JSON.stringify(q));else localStorage.removeItem(pendingKey());}catch(_){}}\nfunction queueAnswer(correct){var entry={daily_key:dailyKey(current),correct:!!correct,date:activeDate(),track:activeTrack(),ts:Date.now()};var q=loadPending();if(!q.some(function(x){return String(x.daily_key)===String(entry.daily_key);})){q.push(entry);savePending(q);}return entry;}\nfunction optimisticApply(entry){if(!session||!entry)return;if(!Array.isArray(session.resolved_keys))session.resolved_keys=[];if(session.resolved_keys.indexOf(entry.daily_key)<0)session.resolved_keys.push(entry.daily_key);session.cursor=Math.min(arr(session.plan).length,Math.max(Number(session.cursor)||0,session.resolved_keys.length));if(session.resolved_keys.length>=TARGET||session.cursor>=arr(session.plan).length)session.status='completed';paint();setHeader();}\nasync function flushPending(){if(pendingSync)return pendingSync;pendingSync=(async function(){var q=loadPending(),lastData=null;while(q.length){var item=q[0];try{var data=await request('POST',{action:'answer',daily_key:item.daily_key,correct:!!item.correct});if(!data||data.success===false)throw new Error(data&&data.error||'Daily answer was not saved.');lastData=data;q.shift();savePending(q);}catch(error){console.warn('[Daily Study] queued save will retry',error);break;}}if(!q.length&&lastData&&lastData.session){sessionFrom(lastData);if(IS_STAGING)renderTestPanel();}return q.length===0;})();try{return await pendingSync;}finally{pendingSync=null;}}\nasync function onAnswer(e){\n  if(!document.body.classList.contains('study-v2-daily-mode')||!current||answerLocked)return;\n  var d=e.detail||{},a=d.activity||{},r=d.result||{};if(String(a.id)!==String(current.id))return;answerLocked=true;\n  var entry=queueAnswer(!!r.correct);optimisticApply(entry);\n  if(session&&session.status==='completed')replaceCheck(langKo()?'완료':'Done',finish);else replaceCheck(langKo()?'계속':'Continue',showCurrent);\n  flushPending();\n}\n"""
if old not in s:
    raise SystemExit('answer block not found')
s = s.replace(old,new,1)
old2 = "async function ensureSession(){\n  var data=await request('GET');"
new2 = "async function ensureSession(){\n  await flushPending();\n  var data=await request('GET');"
if old2 not in s:
    raise SystemExit('ensureSession block not found')
s = s.replace(old2,new2,1)
marker = "global.WillenaStudyV2Daily="
if marker not in s:
    raise SystemExit('export marker not found')
s = s.replace(marker,"window.addEventListener('online',function(){flushPending();});window.addEventListener('focus',function(){flushPending();});setTimeout(function(){flushPending();},1200);\n"+marker,1)
p.write_text(s,encoding='utf-8')

idx=Path('students/study-v2/index.html')
h=idx.read_text(encoding='utf-8')
oldq='./v2-daily.js?v=20260817-cookieauth1'
newq='./v2-daily.js?v=20260817-optimisticqueue1'
if oldq not in h:
    raise SystemExit('cache key not found')
idx.write_text(h.replace(oldq,newq,1),encoding='utf-8')
