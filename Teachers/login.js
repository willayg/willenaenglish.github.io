// /Teachers/login.js
// Auth-only client helpers for Netlify Functions + Supabase
// Exposes: loginTeacher, getUserRole, getProfileId, getEmailByUsername, checkHealth

// Decide which origin to call for functions.
// - On Netlify or localhost -> same-origin ('')
// - On GitHub Pages / custom domain -> point to the Netlify site
const HOST = location.hostname;
const IS_NETLIFY = /netlify\.app$/i.test(HOST) || /netlify\.dev$/i.test(HOST);
const IS_LOCAL   = /^(localhost|127\.0\.0\.1)$/i.test(HOST);
const FUNCTIONS_BASE = (IS_NETLIFY || IS_LOCAL) ? '' : 'https://willenaenglish.netlify.app';

const SUPABASE_AUTH_URL = `${FUNCTIONS_BASE}/.netlify/functions/supabase_auth`;

// Internal: parse JSON or throw a readable error
async function parseJson(res, fallback = 'Service error') {
  try {
    return await res.json();
  } catch {
    const txt = await res.text().catch(() => '');
    const msg = res.ok ? 'Unexpected response' : `${fallback} (${res.status})`;
    throw new Error(msg);
  }
}

// Username → email (only for approved users)
export async function getEmailByUsername(username) {
  const url = `${SUPABASE_AUTH_URL}?action=get_email_by_username&username=${encodeURIComponent(username)}`;
  const res = await fetch(url, { credentials: 'include' });
  const js = await parseJson(res, 'Lookup error');
  if (!res.ok || !js.success) throw new Error(js.error || 'Username not found');
  return js.email;
}

// Login with email/password via the auth function
export async function loginTeacher(email, password) {
  const res = await fetch(`${SUPABASE_AUTH_URL}?action=login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', // carry cookies
    body: JSON.stringify({ email, password })
  });
  const js = await parseJson(res, 'Login service error');
  if (!res.ok || !js.success) throw new Error(js.error || 'Login failed');
  return js; // { success:true, user }
}

// Fetch role from profiles by auth user id
export async function getUserRole(userId) {
  const res = await fetch(`${SUPABASE_AUTH_URL}?action=get_role&user_id=${encodeURIComponent(userId)}`, {
    credentials: 'include'
  });
  const js = await parseJson(res, 'Role service error');
  if (!res.ok || !js.success) throw new Error(js.error || 'Could not fetch user role');
  return js.role;
}

// Fetch profile id from profiles by auth user id
export async function getProfileId(authUserId) {
  const res = await fetch(`${SUPABASE_AUTH_URL}?action=get_profile_id&auth_user_id=${encodeURIComponent(authUserId)}`, {
    credentials: 'include'
  });
  const js = await parseJson(res, 'Profile service error');
  if (!res.ok || !js.success) throw new Error(js.error || 'Could not fetch profile ID');
  return js.profile_id;
}

// Optional: quick health probe for debugging
export async function checkHealth() {
  try {
    const res = await fetch(`${SUPABASE_AUTH_URL}?action=debug`, { credentials: 'include' });
    const js = await parseJson(res, 'Health check error');
    return { ok: res.ok, info: js };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// Useful for debugging in the console
export const __AUTH_DEBUG__ = { HOST, FUNCTIONS_BASE, SUPABASE_AUTH_URL };
