Cloudflare branch — setup & checklist

Purpose
-------
Create a dedicated `cloudflare` branch where you can: add Cloudflare-specific routing, test Workers changes, and prepare DNS/route changes without affecting `main`.

Quick plan (PowerShell commands you can run locally)
---------------------------------------------------
Open PowerShell in the repo root and run:

```powershell
# 1. Fetch latest and create branch from main
git checkout main
git pull origin main
git checkout -b cloudflare

# 2. Push the new branch to origin
git push -u origin cloudflare
```

If you want to start from a tag or another branch, change the first `checkout` accordingly.

What to put into the `cloudflare` branch (recommended)
-----------------------------------------------------
- Any Cloudflare-specific routing or config (keep changes isolated):
  - `wrangler.toml` (if you're deploying from this repo) or a `wrangler` folder with worker code.
  - `netlify.toml` changes should be done carefully — keep separate commits so you can revert.
  - A `cloudflare/` README with steps to publish worker (wrangler commands, required secrets).
- Feature toggles in `js/api-config.js` (only in this branch set `CF_ROLLOUT_PERCENT_BY_FN` or other flags to enable workers).
  - Do NOT merge rollout=100 to `main` unless you have confirmed production routing and cookie rules.

Safe testing checklist (before changing DNS or production rollout)
----------------------------------------------------------------
1. Keep branch isolated: test frontend changes on GH Pages or a preview deploy (do not change production yet).
2. Use the Netlify proxy approach for live testing (we added a proxy function) so cookies are preserved.
3. If planning to test same-origin via Cloudflare, prefer a delegated subdomain (e.g., `worker.willena....`) first.
4. Lower TTLs on DNS if you're planning full domain moves and schedule a quiet window.

How to test the worker from this branch
--------------------------------------
- Local dev (wrangler):
  1. Run `npx wrangler dev` in the worker folder (it serves on a local port, usually 8787-8790).
  2. Run `netlify dev` in root (will serve pages at `http://localhost:9000`) and keep the dev redirect in `netlify.toml` to forward `progress_summary` to your `wrangler` port if needed.

- Live test (safe):
  - Push `cloudflare` branch and deploy to a preview environment (Netlify/GitHub Pages preview). Use shadow mode or the Netlify proxy for low-risk testing.

Deployment hints for Cloudflare (if you choose to publish from this branch)
-----------------------------------------------------------------------
- Keep `wrangler.toml` but DO NOT commit production secrets. Use environment variables in CI or `wrangler config` locally.
- Example publish command (local):
  ```powershell
  cd cloudflare-workers/progress-summary
  npx wrangler publish
  ```
- If you want a CI deploy, add a GitHub Actions workflow that runs `wrangler publish` on merge to `cloudflare` and use GitHub secrets for the account token.

Rollback & safety
-----------------
- Keep all CF-specific changes in a single PR so they are easy to revert.
- If DNS changes are required later, do them only after the worker route is validated on a subdomain.

Notes / reminders
-----------------
- Don't enable rollout=100 on `main` while the site still depends on cookie-only auth and the worker runs on a different origin.
- Use the Netlify proxy for production testing without DNS changes.

If you want, I can:
- Make the `cloudflare` branch locally and push it (I can't run git for you here; I can create branch-specific files and a PR patch in the repo that you can commit on that branch), or
- Create a PR template and a GitHub Actions workflow skeleton in the `cloudflare` branch after you create it.

Tell me which of the next actions you want me to take:
- Create a branch-specific PR skeleton (files + workflow) in a commit so you can `git checkout -b cloudflare && git pull` and have the files ready.
- Just give you the commands and wait while you create the branch locally.
