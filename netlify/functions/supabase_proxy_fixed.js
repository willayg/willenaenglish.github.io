const { createClient } = require('@supabase/supabase-js');
const { supabase: serviceRoleSupabaseFromModule } = require('./profile_backend.js');

exports.handler = async (event) => {
  try {
    // Initialize two Supabase clients as specified
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Missing Supabase configuration' })
      };
    }

    // Anon client for auth operations
    const anonSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // Service-role client - use from module if available, otherwise create new one
    const serviceRoleSupabase = serviceRoleSupabaseFromModule || createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Parse action from query parameters
    const action = event.queryStringParameters?.action;
    
    if (!action) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Unknown action' })
      };
    }

    // Handle signup action
    if (action === 'signup' && event.httpMethod === 'POST') {
      try {
        const { email, password, name } = JSON.parse(event.body);
        
        if (!email || !password || !name) {
          return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: false, error: 'Missing email, password, or name' })
          };
        }

        // Create user with anon client
        const { data: authData, error: authError } = await anonSupabase.auth.signUp({
          email,
          password
        });

        if (authError) {
          return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: false, error: authError.message })
          };
        }

        // If user creation successful, upsert profile with service-role client
        if (authData.user) {
          const { error: profileError } = await serviceRoleSupabase
            .from('profiles')
            .upsert({ 
              id: authData.user.id, 
              email, 
              name 
            });

          if (profileError) {
            return {
              statusCode: 400,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ success: false, error: profileError.message })
            };
          }
        }

        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: true, user: authData.user })
        };
      } catch (err) {
        return {
          statusCode: 500,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: false, error: err.message })
        };
      }
    }

    // Handle login action
    if (action === 'login' && event.httpMethod === 'POST') {
      try {
        const { email, password } = JSON.parse(event.body);
        
        if (!email || !password) {
          return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: false, error: 'Missing email or password' })
          };
        }

        // Sign in with anon client
        const { data, error } = await anonSupabase.auth.signInWithPassword({
          email,
          password
        });

        if (error) {
          return {
            statusCode: 401,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: false, error: error.message })
          };
        }

        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            success: true, 
            session: data.session, 
            user: data.user 
          })
        };
      } catch (err) {
        return {
          statusCode: 500,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: false, error: err.message })
        };
      }
    }

    // Handle Google OAuth signup
    if (action === 'google_oauth_signup' && event.httpMethod === 'GET') {
      try {
        const redirectTo = process.env.SITE_URL + '/Teachers/index.html';
        
        // Try to generate redirect URL using Supabase client
        const { data, error } = await anonSupabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: redirectTo
          }
        });

        if (error) {
          // Fallback to manual URL construction
          const authUrl = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`;
          return {
            statusCode: 302,
            headers: { 'Location': authUrl }
          };
        }

        return {
          statusCode: 302,
          headers: { 'Location': data.url }
        };
      } catch (err) {
        return {
          statusCode: 500,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: false, error: err.message })
        };
      }
    }

    // Handle get_email_by_username action
    if (action === 'get_email_by_username' && event.httpMethod === 'GET') {
      try {
        const username = event.queryStringParameters?.username;
        
        if (!username) {
          return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: false, error: 'Missing username' })
          };
        }

        // Query profiles table via service-role client
        const { data, error } = await serviceRoleSupabase
          .from('profiles')
          .select('email')
          .eq('username', username)
          .single();

        if (error) {
          return {
            statusCode: 404,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: false, error: error.message })
          };
        }

        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: true, email: data.email })
        };
      } catch (err) {
        return {
          statusCode: 500,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: false, error: err.message })
        };
      }
    }

    // Handle get_role action
    if (action === 'get_role' && event.httpMethod === 'GET') {
      try {
        const user_id = event.queryStringParameters?.user_id;
        
        if (!user_id) {
          return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: false, error: 'Missing user_id' })
          };
        }

        // Query profiles table via service-role client
        const { data, error } = await serviceRoleSupabase
          .from('profiles')
          .select('role')
          .eq('id', user_id)
          .single();

        if (error) {
          return {
            statusCode: 404,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: false, error: error.message })
          };
        }

        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: true, role: data.role })
        };
      } catch (err) {
        return {
          statusCode: 500,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: false, error: err.message })
        };
      }
    }

    // Handle get_profile action
    if (action === 'get_profile' && event.httpMethod === 'GET') {
      try {
        const user_id = event.queryStringParameters?.user_id;
        
        if (!user_id) {
          return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: false, error: 'Missing user_id' })
          };
        }

        // Query profiles table via service-role client
        const { data, error } = await serviceRoleSupabase
          .from('profiles')
          .select('email, name')
          .eq('id', user_id)
          .single();

        if (error) {
          return {
            statusCode: 404,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: false, error: error.message })
          };
        }

        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            success: true, 
            email: data.email, 
            name: data.name 
          })
        };
      } catch (err) {
        return {
          statusCode: 500,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: false, error: err.message })
        };
      }
    }

    // Handle update_profile action
    if (action === 'update_profile' && event.httpMethod === 'POST') {
      try {
        const { user_id, name, email, password } = JSON.parse(event.body);
        
        if (!user_id) {
          return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: false, error: 'Missing user_id' })
          };
        }

        let authUpdateResult = null;

        // Update email or password via Supabase Auth API if provided
        if (email || password) {
          const updateData = {};
          if (email) updateData.email = email;
          if (password) updateData.password = password;

          const { data: authData, error: authError } = await serviceRoleSupabase.auth.admin.updateUserById(
            user_id, 
            updateData
          );

          if (authError) {
            return {
              statusCode: 400,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ success: false, error: authError.message })
            };
          }
          
          authUpdateResult = authData;
        }

        // Upsert profiles table with new data
        const profileData = { id: user_id };
        if (name) profileData.name = name;
        if (email) profileData.email = email;

        const { error: profileError } = await serviceRoleSupabase
          .from('profiles')
          .upsert(profileData);

        if (profileError) {
          return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: false, error: profileError.message })
          };
        }

        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            success: true, 
            user: authUpdateResult?.user || { id: user_id }
          })
        };
      } catch (err) {
        return {
          statusCode: 500,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: false, error: err.message })
        };
      }
    }

    // Handle unknown actions
    return {
      statusCode: 404,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Unknown action' })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Internal server error: ' + err.message })
    };
  }
};
