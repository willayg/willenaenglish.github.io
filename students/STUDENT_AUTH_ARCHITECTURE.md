# Student Authentication Architecture

## Overview

The student domain (`students.willenaenglish.com`) is deployed on **Cloudflare Pages**, not Netlify. This requires a specific API routing strategy to work properly.

## Problem (What We Learned)

- `students.willenaenglish.com` is a **Cloudflare Pages** deployment
- Cloudflare Pages does NOT have native `/.netlify/functions/` endpoints
- All API calls must go through the **Cloudflare API Gateway** at `api.willenaenglish.com`
- The old `api-config.js` assumed `students.willenaenglish.com` was Netlify-hosted
- This caused login failures because API calls returned HTML error pages instead of JSON

## Solution: Centralized API Gateway

### The Flow

```
student page (signin.html)
    ↓
api-gateway.js  ← FIRST: patches WillenaAPI early
    ↓
api-config.js   ← uses patched WillenaAPI
    ↓
WillenaAPI.fetch() → routes all requests through https://api.willenaenglish.com
    ↓
api.willenaenglish.com (CF API gateway)
    ↓
CF Workers (supabase-auth, verify-student, etc.)
```

### Key Files

#### 1. **`/students/api-gateway.js`** ⭐ (Single Source of Truth)

This file ensures ALL pages use the correct API gateway. It:
- Loads BEFORE api-config.js
- Overrides `WillenaAPI.getApiUrl()` to route through the CF gateway
- Works even if api-config.js is stale or cached
- Automatically applies to all student pages

**Must be loaded first in every student page:**
```html
<script src="/students/api-gateway.js"></script>
<script src="/js/api-config.js"></script>  <!-- loads after -->
```

#### 2. **Pages Using This**
- `/students/signin.html` - Login page
- `/students/login.html` - Alternative login
- `/students/dashboard.html` - Main dashboard
- `/students/profile.html` - User profile

## Why This Approach?

### ✅ Advantages

1. **Single Source of Truth** - All routing logic in one file
2. **Resilient to Caching** - Works even if `api-config.js` is stale
3. **No Duplicated Code** - No inline HOTFIX scripts scattered everywhere
4. **Easy to Update** - One change fixes all pages
5. **Future-Proof** - If deployment changes, only need to update `api-gateway.js`

### ⚠️ What to Avoid

- ❌ Don't add inline API routing scripts in each page
- ❌ Don't rely on `api-config.js` alone (it gets cached by CF)
- ❌ Don't assume students domain is Netlify (it's CF Pages)

## Console Logs

When working correctly, you should see in DevTools Console:
```
[StudentGateway] ✓ API routing configured for students domain
[StudentGateway] All API calls will use: https://api.willenaenglish.com
```

## Testing

### To verify the fix is working:

1. Open DevTools (F12) → Console
2. Hard refresh (Ctrl+Shift+R)
3. Look for `[StudentGateway]` messages
4. Check Network tab - API calls should go to `api.willenaenglish.com`

### Example Network Request
- **Before Fix**: `https://students.willenaenglish.com/.netlify/functions/supabase_auth` → 404 HTML
- **After Fix**: `https://api.willenaenglish.com/.netlify/functions/supabase_auth` → JSON response ✓

## Adding New Student Pages

When creating new student pages that need authentication:

1. Load `api-gateway.js` FIRST:
```html
<script src="/students/api-gateway.js"></script>
<script src="/js/api-config.js"></script>
```

2. Use WillenaAPI normally - routing happens automatically:
```javascript
const res = await WillenaAPI.fetch('/.netlify/functions/supabase_auth?action=login', {...});
```

## If It Breaks Again

If login stops working:

1. **Check the console** - Look for `[StudentGateway]` messages
2. **Check Network tab** - Are API calls going to `api.willenaenglish.com`?
3. **Hard refresh** - Clear browser cache: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
4. **Check api-gateway.js** - Make sure it's deployed and accessible at `/students/api-gateway.js`
5. **Check CF Workers** - Ensure `api.willenaenglish.com` proxy is deployed

## Related Files

- `js/api-config.js` - Generic API configuration (works for staging, GitHub Pages)
- `cloudflare-workers/proxy/src/index.js` - Main API gateway that routes to CF Workers
- `cloudflare-workers/supabase-auth/src/index.js` - Auth worker that handles login

## Deployment Notes

- Changes to `students/api-gateway.js` deploy automatically to CF Pages
- There's a 24-hour cache on `.js` files in `_headers`
- If changes don't appear, do a hard refresh: `Ctrl+Shift+R`
- On CF Pages, you may need to manually purge cache from Cloudflare dashboard
