/**
 * verify_student.js
 * 
 * Verifies a student's identity by matching provided information
 * against the profiles table.
 * 
 * Expects POST body: { korean_name, name, grade, class }
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
    console.log('Received verification request:', body);
    
    const { korean_name, name, grade, class: className } = body;

    if (!korean_name || !name || !grade || !className) {
      console.log('Missing fields:', { korean_name: !!korean_name, name: !!name, grade: !!grade, className: !!className });
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Missing required fields' })
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
      .select('id, username, email, name, korean_name, grade, class, role')
      .ilike('korean_name', korean_name)
      .ilike('name', name)
      .eq('grade', grade)
      .ilike('class', className)
      .eq('role', 'student') // Only match students, not teachers
      .maybeSingle(); // Use maybeSingle instead of single to avoid throwing on no match

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

    if (!data) {
      console.log('Student not found with criteria:', { korean_name, name, grade, className });
      
      // Debug: try to find partial matches to help troubleshoot
      const { data: debugData } = await supabase
        .from('profiles')
        .select('name, korean_name, grade, class, role')
        .eq('role', 'student')
        .limit(5);
      
      console.log('Sample students in database:', debugData);
      
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Student not found. Please check your information.' 
        })
      };
    }

    // Student found
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        student: {
          id: data.id,
          username: data.username,
          email: data.email,
          name: data.name,
          korean_name: data.korean_name
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
