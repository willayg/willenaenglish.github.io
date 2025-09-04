// login.js - Handles teacher login using Netlify Supabase proxy

const SUPABASE_PROXY_URL = '/.netlify/functions/supabase_proxy_fixed';

async function loginTeacher(email, password) {
  // Call Supabase Auth via proxy (you may need to add a new endpoint for this)
  const res = await fetch(SUPABASE_PROXY_URL + '?action=login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({ email, password })
  });
  const result = await res.json();
  if (!res.ok || !result.success) {
    throw new Error(result.error || 'Login failed');
  }
  return result;
}

async function getUserRole(userId) {
  // Fetch user role from proxy
  const res = await fetch(SUPABASE_PROXY_URL + '?action=get_role&user_id=' + encodeURIComponent(userId));
  const result = await res.json();
  if (!res.ok || !result.success) {
    throw new Error(result.error || 'Could not fetch user role');
  }
  return result.role;
}

async function getProfileId(authUserId) {
  // Get profile ID from auth user ID
  const res = await fetch(SUPABASE_PROXY_URL + '?action=get_profile_id&auth_user_id=' + encodeURIComponent(authUserId));
  const result = await res.json();
  if (!res.ok || !result.success) {
    throw new Error(result.error || 'Could not fetch profile ID');
  }
  return result.profile_id;
}

export { loginTeacher, getUserRole, getProfileId };
