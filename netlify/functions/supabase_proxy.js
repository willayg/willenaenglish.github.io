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

    // --- FEEDBACK STATUS UPDATE ---
    if (event.path.endsWith('/supabase_proxy') && event.httpMethod === 'POST' && event.queryStringParameters && event.queryStringParameters.feedback_update !== undefined) {
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

    // --- GET PROFILE (name, email, approval, role) ---
    if (event.queryStringParameters && event.queryStringParameters.action === 'get_profile' && event.httpMethod === 'GET') {
      try {
        const userId = event.queryStringParameters.user_id;
        if (!userId) {
          return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Missing user_id' }) };
        }
        const { data, error } = await supabase
          .from('profiles')
          .select('name, email, approved, role')
          .eq('id', userId)
          .single();
        if (error || !data) {
          return { statusCode: 404, body: JSON.stringify({ success: false, error: 'User not found' }) };
        }
        return { statusCode: 200, body: JSON.stringify({ success: true, name: data.name, email: data.email, approved: data.approved, role: data.role }) };
      } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ success: false, error: err.message }) };
      }
    }

    // --- UPDATE PROFILE (name/email/password) ---
    if (event.queryStringParameters && event.queryStringParameters.action === 'update_profile' && event.httpMethod === 'POST') {
      try {
        const { user_id, name, email, password } = JSON.parse(event.body);
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
        // Update name/email in profiles table
        const updateFields = {};
        if (typeof name === 'string' && name.length > 0) updateFields.name = name;
        if (typeof email === 'string' && email.length > 0) updateFields.email = email;
        if (Object.keys(updateFields).length > 0) {
          const { error } = await supabase
            .from('profiles')
            .update(updateFields)
            .eq('id', user_id);
          if (error) updateError = error;
        }
        // Update password via Supabase Auth API
        if (password) {
          const { error } = await supabase.auth.admin.updateUser(user_id, { password });
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
    } else if (event.queryStringParameters && event.queryStringParameters.action === 'google_oauth_signup') {
      // You may need to use the supabase-js client in a browser, but for serverless, redirect manually:
      const redirectTo = 'https://your-site.netlify.app/Teachers/signup.html'; // Set this to your real site
      const supabaseUrl = process.env.SUPABASE_URL;
      const clientId = process.env.SUPABASE_CLIENT_ID; // Or get from your dashboard
      // Build the Google OAuth URL manually:
      const url = `${supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`;
      return {
        statusCode: 302,
        headers: { Location: url },
        body: ''
      };
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
