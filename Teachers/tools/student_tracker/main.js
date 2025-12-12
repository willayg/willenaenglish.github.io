// Access control: require teacher login and approval
let userRole = null;
let userRoleReadyResolve;
const userRoleReady = new Promise((resolve) => { userRoleReadyResolve = resolve; });
(async function() {
  const userId = localStorage.getItem('userId');
  if (!userId) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    location.href = `/Teachers/login.html?redirect=${redirect}`;
    return;
  }
  try {
    const apiUrl = window.WillenaAPI ? window.WillenaAPI.getApiUrl(`/.netlify/functions/supabase_proxy_fixed?action=get_profile&user_id=${encodeURIComponent(userId)}`) : `/.netlify/functions/supabase_proxy_fixed?action=get_profile&user_id=${encodeURIComponent(userId)}`;
    const r = await fetch(apiUrl, { credentials: 'include' });
    const js = await r.json();
    if (!js || !js.success || js.approved !== true || !['teacher','admin'].includes(String(js.role||'').toLowerCase())) {
      location.href = '/Teachers/profile.html';
    }
    userRole = String(js.role||'').toLowerCase();
    if (typeof userRoleReadyResolve === 'function') {
      userRoleReadyResolve(userRole);
      userRoleReadyResolve = null;
    }
  } catch {
    const redirect = encodeURIComponent(location.pathname + location.search);
    location.href = `/Teachers/login.html?redirect=${redirect}`;
  }
})();

// Load burger menu
document.addEventListener('DOMContentLoaded', async () => {
  // Fetch and inject burger menu template if not already present
  if (!document.getElementById('burger-menu-template')) {
    try {
      const resp = await fetch('/Teachers/components/burger-menu.html');
      const html = await resp.text();
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      document.body.appendChild(tempDiv.firstElementChild);
    } catch(e) {
      console.warn('Failed to load burger menu template:', e);
    }
  }
  
  // Wait for ES module to set window.insertBurgerMenu (small delay for module execution)
  const waitForBurgerMenu = (attempts = 0) => {
    if (typeof window.insertBurgerMenu === 'function') {
      window.insertBurgerMenu('#burger-menu-mount');
    } else if (attempts < 20) {
      setTimeout(() => waitForBurgerMenu(attempts + 1), 50);
    } else {
      console.warn('insertBurgerMenu not available after waiting');
    }
  };
  waitForBurgerMenu();
});

// API functions
const FN = (name) => `/.netlify/functions/${name}`;

async function fetchJsonWithLog(url, label, options = {}) {
  const init = { credentials: 'include', ...options };
  // Use WillenaAPI to get correct endpoint (routes to Cloudflare workers on custom domains)
  const resolvedUrl = window.WillenaAPI ? window.WillenaAPI.getApiUrl(url) : url;
  try {
    const resp = await fetch(resolvedUrl, init);
    let data = null;
    try {
      data = await resp.json();
    } catch (err) {
      console.warn(`[student_tracker] ${label} invalid JSON`, err);
    }
    const meta = { url, label, status: resp.status, ok: resp.ok };
    if (!resp.ok || (data && data.success === false)) {
      console.warn(`[student_tracker] ${label} response warning`, meta, data);
    } else {
      console.debug(`[student_tracker] ${label} response ok`, meta);
    }
    return data;
  } catch (err) {
    console.warn(`[student_tracker] ${label} request error`, err);
    throw err;
  }
}

const API = {
  classes: () => fetchJsonWithLog(`${FN('progress_teacher_summary')}?action=classes_list`, 'classes_list'),
  leaderboard: (cls, tf) => fetchJsonWithLog(
    `${FN('progress_teacher_summary')}?action=leaderboard&class=${encodeURIComponent(cls)}&timeframe=${encodeURIComponent(tf)}`,
    `leaderboard (${cls} • ${tf})`
  ),
  student: (uid, tf) => fetchJsonWithLog(
    `${FN('progress_teacher_summary')}?action=student_details&user_id=${encodeURIComponent(uid)}&timeframe=${encodeURIComponent(tf)}`,
    `student_details (${uid} • ${tf})`
  ),
  toggleClassVisibility: (cls, hidden) => fetchJsonWithLog(
    `${FN('progress_teacher_summary')}?action=toggle_class_visibility&class=${encodeURIComponent(cls)}&hidden=${hidden}`,
    `toggle_class_visibility (${cls})`,
    { method: 'POST' }
  ),
};

const DEFAULT_TIMEFRAME = 'month';
const LEADERBOARD_PREFETCH_COUNT = 2;
const STUDENT_PREFETCH_COUNT = 2;
const SW_PREFETCH_MESSAGE = 'teacher-prefetch';
const swPrefetchQueue = new Set();
const ST_CACHE_DEFAULT_TTL = 45000; // ~45s client cache to mask function latency

const teacherPrefetchEndpoints = {
  classes: () => `${FN('progress_teacher_summary')}?action=classes_list`,
  leaderboard: (cls, tf = DEFAULT_TIMEFRAME) => `${FN('progress_teacher_summary')}?action=leaderboard&class=${encodeURIComponent(cls)}&timeframe=${encodeURIComponent(tf)}`,
  student: (uid, tf = DEFAULT_TIMEFRAME) => `${FN('progress_teacher_summary')}?action=student_details&user_id=${encodeURIComponent(uid)}&timeframe=${encodeURIComponent(tf)}`
};

function queuePrefetchUrls(urls) {
  if (!urls || !urls.length || typeof navigator === 'undefined') return;
  urls.forEach(url => {
    if (typeof url === 'string' && url.trim()) swPrefetchQueue.add(url);
  });
  flushPrefetchQueue();
}

function flushPrefetchQueue() {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker || !navigator.serviceWorker.controller || !swPrefetchQueue.size) return;
  navigator.serviceWorker.controller.postMessage({ type: SW_PREFETCH_MESSAGE, urls: Array.from(swPrefetchQueue) });
  swPrefetchQueue.clear();
}

async function registerTeacherServiceWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register('/sw-teacher.js', { scope: '/' });
    navigator.serviceWorker.controller && flushPrefetchQueue();
    navigator.serviceWorker.ready.then(() => flushPrefetchQueue());
    navigator.serviceWorker.addEventListener?.('controllerchange', flushPrefetchQueue);
    queuePrefetchUrls([teacherPrefetchEndpoints.classes()]);
    console.log('[student_tracker] service worker registered', reg.scope);
    return reg;
  } catch (err) {
    console.warn('[student_tracker] service worker registration failed', err);
    return null;
  }
}

function scheduleLeaderboardPrefetch(classes, timeframe = DEFAULT_TIMEFRAME) {
  const targets = (classes || []).slice(0, LEADERBOARD_PREFETCH_COUNT);
  const urls = targets
    .map(cls => typeof cls === 'string' ? cls : cls.name)
    .filter(name => !!name)
    .map(name => teacherPrefetchEndpoints.leaderboard(name, timeframe));
  queuePrefetchUrls(urls);
}

function scheduleStudentPrefetch(entries, timeframe = DEFAULT_TIMEFRAME) {
  const ids = (entries || [])
    .slice(0, STUDENT_PREFETCH_COUNT)
    .map(entry => entry && entry.user_id)
    .filter(Boolean);
  const urls = ids.map(uid => teacherPrefetchEndpoints.student(uid, timeframe));
  queuePrefetchUrls(urls);
}

// Lightweight sessionStorage cache helpers (never store tokens/secrets).
function trackerCacheKey(prefix, parts = []) {
  return `st-cache:${prefix}:${parts.map(p => encodeURIComponent(String(p || ''))).join('|')}`;
}

function trackerCacheSet(prefix, parts, payload) {
  try {
    const key = trackerCacheKey(prefix, parts);
    const value = JSON.stringify({ ts: Date.now(), payload });
    sessionStorage.setItem(key, value);
  } catch (_) {}
}

function trackerCacheGet(prefix, parts, maxAgeMs = ST_CACHE_DEFAULT_TTL) {
  try {
    const key = trackerCacheKey(prefix, parts);
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.ts) return null;
    if (Date.now() - parsed.ts > maxAgeMs) {
      sessionStorage.removeItem(key);
      return null;
    }
    return parsed.payload;
  } catch (_) {
    return null;
  }
}

const cacheLeaderKey = (cls, tf) => ['leaderboard', cls || '', tf || DEFAULT_TIMEFRAME];
const cacheStudentKey = (uid, tf) => ['student', uid || '', tf || DEFAULT_TIMEFRAME];

function cacheSetLeaderboard(cls, tf, rows) {
  if (!cls || !Array.isArray(rows)) return;
  trackerCacheSet('leaderboard', [cls, tf], rows);
}

function cacheGetLeaderboard(cls, tf) {
  if (!cls) return null;
  const rows = trackerCacheGet('leaderboard', [cls, tf]);
  return Array.isArray(rows) ? rows : null;
}

function cacheSetStudentDetails(uid, tf, data) {
  if (!uid || !data) return;
  trackerCacheSet('student', [uid, tf], data);
}

function cacheGetStudentDetails(uid, tf) {
  if (!uid) return null;
  return trackerCacheGet('student', [uid, tf]);
}

// Helper to request a run token for an assignment and cache it in `window.currentHomeworkRunTokens`
async function createRunTokenForAssignment(assignmentId) {
  if (!assignmentId) return null;
  try {
    window.currentHomeworkRunTokens = window.currentHomeworkRunTokens || {};
    // If we already have a token for this assignment, reuse it
    if (window.currentHomeworkRunTokens[assignmentId]) return window.currentHomeworkRunTokens[assignmentId];
    const resp = await WillenaAPI.fetch(`/.netlify/functions/homework_api?action=create_run&assignment_id=${encodeURIComponent(assignmentId)}`);
    const js = await resp.json().catch(()=>({}));
    if (!resp.ok || !js.success) {
      console.warn('createRunTokenForAssignment: failed to create run token', js.error || resp.status);
      return null;
    }
    const tok = js.run_token || null;
    if (tok) window.currentHomeworkRunTokens[assignmentId] = tok;
    console.log('createRunTokenForAssignment: stored run token for', assignmentId, tok);
    return tok;
  } catch (err) {
    console.warn('createRunTokenForAssignment error:', err && err.message ? err.message : err);
    return null;
  }
}

// DOM utilities
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

// DOM references
const classSel = $('#classSel');
const timeSel = $('#timeSel');
const lbBody = $('#lbBody');
const searchBox = $('#searchBox');
const refreshBtn = $('#refreshBtn');
const statusMsg = $('#statusMsg');
const studentPanel = $('#studentPanel');
const studentTitle = $('#studentTitle');

// Warn if critical DOM elements are missing
if (!classSel) console.warn('Missing #classSel');
if (!lbBody) console.warn('Missing #lbBody');
if (!searchBox) console.warn('Missing #searchBox');
if (!statusMsg) console.warn('Missing #statusMsg');

// State
let rawLeaderboard = [];
let selectedStudent = null;
let sortColumn = 'rank';
let sortDirection = 'asc'; // 'asc' or 'desc'
let classTrackerSelectedClass = null;
let classesWithActiveHomework = new Set();

// Chart instances
let accuracyChartInstance = null;
let modeSessionsChartInstance = null;
let dailyActivityChartInstance = null;
const gameChartsRegistry = new Map();
let activityViewMode = 'day';
let activitySessions = [];

// Formatting utilities
function fmtPct(n){ return (n ?? 0) + '%'; }

function friendlyListName(name){
  if (!name) return 'Unknown List';
  let clean = String(name).replace(/\.[^/.]+$/, '');
  clean = clean.replace(/[_-]+/g, ' ');
  clean = clean.replace(/\s+/g, ' ').trim();
  if (!clean) return 'Unknown List';
  return clean.split(' ').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function formatDateLabel(iso){
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const opts = { month: 'short', day: 'numeric' };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString(undefined, opts);
}

function pluralize(word, count){
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

function friendlyModeName(mode){
  if (!mode) return 'Unknown';
  let clean = String(mode).replace(/[_-]+/g, ' ');
  clean = clean.replace(/\s+/g, ' ').trim();
  if (!clean) return 'Unknown';
  return clean.split(' ').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

// Status management
function setStatus(text = '', type = ''){
  if (!statusMsg) return;
  statusMsg.textContent = text;
  statusMsg.classList.toggle('error', type === 'error');
}

// Leaderboard rendering
function renderLeaderboard(list){
  const q = (searchBox.value||'').trim().toLowerCase();
  const filtered = q ? list.filter(r => (r.name||'').toLowerCase().includes(q)) : list;
  
  // Sort the filtered list
  const sorted = [...filtered].sort((a, b) => {
    let aVal, bVal;
    
    switch(sortColumn) {
      case 'rank':
        aVal = a.rank || 0;
        bVal = b.rank || 0;
        break;
      case 'name':
        aVal = (a.name || '').toLowerCase();
        bVal = (b.name || '').toLowerCase();
        break;
      case 'korean_name':
        aVal = (a.korean_name || '').toLowerCase();
        bVal = (b.korean_name || '').toLowerCase();
        break;
      case 'stars':
        aVal = a.stars || 0;
        bVal = b.stars || 0;
        break;
      case 'points':
        aVal = a.points || 0;
        bVal = b.points || 0;
        break;
      case 'super_score':
        aVal = Math.round((a.points * a.stars) / 1000);
        bVal = Math.round((b.points * b.stars) / 1000);
        break;
      case 'accuracy':
        aVal = a.accuracy || 0;
        bVal = b.accuracy || 0;
        break;
      default:
        return 0;
    }
    
    // Handle string vs number comparison
    if (typeof aVal === 'string') {
      const cmp = aVal.localeCompare(bVal);
      return sortDirection === 'asc' ? cmp : -cmp;
    }
    return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
  });
  
  const display = sorted.slice(0, 200);
  if (!display.length) { lbBody.innerHTML = '<tr><td colspan="7" class="empty">No data</td></tr>'; return; }
  lbBody.innerHTML = display.map(r => {
    const stars = r.stars || 0;
    const points = r.points || 0;
    const superScore = Math.round((points * stars) / 1000);
    return `
    <tr data-uid="${r.user_id}">
      <td class="rank">${r.rank||''}</td>
      <td><a class="clickable" data-action="student" data-uid="${r.user_id}">${r.name||'Unknown'}</a></td>
      <td>${r.korean_name||'—'}</td>
      <td class="num">${stars}</td>
      <td class="num">${points}</td>
      <td class="num">${superScore}</td>
      <td class="num">${fmtPct(r.accuracy||0)}</td>
    </tr>`;
  }).join('');
}

// Tab management
function ensureStudentTabs(){
  if (!studentPanel) return;
  const overview = $('#tab-overview');
  const games = $('#tab-games');
  const tests = $('#tab-tests');
  if (overview && games && tests) return;
  studentPanel.innerHTML = `
    <div id="tab-overview" class="tab-content active"><div class="empty">Click a student name to view their stats.</div></div>
    <div id="tab-games" class="tab-content"><div class="empty">No games played yet.</div></div>
    <div id="tab-tests" class="tab-content"><div class="empty">Tests data coming soon.</div></div>
  `;
}

function renderStudentEmpty(){
  studentTitle.textContent = 'Student details';
  ensureStudentTabs();
  const tabOverview = $('#tab-overview');
  if (tabOverview) tabOverview.innerHTML = '<div class="empty">Click a student name to view their stats.</div>';
  const tabGames = $('#tab-games');
  if (tabGames) tabGames.innerHTML = '<div class="empty">No games played yet.</div>';
  const tabTests = $('#tab-tests');
  if (tabTests) tabTests.innerHTML = '<div class="empty">Tests data coming soon.</div>';
}

function switchTab(tabName) {
  const tabs = $$('#studentPanel .tab-content');
  const btns = $$('#studentPanel .tab-btn');
  tabs.forEach(t => t.classList.remove('active'));
  btns.forEach(b => b.classList.remove('active'));
  const activeTab = $(`#tab-${tabName}`);
  const activeBtn = $(`.tab-btn[data-tab="${tabName}"]`);
  if (activeTab) activeTab.classList.add('active');
  if (activeBtn) activeBtn.classList.add('active');
}

// Chart rendering functions
function renderAccuracyChart(accuracy) {
  const ctx = $('#accuracyChart');
  if (!ctx) return;
  if (accuracyChartInstance) accuracyChartInstance.destroy();
  accuracyChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Correct', 'Incorrect'],
      datasets: [{
        data: [accuracy, 100 - accuracy],
        backgroundColor: ['#19777e', '#e5e7eb'],
        borderColor: ['#155a62', '#d1d5db'],
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: true, position: 'bottom' } }
    }
  });
}

function renderModeSessionChart(word, grammar) {
  const ctx = $('#modeSessionsChart');
  if (!ctx) return;
  if (modeSessionsChartInstance) modeSessionsChartInstance.destroy();
  const labels = ['Word games', 'Grammar games'];
  const data = [word, grammar];
  const maxVal = Math.max(...data, 1);
  modeSessionsChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Sessions',
        data,
        backgroundColor: ['#19777e', '#93cbcf'],
        borderColor: ['#155a62', '#6a9fa6'],
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, max: maxVal * 1.1 }
      }
    }
  });
}

function renderGameDonut(canvas, percent) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const existing = gameChartsRegistry.get(canvas.id);
  if (existing) existing.destroy();
  const chart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Complete', 'Remaining'],
      datasets: [{
        data: [percent, 100 - percent],
        backgroundColor: ['#19777e', '#e5e7eb'],
        borderColor: ['#155a62', '#d1d5db'],
        borderWidth: 2,
        cutout: '60%',
        hoverBorderColor: ['#0f5a68', '#d1d5db']
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 1,
      animation: { animateRotate: true, animateScale: true },
      plugins: { legend: { display: false }, tooltip: { enabled: false } }
    }
  });
  gameChartsRegistry.set(canvas.id, chart);
}

// Activity chart functions
function startOfWeek(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function computeActivitySeries(sessions, mode) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const dayCounts = new Map();
  (sessions || []).forEach(sess => {
    const iso = (sess.ended_at || sess.started_at || '').split('T')[0];
    if (!iso) return;
    dayCounts.set(iso, (dayCounts.get(iso) || 0) + 1);
  });

  if (mode === 'week') {
    const weekCounts = new Map();
    dayCounts.forEach((count, key) => {
      const date = new Date(key + 'T00:00:00');
      if (Number.isNaN(date.getTime())) return;
      const start = startOfWeek(date);
      const wkKey = start.toISOString().split('T')[0];
      weekCounts.set(wkKey, (weekCounts.get(wkKey) || 0) + count);
    });
    const labels = [];
    const data = [];
    const current = startOfWeek(now);
    for (let i = 11; i >= 0; i--) {
      const week = new Date(current);
      week.setDate(week.getDate() - i * 7);
      const key = week.toISOString().split('T')[0];
      labels.push(`Week of ${week.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`);
      data.push(weekCounts.get(key) || 0);
    }
    return { labels, data };
  }

  if (mode === 'month') {
    const monthCounts = new Map();
    dayCounts.forEach((count, key) => {
      const date = new Date(key + 'T00:00:00');
      if (Number.isNaN(date.getTime())) return;
      const mKey = `${date.getFullYear()}-${date.getMonth()}`;
      monthCounts.set(mKey, (monthCounts.get(mKey) || 0) + count);
    });
    const labels = [];
    const data = [];
    const current = new Date(now.getFullYear(), now.getMonth(), 1);
    for (let i = 11; i >= 0; i--) {
      const month = new Date(current.getFullYear(), current.getMonth() - i, 1);
      const key = `${month.getFullYear()}-${month.getMonth()}`;
      labels.push(month.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }));
      data.push(monthCounts.get(key) || 0);
    }
    return { labels, data };
  }

  const labels = [];
  const data = [];
  for (let i = 13; i >= 0; i--) {
    const day = new Date(now);
    day.setDate(day.getDate() - i);
    const key = day.toISOString().split('T')[0];
    labels.push(day.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
    data.push(dayCounts.get(key) || 0);
  }
  return { labels, data };
}

function updateActivityToggle() {
  const toggle = $('#activityToggle');
  if (!toggle) return;
  toggle.querySelectorAll('button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.range === activityViewMode);
  });
}

function bindActivityToggle() {
  const toggle = $('#activityToggle');
  if (!toggle || toggle.dataset.bound === 'true') return;
  toggle.dataset.bound = 'true';
  toggle.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.range;
      if (!mode || mode === activityViewMode) return;
      activityViewMode = mode;
      updateActivityToggle();
      renderDailyActivityChart();
    });
  });
}

function renderDailyActivityChart() {
  const ctx = $('#dailyActivityChart');
  if (!ctx) return;
  if (dailyActivityChartInstance) dailyActivityChartInstance.destroy();
  const { labels, data } = computeActivitySeries(activitySessions, activityViewMode);
  const datasetLabel = activityViewMode === 'week' ? 'Sessions per week' : activityViewMode === 'month' ? 'Sessions per month' : 'Sessions per day';
  dailyActivityChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: datasetLabel,
        data,
        borderColor: '#19777e',
        backgroundColor: 'rgba(25,119,126,0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.35,
        pointRadius: 3,
        pointBackgroundColor: '#19777e',
        pointBorderColor: '#fff',
        pointBorderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: true, position: 'top' } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
    }
  });
}

// Student details rendering
function renderStudentDetails(d){
  const name = d.student?.name || 'Student';
  const cls = d.student?.class || '';
  studentTitle.textContent = `${name}${cls? ' • ' + cls : ''}`;
  const t = d.totals || { attempts:0, correct:0, accuracy:0, points:0, stars:0 };
  const sessionsCount = (d.sessions && d.sessions.count) || 0;
  const lists = d.lists || [];
  const modeSummaryMap = new Map();
  (d.modes || []).forEach(m => {
    if (!m || !m.mode) return;
    modeSummaryMap.set(m.mode, m);
  });
  const recent = d.recent || [];

  const sessionBuckets = { word: 0, grammar: 0 };
  const categorizeMode = (mode = '') => {
    const m = mode.toLowerCase();
    if (/(word|vocab|list)/.test(m)) return 'word';
    if (/grammar|sentence/.test(m)) return 'grammar';
    return null;
  };
  lists.forEach(l => {
    const bucket = categorizeMode(l.mode);
    if (!bucket) return;
    sessionBuckets[bucket] += l.count || 0;
  });
  if (!sessionBuckets.word && !sessionBuckets.grammar) {
    recent.forEach(sess => {
      const bucket = categorizeMode(sess.mode);
      if (!bucket) return;
      sessionBuckets[bucket] += 1;
    });
  }

  activitySessions = recent;
  activityViewMode = 'day';

  // Overview tab
  ensureStudentTabs();
  gameChartsRegistry.forEach(chart => chart.destroy());
  gameChartsRegistry.clear();
  const tabOverview = $('#tab-overview');
  if (tabOverview) {
    tabOverview.innerHTML = `
      <div class="overview-grid">
        <div class="stat-card">
          <img src="/Games/english_arcade/assets/Images/icons/target.svg" alt="Accuracy target" class="icon-img" />
          <div class="val">${t.accuracy||0}%</div>
          <div class="label">Accuracy</div>
        </div>
        <div class="stat-card">
          <div class="icon">⭐</div>
          <div class="val">${t.stars||0}</div>
          <div class="label">Stars earned</div>
        </div>
        <div class="stat-card">
          <div class="icon">🏆</div>
          <div class="val">${t.points||0}</div>
          <div class="label">Points</div>
        </div>
        <div class="chart-container">
          <canvas id="accuracyChart"></canvas>
        </div>
        <div class="chart-container">
          <canvas id="modeSessionsChart"></canvas>
        </div>
        <div style="grid-column:1/-1;">
          <div class="chart-container" style="height:260px;">
            <div class="chart-toolbar">
              <span class="chart-title">Sessions activity</span>
              <div class="chart-toggle" id="activityToggle">
                <button type="button" class="toggle-btn active" data-range="day">Day</button>
                <button type="button" class="toggle-btn" data-range="week">Week</button>
                <button type="button" class="toggle-btn" data-range="month">Month</button>
              </div>
            </div>
            <canvas id="dailyActivityChart"></canvas>
          </div>
        </div>
      </div>
    `;

    // Defer chart creation to next tick so canvas elements exist
    setTimeout(() => {
      renderAccuracyChart(t.accuracy || 0);
      renderModeSessionChart(sessionBuckets.word, sessionBuckets.grammar);
      updateActivityToggle();
      renderDailyActivityChart();
      bindActivityToggle();
    }, 0);
  }

  const combinedMap = new Map();
  lists.forEach(l => {
    const listRaw = l.list_name || '(Unknown List)';
    const baseName = typeof listRaw === 'string' ? listRaw.trim() : listRaw;
    let entry = combinedMap.get(baseName);
    if (!entry) {
      entry = { name: baseName, totalSessions: 0, bestStars: 0, last_played: l.last_played || null, totalSize: l.list_size || null, modes: new Map() };
      combinedMap.set(baseName, entry);
    }
    const attempts = l.count || 0;
    entry.totalSessions += attempts;
    if (l.list_size && !entry.totalSize) entry.totalSize = l.list_size;
    if (l.last_played && (!entry.last_played || l.last_played > entry.last_played)) entry.last_played = l.last_played;
    const stars = l.stars || 0;
    if (stars > entry.bestStars) entry.bestStars = stars;
    const modeRaw = l.mode || 'unknown';
    const modeKey = typeof modeRaw === 'string' ? modeRaw.trim() : modeRaw;
    const existing = entry.modes.get(modeKey) || { mode: modeKey, stars: 0, attempts: 0, accuracy: null };
    existing.stars = Math.max(existing.stars, stars);
    existing.attempts += attempts;
    const summary = modeSummaryMap.get(modeKey);
    if (summary && Number.isFinite(summary.accuracy)) existing.accuracy = summary.accuracy;
    entry.modes.set(modeKey, existing);
  });
  console.log('[Games] Received', lists.length, 'list-mode entries, combined into', combinedMap.size, 'lists');

  // Sort combined games so the most recently-played lists appear first.
  // This helps teachers quickly verify recent activity. Fallback to stars/sessions/name.
  const parseDateForSort = (iso) => {
    if (!iso) return 0;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? 0 : d.getTime();
  };

  const combinedGames = Array.from(combinedMap.values()).sort((a, b) => {
    const aTime = parseDateForSort(a.last_played);
    const bTime = parseDateForSort(b.last_played);
    if (bTime !== aTime) return bTime - aTime; // newest first
    // fallback: prefer higher stars, then more sessions, then alphabetical
    const starDiff = (b.bestStars || 0) - (a.bestStars || 0);
    if (starDiff !== 0) return starDiff;
    const sessDiff = (b.totalSessions || 0) - (a.totalSessions || 0);
    if (sessDiff !== 0) return sessDiff;
    return friendlyListName(a.name).localeCompare(friendlyListName(b.name));
  });

  // Categorize each game
  const categorizeList = (name, modes) => {
    const lowerName = (name || '').toLowerCase();
    if (lowerName.includes('phonics')) return 'phonics';
    if (lowerName.includes('grammar')) return 'grammar';
    if (modes && modes.some(m => (m.mode || '').toLowerCase().includes('phonics'))) return 'phonics';
    if (modes && modes.some(m => (m.mode || '').toLowerCase().includes('grammar'))) return 'grammar';
    return 'vocab';
  };

  combinedGames.forEach(game => {
    game.category = categorizeList(game.name, Array.from(game.modes.values()));
  });

  let gamesFilterMode = 'all';

  const tabGames = $('#tab-games');
  if (tabGames) {
    if (!combinedGames.length) {
      tabGames.innerHTML = '<div class="empty">No games played yet.</div>';
    } else {
      const renderGameCards = (games) => {
        return games.map((game, idx) => {
          const bestStars = Math.min(game.bestStars || 0, 5);
          const lastPlayed = game.last_played ? formatDateLabel(game.last_played) : '—';
          const listSizeLabel = game.totalSize ? `${game.totalSize} words` : null;
          const chartId = `gameChart${idx}`;
          const modeCharts = Array.from(game.modes.values()).sort((a,b)=> (b.stars - a.stars) || ((b.attempts||0) - (a.attempts||0)));
          const lowerListName = friendlyListName(game.name).toLowerCase();
          const hasPhonics = lowerListName.includes('phonics') || modeCharts.some(m => (m.mode || '').toLowerCase().includes('phonics'));
          const hasGrammar = lowerListName.includes('grammar') || modeCharts.some(m => (m.mode || '').toLowerCase().includes('grammar'));
          // Grammar heuristic: base 4 core modes; upgrade to 6 if two or more distinct advanced grammar modes appear.
          let totalModesAvailable;
          if (hasPhonics) {
            totalModesAvailable = 4;
          } else if (hasGrammar) {
            const modeNames = new Set(modeCharts.map(m => (m.mode || '').toLowerCase()));
            const advancedFlags = ['grammar_sorting','grammar_find_mistake','grammar_translation_choice'];
            let advancedCount = 0; advancedFlags.forEach(flag => { if ([...modeNames].some(n => n.includes(flag))) advancedCount++; });
            totalModesAvailable = advancedCount >= 2 ? 6 : 4;
          } else {
            totalModesAvailable = 6; // vocab default expected set
          }
          // Count passed modes: require at least 1 star (>=60%) or a lesson mode.
          const modesCompleted = modeCharts.filter(m => {
            const stars = m.stars || 0;
            const modeLower = (m.mode || '').toLowerCase();
            if (modeLower.startsWith('grammar_lesson') || modeLower === 'lesson') return true;
            return stars >= 1;
          }).length;
          // If we somehow see more passed modes than total heuristic, lift total to avoid >100% math.
          if (modesCompleted > totalModesAvailable) totalModesAvailable = modesCompleted;
          const completionPct = totalModesAvailable ? Math.round((modesCompleted / totalModesAvailable) * 100) : 0;
          const modeChartHtml = modeCharts.map((mode, mIdx) => {
            const percent = Math.round(Math.min(mode.stars || 0,5) / 5 * 100);
            const modeId = `${chartId}_mode_${mIdx}`;
            const metaBits = [ `${Math.min(mode.stars || 0,5)}/5 stars`, pluralize('session', mode.attempts || 0) ];
            if (Number.isFinite(mode.accuracy)) metaBits.push(`${mode.accuracy}% accuracy`);
            return `
              <div class="game-chart mode">
                <canvas id="${modeId}" width="140" height="140" data-percent="${percent}"></canvas>
                <div class="chart-caption">${friendlyModeName(mode.mode)}</div>
                <div class="mode-caption">${metaBits.join(' • ')}</div>
              </div>
            `;
          }).join('');
          const metaLine = [pluralize('session', game.totalSessions || 0)];
          if (listSizeLabel) metaLine.push(listSizeLabel);
          metaLine.push(`Last played ${lastPlayed}`);
          return `
            <div class="game-card" data-chart-id="${chartId}" data-completion="${completionPct}" data-best-stars="${bestStars}">
              <div class="game-header">
                <div>
                  <div class="game-name">${friendlyListName(game.name)}</div>
                  <div class="game-meta">${metaLine.join(' • ')}</div>
                </div>
              </div>
              <div class="game-charts">
                <div class="game-chart overall">
                  <canvas id="${chartId}" width="160" height="160" data-percent="${completionPct}"></canvas>
                  <div class="chart-caption">${completionPct}% complete</div>
                  <div class="mode-caption">${modesCompleted} of ${totalModesAvailable} modes</div>
                </div>
                ${modeChartHtml}
              </div>
            </div>
          `;
        }).join('');
      };

      const filteredGames = combinedGames.filter(g => gamesFilterMode === 'all' || g.category === gamesFilterMode);
      const cards = renderGameCards(filteredGames);
      
      tabGames.innerHTML = `
        <div class="games-toolbar">
          <div class="chart-toggle" id="gamesFilter">
            <button type="button" class="toggle-btn active" data-filter="all">All</button>
            <button type="button" class="toggle-btn" data-filter="vocab">Vocab</button>
            <button type="button" class="toggle-btn" data-filter="grammar">Grammar</button>
            <button type="button" class="toggle-btn" data-filter="phonics">Phonics</button>
          </div>
        </div>
        <div class="game-list" id="gameList">${cards}</div>
      `;

      requestAnimationFrame(() => {
        tabGames.querySelectorAll('canvas[data-percent]').forEach(canvas => {
          const percent = Number(canvas.dataset.percent) || 0;
          renderGameDonut(canvas, Math.max(0, Math.min(100, percent)));
        });
      });

      const filterButtons = tabGames.querySelectorAll('#gamesFilter button');
      filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          gamesFilterMode = btn.dataset.filter;
          filterButtons.forEach(b => b.classList.toggle('active', b.dataset.filter === gamesFilterMode));
          
          const gameList = $('#gameList');
          if (!gameList) return;
          
          const filtered = combinedGames.filter(g => gamesFilterMode === 'all' || g.category === gamesFilterMode);
          const newCards = renderGameCards(filtered);
          gameList.innerHTML = newCards;
          
          requestAnimationFrame(() => {
            gameList.querySelectorAll('canvas[data-percent]').forEach(canvas => {
              const percent = Number(canvas.dataset.percent) || 0;
              renderGameDonut(canvas, Math.max(0, Math.min(100, percent)));
            });
          });
        });
      });
    }
  }

  const tabTests = $('#tab-tests');
  if (tabTests && !tabTests.dataset.locked) {
    tabTests.innerHTML = '<div class="empty">Tests view coming soon.</div>';
    tabTests.dataset.locked = 'true';
  }

  switchTab('overview');
}

// Class name formatting
// Display: title-case the raw class name for nicer UI labels.
const displayClassName = (raw) => {
  if (!raw) return '';
  const s = String(raw).trim();
  return s.split(/\s+/).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
};
// Backend class name: do not normalize or map values (stop legacy 'new york' -> 'NY' parsing).
// Return the input as-is (trimmed) so the server receives the exact class identifier.
const backendClassName = (input) => {
  if (input == null) return input;
  return String(input).trim();
};
const canonicalClassKey = (value) => {
  if (value == null) return '';
  return String(value).trim().toLowerCase().replace(/\s+/g, ' ');
};

const normalizeClassRecord = (record) => {
  const rawName = typeof record === 'string'
    ? record
    : (record && (record.name || record.class)) || record || '';
  return {
    name: rawName,
    display: displayClassName(rawName),
    hidden: !!(record && typeof record === 'object' && (record.hidden || record.visible === false))
  };
};

const filterClassesForRole = (classes) => {
  if (userRole === 'admin') return classes;
  return classes.filter(cls => !cls.hidden);
};

// User role management
async function requireUserRole(){
  if (userRole !== null) return userRole;
  if (typeof userRoleReady !== 'undefined' && userRoleReady && typeof userRoleReady.then === 'function') {
    try {
      // Add a 5-second timeout to prevent indefinite hanging
      return await Promise.race([
        userRoleReady,
        new Promise((_, reject) => setTimeout(() => reject(new Error('User role timeout')), 5000))
      ]);
    } catch (err) {
      console.warn('requireUserRole error:', err);
      return userRole;
    }
  }
  return userRole;
}

// Data loading functions
async function loadClasses(){
  if (!classSel) { console.error('classSel not found'); return; }
  classSel.innerHTML = '<option value="">Loading…</option>';
  setStatus('Loading classes…');
  try{
    await requireUserRole();
    const js = await API.classes();
    const classesRaw = (js && js.success && Array.isArray(js.classes)) ? js.classes : [];
    const normalized = filterClassesForRole(classesRaw.map(normalizeClassRecord));
    if (!normalized.length) { classSel.innerHTML = '<option value="">No classes</option>'; setStatus('No student classes found'); return; }
    classSel.innerHTML = '<option value="">Choose class…</option>' + normalized.map(c => `<option value="${c.name}">${c.display}</option>`).join('');
    setStatus(`Loaded ${normalized.length} class${normalized.length === 1 ? '' : 'es'}`);
    scheduleLeaderboardPrefetch(normalized);
  } catch(e){ classSel.innerHTML = '<option value="">Error loading</option>'; setStatus('Failed to load classes', 'error'); }
}

async function loadLeaderboard(){
  const selected = classSel.value; if (!selected) { rawLeaderboard = []; renderLeaderboard([]); renderStudentEmpty(); setStatus('Select a class to view results'); return; }
  const tf = timeSel.value || 'month';
  const apiClass = backendClassName(selected);
  const leaderboardTitle = document.getElementById('leaderboardTitle');
  if (leaderboardTitle) leaderboardTitle.textContent = `${displayClassName(selected)} Leaderboard`;
  lbBody.innerHTML = '<tr><td colspan="7" class="empty">Loading…</td></tr>';
  setStatus(`Loading ${displayClassName(selected)} (${tf})…`);
  const cached = cacheGetLeaderboard(apiClass, tf);
  if (cached) {
    rawLeaderboard = cached;
    renderLeaderboard(rawLeaderboard);
    setStatus('Showing cached leaderboard… updating');
  }
  try{
    const js = await API.leaderboard(apiClass, tf);
    rawLeaderboard = (js && js.success && Array.isArray(js.leaderboard)) ? js.leaderboard : [];
    cacheSetLeaderboard(apiClass, tf, rawLeaderboard);
    renderLeaderboard(rawLeaderboard);
    if (!rawLeaderboard.length) setStatus('No attempts yet for this filter');
    else {
      const total = rawLeaderboard.length;
      let msg = total > 200 ? `Showing top 200 of ${total} students` : `Showing ${total} students`;
      if (js && js.truncated) msg += ' (partial data)';
      setStatus(msg);
    }
      scheduleStudentPrefetch(rawLeaderboard, tf);
  } catch(e){ lbBody.innerHTML = '<tr><td colspan="6" class="empty">Failed to load</td></tr>'; setStatus('Leaderboard error', 'error'); }
}

async function loadStudent(uid){
  const tf = timeSel.value || 'month';
  ensureStudentTabs();
  const tabOverview = $('#tab-overview');
  if (tabOverview) tabOverview.innerHTML = '<div class="empty">Loading…</div>';
  const tabGames = $('#tab-games');
  if (tabGames) tabGames.innerHTML = '<div class="empty">Loading games…</div>';
  switchTab('overview');
  setStatus('Loading student details…');
  const cached = cacheGetStudentDetails(uid, tf);
  if (cached && cached.success) {
    renderStudentDetails(cached);
    setStatus('Showing cached student details… updating');
  }
  try{
    const js = await API.student(uid, tf);
    if (js && js.success) {
      cacheSetStudentDetails(uid, tf, js);
      renderStudentDetails(js);
      if (js.truncated || (js.sessions && js.sessions.truncated)) {
        setStatus('Partial student data (too many records)');
      } else {
        setStatus('');
      }
    }
    else {
      ensureStudentTabs();
      const ov = $('#tab-overview');
      if (ov) ov.innerHTML = '<div class="empty">No data</div>';
      setStatus('No student data', 'error');
    }
  } catch(e){
    ensureStudentTabs();
    const ov = $('#tab-overview');
    if (ov) ov.innerHTML = '<div class="empty">Failed to load</div>';
    setStatus('Student details error', 'error');
  }
}

// Class Tracker functions
async function loadClassTrackerClasses(){
  const classList = $('#classList');
  classList.innerHTML = '<div style="padding:1rem; color:#6b7280;">Loading classes...</div>';
  try{
    await requireUserRole();
    const js = await API.classes();
    const classesRaw = (js && js.success && Array.isArray(js.classes)) ? js.classes : [];
    const normalized = classesRaw.map(normalizeClassRecord);
    const displayClasses = userRole === 'admin' ? normalized : normalized.filter(cls => !cls.hidden);
    
    if (!displayClasses.length) { classList.innerHTML = '<div style="padding:1rem; color:#6b7280;">No classes found</div>'; return; }
    classList.innerHTML = displayClasses.map(cls => {
      const hiddenClass = cls.hidden ? 'hidden' : '';
      const badge = cls.hidden ? '<span class="visibility-badge">Hidden</span>' : '<span class="visibility-badge">Visible</span>';
      return `<div class="class-item ${hiddenClass}" data-class="${cls.name}" data-display="${cls.display}" data-hidden="${cls.hidden}"><span>${cls.display}</span>${userRole === 'admin' ? badge : ''}</div>`;
    }).join('');
    classList.querySelectorAll('.class-item').forEach(item => {
      const badge = item.querySelector('.visibility-badge');
      if (badge) {
        badge.addEventListener('click', async (e) => {
          e.stopPropagation();
          const className = item.dataset.class;
          const isCurrentlyHidden = item.dataset.hidden === 'true';
          const newHiddenState = !isCurrentlyHidden;
          try {
            const result = await API.toggleClassVisibility(className, newHiddenState);
            if (result && result.success) {
              const updatedHidden = Object.prototype.hasOwnProperty.call(result, 'hidden') ? !!result.hidden : newHiddenState;
              item.dataset.hidden = updatedHidden.toString();
              item.classList.toggle('hidden', updatedHidden);
              badge.textContent = updatedHidden ? 'Hidden' : 'Visible';
            } else {
              alert(result && result.error ? result.error : 'Failed to update class visibility');
            }
          } catch (err) {
            console.error('Error toggling visibility:', err);
            alert('Error updating class visibility');
          }
        });
      }
      item.addEventListener('click', () => {
        classList.querySelectorAll('.class-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        classTrackerSelectedClass = item.dataset.class;
        loadClassStats(classTrackerSelectedClass, item.dataset.display);
      });
    });
    // Also populate Homework classes from the same data
    renderHomeworkClasses(displayClasses);
    refreshHomeworkActiveStates();
  } catch(e){ classList.innerHTML = '<div style="padding:1rem; color:#6b7280;">Error loading classes</div>'; }
}

function renderHomeworkClasses(displayClasses) {
  const hwClassList = document.getElementById('homeworkClassList');
  if (!hwClassList) return;
  if (!displayClasses.length) {
    hwClassList.innerHTML = '<div style="padding:1rem; color:#6b7280;">No classes found</div>';
    return;
  }
  hwClassList.innerHTML = displayClasses.map(cls => {
    const key = canonicalClassKey(cls.name);
    return `<div class="class-item" data-class="${cls.name}" data-display="${cls.display}" data-class-key="${key}"><span>${cls.display}</span></div>`;
  }).join('');
  applyHomeworkClassHighlights(hwClassList);
  hwClassList.querySelectorAll('.class-item').forEach(item => {
    const clsName = item.dataset.class;
    const displayName = item.dataset.display;
    item.addEventListener('click', () => {
      hwClassList.querySelectorAll('.class-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      const hwStudentsSubtitle = document.getElementById('homeworkStudentsSubtitle');
      const hwAssignmentMeta = document.getElementById('homeworkAssignmentMeta');
      if (hwStudentsSubtitle) hwStudentsSubtitle.textContent = `${displayName} • Homework`;
      if (hwAssignmentMeta) hwAssignmentMeta.textContent = `Homework overview for ${displayName}.`;
      
      // Store selected class globally for modal
      window.currentHomeworkClass = { name: clsName, display: displayName };

      if (typeof loadHomeworkForClass === 'function') {
        // Clear any previously selected assignment when changing class
        try { window.currentHomeworkAssignment = null; } catch(e){}
        try { const al = document.getElementById('assignmentList'); if (al) al.querySelectorAll('.hw-assignment-card.selected').forEach(c=>c.classList.remove('selected')); } catch(e){}
        loadHomeworkForClass(clsName, displayName);
      }
      
      // TODO: Load student homework progress when homework_attempts table is created
      // loadHomeworkStudentProgress(clsName, displayName);
    });
  });
}

function applyHomeworkClassHighlights(listRoot) {
  if (!listRoot) return;
  listRoot.querySelectorAll('.class-item').forEach(item => {
    const key = item.dataset.classKey || canonicalClassKey(item.dataset.class);
    if (key && classesWithActiveHomework.has(key)) {
      item.classList.add('homework-active');
    } else {
      item.classList.remove('homework-active');
    }
  });
}

async function refreshHomeworkActiveStates() {
  try {
    const resp = await WillenaAPI.fetch('/.netlify/functions/homework_api?action=list_assignments');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    if (!data || data.success !== true) throw new Error(data?.error || 'Unexpected response');
    const newSet = new Set();
    (Array.isArray(data.assignments) ? data.assignments : []).forEach(assign => {
      if (assign && assign.active) {
        const key = canonicalClassKey(assign.class || assign.class_name || assign.className);
        if (key) newSet.add(key);
      }
    });
    classesWithActiveHomework = newSet;
    const hwClassList = document.getElementById('homeworkClassList');
    if (hwClassList) applyHomeworkClassHighlights(hwClassList);
  } catch (err) {
    console.warn('Failed to refresh active homework highlights:', err && err.message ? err.message : err);
  }
}

async function loadHomeworkForClass(className, displayName) {
  const assignmentList = document.getElementById('assignmentList');
  if (!assignmentList) return;

  assignmentList.innerHTML = '<div class="empty" style="padding:16px; text-align:center; color:#6b7280;">Loading assignments...</div>';

  try {
    const resp = await WillenaAPI.fetch(`/.netlify/functions/homework_api?action=list_assignments&class=${encodeURIComponent(className)}`);
    const data = await resp.json();
    if (!resp.ok || !data.success) throw new Error(data.error || `HTTP ${resp.status}`);

    const assignments = data.assignments || [];
    if (!assignments.length) {
      assignmentList.innerHTML = '<div class="empty" style="padding:16px; text-align:center; color:#6b7280;">No assignments yet.</div>';
      return;
    }

    // Store all assignments globally for filtering
    window.allAssignments = assignments;
    
    // Render based on active tab (default: active)
    const activeTab = document.querySelector('.assignment-filter-tab-active');
    const showEnded = activeTab && activeTab.id === 'assignmentTabEnded';
    renderAssignmentsList(assignments, showEnded, className, displayName);
    refreshHomeworkActiveStates();
  } catch (err) {
    console.error('loadHomeworkForClass error:', err);
    assignmentList.innerHTML = `<div class="empty" style="padding:16px; text-align:center; color:#dc2626;">Error: ${err.message}</div>`;
  }
}

function renderAssignmentsList(assignments, showEnded, className, displayName) {
  const assignmentList = document.getElementById('assignmentList');
  if (!assignmentList) return;
  
  const filtered = showEnded ? assignments.filter(a => !a.active) : assignments.filter(a => a.active);
  
  if (!filtered.length) {
    assignmentList.innerHTML = `<div class="empty" style="padding:16px; text-align:center; color:#6b7280;">No ${showEnded ? 'ended' : 'active'} assignments.</div>`;
    return;
  }

  assignmentList.innerHTML = filtered.map(a => {
    // Calculate countdown
    const dueDate = a.due_at ? new Date(a.due_at) : null;
    const now = new Date();
    let countdown = '';
    if (dueDate) {
      let diff = dueDate - now;
      if (diff > 0) {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        diff -= days * (1000 * 60 * 60 * 24);
        const hours = Math.floor(diff / (1000 * 60 * 60));
        diff -= hours * (1000 * 60 * 60);
        const minutes = Math.floor(diff / (1000 * 60));
        countdown = `${days > 0 ? days + 'd ' : ''}${hours}h ${minutes}m left`;
      } else {
        countdown = 'Past due';
      }
    }
    const endedClass = a.active ? '' : 'ended';
    const actionButton = a.active 
      ? `<button type="button" class="ghost hw-end-btn" data-assignment-id="${a.id}" style="flex: 1; padding: 4px 6px; font-size: 0.7rem;">End</button>`
      : `<button type="button" class="ghost hw-delete-btn" data-assignment-id="${a.id}" style="flex: 1; padding: 4px 6px; font-size: 0.7rem; color: #dc2626; border-color: #dc2626;">Delete</button>`;
    const linkButton = `<button type="button" class="ghost hw-link-btn" data-assignment-id="${a.id}" title="Retroactively link sessions that may have been played without homework tracking" style="flex: 1; padding: 4px 6px; font-size: 0.65rem; color: #6366f1; border-color: #6366f1;">🔗 Link</button>`;
    return `<div class="hw-assignment-card ${endedClass}" data-assignment-id="${a.id}" style="padding:10px 12px; border: 2px solid #22d3ee; border-radius: 8px; box-shadow: 0 2px 8px rgba(34,211,238,0.08), 0 1px 3px rgba(0,0,0,.04); cursor: pointer; transition: box-shadow 0.18s, transform 0.18s, border-color 0.18s;">
      <div style="font-weight: 600; font-size: 0.9rem; color: #1f2937; margin-bottom: 6px;">${a.title || 'Untitled'}</div>
      <div style="font-size: 0.7rem; color: #999;">Due: ${dueDate ? dueDate.toLocaleDateString() : '—'} <span style="margin-left:8px; color:#19777e; font-weight:500;">${countdown}</span></div>
      <div style="display: flex; gap: 4px; margin-top: 8px;">
        ${actionButton}
        ${linkButton}
      </div>
    </div>`;
  }).join('');

  // Card click triggers view progress
  assignmentList.querySelectorAll('.hw-assignment-card').forEach(card => {
    card.addEventListener('click', async (e) => {
      console.log('Assignment card clicked, target:', e.target.className, 'id:', card.getAttribute('data-assignment-id'));
      if (e.target.classList.contains('hw-end-btn') || e.target.classList.contains('hw-link-btn') || e.target.classList.contains('hw-delete-btn')) return;
      const id = card.getAttribute('data-assignment-id');
      console.log('Processing click for assignment', id);
      // Persist selection: clear other selected cards, mark this one
      try {
        assignmentList.querySelectorAll('.hw-assignment-card.selected').forEach(c => c.classList.remove('selected'));
      } catch(e){}
      card.classList.add('selected');
      console.log('Added selected class, card classes:', card.className);
      try { window.currentHomeworkAssignment = id; } catch(e){}
      if (id) {
        // Create a run token for this assignment (best-effort). If token is created
        // the server and the game should use it to link sessions. Failure to
        // create a token is non-fatal and we fall back to name-based matching.
        try {
          await createRunTokenForAssignment(id);
        } catch (err) { /* non-fatal */ }
        loadHomeworkStudentProgress(className, id);
      }
    });
  });
  
  // End button with countdown timer (no confirm popup; click again to cancel)
  assignmentList.querySelectorAll('.hw-end-btn').forEach(btn => {
    btn.dataset.countdownActive = '0'; // Track if countdown is active
    btn.dataset.countdownId = null; // Store interval ID for cleanup
    
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-assignment-id');
      if (!id) return;
      
      const isCountingDown = btn.dataset.countdownActive === '1';
      
      if (isCountingDown) {
        // Cancel countdown
        clearInterval(parseInt(btn.dataset.countdownId));
        btn.dataset.countdownActive = '0';
        btn.textContent = 'End';
        btn.disabled = false;
        return;
      }
      
      // Start countdown
      btn.disabled = false; // Keep enabled so user can click to cancel
      btn.dataset.countdownActive = '1';
      const originalText = 'End';
      let countdown = 5;
      btn.textContent = `${countdown}s`;
      btn.style.background = '#fecaca'; // Light red to indicate active countdown
      
      const countdownInterval = setInterval(() => {
        countdown--;
        if (countdown > 0) {
          btn.textContent = `${countdown}s`;
        } else {
          clearInterval(countdownInterval);
          btn.dataset.countdownActive = '0';
          
          // Execute end assignment
          (async () => {
            try {
              const resp = await WillenaAPI.fetch('/.netlify/functions/homework_api?action=end_assignment', {
                method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id })
              });
              const js = await resp.json().catch(()=>({}));
              if (!resp.ok || !js.success) throw new Error(js.error || 'Failed');
              // Reload assignments after successful end
              await new Promise(resolve => setTimeout(resolve, 1000));
              loadHomeworkForClass(className, displayName);
            } catch (err) { 
              btn.textContent = originalText;
              btn.style.background = '';
              btn.disabled = false;
              alert('Error ending assignment: '+ err.message); 
            }
          })();
        }
      }, 1000);
      
      btn.dataset.countdownId = countdownInterval;
    });
  });
  
  // Delete button for ended assignments
  assignmentList.querySelectorAll('.hw-delete-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-assignment-id');
      if (!id) return;
      
      if (!confirm('Delete this assignment permanently? This cannot be undone.')) return;
      
      try {
        const resp = await WillenaAPI.fetch('/.netlify/functions/homework_api?action=delete_assignment', {
          method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id })
        });
        const js = await resp.json().catch(()=>({}));
        if (!resp.ok || !js.success) throw new Error(js.error || 'Failed to delete');
        // Reload assignments after successful delete
        await new Promise(resolve => setTimeout(resolve, 500));
        loadHomeworkForClass(className, displayName);
      } catch (err) { 
        alert('Error deleting assignment: '+ err.message); 
      }
    });
  });

  // Link Sessions button - retroactively links sessions played without homework tokens
  assignmentList.querySelectorAll('.hw-link-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-assignment-id');
      if (!id) return;
      
      const originalText = btn.textContent;
      btn.textContent = '⏳ Linking...';
      btn.disabled = true;
      
      try {
        const resp = await WillenaAPI.fetch(`/.netlify/functions/homework_api?action=link_sessions&assignment_id=${encodeURIComponent(id)}`);
        const js = await resp.json().catch(() => ({}));
        if (!resp.ok || !js.success) throw new Error(js.error || 'Failed to link sessions');
        
        const linked = js.linked || 0;
        const alreadyLinked = js.already_linked || 0;
        const totalFound = js.total_found || 0;
        
        if (linked > 0) {
          btn.textContent = `✅ ${linked} linked!`;
          btn.style.color = '#22c55e';
          btn.style.borderColor = '#22c55e';
          // Refresh the progress view to show updated data
          setTimeout(() => {
            loadHomeworkStudentProgress(className, id);
          }, 500);
        } else if (totalFound > 0 && alreadyLinked === totalFound) {
          btn.textContent = '✅ All linked';
          btn.style.color = '#22c55e';
          btn.style.borderColor = '#22c55e';
        } else {
          btn.textContent = 'No sessions found';
        }
        
        // Reset button after a delay
        setTimeout(() => {
          btn.textContent = originalText;
          btn.style.color = '#6366f1';
          btn.style.borderColor = '#6366f1';
          btn.disabled = false;
        }, 3000);
      } catch (err) {
        btn.textContent = '❌ Error';
        btn.style.color = '#dc2626';
        btn.style.borderColor = '#dc2626';
        console.error('Link sessions error:', err);
        setTimeout(() => {
          btn.textContent = originalText;
          btn.style.color = '#6366f1';
          btn.style.borderColor = '#6366f1';
          btn.disabled = false;
        }, 2000);
      }
    });
  });
}

// Helper to clear selected assignment highlight and global pointer
function clearHomeworkSelection() {
  try { window.currentHomeworkAssignment = null; } catch(e){}
  try {
    const al = document.getElementById('assignmentList');
    if (al) al.querySelectorAll('.hw-assignment-card.selected').forEach(c => c.classList.remove('selected'));
  } catch(e){}
}

// Tab filtering
document.addEventListener('DOMContentLoaded', () => {
  const tabActive = document.getElementById('assignmentTabActive');
  const tabEnded = document.getElementById('assignmentTabEnded');
  
  if (tabActive) {
    tabActive.addEventListener('click', () => {
      if (window.allAssignments && window.currentHomeworkClass) {
  tabActive.classList.add('assignment-filter-tab-active');
  tabEnded.classList.remove('assignment-filter-tab-active');
  tabActive.setAttribute('aria-selected', 'true');
  tabEnded.setAttribute('aria-selected', 'false');
  // Clear any selected assignment when switching tabs
  try { window.currentHomeworkAssignment = null; } catch(e){}
  try { const al = document.getElementById('assignmentList'); if (al) al.querySelectorAll('.hw-assignment-card.selected').forEach(c=>c.classList.remove('selected')); } catch(e){}
  renderAssignmentsList(window.allAssignments, false, window.currentHomeworkClass.name, window.currentHomeworkClass.display);
      }
    });
  }
  
  if (tabEnded) {
    tabEnded.addEventListener('click', () => {
      if (window.allAssignments && window.currentHomeworkClass) {
  tabEnded.classList.add('assignment-filter-tab-active');
  tabActive.classList.remove('assignment-filter-tab-active');
  tabEnded.setAttribute('aria-selected', 'true');
  tabActive.setAttribute('aria-selected', 'false');
  // Clear selected assignment when switching tabs
  try { window.currentHomeworkAssignment = null; } catch(e){}
  try { const al = document.getElementById('assignmentList'); if (al) al.querySelectorAll('.hw-assignment-card.selected').forEach(c=>c.classList.remove('selected')); } catch(e){}
  renderAssignmentsList(window.allAssignments, true, window.currentHomeworkClass.name, window.currentHomeworkClass.display);
      }
    });
  }
});

// expose for modal refresh
window.loadHomeworkForClass = loadHomeworkForClass;

async function loadClassStats(classNameRaw, displayName){
  const statsContent = $('#classStatsContent');
  const statsTitle = $('#classStatsTitle');
  statsTitle.textContent = `${displayName || displayClassName(classNameRaw)} • Top Students`;
  statsContent.innerHTML = '<div style="text-align:center; padding:1.25rem; color:#6b7280;">Loading...</div>';
  
  try{
    const apiClass = backendClassName(classNameRaw);
    const js = await API.leaderboard(apiClass, 'month');
    const leaderboard = (js && js.success && Array.isArray(js.leaderboard)) ? js.leaderboard : [];
    
    if (!leaderboard.length) {
      statsContent.innerHTML = '<div style="padding:1.25rem; color:#6b7280;">No data for this class</div>';
      return;
    }
    
    // Get top 3 students sorted by super score (highest to lowest)
    const top3 = leaderboard
      .map(s => ({ ...s, superScore: Math.round((s.points * s.stars) / 1000) }))
      .sort((a, b) => b.superScore - a.superScore)
      .slice(0, 3);
    const html = `
      <div class="top-students">
        ${top3.map((student, idx) => {
          const rank = idx + 1;
          const superScore = Math.round((student.points * student.stars) / 1000);
          const sessions = student.attempts || 0;
          return `
            <div class="student-rank-card" data-rank="${rank}">
              <div class="name">${student.name || 'Unknown'}</div>
              <div class="korean-name">${student.korean_name || '—'}</div>
              <div class="stats-row">
                <div class="stat-item">
                  <div class="stat-label">Super Score</div>
                  <div class="stat-value">${superScore}</div>
                </div>
                <div class="stat-item">
                  <div class="stat-label">Stars</div>
                  <div class="stat-value">${student.stars || 0}</div>
                </div>
              </div>
              <div class="stats-row">
                <div class="stat-item">
                  <div class="stat-label">Points</div>
                  <div class="stat-value">${student.points || 0}</div>
                </div>
                <div class="stat-item">
                  <div class="stat-label">Sessions</div>
                  <div class="stat-value">${sessions}</div>
                </div>
              </div>
              <div class="stats-row">
                <div class="stat-item">
                  <div class="stat-label">Accuracy</div>
                  <div class="stat-value">${student.accuracy || 0}%</div>
                </div>
                <div class="stat-item">
                  <div class="stat-label"></div>
                  <div class="stat-value"></div>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
    statsContent.innerHTML = html;
  } catch(e){ statsContent.innerHTML = '<div style="padding:1.25rem; color:#6b7280;">Error loading class stats</div>'; }
}

// Lightweight Homework tab shell wiring (no backend yet)
let homeworkInitialized = false;

function initHomeworkShell() {
  if (homeworkInitialized) return;
  homeworkInitialized = true;

  const hwAssignBtn = document.getElementById('hwAssignBtn');

  if (hwAssignBtn) {
    hwAssignBtn.addEventListener('click', () => {
      let selected = window.currentHomeworkClass;
      // Fallback: if no class stored, check for active class item in homework class list
      if (!selected) {
        const activeItem = document.querySelector('#homeworkClassList .class-item.active');
        if (activeItem) {
          selected = { name: activeItem.dataset.class, display: activeItem.dataset.display };
          window.currentHomeworkClass = selected; // Store for future use
        }
      }
      if (selected && window.HomeworkModal) {
        window.HomeworkModal.open(selected.name, selected.display);
      } else {
        alert('Please select a class first.');
      }
    });
  }

  // Remove obsolete global end button if present
  const obsolete = document.getElementById('hwEndAssignmentBtn');
  if (obsolete) obsolete.style.display = 'none';
}

async function loadHomeworkStudentProgress(className, assignmentId) {
  const table = document.getElementById('homeworkStudentsTable');
  if (!table) return;
  const tbody = table.querySelector('tbody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="empty">Loading progress…</td></tr>';
  try {
    const resp = await WillenaAPI.fetch(`/.netlify/functions/homework_api?action=assignment_progress&class=${encodeURIComponent(className)}&assignment_id=${encodeURIComponent(assignmentId)}`);
    const js = await resp.json();
    if (!resp.ok || !js.success) throw new Error(js.error || `HTTP ${resp.status}`);
    const rows = js.progress || [];
    if (!rows.length) { if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="empty">No progress yet.</td></tr>'; return; }
    // Find the original assignment info (stored earlier when loading assignments)
    const assignment = (window.allAssignments || []).find(a => String(a.id) === String(assignmentId));

    // Expected mode sets
    const VOCAB_EXPECTED = ['meaning','listening','picture','multi_choice','spelling','listen_and_spell'];
    const PHONICS_EXPECTED = ['listen','missing_letter','multi_choice','listen_and_spell'];
  // Grammar heuristic: core (choose, fill_gap, sentence_unscramble) + optional advanced (sorting, find_mistake, translation_choice). Exclude grammar_lesson from total count.
  const GRAMMAR_CORE = ['grammar_choose','grammar_fill_gap','grammar_sentence_unscramble'];
  const GRAMMAR_ADV = ['grammar_sorting','grammar_find_mistake','grammar_translation_choice'];

    const normalizeMode = (raw) => {
      if (!raw) return '';
      const m = String(raw).toLowerCase();
      if (m === 'phonics_listening') return 'listen';
      if (m.startsWith('grammar_lesson')) return 'grammar_lesson';
      // strip common suffixes/prefixes
      return m.replace(/^mode[:\s]*/,'');
    };

    // Build union of all modes reported by backend to help infer expected set
    const unionModes = new Set();
    rows.forEach(r => {
      (r.modes || []).forEach(m => {
        const key = normalizeMode(m.mode || m.mode_name || m.name || '');
        if (key) unionModes.add(key);
      });
    });

    // Heuristic: determine category from assignment metadata or union of modes
    let category = 'vocab';
    try {
      const lk = (assignment && (assignment.list_key || assignment.list_file || assignment.list || assignment.listName || assignment.listName)) || '';
      const title = (assignment && (assignment.title || assignment.list_title || '')) || '';
      const check = (String(lk) + ' ' + String(title)).toLowerCase();
      if (/phonics/.test(check) || Array.from(unionModes).some(m=> m.includes('phonics') || ['listen','missing_letter'].includes(m))) category = 'phonics';
      else if (/grammar/.test(check) || Array.from(unionModes).some(m => m.startsWith('grammar') || m.includes('sentence') || m.includes('fill_gap'))) category = 'grammar';
    } catch {}

    // Compute the expected set based on category and union
    let expectedSet = VOCAB_EXPECTED;
    if (category === 'phonics') expectedSet = PHONICS_EXPECTED;
    else if (category === 'grammar') {
      // Determine which modes are present
      const has = (key) => unionModes.has(key);
      const corePresent = GRAMMAR_CORE.filter(m=>has(m)).length;
      const advancedPresent = GRAMMAR_ADV.filter(m=>has(m)).length;
      // Refined heuristic: grammar lists have a base of 4 core modes.
      // Only upgrade to 6 if TWO OR MORE advanced modes encountered.
      const advancedCount = GRAMMAR_ADV.filter(m=>has(m)).length;
      const totalGuess = advancedCount >= 2 ? 6 : 4;
      expectedSet = [...GRAMMAR_CORE.filter(m=>has(m)), ...GRAMMAR_ADV.filter(m=>has(m))];
      // Ensure expectedSet length does not exceed totalGuess
      if (expectedSet.length > totalGuess) {
        // Keep all core modes; limit advanced ones
        const coreCollected = GRAMMAR_CORE.filter(m => expectedSet.includes(m));
        const advCollected = GRAMMAR_ADV.filter(m => expectedSet.includes(m)).slice(0, Math.max(0, totalGuess - coreCollected.length));
        expectedSet = [...coreCollected, ...advCollected];
      }
      // If fewer than totalGuess collected, pad with missing core placeholders
      GRAMMAR_CORE.forEach(m => { if (expectedSet.length < totalGuess && !expectedSet.includes(m)) expectedSet.push(m); });
    }

    // Allow backend total override if present and seems reasonable.
    // Prefer server-provided js.total_modes when available; fall back to
    // row.modes_total or our expectedSet heuristic only when missing.
    let totalModes = (Number.isFinite(js.total_modes) && js.total_modes > 0) ? Number(js.total_modes) : ((rows[0]?.modes_total) || expectedSet.length);
    // If server didn't provide a value, apply conservative heuristics for category
    if (!Number.isFinite(js.total_modes)) {
      if (category === 'grammar') {
        // Grammar: default to 6 only when advanced modes are present; else 4
        const advancedPresent = GRAMMAR_ADV.filter(m => unionModes.has(m)).length >= 2;
        totalModes = advancedPresent ? 6 : 4;
      } else if (category === 'phonics') {
        totalModes = 4;
      } else if (category === 'vocab') {
        totalModes = 6;
      }
    }

    // Compute per-row derived metrics when missing/wrong
    rows.forEach(r => {
      // compute distinct attempted canonical modes from r.modes
      const attempted = new Set();
      // New: track only passed modes (>=1 star) or lesson modes
      const passedModes = new Set();
      (r.modes || []).forEach(m => {
        const key = normalizeMode(m.mode || m.mode_name || m.name || '');
        if (!key) return;
        // Remove previous unconditional attempted.add(key); we only add when passed.
        const stars = m.bestStars != null ? m.bestStars : m.stars;
        const modeLower = key.toLowerCase();
        const isLesson = /^grammar_lesson/.test(modeLower) || modeLower === 'lesson';
        if (isLesson || Number(stars) >= 1) {
          passedModes.add(key);
        }
      });
      let attemptedCount = passedModes.size;
      if (attemptedCount === 0 && Number.isFinite(r.modes_attempted) && r.modes_attempted > 0) {
        // Fallback ONLY if backend already filtered; but backend now filters too, so keep it guarded.
        attemptedCount = r.modes_attempted;
      }
      // If backend total_modes is missing or clearly wrong (e.g., 6 for phonics), override
  if (!Number.isFinite(js.total_modes)) {
    // Re-apply heuristic if backend total missing
    if (category === 'grammar') {
      const advancedCount = GRAMMAR_ADV.filter(m=>unionModes.has(m)).length;
      totalModes = advancedCount >= 2 ? 6 : 4;
    } else if (category === 'phonics') totalModes = 4;
    else totalModes = 6;
  }
  // For grammar assignments, if backend gives generic 6 but our expectedSet length differs (e.g., 7), use expectedSet length.
      if (category === 'grammar') {
        // Accept backend total if within 4-6; otherwise fallback to expectedSet length (default 4 or 6).
        if (!(Number(totalModes) >= 4 && Number(totalModes) <= 6)) {
          totalModes = expectedSet.length;
        }
      }
  const completionPct = totalModes ? Math.round((attemptedCount / totalModes) * 100) : (r.completion || 0);
      // Attach computed values for rendering and modal use
      r.__computed_modes_attempted = attemptedCount;
      r.__computed_total_modes = totalModes;
      r.__computed_completion = completionPct;
    });

    // Helper to cap accuracy at 100% (backend may store raw values > 100 erroneously)
    const capAcc = v => Math.min(100, Math.max(0, Math.round(Number(v) || 0)));
    if (tbody) tbody.innerHTML = rows.map(r => `<tr data-user-id="${r.user_id}" class="hw-progress-row">
      <td><a href="#" class="hw-student-link" data-user-id="${r.user_id}">${r.name || 'Unknown'}</a></td>
      <td>${r.korean_name || '—'}</td>
      <td>${r.status}<br><small>${r.__computed_completion || 0}% (${r.__computed_modes_attempted||0}/${r.__computed_total_modes||totalModes} modes)</small></td>
      <td class="num">${r.stars || 0}⭐</td>
      <td class="num">${capAcc(r.accuracy_overall != null ? r.accuracy_overall : (r.accuracy_best||0))}%</td>
    </tr>`).join('');
    // Bind modal open for entire row
    tbody.querySelectorAll('.hw-progress-row').forEach(tr => {
      tr.addEventListener('click', (e) => {
        // Prevent if clicking a link or button inside the row
        if (e.target.tagName === 'A' || e.target.tagName === 'BUTTON') return;
        const uid = tr.getAttribute('data-user-id');
  const row = rows.find(r => String(r.user_id) === String(uid));
  if (row) showHomeworkStudentModal(row, row.__computed_total_modes || js.total_modes || 6, assignmentId);
      });
    });
  } catch (e) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="empty" style="color:#dc2626;">Error: ${e.message}</td></tr>`;
  }
}

function showHomeworkStudentModal(row, totalModes, assignmentId) {
  const modal = document.getElementById('hwStudentModal');
  if (!modal) return;
  const title = document.getElementById('hwStudentTitle');
  const meta = document.getElementById('hwStudentMeta');
  const modesWrap = document.getElementById('hwStudentModes');
  if (title) title.textContent = `${row.name || 'Student'} • Homework Details`;
  // Prefer computed values when available (fallbacks injected earlier)
  const displayCompletion = (row.__computed_completion != null) ? row.__computed_completion : (row.completion || 0);
  const displayModesAttempted = (row.__computed_modes_attempted != null) ? row.__computed_modes_attempted : ((row.modes || []).length || 0);
  let displayTotalModes = totalModes || (row.__computed_total_modes || (row.modes_total || null));
  // Normalize totals conservatively: prefer server/computed values; only adjust if missing or clearly invalid.
  const catGuess = (assignmentId && (String(assignmentId).toLowerCase().includes('phonics'))) ? 'phonics' : (displayTotalModes === 4 ? 'phonics' : (displayTotalModes && displayTotalModes <= 4 ? 'phonics' : 'grammar'));
  if (!Number.isFinite(displayTotalModes) || displayTotalModes <= 0) {
    // Fallback defaults
    displayTotalModes = (catGuess === 'phonics') ? 4 : 6;
  } else {
    // If provided value is outside expected bounds, clamp to reasonable set
    if (catGuess === 'phonics' && displayTotalModes > 4) displayTotalModes = 4;
    if (catGuess === 'grammar' && (displayTotalModes < 4 || displayTotalModes > 6)) displayTotalModes = 6;
  }
  // Was the total derived by client-side heuristic?
  const totalWasComputed = (row.modes_total == null) || (Number(row.modes_total) !== Number(displayTotalModes));
  // Cap accuracy at 100% to handle erroneous backend values
  const capAcc = v => Math.min(100, Math.max(0, Math.round(Number(v) || 0)));
  const overallAcc = capAcc(row.accuracy_overall != null ? row.accuracy_overall : (row.accuracy_best||0));
  const bestAcc = capAcc(row.accuracy_best||0);
  if (meta) meta.textContent = `Completion: ${displayCompletion}% • Stars: ${row.stars || 0} • Overall Accuracy: ${overallAcc}% (Best: ${bestAcc}%) • Modes attempted: ${displayModesAttempted}/${displayTotalModes}${totalWasComputed ? ' (computed)' : ''}`;
  if (modesWrap) {
    modesWrap.innerHTML = (row.modes||[]).map(m => {
      const acc = capAcc(m.bestAccuracy || m.accuracy_best || m.accuracy || 0);
      const stars = Math.min(5, Math.max(0, m.bestStars || m.stars || 0));
      // Attempts: prefer count, then attempts, then sessions
      const attempts = m.count || m.attempts || m.sessions || 0;
      return `<div style="border:1px solid #e2e8f0;border-radius:12px;padding:8px 10px;background:#fbfbfb;box-shadow:0 2px 4px rgba(0,0,0,.05);">
        <div style="font-weight:600;font-size:.9rem;color:#19777e;">${friendlyModeName(m.mode)}</div>
        <div style="font-size:.75rem;color:#555;margin-top:4px;">Attempts: ${attempts}</div>
        <div style="font-size:.75rem;color:#555;">Best Stars: ${stars}</div>
        <div style="font-size:.75rem;color:#555;">Best Accuracy: ${acc}%</div>
      </div>`;
    }).join('') || '<div style="padding:12px;color:#666;">No modes attempted yet.</div>';
  }
  modal.style.display = 'flex';
  const closeBtn = document.getElementById('hwStudentClose');
  if (closeBtn && !closeBtn.dataset.bound) {
    closeBtn.dataset.bound = '1';
    closeBtn.addEventListener('click', () => { modal.style.display = 'none'; });
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });
  }
}

// Initialize UI on document ready
document.addEventListener('DOMContentLoaded', () => {
  registerTeacherServiceWorker();
  // Load classes asynchronously without blocking UI
  loadClasses().catch(e => console.error('loadClasses error:', e));
  loadClassTrackerClasses().catch(e => console.error('loadClassTrackerClasses error:', e));
  classSel.addEventListener('change', () => { selectedStudent = null; renderStudentEmpty(); loadLeaderboard(); });
  timeSel.addEventListener('change', () => { if (classSel.value) { loadLeaderboard(); if (selectedStudent) loadStudent(selectedStudent); } });
  refreshBtn.addEventListener('click', () => { loadLeaderboard(); if (selectedStudent) loadStudent(selectedStudent); });
  searchBox.addEventListener('input', () => renderLeaderboard(rawLeaderboard));
  
  // Navigation tab switching
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      const tabName = tab.dataset.tab;
      
      // Update active tab
      document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Update active content
      document.querySelectorAll('[id$="-content"]').forEach(content => {
        content.classList.remove('active');
      });
      const content = document.getElementById(tabName + '-content');
      if (content) content.classList.add('active');
      
      if (tabName === 'homework') {
        initHomeworkShell();
      }
    });
  });
  
  // Sortable column headers
  document.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const newColumn = th.dataset.sort;
      if (sortColumn === newColumn) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        sortColumn = newColumn;
        sortDirection = 'asc';
      }
      
      // Update sort indicators
      document.querySelectorAll('th.sortable').forEach(h => {
        h.classList.remove('sort-asc', 'sort-desc');
      });
      th.classList.add(sortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
      
      renderLeaderboard(rawLeaderboard);
    });
  });
  
  // Tab switching
  $$('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  // delegate click on student name
  $('#lbTable').addEventListener('click', (e) => {
    const a = e.target.closest('a[data-action="student"]'); if (!a) return;
    const uid = a.dataset.uid; selectedStudent = uid; loadStudent(uid);
  });
});
