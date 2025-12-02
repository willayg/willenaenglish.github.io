// profile_backend.js - Supabase backend utility
const { createClient } = require('@supabase/supabase-js');

// Handle Supabase keys the same way as in supabase_proxy_fixed.js
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service role key for backend operations
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Export supabase client for use in other backend functions
module.exports = { supabase };
