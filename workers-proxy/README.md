# workers-proxy

This folder contains a Cloudflare Worker proxy you can publish to `workers.dev` for testing.

Quick steps to publish (one-time setup):

1. Install Wrangler (if you don't have it):

```bash
npm install -g wrangler
wrangler login
```

2. Publish to a workers.dev preview name (example):

```bash
cd workers-proxy
wrangler publish --name willena-proxy-test
```

3. Test the proxy (example):

Open in browser or curl:

```
https://willena-proxy-test.YOUR_ACCOUNT.workers.dev/.netlify/functions/supabase_auth?action=whoami
```

Notes:
- The Worker forwards cookies and rewrites Set-Cookie Domain attributes so cookies are set for the worker origin.
- For same-origin cookie tests you will eventually want a custom domain (e.g., `dev.willenaenglish.com`) bound to the Worker.
- To change the API target, update `API_ORIGIN` at the top of `index.js`.
