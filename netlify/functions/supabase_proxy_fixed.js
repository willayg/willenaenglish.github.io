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

    // --- GET PROFILE (name, email, approval, role) ---
    if (event.queryStringParameters && event.queryStringParameters.action === 'get_profile' && event.httpMethod === 'GET') {
      try {
        const userId = event.queryStringParameters.user_id;
        if (!userId) {
          return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Missing user_id' }) };
        }
        const { data, error } = await supabase
          .from('profiles')
          .select('name, email, approved, role, username')
          .eq('id', userId)
          .single();
        if (error || !data) {
          return { statusCode: 404, body: JSON.stringify({ success: false, error: 'User not found' }) };
        }
        return { statusCode: 200, body: JSON.stringify({ success: true, name: data.name, email: data.email, approved: data.approved, role: data.role, username: data.username }) };
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
        const { email, password } = JSON.parse(event.body);
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
        // Use Supabase Auth API
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          return { statusCode: 401, body: JSON.stringify({ success: false, error: error.message }) };
        }
        return { statusCode: 200, body: JSON.stringify({ success: true, user: data.user }) };
      } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ success: false, error: err.message }) };
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
