# Cloudflare Workers Migration Plan

## Overview

**Goal:** Move high-invocation Netlify Functions to Cloudflare Workers to reduce costs, lower latency, and improve scaling.

**Target Functions:**
- `supabase_auth` — authentication (highest invocations)
- `log_word_attempt` — write-heavy, supports batching
- `homework_api` — CRUD + auth
- `progress_summary` — heavy aggregation, needs KV caching

---

## Migration Strategy (Build → Test → Gradual Rollout)

### Phase 1: Build All Workers on Cloudflare
Fully build out ALL workers on Cloudflare infrastructure. Keep main site on Netlify during development.

1. **Scaffold all 4 workers** in `cloudflare-workers/` directory
2. **Wire up to Cloudflare** using `wrangler.toml` configs
3. **Deploy to `*.workers.dev`** subdomains for testing
4. Site stays on Netlify — CF workers are standalone test endpoints

### Phase 2: Live Testing on Cloudflare URLs
Test each worker directly via Cloudflare URLs while production remains on Netlify.

- Use `test-cf-migration.html` to compare CF vs Netlify responses
- Verify cookie auth, CORS, and data integrity
- Test all edge cases (login flows, batch writes, leaderboard queries)
- Fix issues before touching production traffic

### Phase 3: Shadow Testing (Optional but Recommended)
Enable `CF_SHADOW_MODE = true` in `api-config.js`:
- Client sends requests to BOTH Netlify and CF
- Only Netlify response is used
- CF responses logged for parity comparison

### Phase 4: Gradual Traffic Shift
Start routing real traffic to Cloudflare Workers:

| Day | CF % | Netlify % | Notes |
|-----|------|-----------|-------|
| 1   | 20%  | 80%       | Monitor error rates |
| 2   | 40%  | 60%       | Check latency metrics |
| 3   | 60%  | 40%       | Validate leaderboard accuracy |
| 4   | 80%  | 20%       | Near-cutover validation |
| 5+  | 100% | 0%        | Full cutover |

### Phase 5: Cleanup
- Disable Netlify functions (keep code for 2 weeks as rollback)
- Remove shadow mode / feature flags
- Update documentation
- **Profit (or at least savings!)**

---

## Prerequisites

### Install Wrangler CLI
```powershell
npm install -g wrangler
wrangler login
```

### Cloudflare Setup
- Workers and KV enabled on account
- KV namespace created: `LEADERBOARD_CACHE`
- (Optional) Queue created: `ATTEMPTS_QUEUE`

### Environment Secrets
Store via `wrangler secret put` or Cloudflare Dashboard — **never commit to repo**:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_KEY` (service_role — protect carefully)

### Worker URLs (after deployment)
| Worker | URL |
|--------|-----|
| supabase-auth | `https://supabase-auth.willena.workers.dev` |
| log-word-attempt | `https://log-word-attempt.willena.workers.dev` |
| homework-api | `https://homework-api.willena.workers.dev` |
| progress-summary | `https://progress-summary.willena.workers.dev` |

---

## General Migration Patterns

All workers follow these patterns:

### Replace Node SDK with REST
Workers run on V8/Fetch (not Node.js). Replace `@supabase/supabase-js` with direct REST calls:

```javascript
// Instead of: supabase.from('table').select('*')
const resp = await fetch(`${env.SUPABASE_URL}/rest/v1/table?select=*`, {
  headers: {
    'apikey': env.SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json'
  }
});
```

### Auth Token Verification
Validate `sb_access` cookie by calling Supabase Auth API:

```javascript
// Parse cookie from request
const cookie = request.headers.get('Cookie') || '';
const match = /sb_access=([^;]+)/.exec(cookie);
const token = match ? decodeURIComponent(match[1]) : null;

// Verify with Supabase
const userResp = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
  headers: {
    'apikey': env.SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${token}`
  }
});
const user = await userResp.json();
```

### Replace Redis with KV
```javascript
// Write
await env.LEADERBOARD_CACHE.put('key', JSON.stringify(data), { expirationTtl: 600 });

// Read
const cached = await env.LEADERBOARD_CACHE.get('key', 'json');
```

### CORS Headers (consistent across all workers)
```javascript
const ALLOWED_ORIGINS = [
  'https://willenaenglish.com',
  'https://www.willenaenglish.com',
  'https://willenaenglish.netlify.app',
  'https://willenaenglish.github.io',
  'http://localhost:8888',
  'http://localhost:9000',
];

function getCorsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  };
}
```

---

## Worker Implementations

### Directory Structure
```
cloudflare-workers/
├── supabase-auth/
│   ├── src/index.js
│   ├── wrangler.toml
│   └── package.json
├── log-word-attempt/
│   ├── src/index.js
│   ├── wrangler.toml
│   └── package.json
├── homework-api/
│   ├── src/index.js
│   ├── wrangler.toml
│   └── package.json
├── progress-summary/
│   ├── src/index.js
│   ├── wrangler.toml
│   └── package.json
└── get-audio-urls/        # Already migrated ✅
    └── ...
```

---

## 1. `supabase-auth` Worker

**Priority:** Build first (other workers depend on auth)

### Endpoints to Implement
| Action | Method | Description |
|--------|--------|-------------|
| `login` | POST | Email/password → set cookies |
| `whoami` | GET | Validate token, return user |
| `get_profile_name` | GET | Return profile display name |
| `logout` | POST | Clear cookies |
| `cookie_echo` | GET | Debug: echo cookie presence |
| `debug` | GET | Health check |

### Key Implementation Details
- **Login:** POST to `${SUPABASE_URL}/auth/v1/token?grant_type=password`
- **Set cookies:** `Set-Cookie: sb_access=...; HttpOnly; Secure; SameSite=None; Path=/`
- **Whoami:** GET `${SUPABASE_URL}/auth/v1/user` with Bearer token
- **Profile:** GET `${SUPABASE_URL}/rest/v1/profiles?id=eq.{user_id}`

### wrangler.toml
```toml
name = "supabase-auth"
main = "src/index.js"
compatibility_date = "2024-01-01"

[dev]
port = 8787
```

---

## 2. `log-word-attempt` Worker

**Priority:** Build second (write-heavy, high value)

### Endpoints to Implement
| Action | Method | Description |
|--------|--------|-------------|
| `log` | POST | Single attempt insert |
| `attempts_batch` | POST | Batch insert (primary) |
| `end_session` | POST | Finalize session |
| `selftest` | GET | Health check |

### Key Implementation Details
- **Batch insert:** POST to `${SUPABASE_URL}/rest/v1/progress_attempts` with array body
- **Session upsert:** POST to `${SUPABASE_URL}/rest/v1/progress_sessions` with `Prefer: resolution=merge-duplicates`
- **KV invalidation:** Replace Redis `del()` with KV `put('invalidate_ts', Date.now())`

### Optional: Cloudflare Queue
For ultra-low latency, use a queue:
```javascript
// Producer (in Worker)
await env.ATTEMPTS_QUEUE.send({ type: 'batch', rows });
return new Response(JSON.stringify({ ok: true, queued: true }));

// Consumer (separate Worker or same with queue handler)
export default {
  async queue(batch, env) {
    const allRows = batch.messages.flatMap(m => m.body.rows);
    await insertToSupabase(env, allRows);
  }
}
```

### wrangler.toml
```toml
name = "log-word-attempt"
main = "src/index.js"
compatibility_date = "2024-01-01"

[[kv_namespaces]]
binding = "LEADERBOARD_CACHE"
id = "YOUR_KV_NAMESPACE_ID"

# Optional queue
# [[queues.producers]]
# binding = "ATTEMPTS_QUEUE"
# queue = "attempts-queue"
```

---

## 3. `homework-api` Worker

**Priority:** Build third (CRUD, depends on auth)

### Endpoints to Implement
| Action | Method | Description |
|--------|--------|-------------|
| `create_assignment` | POST | Teacher creates assignment |
| `create_run` | POST | Generate run token |
| `get_run_token` | GET | Student gets token for assignment |
| `list_assignments` | GET | List (teacher or student mode) |
| `end_assignment` | POST | Close assignment |
| `assignment_progress` | GET | Student progress on assignment |
| `delete_assignment` | DELETE | Remove assignment |

### Key Implementation Details
- **Auth check:** Extract `sb_access` cookie → verify → check profile role
- **Teacher-only:** Verify `role IN ('teacher', 'admin')` before mutations
- **Run tokens:** Store in `list_meta.run_tokens` JSONB column

### wrangler.toml
```toml
name = "homework-api"
main = "src/index.js"
compatibility_date = "2024-01-01"
```

---

## 4. `progress-summary` Worker

**Priority:** Build last (complex aggregation)

### Approach: Thin Worker + SQL RPC

The current function does heavy JS-side aggregation. Refactor to:
1. Create Supabase SQL RPC functions for leaderboard queries
2. Worker calls RPC and caches result in KV

### Endpoints to Implement
| Action | Method | Description |
|--------|--------|-------------|
| `leaderboard_stars` | GET | Global/class leaderboard |
| `my_progress` | GET | Current user stats |
| `recent_sessions` | GET | User's recent activity |

### SQL RPC Example (create in Supabase)
```sql
CREATE OR REPLACE FUNCTION get_leaderboard_stars(
  p_timeframe TEXT DEFAULT 'all',
  p_class TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50
)
RETURNS JSON AS $$
  -- Aggregation query here
$$ LANGUAGE sql STABLE;
```

### Worker Implementation
```javascript
// Check KV cache first
const cacheKey = `lb:${timeframe}:${classFilter || 'global'}`;
const cached = await env.LEADERBOARD_CACHE.get(cacheKey, 'json');
if (cached) return jsonResponse(cached);

// Call RPC
const resp = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/get_leaderboard_stars`, {
  method: 'POST',
  headers: { 'apikey': env.SUPABASE_SERVICE_KEY, ... },
  body: JSON.stringify({ p_timeframe: timeframe, p_class: classFilter })
});
const data = await resp.json();

// Cache for 10-15 minutes
await env.LEADERBOARD_CACHE.put(cacheKey, JSON.stringify(data), { expirationTtl: 600 });
return jsonResponse(data);
```

### wrangler.toml
```toml
name = "progress-summary"
main = "src/index.js"
compatibility_date = "2024-01-01"

[[kv_namespaces]]
binding = "LEADERBOARD_CACHE"
id = "YOUR_KV_NAMESPACE_ID"
```

---

## Client-Side Configuration (`api-config.js`)

Update `CF_MIGRATED_FUNCTIONS` as workers are deployed:

```javascript
const CF_MIGRATED_FUNCTIONS = {
  'get_audio_urls': 'https://get-audio-urls.willena.workers.dev',      // ✅ Done
  'supabase_auth':  'https://supabase-auth.willena.workers.dev',       // Phase 1
  'log_word_attempt': 'https://log-word-attempt.willena.workers.dev',  // Phase 1
  'homework_api':   'https://homework-api.willena.workers.dev',        // Phase 1
  'progress_summary': 'https://progress-summary.willena.workers.dev',  // Phase 1
};

// Rollout control
let CF_ROLLOUT_PERCENT = 0;   // Start at 0%, increase as testing passes
let CF_SHADOW_MODE = true;    // Enable shadow testing first
```

---

## Deployment Commands

### Per-Worker Setup
```powershell
cd cloudflare-workers/supabase-auth
npm init -y
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_ANON_KEY
wrangler secret put SUPABASE_SERVICE_KEY
```

### Local Development
```powershell
wrangler dev --local
```

### Deploy to Cloudflare
```powershell
wrangler deploy
```

### Monitor Logs
```powershell
wrangler tail --name supabase-auth
```

### Create KV Namespace
```powershell
wrangler kv:namespace create LEADERBOARD_CACHE
# Copy the ID to wrangler.toml
```

---

## Testing Checklist

### Phase 2 Testing (CF URLs directly)
- [ ] `supabase-auth`: Login sets cookies correctly
- [ ] `supabase-auth`: Whoami returns user with valid token
- [ ] `supabase-auth`: Logout clears cookies
- [ ] `log-word-attempt`: Single insert works
- [ ] `log-word-attempt`: Batch insert works
- [ ] `log-word-attempt`: KV invalidation triggers
- [ ] `homework-api`: Teacher can create assignment
- [ ] `homework-api`: Student can list assignments
- [ ] `homework-api`: Run token generation works
- [ ] `progress-summary`: Leaderboard returns correct data
- [ ] `progress-summary`: KV caching works
- [ ] `progress-summary`: Results match Netlify version

### Phase 3 Testing (Shadow Mode)
- [ ] Enable `CF_SHADOW_MODE = true`
- [ ] Monitor console for parity issues
- [ ] No errors in shadow requests
- [ ] Response times are acceptable

### Phase 4 Testing (Gradual Rollout)
- [ ] 20% rollout: No spike in errors
- [ ] 40% rollout: Latency acceptable
- [ ] 60% rollout: All features working
- [ ] 80% rollout: Ready for full cutover
- [ ] 100% rollout: Profit!

---

## Rollback Plan

If issues arise at any phase:

1. **Immediate:** Set `CF_ROLLOUT_PERCENT = 0` in `api-config.js`
2. **Deploy:** Push the change — traffic returns to Netlify instantly
3. **Investigate:** Check `wrangler tail` logs and CF Analytics
4. **Fix:** Resolve issue, redeploy worker
5. **Resume:** Gradually increase rollout % again

Keep Netlify functions deployed for at least 2 weeks after full cutover.

---

## Cost & Monitoring

### Cloudflare
- **Free tier:** 100,000 requests/day
- Monitor in CF Dashboard → Workers → Analytics

### Expected Savings
- Netlify Functions: ~$X/month (based on current invocations)
- Cloudflare Workers: ~$0-5/month (likely within free tier)

---

## Security Reminders

- ⚠️ **Never commit service keys** — use `wrangler secret`
- ⚠️ **Use HttpOnly + Secure cookies** for auth tokens
- ⚠️ **Set SameSite=None** for cross-origin cookie auth
- ⚠️ **Validate tokens server-side** — never trust client

---

## Resources

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Supabase REST API](https://supabase.com/docs/guides/api)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/)
- Existing example: `cloudflare-workers/get-audio-urls/`
- Test page: `test-cf-migration.html`
