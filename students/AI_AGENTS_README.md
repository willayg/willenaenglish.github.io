# AI Agent Guide: Architecture Overview

## ⚠️ Important: Check Cloudflare Workers First

**This project has migrated most critical APIs from Netlify Functions to Cloudflare Workers.**

When debugging or modifying API functionality, **always check the `cloudflare-workers/` directory FIRST** before looking at `netlify/functions/`.

## Active Cloudflare Workers (Primary)

The following services run as **Cloudflare Workers** and are the **source of truth** for production:

### 1. **proxy** (`api.willenaenglish.com`)
- **Location**: `cloudflare-workers/proxy/src/index.js`
- **Purpose**: Main API gateway that routes ALL requests to other CF Workers
- **Routes**: `/.netlify/functions/*` paths to appropriate workers via service bindings
- **No Netlify fallback** - CF Workers only

### 2. **supabase-auth**
- **Location**: `cloudflare-workers/supabase-auth/src/index.js`
- **Purpose**: Authentication & session management (login, logout, password changes, easy login)
- **Actions**: `login`, `logout`, `whoami`, `set_student_password`, `change_password`, `change_email`, `get_profile_name`, etc.
- **Used by**: All student/teacher login flows

### 3. **verify-student**
- **Location**: `cloudflare-workers/verify-student/src/index.js`
- **Purpose**: Student identity verification (name + 4-digit auth code)
- **Used by**: Easy login flow

### 4. **log-word-attempt**
- **Location**: `cloudflare-workers/log-word-attempt/src/index.js`
- **Purpose**: Progress tracking (study sessions, word attempts, XP calculation)
- **Used by**: All vocabulary games and exercises

### 5. **progress-summary**
- **Location**: `cloudflare-workers/progress-summary/src/index.js`
- **Purpose**: Leaderboards, stats, progress overview
- **Used by**: Student profiles, dashboards

### 6. **homework-api**
- **Location**: `cloudflare-workers/homework-api/src/index.js`
- **Purpose**: Homework assignment management (CRUD operations)
- **Used by**: Teacher dashboard, student homework pages

### 7. **get-audio-urls**
- **Location**: `cloudflare-workers/get-audio-urls/src/index.js`
- **Purpose**: Serves audio files from Cloudflare R2 storage
- **Routes**: Word audio, sentence audio
- **Used by**: All games and exercises with audio

## Legacy Netlify Functions (Secondary)

Some Netlify Functions still exist but are **NOT USED IN PRODUCTION** on the `students` branch:

- `netlify/functions/supabase_auth.js` - **REPLACED** by CF Worker
- Other functions in `netlify/functions/` - May be legacy or used only on other branches

## Deployment

To deploy Cloudflare Workers:

```bash
# Deploy a specific worker
cd cloudflare-workers/<worker-name>
npx wrangler deploy

# Example: Deploy supabase-auth
cd cloudflare-workers/supabase-auth
npx wrangler deploy
```

## Debugging Flow

When investigating an API issue:

1. ✅ Check `cloudflare-workers/<worker-name>/src/index.js` (FIRST)
2. ✅ Verify the proxy routes the function correctly in `cloudflare-workers/proxy/src/index.js`
3. ✅ Confirm deployment status with `npx wrangler deployments list`
4. ⚠️ Only check `netlify/functions/` if confirmed the branch uses Netlify (unlikely on `students` branch)

## API Gateway Flow

```
Browser Request
    ↓
https://api.willenaenglish.com/.netlify/functions/supabase_auth?action=login
    ↓
proxy worker (routes via service bindings)
    ↓
supabase-auth worker (handles request)
    ↓
Response with Set-Cookie headers (domain rewritten to .willenaenglish.com)
```

## Questions?

- Check `cloudflare-workers/MIGRATION_GUIDE.md` for migration details
- Check `cloudflare-workers/ROLLOUT_REPORT.md` for deployment history
- Proxy configuration: `cloudflare-workers/proxy/src/index.js`
