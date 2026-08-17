from pathlib import Path

p=Path('students/study-v2/v2-daily.js')
s=p.read_text(encoding='utf-8')
old="""async function onAnswer(e){
  if(!document.body.classList.contains('study-v2-daily-mode')||!current||answerLocked)return;
  var d=e.detail||{},a=d.activity||{},r=d.result||{};if(String(a.id)!==String(current.id))return;answerLocked=true;
  var entry=queueAnswer(!!r.correct);optimisticApply(entry);
  if(session&&session.status==='completed')replaceCheck(langKo()?'완료':'Done',finish);else replaceCheck(langKo()?'계속':'Continue',showCurrent);
  flushPending();
}
"""
new="""async function onAnswer(e){
  if(!document.body.classList.contains('study-v2-daily-mode')||!current||answerLocked)return;
  var d=e.detail||{},a=d.activity||{},r=d.result||{};if(String(a.id)!==String(current.id))return;answerLocked=true;
  var willComplete=!!r.correct&&(resolvedCount()+1)>=TARGET;
  replaceCheck(willComplete?(langKo()?'완료':'Done'):(langKo()?'계속':'Continue'),willComplete?finish:showCurrent);
  var entry=queueAnswer(!!r.correct);optimisticApply(entry);
  flushPending();
}
"""
if old not in s: raise SystemExit('onAnswer block not found')
s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')
idx=Path('students/study-v2/index.html')
h=idx.read_text(encoding='utf-8')
oldq='./v2-daily.js?v=20260817-optimisticqueue2'
newq='./v2-daily.js?v=20260818-immediatenext1'
if oldq not in h: raise SystemExit('cache key not found')
idx.write_text(h.replace(oldq,newq,1),encoding='utf-8')
