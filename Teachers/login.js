// login.js - Handles teacher login using Netlify Supabase proxy

// Allow overriding the functions origin when the site isn't served by Netlify (e.g., GitHub Pages)
// Set window.NETLIFY_FUNCTIONS_BASE = 'https://<your-site>.netlify.app' before this script to override.
const FUNCTIONS_BASE = (typeof window !== 'undefined' && window.NETLIFY_FUNCTIONS_BASE) ? window.NETLIFY_FUNCTIONS_BASE.replace(/\/$/, '') : '';
const SUPABASE_PROXY_URL = `${FUNCTIONS_BASE}/.netlify/functions/supabase_proxy_fixed`;

async function parseJsonResponse(res, fallbackMsg) {
  try {
    return await res.json();
  } catch {
    const text = await res.text().catch(() => '');
    const statusMsg = res.ok ? 'Unexpected response' : `${fallbackMsg || 'Service error'} (${res.status})`;
    throw new Error(statusMsg);
  }
}

async function loginTeacher(email, password) {
  // Call Supabase Auth via proxy
  const res = await fetch(SUPABASE_PROXY_URL + '?action=login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password })
  });
  const result = await parseJsonResponse(res, 'Login service error');
  if (!res.ok || !result.success) {
    throw new Error(result.error || 'Login failed');
  }
  return result;
}

async function getUserRole(userId) {
  // Fetch user role from proxy
  const res = await fetch(SUPABASE_PROXY_URL + '?action=get_role&user_id=' + encodeURIComponent(userId));
  const result = await parseJsonResponse(res, 'Role service error');
  if (!res.ok || !result.success) {
    throw new Error(result.error || 'Could not fetch user role');
  }
  return result.role;
}

async function getProfileId(authUserId) {
  // Get profile ID from auth user ID
  const res = await fetch(SUPABASE_PROXY_URL + '?action=get_profile_id&auth_user_id=' + encodeURIComponent(authUserId));
  const result = await parseJsonResponse(res, 'Profile service error');
  if (!res.ok || !result.success) {
    throw new Error(result.error || 'Could not fetch profile ID');
  }
  return result.profile_id;
}

// Optional: lightweight health check to quickly surface server misconfiguration
async function checkHealth() {
  try {
    const res = await fetch(SUPABASE_PROXY_URL + '/debug', { credentials: 'include' });
    const js = await parseJsonResponse(res, 'Health check error');
    return { ok: res.ok, info: js };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export { loginTeacher, getUserRole, getProfileId, checkHealth };
