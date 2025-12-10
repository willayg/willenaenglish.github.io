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
  // CORS headers - handle credentialed requests from custom domain
  const origin = event.headers?.origin || event.headers?.Origin || '';
  const allowedOrigins = [
    'https://willenaenglish.com',
    'https://www.willenaenglish.com',
    'https://willenaenglish.github.io',
    'https://willenaenglish.netlify.app',
    'http://localhost:8888',
    'http://localhost:9000',
    'http://localhost:3000'
  ];
  
  // Use specific origin if it's in our allowed list, otherwise use the first allowed origin
  const allowedOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  
  const headers = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
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

  // Rate limiter: prefer Upstash Redis (process-shared), fall back to simple
  // in-memory maps while container is warm. Upstash credentials must be set
  // in `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
  const useUpstash = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
  let redisClient = null;

  if (useUpstash) {
    try {
      const upstash = await import('@upstash/redis');
      const Redis = upstash.Redis || upstash.default?.Redis || upstash.default || upstash;
      redisClient = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN });
    } catch (err) {
      try {
        const { Redis } = require('@upstash/redis');
        redisClient = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN });
      } catch (err2) {
        console.debug('Upstash init failed, falling back to memory rate limiter', err, err2);
        redisClient = null;
      }
    }
  }

  if (!global.__verify_student_rate) {
    global.__verify_student_rate = { ipMap: new Map(), userMap: new Map() };
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

    // Robust body parsing - handle string, object, null/undefined
    let body;
    if (!event.body) {
      console.error('verify_student: event.body is empty or undefined');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Invalid JSON body' })
      };
    }
    
    if (typeof event.body === 'object') {
      // Netlify may have already parsed the body
      body = event.body;
    } else {
      try {
        body = JSON.parse(event.body);
      } catch (parseErr) {
        console.error('verify_student: JSON parse failed for body:', event.body?.substring?.(0, 100) || event.body);
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: 'Invalid JSON body' })
        };
      }
    }
    
    if (!body || typeof body !== 'object') {
      console.error('verify_student: parsed body is not an object:', typeof body);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Invalid JSON body' })
      };
    }
    
    const { korean_name, name, auth_code } = body;

    if (!korean_name || !name || !auth_code) {
      console.debug('Missing fields:', { korean_name: !!korean_name, name: !!name, auth_code: !!auth_code });
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Missing required fields' })
      };
    }

    const koreanNameValue = String(korean_name).trim();
    const englishNameValue = String(name).trim();

    const normalizeForMatch = (val) =>
      (val || '')
        .toString()
        .trim()
        .normalize('NFC')
        .replace(/\s+/g, '')
        .toLowerCase();

    const buildContainsPattern = (val) => {
      if (!val) return null;
      const escaped = val.replace(/[%_]/g, (ch) => `\\${ch}`);
      return `%${escaped}%`;
    };

    const normalizedKoreanInput = normalizeForMatch(koreanNameValue);
    const normalizedEnglishInput = normalizeForMatch(englishNameValue);

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

    const redisKeyFor = (kind, key, suffix) => `verify:${kind}:${key}${suffix ? `:${suffix}` : ''}`;

    const checkAndIncrementInMemory = (map, key, success) => {
      const nowLocal = Date.now();
      let entry = map.get(key);
      if (!entry) {
        entry = { count: 0, firstAt: nowLocal, lockedUntil: 0 };
        map.set(key, entry);
      }

      if (entry.lockedUntil && entry.lockedUntil > nowLocal) {
        return { blocked: true, retryAfterMs: entry.lockedUntil - nowLocal };
      }

      if (success) {
        map.delete(key);
        return { blocked: false };
      }

      if (nowLocal - entry.firstAt > WINDOW_MS) {
        entry.count = 0;
        entry.firstAt = nowLocal;
      }

      entry.count += 1;
      if (entry.count >= MAX_FAILED) {
        entry.lockedUntil = nowLocal + LOCKOUT_MS;
        return { blocked: true, retryAfterMs: LOCKOUT_MS };
      }

      return { blocked: false };
    };

    const checkAndIncrementRedis = async (kind, key, success) => {
      if (!redisClient) return checkAndIncrementInMemory(RATE[`${kind}Map`], key, success);

      const countKey = redisKeyFor(kind, key, 'count');
      const lockKey = redisKeyFor(kind, key, 'lock');

      try {
        if (success) {
          try { await redisClient.del(countKey); await redisClient.del(lockKey); } catch (e) { console.debug('[RATE] redis clear failed:', e.message || e); }
          return { blocked: false };
        }

        const lockedUntilStr = await redisClient.get(lockKey);
        if (lockedUntilStr) {
          const lockedUntil = parseInt(lockedUntilStr, 10);
          if (!Number.isNaN(lockedUntil) && lockedUntil > Date.now()) {
            return { blocked: true, retryAfterMs: lockedUntil - Date.now() };
          }
        }

        const count = await redisClient.incr(countKey);
        if (count === 1) {
          await redisClient.expire(countKey, Math.ceil(WINDOW_MS / 1000));
        }

        if (count >= MAX_FAILED) {
          const until = Date.now() + LOCKOUT_MS;
          await redisClient.set(lockKey, String(until), { ex: Math.ceil(LOCKOUT_MS / 1000) });
          return { blocked: true, retryAfterMs: LOCKOUT_MS };
        }

        return { blocked: false };
      } catch (e) {
        console.debug('[RATE] redis operation failed, falling back to memory:', e.message || e);
        return checkAndIncrementInMemory(RATE[`${kind}Map`], key, success);
      }
    };

    const checkAndIncrement = async (map, key, success) => {
      // map is either RATE.ipMap or RATE.userMap; map identity tells us kind
      if (redisClient) {
        const kind = map === RATE.ipMap ? 'ip' : 'user';
        return await checkAndIncrementRedis(kind, key, success);
      }
      return checkAndIncrementInMemory(map, key, success);
    };

  console.debug('Received verification request:', { korean_name: koreanNameValue, name: englishNameValue });

    if (!koreanNameValue || !englishNameValue) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Missing required fields' })
      };
    }

    const normalizedAuthCode = String(auth_code).replace(/\D/g, '').slice(-4);
    if (normalizedAuthCode.length !== 4) {
      // Log attempt (we'll create supabase client below and insert if possible)
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Authentication code must be 4 digits.' })
      };
    }

    // Initialize Supabase client (use same env names as supabase_auth.js)
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

    // Rate-limit checks (per-IP and per-user-like key)
    const userKey = `user:${koreanNameValue.toLowerCase()}|${englishNameValue.toLowerCase()}`;
    const ipCheck = await checkAndIncrement(RATE.ipMap, clientIp, false);
    if (ipCheck.blocked) {
      // Try to write audit record for blocked attempt, but don't fail if insert errors
      try {
        const { data: _d, error: _err } = await supabase.from('auth_password_audit').insert([{ user_id: null, actor: null, source: 'verify_student', ip: clientIp, action: 'easy_login_attempt', success: false, timestamp: new Date().toISOString(), note: 'blocked_ip_rate_limit' }]);
        if (_err) console.debug('[AUDIT] IP block insert failed (supabase):', _err.message || _err);
      } catch (e) {
        console.debug('[AUDIT] IP block insert threw:', e.message || e);
      }

      return {
        statusCode: 429,
        headers,
        body: JSON.stringify({ success: false, error: 'Too many requests from this IP. Try again later.' })
      };
    }

    const userCheck = await checkAndIncrement(RATE.userMap, userKey, false);
    if (userCheck.blocked) {
      try {
        const { data: _d2, error: _err2 } = await supabase.from('auth_password_audit').insert([{ user_id: null, actor: null, source: 'verify_student', ip: clientIp, action: 'easy_login_attempt', success: false, timestamp: new Date().toISOString(), note: 'blocked_user_rate_limit' }]);
        if (_err2) console.debug('[AUDIT] User block insert failed (supabase):', _err2.message || _err2);
      } catch (e) {
        console.debug('[AUDIT] User block insert threw:', e.message || e);
      }

      return {
        statusCode: 429,
        headers,
        body: JSON.stringify({ success: false, error: 'Too many attempts for this user. Try again later.' })
      };
    }

    const fetchCandidates = async (kPattern, ePattern, limit = 50) => {
      let query = supabase
        .from('profiles')
        .select('id, username, email, name, korean_name, phone, role')
        .eq('role', 'student')
        .limit(limit);

      if (kPattern) {
        query = query.ilike('korean_name', kPattern);
      }
      if (ePattern) {
        query = query.ilike('name', ePattern);
      }

      return query;
    };

    const patternVariants = [
      { korean: koreanNameValue, english: englishNameValue },
      { korean: buildContainsPattern(koreanNameValue), english: buildContainsPattern(englishNameValue) },
      { korean: null, english: buildContainsPattern(englishNameValue) },
      { korean: buildContainsPattern(koreanNameValue), english: null }
    ].filter((variant) => variant.korean || variant.english);

    let records = [];
    let lastQueryError = null;

    for (const variant of patternVariants) {
      const { data: variantData, error: variantError } = await fetchCandidates(variant.korean, variant.english);
      if (variantError) {
        lastQueryError = variantError;
        continue;
      }
      if (variantData && variantData.length) {
        records = variantData;
        break;
      }
    }

    if (!records.length && lastQueryError) {
      console.error('Database error (variants):', lastQueryError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Database error occurred.'
        })
      };
    }

    if (!records.length) {
      // Final attempt: grab a small sample of students to avoid empty array due to strict filters
      const { data: fallbackData, error: fallbackError } = await fetchCandidates(null, null, 25);
      if (fallbackError) {
        console.error('Database error (fallback):', fallbackError);
      } else if (fallbackData && fallbackData.length) {
        records = fallbackData;
      }
    }

    const normalizedRecords = Array.isArray(records) ? records : (records ? [records] : []);
    const match = normalizedRecords.find((row) => {
      if (!row || !row.phone) return false;
      const normalizedRowKorean = normalizeForMatch(row.korean_name);
      const normalizedRowEnglish = normalizeForMatch(row.name);

      const koreanMatches = normalizedKoreanInput
        ? (normalizedRowKorean.includes(normalizedKoreanInput) || normalizedKoreanInput.includes(normalizedRowKorean))
        : false;
      const englishMatches = normalizedEnglishInput
        ? (normalizedRowEnglish.includes(normalizedEnglishInput) || normalizedEnglishInput.includes(normalizedRowEnglish))
        : false;

      if (!koreanMatches || !englishMatches) {
        return false;
      }

      const phoneDigits = String(row.phone).replace(/\D/g, '');
      if (phoneDigits.length < 4) return false;
      return phoneDigits.slice(-4) === normalizedAuthCode;
    });

    const hadNameMatches = normalizedRecords.length > 0;
    const hasPhoneData = normalizedRecords.some((row) => row && row.phone);

    if (!match) {
      console.debug('Student not found with provided info:', {
        korean_name: koreanNameValue,
        name: englishNameValue,
        matchedOnName: hadNameMatches,
        anyPhonePresent: hasPhoneData
      });

      // Audit failed login
      try {
        const { data: _d3, error: _err3 } = await supabase.from('auth_password_audit').insert([{
          user_id: null,
          actor: null,
          source: 'verify_student',
          ip: clientIp,
          action: 'easy_login_attempt',
          success: false,
          timestamp: new Date().toISOString(),
          note: `failed_match|korean:${koreanNameValue}|english:${englishNameValue}`
        }]);
        if (_err3) console.debug('[AUDIT] Failed login insert failed (supabase):', _err3.message || _err3);
      } catch (e) {
        console.debug('[AUDIT] Failed login insert threw:', e.message || e);
      }

      // Mark this as a failed attempt for rate limiting
      await checkAndIncrement(RATE.ipMap, clientIp, false);
      await checkAndIncrement(RATE.userMap, userKey, false);

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
      console.debug('Multiple records matched names. Selected first phone match.', {
        totalMatches: records.length,
        matchedId: match.id
      });
    }

    // Student found
    // Audit successful login
    try {
      const { data: _d4, error: _err4 } = await supabase.from('auth_password_audit').insert([{
        user_id: match.id,
        actor: match.username,
        source: 'verify_student',
        ip: clientIp,
        action: 'easy_login_attempt',
        success: true,
        timestamp: new Date().toISOString(),
        note: 'success'
      }]);
      if (_err4) console.debug('[AUDIT] Success login insert failed (supabase):', _err4.message || _err4);
    } catch (e) {
      console.debug('[AUDIT] Success login insert threw:', e.message || e);
    }

    // Clear rate limiters on success
    await checkAndIncrement(RATE.ipMap, clientIp, true);
    await checkAndIncrement(RATE.userMap, userKey, true);

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
