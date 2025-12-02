# Login / Auth Refresh — Change Record

Date: 2025-11-27
Author: (automated record created by assistant)

This document records the recent changes made to add a Supabase access/refresh token refresh flow for teacher pages, why they were made, how they work, how to test them, and how to undo/restore if needed.

## Summary of changes

Files added/modified (relative to repository root):

- Added: `Teachers/auth-refresh.js`
- Modified: `Teachers/components/burger-menu.js`
- Modified: `Teachers/login.html`
- Modified: `Teachers/tools/student_tracker/main.js` (earlier change unrelated to refresh but part of session)
- Modified: `Teachers/tools/student_tracker/student_tracker.html` (earlier change)
- Netlify function: `netlify/functions/supabase_auth.js` already contained a `refresh` action; it is used by the helper.

> Note: the student tracker changes (main.js and student_tracker.html) were made earlier in-session to implement UI tweaks (scale, font bump, homework highlights). They are listed here for completeness.

## Intent / Rationale

Teachers' sessions were expiring (access token rotation) after ~1 hour because Supabase issues short-lived access tokens and rotates them regularly. The site already stores `sb_access` and `sb_refresh` tokens as HTTP-only cookies. To keep teachers logged in for longer (e.g., days/weeks) while avoiding insecure localStorage usage, the design used here:

- Uses a secure, server-side refresh endpoint (`/.netlify/functions/supabase_auth?action=refresh`) that reads the `sb_refresh` cookie and asks Supabase for a new session, then re-sets `sb_access` and `sb_refresh` cookies with extended `Max-Age`.
- Adds a small client-side helper (`Teachers/auth-refresh.js`) which calls the refresh endpoint immediately on load and then periodically while the page remains open (and on `focus`).
- Boots the helper in a single shared place (`Teachers/components/burger-menu.js` which loads on teacher pages) and also from the `login.html` page to ensure refresh runs when the user arrives.

This keeps cookie-based sessions alive without storing tokens in localStorage or exposing secrets to the client.

## Implementation details

### 1) `Teachers/auth-refresh.js` (new)
- Location: `/Teachers/auth-refresh.js`
- Exports `ensureAuthRefresh()` and also exposes `window.ensureAuthRefresh` for non-module usage.
- Behavior:
  - Calls `/.netlify/functions/supabase_auth?action=refresh` (same-origin, credentials: include).
  - Immediately attempts a refresh when called, then schedules subsequent refresh attempts at a default interval of 40 minutes (configurable by editing `REFRESH_INTERVAL` in the file).
  - Debounces concurrent calls (if a refresh is in flight it won't issue another request simultaneously).
  - Triggers an extra refresh when the window gets focus if enough time has elapsed since last refresh.

### 2) `Teachers/components/burger-menu.js` (modified)
- Imports and calls `ensureAuthRefresh()` so the refresh loop starts whenever the shared burger menu module is loaded. This means any page that includes the burger menu will start the refresher automatically.
- The import is: `import { ensureAuthRefresh } from '../auth-refresh.js';` and `ensureAuthRefresh();` is invoked early in the module.

### 3) `Teachers/login.html` (modified)
- Imports the helper and calls `ensureAuthRefresh()` early on page load to kick off refresh attempts before redirecting to the dashboard.
- This makes the login + redirect experience refresh tokens as soon as the login flow completes and during the user's session on the login page.

### 4) `netlify/functions/supabase_auth.js` (existing)
- Already exposes a `refresh` action handler that reads the `sb_refresh` cookie, calls Supabase to refresh the session, and issues new `sb_access` + `sb_refresh` cookies with `Max-Age` ≈ 30 days.
- Cookie flags used in production: `HttpOnly; Secure; SameSite=None; Domain=.willenaenglish.com` (when host matches that domain).
- Local dev: relaxed cookie flags (no `Secure` and `SameSite=Lax`) to allow testing on `http://localhost:9000` and `http://localhost:8888`.

### 5) Other files edited earlier in the session
- `Teachers/tools/student_tracker/main.js` — logic changes for class name normalization and a highlight feature for classes with active homework (not directly related to auth refresh but noted for completeness).
- `Teachers/tools/student_tracker/student_tracker.html` — embedded CSS changes (scale, font bump) and some width adjustments.

## How it works at runtime

- Browser has `sb_access` and `sb_refresh` cookies (HTTP-only) set by the login flow.
- `ensureAuthRefresh()` calls the refresh endpoint with `credentials: 'include'`. The server-side `supabase_auth` function inspects the `sb_refresh` cookie and, if valid, requests a new session from Supabase and resets cookies with updated tokens and `Max-Age` for long persistence.
- The client schedules subsequent refreshes every 40 minutes by default so the access token is rotated before it expires (~1hr under Supabase default rotation policy). This keeps the teacher effectively logged in while the browser and cookies remain present.

## How to test locally

1. Start your local dev server that serves the site (the repository likely already has instructions). For a simple static serve you can use Python or another static server in the project root; if you use Netlify dev or your normal workflow, use that.

2. Open the login page and sign in as a teacher. Observe the cookies via DevTools -> Application -> Cookies for your host. You should see `sb_access` and `sb_refresh` cookies set (HttpOnly cookies won't be visible to JS but will appear in the Cookies panel).

3. Use the `supabase_auth?action=cookie_echo` debug endpoint to see whether the server sees cookies (this endpoint was present in `supabase_auth.js`):

```powershell
# Example (PowerShell):
Invoke-RestMethod 'http://localhost:9000/.netlify/functions/supabase_auth?action=cookie_echo' -Method GET -Headers @{ 'Origin' = 'http://localhost:9000' }
```

You should see a JSON response showing `hasAccess` and/or `hasRefresh: true` when cookies are sent.

4. With the page open, leave the tab open for >1 hour or reduce Supabase access token TTL for test/dev to a shorter interval, and confirm the page still behaves as logged in and that refresh endpoint has been called periodically (you can look at your Netlify function logs or add console logs in `auth-refresh.js`).

5. You can manually call the refresh endpoint to confirm it re-issues cookies:

```powershell
Invoke-RestMethod 'http://localhost:9000/.netlify/functions/supabase_auth?action=refresh' -Method GET -SessionVariable websession -Headers @{ 'Origin' = 'http://localhost:9000' }
```

(Exact command depends on your local server setup and CORS origin.)

## Rollback / Undo instructions

Prefer using Git. See recommended workflows below.

- Create a branch and commit (recommended before further changes):

```powershell
cd "d:\Willena Website\willenaenglish.github.io"
# create branch
git checkout -b save/supabase-refresh
# stage and commit changes
git add Teachers/auth-refresh.js Teachers/components/burger-menu.js Teachers/login.html Teachers/tools/student_tracker/main.js Teachers/tools/student_tracker/student_tracker.html
git commit -m "WIP: add auth refresh helper and hook up pages (supabase token refresh)"
```

- Restore a file to previous commit (if already committed):

```powershell
# restore a single file to previous commit
git restore --source=HEAD~1 -- Teachers/login.html
```

- Revert the commit (safe undo that produces a new commit):

```powershell
# get the commit hash with git log, then
git revert <commit-hash>
git push
```

- If you want to discard uncommitted changes entirely (destructive):

```powershell
git restore --source=HEAD -- .
```

- If you created a patch/backup earlier you can apply in reverse:

```powershell
# reverse-apply patch
git apply -R ..\student-tracker-supabase-refresh.patch
```

## Security notes

- Tokens remain HTTP-only cookies only; the client-side helper never reads them with JS (the helper simply calls the refresh endpoint which reads cookies server-side).
- Do not move tokens into `localStorage` or `sessionStorage` — that would expose them to XSS.
- The server sets cookies with `HttpOnly` and `Secure` in production and uses `SameSite=None` to allow cross-site contexts when necessary.
- Local dev relaxes `Secure` and uses `SameSite=Lax` so cookies are available over `http://localhost` for testing.

## Next/optional improvements

- Centralize `ensureAuthRefresh()` initialization in a single shell file that all teacher pages import rather than multiple modules. Currently the burger menu and login page call the helper; any other shared shell script would work as a single place.
- Expose a short status endpoint or server-side log for refresh events to make debugging easier.
- Consider a small exponential backoff/retry policy in `auth-refresh.js` if the refresh endpoint becomes temporarily unavailable.
- If you want to aggressively reduce network calls, adjust `REFRESH_INTERVAL` or schedule refresh only when pages are active (but the helper already refreshes on focus).

## Where the files are

- `Teachers/auth-refresh.js` — new helper
- `Teachers/components/burger-menu.js` — modified to import and call helper
- `Teachers/login.html` — modified to import and call helper
- `netlify/functions/supabase_auth.js` — contains `refresh` action used by helper
- `Teachers/tools/student_tracker/main.js` and `Teachers/tools/student_tracker/student_tracker.html` — earlier UI changes applied in the same session; not part of auth refresh but included for audit completeness

---

If you'd like, I can:
- Commit these changes to a feature branch and push it for you, or
- Create a zip/patch backup and then commit the changes, or
- Revert any of the above edits now and restore the previous state.

Which of those would you like me to do next?