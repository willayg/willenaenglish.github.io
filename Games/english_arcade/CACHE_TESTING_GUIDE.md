# Progress Cache Testing Guide

## Quick Test (2 minutes)

### 1. Open the App
- Navigate to Word Arcade
- Open browser console (F12)
- Look for prefetch logs:
  ```
  [WordArcade] Prefetching progress data for instant modal loading...
  [ProgressCache] MISS for level1_progress, fetching fresh
  [ProgressCache] SET level1_progress (1.2KB)
  ```

### 2. Test First Modal Open (No Cache Yet)
- Click "Word Games" → "Level 1"
- **Expected**: ~1-2 second load time (normal, no cache yet)
- Progress bars should fill with loading animation → actual percentages

### 3. Test Second Modal Open (Cache Hit!)
- Close modal
- Click "Level 1" again
- **Expected**: Instant render (<50ms) with correct percentages
- Console shows: `[ProgressCache] HIT for level1_progress`

### 4. Test Other Levels
- Open Level 2, Level 3, Phonics modals
- **Expected**: All instant after prefetch

### 5. Test Star Counts
- Look at level select menu
- Stars should appear immediately
- **Expected**: `⭐ 142` (or your actual count)

### 6. Test Cache Invalidation
- Complete any game session
- Console shows: `[WordArcade] Progress cache invalidated`
- Open modal again → fetches fresh data (no stale cache)

---

## Debug Commands

### View Cache Status
```javascript
window.WordArcade.progressCache.getStats()
```

### Check Specific Cache
```javascript
window.WordArcade.progressCache.get('level1_progress')
```

### Clear All Caches
```javascript
window.WordArcade.progressCache.clearAll()
```

### Manual Invalidation
```javascript
window.WordArcade.progressCache.invalidate(['level1_progress', 'level2_progress'])
```

### Test Background Refresh
```javascript
// Open a modal, keep it open
// Wait for background refresh logs:
// [ProgressCache] Background update: no changes for level1_progress
```

---

## Expected Performance

| Action | First Time | Subsequent Times |
|--------|-----------|------------------|
| Open Level 1 modal | 1-2 sec | <50ms ⚡ |
| Open Level 2 modal | 1-2 sec | <50ms ⚡ |
| Open Phonics modal | 1-2 sec | <50ms ⚡ |
| Level menu stars | 1 sec | <50ms ⚡ |

---

## Common Issues

### "Cache not working"
- Check prefetch happened (console logs ~500ms after page load)
- Try: `window.WordArcade.progressCache.getStats()`
- If empty, check for JavaScript errors

### "Progress bars still slow"
- First open is always slow (no cache yet)
- Second+ opens should be instant
- Check console for `[ProgressCache] HIT` logs

### "Stars not showing"
- Check: `window.WordArcade.progressCache.get('level_stars')`
- Should return: `{ level0: 142, level1: 387, ... }`
- If null, stars will load in background

---

## Success Indicators

✅ Console shows prefetch logs on app load  
✅ Second modal opens render instantly  
✅ Console shows "HIT" logs for cached data  
✅ Background refresh happens without blocking UI  
✅ Cache invalidates after session completion  
✅ No JavaScript errors in console  

---

**Ready to test!** Open the app and follow steps 1-6 above.
