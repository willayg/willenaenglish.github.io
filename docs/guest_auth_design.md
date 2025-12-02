# Guest Login & QR-Gated Play Design

Date: 2025-09-24
Status: Draft (awaiting approval)
Owner: Game Builder / Auth Integration

## 1. Purpose
Introduce a lightweight, upgradeable "guest" account path for users who enter through a live game QR code. Guests must either:
1. Log in with an existing approved account, OR
2. Create a persistent guest identity (username only) before playing.

This enables tracking gameplay, later upgrading the guest to a full student, and optionally restricting broader site features to approved roles while keeping friction low for classroom / event participation.

## 2. High-Level Flow
```
scan QR → play.html?id=UUID
  │
  ├─ if valid session cookie & role in {student, teacher, admin, guest}: load game
  │
  └─ else redirect → /students/login.html?next=/Games/Word%20Arcade/play.html?id=UUID&mode=...
        │
        ├─ User enters credentials → normal login → redirect back to next
        │
        └─ User taps "Play as Guest" → name prompt → POST guest_signup → set cookies → redirect next
```

## 3. Confirmed Requirements (User Responses 1–13)
| # | Requirement | Decision |
|---|-------------|----------|
|1| Guest persistence | Persistent accounts (upgradeable later) |
|2| Username collisions | Auto-suffix with space + number: `Alex 1`, `Alex 2`, ... (no parentheses) |
|3| Upgrade path | Yes. Guest will share same primary key pattern (Supabase Auth user id) so upgrade = field updates |
|4| Schema reference | Provided `profiles` schema (FK to `auth.users`) |
|5| Auth model for guests | Create real Supabase Auth user (synthetic email) |
|6| Approved flag | Guests auto-approved (`approved = true`) |
|7| Data captured | `username` and `name` identical; no email (synthetic only), role='guest' |
|8| Abuse / rate limit | Not a concern initially |
|9| Expiration | Inactive cleanup target: 45 days (default policy suggestion) |
|10| Redirect reliability | Must reliably return user to QR target (preserve full query string) |
|11| Session persistence | Keep logged in via refresh cookie like standard accounts |
|12| Roles | Add `guest` to accepted roles set |
|13| Name constraints | Max length 16 chars, profanity filter applied before creation |

## 4. Data Model & Schema Impact
Current `profiles` schema is retained. Proposed extensions (optional but recommended):
- Add column `last_active timestamptz DEFAULT now()` (for expiration logic)
- Add column `origin text` (store 'guest' or 'upgrade') for analytics (optional)
- Add column `upgraded boolean DEFAULT false` (optional marker)

If schema changes are deferred, we can: 
- Use `updated_at` trigger (if present) or periodically update `created_at` as proxy for last activity (less clean).

### Guest User Creation Strategy
- Generate synthetic email: `guest_<unixms>_<rand6>@guest.local`
- Generate random password (32+ chars) stored only transiently for login step.
- Insert Auth user (confirmed) via admin endpoint.
- Insert `profiles` row with:
  - `id`: Auth user id
  - `role`: `guest`
  - `approved`: true
  - `username`: sanitized unique username (see §6)
  - `name`: same as `username`
  - `email`: synthetic email (keeps unique constraint satisfied)

## 5. Access Control Policy (Phase 1)
| Feature | Role Access |
|---------|-------------|
| Live QR-play games | guest + student + teacher + admin |
| Non-QR Word Arcade entry pages | student + teacher + admin (guests blocked with CTA to upgrade) |
| Builder / assignments / dashboards | existing restrictions (no change) |

Future: Add `access` field to `live_games` if private gating needed.

## 6. Username Handling & Auto-Suffix Algorithm
Steps when user submits desired name (raw input `raw`):
1. Trim and collapse whitespace: `base = raw.trim().replace(/\s+/g,' ')`
2. Enforce length: truncate to 16 chars.
3. Apply profanity filter (see §7). If rejected → show error.
4. Check case-insensitive uniqueness against `profiles.username`.
5. If free → use `base`.
6. Else iterate n = 1..N:
   - candidate = `${base} ${n}` (truncate if exceeds 16; if truncation collides advance n)
   - Check again; select first free.
7. Hard upper bound (e.g., n <= 999). If exhausted → append random 4-char suffix instead.

SQL uniqueness check example (case-insensitive):
```sql
select username from profiles where lower(username) = lower($1);
```
Better approach for suffix search:
```sql
select username from profiles where lower(username) ~ ('^' || lower($1) || '( [0-9]+)?$');
```
Then parse existing suffixes in application code to find smallest unused.

## 7. Profanity & Validation
Lightweight initial approach:
- Maintain a small banned list array (English + common leets) client-side + server-side.
- Reject if any banned word appears as a standalone token or within (case-insensitive). 
- Optional: open-source list (e.g., LDNOOBW) trimmed; reduce to ~200 worst terms.
- Server-side enforcement in `guest_signup` to prevent bypass.

Validation summary:
- Allowed chars: letters, numbers, space, simple apostrophe or dash (decide: keep minimal). Plan: `/^[A-Za-z0-9 '\-]+$/` after trimming.
- Length 1–16 after trimming, at least one alphanumeric.

## 8. New API Endpoint: `supabase_auth?action=guest_signup`
Method: POST
Body:
```json
{ "username": "Desired Name" }
```
Response (success):
```json
{ "success": true, "user_id": "uuid", "username": "FinalAssigned" }
```
Error responses mirror existing style: `{ success:false, error:"message" }`.

Server steps:
1. Parse & validate body.
2. Run profanity + pattern checks.
3. Build final unique username.
4. Create Auth user (admin) with synthetic email + password, email_confirmed.
5. Login (password grant) to get access + refresh tokens (or use service token to mint? Simpler to re-use existing login path logic block—can factor out token-setting code for reuse).
6. Insert profile row (role=guest, approved=true, username/name assigned, email synthetic). Handle race on uniqueness (retry suffix if conflict).
7. Set cookies identical to normal login path.
8. Return success.

## 9. Redirect Logic (`next` Parameter)
Rules:
- Only allow absolute-path URLs beginning with `/` (no protocol / domain) to avoid open redirect.
- Preserve query string & hash.
- Example saved in login page: if `next=/Games/Word%20Arcade/play.html?id=123&mode=multi_choice` redirect exactly there post-auth.
- If missing or invalid, fallback `/students/profile.html` (existing behavior).
- When gating on `play.html`, build `next` including *all* current query params.

## 10. Gating `play.html`
Early script injection (before loading the heavy game script):
1. Call `supabase_auth?action=get_profile_name` with credentials.
2. If 200 success → proceed.
3. If 401 → window.location = `/students/login.html?next=${encodeURIComponent(location.pathname + location.search)}`.

Edge: Avoid infinite loop (ensure login page doesn’t auto-redirect itself). Already handled by different path.

## 11. Session Persistence & Expiration
- Reuse existing access (1h) + refresh (~30d) token scheme.
- Activity update: On each successful game fetch or guest score save (future), optionally call a lightweight endpoint to TOUCH last_active (if column added). For now, can skip; cleanup can compare `created_at` / `last_active`.
- Expiration policy: Guests older than 45 days with no activity → purge script (future cron) removes both `profiles` row and associated Auth user.

## 12. Upgrade Path
When converting guest → student:
1. Teacher/admin chooses guest record in back office.
2. Collect or assign real email & temporary password.
3. Update Auth user email + set password (admin API), set role='student', optionally keep username (enforce uniqueness already satisfied).
4. (Optional) Record upgrade timestamp / set `upgraded=true`.
5. All historical references remain valid because primary key stays the same.

## 13. Future Score / Analytics Integration (Not in First Pass)
- Add `live_game_sessions` table: (id, game_id, user_id (nullable), guest boolean, started_at, completed_at, mode, score_json).
- On mode endSession call → POST results (only after guest system stable).

## 14. Security Considerations
| Concern | Mitigation |
|---------|-----------|
| Open redirect via `next` | Restrict to same-origin absolute paths starting with `/` |
| Profanity / impersonation | Server-side filter + auto suffix numbering |
| Username enumeration | Acceptably low risk; collisions handled quietly, not revealing which exact user exists |
| Guest creation abuse | (Later) add simple rate limit (e.g., IP + minute) |
| Synthetic email collisions | Timestamp + random suffix virtually eliminates collision |
| Race condition on username | Retry with next integer if insert returns unique violation |
| Unauthorized profile escalation | Upgrade path only through backend admin UI |

## 15. Edge Cases
| Case | Behavior |
|------|----------|
| Empty or whitespace name | Reject with error "Please enter a name" |
| Length > 16 | Truncate then validate (warn user or silently?) – propose: show trimmed name before submit |
| All invalid chars | Reject |
| Profanity after trimming | Reject with generic message "Name not allowed" (avoid confirming word) |
| Rapid multi guest creation (double click) | Disable button while request in-flight |
| Network failure | Show retry prompt |

## 16. Minimal UI Changes (login.html)
- Replace Guest button behavior:
  1. If name input not yet shown → show inline modal / prompt component (custom small overlay) with text input limited to 16 chars & live character counter.
  2. On submit → POST guest_signup, show spinner, disable buttons.
  3. On success → redirect `next`.
  4. On error → show message & re-enable.
- Accessibility: input gets `aria-label="Guest name"`, focus ring preserved.

## 17. Implementation Task List (Phase 1)
1. Add `guest` role to any role validation utilities (front & back).  
2. Add `guest_signup` action to `supabase_auth.js`.  
3. Implement username sanitization + uniqueness algorithm with suffix resolution.  
4. Integrate profanity list (client + server).  
5. Modify `students/login.html` guest flow UI.  
6. Add gating script to `play.html` (redirect if not authenticated).  
7. (Optional) Add `last_active` column & update on guest signup + each `play-main.js` start.  
8. QA redirect correctness with complex queries (mode param, additional future params).  
9. Manual test matrix (desktop/mobile, existing login, new guest, repeated guest attempt).  
10. Documentation & handoff (this file).  

## 18. Deferred / Future
- Score & session logging table.
- Guest cleanup cron (45-day inactivity purge).
- Upgrade admin UI.
- Stronger profanity / internationalization filtering.
- Rate limiting & captcha if abuse emerges.
- Private live games (creator-only / class-only mode).

## 19. Open Questions (If Any)
Currently all clarified. If you want different truncation behavior (e.g., fail instead of truncating), note before coding.

## 20. Approval Checklist
- [ ] Username rules confirmed (truncate vs error)  
- [ ] Profanity list source accepted  
- [ ] Add `last_active` column now (yes/no)  
- [ ] Redirect gating timing (inline script vs separate module)  

Once approved, I will implement Phase 1 tasks.

---
End of document. Please mark any changes you’d like before I proceed with coding.
