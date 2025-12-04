# Cloudflare Worker Migration - Production Rollout Report

## Deployment Summary

**Date:** December 4, 2025  
**Worker:** `get-audio-urls`  
**URL:** https://get-audio-urls.willena.workers.dev  
**Version:** 33ab368c-589f-4d4e-b7e3-2b8843b8984e

## What Was Deployed

### Worker Features
- ✅ Direct R2 bucket binding (fast, no S3 API overhead)
- ✅ Audio file proxy at `/audio/:filename` (streams from R2)
- ✅ Response caching (5 min TTL via Workers Cache API)
- ✅ Request logging with unique IDs
- ✅ CORS support for all your domains
- ✅ Concurrent file checking (up to 12 parallel)

### Client-Side Changes (`js/api-config.js`)
- ✅ Cloudflare Worker URL configured
- ✅ Rollout percentage control (`CF_ROLLOUT_PERCENT`)
- ✅ Shadow mode for parallel testing (`CF_SHADOW_MODE`)
- ✅ Automatic endpoint switching based on rollout %

## Smoke Test Results

| Word | Netlify | Cloudflare | Match |
|------|---------|------------|-------|
| apple | ✅ exists | ✅ exists | ✅ |
| banana | ✅ exists | ✅ exists | ✅ |
| cat | ✅ exists | ✅ exists | ✅ |
| dog | ✅ exists | ✅ exists | ✅ |
| hello | ❌ not found | ❌ not found | ✅ |

**Audio Proxy Test:** ✅ `GET /audio/apple.mp3` returns 200 OK with `audio/mpeg`

## URL Differences

| Endpoint | URL Format |
|----------|------------|
| Netlify | Presigned R2 URL (client downloads direct from R2) |
| Cloudflare | Worker proxy URL (client downloads via Worker) |

Both work correctly. The Worker proxy adds a small hop but enables:
- Better caching at edge
- No exposed R2 credentials
- Simpler URL format

---

## How to Roll Out Traffic

### Current State
```javascript
// In js/api-config.js
const CF_ROLLOUT_PERCENT = 0;   // Currently 0% to Cloudflare
const CF_SHADOW_MODE = false;   // Shadow mode off
```

### Step 1: Enable Shadow Mode (Recommended First)
Edit `js/api-config.js`:
```javascript
const CF_ROLLOUT_PERCENT = 0;   // Keep at 0
const CF_SHADOW_MODE = true;    // Enable shadow
```
- All traffic still uses Netlify
- Cloudflare receives shadow requests
- Check browser console for `[CF Shadow]` logs
- Monitor Cloudflare dashboard for errors

### Step 2: Small Percentage Rollout
```javascript
const CF_ROLLOUT_PERCENT = 5;   // 5% to Cloudflare
const CF_SHADOW_MODE = false;
```
Wait 24-48 hours, monitor both dashboards.

### Step 3: Gradual Increase
```javascript
const CF_ROLLOUT_PERCENT = 20;  // Then 50, then 100
```

### Step 4: Full Cutover
```javascript
const CF_ROLLOUT_PERCENT = 100;
```

---

## Monitoring

### Cloudflare Dashboard
- Workers & Pages → get-audio-urls → Analytics
- View: Requests, Errors, CPU Time, Duration

### Cloudflare Logs (Real-time)
```powershell
npx wrangler tail --name get-audio-urls
```

### Netlify Dashboard
- Functions → get_audio_urls → Metrics
- Compare invocation counts as you shift traffic

---

## Rollback Procedure

### Immediate Rollback (< 1 minute)
Edit `js/api-config.js`:
```javascript
const CF_ROLLOUT_PERCENT = 0;  // Back to Netlify
```
Commit and push. GitHub Pages will update automatically.

### If Worker Has Critical Bug
1. Set `CF_ROLLOUT_PERCENT = 0` immediately
2. Investigate via `wrangler tail`
3. Fix and redeploy Worker:
   ```powershell
   cd cloudflare-workers/get-audio-urls
   npx wrangler deploy
   ```
4. Test with curl before re-enabling rollout

### If Netlify Needs to Stay Primary
The Netlify function remains unchanged and functional. No action needed.

---

## Cost Comparison

| Service | Free Tier | Your Usage (~3k/day) |
|---------|-----------|----------------------|
| Netlify Functions | 125k/month | May exceed, ~$25/million after |
| Cloudflare Workers | 100k/day (3M/month) | **FREE** |

**Estimated savings:** ~$5-10/month for this function alone.

---

## Files Changed

| File | Change |
|------|--------|
| `cloudflare-workers/get-audio-urls/src/index.js` | Production Worker with caching, logging, audio proxy |
| `cloudflare-workers/get-audio-urls/wrangler.toml` | R2 bucket binding config |
| `js/api-config.js` | Rollout control, shadow mode, CF endpoint |

---

## Next Steps

1. **Enable shadow mode** and monitor for 24 hours
2. **Check Cloudflare logs** for any errors
3. **Compare response times** in browser dev tools
4. **Start 5% rollout** after shadow mode is stable
5. **Increase gradually** to 100% over 1-2 weeks

---

## Support Commands

```powershell
# Deploy latest Worker changes
cd cloudflare-workers/get-audio-urls
npx wrangler deploy

# View live logs
npx wrangler tail --name get-audio-urls

# Test Worker endpoint
Invoke-RestMethod -Uri 'https://get-audio-urls.willena.workers.dev' -Method Post -ContentType 'application/json' -Body '{"words":["apple"]}'

# Test audio proxy
curl.exe -I "https://get-audio-urls.willena.workers.dev/audio/apple.mp3"
```
