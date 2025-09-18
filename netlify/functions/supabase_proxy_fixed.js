// @supabase/supabase-js v2 is ESM-only; using require() can crash in Netlify (ERR_REQUIRE_ESM).
// We'll import it dynamically inside the handler to stay compatible with Netlify's CJS runtime.

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

  // Minimal CORS helpers
  function getRequestOrigin(event) {
    const h = (event && event.headers) || {};
    return h.origin || h.Origin || '';
  }
  function makeCorsHeaders(event, extra = {}) {
    const origin = getRequestOrigin(event);
    const headers = {
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      ...extra,
    };
    if (origin) {
      headers['Access-Control-Allow-Origin'] = origin;
      headers['Access-Control-Allow-Credentials'] = 'true';
    } else {
      headers['Access-Control-Allow-Origin'] = '*';
    }
    return headers;
  }

  // Generic preflight support
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: makeCorsHeaders(event), body: '' };
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
      // Manual base64url decode to avoid ESM issues with jose
      const parts = access.split('.');
      if (parts.length < 2) return null;
      const base64url = parts[1];
      const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
      const json = Buffer.from(base64, 'base64').toString('utf8');
      const payload = JSON.parse(json);
      return payload && payload.sub ? payload.sub : null;
    } catch { return null; }
  }
  
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service role key for uploads
    // Dynamic ESM import to avoid ERR_REQUIRE_ESM
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // --- AUDIO UPLOAD (for TTS mp3 files) ---
    if (event.queryStringParameters && event.queryStringParameters.upload_audio !== undefined) {
      // CORS preflight
      if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers: makeCorsHeaders(event), body: '' };
      }
      if (event.httpMethod === 'POST') {
        try {
          const parsed = JSON.parse(event.body || '{}');
          const { word, fileDataBase64 } = parsed;
          console.log('[upload_audio] Incoming payload keys:', Object.keys(parsed));
          console.log('[upload_audio] Word:', word);
          if (!word || !fileDataBase64) {
            return { statusCode: 400, headers: makeCorsHeaders(event), body: JSON.stringify({ error: 'Missing word or file data' }) };
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
            return { statusCode: 500, headers: makeCorsHeaders(event), body: JSON.stringify({ error: error.message || 'Upload failed', details: error }) };
          }
          console.log('[upload_audio] Upload success:', data);
          return { statusCode: 200, headers: makeCorsHeaders(event), body: JSON.stringify({ success: true, path: data.path }) };
        } catch (err) {
          console.error('[upload_audio] Handler error:', err);
          return { statusCode: 400, headers: makeCorsHeaders(event), body: JSON.stringify({ error: err.message }) };
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

    // --- GET EMAIL BY USERNAME (MOVED TO supabase_auth) ---

    // --- SECURE SIGNUP (MOVED TO supabase_auth) ---

    // --- GOOGLE OAUTH SIGNUP (MOVED TO supabase_auth) ---

    // --- TEACHER LOGIN (MOVED TO supabase_auth) ---

    // --- LOGOUT (MOVED TO supabase_auth) ---

    // --- REFRESH (MOVED TO supabase_auth) ---


    // --- GET USER ROLE ---
    if (event.queryStringParameters && event.queryStringParameters.action === 'get_role' && event.httpMethod === 'GET') {
      try {
        const userId = event.queryStringParameters.user_id;
        if (!userId) {
          return { statusCode: 400, headers: makeCorsHeaders(event), body: JSON.stringify({ success: false, error: 'Missing user_id' }) };
        }
        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .single();
        if (error) {
          return { statusCode: 400, headers: makeCorsHeaders(event), body: JSON.stringify({ success: false, error: error.message }) };
        }
        return { statusCode: 200, headers: makeCorsHeaders(event), body: JSON.stringify({ success: true, role: data.role }) };
      } catch (err) {
        return { statusCode: 500, headers: makeCorsHeaders(event), body: JSON.stringify({ success: false, error: err.message }) };
      }
    }

    // --- GET PROFILE ID BY AUTH USER ID ---
    if (event.queryStringParameters && event.queryStringParameters.action === 'get_profile_id' && event.httpMethod === 'GET') {
      try {
        const authUserId = event.queryStringParameters.auth_user_id;
        if (!authUserId) {
          return { statusCode: 400, headers: makeCorsHeaders(event), body: JSON.stringify({ success: false, error: 'Missing auth_user_id' }) };
        }
        const { data, error } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', authUserId) // Assuming profiles.id matches auth.users.id
          .single();
        if (error) {
          return { statusCode: 400, headers: makeCorsHeaders(event), body: JSON.stringify({ success: false, error: error.message }) };
        }
        return { statusCode: 200, headers: makeCorsHeaders(event), body: JSON.stringify({ success: true, profile_id: data.id }) };
      } catch (err) {
        return { statusCode: 500, headers: makeCorsHeaders(event), body: JSON.stringify({ success: false, error: err.message }) };
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
    } else if (event.queryStringParameters && event.queryStringParameters.list === 'game_data_light' && event.httpMethod === 'GET') {
      // Ultra-light listing: only id, title, created_at, created_by (NO words) for fastest modal load
      try {
        const qs = event.queryStringParameters || {};
        const limit = Math.min(Number(qs.limit) > 0 ? Number(qs.limit) : 60, 500);
        const offset = Number(qs.offset) >= 0 ? Number(qs.offset) : 0;
        const { data, error } = await supabase
          .from('game_data')
          .select('id, title, created_at, created_by')
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);
        if (error) throw error;
        const rows = Array.isArray(data) ? data : [];
        console.log('[game_data_light] fetched rows', rows.length, 'limit', limit, 'offset', offset);
        // Map creator IDs to names
        const creatorIds = Array.from(new Set(rows.map(r => r.created_by).filter(Boolean)));
        let idToName = {};
        if (creatorIds.length) {
          const { data: profilesData, error: profilesErr } = await supabase
            .from('profiles')
            .select('id, username, name')
            .in('id', creatorIds);
          if (!profilesErr && Array.isArray(profilesData)) {
            idToName = profilesData.reduce((acc, p) => { acc[p.id] = p.name || p.username || p.id; return acc; }, {});
          }
        }
        const light = rows.map(r => ({
          id: r.id,
            title: r.title,
            created_at: r.created_at,
            created_by: r.created_by,
            creator_name: r.created_by ? (idToName[r.created_by] || 'Unknown') : 'Unknown'
        }));
        return { statusCode: 200, body: JSON.stringify({ data: light }) };
      } catch (err) {
        console.log('[game_data_light] error', err.message);
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
      }
    } else if (event.queryStringParameters && event.queryStringParameters.list === 'game_data' && event.httpMethod === 'GET') {
      // List saved game_data rows. Two modes:
      // 1) Normal (include words for derived thumbnail) default
      // 2) Lightweight (?no_words=1) exclude words entirely for minimal transfer
      try {
        const qs = event.queryStringParameters || {};
        const limit = Number(qs.limit) > 0 ? Number(qs.limit) : 10; // default to latest 10
        const offset = Number(qs.offset) >= 0 ? Number(qs.offset) : 0;
        const noWords = qs.no_words === '1' || qs.no_words === 'true';
        const selectCols = noWords
          ? 'id, title, created_at, created_by, game_image'
          : 'id, title, created_at, class, book, unit, created_by, words';
        let { data, error } = await supabase
          .from('game_data')
          .select(selectCols)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);
        // If error likely due to missing game_image column in noWords mode, retry without it
        if (error && noWords && selectCols.includes('game_image')) {
          console.log('[game_data] retrying without game_image column (likely missing)');
          const retryCols = 'id, title, created_at, created_by';
          const retry = await supabase
            .from('game_data')
            .select(retryCols)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);
          data = retry.data; error = retry.error;
        }
        if (error) throw error;
        const rows = Array.isArray(data) ? data : [];
        // Map creator IDs -> names
        const creatorIds = Array.from(new Set(rows.map(r => r.created_by).filter(Boolean)));
        let idToName = {};
        if (creatorIds.length) {
          const { data: profilesData, error: profilesErr } = await supabase
            .from('profiles')
            .select('id, username, name')
            .in('id', creatorIds);
          if (!profilesErr && Array.isArray(profilesData)) {
            idToName = profilesData.reduce((acc, p) => { acc[p.id] = p.name || p.username || p.id; return acc; }, {});
          }
        }
        const result = rows.map(row => {
          let game_image = null;
          if (row.game_image) {
            game_image = row.game_image;
          } else if (!noWords && Array.isArray(row.words)) {
            game_image = row.words.map(w => (w && (w.image_url || w.image || w.img)) || null).find(Boolean) || null;
          }
          const creator_name = row.created_by ? (idToName[row.created_by] || 'Unknown') : 'Unknown';
          if (noWords) {
            return { id: row.id, title: row.title, created_at: row.created_at, created_by: row.created_by, creator_name, game_image };
          }
          const { words, ...rest } = row;
          return { ...rest, game_image, creator_name };
        });
        return { statusCode: 200, body: JSON.stringify({ data: result }) };
      } catch (err) {
        console.log('[game_data] error', err.message, 'no_words:', qs.no_words);
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
      }
    } else if (event.queryStringParameters && event.queryStringParameters.get === 'game_thumb' && event.httpMethod === 'GET') {
      // Return first image URL for a given game id (cheap + isolated); falls back to null
      try {
        const id = event.queryStringParameters.id;
        if (!id) return { statusCode: 400, body: JSON.stringify({ error: 'Missing id' }) };
        
        // First try to get explicit game_image column if it exists
        let { data, error } = await supabase
          .from('game_data')
          .select('game_image, words')
          .eq('id', id)
          .single();
        
        // If game_image column doesn't exist, fallback to just words
        if (error && error.message?.includes('game_image')) {
          const retry = await supabase
            .from('game_data')
            .select('words')
            .eq('id', id)
            .single();
          data = retry.data; error = retry.error;
        }
        
        if (error) throw error;
        let thumb = null;
        
        // Prefer explicit game_image first
        if (data?.game_image) {
          thumb = data.game_image;
        } else if (data && Array.isArray(data.words)) {
          // Fallback to first word's image
          for (const w of data.words) {
            if (w && (w.image_url || w.image || w.img)) { 
              thumb = w.image_url || w.image || w.img; 
              break; 
            }
          }
        }
        return { statusCode: 200, body: JSON.stringify({ id, thumb }) };
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
          // Derive game_image from first available image field among words
          let derivedImage = null;
          for (const w of gd.words) {
            if (w && (w.image_url || w.image || w.img)) { derivedImage = w.image_url || w.image || w.img; break; }
          }
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
            game_image: derivedImage || null,
          };
          const { data, error } = await supabase.from('game_data').insert([row]);
          if (error) {
            return { statusCode: 400, body: JSON.stringify({ success: false, error: error.message }) };
          }
          return { statusCode: 200, body: JSON.stringify({ success: true, data }) };
        } else if (body.action === 'update_game_data' && body.id && body.data) {
          // Ownership enforcement
          let requesterId = getUserIdFromCookie(event);
          if (!requesterId) {
            const user = await getUserFromCookie(supabase, event); requesterId = user && user.id;
          }
          if (!requesterId) return { statusCode: 401, body: JSON.stringify({ success:false, error:'Not authenticated' }) };
          const { data: existing, error: exErr } = await supabase.from('game_data').select('created_by').eq('id', body.id).single();
          if (exErr || !existing) return { statusCode: 404, body: JSON.stringify({ success:false, error:'Game not found' }) };
          if (existing.created_by && existing.created_by !== requesterId) {
            return { statusCode: 403, body: JSON.stringify({ success:false, error:'Forbidden: not owner' }) };
          }
          const gd = body.data;
          if (!Array.isArray(gd.words)) gd.words = [];
            let derivedImage = null;
            for (const w of gd.words) {
              if (w && (w.image_url || w.image || w.img)) { derivedImage = w.image_url || w.image || w.img; break; }
            }
          const row = {
            title: gd.title || 'Untitled',
            words: gd.words,
            class: gd.class || gd.gameClass || null,
            book: gd.book || gd.gameBook || null,
            unit: gd.unit || gd.gameUnit || null,
            game_image: derivedImage || null,
            updated_at: new Date().toISOString()
          };
          const { error } = await supabase
            .from('game_data')
            .update(row)
            .eq('id', body.id);
          if (error) return { statusCode: 400, body: JSON.stringify({ success: false, error: error.message }) };
          return { statusCode: 200, body: JSON.stringify({ success: true }) };
        } else if (body.action === 'rename_game_data' && body.id && body.title) {
          let requesterId = getUserIdFromCookie(event);
          if (!requesterId) { const user = await getUserFromCookie(supabase, event); requesterId = user && user.id; }
          if (!requesterId) return { statusCode: 401, body: JSON.stringify({ success:false, error:'Not authenticated' }) };
          const { data: existing, error: exErr } = await supabase.from('game_data').select('created_by').eq('id', body.id).single();
          if (exErr || !existing) return { statusCode: 404, body: JSON.stringify({ success:false, error:'Game not found' }) };
          if (existing.created_by && existing.created_by !== requesterId) return { statusCode: 403, body: JSON.stringify({ success:false, error:'Forbidden: not owner' }) };
          const { error } = await supabase.from('game_data').update({ title: body.title, updated_at: new Date().toISOString() }).eq('id', body.id);
          if (error) return { statusCode: 400, body: JSON.stringify({ success: false, error: error.message }) };
          return { statusCode: 200, body: JSON.stringify({ success: true }) };
        } else if (body.action === 'delete_game_data' && body.id) {
          let requesterId = getUserIdFromCookie(event);
          if (!requesterId) { const user = await getUserFromCookie(supabase, event); requesterId = user && user.id; }
          if (!requesterId) return { statusCode: 401, body: JSON.stringify({ success:false, error:'Not authenticated' }) };
          const { data: existing, error: exErr } = await supabase.from('game_data').select('created_by').eq('id', body.id).single();
          if (exErr || !existing) return { statusCode: 404, body: JSON.stringify({ success:false, error:'Game not found' }) };
          if (existing.created_by && existing.created_by !== requesterId) return { statusCode: 403, body: JSON.stringify({ success:false, error:'Forbidden: not owner' }) };
          const { error } = await supabase.from('game_data').delete().eq('id', body.id);
          if (error) return { statusCode: 400, body: JSON.stringify({ success: false, error: error.message }) };
          return { statusCode: 200, body: JSON.stringify({ success: true }) };
        }
        return { statusCode: 404, body: JSON.stringify({ error: 'Unknown action' }) };
      } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
      }
    } else {
      return { statusCode: 404, headers: makeCorsHeaders(event), body: JSON.stringify({ error: 'Not found' }) };
    }
  } catch (err) {
    console.log('=== FUNCTION ERROR ===');
    console.log('Error message:', err.message);
    console.log('Error stack:', err.stack);
    console.log('=== END ERROR ===');
    return { statusCode: 500, headers: makeCorsHeaders(event), body: JSON.stringify({ error: 'Internal server error: ' + err.message }) };
  }
};
