# Cloudflare Workers Migration Plan

Purpose
- Move high-invocation Netlify Functions to Cloudflare Workers (or Supabase Edge where appropriate) to reduce costs, lower latency, and improve scaling.
- Target functions: `supabase_auth`, `homework_api`, `progress_summary`, `log_word_attempt`.

Scope & Prioritization
1. `supabase_auth` — high invocations, medium complexity. Migrate first.
2. `log_word_attempt` — write-heavy; use batching & optional Cloudflare Queues; migrate second.
3. `homework_api` — CRUD + auth; migrate third.
4. `progress_summary` — heavy aggregation; refactor to SQL RPC or Supabase Edge Functions and use KV caching; migrate last.

Prerequisites
- Install Wrangler CLI locally:

```powershell
npm install -g wrangler
wrangler login
```

- Cloudflare account with Workers and KV/Queues enabled
- Obtain and securely store environment variables in Cloudflare dashboard or `wrangler secret`:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY` (or `SUPABASE_ANON`)
  - `SUPABASE_SERVICE_KEY` (service_role key) — protect carefully
  - Any other app-specific keys

- Decide binding names / resources (examples used below):
  - KV namespace: `LEADERBOARD_CACHE`
  - Queue: `ATTEMPTS_QUEUE`
  - Worker routes: `supabase-auth`, `log-word-attempt`, `homework-api`, `progress-summary` (or subdomain per worker)

General migration patterns (applies to all workers)
- Replace `@supabase/supabase-js` Node SDK with direct REST `fetch()` calls to Supabase endpoints (Workers run on V8/Fetch).
- Use `Authorization: Bearer <SERVICE_KEY>` for server-to-server calls when required (service role). Also set `apikey` header to same key when calling Supabase REST.
- For auth cookie verification, call `GET ${SUPABASE_URL}/auth/v1/user` or `auth/v1/token` endpoints with the token from `sb_access` cookie.
- Replace Redis cache with Cloudflare KV (or Cache API for in-memory edge caching). Where invalidation storms are a concern, use short TTLs or KV 'dirty' flags.
- For heavy/long-running aggregation: push computation to Supabase via SQL functions / RPC, or use Supabase Edge Functions (Deno) if close DB integration is preferable.
- Use Cloudflare Workers Cache API (caches.default) for public GET responses when safe.

Per-function plans

---

## 1) `supabase_auth` (migrate first)
Why: highest invocation count and other endpoints depend on auth working.

What to change
- Replace `@supabase/supabase-js` usage for `auth.getUser()` and token exchange with REST calls.
- Keep cookie-based auth logic; parse cookies from request headers and call Supabase `auth` endpoints.

Bindings & env
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY` (set via Cloudflare Dashboard or `wrangler secret`)

Wrangler example (`wrangler.toml` snippet)
```toml
name = "supabase-auth"
main = "src/index.js"
compatibility_date = "2024-01-01"

[env.production]
# secrets stored in Cloudflare dashboard
```

Implementation notes
- For `login` (POST): use Supabase `POST ${SUPABASE_URL}/auth/v1/token?grant_type=password` with `apikey` header = anon key. On success, set `Set-Cookie` headers
  using `HttpOnly; Secure; SameSite=None` in production.
- For `whoami` / `get_profile_name`: read `sb_access` cookie, call `GET ${SUPABASE_URL}/auth/v1/user` with `Authorization: Bearer <token>` to validate, then fetch profile from `rest/v1/profiles` if needed.
- Ensure CORS headers and `Access-Control-Allow-Credentials: true` are present.

Testing
- `wrangler dev` with `--local` dev bindings or `wrangler secret` to load tokens.
- Test login flow, cookie set semantics, `whoami`, and `get_profile_name` endpoints.

Rollout
- Shadow traffic first (client-side shadow requests)
- Use a rollout percent switch in `js/api-config.js` (same pattern as `get-audio-urls`)

Rollback
- Repoint client config to Netlify function URL (keep Netlify function in place as fallback)

---

## 2) `log_word_attempt` (migrate second)
Why: high invocation, write-heavy. Already supports batch insertion — good candidate for Workers + optional Queue.

Options
A) Worker direct: Worker receives attempts (batch or single), calls Supabase REST to `progress_attempts` and `progress_sessions`.
B) Worker + Cloudflare Queue: Worker enqueues attempt(s) and returns fast 200; a queue consumer (another Worker) batch-inserts into Supabase. This reduces latency and smooths DB load.

Choose B if you expect spikes or want low client latency.

Bindings & env
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
- KV namespace: `LEADERBOARD_CACHE` (replace Redis invalidation)
- Optional: `ATTEMPTS_QUEUE` (Cloudflare Queue binding)

Key changes
- Replace `redisCache` invalidation calls with KV operations. For example, set a 'invalidate_ts' key in `LEADERBOARD_CACHE` instead of deleting multiple keys.
- Replace Supabase SDK insert/upsert with REST POST to `/rest/v1/progress_attempts` and `/rest/v1/progress_sessions`.
- Maintain `attempts_batch` to reduce invocations — client should be left unchanged.
- Keep `SKIP_POINTS_TOTAL_CALC` option; if on, worker returns after insert without calculating totals.

Queue producer pattern (in Worker)
```javascript
// Producer
await env.ATTEMPTS_QUEUE.send({ type: 'attempts_batch', rows });
return new Response(JSON.stringify({ ok: true }), { status: 200 });
```

Queue consumer pattern (Worker with queue binding)
```javascript
export default {
  async queue(batch, env) {
    const allRows = batch.messages.flatMap(m => m.body.rows);
    // Batch insert to Supabase REST
    await fetch(`${env.SUPABASE_URL}/rest/v1/progress_attempts`, { method: 'POST', headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }, body: JSON.stringify(allRows) });
    await batch.finish();
  }
}
```

Cache invalidation replacement
- Original: `redisCache.del('lb:global:all')` … etc.
- Worker: `await env.LEADERBOARD_CACHE.put('invalidate_ts', Date.now().toString());`
- When reading leaderboard, check `invalidate_ts` and refresh if stale.

Testing
- Unit test insert via `wrangler dev` and verify rows in Supabase
- If using Queue: test that messages are delivered and consumer writes rows

Rollout
- Start with batch API only (client unchanged) and monitor error rates
- If stable, switch to queue producer for lower latency

---

## 3) `homework_api` (migrate third)
Why: multi-action endpoint but mainly CRUD — straightforward once auth works.

What to change
- Switch to REST calls for Supabase operations
- Keep cookie auth: validate with `GET ${SUPABASE_URL}/auth/v1/user` or perform server-to-server checks when needed

Important endpoints
- `create_assignment` (POST → `rest/v1/homework_assignments`)
- `create_run` / `get_run_token` (persist run tokens in `list_meta` JSON column)
- `list_assignments` (GET to `rest/v1/homework_assignments`)
- `assignment_progress` — may require complex queries; keep logic but use REST or RPC

Testing
- Test all modes: teacher (create, end), student (list)
- Verify cookies, role checks, and expected errors

Rollout & Rollback
- Shadow first, then percentage rollout
- Rollback by switching client to Netlify endpoint

---

## 4) `progress_summary` (migrate last — refactor first)
Why: heavy aggregation and DB work. Best approach is to push computation into database or Supabase Edge.

Options
A) Keep on Netlify, but optimize:
  - Move per-user heavy loops into a Supabase RPC (SQL) stored procedure and call it.
  - Use Redis → KV replacement for caching.
B) Migrate to Supabase Edge Function (Deno) for faster DB access & fewer workarounds.
C) Migrate to Worker, but ensure aggregation is done via single RPC call — Worker acts as thin wrapper plus KV caching.

Recommendation
- Implement SQL RPCs in Supabase that return leaderboard/top entries and per-user stats. This reduces multiple paginated reads.
- Use Cloudflare KV (`LEADERBOARD_CACHE`) to cache RPC results for `GLOBAL_CACHE_TTL_SECONDS`.
- If you need extreme performance / closer DB integration, implement as Supabase Edge Function.

Worker wrapper example
```javascript
// Cloudflare Worker fetches cached value from KV, otherwise calls SUPABASE RPC and caches result
const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_leaderboard`, { method: 'POST', headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ timeframe: 'month' }) });
const data = await resp.json();
await env.LEADERBOARD_CACHE.put(cacheKey, JSON.stringify(data), { expirationTtl: 600 });
return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
```

Testing & Validation
- Compare results between Netlify implementation and new RPC output until identical
- Add parity tests (small dataset) and validate with `test-cf-migration.html` approach

Rollout
- Shadow RPC responses by calling both Netlify & CF but only returning Netlify to clients initially
- After parity, gradually route traffic to Worker or Edge Function

---

Deployment checklist (per worker)
- [ ] Add `wrangler.toml` with correct `main`, `name`, compatibility_date
- [ ] Add env secrets via `wrangler secret put` or Cloudflare Dashboard
- [ ] Bind KV namespace(s) and Queues in `wrangler.toml`
- [ ] Implement `src/index.js` with CORS, cookie parsing, and Supabase REST wrappers
- [ ] Local test: `wrangler dev` and `wrangler tail`
- [ ] Shadow testing: client sends shadow requests
- [ ] Gradual rollout: update `js/api-config.js` to switch endpoints by percent
- [ ] Monitor Cloudflare Analytics and Supabase logs
- [ ] Disable Netlify function after stable period and remove client feature flags

Testing commands
```powershell
# Run worker locally
wrangler dev --local

# Tail logs in production
npx wrangler tail --name <worker-name>
```

Monitoring & Cost
- Cloudflare has high free quota (100k/day); monitor usage (Workers & Queues) in CF dashboard
- Supabase: monitor DB CPU / row operations — moved queries (RPC) should reduce row counts

Rollback plan
- Keep Netlify functions deployed for at least 2 weeks after cutover
- Re-enable client config to point to Netlify function if errors spike

Security notes
- Never commit service role keys to repo. Use `wrangler secret` or Cloudflare UI to store service keys.
- Use `sb_access` cookie and server-side verification for all authenticated actions.
- Use `Content-Security-Policy` and secure cookie flags for production domains.

Next steps (recommended immediate action)
1. Migrate `supabase_auth` first (scaffold Worker). Verify login, cookie set, and `whoami`.
2. Migrate `log_word_attempt` using Queue producer + consumer. Keep batch API working.
3. Migrate `homework_api` (CRUD) once auth & writes are validated.
4. Refactor `progress_summary` into SQL RPC and provide a thin Worker wrapper or Supabase Edge Function.

Contact & Notes
- See `cloudflare-workers/get-audio-urls` for a working example of a worker, `wrangler.toml`, and rollout steps.
- Use `test-cf-migration.html` pattern to validate parity between Netlify and CF during shadow tests.


---

File created: `cloudflare-workers/MIGRATION_PLAN.md`
