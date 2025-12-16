# Cloudflare Workers Deployment Guide

This guide explains how to deploy the Cloudflare Workers to replace Netlify functions.

## Architecture

```
Browser (cf.willenaenglish.com)
    │
    ▼
api.willenaenglish.com (willena-proxy worker)
    │
    ├──► CF Worker: supabase-auth
    ├──► CF Worker: homework-api  
    ├──► CF Worker: log-word-attempt
    ├──► CF Worker: progress-summary
    ├──► CF Worker: get-audio-urls
    │
    └──► Netlify (fallback for non-migrated functions)
```

## Prerequisites

1. **Cloudflare Account** with your domain (`willenaenglish.com`) added
2. **Wrangler CLI** installed: `npm install -g wrangler`
3. **Logged in**: `wrangler login`

## Step 1: Deploy Individual Workers

Deploy each worker in order. Run these commands from the repo root:

```bash
# 1. Deploy supabase-auth
cd cloudflare-workers/supabase-auth
wrangler deploy

# 2. Deploy homework-api
cd ../homework-api
wrangler deploy

# 3. Deploy log-word-attempt
cd ../log-word-attempt
wrangler deploy

# 4. Deploy progress-summary
cd ../progress-summary
wrangler deploy

# 5. Deploy get-audio-urls
cd ../get-audio-urls
wrangler deploy
```

## Step 2: Set Environment Variables

For each worker, set the required secrets in Cloudflare Dashboard:

**Go to:** Cloudflare Dashboard → Workers & Pages → [Worker Name] → Settings → Variables

### supabase-auth, homework-api, log-word-attempt, progress-summary
| Variable | Type | Description |
|----------|------|-------------|
| `SUPABASE_URL` | Plain text | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Plain text | Supabase anon/public key |
| `SUPABASE_SERVICE_KEY` | **Secret** | Supabase service role key |

### get-audio-urls
| Variable | Type | Description |
|----------|------|-------------|
| `R2_PUBLIC_BASE` | Plain text | Public URL for R2 bucket (if not using R2 binding) |

**Or use wrangler CLI:**
```bash
cd cloudflare-workers/supabase-auth
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_ANON_KEY
wrangler secret put SUPABASE_SERVICE_KEY
```

## Step 3: Deploy the API Gateway (Proxy)

The proxy worker needs service bindings to call the other workers:

```bash
cd cloudflare-workers/proxy
wrangler deploy
```

**Note:** Service bindings will automatically connect to workers in the same account.

## Step 4: Configure Custom Domain

Route `api.willenaenglish.com` to the proxy worker:

1. Go to Cloudflare Dashboard → Workers & Pages → willena-proxy
2. Click "Triggers" tab
3. Click "Add Custom Domain"
4. Enter: `api.willenaenglish.com`
5. Click "Add Custom Domain"

Cloudflare will automatically configure the DNS.

## Step 5: Verify Deployment

Test that CF Workers are being used:

```bash
# Should return "runtime": "cloudflare-workers"
curl "https://api.willenaenglish.com/.netlify/functions/supabase_auth?action=debug"

# Test login (replace with real credentials)
curl -X POST "https://api.willenaenglish.com/.netlify/functions/supabase_auth?action=login" \
  -H "Content-Type: application/json" \
  -H "Origin: https://cf.willenaenglish.com" \
  -d '{"email":"test@example.com","password":"test123"}'
```

## Rollback to Netlify

If something goes wrong, you can disable CF routing:

### Option 1: Remove Custom Domain
1. Go to willena-proxy worker → Triggers
2. Remove the `api.willenaenglish.com` custom domain
3. Traffic will fall back to whatever `api.willenaenglish.com` was pointing to before

### Option 2: Modify Proxy to Route to Netlify
Edit `cloudflare-workers/proxy/src/index.js`:
```javascript
// Set all to false to route everything to Netlify
const PREFER_CF_WORKER = {
  supabase_auth: false,
  homework_api: false,
  // ...
};
```
Then redeploy: `wrangler deploy`

## Debugging

### View Logs
```bash
# Tail logs for a specific worker
wrangler tail supabase-auth
wrangler tail willena-proxy
```

### Check Service Bindings
The proxy logs will show whether it's using CF Workers or Netlify fallback:
- `[proxy] Routing supabase_auth to CF Worker` = Using Cloudflare
- `[proxy] No binding for ..., falling back to Netlify` = Using Netlify

## File Structure

```
cloudflare-workers/
├── proxy/                 # API Gateway (api.willenaenglish.com)
│   ├── src/index.js      # Routes to other workers or Netlify
│   └── wrangler.toml     # Service bindings config
├── supabase-auth/         # Auth functions
├── homework-api/          # Homework CRUD
├── log-word-attempt/      # Learning progress logging
├── progress-summary/      # Leaderboards & stats
└── get-audio-urls/        # Audio file URLs from R2
```

## Cookie Handling

All cookies are rewritten by the proxy to use:
- `Domain=.willenaenglish.com` (shared across subdomains)
- `SameSite=None` (required for cross-origin)
- `Secure` (required for SameSite=None)

This allows `cf.willenaenglish.com` to share auth cookies with `api.willenaenglish.com`.
