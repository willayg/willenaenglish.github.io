Cloudflare Worker — API proxy (Set-Cookie domain rewrite)

This worker proxies requests to your backend (Netlify functions or existing worker endpoints), rewrites Set-Cookie headers so cookies use `Domain=.willenaenglish.com`, and sets CORS headers suitable for credentialed cross-origin requests.

Quick deploy steps:
- Test on workers.dev using the Cloudflare dashboard or `wrangler`.
- Configure `BACKEND_BASE` to `https://willenaenglish.netlify.app` (or your backend) in `wrangler.toml` or Cloudflare dashboard variables.
- Deploy and test the workers.dev URL. Example test request:
  - `curl -i "https://<your-worker>.workers.dev/.netlify/functions/progress_summary?section=overview" -H "Origin: https://willenaenglish-github-io.pages.dev"`

When ready to go live:
- Add the `willenaenglish.com` zone to Cloudflare (or delegate the `api` subdomain).
- Copy all DNS records from your current DNS provider into Cloudflare before switching nameservers.
- Add a Worker route `api.willenaenglish.com/*` and bind this Worker to it.
- Ensure the `api` DNS record is proxied (orange cloud) so Cloudflare terminates TLS.

Verification checklist:
- `Set-Cookie` headers include `Domain=.willenaenglish.com; Secure; SameSite=None` when responses set cookies.
- Responses include `Access-Control-Allow-Credentials: true` and an appropriate `Access-Control-Allow-Origin`.

Notes:
- Only rewrite cookies if you control the backend; avoid rewriting cookies from untrusted upstreams.
- Prefer setting sensitive tokens as HttpOnly cookies when possible.
