import { insertBurgerMenu } from '/components/burger-menu.js?v=20260919-header-menu-5';

const AUTH_URL = '/.netlify/functions/supabase_auth';
let instance = null;

function apiFetch(url, options = {}) {
  const f = window.WillenaAPI?.fetch
    ? window.WillenaAPI.fetch.bind(window.WillenaAPI)
    : (u, o = {}) => fetch(u, { credentials: 'include', ...o });
  return f(url, { credentials: 'include', cache: 'no-store', ...options });
}

async function getIdentity() {
  let role = '';
  let name = '';
  try {
    const whoRes = await apiFetch(AUTH_URL + '?action=whoami');
    const who = await whoRes.json().catch(() => ({}));
    if (!whoRes.ok || !who?.user_id) return { role, name };

    const [roleRes, profileRes] = await Promise.all([
      apiFetch(AUTH_URL + '?action=get_role&user_id=' + encodeURIComponent(who.user_id)),
      apiFetch(AUTH_URL + '?action=get_profile&user_id=' + encodeURIComponent(who.user_id))
    ]);
    const roleData = await roleRes.json().catch(() => ({}));
    const profile = await profileRes.json().catch(() => ({}));
    role = String(roleData?.role || profile?.role || '').toLowerCase();
    name = String(profile?.name || profile?.username || '').trim();
  } catch {}
  return { role, name };
}

function makeLogo() {
  const wrap = document.createElement('a');
  wrap.className = 'th-brand';
  wrap.href = '/Teachers/';
  wrap.setAttribute('aria-label', 'Willena Teacher Home');
  wrap.innerHTML = `
    <img src="/Assets/Images/Logo.png" alt="Willena">
    <span class="th-brand-copy">
      <strong>Willena</strong>
      <small>Teacher workspace</small>
    </span>
  `;
  return wrap;
}

function makeCenter({ mode, title }) {
  const center = document.createElement('div');
  center.className = 'th-center';

  if (mode === 'dashboard') {
    const sw = document.createElement('nav');
    sw.className = 'th-switch';
    sw.setAttribute('aria-label', 'Teacher and admin apps');
    sw.innerHTML = `
      <a data-th-teacher href="/Teachers/dashboard-v2/">Teacher</a>
      <a data-th-admin href="/Teachers/admin-v2/" hidden>Admin</a>
    `;
    center.appendChild(sw);
  } else {
    const heading = document.createElement('div');
    heading.className = 'th-tool-title';
    heading.textContent = title || '';
    center.appendChild(heading);
  }

  return center;
}

function makeActions() {
  const actions = document.createElement('div');
  actions.className = 'th-actions';

  const name = document.createElement('span');
  name.className = 'th-user-name';
  name.dataset.thUserName = '';
  name.textContent = '';
  actions.appendChild(name);

  const menuMount = document.createElement('div');
  menuMount.className = 'th-menu-mount';
  menuMount.id = 'teacherHeaderMenuMount';
  actions.appendChild(menuMount);

  return actions;
}

function applyDashboardState(root, identity, activeApp) {
  const admin = root.querySelector('[data-th-admin]');
  const teacher = root.querySelector('[data-th-teacher]');
  if (!admin || !teacher) return;

  const isAdmin = identity.role === 'admin';
  admin.hidden = !isAdmin;

  const current = activeApp || (location.pathname.includes('/admin') ? 'admin' : 'teacher');
  teacher.classList.toggle('active', current === 'teacher');
  admin.classList.toggle('active', current === 'admin');
}

export async function mountTeacherHeader(options = {}) {
  const {
    target = '#teacher-header',
    mode = 'tool',
    title = '',
    activeApp = '',
    sticky = true,
    replaceTarget = false
  } = options;

  if (instance?.root?.isConnected) return instance;

  const host = typeof target === 'string' ? document.querySelector(target) : target;
  if (!host) throw new Error('Teacher header mount target not found');

  const root = document.createElement('header');
  root.className = 'teacher-header';
  root.dataset.mode = mode;
  if (sticky) root.classList.add('teacher-header--sticky');

  root.appendChild(makeLogo());
  root.appendChild(makeCenter({ mode, title }));
  root.appendChild(makeActions());

  if (replaceTarget) host.replaceWith(root);
  else {
    host.replaceChildren();
    host.appendChild(root);
  }

  // P1 compatibility bridge: the shared header owns the mount point and layout.
  // Existing notification/menu behavior is reused until the old burger implementation
  // is retired after all teacher tools migrate.
  insertBurgerMenu('#teacherHeaderMenuMount');

  const legacyMenu = root.querySelector('.burger-menu');
  if (legacyMenu) {
    legacyMenu.classList.add('teacher-header__legacy-controls');
    legacyMenu.style.position = 'relative';
    legacyMenu.style.top = 'auto';
    legacyMenu.style.right = 'auto';
    legacyMenu.style.margin = '0';
  }

  const identity = await getIdentity();
  const userName = root.querySelector('[data-th-user-name]');
  if (userName) {
    userName.textContent = identity.name || '';
    userName.hidden = !identity.name;
  }

  if (mode === 'dashboard') applyDashboardState(root, identity, activeApp);

  instance = { root, host, options: { ...options }, identity };
  window.dispatchEvent(new CustomEvent('willena:teacher-header-ready', { detail: instance }));
  return instance;
}

export function unmountTeacherHeader() {
  if (!instance) return;
  instance.root?.remove();
  instance = null;
}

export function getTeacherHeaderInstance() {
  return instance;
}
