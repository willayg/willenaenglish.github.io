# willenaenglish.github.io
 
Quick function health checks (when running on Netlify):
- Logger env: `/.netlify/functions/log_word_attempt?env=1`
- Logger self-test insert: `/.netlify/functions/log_word_attempt?selftest=1`
- Progress summary (requires auth cookie): `/.netlify/functions/progress_summary?section=kpi`