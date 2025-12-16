/**
 * Progress Cache Manager
 * 
 * Implements stale-while-revalidate pattern for progress data:
 * 1. Return cached data instantly (if available)
 * 2. Fetch fresh data in background
 * 3. Update cache and notify UI
 * 
 * Security:
 * - Only caches aggregated percentages (no session IDs or timestamps)
 * - User-scoped keys prevent cross-user contamination
 * - 5-minute expiry prevents stale data
 * - Clears on logout
 */

// Import getUserId from records.js to check user readiness
// This is the same function used throughout the app to get the authenticated user
import { getUserId, ensureUserId } from '../../../students/records.js';

class ProgressCache {
  constructor() {
  this.CACHE_KEY_PREFIX = 'wa_progress_';
  this.CACHE_DURATION = 10 * 60 * 1000; // 10 minutes default TTL
    this.USER_KEY_CACHE = 'wa_user_key';
    this.inFlight = new Map(); // Prevent duplicate fetches
    this.listeners = new Map(); // Event listeners per cache type
  }

  /**
   * Check if we have a real authenticated user (not 'guest')
   * Used to gate progress caching to prevent poisoning cache with empty data
   */
  isUserReady() {
    try {
      // Use getUserId from records.js - the authoritative source of user auth state
      const uid = getUserId ? getUserId() : null;
      // Must have a truthy uid
      return !!uid;
    } catch {
      return false;
    }
  }

  /**
   * Wait for user to be authenticated (for use before prefetch)
   * Returns true if user becomes ready, false on timeout
   */
  async waitForUserReady(timeoutMs = 5000) {
    if (this.isUserReady()) return true;
    try {
      // Try to trigger whoami and wait for result
      const uid = await ensureUserId();
      return !!uid;
    } catch {
      return false;
    }
  }

  /**
   * Hash user ID for privacy (not cryptographic, just obfuscation)
   */
  _getUserKey() {
    try {
      // Try to get cached user key first
      let userKey = sessionStorage.getItem(this.USER_KEY_CACHE);
      if (userKey) return userKey;

      // Generate from available user data - use getUserId from records.js
      const uid = (getUserId ? getUserId() : null) || 'guest';
      // Simple hash using btoa (Base64 encode)
      userKey = btoa(String(uid)).slice(0, 16).replace(/[^a-zA-Z0-9]/g, '');
      
      // Cache in sessionStorage (cleared on tab close)
      sessionStorage.setItem(this.USER_KEY_CACHE, userKey);
      return userKey;
    } catch {
      return 'default';
    }
  }

  /**
   * Build cache key for a specific data type
   */
  _getCacheKey(type) {
    return `${this.CACHE_KEY_PREFIX}${this._getUserKey()}_${type}`;
  }

  /**
   * Get cached data (returns null if expired, missing, or user not ready)
   */
  get(type) {
    try {
      // If user not ready, don't serve cached data (could be stale/wrong user)
      if (!this.isUserReady()) {
        console.log(`[ProgressCache] SKIP GET ${type} - user not ready`);
        return null;
      }
      
      const key = this._getCacheKey(type);
      const cached = localStorage.getItem(key);
      if (!cached) return null;
      
      const parsed = JSON.parse(cached);
      const { data, timestamp } = parsed;
      const age = Date.now() - timestamp;
      
      // Check expiry
      if (age > this.CACHE_DURATION) {
        localStorage.removeItem(key);
        return null;
      }
      
      console.log(`[ProgressCache] HIT for ${type} (age: ${Math.round(age/1000)}s)`);
      return data;
    } catch (e) {
      console.warn(`[ProgressCache] Error reading cache for ${type}:`, e);
      return null;
    }
  }

  /**
   * Set cache for a data type
   * NOTE: Will skip caching if user is not ready (prevents cache poisoning)
   */
  set(type, data) {
    try {
      // CRITICAL: Don't cache progress data if user is not ready
      // This prevents poisoning the cache with empty/0 values before auth completes
      if (!this.isUserReady()) {
        console.log(`[ProgressCache] SKIP SET ${type} - user not ready (would poison cache)`);
        return;
      }
      
      const key = this._getCacheKey(type);
      const payload = JSON.stringify({
        data,
        timestamp: Date.now()
      });
      
      localStorage.setItem(key, payload);
      console.log(`[ProgressCache] SET ${type} (${(payload.length/1024).toFixed(1)}KB)`);
    } catch (e) {
      // Quota exceeded - clear old caches and retry
      if (e.name === 'QuotaExceededError') {
        console.warn('[ProgressCache] Quota exceeded, clearing old caches');
        this.clearExpired();
        try {
          localStorage.setItem(key, payload);
        } catch {
          console.error('[ProgressCache] Failed to cache after cleanup');
        }
      } else {
        console.error('[ProgressCache] Error setting cache:', e);
      }
    }
  }

  /**
   * Fetch with cache (stale-while-revalidate pattern)
   * Returns cached data immediately, then revalidates in background
   */
  async fetchWithCache(type, fetchFn) {
    const cached = this.get(type);
    
    // Return cached immediately if available
    if (cached) {
      console.log(`[ProgressCache] Serving cached ${type}, revalidating in background`);
      // Revalidate in background (non-blocking)
      this._revalidate(type, fetchFn);
      return { data: cached, fromCache: true };
    }
    
    // No cache - fetch fresh (blocking)
    console.log(`[ProgressCache] MISS for ${type}, fetching fresh`);
    try {
      const fresh = await fetchFn();
      this.set(type, fresh);
      return { data: fresh, fromCache: false };
    } catch (e) {
      console.error(`[ProgressCache] Fetch failed for ${type}:`, e);
      throw e;
    }
  }

  /**
   * Revalidate cache in background
   */
  async _revalidate(type, fetchFn) {
    // Prevent duplicate background fetches
    if (this.inFlight.has(type)) {
      console.log(`[ProgressCache] Revalidation already in flight for ${type}`);
      return;
    }
    
    this.inFlight.set(type, true);
    try {
      const fresh = await fetchFn();
      const old = this.get(type);
      
      // Only update cache and notify if data actually changed
      const changed = JSON.stringify(old) !== JSON.stringify(fresh);
      
      this.set(type, fresh);
      
      if (changed) {
        console.log(`[ProgressCache] Background update detected changes for ${type}`);
        // Emit event for UI to refresh
        window.dispatchEvent(new CustomEvent('wa-progress-updated', { 
          detail: { type, data: fresh } 
        }));
        
        // Call registered listeners
        const listeners = this.listeners.get(type) || [];
        listeners.forEach(fn => {
          try { fn(fresh); } catch (e) { console.error('[ProgressCache] Listener error:', e); }
        });
      } else {
        console.log(`[ProgressCache] Background update: no changes for ${type}`);
      }
    } catch (e) {
      console.error(`[ProgressCache] Background revalidation failed for ${type}:`, e);
    } finally {
      this.inFlight.delete(type);
    }
  }

  /**
   * Register a listener for cache updates
   */
  onUpdate(type, callback) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type).push(callback);
    
    // Return unsubscribe function
    return () => {
      const list = this.listeners.get(type) || [];
      const idx = list.indexOf(callback);
      if (idx > -1) list.splice(idx, 1);
    };
  }

  /**
   * Clear expired caches only
   */
  clearExpired() {
    try {
      const now = Date.now();
      const keys = Object.keys(localStorage);
      let cleared = 0;
      
      keys.forEach(key => {
        if (!key.startsWith(this.CACHE_KEY_PREFIX)) return;
        
        try {
          const cached = localStorage.getItem(key);
          if (!cached) return;
          
          const { timestamp } = JSON.parse(cached);
          const age = now - timestamp;
          
          if (age > this.CACHE_DURATION) {
            localStorage.removeItem(key);
            cleared++;
          }
        } catch {
          // Malformed cache entry - remove it
          localStorage.removeItem(key);
          cleared++;
        }
      });
      
      if (cleared > 0) {
        console.log(`[ProgressCache] Cleared ${cleared} expired cache entries`);
      }
    } catch (e) {
      console.error('[ProgressCache] Error clearing expired caches:', e);
    }
  }

  /**
   * Clear all progress caches (e.g., on logout)
   */
  clearAll() {
    try {
      const keys = Object.keys(localStorage);
      let cleared = 0;
      
      keys.forEach(key => {
        if (key.startsWith(this.CACHE_KEY_PREFIX)) {
          localStorage.removeItem(key);
          cleared++;
        }
      });
      
      // Also clear session storage
      sessionStorage.removeItem(this.USER_KEY_CACHE);
      
      console.log(`[ProgressCache] Cleared all caches (${cleared} entries)`);
    } catch (e) {
      console.error('[ProgressCache] Error clearing all caches:', e);
    }
  }

  /**
   * Clear specific cache type
   */
  clear(type) {
    try {
      const key = this._getCacheKey(type);
      localStorage.removeItem(key);
      console.log(`[ProgressCache] Cleared cache for ${type}`);
    } catch (e) {
      console.error(`[ProgressCache] Error clearing ${type}:`, e);
    }
  }

  /**
   * Invalidate cache after progress update (e.g., completing a session)
   */
  invalidate(types = []) {
    if (!Array.isArray(types)) types = [types];
    
    types.forEach(type => {
      this.clear(type);
      console.log(`[ProgressCache] Invalidated ${type}`);
    });
  }

  /**
   * Get cache stats for debugging
   */
  getStats() {
    try {
      const keys = Object.keys(localStorage);
      const cacheKeys = keys.filter(k => k.startsWith(this.CACHE_KEY_PREFIX));
      
      let totalSize = 0;
      const stats = cacheKeys.map(key => {
        const val = localStorage.getItem(key);
        const size = val ? val.length : 0;
        totalSize += size;
        
        try {
          const { timestamp } = JSON.parse(val);
          const age = Date.now() - timestamp;
          return {
            key: key.replace(this.CACHE_KEY_PREFIX, ''),
            size: `${(size/1024).toFixed(1)}KB`,
            age: `${Math.round(age/1000)}s`,
            expired: age > this.CACHE_DURATION
          };
        } catch {
          return { key, size: `${(size/1024).toFixed(1)}KB`, invalid: true };
        }
      });
      
      return {
        entries: cacheKeys.length,
        totalSize: `${(totalSize/1024).toFixed(1)}KB`,
        stats
      };
    } catch {
      return { error: 'Failed to get stats' };
    }
  }
}

// Export singleton instance
export const progressCache = new ProgressCache();

// Auto-clear expired caches on load
if (typeof window !== 'undefined') {
  progressCache.clearExpired();
}
