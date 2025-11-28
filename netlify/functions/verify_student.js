/**
 * verify_student.js
 * 
 * Verifies a student's identity by matching provided information
 * against the profiles table.
 * 
 * Expects POST body: { korean_name, name, auth_code }
 * Returns: { success: true, student: { id, username } } or error
 */

exports.handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  // Simple in-memory rate limiter state (process-global). This persists
  // while the function container is warm. It's intentionally simple as a
  // low-risk first step; we can add Redis later if needed.
  if (!global.__verify_student_rate) {
    global.__verify_student_rate = {
      ipMap: new Map(),
      userMap: new Map()
    };
  }

  const RATE = global.__verify_student_rate;

  try {
    // Lazy load Supabase to avoid import issues
    let createClient;
    try {
      const supabaseModule = await import('@supabase/supabase-js');
      createClient = supabaseModule.createClient;
    } catch (importErr) {
      try {
        createClient = require('@supabase/supabase-js').createClient;
      } catch (requireErr) {
        console.error('Failed to load Supabase:', importErr, requireErr);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ success: false, error: 'Failed to load database client' })
        };
      }
    }

    const body = JSON.parse(event.body);
    const { korean_name, name, auth_code } = body;

    if (!korean_name || !name || !auth_code) {
      console.log('Missing fields:', { korean_name: !!korean_name, name: !!name, auth_code: !!auth_code });
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Missing required fields' })
      };
    }

    const koreanNameValue = String(korean_name).trim();
    const englishNameValue = String(name).trim();

    // Helper: client IP from proxied headers
    const getClientIp = (evt) => {
      const h = evt.headers || {};
      return (h['x-forwarded-for'] || h['x-nf-client-connection-ip'] || h['x-client-ip'] || h['x-real-ip'] || '').split(',')[0].trim() || 'unknown';
    };

    const clientIp = getClientIp(event);

    // Rate-limiter config
    const MAX_FAILED = 5; // lock after this many failed attempts
    const WINDOW_MS = 15 * 60 * 1000; // sliding window 15 minutes
    const LOCKOUT_MS = 5 * 60 * 1000; // lockout duration 5 minutes (reduced)

    const now = Date.now();

    const checkAndIncrement = (map, key, success) => {
      // success = boolean; on success we clear failure counters
      let entry = map.get(key);
      if (!entry) {
        entry = { count: 0, firstAt: now, lockedUntil: 0 };
        map.set(key, entry);
      }

      if (entry.lockedUntil && entry.lockedUntil > now) {
        return { blocked: true, retryAfterMs: entry.lockedUntil - now };
      }

      if (success) {
        // Reset on success
        map.delete(key);
        return { blocked: false };
      }

      // If window elapsed, reset
      if (now - entry.firstAt > WINDOW_MS) {
        entry.count = 0;
        entry.firstAt = now;
      }

      entry.count += 1;
      if (entry.count >= MAX_FAILED) {
        entry.lockedUntil = now + LOCKOUT_MS;
        return { blocked: true, retryAfterMs: LOCKOUT_MS };
      }

      return { blocked: false };
    };

  console.log('Received verification request:', { korean_name: koreanNameValue, name: englishNameValue });

    if (!koreanNameValue || !englishNameValue) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Missing required fields' })
      };
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY 
      || process.env.SUPABASE_SERVICE_KEY 
      || process.env.SUPABASE_KEY 
      || process.env.SUPABASE_SERVICE_ROLE 
      || process.env.SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase credentials');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ success: false, error: 'Server configuration error', hasUrl: !!supabaseUrl, hasServiceKey: !!supabaseKey })
      };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log('[verify_student] Supabase client initialized. URL present:', !!supabaseUrl, 'Service key present:', !!supabaseKey);

    const insertAudit = async ({ userId = null, actor = null, note = null, action = 'easy_login_attempt', success = false }) => {
      const payload = { user_id: userId, actor, source: 'verify_student', ip: clientIp, action, success, timestamp: new Date().toISOString(), note, user_key: userKey };
      console.log('[verify_student] Attempting audit insert:', payload);
      try {
        const { error: auditErr } = await supabase.from('auth_password_audit').insert([payload]);
        if (auditErr) {
          console.warn('[verify_student] Audit insert error:', auditErr.message || auditErr);
        } else {
          console.log('[verify_student] Audit insert success');
        }
      } catch (err) {
        console.warn('Audit insert failed:', err?.message || err);
      }
    };

    // Build user key early (used in audit + persistent limiter)
    const userKey = `user:${koreanNameValue.toLowerCase()}|${englishNameValue.toLowerCase()}`;

    // Persistent (DB-backed) rate limit: count recent failed attempts in window
    // This handles dev cold restarts & multi-container scaling.
    const WINDOW_MS = 15 * 60 * 1000; // keep same window
    const LOCKOUT_MS = 5 * 60 * 1000; // existing lockout duration
    const MAX_FAILED = 5;
    const windowIso = new Date(Date.now() - WINDOW_MS).toISOString();
    let persistentFailedCount = 0;
    try {
      const { data: recentFails, error: recentErr } = await supabase
        .from('auth_password_audit')
        .select('id, timestamp, note')
        .eq('source', 'verify_student')
        .eq('user_key', userKey)
        .eq('success', false)
        .gte('timestamp', windowIso);
      if (recentErr) {
        console.warn('[verify_student] Persistent query error:', recentErr.message || recentErr);
      } else {
        persistentFailedCount = Array.isArray(recentFails) ? recentFails.length : 0;
        console.log('[verify_student] Persistent failed count:', persistentFailedCount);
        if (persistentFailedCount >= MAX_FAILED) {
          const lastTs = Math.max(...recentFails.map(r => new Date(r.timestamp).getTime()));
          const withinLockout = Date.now() - lastTs < LOCKOUT_MS;
          console.log('[verify_student] Lockout evaluation -> withinLockout:', withinLockout, 'lastTsDeltaMs:', Date.now() - lastTs);
          if (withinLockout) {
            await insertAudit({ note: 'blocked_persistent_rate_limit' });
            return {
              statusCode: 429,
              headers,
              body: JSON.stringify({ success: false, error: 'Too many attempts. Please wait a few minutes and try again.' })
            };
          }
        }
      }
    } catch (e) {
      console.warn('[verify_student] Persistent rate limit check exception:', e?.message || e);
    }

    // In-memory rate-limit checks (per-IP and per-user-like key)
    const ipCheck = checkAndIncrement(RATE.ipMap, clientIp, false);
    if (ipCheck.blocked) {
      await insertAudit({ note: 'blocked_ip_rate_limit' });
      return {
        statusCode: 429,
        headers,
        body: JSON.stringify({ success: false, error: 'Too many requests from this IP. Try again later.' })
      };
    }

    const userCheck = checkAndIncrement(RATE.userMap, userKey, false);
    if (userCheck.blocked) {
      await insertAudit({ note: 'blocked_user_rate_limit' });
      return {
        statusCode: 429,
        headers,
        body: JSON.stringify({ success: false, error: 'Too many attempts for this user. Try again later.' })
      };
    }

    const normalizedAuthCode = String(auth_code || '').replace(/\D/g, '').slice(-4);
    if (normalizedAuthCode.length !== 4) {
      await insertAudit({ note: 'invalid_auth_code_format' });
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Authentication code must be 4 digits.' })
      };
    }
    // Query the profiles table to find matching student
    // Match all four fields: korean_name, name, grade, class
    // Use case-insensitive matching with ilike for better UX
    const { data, error } = await supabase
      .from('profiles')
  .select('id, username, email, name, korean_name, phone, role')
  .ilike('korean_name', koreanNameValue)
  .ilike('name', englishNameValue)
      .eq('role', 'student');

    if (error) {
      console.error('Database error:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Database error occurred.' 
        })
      };
    }

    const records = Array.isArray(data) ? data : (data ? [data] : []);
    const match = records.find((row) => {
      if (!row || !row.phone) return false;
      const phoneDigits = String(row.phone).replace(/\D/g, '');
      if (phoneDigits.length < 4) return false;
      return phoneDigits.slice(-4) === normalizedAuthCode;
    });

    const hadNameMatches = records.length > 0;
    const hasPhoneData = records.some((row) => row && row.phone);

    if (!match) {
      console.log('Student not found with provided info:', {
        korean_name: koreanNameValue,
        name: englishNameValue,
        matchedOnName: hadNameMatches,
        anyPhonePresent: hasPhoneData
      });
      await insertAudit({ note: 'no_matching_profile' });
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Student not found. Please check your information.' 
        })
      };
    }

    if (records.length > 1) {
      console.log('Multiple records matched names. Selected first phone match.', {
        totalMatches: records.length,
        matchedId: match.id
      });
    }

    await insertAudit({ userId: match.id, actor: match.username || null, success: true, note: 'matched' });
    // Student found
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        student: {
          id: match.id,
          username: match.username,
          email: match.email,
          name: match.name,
          korean_name: match.korean_name
        }
      })
    };

  } catch (err) {
    console.error('Error verifying student:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'Internal server error' })
    };
  }
};
