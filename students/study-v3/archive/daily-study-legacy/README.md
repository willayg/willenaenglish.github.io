# Legacy Daily Study archive

The pre-rebuild Daily Study implementation was retired on 2026-08-15.

It is preserved in Git history rather than loaded by the app.

Primary legacy file before replacement:
- `students/study-v2/v2-daily.js`
- blob SHA: `737cb28aaaa857b6fda18ece3db56034e24ef644`
- later transitional blob before the clean rebuild: `see staging history immediately before the Daily Study V2 rebuild`

Previously-added Daily sync/ownership files were already removed before this rebuild:
- `students/study-v2/v2-daily-sync.js`
- `students/study-v2/v2-daily-ownership.js`

The discarded experimental Daily state worker was also removed before this rebuild.

Do not restore these implementations into the active Study V2 app. The active Daily Study must use the server-owned Daily Study V2 session model.
