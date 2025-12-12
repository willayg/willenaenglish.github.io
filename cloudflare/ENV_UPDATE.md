Updating environment variables for Cloudflare deploy

This document explains what environment variables/secrets you must set when testing/publishing Cloudflare workers from the `cloudflare` branch. Do NOT commit secret values to the repo.

1) Cloudflare (wrangler) secrets
- Use `wrangler secret put` to store secrets locally for publishing. Example:

  # from the repo root, in the worker folder
  cd cloudflare-workers/progress-summary
  npx wrangler secret put SUPABASE_URL
  # paste the SUPABASE_URL value when prompted
  npx wrangler secret put SUPABASE_SERVICE_KEY
  npx wrangler secret put SUPABASE_ANON_KEY

- Alternatively, for CI (GitHub Actions) add these values to the repository Secrets (Settings → Secrets → Actions) as `CF_API_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, etc.

2) GitHub Actions (if you use the example workflow)
- Copy `cloudflare/publish-action-example.yml` to `.github/workflows/publish-cloudflare.yml` and add these repo secrets:
  - `CF_API_TOKEN` — Cloudflare API token with Workers permissions
  - `SUPABASE_URL` — supabase project URL
  - `SUPABASE_SERVICE_KEY` — service key if needed by the worker
  - `SUPABASE_ANON_KEY` — public anon key (only if used by client-side code)

3) Netlify environment (if proxying or deploying changes to Netlify)
- If you rely on Netlify functions or proxies, confirm the Netlify site has the proper env vars in Site Settings → Build & deploy → Environment.
- Do NOT copy Cloudflare secrets to Netlify unless required; prefer using the proxy function which keeps cookies intact.

4) Testing locally with wrangler dev
- To run a worker locally and provide env vars to `wrangler dev`:
  - `npx wrangler dev --env development` and set secrets with `wrangler secret put` in that folder.

5) Security notes
- Never commit service keys or API tokens to the repository.
- Use GitHub Secrets for CI and `wrangler secret put` for local publishing.

If you want, paste the names of the exact env vars you need to set (or the `.env` file you use locally) and I will produce the exact `wrangler secret put` and GitHub Secrets names/values you should create (I won't store any secret values in the repo).