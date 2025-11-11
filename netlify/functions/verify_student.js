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

  console.log('Received verification request:', { korean_name: koreanNameValue, name: englishNameValue });

    if (!koreanNameValue || !englishNameValue) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Missing required fields' })
      };
    }

    const normalizedAuthCode = String(auth_code).replace(/\D/g, '').slice(-4);
    if (normalizedAuthCode.length !== 4) {
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
