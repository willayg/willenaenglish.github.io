# Willena Live Classroom Presence — P1

**Status: prepared on a feature branch; not deployed or connected to any student app.**

Dedicated Cloudflare Worker with one SQLite-backed Durable Object; isolated from the production `willena-proxy`, authentication, Word Genius and homework APIs.

## API

- `GET /health` — no personal data; public readiness check.
- `POST /v1/heartbeat` — authenticated, approved **student** only, accepted Origin must be a Willena app domain.
- `POST /v1/disconnect` (or DELETE) — authenticated student deletes only their own session.
- `GET /v1/presence` — authenticated, approved **teacher/admin** only. Returns all live sessions; P2 will add class grouping and an interface.

The service uses the access token from the `sb_access` cookie or `Authorization: Bearer`. It verifies the token using Supabase Auth and resolves the authoritative role, name and class server-side using the profiles table. IDs/class/role in the request body are never trusted. Both `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_KEY` are deployed as secrets; **do not commit them**.

### Heartbeat example

```http
POST /v1/heartbeat
Origin: https://students.willenaenglish.com
Content-Type: application/json
Cookie: sb_access=...
```

```json
{
  "session_id": "9d95f95e-eed3-4a34-bb44-7cc1ea19f1d0",
  "app": "word",
  "book": "Oxford Buzz 3",
  "unit": "Unit 1",
  "activity": "Quiz",
  "assignment_id": null,
  "assignment_match": false,
  "entered_via_homework": false,
  "last_interaction_age_ms": 1200
}
```

`session_id` should be a random UUID generated per browser tab (persist via `sessionStorage`) and should remain stable when moving between student apps in that tab. The `assignment_match` field is a UI hint, not authoritative proof of homework credit. P3 will provide app-specific activity adapters.

## Lifecycle

- Client heartbeat: every **30 seconds** while app tab is visible (P3).
- Session expiry: **90 seconds** after latest heartbeat; automatic pruning on Durable Object requests.
- Active/idle: **60 seconds** since last meaningful interaction. Client age + heartbeat elapsed time determines status; not used for authentication or grading.
- Multiple tabs/device sessions are separate records, so teachers can eventually identify concurrent sessions.
- No answer history, passwords, full access tokens, or sensitive student input is stored in presence.
- No Supabase writes; there **are** Auth verification and profile lookup reads per heartbeat. Measure these before wide rollout; add short-lived edge verification caching if necessary. The presence *data* itself lives in Cloudflare Durable Object storage.

## Deployment (manual, intentionally not automatic)

From the repository root:

```sh
cd cloudflare-workers/live-presence
npx wrangler secret put SUPABASE_ANON_KEY
npx wrangler secret put SUPABASE_SERVICE_KEY
npx wrangler deploy
```

Requires a Cloudflare account with SQLite-backed Durable Objects enabled. The first deployment applies the `v1-presence-sqlite` migration. Worker runs on its own `workers.dev` URL; do **not** bind to `api.willenaenglish.com` yet.

**Critical:** The existing dashboard does not call this Worker yet. For P2, bind it through the existing API gateway or a same-site hostname after review so browser cookies are available. Production CORS origins are intentionally restricted.

## Smoke checks after deploying

1. `GET /health` responds `ok:true`.
2. Student POST without credentials is rejected with 401; with teacher credentials is rejected with 403.
3. Teacher GET `/v1/presence` succeeds; student GET is rejected with 403.
4. Valid heartbeat then teacher read yields one session with correct authoritative identity/class.
5. Second tab produces a second session; disconnecting one preserves the other.
6. Presence disappears after 90 seconds without a heartbeat.
7. Cross-origin unapproved site cannot POST or read sessions.
8. Measure request count and Supabase Auth/profile reads with 10/50/150 simultaneous users before connecting all student apps.

## P1 scope

No UI, app instrumentation, auto homework credit, logouts or identity pop-ups in P1. Those are separate passes. No deployment pipeline was added, so pushing this branch cannot automatically deploy the Worker.
