# Character System P3 — checkpoint and release checklist

Rollback refs:
- `students-pre-character-p3-20261116`
- `teachers-pre-character-p3-20261116`

## Canonical rules
- `shared/free-talking-character-catalog.js` is the single source of truth for character IDs, thresholds, publishing status and metadata.
- Willo and AI Willi 2: free (0 points).
- Bunny Fox: 100 points; Pigfish: 300; Dusk: 5,000; Sergeant Steve: 8,000.
- Unlock selection UI: reuse a verified point total for the lifetime of one picker visit, never fetch on each tile tap.
- Do a fresh server-side point check at activity entry or when authorizing separately callable paid-voice endpoints. Never grant an unlock using only client-side checks.
- Never infer an unlock from stars, Super Points, current-month leaderboard rank or locally earned pending points. Use the verified lifetime points total.
- Unlocked character tiles show the original artwork/name and allow replay of the existing celebration. Locked tiles are desaturated, hide names, and are not clickable.
- The dashboard Character Collection sits directly above the main leaderboard and listens to the dashboard's existing overview response; it issues zero separate points requests.
- One-time unlock claims use `free_talking_character_unlocks` with authenticated, owner-scoped inserts; do not write duplicate records or give points for opening a character.
- Automatic milestone celebrations: at most one pending celebration per Free Talking picker visit; voice preview only on explicit Listen tap.
- Do not change character SVGs, structured-speaking microphone handlers, Free Talking grading, points ledger, or teacher dashboard during P3 unlock work.

## Release checks
1. `/students/characters-v2/smoke-test.html` must pass all tests including thresholds at 99/100, 299/300, 4,999/5,000, and 7,999/8,000.
2. Dashboard: collection above leaderboard, no collection in `leaderboard_only=1`, six existing SVGs display correctly (especially neutral AI Willi eyes).
3. With 0 points: Willo/AI Willi 2 available; Bunny/Pigfish/Dusk/Steve are anonymous disabled silhouettes.
4. With 100 points: Bunny unlocks; Pigfish remains locked. With 300: Pigfish unlocks. With 5,000: Dusk. With 8,000: Steve.
5. Locked cards never launch celebration; unlocked cards replay celebration without changing points or claimed status.
6. Speaking picker and Free Talking picker use the same thresholds. All picker taps respond without network wait. Direct URL/session entry cannot bypass server point checks.
7. On Free Talking picker entry, unclaimed earned milestones show no more than one server-backed celebration. Claim once; do not replay automatically on next visit.
8. Recheck server audit logs, Cloudflare deployment, phone portrait/tablet layout and Android/PWA cache before calling the rollout verified.

## Important limitation
A protected TTS endpoint can be invoked independently of a conversation session, so it currently performs its own point check for paid characters. An optional future signed, short-lived entitlement could reduce these repeated database reads without weakening direct-endpoint authorization.
