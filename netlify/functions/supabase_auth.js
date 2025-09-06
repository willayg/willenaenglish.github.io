exports.handler = async (event) => {
  // Get the origin for proper CORS - use compatible syntax
  const headers = event.headers || {};
  const origin = headers.origin || headers.Origin || '';
  const allowedOrigins = [
    'https://www.willenaenglish.com',
    'https://willenaenglish.com', 
    'https://willenaenglish.github.io',
    'https://willenaenglish.netlify.app'
  ];
  
  // Allow the origin if it's in our list, otherwise use the Netlify default
  const allowOrigin = allowedOrigins.includes(origin) ? origin : 'https://willenaenglish.netlify.app';
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Credentials': 'true'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  try {
    // Try dynamic import first, fallback to require
    let createClient;
    try {
      const supabaseModule = await import('@supabase/supabase-js');
      createClient = supabaseModule.createClient;
    } catch {
      // Fallback for older Netlify runtime
      createClient = require('@supabase/supabase-js').createClient;
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

    if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ success: false, error: 'Missing environment variables' })
      };
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const qs = event.queryStringParameters || {};
    const action = qs.action;

    // Debug endpoint
    if (action === 'debug') {
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          hasSupabaseUrl: !!SUPABASE_URL,
          hasAnonKey: !!ANON_KEY,
          hasServiceRole: !!SERVICE_KEY,
          node: process.version
        })
      };
    }

    // Get email by username
    if (action === 'get_email_by_username') {
      const username = qs.username;
      if (!username) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ success: false, error: 'Missing username' })
        };
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('email, approved')
        .eq('username', username)
        .single();

      if (error || !data) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ success: false, error: 'Username not found' })
        };
      }

      if (!data.approved) {
        return {
          statusCode: 403,
          headers: corsHeaders,
          body: JSON.stringify({ success: false, error: 'User not approved' })
        };
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: true, email: data.email })
      };
    }

    // Login
    if (action === 'login' && event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const { email, password } = body;

      if (!email || !password) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ success: false, error: 'Missing credentials' })
        };
      }

      // Check approval
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, approved')
        .eq('email', email)
        .single();

      if (profileError || !profile || !profile.approved) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ success: false, error: 'User not found or not approved' })
        };
      }

      // Auth with Supabase
      const authResp = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': ANON_KEY },
        body: JSON.stringify({ email, password })
      });

      const authData = await authResp.json();

      if (!authResp.ok || !authData.access_token) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ success: false, error: authData?.error_description || 'Invalid credentials' })
        };
      }

      // Simple cookies
      const cookies = [
        `sb_access=${authData.access_token}; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=3600`,
        `sb_refresh=${authData.refresh_token || ''}; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=2592000`
      ];

      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Set-Cookie': cookies, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, user: authData.user })
      };
    }

    // Get role
    if (action === 'get_role') {
      const userId = qs.user_id;
      if (!userId) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ success: false, error: 'Missing user_id' })
        };
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

      if (error) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ success: false, error: error.message })
        };
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: true, role: data.role })
      };
    }

    // Get profile ID
    if (action === 'get_profile_id') {
      const authUserId = qs.auth_user_id;
      if (!authUserId) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ success: false, error: 'Missing auth_user_id' })
        };
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', authUserId)
        .single();

      if (error) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ success: false, error: error.message })
        };
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: true, profile_id: data.id })
      };
    }

    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ success: false, error: 'Action not found' })
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};
