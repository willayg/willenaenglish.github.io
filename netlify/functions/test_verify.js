/**
 * test_verify.js
 * 
 * Simple test endpoint to check if verification is working.
 * Returns what it receives and attempts a simple query.
 */

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
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

    const body = event.body ? JSON.parse(event.body) : {};
    
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
        body: JSON.stringify({ success: false, error: 'Missing environment variables', hasUrl: !!supabaseUrl, hasServiceKey: !!supabaseKey })
      };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Try to get students with the role 'student'
    const { data: students, error: studentsError } = await supabase
      .from('profiles')
      .select('id, username, name, korean_name, grade, class, role')
      .eq('role', 'student')
      .limit(3);

    if (studentsError) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Database query failed',
          dbError: studentsError.message,
          code: studentsError.code
        })
      };
    }

    // If body has search criteria, try to find match
    let matchResult = null;
    if (body.korean_name && body.name && body.grade && body.class) {
      const { data: match, error: matchError } = await supabase
        .from('profiles')
        .select('id, username, name, korean_name, grade, class, role')
        .ilike('korean_name', body.korean_name)
        .ilike('name', body.name)
        .eq('grade', body.grade)
        .ilike('class', body.class)
        .eq('role', 'student')
        .maybeSingle();

      matchResult = {
        found: !!match,
        error: matchError ? matchError.message : null,
        match: match || null
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        receivedData: body,
        sampleStudents: students,
        totalSampleStudents: students ? students.length : 0,
        matchResult: matchResult,
        hasGradeColumn: students && students.length > 0 ? ('grade' in students[0]) : 'unknown'
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: 'Internal error', 
        message: err.message,
        stack: err.stack
      })
    };
  }
};
