# Leaderboard Page Concepts

This document compares two practical approaches for serving fast, accurate leaderboards that support "All Time" and "This Month" filters (and historical months). It describes tradeoffs, schema suggestions, refresh strategies, example queries, and recommended next steps.

---

## Goals
- Serve global and class leaderboards quickly (UI < 200ms typical).
- Support timeframe filters: `all`, `month` (current month), and optionally historical months (`YYYY-MM`).
- Keep server-side refreshes predictable and safe at small scale (~150 students) and easily upgradeable as the system grows.

---

## Proposal A — Cache-first (current system, fast path via `leaderboard_cache`)

Summary
- Keep the existing refresh job that computes leaderboards and upserts JSON payloads into `public.leaderboard_cache` keyed by `(section, timeframe)`.
- UI requests `/.netlify/functions/progress_summary?section=...&timeframe=...` which first tries `leaderboard_cache` and returns the cached payload when present.

What to store
- For each list you want fast, upsert rows such as:
  - `section = 'leaderboard_global'`, `timeframe = 'all'`
  - `section = 'leaderboard_stars_global'`, `timeframe = 'month'`
  - For historical snapshots: `timeframe = '2025-11'` (upsert at month-end)
- Payload: JSON `{ success: true, leaderboard: [ { user_id, name, points, stars, class }, ... ] }`.

Advantages
- Extremely fast reads (single-row read + return JSON).
- Very simple to implement and reason about.
- Minimal schema changes (your `leaderboard_cache` already exists).

Disadvantages
- Need one cache row per (section,timeframe). For class-level leaderboards, you need one row per class per timeframe.
- Managing many cache rows can become tedious at scale (but still manageable for dozens of classes).
- Historical months require explicit snapshotting (month-end job) if you want immutable prior-month leaderboards.

Performance and scale
- Works well for small→moderate scale (tens to a few hundreds of classes/users).
- Refresh job complexity depends on how you compute leaderboards; you already page and aggregate attempts/sessions.

Implementation notes
- Ensure refresh job upserts `timeframe='month'` variants (not just stars) so UI can request `timeframe=month`.
- For class caches, either encode class into `section` (quick) or add a `class` column to `leaderboard_cache` (cleaner).

When to use
- Quick wins, low complexity, ideal when you want immediate fast UI with minimal DB design changes.

---

## Proposal B — Aggregated table (`student_scores`) + cache

Summary
- Maintain a small aggregated table `public.student_scores` with one row per student that stores `points_all`, `points_month`, `stars_all`, `stars_month`, `class`, etc.
- Refresh the aggregated table periodically (full recompute is fine for ~150 students every 5 minutes; incremental approach for scale).
- Build top-N lists from `student_scores` and upsert those into `leaderboard_cache` for the fastest reads.

Recommended schema

```sql
CREATE TABLE IF NOT EXISTS public.student_scores (
  user_id text PRIMARY KEY,
  class text,
  points_all bigint DEFAULT 0,
  points_month bigint DEFAULT 0,
  stars_all int DEFAULT 0,
  stars_month int DEFAULT 0,
  last_activity timestamptz,
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_student_scores_class_points_all ON public.student_scores (class, points_all DESC);
CREATE INDEX IF NOT EXISTS idx_student_scores_points_month ON public.student_scores (points_month DESC);
```

How it works (refresh, full-recompute)
- Every N minutes (e.g., 5):
  1. Page the `profiles` table to list students (batching).
  2. For each batch of user IDs, compute points all-time and month using `aggregatePointsForIds` (existing helper).
  3. Fetch sessions for those users and compute stars per user (existing helpers `fetchSessionsForUsers` + `deriveStars` logic).
  4. Upsert the aggregated rows into `student_scores` (one upsert per batch or bulk upsert).
  5. Rebuild top lists with a few cheap SELECTs and upsert into `leaderboard_cache`.

How it works (incremental/delta) — for later
- Maintain `refresh_state` with last processed attempt/session id or timestamp.
- Process only new attempts/sessions and apply deltas to `student_scores`.
- Use a helper `user_best_stars` table for per-(user,list,mode) best-star tracking to make star deltas efficient.

Advantages
- Very fast leaderboard queries: single `SELECT ... ORDER BY points_month DESC LIMIT 50` or `WHERE class='X'`.
- Compact, indexed table optimized for read patterns.
- Makes supporting filters (class, month, historical snapshots) easy.
- Easier to implement additional analytics from a stable per-user aggregated table.

Disadvantages
- Slightly more implementation work up-front (schema and refresh code changes).
- If using full recompute, it performs more DB work each run (but trivial for 150 users).

Performance and scale
- For 150 students, full recompute every 5 minutes is cheap and recommended.
- For thousands+ students, incrementals are advised.

Historical months
- Snapshot `leaderboard_cache` rows with `timeframe='YYYY-MM'` at month-end (or keep a `student_scores_history` table if you need per-user month history).

---

## UI API mapping (both designs)
- `GET /.netlify/functions/progress_summary?section=<section>&timeframe=<all|month|YYYY-MM>`
  - Fast path: Netlify function reads `leaderboard_cache` (section,timeframe).
  - Fallbacks:
    - If `student_scores` exists, Netlify can query it (fast) to produce the list and optionally write the cache.
    - Otherwise compute from attempts/sessions (slow).

UI behavior
- Provide a month selector that maps to `timeframe=month` (current) or `YYYY-MM` for specific months.
- When loading, show the small spinner near the filter (already added) until response returns.

---

## Recommendations (practical roadmap)
1. Short-term (fast): Ensure refresh job upserts `leaderboard_global:month` and `leaderboard_stars_global:month` so the UI can request `timeframe=month` immediately. If you want class leaderboards cached, add per-class upserts (quick: `section='leaderboard_stars_class:ClassA'` or preferred: add `class` column to cache table).

2. Mid-term (recommended): Add `student_scores` table and a full-recompute refresh path (simple, safe). Use `student_scores` to back `leaderboard_cache` and to serve any fallback queries quickly.

3. Long-term (scale): When refresh runtime grows, implement incremental/delta updates with a `refresh_state` and `user_best_stars` helper table.

---

## Practical next steps I can take for you
- Add `leaderboard_global:month` upsert to the refresh scripts (small patch).
- Create `sql/create_student_scores.sql` and update `scripts/refresh_leaderboard_cache.js` to populate `student_scores` with a full recompute; run locally and verify.
- Add a month-end snapshot job that writes `leaderboard_cache` rows with `timeframe='YYYY-MM'` for historical archives.

If you pick one, I will implement it and run the refresh locally so you can confirm.

---

## Appendix: Example queries
- Top global points (all-time):
```sql
SELECT user_id, points_all, stars_all FROM public.student_scores ORDER BY points_all DESC LIMIT 50;
```
- Top global points (this month):
```sql
SELECT user_id, points_month, stars_month FROM public.student_scores ORDER BY points_month DESC LIMIT 50;
```
- Per-class month leaderboard:
```sql
SELECT user_id, points_month, stars_month FROM public.student_scores
WHERE class = 'ClassA' ORDER BY points_month DESC LIMIT 50;
```

---

Created by: engineering notes
Last updated: 2025-11-28
