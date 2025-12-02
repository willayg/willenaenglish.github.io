exports.handler = async (event) => {
  try {
    console.log('=== MINIMAL LOGIN TEST START ===');
    console.log('Method:', event.httpMethod);
    console.log('Body length:', (event.body || '').length);
    
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ error: 'Method not allowed' })
      };
    }

    let body = {};
    try {
      body = JSON.parse(event.body || '{}');
    } catch (e) {
      return {
        statusCode: 400,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid JSON' })
      };
    }

    console.log('Parsed body keys:', Object.keys(body));
    
    const { email, password } = body;
    if (!email || !password) {
      return {
        statusCode: 400,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ error: 'Missing email or password' })
      };
    }

    console.log('Email provided:', !!email);
    console.log('Password provided:', !!password);

    // Just return success for now to test the basic flow
    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ 
        success: true, 
        message: 'Basic test passed',
        email: email.substring(0, 3) + '***' 
      })
    };

  } catch (err) {
    console.error('=== MINIMAL LOGIN ERROR ===');
    console.error('Error:', err.message);
    console.error('Stack:', err.stack);
    
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: 'Internal error: ' + err.message })
    };
  }
};
