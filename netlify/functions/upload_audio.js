const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
  console.log('=== UPLOAD AUDIO FUNCTION START ===');
  console.log('Method:', event.httpMethod);
  console.log('Headers:', JSON.stringify(event.headers, null, 2));
  console.log('Body length:', event.body ? event.body.length : 0);

  // CORS headers for all responses
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    console.log('Environment check:', {
      SUPABASE_URL: SUPABASE_URL ? 'PRESENT' : 'MISSING',
      SUPABASE_SERVICE_KEY: SUPABASE_SERVICE_KEY ? 'PRESENT' : 'MISSING'
    });

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const parsed = JSON.parse(event.body || '{}');
    const { word, fileDataBase64 } = parsed;
    
    console.log('Parsed payload keys:', Object.keys(parsed));
    console.log('Word:', word);
    console.log('Has base64 data:', !!fileDataBase64);

    if (!word || !fileDataBase64) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Missing word or fileDataBase64' })
      };
    }

    // Clean the word for filename
    const safeWord = String(word).trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_\-]/g, '');
    const buffer = Buffer.from(fileDataBase64, 'base64');
    const filePath = `${safeWord}.mp3`;
    
    console.log('Safe word:', safeWord);
    console.log('Buffer length:', buffer.length, 'bytes');
    console.log('Uploading to bucket "audio" as:', filePath);

    const { data, error } = await supabase.storage
      .from('audio')
      .upload(filePath, buffer, {
        contentType: 'audio/mpeg',
        upsert: true,
      });

    if (error) {
      console.error('Supabase upload error:', error);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ 
          error: error.message || 'Upload failed', 
          details: error 
        })
      };
    }

    console.log('Upload success:', data);
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ 
        success: true, 
        path: data.path,
        url: `${SUPABASE_URL}/storage/v1/object/public/audio/${filePath}`
      })
    };

  } catch (err) {
    console.error('Handler error:', err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err.message })
    };
  }
};
