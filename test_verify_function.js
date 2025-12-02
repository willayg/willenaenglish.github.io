const fn = require('./.netlify/functions-serve/verify_student/netlify/functions/verify_student.js');
(async () => {
  try {
    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({ korean_name: 'DoesNotExist', name: 'Nobody', auth_code: '0000' }),
      headers: {}
    };
  // Set minimal env vars so the function proceeds to rate-limit checks.
  process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'fake-service-key';

  for (let i = 1; i <= 6; i++) {
    const res = await fn.handler(event);
    console.log(`[${i}] RESPONSE:`, JSON.stringify(res));
  }
  } catch (err) {
    console.error('HANDLER THREW:', err);
    process.exitCode = 2;
  }
})();
