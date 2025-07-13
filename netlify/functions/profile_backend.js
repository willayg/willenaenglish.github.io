// profile_backend.js - Supabase backend utility
const { createClient } = require('@supabase/supabase-js');

// Create client only when environment variables are available
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase;
if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
} else {
  // Create a placeholder to prevent immediate errors during import
  supabase = null;
}

// Export supabase client for use in other backend functions
module.exports = { supabase };
