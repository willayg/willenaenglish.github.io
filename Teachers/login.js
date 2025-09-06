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
  let result = null;
  try {
    result = await res.json();
  } catch {
    // Non-JSON (e.g., 502 HTML) -> make a readable error
    const text = await res.text().catch(() => '');
    throw new Error(res.ok ? 'Unexpected response' : `Login service error (${res.status}).`);
  }
  if (!res.ok || !result.success) {
    throw new Error(result.error || 'Login failed');
  }
  return result;
}

async function getUserRole(userId) {
  // Fetch user role from proxy
  const res = await fetch(SUPABASE_PROXY_URL + '?action=get_role&user_id=' + encodeURIComponent(userId));
  let result = null;
  try { result = await res.json(); } catch { throw new Error(`Role service error (${res.status})`); }
  if (!res.ok || !result.success) {
    throw new Error(result.error || 'Could not fetch user role');
  }
  return result.role;
}

async function getProfileId(authUserId) {
  // Get profile ID from auth user ID
  const res = await fetch(SUPABASE_PROXY_URL + '?action=get_profile_id&auth_user_id=' + encodeURIComponent(authUserId));
  let result = null;
  try { result = await res.json(); } catch { throw new Error(`Profile service error (${res.status})`); }
  if (!res.ok || !result.success) {
    throw new Error(result.error || 'Could not fetch profile ID');
  }
  return result.profile_id;
}

export { loginTeacher, getUserRole, getProfileId };
