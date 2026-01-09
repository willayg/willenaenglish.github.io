/**
 * Cloudflare Worker: supabase-auth
 * 
 * Drop-in replacement for the legacy supabase_auth function
 * Uses direct REST calls to Supabase (no SDK required)
 */

const ALLOWED_ORIGINS = [
  'https://willenaenglish.com',
  'https://www.willenaenglish.com',
  'https://willenaenglish.netlify.app',
  'https://willenaenglish.github.io',
  // GitHub Pages preview (pages.dev) used for branch previews
  'https://willenaenglish-github-io.pages.dev',
  // Cloudflare Pages deployments
  'https://cf.willenaenglish.com',
  'https://staging.willenaenglish.com',
  'https://teachers.willenaenglish.com',
  'https://students.willenaenglish.com',
  // API gateway (for internal routing)
  'https://api.willenaenglish.com',
  'http://localhost:8888',
  'http://localhost:9000',
  'http://127.0.0.1:8888',
  'http://127.0.0.1:9000',
];

function getCorsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Cache-Control': 'no-store',
  };
}

function jsonResponse(data, status = 200, origin = '', cookies = []) {
  const headers = {
    'Content-Type': 'application/json',
    ...getCorsHeaders(origin),
  };
  
  // Create response with cookies if provided
  const response = new Response(JSON.stringify(data), { status, headers });
  
  // Add Set-Cookie headers
  cookies.forEach(cookie => {
    response.headers.append('Set-Cookie', cookie);
  });
  
  return response;
}

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  
  cookieHeader.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.trim().split('=');
    if (name) {
      cookies[name] = decodeURIComponent(rest.join('='));
    }
  });
  
  return cookies;
}

function makeCookie(name, value, options = {}) {
  const {
    maxAge = null,
    secure = true,
    httpOnly = true,
    sameSite = 'None',
    path = '/',
    domain = null,
  } = options;

  let cookie = `${name}=${encodeURIComponent(value || '')}`;
  if (maxAge !== null) cookie += `; Max-Age=${maxAge}`;
  if (path) cookie += `; Path=${path}`;
  if (domain) cookie += `; Domain=${domain}`;
  if (secure) cookie += '; Secure';
  if (httpOnly) cookie += '; HttpOnly';
  if (sameSite) cookie += `; SameSite=${sameSite}`;
  
  return cookie;
}

function isLocalDev(request) {
  // Check both Host (worker's address) and Origin (caller's address)
  const host = request.headers.get('Host') || '';
  const origin = request.headers.get('Origin') || '';
  return host.startsWith('localhost:') || host.startsWith('127.0.0.1') ||
         origin.includes('localhost:') || origin.includes('127.0.0.1');
}

function getCookieDomain(request) {
  const host = request.headers.get('Host') || '';
  if (host.includes('willenaenglish.com')) {
    return '.willenaenglish.com';
  }
  return null;
}

// Verify access token with Supabase
async function verifyToken(env, token) {
  if (!token) return null;
  
  try {
    const resp = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'apikey': env.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (!resp.ok) return null;
    const data = await resp.json();
    return data || null;
  } catch {
    return null;
  }
}

// Fetch profile from database
async function fetchProfile(env, userId, fields = '*') {
  const resp = await fetch(
    `${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=${fields}`,
    {
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      },
    }
  );
  
  if (!resp.ok) return null;
  const data = await resp.json();
  return data && data[0] ? data[0] : null;
}

// Update profile
async function updateProfile(env, userId, updates) {
  const resp = await fetch(
    `${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`,
    {
      method: 'PATCH',
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(updates),
    }
  );
  
  return resp.ok;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const corsHeaders = getCorsHeaders(origin);
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: corsHeaders });
    }
    
    const action = url.searchParams.get('action');
    const isDev = isLocalDev(request);
    const cookieDomain = getCookieDomain(request);
    
    // Cookie options based on environment
    const cookieOpts = {
      maxAge: 60 * 60 * 24 * 30, // 30 days
      sameSite: isDev ? 'Lax' : 'None',
      secure: !isDev,
      domain: cookieDomain,
    };
    
    try {
      // ===== DEBUG =====
      if (action === 'debug') {
        return jsonResponse({
          success: true,
          hasSupabaseUrl: !!env.SUPABASE_URL,
          hasAnonKey: !!env.SUPABASE_ANON_KEY,
          hasServiceRole: !!env.SUPABASE_SERVICE_KEY,
          runtime: 'cloudflare-workers',
        }, 200, origin);
      }
      
      // ===== COOKIE ECHO (diagnostic) =====
      if (action === 'cookie_echo') {
        const cookieHeader = request.headers.get('Cookie') || '';
        const hasAccess = /(?:^|;\s*)sb_access=/.test(cookieHeader);
        const hasRefresh = /(?:^|;\s*)sb_refresh=/.test(cookieHeader);
        return jsonResponse({
          success: true,
          origin: origin || null,
          host: request.headers.get('Host') || null,
          hasAccess,
          hasRefresh,
        }, 200, origin);
      }
      
      // ===== GET EMAIL BY USERNAME =====
      if (action === 'get_email_by_username') {
        const username = url.searchParams.get('username');
        if (!username) {
          return jsonResponse({ success: false, error: 'Missing username' }, 400, origin);
        }
        
        const resp = await fetch(
          `${env.SUPABASE_URL}/rest/v1/profiles?username=eq.${encodeURIComponent(username)}&select=email,approved`,
          {
            headers: {
              'apikey': env.SUPABASE_SERVICE_KEY,
              'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
            },
          }
        );
        
        const data = await resp.json();
        if (!data || !data[0]) {
          return jsonResponse({ success: false, error: 'Username not found' }, 404, origin);
        }
        if (!data[0].approved) {
          return jsonResponse({ success: false, error: 'User not approved' }, 403, origin);
        }
        
        return jsonResponse({ success: true, email: data[0].email }, 200, origin);
      }
      
      // ===== LOGIN =====
      if (action === 'login' && request.method === 'POST') {
        const body = await request.json();
        const { email, password } = body;
        
        if (!email || !password) {
          return jsonResponse({ success: false, error: 'Missing credentials' }, 400, origin);
        }
        
        // Check if user is approved (parallel with auth)
        const profilePromise = fetch(
          `${env.SUPABASE_URL}/rest/v1/profiles?email=eq.${encodeURIComponent(email)}&select=id,approved`,
          {
            headers: {
              'apikey': env.SUPABASE_SERVICE_KEY,
              'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
            },
          }
        ).then(r => r.json());
        
        // Authenticate with Supabase
        const authPromise = fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': env.SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ email, password }),
        });
        
        const [profileData, authResp] = await Promise.all([profilePromise, authPromise]);
        
        // Check approval
        const profile = profileData && profileData[0];
        if (!profile || !profile.approved) {
          return jsonResponse({ success: false, error: 'User not found or not approved' }, 401, origin);
        }
        
        // Process auth response
        const authData = await authResp.json();
        if (!authResp.ok || !authData.access_token) {
          return jsonResponse(
            { success: false, error: authData.error_description || 'Invalid credentials' },
            401,
            origin
          );
        }
        
        // Set cookies
        const cookies = [
          makeCookie('sb_access', authData.access_token, cookieOpts),
          makeCookie('sb_refresh', authData.refresh_token || '', cookieOpts),
        ];
        
        // Always return tokens in body so client can store in localStorage as fallback
        // for browsers that block third-party/cross-site cookies
        const responseBody = {
          success: true,
          user: authData.user,
          access_token: authData.access_token,
          refresh_token: authData.refresh_token || '',
        };
        
        return jsonResponse(responseBody, 200, origin, cookies);
      }
      
      // ===== GET PROFILE ID =====
      if (action === 'get_profile_id') {
        const authUserId = url.searchParams.get('auth_user_id');
        if (!authUserId) {
          return jsonResponse({ success: false, error: 'Missing auth_user_id' }, 400, origin);
        }
        
        const resp = await fetch(
          `${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(authUserId)}&select=id`,
          {
            headers: {
              'apikey': env.SUPABASE_SERVICE_KEY,
              'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
            },
          }
        );
        
        const data = await resp.json();
        if (!resp.ok || !data || !data[0]) {
          return jsonResponse({ success: false, error: 'Profile not found' }, 400, origin);
        }
        
        return jsonResponse({ success: true, profile_id: data[0].id }, 200, origin);
      }
      
      // ===== WHOAMI =====
      if (action === 'whoami' && request.method === 'GET') {
        // Support multiple token sources:
        // 1. Cookie (production)
        // 2. Authorization header (API calls)
        // 3. Query param (local dev fallback when cookies don't work cross-origin)
        const cookieHeader = request.headers.get('Cookie') || '';
        const cookies = parseCookies(cookieHeader);
        const authHeader = request.headers.get('Authorization') || '';
        const tokenFromQuery = url.searchParams.get('token');
        
        let token = cookies['sb_access'];
        if (!token && authHeader.startsWith('Bearer ')) {
          token = authHeader.slice(7);
        }
        if (!token && tokenFromQuery) {
          token = tokenFromQuery;
        }
        
        if (!token) {
          return jsonResponse({ success: false, error: 'Not signed in' }, 401, origin);
        }
        
        const user = await verifyToken(env, token);
        if (!user) {
          return jsonResponse({ success: false, error: 'Not signed in' }, 401, origin);
        }
        
        return jsonResponse({
          success: true,
          user_id: user.id,
          email: user.email,
        }, 200, origin);
      }
      
      // ===== GET PROFILE NAME =====
      if (action === 'get_profile_name' && request.method === 'GET') {
        // Support multiple token sources (same as whoami)
        const cookieHeader = request.headers.get('Cookie') || '';
        const cookies = parseCookies(cookieHeader);
        const authHeader = request.headers.get('Authorization') || '';
        const tokenFromQuery = url.searchParams.get('token');
        
        let token = cookies['sb_access'];
        if (!token && authHeader.startsWith('Bearer ')) {
          token = authHeader.slice(7);
        }
        if (!token && tokenFromQuery) {
          token = tokenFromQuery;
        }
        
        if (!token) {
          return jsonResponse({ success: false, error: 'Not signed in' }, 401, origin);
        }
        
        const user = await verifyToken(env, token);
        if (!user) {
          return jsonResponse({ success: false, error: 'Not signed in' }, 401, origin);
        }
        
        const profile = await fetchProfile(env, user.id);
        if (!profile) {
          return jsonResponse({ success: false, error: 'User not found' }, 404, origin);
        }
        
        const koreanName = profile.korean_name || profile.koreanname || profile.kor_name || null;
        const classVal = profile.class || profile.class_name || null;
        
        return jsonResponse({
          success: true,
          name: profile.name,
          username: profile.username,
          avatar: profile.avatar,
          korean_name: koreanName,
          class: classVal,
        }, 200, origin);
      }
      
      // ===== GET PROFILE (full) =====
      if (action === 'get_profile' && request.method === 'GET') {
        let userId = url.searchParams.get('user_id');
        
        if (!userId) {
          const cookieHeader = request.headers.get('Cookie') || '';
          const cookies = parseCookies(cookieHeader);
          const token = cookies['sb_access'];
          
          if (!token) {
            return jsonResponse({ success: false, error: 'Not signed in' }, 401, origin);
          }
          
          const user = await verifyToken(env, token);
          if (!user) {
            return jsonResponse({ success: false, error: 'Not signed in' }, 401, origin);
          }
          userId = user.id;
        }
        
        const profile = await fetchProfile(env, userId);
        if (!profile) {
          return jsonResponse({ success: false, error: 'User not found' }, 404, origin);
        }
        
        const koreanName = profile.korean_name || profile.koreanname || null;
        const classVal = profile.class || profile.class_name || null;
        
        return jsonResponse({
          success: true,
          name: profile.name,
          email: profile.email,
          approved: profile.approved,
          role: profile.role,
          username: profile.username,
          avatar: profile.avatar,
          korean_name: koreanName,
          class: classVal,
        }, 200, origin);
      }
      
      // ===== GET ROLE =====
      if (action === 'get_role') {
        const userId = url.searchParams.get('user_id');
        if (!userId) {
          return jsonResponse({ success: false, error: 'Missing user_id' }, 400, origin);
        }
        
        const profile = await fetchProfile(env, userId, 'role');
        if (!profile) {
          return jsonResponse({ success: false, error: 'User not found' }, 404, origin);
        }
        
        return jsonResponse({ success: true, role: profile.role }, 200, origin);
      }
      
      // ===== UPDATE AVATAR =====
      if (action === 'update_profile_avatar' && request.method === 'POST') {
        // CSRF check
        const referer = request.headers.get('Referer') || '';
        const okOrigin = ALLOWED_ORIGINS.includes(origin);
        const okReferer = ALLOWED_ORIGINS.some(p => referer.startsWith(p + '/'));
        
        if (!okOrigin && !okReferer) {
          return jsonResponse({ success: false, error: 'CSRF check failed' }, 403, origin);
        }
        
        const cookieHeader = request.headers.get('Cookie') || '';
        const cookies = parseCookies(cookieHeader);
        const token = cookies['sb_access'];
        
        if (!token) {
          return jsonResponse({ success: false, error: 'Not signed in' }, 401, origin);
        }
        
        const user = await verifyToken(env, token);
        if (!user) {
          return jsonResponse({ success: false, error: 'Not signed in' }, 401, origin);
        }
        
        const body = await request.json();
        const { avatar } = body;
        
        if (!avatar || typeof avatar !== 'string') {
          return jsonResponse({ success: false, error: 'Missing avatar' }, 400, origin);
        }
        
        const success = await updateProfile(env, user.id, { avatar });
        if (!success) {
          return jsonResponse({ success: false, error: 'Update failed' }, 500, origin);
        }
        
        return jsonResponse({ success: true }, 200, origin);
      }
      
      // ===== LOGOUT =====
      if (action === 'logout') {
        const clearOpts = { ...cookieOpts, maxAge: 0 };
        const cookies = [
          makeCookie('sb_access', '', clearOpts),
          makeCookie('sb_refresh', '', clearOpts),
        ];
        
        return jsonResponse({ success: true }, 200, origin, cookies);
      }
      
      // ===== REFRESH =====
      if (action === 'refresh' && request.method === 'GET') {
        const cookieHeader = request.headers.get('Cookie') || '';
        const cookies = parseCookies(cookieHeader);
        const refreshToken = cookies['sb_refresh'];
        
        if (!refreshToken) {
          return jsonResponse({ success: false, message: 'No refresh token' }, 200, origin);
        }
        
        try {
          const resp = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': env.SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({ refresh_token: refreshToken }),
          });
          
          const data = await resp.json();
          if (!resp.ok || !data.access_token) {
            return jsonResponse({ success: false, message: 'Refresh failed' }, 200, origin);
          }
          
          const newCookies = [
            makeCookie('sb_access', data.access_token, cookieOpts),
            makeCookie('sb_refresh', data.refresh_token || refreshToken, cookieOpts),
          ];
          
          return jsonResponse({ success: true }, 200, origin, newCookies);
        } catch {
          return jsonResponse({ success: false, message: 'Refresh failed' }, 200, origin);
        }
      }
      
      // ===== CHANGE PASSWORD =====
      if (action === 'change_password' && request.method === 'POST') {
        const cookieHeader = request.headers.get('Cookie') || '';
        const cookies = parseCookies(cookieHeader);
        const token = cookies['sb_access'];
        
        if (!token) {
          return jsonResponse({ success: false, error: 'Not signed in' }, 401, origin);
        }
        
        const user = await verifyToken(env, token);
        if (!user) {
          return jsonResponse({ success: false, error: 'Not signed in' }, 401, origin);
        }
        
        const body = await request.json();
        const { current_password, new_password } = body;
        
        if (!current_password || !new_password) {
          return jsonResponse({ success: false, error: 'Missing credentials' }, 400, origin);
        }
        if (String(new_password).length < 6) {
          return jsonResponse({ success: false, error: 'Password too short' }, 400, origin);
        }
        
        // Verify current password
        const authResp = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': env.SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ email: user.email, password: current_password }),
        });
        
        if (!authResp.ok) {
          return jsonResponse({ success: false, error: 'Incorrect current password', error_code: 'bad_current' }, 403, origin);
        }
        
        // Update password using admin API
        const updateResp = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${user.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'apikey': env.SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          },
          body: JSON.stringify({ password: new_password }),
        });
        
        if (!updateResp.ok) {
          return jsonResponse({ success: false, error: 'Update failed' }, 400, origin);
        }
        
        return jsonResponse({ success: true }, 200, origin);
      }
      
      // ===== CHANGE EMAIL =====
      if (action === 'change_email' && request.method === 'POST') {
        const cookieHeader = request.headers.get('Cookie') || '';
        const cookies = parseCookies(cookieHeader);
        const token = cookies['sb_access'];
        
        if (!token) {
          return jsonResponse({ success: false, error: 'Not signed in' }, 401, origin);
        }
        
        const user = await verifyToken(env, token);
        if (!user) {
          return jsonResponse({ success: false, error: 'Not signed in' }, 401, origin);
        }
        
        const body = await request.json();
        const { current_password, new_email } = body;
        
        if (!current_password || !new_email) {
          return jsonResponse({ success: false, error: 'Missing credentials' }, 400, origin);
        }
        
        const emailNorm = String(new_email).trim().toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
        if (!emailRegex.test(emailNorm)) {
          return jsonResponse({ success: false, error: 'Invalid email address', error_code: 'invalid_email' }, 400, origin);
        }
        
        // Verify current password
        const authResp = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': env.SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ email: user.email, password: current_password }),
        });
        
        if (!authResp.ok) {
          return jsonResponse({ success: false, error: 'Incorrect current password', error_code: 'bad_current' }, 403, origin);
        }
        
        // Check if email already in use
        const existingResp = await fetch(
          `${env.SUPABASE_URL}/rest/v1/profiles?email=eq.${encodeURIComponent(emailNorm)}&select=id`,
          {
            headers: {
              'apikey': env.SUPABASE_SERVICE_KEY,
              'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
            },
          }
        );
        const existing = await existingResp.json();
        if (existing && existing.length > 0) {
          return jsonResponse({ success: false, error: 'Email already in use', error_code: 'email_in_use' }, 400, origin);
        }
        
        // Update auth user email
        const updateResp = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${user.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'apikey': env.SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          },
          body: JSON.stringify({ email: emailNorm }),
        });
        
        if (!updateResp.ok) {
          return jsonResponse({ success: false, error: 'Update failed' }, 400, origin);
        }
        
        // Update profiles table
        await updateProfile(env, user.id, { email: emailNorm });
        
        return jsonResponse({ success: true }, 200, origin);
      }
      
      // ===== WORKSHEET OPERATIONS =====
      // list_worksheets action
      if (action === 'list_worksheets') {
        const params = url.searchParams;
        const fieldsParam = params.get('fields');
        const limit = parseInt(params.get('limit')) || 50;
        const offset = parseInt(params.get('offset')) || 0;
        const idFilter = params.get('id');
        const typeFilter = params.get('type');
        const searchQuery = params.get('search');
        const bookFilter = params.get('book');
        
        // Build select clause
        let selectClause = fieldsParam || '*';
        
        // Build query URL
        let queryUrl = `${env.SUPABASE_URL}/rest/v1/worksheets?select=${encodeURIComponent(selectClause)}`;
        
        // Add filters
        if (idFilter) {
          queryUrl += `&user_id=eq.${encodeURIComponent(idFilter)}`;
        }
        if (typeFilter) {
          queryUrl += `&worksheet_type=eq.${encodeURIComponent(typeFilter)}`;
        }
        if (searchQuery) {
          queryUrl += `&or=(title.ilike.%25${encodeURIComponent(searchQuery)}%25,book.ilike.%25${encodeURIComponent(searchQuery)}%25,unit.ilike.%25${encodeURIComponent(searchQuery)}%25)`;
        }
        if (bookFilter) {
          queryUrl += `&book=ilike.%25${encodeURIComponent(bookFilter)}%25`;
        }
        
        // Add pagination and ordering
        queryUrl += `&order=created_at.desc&offset=${offset}&limit=${limit}`;
        
        const resp = await fetch(queryUrl, {
          headers: {
            'apikey': env.SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
            'Prefer': 'count=exact',
          },
        });
        
        if (!resp.ok) {
          const errText = await resp.text();
          return jsonResponse({ success: false, error: errText }, resp.status, origin);
        }
        
        const data = await resp.json();
        const totalCount = resp.headers.get('content-range')?.split('/')[1] || data.length;
        
        return jsonResponse({ success: true, data, totalCount: parseInt(totalCount) }, 200, origin);
      }
      
      // save_worksheet action
      if (action === 'save_worksheet') {
        if (method !== 'POST') {
          return jsonResponse({ success: false, error: 'Method not allowed' }, 405, origin);
        }
        
        const body = await request.json();
        
        // Normalize words to array
        let words = body.words;
        if (typeof words === 'string') {
          words = words.split('\n').map(w => w.trim()).filter(w => w.length > 0);
        } else if (Array.isArray(words)) {
          words = words.map(w => typeof w === 'string' ? w.trim() : '').filter(w => w.length > 0);
        } else {
          words = [];
        }
        body.words = words;
        
        // Normalize language_point
        if (typeof body.language_point === 'string') {
          body.language_point = body.language_point.trim() ? [body.language_point.trim()] : [];
        } else if (!Array.isArray(body.language_point)) {
          body.language_point = [];
        }
        
        // Upsert worksheet
        const resp = await fetch(`${env.SUPABASE_URL}/rest/v1/worksheets`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': env.SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
            'Prefer': 'resolution=merge-duplicates',
          },
          body: JSON.stringify(body),
        });
        
        if (!resp.ok) {
          const errText = await resp.text();
          return jsonResponse({ success: false, error: errText }, resp.status, origin);
        }
        
        return jsonResponse({ success: true }, 200, origin);
      }
      
      // delete_worksheet action
      if (action === 'delete_worksheet') {
        if (method !== 'POST') {
          return jsonResponse({ success: false, error: 'Method not allowed' }, 405, origin);
        }
        
        const body = await request.json();
        const { id } = body;
        
        if (!id) {
          return jsonResponse({ success: false, error: 'Missing worksheet id' }, 400, origin);
        }
        
        const resp = await fetch(`${env.SUPABASE_URL}/rest/v1/worksheets?user_id=eq.${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: {
            'apikey': env.SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          },
        });
        
        if (!resp.ok) {
          const errText = await resp.text();
          return jsonResponse({ success: false, error: errText }, resp.status, origin);
        }
        
        return jsonResponse({ success: true }, 200, origin);
      }
      
      // ===== SET STUDENT PASSWORD (Easy Login flow) =====
      // This is called after verify_student succeeds to set a temporary password
      // so the student can be logged in via username/password flow
      if (action === 'set_student_password' && request.method === 'POST') {
        const body = await request.json();
        const { student_id, password } = body;

        if (!student_id || !password) {
          return jsonResponse({ success: false, error: 'Missing student_id or password' }, 400, origin);
        }

        if (String(password).length < 6) {
          return jsonResponse({ success: false, error: 'Password too short' }, 400, origin);
        }

        // Verify the student exists and is a student role
        const profileResp = await fetch(
          `${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(student_id)}&select=id,role,approved`,
          {
            headers: {
              'apikey': env.SUPABASE_SERVICE_KEY,
              'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
            },
          }
        );

        const profiles = await profileResp.json();
        if (!profiles || !profiles[0]) {
          return jsonResponse({ success: false, error: 'Student not found' }, 404, origin);
        }

        const profile = profiles[0];
        if (profile.role !== 'student') {
          return jsonResponse({ success: false, error: 'Not a student account' }, 403, origin);
        }

        // Update password using admin API
        const updateResp = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${student_id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'apikey': env.SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          },
          body: JSON.stringify({ password }),
        });

        if (!updateResp.ok) {
          const errText = await updateResp.text();
          console.error('[set_student_password] Update failed:', updateResp.status, errText);
          return jsonResponse({ success: false, error: 'Password update failed' }, 400, origin);
        }

        return jsonResponse({ success: true }, 200, origin);
      }

      // ===== ACTION NOT FOUND =====
      return jsonResponse({ success: false, error: 'Action not found' }, 404, origin);
      
    } catch (error) {
      console.error('[supabase-auth] Error:', error);
      return jsonResponse(
        { success: false, error: error.message || 'Internal error' },
        500,
        origin
      );
    }
  },
};
