/**
 * debug_student_data.js
 * 
 * Debug endpoint to check what student data exists in the database.
 * This helps troubleshoot the verify_student function.
 * 
 * Usage: GET /.netlify/functions/debug_student_data?username=<username>
 * Or: GET /.netlify/functions/debug_student_data (returns sample students)
 */

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
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
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ success: false, error: 'Failed to load database client' })
        };
      }
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY 
      || process.env.SUPABASE_SERVICE_KEY 
      || process.env.SUPABASE_KEY 
      || process.env.SUPABASE_SERVICE_ROLE 
      || process.env.SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ success: false, error: 'Server configuration error', hasUrl: !!supabaseUrl, hasServiceKey: !!supabaseKey })
      };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const qs = event.queryStringParameters || {};
    const username = qs.username;

    if (username) {
      // Look up specific student by username
      const { data, error } = await supabase
        .from('profiles')
  .select('id, username, name, korean_name, grade, class, role, approved, phone')
        .eq('username', username)
        .single();

      if (error || !data) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ 
            success: false, 
            error: 'Student not found',
            username 
          })
        };
      }

      const phoneDigits = data.phone ? String(data.phone).replace(/\D/g, '') : '';
      const phoneLast4 = phoneDigits.length >= 4 ? phoneDigits.slice(-4) : null;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          student: {
            username: data.username,
            name: data.name,
            korean_name: data.korean_name,
            grade: data.grade,
            class: data.class,
            role: data.role,
            approved: data.approved,
            phone: data.phone,
            phone_last4: phoneLast4,
            // Show field types for debugging
            name_length: data.name ? data.name.length : 0,
            korean_name_length: data.korean_name ? data.korean_name.length : 0,
            has_grade: !!data.grade,
            has_class: !!data.class
          }
        })
      };
    } else {
      // Return sample of students (first 5) to see what data looks like
      const { data, error } = await supabase
        .from('profiles')
  .select('username, name, korean_name, grade, class, role, phone')
        .eq('role', 'student')
        .limit(5);

      if (error) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ success: false, error: error.message })
        };
      }

      // Check if grade column exists
  const hasGradeColumn = data && data.length > 0 && 'grade' in data[0];
  const hasPhoneColumn = data && data.length > 0 && 'phone' in data[0];

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Sample students (showing first 5)',
          has_grade_column: hasGradeColumn,
          has_phone_column: hasPhoneColumn,
          total_students: data ? data.length : 0,
          students: data ? data.map(s => {
            const digits = s.phone ? String(s.phone).replace(/\D/g, '') : '';
            return {
              username: s.username,
              name: s.name,
              korean_name: s.korean_name,
              grade: s.grade,
              class: s.class,
              role: s.role,
              phone: s.phone,
              phone_last4: digits.length >= 4 ? digits.slice(-4) : null
            };
          }) : []
        })
      };
    }

  } catch (err) {
    console.error('Debug error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'Internal server error', details: err.message })
    };
  }
};
