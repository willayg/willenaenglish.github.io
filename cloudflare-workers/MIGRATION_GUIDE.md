# Cloudflare Workers Migration Guide

## Overview

This guide covers migrating Netlify Functions to Cloudflare Workers for cost reduction and performance improvements.

## Why Migrate?

| Factor | Netlify Functions | Cloudflare Workers |
|--------|-------------------|-------------------|
| **Free Tier** | 125k/month | 100k/day (~3M/month) |
| **Pricing After Free** | $25/million | $0.50/million |
| **Cold Starts** | ~200-500ms | ~0ms (no cold starts) |
| **R2 Access** | Network hop (S3 API) | Direct binding (instant) |
| **Edge Locations** | Limited | 300+ global |

## Migration Priority

Based on current metrics (Dec 4, 2025):

1. **`get_audio_urls`** ✅ READY - Stateless, R2 native, high volume
2. **`supabase_auth`** - Complex, needs careful testing
3. **`progress_summary`** - DB-heavy, consider Supabase Edge Functions
4. **`homework_api`** - DB-heavy, consider Supabase Edge Functions
5. **`log_word_attempt`** - Write-heavy, keep on Netlify or use Queues

## Phase 1: get_audio_urls Migration

### Prerequisites

1. Install Wrangler CLI:
   ```bash
   npm install -g wrangler
   ```

2. Login to Cloudflare:
   ```bash
   wrangler login
   ```

3. Get your R2 bucket name from Cloudflare dashboard

### Setup Steps

1. Navigate to worker directory:
   ```bash
   cd cloudflare-workers/get-audio-urls
   ```

2. Update `wrangler.toml`:
   - Change `bucket_name` to your actual R2 bucket name
   - Optionally add `R2_PUBLIC_BASE` if you have a public bucket URL

3. Install dependencies:
   ```bash
   npm install
   ```

4. Test locally:
   ```bash
   npm run dev
   ```
   This starts local dev server at http://localhost:8787

5. Deploy to Cloudflare:
   ```bash
   npm run deploy
   ```

6. Note the worker URL (e.g., `https://get-audio-urls.YOUR-SUBDOMAIN.workers.dev`)

### Testing

1. Open `test-cf-migration.html` in your browser
2. Enter the Cloudflare Worker URL
3. Click "Run Comparison Test" to verify responses match
4. Click "Run 10x Latency Test" to compare performance

### Rollout Strategy

#### Stage 1: Shadow Traffic (1 week)
```javascript
// In your client code, add shadow calls
async function getAudioUrls(words) {
  const netlifyPromise = fetch(NETLIFY_URL, { method: 'POST', body: JSON.stringify({ words }) });
  
  // Shadow call to CF (don't await, fire and forget for comparison)
  fetch(CF_WORKER_URL, { method: 'POST', body: JSON.stringify({ words }) })
    .then(r => r.json())
    .then(data => console.log('[CF Shadow]', data))
    .catch(e => console.error('[CF Shadow Error]', e));
  
  return netlifyPromise.then(r => r.json());
}
```

#### Stage 2: Feature Flag (1 week)
```javascript
const USE_CLOUDFLARE = localStorage.getItem('use_cf_audio') === '1';
const AUDIO_URL = USE_CLOUDFLARE ? CF_WORKER_URL : NETLIFY_URL;
```

#### Stage 3: Percentage Rollout
```javascript
const USE_CLOUDFLARE = Math.random() < 0.1; // 10% to CF
```

#### Stage 4: Full Migration
- Route 100% to Cloudflare
- Keep Netlify function as fallback for 2 weeks
- Remove Netlify function after stable period

## R2 Bucket Configuration

### Option 1: Public Bucket (Recommended for audio)

1. Go to Cloudflare Dashboard → R2 → Your Bucket → Settings
2. Enable "Public access"
3. Set `R2_PUBLIC_BASE` to your public URL

### Option 2: Signed URLs (Current approach)

The worker generates signed URLs using R2's native signing. No changes needed.

## Custom Domain (Optional)

Add to `wrangler.toml`:
```toml
[routes]
pattern = "audio-api.willenaenglish.com/*"
zone_name = "willenaenglish.com"
```

Then deploy and update DNS in Cloudflare.

## Monitoring

View logs in real-time:
```bash
npx wrangler tail
```

View analytics in Cloudflare Dashboard → Workers & Pages → Your Worker → Analytics

## Rollback Plan

If issues occur:
1. Update client code to use Netlify URL
2. Netlify function remains unchanged and functional
3. No downtime required

## Cost Projections

Current Netlify usage (estimated):
- ~3,000 invocations/day for get_audio_urls
- ~90,000/month

Cloudflare cost: **FREE** (under 100k/day limit)

Estimated monthly savings: **$2-5/month** just from this one function.

If you migrate all 5 high-traffic functions:
- Estimated total savings: **$10-20/month**
