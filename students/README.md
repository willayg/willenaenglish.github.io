# Student Domain - Setup & Troubleshooting

## Quick Facts

- **Domain**: `students.willenaenglish.com`
- **Deployment**: Cloudflare Pages (NOT Netlify)
- **API Gateway**: `https://api.willenaenglish.com`
- **Auth Worker**: Cloudflare Workers (`supabase-auth`)

## The Problem We Solved

The students domain was on **Cloudflare Pages**, but the code assumed it was on **Netlify**. This caused API calls to fail with HTML 404 pages instead of JSON.

### Example Error
```
Unexpected token '<', "<!DOCTYPE "... is not valid JSON
```

**Why?** The browser tried to call `https://students.willenaenglish.com/.netlify/functions/supabase_auth`, which doesn't exist on CF Pages. Instead, ALL API calls must go through `https://api.willenaenglish.com`.

## The Solution: `api-gateway.js`

We created a single file that fixes API routing for the entire students domain:

### `/students/api-gateway.js`
- Loads FIRST on every student page
- Intercepts all `WillenaAPI` calls
- Routes them to `api.willenaenglish.com`
- Works even if other files are cached

## How to Use

### For Existing Pages

All student pages MUST load this in order:

```html
<head>
  <!-- FIRST: Student auth gateway -->
  <script src="/students/api-gateway.js"></script>
  
  <!-- SECOND: Generic API config -->
  <script src="/js/api-config.js"></script>
  
  <!-- Then rest of content... -->
</head>
```

**Current pages with this setup:**
- ✅ `signin.html` - Login
- ✅ `login.html` - Alt login
- ✅ `dashboard.html` - Main dashboard
- ✅ `profile.html` - User profile

### For New Pages

If you create a new student page that needs authentication:

1. Add the gateway script first:
   ```html
   <script src="/students/api-gateway.js"></script>
   <script src="/js/api-config.js"></script>
   ```

2. Use WillenaAPI normally - routing happens automatically:
   ```javascript
   const res = await WillenaAPI.fetch('/.netlify/functions/supabase_auth?action=login', {
     method: 'POST',
     headers: {'content-type': 'application/json'},
     body: JSON.stringify({email, password})
   });
   ```

That's it! The gateway handles routing.

## Troubleshooting

### "Login doesn't work" / "Bounced out of dashboard"

**Step 1: Check the console**
1. Open DevTools: `F12`
2. Go to Console tab
3. Look for these messages:
   ```
   [StudentGateway] ✓ API routing configured for students domain
   [StudentGateway] All API calls will use: https://api.willenaenglish.com
   ```

If you don't see these messages:
- The `api-gateway.js` script didn't load
- Check that it's in the `<head>` BEFORE `api-config.js`

**Step 2: Check network requests**
1. Go to Network tab
2. Filter: API calls should look like:
   ```
   https://api.willenaenglish.com/.netlify/functions/supabase_auth
   ```
   NOT:
   ```
   https://students.willenaenglish.com/.netlify/functions/supabase_auth
   ```

**Step 3: Hard refresh**
1. Press `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
2. This clears the browser cache

**Step 4: Check if api-gateway.js was deployed**
1. Go to: `https://students.willenaenglish.com/students/api-gateway.js`
2. You should see JavaScript code
3. If 404 or HTML error, the file wasn't deployed to CF Pages yet

### "Changes aren't showing up"

Cloudflare Pages caches `.js` files for up to 24 hours. To force a refresh:

1. Hard refresh your browser: `Ctrl+Shift+R`
2. Or wait for the cache to expire
3. Or go to Cloudflare Dashboard → Purge Cache

## Files Related to This

### In `students/` folder
- **`api-gateway.js`** ⭐ - THE FIX (single source of truth)
- **`STUDENT_AUTH_ARCHITECTURE.md`** - Full technical documentation
- **`signin.html`** - Login page
- **`login.html`** - Alt login page
- **`dashboard.html`** - Main dashboard (auth check)
- **`profile.html`** - User profile

### In `js/` folder
- **`api-config.js`** - Generic API routing (works for all domains)
  - This assumes `students.willenaenglish.com` is Netlify
  - The `api-gateway.js` overrides this assumption

### In `cloudflare-workers/` folder
- **`proxy/src/index.js`** - Main API gateway
- **`supabase-auth/src/index.js`** - Authentication worker

## Key Takeaway

**ALWAYS load `/students/api-gateway.js` FIRST on student pages.**

This one script fixes all routing issues for the students domain forever.

---

For detailed technical info, see: [STUDENT_AUTH_ARCHITECTURE.md](./STUDENT_AUTH_ARCHITECTURE.md)