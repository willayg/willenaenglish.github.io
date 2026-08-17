from pathlib import Path
p=Path('students/study-v2/v2-daily.js')
s=p.read_text(encoding='utf-8')
old="function optimisticApply(entry){if(!session||!entry)return;if(!Array.isArray(session.resolved_keys))session.resolved_keys=[];if(session.resolved_keys.indexOf(entry.daily_key)<0)session.resolved_keys.push(entry.daily_key);session.cursor=Math.min(arr(session.plan).length,Math.max(Number(session.cursor)||0,session.resolved_keys.length));if(session.resolved_keys.length>=TARGET||session.cursor>=arr(session.plan).length)session.status='completed';paint();setHeader();}"
new="function optimisticApply(entry){if(!session||!entry)return;if(!Array.isArray(session.resolved_keys))session.resolved_keys=[];if(entry.correct&&session.resolved_keys.indexOf(entry.daily_key)<0)session.resolved_keys.push(entry.daily_key);session.cursor=Math.min(arr(session.plan).length,(Number(session.cursor)||0)+1);if(session.resolved_keys.length>=TARGET)session.status='completed';paint();setHeader();}"
if old not in s: raise SystemExit('optimisticApply block not found')
p.write_text(s.replace(old,new,1),encoding='utf-8')
idx=Path('students/study-v2/index.html')
h=idx.read_text(encoding='utf-8')
oldq='./v2-daily.js?v=20260817-optimisticqueue1'
newq='./v2-daily.js?v=20260817-optimisticqueue2'
if oldq not in h: raise SystemExit('optimistic queue cache key not found')
idx.write_text(h.replace(oldq,newq,1),encoding='utf-8')
