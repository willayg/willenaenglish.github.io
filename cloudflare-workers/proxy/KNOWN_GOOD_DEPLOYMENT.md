# Known-good production proxy deployment

- Cloudflare deployment ID: `f63724db-8489-4077-bb89-45891b1a0bd5`
- Confirmed working: 2026-08-06 (KST)
- Teacher login: working
- Student login: working
- Admin app auth: working

## Critical rollback rule

Do not route `supabase_auth` through the Cloudflare `SUPABASE_AUTH` service binding until that path has been tested separately on staging and verified to preserve the production login session.

The repository rollback commit `9fcd31b67d5a09fb58a7e45f822a910fec9dbf24` disables the Cloudflare auth-worker route so `supabase_auth` falls back to the previous Netlify backend.

Before deploying the proxy again:

1. Confirm the active Cloudflare production deployment is still `f63724db-8489-4077-bb89-45891b1a0bd5` or another explicitly verified version.
2. Test teacher login on `teachers.willenaenglish.com`.
3. Test student login and homework on `students.willenaenglish.com`.
4. Test the admin app.
5. Do not deploy during homework hours without a rollback ready.
