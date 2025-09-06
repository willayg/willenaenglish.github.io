const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  console.log('=== FUNCTION START ===');
  console.log('Received event:', event.httpMethod, event.path);
  console.log('Event body:', event.body);
  console.log('Environment check:', {
    SUPABASE_URL: process.env.SUPABASE_URL ? 'PRESENT' : 'MISSING',
    SUPABASE_KEY: process.env.SUPABASE_KEY ? 'PRESENT' : 'MISSING', 
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'PRESENT' : 'MISSING',
    NODE_ENV: process.env.NODE_ENV
  });
  
  // Helpers for cookie-based sessions
  function parseCookies(header) {
    const out = {};
    if (!header) return out;
    header.split(/;\s*/).forEach(kv => {
      const idx = kv.indexOf('=');
      if (idx > 0) {
        const k = kv.slice(0, idx).trim();
        const v = kv.slice(idx + 1).trim();
        if (k && !(k in out)) out[k] = decodeURIComponent(v);
      }
    });
    return out;
  }

  function makeCookie(name, value, { maxAge, expires, secure = true, httpOnly = true, sameSite = 'Lax', path = '/' } = {}) {
    let str = `${name}=${encodeURIComponent(value || '')}`;
    if (maxAge != null) str += `; Max-Age=${maxAge}`;
    if (expires) str += `; Expires=${expires.toUTCString()}`;
    if (path) str += `; Path=${path}`;
    if (secure) str += '; Secure';
    if (httpOnly) str += '; HttpOnly';
    if (sameSite) str += `; SameSite=${sameSite}`;
    return str;
  }

  // Determine if current request is from a local dev origin (e.g., http://localhost:8888 or :9000)
  function isLocalDev(event) {
    try {
      const headers = event.headers || {};
      const host = String(headers.host || headers.Host || headers["x-forwarded-host"] || '').toLowerCase();
      // Netlify/CLIs typically use localhost or 127.0.0.1 on various ports
      if (host.includes('localhost') || host.includes('127.0.0.1')) return true;
      // Fallback: parse rawUrl to detect scheme/host
      if (event.rawUrl) {
        const u = new URL(event.rawUrl);
        if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return true;
      }
    } catch {}
    return false;
  }

  async function getUserFromCookie(supabase, event) {
    const headers = event.headers || {};
    const authHeader = headers.authorization || headers.Authorization || '';
    let token = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    } else {
      const cookieHeader = (headers.Cookie || headers.cookie) || '';
      const cookies = parseCookies(cookieHeader);
      token = cookies['sb_access'] || null;
    }
    if (!token) return null;
    try {
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data || !data.user) return null;
      return data.user;
    } catch {
      return null;
    }
  }
  // Decode JWT locally to extract the user id (sub), avoids upstream failures
  function getUserIdFromCookie(event) {
    try {
      const cookieHeader = (event.headers && (event.headers.Cookie || event.headers.cookie)) || '';
      const cookies = parseCookies(cookieHeader);
      const access = cookies['sb_access'];
      if (!access) return null;
      const { decodeJwt } = require('jose');
      const payload = decodeJwt(access);
      return payload && payload.sub ? payload.sub : null;
    } catch { return null; }
  }
  
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service role key for uploads
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // --- AUDIO UPLOAD (for TTS mp3 files) ---
    if (event.queryStringParameters && event.queryStringParameters.upload_audio !== undefined) {
      // CORS preflight
      if (event.httpMethod === 'OPTIONS') {
        return {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
          },
          body: ''
        };
      }
      if (event.httpMethod === 'POST') {
        try {
          const parsed = JSON.parse(event.body || '{}');
          const { word, fileDataBase64 } = parsed;
          console.log('[upload_audio] Incoming payload keys:', Object.keys(parsed));
          console.log('[upload_audio] Word:', word);
          if (!word || !fileDataBase64) {
            return {
              statusCode: 400,
              headers: { 'Access-Control-Allow-Origin': '*' },
              body: JSON.stringify({ error: 'Missing word or file data' })
            };
          }
          const safeWord = String(word).trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_\-]/g, '');
          const buffer = Buffer.from(fileDataBase64, 'base64');
          console.log('[upload_audio] Buffer length:', buffer.length, 'bytes');
          const filePath = `${safeWord}.mp3`;
          console.log('[upload_audio] Uploading to bucket "audio" as:', filePath);
          const { data, error } = await supabase.storage
            .from('audio')
            .upload(filePath, buffer, {
              contentType: 'audio/mpeg',
              upsert: true,
            });
          if (error) {
            console.error('[upload_audio] Supabase upload error:', error);
            return {
              statusCode: 500,
              headers: { 'Access-Control-Allow-Origin': '*' },
              body: JSON.stringify({ error: error.message || 'Upload failed', details: error })
            };
          }
          console.log('[upload_audio] Upload success:', data);
          return {
            statusCode: 200,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ success: true, path: data.path })
          };
        } catch (err) {
          console.error('[upload_audio] Handler error:', err);
          return {
            statusCode: 400,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: err.message })
          };
        }
      }
    }

    // --- FEEDBACK STATUS UPDATE ---
    if (event.queryStringParameters && event.queryStringParameters.feedback_update !== undefined && event.httpMethod === 'POST') {
      try {
        const { id, status } = JSON.parse(event.body);
        if (!id || !status) {
          return { statusCode: 400, body: JSON.stringify({ error: 'Missing id or status' }) };
        }
        const { data, error } = await supabase
          .from('feedback')
          .update({ status })
          .eq('id', id)
          .select();
        if (error) {
          return { statusCode: 400, body: JSON.stringify({ error: error.message }) };
        }
        return { statusCode: 200, body: JSON.stringify({ success: true, data }) };
      } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
      }
    }

    // --- FEEDBACK LIST ---
    if (event.queryStringParameters && event.queryStringParameters.feedback_list !== undefined && event.httpMethod === 'GET') {
      try {
        const { data, error } = await supabase
          .from('feedback')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        return { statusCode: 200, body: JSON.stringify(data || []) };
      } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
      }
    }

    // --- FEEDBACK INSERT ---
    if (event.queryStringParameters && event.queryStringParameters.feedback !== undefined && event.httpMethod === 'POST') {
      try {
        const body = JSON.parse(event.body);
        const payload = body.data ? body.data : body;
        const { feedback, module, user_id, username, tool_state, page_url } = payload;
        
        if (!feedback || !user_id) {
          return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
        }

        const { data, error } = await supabase
          .from('feedback')
          .insert([{
            feedback,
            module,
            user_id,
            username,
            tool_state,
            page_url,
            status: 'new',
            created_at: new Date().toISOString()
          }]);

        if (error) throw error;
        return { statusCode: 200, body: JSON.stringify({ success: true, data }) };
      } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
      }
    }

    // --- GET PROFILE (name, email, approval, role, plus korean_name/class if present) ---
    if (event.queryStringParameters && event.queryStringParameters.action === 'get_profile' && event.httpMethod === 'GET') {
      try {
        let userId = event.queryStringParameters.user_id;
        if (!userId) {
          // Prefer validated Supabase auth first, then local decode as a last resort
          const user = await getUserFromCookie(supabase, event);
          userId = user && user.id;
          if (!userId) {
            userId = getUserIdFromCookie(event);
          }
        }
        if (!userId) {
          return { statusCode: 401, body: JSON.stringify({ success: false, error: 'Missing or unauthorized user' }) };
        }
        // Select entire row so we can map optional fields regardless of exact column name
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();
        if (error || !data) {
          return { statusCode: 404, body: JSON.stringify({ success: false, error: 'User not found' }) };
        }
        // Map korean name and class using common aliases
        const koreanName = data.korean_name || data.koreanname || data.kor_name || data.korean || data.name_kr || null;
        const classVal = data.class || data.class_name || data.homeroom || data.grade || data.group || null;
        return {
          statusCode: 200,
          body: JSON.stringify({
            success: true,
            name: data.name,
            email: data.email,
            approved: data.approved,
            role: data.role,
            username: data.username,
            avatar: data.avatar,
            korean_name: koreanName,
            class: classVal
          })
        };
      } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ success: false, error: err.message }) };
      }
    }

    // --- WHOAMI (derive user_id from cookie; local decode first) ---
  if (event.queryStringParameters && event.queryStringParameters.action === 'whoami' && event.httpMethod === 'GET') {
      try {
        // Prefer validated Supabase auth first
        const user = await getUserFromCookie(supabase, event);
        if (user && user.id) {
          return { statusCode: 200, body: JSON.stringify({ success: true, user_id: user.id, email: user.email }) };
        }
        const localId = getUserIdFromCookie(event);
    if (!localId) return { statusCode: 401, body: JSON.stringify({ success: false, error: 'Not signed in' }) };
    return { statusCode: 200, body: JSON.stringify({ success: true, user_id: localId }) };
      } catch (err) {
    return { statusCode: 401, body: JSON.stringify({ success: false, error: 'Not signed in' }) };
      }
    }

    // --- GET PROFILE NAME (name, username, avatar) + optional korean_name/class for fallback ---
    if (event.queryStringParameters && event.queryStringParameters.action === 'get_profile_name' && event.httpMethod === 'GET') {
      try {
        let userId = getUserIdFromCookie(event);
        if (!userId) {
          const user = await getUserFromCookie(supabase, event);
          userId = user && user.id;
        }
        if (!userId) {
          return { statusCode: 401, body: JSON.stringify({ success: false, error: 'Missing or unauthorized user' }) };
        }
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();
        if (error || !data) {
          return { statusCode: 404, body: JSON.stringify({ success: false, error: 'User not found' }) };
        }
        const koreanName = data.korean_name || data.koreanname || data.kor_name || data.korean || data.name_kr || null;
        const classVal = data.class || data.class_name || data.homeroom || data.grade || data.group || null;
        return {
          statusCode: 200,
          body: JSON.stringify({ success: true, name: data.name, username: data.username, avatar: data.avatar, korean_name: koreanName, class: classVal })
        };
      } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ success: false, error: err.message }) };
      }
    }

    // --- UPDATE PROFILE AVATAR ---
    if (event.queryStringParameters && event.queryStringParameters.action === 'update_profile_avatar' && event.httpMethod === 'POST') {
      try {
        let userId = getUserIdFromCookie(event);
        if (!userId) {
          const user = await getUserFromCookie(supabase, event);
          userId = user && user.id;
        }
        if (!userId) {
          return { statusCode: 401, body: JSON.stringify({ success: false, error: 'Missing or unauthorized user' }) };
        }
        const { avatar } = JSON.parse(event.body || '{}');
        if (!avatar || typeof avatar !== 'string') {
          return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Missing avatar' }) };
        }
        const { error } = await supabase
          .from('profiles')
          .update({ avatar })
          .eq('id', userId);
        if (error) {
          return { statusCode: 400, body: JSON.stringify({ success: false, error: error.message }) };
        }
        return { statusCode: 200, body: JSON.stringify({ success: true }) };
      } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ success: false, error: err.message }) };
      }
    }

    // --- UPDATE PROFILE (name/email/password) ---
    if (event.queryStringParameters && event.queryStringParameters.action === 'update_profile' && event.httpMethod === 'POST') {
      try {
        const { user_id, name, email, password, username } = JSON.parse(event.body);
        if (!user_id) {
          return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Missing user_id' }) };
        }
        // Check if user is approved before allowing update
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('approved')
          .eq('id', user_id)
          .single();
        if (profileError || !profile) {
          return { statusCode: 403, body: JSON.stringify({ success: false, error: 'User not found or not approved' }) };
        }
        if (!profile.approved) {
          return { statusCode: 403, body: JSON.stringify({ success: false, error: 'User not approved' }) };
        }
        let updateError = null;
        // Update name/email/username in profiles table
        const updateFields = {};
        if (typeof name === 'string' && name.length > 0) updateFields.name = name;
        if (typeof email === 'string' && email.length > 0) updateFields.email = email;
        if (typeof username === 'string' && username.length > 0) updateFields.username = username;
        if (Object.keys(updateFields).length > 0) {
          const { error } = await supabase
            .from('profiles')
            .update(updateFields)
            .eq('id', user_id);
          if (error) updateError = error;
        }
        // Update password via Supabase Auth API (use updateUserById)
        if (password) {
          const { error } = await supabase.auth.admin.updateUserById(user_id, { password });
          if (error) updateError = error;
        }
        if (updateError) {
          return { statusCode: 400, body: JSON.stringify({ success: false, error: updateError.message }) };
        }
        return { statusCode: 200, body: JSON.stringify({ success: true }) };
      } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ success: false, error: err.message }) };
      }
    }

    // --- GET EMAIL BY USERNAME (only approved users) ---
    if (event.queryStringParameters && event.queryStringParameters.action === 'get_email_by_username' && event.httpMethod === 'GET') {
      try {
        const username = event.queryStringParameters.username;
        if (!username) {
          return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Missing username' }) };
        }
        // Look up email by username in 'profiles' table
        const { data, error } = await supabase
          .from('profiles')
          .select('email, approved')
          .eq('username', username)
          .single();
        if (error || !data) {
          return { statusCode: 404, body: JSON.stringify({ success: false, error: 'Username not found' }) };
        }
        if (!data.approved) {
          return { statusCode: 403, body: JSON.stringify({ success: false, error: 'User not approved' }) };
        }
        return { statusCode: 200, body: JSON.stringify({ success: true, email: data.email }) };
      } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ success: false, error: err.message }) };
      }
    }

    // --- SECURE SIGNUP (create user, send confirmation email, insert profile) ---
    if (event.queryStringParameters && event.queryStringParameters.action === 'signup' && event.httpMethod === 'POST') {
      try {
        const { email, password, name, username } = JSON.parse(event.body);
        if (!email || !password || !name || !username) {
          return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Missing name, email, password, or username' }) };
        }
        // Create user in Supabase Auth (admin)
        const { data: userData, error: signUpError } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true
        });
        if (signUpError || !userData || !userData.user) {
          return { statusCode: 400, body: JSON.stringify({ success: false, error: signUpError ? signUpError.message : 'Sign up failed' }) };
        }
        // Do NOT send invite email; let Supabase send the confirmation email automatically
        // Insert profile row with username
        const { error: profileError } = await supabase
          .from('profiles')
          .insert([{ id: userData.user.id, email, name, username, approved: true, role: 'teacher' }]);
        if (profileError) {
          return { statusCode: 400, body: JSON.stringify({ success: false, error: profileError.message }) };
        }
        return { statusCode: 200, body: JSON.stringify({ success: true, user: { id: userData.user.id, email, name, username } }) };
      } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ success: false, error: err.message }) };
      }
    }

    // --- GOOGLE OAUTH SIGNUP ---
    if (event.queryStringParameters && event.queryStringParameters.action === 'google_oauth_signup' && event.httpMethod === 'GET') {
      // Redirect to Supabase Google OAuth URL
      const redirectTo = `${process.env.SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(process.env.SUPABASE_OAUTH_REDIRECT || 'https://willenaenglish.github.io/Teachers/signup.html')}`;
      return {
        statusCode: 302,
        headers: {
          Location: redirectTo
        },
        body: ''
      };
    }

    // --- TEACHER LOGIN (email/password, only approved users) ---
    if (event.queryStringParameters && event.queryStringParameters.action === 'login' && event.httpMethod === 'POST') {
      try {
        const { email, password } = JSON.parse(event.body || '{}');
        if (!email || !password) {
          return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Missing email or password' }) };
        }
        // Check if user is approved before allowing login
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, approved')
          .eq('email', email)
          .single();
        if (profileError || !profile) {
          return { statusCode: 401, body: JSON.stringify({ success: false, error: 'User not found or not approved' }) };
        }
        if (!profile.approved) {
          return { statusCode: 403, body: JSON.stringify({ success: false, error: 'User not approved' }) };
        }
        // Use Supabase Auth REST directly with ANON key to avoid client-specific issues
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const API_KEY =
          process.env.SUPABASE_ANON_KEY ||
          process.env.SUPABASE_KEY ||
          process.env.supabase_anon_key ||
          process.env.supabase_key;
        if (!SUPABASE_URL || !API_KEY) {
          return { statusCode: 500, body: JSON.stringify({ success: false, error: 'Server misconfigured (auth keys missing)' }) };
        }
        const resp = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': API_KEY },
          body: JSON.stringify({ email, password })
        });
        const js = await resp.json().catch(() => ({}));
        if (!resp.ok || !js || !js.access_token) {
          const msg = js?.error_description || js?.error || 'Invalid credentials';
          return { statusCode: 401, headers: { 'Cache-Control': 'no-store' }, body: JSON.stringify({ success: false, error: msg }) };
        }
        const accessToken = js.access_token;
        const refreshToken = js.refresh_token || null;
        const cookies = [];
        const secureFlag = !isLocalDev(event); // Use Secure in prod; allow non-Secure cookies in local dev (HTTP)
        cookies.push(makeCookie('sb_access', accessToken, { maxAge: 60 * 60, secure: secureFlag, httpOnly: true, sameSite: 'Lax', path: '/' }));
        if (refreshToken) cookies.push(makeCookie('sb_refresh', refreshToken, { maxAge: 60 * 60 * 24 * 7, secure: secureFlag, httpOnly: true, sameSite: 'Lax', path: '/' }));
        return {
          statusCode: 200,
          headers: { 'Set-Cookie': cookies, 'Cache-Control': 'no-store', 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: true, user: js.user || null })
        };
      } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ success: false, error: err.message }) };
      }
    }

    // --- LOGOUT (clear cookies) ---
    if (event.queryStringParameters && event.queryStringParameters.action === 'logout') {
      const expired = new Date(0);
      const secureFlag = !isLocalDev(event);
      return {
        statusCode: 200,
        headers: {
          'Set-Cookie': [
            makeCookie('sb_access', '', { expires: expired, path: '/', secure: secureFlag, httpOnly: true, sameSite: 'Lax' }),
            makeCookie('sb_refresh', '', { expires: expired, path: '/', secure: secureFlag, httpOnly: true, sameSite: 'Lax' })
          ],
          'Cache-Control': 'no-store',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ success: true })
      };
    }

    // --- REFRESH (rotate access token using refresh cookie) ---
    if (event.queryStringParameters && event.queryStringParameters.action === 'refresh' && event.httpMethod === 'GET') {
      try {
        const cookieHeader = (event.headers && (event.headers.Cookie || event.headers.cookie)) || '';
        const cookies = parseCookies(cookieHeader);
        const refreshTok = cookies['sb_refresh'];
        if (!refreshTok) {
          return { statusCode: 401, headers: { 'Cache-Control': 'no-store' }, body: JSON.stringify({ success: false, error: 'No refresh token' }) };
        }
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const API_KEY =
          process.env.SUPABASE_ANON_KEY ||
          process.env.SUPABASE_KEY ||
          process.env.SUPABASE_SERVICE_ROLE_KEY ||
          process.env.supabase_anon_key ||
          process.env.supabase_key ||
          process.env.supabase_service_role_key;
        const resp = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': API_KEY },
          body: JSON.stringify({ refresh_token: refreshTok })
        });
        const js = await resp.json().catch(() => ({}));
        if (!resp.ok || !js || !js.access_token) {
          return { statusCode: 401, headers: { 'Cache-Control': 'no-store' }, body: JSON.stringify({ success: false, error: js?.error_description || js?.error || 'Refresh failed' }) };
        }
        const accessToken = js.access_token;
        // Supabase may rotate refresh_token
        const newRefresh = js.refresh_token || refreshTok;
        const expiresIn = Number(js.expires_in) > 0 ? Number(js.expires_in) : 3600; // seconds

        const cookiesOut = [];
        const secureFlag = !isLocalDev(event);
        cookiesOut.push(
          makeCookie('sb_access', accessToken, { maxAge: expiresIn, secure: secureFlag, httpOnly: true, sameSite: 'Lax', path: '/' })
        );
        // Extend refresh cookie window to 6 months (about 15,552,000 seconds)
        const SIX_MONTHS = 60 * 60 * 24 * 30 * 6; // 6 months
        cookiesOut.push(
          makeCookie('sb_refresh', newRefresh, { maxAge: SIX_MONTHS, secure: secureFlag, httpOnly: true, sameSite: 'Lax', path: '/' })
        );
        return {
          statusCode: 200,
          headers: { 'Set-Cookie': cookiesOut, 'Cache-Control': 'no-store', 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: true, expires_in: expiresIn })
        };
      } catch (err) {
        return { statusCode: 500, headers: { 'Cache-Control': 'no-store' }, body: JSON.stringify({ success: false, error: err.message }) };
      }
    }

    // --- GET USER ROLE ---
    if (event.queryStringParameters && event.queryStringParameters.action === 'get_role' && event.httpMethod === 'GET') {
      try {
        const userId = event.queryStringParameters.user_id;
        if (!userId) {
          return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Missing user_id' }) };
        }
        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .single();
        if (error) {
          return { statusCode: 400, body: JSON.stringify({ success: false, error: error.message }) };
        }
        return { statusCode: 200, body: JSON.stringify({ success: true, role: data.role }) };
      } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ success: false, error: err.message }) };
      }
    }

    // --- GET PROFILE ID BY AUTH USER ID ---
    if (event.queryStringParameters && event.queryStringParameters.action === 'get_profile_id' && event.httpMethod === 'GET') {
      try {
        const authUserId = event.queryStringParameters.auth_user_id;
        if (!authUserId) {
          return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Missing auth_user_id' }) };
        }
        const { data, error } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', authUserId) // Assuming profiles.id matches auth.users.id
          .single();
        if (error) {
          return { statusCode: 400, body: JSON.stringify({ success: false, error: error.message }) };
        }
        return { statusCode: 200, body: JSON.stringify({ success: true, profile_id: data.id }) };
      } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ success: false, error: err.message }) };
      }
    }

    // --- GET TEACHERS (for admin dashboard) ---
    if (event.queryStringParameters && event.queryStringParameters.action === 'get_teachers' && event.httpMethod === 'GET') {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, name, email, approved')
          .eq('role', 'teacher');
        if (error) {
          return { statusCode: 500, body: JSON.stringify([]) };
        }
        return { statusCode: 200, body: JSON.stringify(data) };
      } catch (err) {
        return { statusCode: 500, body: JSON.stringify([]) };
      }
    }

    // --- UPDATE TEACHER APPROVAL (for admin dashboard) ---
    if (event.queryStringParameters && event.queryStringParameters.action === 'update_teacher_approval' && event.httpMethod === 'POST') {
      try {
        const { id, approved } = JSON.parse(event.body);
        if (!id || typeof approved !== 'boolean') {
          return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Missing id or approved' }) };
        }
        const { error } = await supabase
          .from('profiles')
          .update({ approved })
          .eq('id', id);
        if (error) {
          return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message }) };
        }
        return { statusCode: 200, body: JSON.stringify({ success: true }) };
      } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ success: false, error: err.message }) };
      }
    }

    if (event.path.endsWith('/upload_teacher_file') && event.httpMethod === 'POST') {
      // Parse multipart/form-data (you may need a library like busboy or formidable)
      // For simplicity, let's assume you send base64 file data and filename in JSON

      try {
        const { fileName, fileDataBase64 } = JSON.parse(event.body);
        const buffer = Buffer.from(fileDataBase64, 'base64');
        const { data, error } = await supabase.storage
          .from('teacher-files')
          .upload(`uploads/${Date.now()}_${fileName}`, buffer, {
            contentType: 'application/octet-stream',
            upsert: false,
          });

        if (error) {
          throw error;
        }

        return { statusCode: 200, body: JSON.stringify({ path: data.path }) };
      } catch (err) {
        return { statusCode: 400, body: JSON.stringify({ error: err.message }) };
      }
    } else if (event.path.endsWith('/list_teacher_files') && event.httpMethod === 'GET') {
      const { prefix = '', limit = 20, offset = 0 } = event.queryStringParameters || {};

      const { data, error } = await supabase.storage
        .from('teacher-files')
        .list(prefix, {
          limit: Number(limit),
          offset: Number(offset),
          sortBy: { column: 'name', order: 'asc' }
        });

      if (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
      }

      const filesWithUrls = [];
      for (const file of data) {
        if (file.name) {
          const filePath = prefix ? `${prefix}/${file.name}` : file.name;
          const { data: signedData } = await supabase.storage
            .from('teacher-files')
            .createSignedUrl(filePath, 3600);
          filesWithUrls.push({
            name: file.name,
            path: filePath,
            url: signedData?.signedUrl || null,
            updated_at: file.updated_at,
            metadata: file.metadata
          });
        }
      }

      return {
        statusCode: 200,
        body: JSON.stringify(filesWithUrls)
      };
    } else if ((event.path.endsWith('/save_worksheet') && event.httpMethod === 'POST') || (event.queryStringParameters && event.queryStringParameters.feedback !== undefined && event.httpMethod === 'POST')) {
      try {
        const body = JSON.parse(event.body);
        // Feedback insert
        if (body.action === 'insert_feedback' && body.data) {
          const feedback = body.data;
          const { data, error } = await supabase
            .from('feedback')
            .insert([feedback]);
          if (error) {
            return {
              statusCode: 400,
              body: JSON.stringify({ success: false, error: error.message })
            };
          }
          return {
            statusCode: 200,
            body: JSON.stringify({ success: true, data })
          };
        }
        // Worksheet insert (legacy)
        const worksheet = body;
        console.log('worksheet.words:', worksheet.words, typeof worksheet.words); // <--- Add this line

        // Always normalize worksheet.words to an array of trimmed strings
        if (typeof worksheet.words === "string") {
          worksheet.words = worksheet.words
            .split('\n')
            .map(w => w.trim())
            .filter(w => w.length > 0);
        } else if (Array.isArray(worksheet.words)) {
          worksheet.words = worksheet.words
            .map(w => typeof w === "string" ? w.trim() : "")
            .filter(w => w.length > 0);
        } else {
          worksheet.words = [];
        }

        // If language_point should be an array:
        if ('language_point' in worksheet) {
          if (typeof worksheet.language_point === "string") {
            worksheet.language_point = worksheet.language_point.trim() !== ""
              ? [worksheet.language_point.trim()]
              : [];
          } else if (!Array.isArray(worksheet.language_point)) {
            worksheet.language_point = [];
          }
        }

        const { data, error } = await supabase
          .from('worksheets')
          .insert([worksheet]);
        if (error) {
          return {
            statusCode: 400,
            body: JSON.stringify({ success: false, error: error.message })
          };
        }
        return {
          statusCode: 200,
          body: JSON.stringify({ success: true, data })
        };
      } catch (err) {
        return {
          statusCode: 500,
          body: JSON.stringify({ success: false, error: err.message })
        };
      }
    } else if ((event.path.endsWith('/list_worksheets') && event.httpMethod === 'GET') || (event.queryStringParameters && event.queryStringParameters.feedback_list !== undefined && event.httpMethod === 'GET')) {
      try {
        // Feedback admin fetch
        if (event.queryStringParameters && event.queryStringParameters.feedback_list !== undefined) {
          const { data, error } = await supabase
            .from('feedback')
            .select('*')
            .order('created_at', { ascending: false });
          if (error) {
            return {
              statusCode: 500,
              body: JSON.stringify({ error: error.message })
            };
          }
          return {
            statusCode: 200,
            body: JSON.stringify(data)
          };
        }
        // Worksheets fetch (legacy)
        const { data, error } = await supabase
          .from('worksheets')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) {
          return {
            statusCode: 500,
            body: JSON.stringify({ success: false, error: error.message })
          };
        }
        return {
          statusCode: 200,
          body: JSON.stringify({ success: true, data })
        };
      } catch (err) {
        return {
          statusCode: 500,
          body: JSON.stringify({ success: false, error: err.message })
        };
      }
    } else if (event.path.endsWith('/debug') && event.httpMethod === 'GET') {
      // Debug endpoint to check environment variables
      return {
        statusCode: 200,
        body: JSON.stringify({
          hasSupabaseUrl: !!process.env.SUPABASE_URL,
          hasSupabaseKey: !!process.env.SUPABASE_KEY,
          hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
          nodeEnv: process.env.NODE_ENV,
          // Don't expose actual values for security
          supabaseUrlPrefix: process.env.SUPABASE_URL ? process.env.SUPABASE_URL.substring(0, 20) + '...' : 'MISSING'
        })
      };
  } else if (event.path.endsWith('/delete_worksheet') && event.httpMethod === 'POST') {
      // Minimal delete worksheet endpoint
      try {
        const { id } = JSON.parse(event.body);
        if (!id) {
          return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Missing worksheet id' }) };
        }
        const { error } = await supabase
          .from('worksheets')
          .delete()
          .eq('id', id);
        if (error) {
          return { statusCode: 400, body: JSON.stringify({ success: false, error: error.message }) };
        }
        return { statusCode: 200, body: JSON.stringify({ success: true }) };
      } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ success: false, error: err.message }) };
      }
    } else if (event.queryStringParameters && event.queryStringParameters.list === 'game_data' && event.httpMethod === 'GET') {
      // List saved game_data rows (with computed thumbnail from first word image)
      // Also fetch creator usernames from profiles without relying on a FK join.
      try {
        const qs = event.queryStringParameters || {};
        const limit = Number(qs.limit) > 0 ? Number(qs.limit) : 10; // default to latest 10
        const offset = Number(qs.offset) >= 0 ? Number(qs.offset) : 0;

        const { data, error } = await supabase
          .from('game_data')
          .select('id, title, created_at, class, book, unit, created_by, words')
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);
        if (error) throw error;

        const rows = Array.isArray(data) ? data : [];
        // Collect unique creator IDs
        const creatorIds = Array.from(new Set(rows.map(r => r.created_by).filter(Boolean)));
        let idToName = {};
        if (creatorIds.length) {
          const { data: profilesData, error: profilesErr } = await supabase
            .from('profiles')
            .select('id, username, name')
            .in('id', creatorIds);
          if (!profilesErr && Array.isArray(profilesData)) {
            idToName = profilesData.reduce((acc, p) => {
              acc[p.id] = p.name || p.username || p.id; // prefer name, then username, fallback to id
              return acc;
            }, {});
          }
        }

        const slim = rows.map(row => {
          let thumb = null;
          if (Array.isArray(row.words)) {
            thumb = row.words.map(w => (w && (w.image_url || w.image || w.img)) || null).find(Boolean) || null;
          }
          const { words, ...rest } = row;
          const creator_name = rest.created_by ? (idToName[rest.created_by] || 'Unknown') : 'Unknown';
          return { ...rest, game_image: thumb, creator_name };
        });
        return { statusCode: 200, body: JSON.stringify({ data: slim }) };
      } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
      }
    } else if (event.queryStringParameters && event.queryStringParameters.get === 'game_data' && event.httpMethod === 'GET') {
      // Get one game_data row
      try {
        const id = event.queryStringParameters.id;
        if (!id) return { statusCode: 400, body: JSON.stringify({ error: 'Missing id' }) };
        const { data, error } = await supabase
          .from('game_data')
          .select('*')
          .eq('id', id)
          .single();
        if (error) throw error;
        return { statusCode: 200, body: JSON.stringify({ data }) };
      } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
      }
    } else if (event.httpMethod === 'POST') {
      // Generic POST with action routing
      try {
        const body = JSON.parse(event.body || '{}');
        if (body.action === 'insert_game_data' && body.data) {
          const gd = body.data;
          // Normalize words shape
          if (!Array.isArray(gd.words)) gd.words = [];
          // Map incoming fields to schema columns
          const row = {
            title: gd.title || 'Untitled',
            words: gd.words,
            created_at: new Date().toISOString(),
            // schema-aligned fields
            class: gd.class || gd.gameClass || null,
            book: gd.book || gd.gameBook || null,
            unit: gd.unit || gd.gameUnit || null,
            created_by: gd.created_by || gd.created_by_id || gd.user_id || gd.profile_id || null,
            tags: Array.isArray(gd.tags) ? gd.tags : null,
            visibility: gd.visibility || undefined,
          };
          const { data, error } = await supabase.from('game_data').insert([row]);
          if (error) {
            return { statusCode: 400, body: JSON.stringify({ success: false, error: error.message }) };
          }
          return { statusCode: 200, body: JSON.stringify({ success: true, data }) };
        } else if (body.action === 'rename_game_data' && body.id && body.title) {
          const { error } = await supabase
            .from('game_data')
            .update({ title: body.title })
            .eq('id', body.id);
          if (error) return { statusCode: 400, body: JSON.stringify({ success: false, error: error.message }) };
          return { statusCode: 200, body: JSON.stringify({ success: true }) };
        } else if (body.action === 'delete_game_data' && body.id) {
          const { error } = await supabase
            .from('game_data')
            .delete()
            .eq('id', body.id);
          if (error) return { statusCode: 400, body: JSON.stringify({ success: false, error: error.message }) };
          return { statusCode: 200, body: JSON.stringify({ success: true }) };
        }
        return { statusCode: 404, body: JSON.stringify({ error: 'Unknown action' }) };
      } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
      }
    } else {
      return { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };
    }
  } catch (err) {
    console.log('=== FUNCTION ERROR ===');
    console.log('Error message:', err.message);
    console.log('Error stack:', err.stack);
    console.log('=== END ERROR ===');
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error: ' + err.message }) };
  }
};
