/**
 * Teachers Login Module
 * Simple, robust authentication client for Netlify Functions + Supabase
 * 
 * This module provides clean, promise-based functions for teacher authentication
 * that work seamlessly with the supabase_auth Netlify function.
 */

// Basic, safe environment hints for debugging only (avoid ReferenceError in browsers)
const HOST = (typeof window !== 'undefined' && window.location && window.location.host) ? window.location.host : '';
const IS_LOCAL = (typeof window !== 'undefined' && window.location)
  ? /localhost|127\.0\.0\.1/i.test(window.location.hostname)
  : false;
const IS_NETLIFY = (typeof window !== 'undefined' && window.location)
  ? /netlify\.app$/i.test(window.location.hostname)
  : false;

const FUNCTIONS_BASE = '';

// Resolve supabase_auth via WillenaAPI so Cloudflare worker routing works.
const AUTH_URL = (typeof window !== 'undefined' && window.WillenaAPI && typeof window.WillenaAPI.getApiUrl === 'function')
  ? window.WillenaAPI.getApiUrl('/.netlify/functions/supabase_auth')
  : '/.netlify/functions/supabase_auth';

/**
 * Internal helper for making authenticated API calls
 * @param {string} url - The API endpoint URL
 * @param {object} options - Fetch options
 * @returns {Promise<object>} - Parsed JSON response
 */
async function makeAuthRequest(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'include', // Always include cookies
    ...options
  });
  
  let data;
  try {
    data = await response.json();
  } catch {
    // Handle non-JSON responses (like 502 HTML errors)
    const text = await response.text().catch(() => '');
    throw new Error(`Server error (${response.status}): ${text.slice(0, 100)}`);
  }
  
  if (!response.ok || !data.success) {
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }
  
  return data;
}

/**
 * Convert a username to an email address
 * Only works for approved users
 * @param {string} username - The username to look up
 * @returns {Promise<string>} - The associated email address
 */
export async function getEmailByUsername(username) {
  if (!username) {
    throw new Error('Username is required');
  }
  
  const url = `${AUTH_URL}?action=get_email_by_username&username=${encodeURIComponent(username)}`;
  const result = await makeAuthRequest(url);
  return result.email;
}

/**
 * Authenticate a teacher with email and password
 * Sets HTTP-only cookies for session management
 * @param {string} email - Teacher's email address
 * @param {string} password - Teacher's password
 * @returns {Promise<object>} - User object from Supabase auth
 */
export async function loginTeacher(email, password) {
  if (!email || !password) {
    throw new Error('Email and password are required');
  }
  
  const url = `${AUTH_URL}?action=login`;
  const result = await makeAuthRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  
  return result.user;
}

/**
 * Get the role of a user by their auth user ID
 * @param {string} userId - The auth user ID
 * @returns {Promise<string>} - The user's role (e.g., 'teacher', 'admin')
 */
export async function getUserRole(userId) {
  if (!userId) {
    throw new Error('User ID is required');
  }
  
  const url = `${AUTH_URL}?action=get_role&user_id=${encodeURIComponent(userId)}`;
  const result = await makeAuthRequest(url);
  return result.role;
}

/**
 * Get the profile ID for a user by their auth user ID
 * @param {string} authUserId - The auth user ID
 * @returns {Promise<string>} - The profile ID
 */
export async function getProfileId(authUserId) {
  if (!authUserId) {
    throw new Error('Auth user ID is required');
  }
  
  const url = `${AUTH_URL}?action=get_profile_id&auth_user_id=${encodeURIComponent(authUserId)}`;
  const result = await makeAuthRequest(url);
  return result.profile_id;
}

/**
 * Check the health and configuration of the auth service
 * Useful for debugging
 * @returns {Promise<object>} - Service status information
 */
export async function checkAuthService() {
  try {
    const url = `${AUTH_URL}?action=debug`;
    const response = await fetch(url, { credentials: 'include' });
    const data = await response.json();
    
    return {
      healthy: response.ok,
      status: response.status,
      data: data
    };
  } catch (error) {
    return {
      healthy: false,
      error: error.message
    };
  }
}

/**
 * Complete login flow: handle username/email + password, fetch role and profile
 * @param {string} loginValue - Email or username
 * @param {string} password - Password
 * @returns {Promise<object>} - Complete user data with role and profile ID
 */
export async function completeLogin(loginValue, password) {
  if (!loginValue || !password) {
    throw new Error('Login credentials are required');
  }
  
  // Convert username to email if needed
  let email = loginValue;
  if (!loginValue.includes('@')) {
    email = await getEmailByUsername(loginValue);
  }
  
  // Perform login
  const user = await loginTeacher(email, password);
  
  if (!user || !user.id) {
    throw new Error('Login successful but no user data received');
  }
  
  // Fetch additional user data
  const [role, profileId] = await Promise.all([
    getUserRole(user.id),
    getProfileId(user.id)
  ]);
  
  return {
    user,
    role,
    profileId,
    authUserId: user.id
  };
}

/**
 * Store user session data in localStorage
 * @param {object} userData - User data from completeLogin()
 */
export function storeUserSession(userData) {
  localStorage.setItem('userId', userData.authUserId);
  localStorage.setItem('profile_id', userData.profileId);
  localStorage.setItem('userRole', userData.role);
}

/**
 * Get the redirect URL based on user role
 * @param {string} role - User role
 * @returns {string} - Redirect URL
 */
export function getRedirectUrl(role) {
  // Determine an intended redirect (priority: explicit redirect param -> stored returnTo -> role default)
  let target = null;
  try {
    const params = new URLSearchParams(window.location.search);
    const qp = params.get('redirect');
    if (qp && isSafePath(qp)) target = qp;
    if (!target) {
      const stored = sessionStorage.getItem('teacher:returnTo');
      if (stored && isSafePath(stored)) target = stored;
    }
  } catch {}
  if (!target) {
    if (role === 'admin') target = '/Teachers/components/feedback-admin.html';
    else target = '/Teachers/index.html';
  }
  return target;
}

// Capture the page the user attempted to access (call from protected pages before redirecting to login)
export function captureReturnTo() {
  try {
    const here = window.location.pathname + (window.location.search || '');
    if (isSafePath(here)) sessionStorage.setItem('teacher:returnTo', here);
  } catch {}
}

// Manual resolver if needed externally
export function resolveRedirectUrl(role){
  return getRedirectUrl(role);
}

function isSafePath(p){
  // Only allow same-site relative paths without protocol and without // to avoid open redirects
  if (!p) return false;
  if (/^https?:/i.test(p)) return false;
  if (p.includes('//')) return false;
  return p.startsWith('/') ? true : false;
}

// Export configuration for debugging
export const config = {
  HOST,
  FUNCTIONS_BASE,
  AUTH_URL,
  IS_NETLIFY,
  IS_LOCAL
};

// For console debugging
if (typeof window !== 'undefined') {
  window.TeacherAuth = {
    getEmailByUsername,
    loginTeacher,
    getUserRole,
    getProfileId,
    checkAuthService,
    completeLogin,
    config
  };
}
