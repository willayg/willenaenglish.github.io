const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  // Set proper JSON headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers,
        body: ''
      };
    }

    // Parse JSON body for POST requests
    let body = {};
    if (event.httpMethod === 'POST' && event.body) {
      try {
        body = JSON.parse(event.body);
      } catch (err) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: 'Invalid JSON body' })
        };
      }
    }

    // Get action from query parameters
    const action = event.queryStringParameters?.action;

    // Create clients
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const serviceRoleClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    switch (action) {
      // --- SIGNUP (POST) ---
      case 'signup':
        if (event.httpMethod !== 'POST') {
          return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ success: false, error: 'Method not allowed' })
          };
        }

        const { email, password, name } = body;
        if (!email || !password || !name) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ success: false, error: 'Missing email, password, or name' })
          };
        }

        try {
          // Create user with Supabase Auth
          const { data: authData, error: authError } = await anonClient.auth.signUp({
            email,
            password,
            options: {
              data: {
                name: name
              }
            }
          });

          if (authError) {
            return {
              statusCode: 400,
              headers,
              body: JSON.stringify({ success: false, error: authError.message })
            };
          }

          // Create profile entry
          if (authData.user) {
            const { error: profileError } = await serviceRoleClient
              .from('profiles')
              .upsert({
                id: authData.user.id,
                email: email,
                name: name,
                approved: false,
                role: 'user'
              });

            if (profileError) {
              console.warn('Profile creation error:', profileError.message);
            }
          }

          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, user: authData.user })
          };
        } catch (err) {
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: err.message })
          };
        }

      // --- LOGIN (POST) ---
      case 'login':
        if (event.httpMethod !== 'POST') {
          return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ success: false, error: 'Method not allowed' })
          };
        }

        const { email: loginEmail, password: loginPassword } = body;
        if (!loginEmail || !loginPassword) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ success: false, error: 'Missing email or password' })
          };
        }

        try {
          // Authenticate with Supabase Auth
          const { data: authData, error: authError } = await anonClient.auth.signInWithPassword({
            email: loginEmail,
            password: loginPassword
          });

          if (authError) {
            return {
              statusCode: 401,
              headers,
              body: JSON.stringify({ success: false, error: authError.message })
            };
          }

          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
              success: true, 
              session: authData.session,
              user: authData.user 
            })
          };
        } catch (err) {
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: err.message })
          };
        }

      // --- GOOGLE OAUTH SIGNUP (GET) ---
      case 'google_oauth_signup':
        if (event.httpMethod !== 'GET') {
          return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ success: false, error: 'Method not allowed' })
          };
        }

        try {
          const redirectTo = process.env.SITE_URL || 'https://willenaenglish.netlify.app';
          const oauthUrl = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`;
          
          return {
            statusCode: 302,
            headers: {
              ...headers,
              'Location': oauthUrl
            },
            body: ''
          };
        } catch (err) {
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: err.message })
          };
        }

      // --- GET EMAIL BY USERNAME (GET) ---
      case 'get_email_by_username':
        if (event.httpMethod !== 'GET') {
          return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ success: false, error: 'Method not allowed' })
          };
        }

        const username = event.queryStringParameters?.username;
        if (!username) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ success: false, error: 'Missing username' })
          };
        }

        try {
          const { data, error } = await serviceRoleClient
            .from('profiles')
            .select('email')
            .eq('username', username)
            .single();

          if (error || !data) {
            return {
              statusCode: 404,
              headers,
              body: JSON.stringify({ success: false, error: 'Username not found' })
            };
          }

          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, email: data.email })
          };
        } catch (err) {
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: err.message })
          };
        }

      // --- GET ROLE (GET) ---
      case 'get_role':
        if (event.httpMethod !== 'GET') {
          return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ success: false, error: 'Method not allowed' })
          };
        }

        const userId = event.queryStringParameters?.user_id;
        if (!userId) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ success: false, error: 'Missing user_id' })
          };
        }

        try {
          const { data, error } = await serviceRoleClient
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();

          if (error || !data) {
            return {
              statusCode: 404,
              headers,
              body: JSON.stringify({ success: false, error: 'User not found' })
            };
          }

          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, role: data.role })
          };
        } catch (err) {
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: err.message })
          };
        }

      // --- GET PROFILE (GET) ---
      case 'get_profile':
        if (event.httpMethod !== 'GET') {
          return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ success: false, error: 'Method not allowed' })
          };
        }

        const profileUserId = event.queryStringParameters?.user_id;
        if (!profileUserId) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ success: false, error: 'Missing user_id' })
          };
        }

        try {
          const { data, error } = await serviceRoleClient
            .from('profiles')
            .select('email, name')
            .eq('id', profileUserId)
            .single();

          if (error || !data) {
            return {
              statusCode: 404,
              headers,
              body: JSON.stringify({ success: false, error: 'User not found' })
            };
          }

          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
              success: true, 
              email: data.email, 
              name: data.name 
            })
          };
        } catch (err) {
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: err.message })
          };
        }

      // --- UPDATE PROFILE (POST) ---
      case 'update_profile':
        if (event.httpMethod !== 'POST') {
          return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ success: false, error: 'Method not allowed' })
          };
        }

        const { user_id, name: newName, email: newEmail, password: newPassword } = body;
        if (!user_id) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ success: false, error: 'Missing user_id' })
          };
        }

        try {
          let updateError = null;

          // Update Auth user (email/password) via service-role admin API
          const authUpdateData = {};
          if (newEmail) authUpdateData.email = newEmail;
          if (newPassword) authUpdateData.password = newPassword;

          if (Object.keys(authUpdateData).length > 0) {
            const { error } = await serviceRoleClient.auth.admin.updateUser(user_id, authUpdateData);
            if (error) updateError = error;
          }

          // Update profiles table
          const profileUpdateData = {};
          if (newName) profileUpdateData.name = newName;
          if (newEmail) profileUpdateData.email = newEmail;

          if (Object.keys(profileUpdateData).length > 0) {
            const { error } = await serviceRoleClient
              .from('profiles')
              .upsert({ 
                id: user_id,
                ...profileUpdateData
              });
            if (error && !updateError) updateError = error;
          }

          if (updateError) {
            return {
              statusCode: 400,
              headers,
              body: JSON.stringify({ success: false, error: updateError.message })
            };
          }

          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true })
          };
        } catch (err) {
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: err.message })
          };
        }

      // --- UNKNOWN ACTION ---
      default:
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ success: false, error: 'Unknown action' })
        };
    }

  } catch (err) {
    console.error('Function error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'Internal server error' })
    };
  }
};
