// Korean/English toggle logic
let currentLang = 'en';
const langToggleBtn = document.getElementById('langToggleBtn');
const langMap = {
  en: {
    toolNames: {
      edit: 'Edit',
      approve: 'Approve',
      unapprove: 'Unapprove',
      reset: 'Reset PW',
      delete: 'Delete',
      changeClass: 'Change Class'
    },
    addStudent: 'Add Student',
    addFullClass: 'Add Full Class',
    moveClassUp: 'Move Class Up',
    koreanEnglish: '한국어 | English',
    username: 'Username',
    password: 'Password',
    name: 'Name (optional)',
    koreanName: 'Korean Name',
    class: 'Class (optional)',
    approved: 'Approved',
    createBtn: 'Add Student',
    bulkClass: 'Class Name',
    bulkList: 'Paste Table (copy from Sheets)',
    bulkSubmit: 'Add Students',
    editStudent: 'Edit Student',
    editName: "Name",
    editUsername: "Username",
    editKoreanName: "Korean Name",
    editClass: "Class",
    editGrade: "Grade",
    editSubmit: "Update",
    moveClassModal: "Move Class Up",
    selectCurrentClass: "Select Current Class",
    newClassName: "New Class Name",
    moveBtn: "Move",
    cancel: "Cancel",
    search: "Search by username or name",
    refresh: "Refresh",
    classLabel: "Class:",
  tableHeaders: ["Username", "Name", "Korean Name", "Class", "Grade", "School", "Phone", "Approved", "Tools"],
    addAll: 'Add All',
    addAllTitle: 'Add All Students',
    addAllPaste: 'Paste roster text',
    addAllPreview: 'Preview Count',
    addAllUpload: 'Upload'
    ,
    school: 'School',
    phone: 'Phone',
    grade: 'Grade'
  },
  ko: {
    toolNames: {
      edit: '수정',
      approve: '승인',
      unapprove: '승인 취소',
      reset: '비번 초기화',
      delete: '삭제',
      changeClass: '반 변경'
    },
    addStudent: '학생 추가',
    addFullClass: '전체 반 추가',
    moveClassUp: '반 이동',
    koreanEnglish: 'English | 한국어',
    username: '아이디',
    password: '비밀번호',
    name: '이름 (선택)',
    koreanName: '한국 이름',
    class: '반 (선택)',
    approved: '승인됨',
    createBtn: '학생 추가',
    bulkClass: '반 이름',
    bulkList: '표 붙여넣기 (시트에서 복사)',
    bulkSubmit: '학생 추가',
    editStudent: '학생 정보 수정',
    editName: "이름",
    editUsername: "아이디",
    editKoreanName: "한국 이름",
    editClass: "반",
    editGrade: "학년",
    editSubmit: "수정",
    moveClassModal: "반 이동",
    selectCurrentClass: "현재 반 선택",
    newClassName: "새 반 이름",
    moveBtn: "이동",
    cancel: "취소",
    search: "아이디 또는 이름으로 검색",
    refresh: "새로고침",
    classLabel: "반:",
  tableHeaders: ["아이디", "이름", "한국 이름", "반", "학년", "학교", "전화번호", "승인됨", "도구"],
    addAll: '전체 추가',
    addAllTitle: '전체 학생 추가',
    addAllPaste: '명단 텍스트 붙여넣기',
    addAllPreview: '미리보기',
    addAllUpload: '업로드'
    ,
    school: '학교',
    phone: '전화번호',
    grade: '학년'
  }
};

function setLanguage(lang) {
  currentLang = lang;
  // Add Student sidebar
  const createBtn = document.getElementById('createBtn'); if (createBtn) createBtn.textContent = langMap[lang].createBtn;
  const l1 = document.querySelector('label[for="newUsername"]'); if (l1) l1.textContent = langMap[lang].username;
  const l2 = document.querySelector('label[for="newPassword"]'); if (l2) l2.textContent = langMap[lang].password;
  const l3 = document.querySelector('label[for="newName"]'); if (l3) l3.textContent = langMap[lang].name;
  const l4 = document.querySelector('label[for="newKoreanName"]'); if (l4) l4.textContent = langMap[lang].koreanName;
  const l5 = document.querySelector('label[for="newClass"]'); if (l5) l5.textContent = langMap[lang].class;
  const l6 = document.querySelector('label[for="newApproved"]'); if (l6) l6.textContent = langMap[lang].approved;
  const sl = document.querySelector('label[for="singleSchool"]'); if (sl) sl.textContent = langMap[lang].school;
  const pl = document.querySelector('label[for="singlePhone"]'); if (pl) pl.textContent = langMap[lang].phone;
  const sgl = document.querySelector('label[for="singleGrade"]'); if (sgl) sgl.textContent = langMap[lang].grade;
  document.getElementById('search').placeholder = langMap[lang].search;
  document.getElementById('refreshBtn').textContent = langMap[lang].refresh;
  document.querySelector('label[for="classFilter"]').textContent = langMap[lang].classLabel;
  // Bulk Insert Modal
  const bh2 = document.querySelector('#bulkModal h2'); if (bh2) bh2.textContent = langMap[lang].addFullClass;
  const bl1 = document.querySelector('label[for="bulkClass"]'); if (bl1) bl1.textContent = langMap[lang].bulkClass;
  const bl2 = document.querySelector('label[for="bulkList"]'); if (bl2) bl2.textContent = langMap[lang].bulkList;
  document.getElementById('bulkSubmit').textContent = langMap[lang].bulkSubmit;
  document.getElementById('bulkCancel').textContent = langMap[lang].cancel;
  // Edit Student Modal
  const eh2 = document.querySelector('#editModal h2'); if (eh2) eh2.textContent = langMap[lang].editStudent;
  const el1 = document.querySelector('label[for="editName"]'); if (el1) el1.textContent = langMap[lang].editName;
  const el2 = document.querySelector('label[for="editUsername"]'); if (el2) el2.textContent = langMap[lang].editUsername;
  const el3 = document.querySelector('label[for="editKoreanName"]'); if (el3) el3.textContent = langMap[lang].editKoreanName;
  const el4 = document.querySelector('label[for="editClass"]'); if (el4) el4.textContent = langMap[lang].editClass;
  const el4g = document.querySelector('label[for="editGrade"]'); if (el4g) el4g.textContent = langMap[lang].editGrade;
  document.getElementById('editSubmit').textContent = langMap[lang].editSubmit;
  document.getElementById('editCancel').textContent = langMap[lang].cancel;
  // Move Class Up Modal
  const rh2 = document.querySelector('#renameClassModal h2'); if (rh2) rh2.textContent = langMap[lang].moveClassModal;
  const rl1 = document.querySelector('label[for="oldClassName"]'); if (rl1) rl1.textContent = langMap[lang].selectCurrentClass;
  const rl2 = document.querySelector('label[for="newClassName"]'); if (rl2) rl2.textContent = langMap[lang].newClassName;
  document.getElementById('renameClassSubmit').textContent = langMap[lang].moveBtn;
  document.getElementById('renameClassCancel').textContent = langMap[lang].cancel;
  // Menubar buttons
  document.getElementById('openBulkModal').textContent = langMap[lang].addFullClass;
  const addAllBtn = document.getElementById('openAddAllModal'); if (addAllBtn) addAllBtn.textContent = langMap[lang].addAll;
  document.getElementById('openRenameClassModal').textContent = langMap[lang].moveClassUp;
  const testBtn = document.getElementById('openTestInput'); if (testBtn) testBtn.textContent = (lang==='ko' ? '시험 입력' : 'Test Input');
  langToggleBtn.textContent = langMap[lang].koreanEnglish;
  // Table headers
  const ths = document.querySelectorAll('.worksheet-preview thead th, .word-list-container thead th, table thead th');
  langMap[lang].tableHeaders.forEach((txt, i) => { if (ths[i]) ths[i].textContent = txt; });
  // Add All Modal labels
  const aaH2 = document.querySelector('#addAllModal h2'); if (aaH2) aaH2.textContent = langMap[lang].addAllTitle;
  const aaLbl = document.querySelector('label[for="addAllText"]'); if (aaLbl) aaLbl.textContent = langMap[lang].addAllPaste;
  const aaPrev = document.getElementById('addAllParse'); if (aaPrev) aaPrev.textContent = langMap[lang].addAllPreview;
  const aaSub = document.getElementById('addAllSubmit'); if (aaSub) aaSub.textContent = langMap[lang].addAllUpload;
}

if (langToggleBtn) {
  langToggleBtn.onclick = async function() {
    setLanguage(currentLang === 'en' ? 'ko' : 'en');
    // Refresh student list to update tool button labels
    try { await refresh(); } catch {}
  };
}

document.addEventListener('DOMContentLoaded', () => {
  setLanguage(currentLang);
});

async function registerTeacherServiceWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('/sw-teacher.js', { scope: '/' });
    console.log('[manage_students] service worker ready', reg.scope);
  } catch (err) {
    console.warn('[manage_students] service worker registration failed', err);
  }
}
const API = '/.netlify/functions/teacher_admin';
let IS_ADMIN = false; // set after role check

async function api(action, opts = {}) {
  const method = opts.method || (opts.body ? 'POST' : 'GET');
  const url = `${API}?action=${encodeURIComponent(action)}`;
  // Use WillenaAPI.fetch for proper routing on CF Pages deployments
  const res = await WillenaAPI.fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    cache: 'no-store'
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

const el = (id) => document.getElementById(id);

// Custom class ordering for dropdowns
const CLASS_ORDER = [
  'brown','stanford','manchester','melbourne','newyork','ny','hawaii','boston','paris','sydney','berkeley',
  'chicago','chicage','london','cambridge','yale','trinity','washington','oxford','princeton','dublin','mit','harvard'
];
const CLASS_DISPLAY = {
  brown:'Brown', stanford:'Stanford', manchester:'Manchester', melbourne:'Melbourne', newyork:'NY', ny:'NY', hawaii:'Hawaii', boston:'Boston', paris:'Paris', sydney:'Sydney', berkeley:'Berkeley',
  chicago:'Chicago', chicage:'Chicago', london:'London', cambridge:'Cambridge', yale:'Yale', trinity:'Trinity', washington:'Washington', oxford:'Oxford', princeton:'Princeton', dublin:'Dublin', mit:'MIT', harvard:'Harvard'
};
function normalizeClassName(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}
const CLASS_ALIASES = {
  newyork: 'NY',
  ny: 'NY'
};
function canonicalizeClassName(name) {
  const norm = normalizeClassName(name);
  if (!norm) return '';
  if (CLASS_ALIASES[norm]) return CLASS_ALIASES[norm];
  if (CLASS_DISPLAY[norm]) return CLASS_DISPLAY[norm];
  return name || '';
}
function sortClassesCustom(arr) {
  const orderIndex = new Map(CLASS_ORDER.map((c, i) => [c, i]));
  return [...arr].sort((a, b) => {
    const na = normalizeClassName(a);
    const nb = normalizeClassName(b);
    const ia = orderIndex.has(na) ? orderIndex.get(na) : Number.POSITIVE_INFINITY;
    const ib = orderIndex.has(nb) ? orderIndex.get(nb) : Number.POSITIVE_INFINITY;
    if (ia !== ib) return ia - ib;
    // fallback alphabetical (case-insensitive)
    return String(a).toLowerCase() < String(b).toLowerCase() ? -1 : (String(a).toLowerCase() > String(b).toLowerCase() ? 1 : 0);
  });
}

function detectClassFromHeader(text) {
  const s = String(text || '').toLowerCase();
  const words = (s.match(/[a-z0-9]+/g) || []).map(w => w.toLowerCase());
  for (let i = words.length - 1; i >= 0; i--) {
    const w = words[i];
    if (CLASS_ORDER.includes(w)) return canonicalizeClassName(w);
    if (CLASS_ALIASES[w]) return canonicalizeClassName(w);
    if (i > 0) {
      const combo = `${words[i - 1]}${w}`;
      if (CLASS_ORDER.includes(combo) || CLASS_ALIASES[combo]) return canonicalizeClassName(combo);
    }
  }
  for (const c of CLASS_ORDER) {
    if (s.includes(c)) return canonicalizeClassName(c);
  }
  return null;
}

function normalizePhone(p) {
  if (!p) return null;
  const digits = String(p).replace(/\D/g, '');
  return digits || null;
}

function rowTpl(s) {
  const lang = currentLang || 'en';
  const tnames = langMap[lang].toolNames;
  const approved = s.approved ? '<span class="pill yes">Yes</span>' : '<span class="pill no">No</span>';
  return `<tr data-id="${s.id}" data-username="${s.username}" data-name="${s.name || ''}" data-korean="${s.korean_name || ''}" data-class="${s.class || ''}" data-grade="${s.grade || ''}" data-approved="${s.approved ? '1' : '0'}">
    <td>${s.username || ''}</td>
    <td>${s.name || ''}</td>
    <td>${s.korean_name || ''}</td>
    <td>${s.class || ''}</td>
    <td>${s.grade || ''}</td>
    <td>${s.school || ''}</td>
    <td>${s.phone || ''}</td>
    <td>${approved}</td>
    <td class="tools">
      <button class="layout-btn" data-act="edit" ${IS_ADMIN ? '' : 'disabled title="Admins only"'}>${tnames.edit}</button>
      <button class="layout-btn" data-act="approve" ${IS_ADMIN ? '' : 'disabled title="Admins only"'}>${s.approved ? tnames.unapprove : tnames.approve}</button>
      <button class="layout-btn" data-act="reset" ${IS_ADMIN ? '' : 'disabled title="Admins only"'}>${tnames.reset}</button>
      <button class="layout-btn" data-act="changeclass" ${IS_ADMIN ? '' : 'disabled title="Admins only"'}>${tnames.changeClass}</button>
      <button class="layout-btn" data-act="delete" ${IS_ADMIN ? '' : 'disabled title="Admins only"'}>${tnames.delete}</button>
    </td>
  </tr>`;
}

// Simple sessionStorage class cache helpers (client-side only)
function cacheKeyForClass(cls) { return `ms:class:${String(cls||'').toLowerCase()}`; }
function cacheSetClassData(cls, students) {
  try {
    const payload = { ts: Date.now(), students };
    sessionStorage.setItem(cacheKeyForClass(cls), JSON.stringify(payload));
  } catch (e) {}
}
function cacheGetClassData(cls, maxAgeMs = 30000) {
  try {
    const raw = sessionStorage.getItem(cacheKeyForClass(cls));
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || !obj.ts) return null;
    if ((Date.now() - obj.ts) > maxAgeMs) { sessionStorage.removeItem(cacheKeyForClass(cls)); return null; }
    return obj.students || null;
  } catch (e) { return null; }
}

// SessionStorage helpers for full-list cache
function cacheKeyAll() { return 'ms:all'; }
function cacheSetAll(students) {
  try { sessionStorage.setItem(cacheKeyAll(), JSON.stringify({ ts: Date.now(), students })); } catch(e) {}
}
function cacheGetAll(maxAgeMs = 60000) {
  try {
    const raw = sessionStorage.getItem(cacheKeyAll()); if (!raw) return null;
    const obj = JSON.parse(raw); if (!obj || !obj.ts) return null;
    if ((Date.now() - obj.ts) > maxAgeMs) { sessionStorage.removeItem(cacheKeyAll()); return null; }
    return obj.students || null;
  } catch(e) { return null; }
}

// In-memory copy for fast filtering during the session
let ALL_STUDENTS = null;
const MAX_ALL_CACHE_SIZE = 3000; // only use full-client cache if dataset isn't enormous

// Prefetch class student lists (background warming). Limits to a few classes to avoid burst.
async function prefetchClassList(cls) {
  if (!cls) return null;
  // if already cached and fresh, skip
  if (cacheGetClassData(cls, 60000)) return null;
  const url = `${API}?action=list_students&class=${encodeURIComponent(cls)}`;
  try {
    const res = await fetch(url, { credentials: 'include', cache: 'no-store' });
    const data = await res.json().catch(()=>({}));
    if (res.ok && data && Array.isArray(data.students)) {
      cacheSetClassData(cls, data.students);
    }
  } catch (e) { /* ignore prefetch failures */ }
}

// Edit Student Modal logic
const editModalBg = document.getElementById('editModalBg');
const editName = document.getElementById('editName');
const editUsername = document.getElementById('editUsername');
const editKoreanName = document.getElementById('editKoreanName');
const editClass = document.getElementById('editClass');
const editGrade = document.getElementById('editGrade');
const editCancel = document.getElementById('editCancel');
const editSubmit = document.getElementById('editSubmit');
const editMsg = document.getElementById('editMsg');
let editingId = null;

function showEditModal(student) {
  editingId = student.id;
  editName.value = student.name || '';
  editUsername.value = student.username || '';
  editKoreanName.value = student.korean_name || '';
  editClass.value = student.class || '';
  if (editGrade) editGrade.value = student.grade || '';
  editMsg.textContent = '';
  editModalBg.style.display = 'flex';
}
function hideEditModal() {
  editModalBg.style.display = 'none';
  editingId = null;
}
if (editCancel) editCancel.onclick = hideEditModal;
if (editModalBg) editModalBg.onclick = (e) => { if (e.target === editModalBg) hideEditModal(); };
if (editSubmit) editSubmit.onclick = async function() {
  editMsg.textContent = '';
  if (!editingId) return;
  const name = editName.value.trim();
  const username = editUsername.value.trim();
  const korean_name = editKoreanName.value.trim();
  const className = editClass.value.trim();
  const grade = editGrade ? editGrade.value.trim() : '';
  if (!username) { editMsg.textContent = 'Username required.'; return; }
  try {
    await api('update_student', { method:'POST', body: { user_id: editingId, name, username, korean_name, class: className, grade: grade || null } });
    hideEditModal();
    await populateClassFilter();
  await refresh(true);
  } catch (e) {
    editMsg.textContent = e.message || 'Update failed.';
  }
};

async function load() {
  const q = el('search').value.trim();
  const data = await api('list_students', { method:'GET', body: null, query: { search: q } });
  // list_students ignores body; use query via URL param instead
}

async function refresh(force = false) {
  const q = el('search').value.trim();
  const classVal = el('classFilter')?.value || '';
  const u = new URL(location.href);
  if (q) u.searchParams.set('q', q); else u.searchParams.delete('q');
  if (classVal) u.searchParams.set('class', classVal); else u.searchParams.delete('class');
  history.replaceState(null, '', u.toString());
  let url = `${API}?action=list_students&search=${encodeURIComponent(q)}`;
  if (classVal) url += `&class=${encodeURIComponent(classVal)}`;
  let data;
  let renderedFromCache = false;

  // When forced (after a mutation), invalidate stale in-memory data so we always hit the server
  if (force) {
    ALL_STUDENTS = null;
    try { sessionStorage.removeItem(cacheKeyAll()); } catch(e) {}
  }

  // If NOT forced, try local cache for instant response
  if (!force) {
    try {
      const cached = classVal ? cacheGetClassData(classVal, 30000) : null;
      if (cached && Array.isArray(cached)) {
        el('rows').innerHTML = cached.map(rowTpl).join('') || '<tr><td colspan="9">No students found</td></tr>';
        renderedFromCache = true;
      }
    } catch (e) { }
    try {
      const cachedAll = ALL_STUDENTS || cacheGetAll();
      if (cachedAll && Array.isArray(cachedAll) && cachedAll.length <= MAX_ALL_CACHE_SIZE) {
        ALL_STUDENTS = cachedAll;
      }
      if (ALL_STUDENTS && Array.isArray(ALL_STUDENTS) && ALL_STUDENTS.length <= MAX_ALL_CACHE_SIZE) {
        const ql = q.toLowerCase();
        let students = ALL_STUDENTS.filter(s => {
          if (classVal && String(s.class || '') !== String(classVal)) return false;
          if (!ql) return true;
          const uname = String(s.username || '').toLowerCase();
          const name = String(s.name || '').toLowerCase();
          return uname.includes(ql) || name.includes(ql);
        });
        try { if (classVal) cacheSetClassData(classVal, students); } catch(e) {}
        el('rows').innerHTML = (students.map(rowTpl).join('')) || '<tr><td colspan="9">No students found</td></tr>';
        return; // local data is fresh enough
      }
    } catch(e) {}
  }

  // Network fetch (always reached when force=true, or when no local cache)
  try {
    const res = await WillenaAPI.fetch(url);
    data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) throw new Error(data.error || `HTTP ${res.status}`);
  } catch (err) {
    // Only overwrite the table if we haven't already rendered from cache
    if (!renderedFromCache) {
      const msg = (err.message || '').toLowerCase().includes('not signed in') || (err.message || '').includes('401')
        ? 'Not signed in. Please log in as a teacher and refresh.'
        : (err.message || 'Failed to load students.');
      const listMsg = el('listMsg'); if (listMsg) listMsg.textContent = msg;
      el('rows').innerHTML = '<tr><td colspan="9">' + msg + '</td></tr>';
    }
    return;
  }
  const listMsg = el('listMsg'); if (listMsg) listMsg.textContent = '';
  let students = data.students || [];
  // Update the full in-memory cache when the fetch was unfiltered
  if (!q && !classVal) {
    ALL_STUDENTS = students;
    try { cacheSetAll(students); } catch(e) {}
  }
  if (classVal) students = students.filter(s => s.class === classVal);
  try { if (classVal) cacheSetClassData(classVal, students); } catch(e) {}
  el('rows').innerHTML = (students.map(rowTpl).join('')) || '<tr><td colspan="9">No students found</td></tr>';
}

async function createStudentLegacy() {
  // Legacy sidebar handler (no longer used). Keeping it to avoid breaking old references.
  const username = el('newUsername')?.value?.trim();
  const password = el('newPassword')?.value;
  const name = el('newName')?.value?.trim();
  const koreanName = el('newKoreanName')?.value?.trim();
  const klass = el('newClass')?.value?.trim();
  const approved = el('newApproved')?.checked;
  const msg = el('createMsg');
  if (!username || !password) { if (msg) msg.textContent = 'Username and password are required.'; return; }
  try {
    await api('create_student', { method:'POST', body:{ username, password, name, korean_name: koreanName, class: klass, approved } });
    if (msg) msg.textContent = 'Created.';
    await refresh(true);
  } catch (e) {
    if (msg) msg.textContent = e.message || 'Failed to create';
  }
}

function attachRowHandlers() {
  el('rows').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const tr = btn.closest('tr');
    const uid = tr?.dataset?.id;
    const username = tr?.dataset?.username;
    const act = btn.dataset.act;
    const needAdmin = ['edit','approve','reset','delete','changeclass'];
    if (needAdmin.includes(act) && !IS_ADMIN) {
      alert('Admins only.');
      return;
    }
    if (act === 'edit') {
      showEditModal({
        id: uid,
        name: tr?.dataset?.name,
        username: tr?.dataset?.username,
        korean_name: tr?.dataset?.korean,
        class: tr?.dataset?.class,
        grade: tr?.dataset?.grade
      });
      return;
    }
    try {
      if (act === 'approve') {
        const currentlyApproved = tr?.dataset?.approved === '1';
        await api('set_approved', { method:'POST', body:{ user_id: uid, approved: !currentlyApproved } });
      } else if (act === 'changeclass') {
        const currentClass = tr?.dataset?.class || '';
        const newClass = prompt(`Enter new class for ${username}`, currentClass) || '';
        if (newClass && newClass !== currentClass) {
          await api('update_student', { method:'POST', body:{ user_id: uid, class: newClass } });
        }
      } else if (act === 'reset') {
        const npw = prompt(`Enter new password for ${username}`);
        if (npw) await api('reset_password', { method:'POST', body:{ user_id: uid, new_password: npw } });
      } else if (act === 'delete') {
        if (confirm(`Delete ${username}? This cannot be undone.`)) await api('delete_student', { method:'POST', body:{ user_id: uid } });
      }
      await refresh(true);
    } catch (err) {
      alert(err.message || 'Action failed');
    }
  });
}

function wire() {
  el('refreshBtn').addEventListener('click', ()=>refresh(true));
  el('search').addEventListener('input', () => { clearTimeout(wire._t); wire._t = setTimeout(refresh, 300); });
  const classFilter = el('classFilter');
  if (classFilter) classFilter.addEventListener('change', refresh);
  const testBtn = document.getElementById('openTestInput');
  if (testBtn) testBtn.addEventListener('click', ()=>{
    const klass = el('classFilter')?.value || '';
    const url = new URL('/Teachers/tools/test_input/index.html', location.origin);
    if (klass) url.searchParams.set('class', klass);
    location.href = url.toString();
  });
  attachRowHandlers();
}

// Bulk Insert Modal logic
// Add All Modal logic
const addAllModalBg = document.getElementById('addAllModalBg');
const openAddAllModal = document.getElementById('openAddAllModal');
const addAllCancel = document.getElementById('addAllCancel');
const addAllSubmit = document.getElementById('addAllSubmit');
const addAllParse = document.getElementById('addAllParse');
const addAllText = document.getElementById('addAllText');
const addAllMsg = document.getElementById('addAllMsg');
const addAllStats = document.getElementById('addAllStats');

function showAddAllModal() {
  if (addAllModalBg) addAllModalBg.style.display = 'flex';
  if (addAllMsg) addAllMsg.textContent = '';
  if (addAllStats) addAllStats.textContent = '';
  if (addAllText) addAllText.value = '';
}
function hideAddAllModal() {
  if (addAllModalBg) addAllModalBg.style.display = 'none';
}
if (openAddAllModal) openAddAllModal.onclick = showAddAllModal;
if (addAllCancel) addAllCancel.onclick = hideAddAllModal;
if (addAllModalBg) addAllModalBg.onclick = (e) => { if (e.target === addAllModalBg) hideAddAllModal(); };

// Parser: extract class headers and student rows
// Contract output: [{ class, school, grade, korean_name, name, phone }]
function parseRoster(text) {
  const lines = String(text || '').split(/\r?\n/);
  let currentClass = null;
  const items = [];

  // Row pattern (forgives spacing):
  // No  School  Grade  KoreanName  English Name  [Phone]
  const rowRe = /^\s*(?<no>\d{1,3})\s+(?<school>[^\s,]+)\s+(?<grade>[^\s,]+)\s+(?<korean>[^\s,]+)\s+(?<eng>[A-Za-z][A-Za-z\s\-']*)(?:\s+(?<phone>[0-9+][0-9\-\s]*))?\s*$/;

  for (const raw of lines) {
    const line = (raw || '').trim();
    if (!line) continue;
    if (/^no\.?/i.test(line)) continue; // header row
    if (/^[-=]{3,}$/.test(line)) continue;

    // Class header detection: any non-numeric line with an ASCII word (e.g., Brown, Stanford, NewYork, Melbourne, Manchester)
    if (!/^\d/.test(line)) {
      const asciiWord = (line.match(/[A-Za-z][A-Za-z0-9_-]*/g) || [])[0];
      if (asciiWord && asciiWord.toLowerCase() !== 'no') {
        const canonical = canonicalizeClassName(asciiWord);
        if (canonical) {
          currentClass = canonical;
          continue;
        }
        currentClass = asciiWord;
        continue;
      }
    }

    const m = rowRe.exec(line);
    if (m && currentClass) {
      const school = (m.groups.school || '').trim() || null;
      const grade = (m.groups.grade || '').trim() || null;
      const korean_name = (m.groups.korean || '').trim();
      const name = (m.groups.eng || '').trim();
      let phone = (m.groups.phone || '').replace(/\s+/g, ' ').trim();
      if (!/\d/.test(phone)) phone = null;
      const classLabel = currentClass ? canonicalizeClassName(currentClass) : currentClass;
      items.push({ class: classLabel, school, grade, korean_name, name, phone });
      continue;
    }
  }
  return items;
}

// Parser tailored for tab-delimited single-class exports (Korean name in column 0, phone in column 1).
function parseSingleClassWithPhone(text) {
  const lines = String(text || '').split(/\r?\n/);
  let className = null;
  const items = [];
  for (const raw of lines) {
    const line = (raw || '').trim();
    if (!line) continue;

    if (!className) {
      const detected = detectClassFromHeader(line);
      if (detected) { className = canonicalizeClassName(detected); continue; }
    }

    if (/^no\.?/i.test(line)) continue;

    const parts = line.split(/\t+/).map(s => s.trim()).filter(Boolean);
    const hangul = /[\uac00-\ud7af]/;
    if (parts.length >= 2 && hangul.test(parts[0]) && /\d/.test(parts[1])) {
      const korean_name = parts[0];
  const phoneDisplay = (parts[1] || '').replace(/\s+/g, ' ').trim();
  const phone = phoneDisplay || normalizePhone(parts[1]) || null;
      let name = '';
      let school = '';
      let grade = '';
      for (let i = 2; i < parts.length; i++) {
        if (/^[A-Za-z][A-Za-z\s\-']+$/.test(parts[i])) {
          name = parts[i];
          if (i + 1 < parts.length) school = (parts[i + 1] || '').trim();
          if (i + 2 < parts.length) grade = (parts[i + 2] || '').trim();
          break;
        }
      }
      let target = null;
      for (let i = parts.length - 1; i >= 0; i--) {
        const detected = detectClassFromHeader(parts[i]);
        if (detected) { target = detected; break; }
        const words = (parts[i] || '').split(/\s+/);
        for (const w of words) {
          const d2 = detectClassFromHeader(w);
          if (d2) { target = d2; break; }
        }
        if (target) break;
      }
      const intendedRaw = target || className || null;
      const intended = intendedRaw ? canonicalizeClassName(intendedRaw) : null;
      items.push({ class: intended, school, grade, korean_name, name, phone });
      continue;
    }

    if (parts.length >= 6 && /^\d{1,3}$/.test(parts[0])) {
  const school = (parts[1] || '').trim();
  const grade = (parts[2] || '').trim();
  const korean_name = (parts[3] || '').trim();
  const name = (parts[4] || '').trim();
  const phoneDisplay = (parts[5] || '').replace(/\s+/g, ' ').trim();
  const phone = phoneDisplay || normalizePhone(parts[5]) || null;
      const intended = className ? canonicalizeClassName(className) : className;
      items.push({ class: intended, school, grade, korean_name, name, phone });
      continue;
    }

    const m = /^\s*(?<no>\d{1,3})\s+(?<school>\S+)\s+(?<grade>\S+)\s+(?<korean>.+?)\s+(?<eng>[A-Za-z][A-Za-z\s\-']*)\s+(?<phone>[+\d][\d\-\s]*)\s*$/.exec(line);
    if (m) {
  const phoneDisplay = (m.groups.phone || '').replace(/\s+/g, ' ').trim();
  const phone = phoneDisplay || normalizePhone(m.groups.phone) || null;
      const intended = className ? canonicalizeClassName(className) : className;
  items.push({ class: intended, school: (m.groups.school || '').trim(), grade: (m.groups.grade || '').trim(), korean_name: m.groups.korean.trim(), name: m.groups.eng.trim(), phone });
    }
  }
  return items;
}

function usernameFrom(name, phone) {
  const base = String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  let last4 = '';
  if (phone) {
    const digits = ('' + phone).replace(/\D/g, '');
    last4 = digits.slice(-4);
  }
  return base + last4;
}
function formatPhoneForStorage(phone) {
  const digits = normalizePhone(phone);
  if (!digits) return null;
  if (digits.length === 11) return digits.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
  if (digits.length === 10) {
    if (digits.startsWith('02')) return digits.replace(/(02)(\d{4})(\d{4})/, '$1-$2-$3');
    return digits.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
  }
  if (digits.length === 9 && digits.startsWith('02')) return digits.replace(/(02)(\d{3})(\d{4})/, '$1-$2-$3');
  return digits;
}

if (addAllParse) addAllParse.onclick = function() {
  addAllMsg.textContent = '';
  const items = parseRoster(addAllText.value);
  const count = items.length;
  const byClass = items.reduce((acc, it) => { acc[it.class] = (acc[it.class] || 0) + 1; return acc; }, {});
  const summary = Object.entries(byClass).map(([c,n]) => `${c}: ${n}`).join(' | ');
  addAllStats.textContent = `Parsed ${count} students. ${summary ? 'By class: ' + summary : ''}`;
};

if (addAllSubmit) addAllSubmit.onclick = async function() {
  addAllMsg.textContent = '';
  const items = parseRoster(addAllText.value);
  if (!items.length) { addAllMsg.textContent = 'No students detected.'; return; }
  // Project to payload for backend
  const payload = items.map(it => ({
    class: it.class,
    school: it.school,
    grade: it.grade,
    korean_name: it.korean_name,
    name: it.name,
    phone: it.phone,
    username: usernameFrom(it.name, it.phone),
    password: usernameFrom(it.name, it.phone)
  }));
  addAllSubmit.disabled = true;
  try {
    const res = await fetch(`${API}?action=bulk_upsert_students`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ students: payload })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) throw new Error(data.error || `Upload failed (${res.status})`);
    // Show result summary
    const created = data.created || 0, updated = data.updated || 0, skipped = data.skipped || 0;
    addAllMsg.style.color = '#065f46';
    addAllMsg.textContent = `Done. Created: ${created}, Updated: ${updated}${skipped?`, Skipped: ${skipped}`:''}`;
    // Close after short delay
    setTimeout(() => { hideAddAllModal(); refresh(true); }, 900);
  } catch (e) {
    addAllMsg.style.color = '#a11';
    addAllMsg.textContent = e.message || 'Upload failed.';
  }
  addAllSubmit.disabled = false;
};
// Rename Class Modal logic
const renameClassModalBg = document.getElementById('renameClassModalBg');
const openRenameClassModal = document.getElementById('openRenameClassModal');
const renameClassCancel = document.getElementById('renameClassCancel');
const renameClassSubmit = document.getElementById('renameClassSubmit');
const oldClassName = document.getElementById('oldClassName');
const newClassName = document.getElementById('newClassName');
const renameClassMsg = document.getElementById('renameClassMsg');

async function showRenameClassModal() {
  renameClassModalBg.style.display = 'flex';
  renameClassMsg.textContent = '';
  newClassName.value = '';
  // Populate dropdown with classes
  try {
    const res = await WillenaAPI.fetch('/.netlify/functions/teacher_admin?action=list_students');
    const data = await res.json();
    if (res.ok && data.success && Array.isArray(data.students)) {
      const classes = sortClassesCustom(Array.from(new Set(data.students.map(s => s.class).filter(Boolean))));
      oldClassName.innerHTML = '<option value="">Select class...</option>' + classes.map(c => `<option value="${c}">${c}</option>`).join('');
    }
  } catch {}
}
function hideRenameClassModal() {
  renameClassModalBg.style.display = 'none';
}
if (openRenameClassModal) openRenameClassModal.onclick = showRenameClassModal;
if (renameClassCancel) renameClassCancel.onclick = hideRenameClassModal;
if (renameClassModalBg) renameClassModalBg.onclick = (e) => { if (e.target === renameClassModalBg) hideRenameClassModal(); };

if (renameClassSubmit) renameClassSubmit.onclick = async function() {
  renameClassMsg.textContent = '';
  const oldName = oldClassName.value;
  const newName = newClassName.value.trim();
  if (!oldName || !newName) { renameClassMsg.textContent = 'Both class names required.'; return; }
  renameClassSubmit.disabled = true;
  try {
    await api('rename_class', { method:'POST', body: { old_class: oldName, new_class: newName } });
    hideRenameClassModal();
    await refresh(true);
  } catch (e) {
    renameClassMsg.textContent = e.message || 'Move failed.';
  }
  renameClassSubmit.disabled = false;
};
const bulkModalBg = document.getElementById('bulkModalBg');
const openBulkModal = document.getElementById('openBulkModal');
const bulkCancel = document.getElementById('bulkCancel');
const bulkSubmit = document.getElementById('bulkSubmit');
const bulkList = document.getElementById('bulkList');
const bulkClass = document.getElementById('bulkClass');
const bulkMsg = document.getElementById('bulkMsg');
const bulkStats = document.getElementById('bulkStats');
const bulkPreview = document.getElementById('bulkPreview');

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Parse tab-delimited rows copied from Google Sheets.
// Supports pastes with or without the leading "No." column.
// Expected columns (either):
//  - No. | School | Grade | Name | English Name | Phone
//  - School | Grade | Name | English Name | Phone
function parseBulkSheet(text) {
  const lines = String(text || '').split(/\r?\n/);
  const items = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = String(raw || '').trimEnd();
    if (!line.trim()) continue;
    const cols = line.split(/\t/).map(c => c.trim());

    // Skip header rows (English/Korean)
    const c0 = (cols[0] || '').toLowerCase().replace(/\./g, '');
    const c1 = (cols[1] || '').toLowerCase();
    if (c0 === 'no' || c0 === '#' || c0 === '번호' || c1 === 'school' || c1 === '학교') continue;
    if (c0 === 'school' || c0 === '학교') continue;

    // Detect whether first column is a row number
    const firstIsNo = /^\d{1,4}$/.test(cols[0] || '');
    const offset = firstIsNo ? 1 : 0;

    const school = (cols[offset + 0] || '').trim();
    const grade = (cols[offset + 1] || '').trim();
    const korean_name = (cols[offset + 2] || '').trim();
    const english_name = (cols[offset + 3] || '').trim();
    const phone = (cols[offset + 4] || '').trim();

    // If the row is shorter than expected, try a heuristic fallback:
    // find the phone-like field and an ASCII (english) name field.
    let finalSchool = school;
    let finalGrade = grade;
    let finalKo = korean_name;
    let finalEn = english_name;
    let finalPhone = phone;

    if (!finalPhone || !/\d/.test(finalPhone) || (!finalEn && cols.length >= 3)) {
      // Attempt to locate phone by digits
      const phoneIdx = cols.findIndex(c => /\d{2,}/.test(c));
      if (phoneIdx >= 0) finalPhone = cols[phoneIdx];
      // Attempt to locate English name by ASCII letters
      const enIdx = cols.findIndex(c => /^[A-Za-z][A-Za-z\s\-']*$/.test(c));
      if (enIdx >= 0) finalEn = cols[enIdx];
      // If we found enIdx and phoneIdx, guess korean name is immediately before english
      if (!finalKo && enIdx > 0) finalKo = cols[enIdx - 1] || '';
      // Try to keep school/grade from earliest columns
      if (!finalSchool) finalSchool = cols[0] || '';
      if (!finalGrade && cols.length > 1) finalGrade = cols[1] || '';
    }

    if (!finalSchool && !finalGrade && !finalKo && !finalEn && !finalPhone) continue;
    items.push({ row: i + 1, school: finalSchool, grade: finalGrade, korean_name: finalKo, english_name: finalEn, phone: finalPhone });
  }
  return items;
}

function renderBulkPreview(items) {
  if (!bulkStats || !bulkPreview) return;
  const maxRows = 12;
  const rows = (items || []).slice(0, maxRows);
  bulkStats.textContent = items?.length ? `Detected ${items.length} rows. Showing first ${Math.min(maxRows, items.length)}.` : '';
  if (!rows.length) {
    bulkPreview.style.display = 'none';
    bulkPreview.innerHTML = '';
    return;
  }

  const html = [
    '<table style="width:100%; border-collapse:collapse; font-size:12.5px;">',
    '<thead><tr>',
    '<th style="text-align:left; padding:6px; border-bottom:1px solid #e5e7eb;">School</th>',
    '<th style="text-align:left; padding:6px; border-bottom:1px solid #e5e7eb;">Grade</th>',
    '<th style="text-align:left; padding:6px; border-bottom:1px solid #e5e7eb;">Name</th>',
    '<th style="text-align:left; padding:6px; border-bottom:1px solid #e5e7eb;">English</th>',
    '<th style="text-align:left; padding:6px; border-bottom:1px solid #e5e7eb;">Phone</th>',
    '<th style="text-align:left; padding:6px; border-bottom:1px solid #e5e7eb;">Notes</th>',
    '</tr></thead><tbody>'
  ];
  for (const r of rows) {
    const notes = [];
    if (!r.english_name) notes.push('missing English Name');
    if (!r.phone || !/\d/.test(r.phone)) notes.push('missing Phone');
    html.push('<tr>');
    html.push(`<td style="padding:6px; border-bottom:1px solid #f1f5f9;">${escapeHtml(r.school)}</td>`);
    html.push(`<td style="padding:6px; border-bottom:1px solid #f1f5f9;">${escapeHtml(r.grade)}</td>`);
    html.push(`<td style="padding:6px; border-bottom:1px solid #f1f5f9;">${escapeHtml(r.korean_name)}</td>`);
    html.push(`<td style="padding:6px; border-bottom:1px solid #f1f5f9;">${escapeHtml(r.english_name)}</td>`);
    html.push(`<td style="padding:6px; border-bottom:1px solid #f1f5f9;">${escapeHtml(r.phone)}</td>`);
    html.push(`<td style="padding:6px; border-bottom:1px solid #f1f5f9; color:${notes.length ? '#b45309' : '#64748b'};">${escapeHtml(notes.join(', '))}</td>`);
    html.push('</tr>');
  }
  html.push('</tbody></table>');
  bulkPreview.innerHTML = html.join('');
  bulkPreview.style.display = 'block';
}

function showBulkModal() {
  bulkModalBg.style.display = 'flex';
  bulkMsg.textContent = '';
  if (bulkStats) bulkStats.textContent = '';
  if (bulkPreview) { bulkPreview.style.display = 'none'; bulkPreview.innerHTML = ''; }
  bulkList.value = '';
  bulkClass.value = '';
}
function hideBulkModal() {
  bulkModalBg.style.display = 'none';
}
if (openBulkModal) openBulkModal.onclick = showBulkModal;
if (bulkCancel) bulkCancel.onclick = hideBulkModal;
if (bulkModalBg) bulkModalBg.onclick = (e) => { if (e.target === bulkModalBg) hideBulkModal(); };

// Live preview for paste
if (bulkList) {
  bulkList.addEventListener('input', () => {
    clearTimeout(bulkList._t);
    bulkList._t = setTimeout(() => {
      try {
        const items = parseBulkSheet(bulkList.value);
        renderBulkPreview(items);
      } catch (e) {
        if (bulkStats) bulkStats.textContent = '';
        if (bulkPreview) { bulkPreview.style.display = 'none'; bulkPreview.innerHTML = ''; }
      }
    }, 200);
  });
}

if (bulkSubmit) bulkSubmit.onclick = async function() {
  bulkMsg.textContent = '';
  const classVal = bulkClass.value.trim();
  if (!classVal) { bulkMsg.textContent = 'Class is required.'; return; }

  const items = parseBulkSheet(bulkList.value);
  if (!items.length) { bulkMsg.textContent = 'Paste at least one table row.'; return; }

  // Rebuilt matching policy (non-destructive):
  // - Only update when phone + Korean name matches EXACTLY one existing account
  // - If ambiguous or repeated in current paste, CREATE new account
  // - Shared phone numbers across siblings are expected and supported
  let existing = [];
  try {
    const res = await WillenaAPI.fetch('/.netlify/functions/teacher_admin?action=list_students');
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) throw new Error(data.error || `HTTP ${res.status}`);
    existing = Array.isArray(data.students) ? data.students : [];
  } catch (e) {
    bulkMsg.textContent = e.message || 'Failed to load current students for matching.';
    return;
  }

  const normK = (v) => String(v || '').trim().replace(/\s+/g, '');
  const strictKey = (phoneDigits, koreanName) => {
    if (!phoneDigits || !koreanName) return '';
    return `${phoneDigits}|${normK(koreanName)}`;
  };

  // Existing strict-key map: phone + Korean name -> accounts[]
  const byStrict = new Map();
  const usernamesTaken = new Set();
  for (const s of existing) {
    const uname = String(s.username || '').trim().toLowerCase();
    if (uname) usernamesTaken.add(uname);

    const digits = normalizePhone(s.phone);
    const ko = String(s.korean_name || '').trim();
    const key = strictKey(digits, ko);
    if (!key) continue;
    if (!byStrict.has(key)) byStrict.set(key, []);
    byStrict.get(key).push(s);
  }

  // Count strict keys in pasted rows to avoid updating when duplicated in this batch
  const strictCountInPaste = new Map();
  for (const it of items) {
    const d = normalizePhone(it.phone);
    const k = strictKey(d, it.korean_name);
    if (!k) continue;
    strictCountInPaste.set(k, (strictCountInPaste.get(k) || 0) + 1);
  }

  function uniqueUsername(preferredBase, fallbackDigits, rowIndex) {
    const baseRaw = String(preferredBase || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const base = baseRaw || `student${String(fallbackDigits || '').slice(-4) || String(1000 + rowIndex)}`;
    let cand = base;
    let i = 2;
    while (usernamesTaken.has(cand.toLowerCase())) {
      cand = `${base}${i}`;
      i++;
      if (i > 250) {
        cand = `${base}${Date.now().toString().slice(-5)}`;
        break;
      }
    }
    usernamesTaken.add(cand.toLowerCase());
    return cand;
  }

  let updated = 0;
  let created = 0;
  let skipped = 0;
  let errors = 0;

  bulkSubmit.disabled = true;
  bulkMsg.style.color = '#475569';
  bulkMsg.textContent = `Uploading ${items.length} rows...`;

  for (let idx = 0; idx < items.length; idx++) {
    const it = items[idx];
    try {
      const phoneDigits = normalizePhone(it.phone);
      const formattedPhone = formatPhoneForStorage(it.phone);

      const patchSchool = (it.school || '').trim();
      const patchGrade = (it.grade || '').trim();
      const patchKo = (it.korean_name || '').trim();
      const patchEn = (it.english_name || '').trim();

      if (!patchKo && !patchEn && !phoneDigits) { skipped++; continue; }

      const key = strictKey(phoneDigits, patchKo);
      const matches = key ? (byStrict.get(key) || []) : [];
      const appearsMultipleInPaste = key ? ((strictCountInPaste.get(key) || 0) > 1) : false;
      const canUpdate = !!key && !appearsMultipleInPaste && matches.length === 1;

      if (canUpdate) {
        const found = matches[0];
        const patch = { user_id: found.id, class: classVal };
        if (patchSchool) patch.school = patchSchool;
        if (patchGrade) patch.grade = patchGrade;
        if (patchKo) patch.korean_name = patchKo;
        if (patchEn) patch.name = patchEn;
        if (formattedPhone) patch.phone = formattedPhone;
        await api('update_student', { method:'POST', body: patch });
        updated++;
      } else {
        // Create NEW account (safe path for siblings/shared phones)
        const username = uniqueUsername(usernameFrom(patchEn, formattedPhone || it.phone), phoneDigits, idx + 1);
        const payload = {
          username,
          password: username,
          name: patchEn || patchKo || username,
          korean_name: patchKo || '',
          class: classVal,
          approved: true,
          school: patchSchool || null,
          grade: patchGrade || null,
          phone: formattedPhone || null
        };

        // Retry on username collisions
        let ok = false;
        let attempt = 0;
        while (!ok && attempt < 5) {
          attempt++;
          try {
            await api('create_student', { method:'POST', body: payload });
            ok = true;
          } catch (err) {
            const msg = String(err?.message || '').toLowerCase();
            if (msg.includes('duplicate') || msg.includes('already') || msg.includes('unique')) {
              payload.username = uniqueUsername(`${username}${attempt}`, phoneDigits, idx + 1);
              payload.password = payload.username;
              continue;
            }
            throw err;
          }
        }
        if (!ok) throw new Error('Could not create account (username collision).');
        created++;
      }
    } catch (e) {
      errors++;
    }
  }

  bulkSubmit.disabled = false;
  bulkMsg.style.color = errors ? '#a11' : '#065f46';
  bulkMsg.textContent = `Done. Updated ${updated}, Created ${created}${skipped ? `, Skipped ${skipped}` : ''}${errors ? `, Errors ${errors}` : ''}`;

  try {
    await populateClassFilter();
    await refresh(true);
  } catch {}

  if (!errors) {
    setTimeout(() => { try { hideBulkModal(); } catch {} }, 650);
  }
}

// Populate class filter after auth
async function populateClassFilter() {
  try {
    const res = await WillenaAPI.fetch('/.netlify/functions/teacher_admin?action=list_students');
    const data = await res.json();
    if (res.ok && data.success && Array.isArray(data.students)) {
      const classes = sortClassesCustom(Array.from(new Set(data.students.map(s => s.class).filter(Boolean))));
      const classFilter = el('classFilter');
      if (classFilter) {
        const selected = new URL(location.href).searchParams.get('class') || '';
        classFilter.innerHTML = '<option value="">All Classes</option>' + classes.map(c => `<option value="${c}">${c}</option>`).join('');
        if (selected) classFilter.value = selected;
        // Seed the full-list cache/in-memory copy so client-side filtering can be used
        try { if (Array.isArray(data.students)) { ALL_STUDENTS = data.students; cacheSetAll(data.students); } } catch(e) {}
        // If we have the full list locally, skip per-class prefetches — client-side filtering will be used.
        // Prefetch only when server did not return a full student list.
        if (!Array.isArray(data.students) || data.students.length === 0) {
          (async function(){
            try {
              const toPrefetch = [];
              if (selected) toPrefetch.push(selected);
              for (let i=0;i<classes.length && toPrefetch.length<3;i++) {
                const c = classes[i]; if (!toPrefetch.includes(c)) toPrefetch.push(c);
              }
              for (const p of toPrefetch) await prefetchClassList(p);
            } catch(e){}
          })();
        }
      }
    }
  } catch {}
}

// Single Add Modal wiring
const singleAddModalBg = document.getElementById('singleAddModalBg');
const openSingleAddModal = document.getElementById('openSingleAddModal');
const singleAddCancel = document.getElementById('singleAddCancel');
const singleAddSubmit = document.getElementById('singleAddSubmit');
const singleUsername = document.getElementById('singleUsername');
const singlePassword = document.getElementById('singlePassword');
const singleName = document.getElementById('singleName');
const singleKoreanName = document.getElementById('singleKoreanName');
const singleSchool = document.getElementById('singleSchool');
const singlePhone = document.getElementById('singlePhone');
const singleGrade = document.getElementById('singleGrade');
const singleClass = document.getElementById('singleClass');
const singleApproved = document.getElementById('singleApproved');
const singleAddMsg = document.getElementById('singleAddMsg');

function showSingleAddModal() {
  singleAddMsg.textContent = '';
  singleUsername.value = '';
  singlePassword.value = '';
  singleName.value = '';
  singleKoreanName.value = '';
  if (singleSchool) singleSchool.value = '';
  if (singlePhone) singlePhone.value = '';
  if (singleGrade) singleGrade.value = '';
  singleClass.value = '';
  if (singleAddModalBg) singleAddModalBg.style.display = 'flex';
}
function hideSingleAddModal() {
  if (singleAddModalBg) singleAddModalBg.style.display = 'none';
}
if (openSingleAddModal) openSingleAddModal.onclick = showSingleAddModal;
if (singleAddCancel) singleAddCancel.onclick = hideSingleAddModal;
if (singleAddModalBg) singleAddModalBg.onclick = (e) => { if (e.target === singleAddModalBg) hideSingleAddModal(); };

async function createStudentSingle() {
  const username = singleUsername.value.trim();
  const password = singlePassword.value;
  const name = singleName.value.trim();
  const koreanName = singleKoreanName.value.trim();
  const klass = singleClass.value.trim();
  const grade = singleGrade ? singleGrade.value.trim() : '';
  const school = singleSchool ? singleSchool.value.trim() : '';
  const phoneRaw = singlePhone ? singlePhone.value.trim() : '';
  const phone = formatPhoneForStorage(phoneRaw);
  const approved = singleApproved.checked;
  singleAddMsg.textContent = '';
  if (!username || !password) { singleAddMsg.textContent = 'Username and password are required.'; return; }
  try {
    await api('create_student', { method:'POST', body:{ username, password, name, korean_name: koreanName, class: klass, approved, school: school || null, phone: phone || null, grade: grade || null } });
    hideSingleAddModal();
    await populateClassFilter();
    await refresh(true);
  } catch (e) {
    singleAddMsg.textContent = e.message || 'Failed to create';
  }
}
if (singleAddSubmit) singleAddSubmit.onclick = createStudentSingle;

// Upload Class Rosters modal wiring
const rosterUploadModalBg = document.getElementById('rosterUploadModalBg');
const openRosterUploadModal = document.getElementById('openRosterUploadModal');
const rosterCancel = document.getElementById('rosterCancel');
const rosterUploadText = document.getElementById('rosterUploadText');
const rosterPreviewBtn = document.getElementById('rosterPreviewBtn');
const rosterUploadSubmit = document.getElementById('rosterUploadSubmit');
const rosterPreviewStats = document.getElementById('rosterPreviewStats');
const rosterPreviewDetails = document.getElementById('rosterPreviewDetails');
const rosterUploadMsg = document.getElementById('rosterUploadMsg');
const optUpdatePhoneIfMissing = document.getElementById('optUpdatePhoneIfMissing');
const optOnlyChangeDifferentClass = document.getElementById('optOnlyChangeDifferentClass');

let _rosterPreviewData = null;

function showRosterUploadModal() {
  if (rosterUploadModalBg) rosterUploadModalBg.style.display = 'flex';
  if (rosterUploadMsg) rosterUploadMsg.textContent = '';
  if (rosterPreviewStats) rosterPreviewStats.textContent = '';
  if (rosterPreviewDetails) { rosterPreviewDetails.innerHTML = ''; rosterPreviewDetails.style.display = 'none'; }
  if (rosterUploadSubmit) rosterUploadSubmit.disabled = true;
}
function hideRosterUploadModal() {
  if (rosterUploadModalBg) rosterUploadModalBg.style.display = 'none';
}
if (openRosterUploadModal) openRosterUploadModal.onclick = showRosterUploadModal;
if (rosterCancel) rosterCancel.onclick = hideRosterUploadModal;
if (rosterUploadModalBg) rosterUploadModalBg.onclick = (e) => { if (e.target === rosterUploadModalBg) hideRosterUploadModal(); };

function normKo(s) { return String(s || '').replace(/\s+/g, '').trim(); }
function normEn(s) { return String(s || '').toLowerCase().replace(/[^a-z]/g, ''); }
function last4(p) { return (normalizePhone(p) || '').slice(-4); }

async function previewRosterSingle() {
  if (!rosterPreviewStats || !rosterPreviewDetails) return;
  rosterUploadMsg.textContent = '';
  rosterUploadSubmit.disabled = true;
  const txt = rosterUploadText.value || '';
  const parsed = parseSingleClassWithPhone(txt);
  if (!parsed.length) {
    rosterPreviewStats.textContent = 'No rows detected. Add a class header line or ensure Korean name and phone are in the first two columns.';
    rosterPreviewDetails.style.display = 'none';
    return;
  }

  let data = { students: [] };
  try {
    const res = await WillenaAPI.fetch('/.netlify/functions/teacher_admin?action=list_students');
    data = await res.json();
  } catch {}
  const all = Array.isArray(data.students) ? data.students : [];

  const byKoEn = new Map();
  for (const s of all) {
    const key = `${normKo(s.korean_name)}|${normEn(s.name)}`;
    if (!byKoEn.has(key)) byKoEn.set(key, []);
    byKoEn.get(key).push(s);
  }

  const matches = [];
  const news = [];
  const conflicts = [];
  let sameClass = 0;
  let noClass = 0;

  for (const it of parsed) {
    const key = `${normKo(it.korean_name)}|${normEn(it.name)}`;
    const candidates = byKoEn.get(key) || [];
    let found = null;
    let reason = 'korean+english';

    if (candidates.length === 1) {
      found = candidates[0];
    } else if (candidates.length > 1) {
      const digits = normalizePhone(it.phone) || '';
      if (digits) {
        const exact = candidates.filter(s => (normalizePhone(s.phone) || '') === digits);
        if (exact.length === 1) {
          found = exact[0];
          reason = 'korean+english+phone';
        } else {
          const byLast = candidates.filter(s => last4(s.phone) === digits.slice(-4));
          if (byLast.length === 1) {
            found = byLast[0];
            reason = 'korean+english+last4';
          }
        }
      }
      if (!found) {
        conflicts.push({ parsed: it, candidates });
        continue;
      }
    }

    if (!it.class) {
      noClass++;
      news.push(it);
    } else if (found) {
      const willChangeClass = found.class !== it.class;
      if (!willChangeClass) sameClass++;
      matches.push({ parsed: it, existing: found, reason, willChangeClass });
    } else {
      news.push(it);
    }
  }

  _rosterPreviewData = { parsed, matches, news, conflicts, noClass };

  const msgParts = [`Parsed ${parsed.length}`, `Matched ${matches.length}`, `New ${news.length}`];
  if (sameClass) msgParts.push(`Same-class ${sameClass}`);
  if (conflicts.length) msgParts.push(`Conflicts ${conflicts.length}`);
  if (noClass) msgParts.push(`No-class ${noClass}`);
  rosterPreviewStats.textContent = msgParts.join('. ') + '.';

  const rows = [];
  rows.push('<table style="width:100%; border-collapse:collapse; font-size:13px;">');
  rows.push('<thead><tr><th style="text-align:left; padding:6px; border-bottom:1px solid #e5e7eb;">Korean</th><th style="text-align:left; padding:6px; border-bottom:1px solid #e5e7eb;">English</th><th style="text-align:left; padding:6px; border-bottom:1px solid #e5e7eb;">Phone</th><th style="text-align:left; padding:6px; border-bottom:1px solid #e5e7eb;">Target Class</th><th style="text-align:left; padding:6px; border-bottom:1px solid #e5e7eb;">Status</th><th style="text-align:left; padding:6px; border-bottom:1px solid #e5e7eb;">Current Class</th></tr></thead><tbody>');
  for (const m of matches) {
    rows.push(`<tr><td style="padding:6px;">${m.parsed.korean_name || ''}</td><td style="padding:6px;">${m.parsed.name || ''}</td><td style="padding:6px;">${m.parsed.phone || ''}</td><td style="padding:6px;">${m.parsed.class || ''}</td><td style="padding:6px; color:#065f46;">match (${m.reason})</td><td style="padding:6px;">${m.existing.class || ''}</td></tr>`);
  }
  for (const c of conflicts) {
    const current = c.candidates.map(s => s.class || '(no class)').join(', ');
    rows.push(`<tr><td style="padding:6px;">${c.parsed.korean_name || ''}</td><td style="padding:6px;">${c.parsed.name || ''}</td><td style="padding:6px;">${c.parsed.phone || ''}</td><td style="padding:6px;">${c.parsed.class || ''}</td><td style="padding:6px; color:#b45309;">conflict – multiple matches</td><td style="padding:6px;">${current}</td></tr>`);
  }
  for (const n of news) {
    const badge = n.class ? 'new' : 'no-class';
    const color = n.class ? '#a11' : '#92400e';
    rows.push(`<tr><td style="padding:6px;">${n.korean_name || ''}</td><td style="padding:6px;">${n.name || ''}</td><td style="padding:6px;">${n.phone || ''}</td><td style="padding:6px;">${n.class || ''}</td><td style="padding:6px; color:${color};">${badge}</td><td style="padding:6px;"></td></tr>`);
  }
  rows.push('</tbody></table>');
  rosterPreviewDetails.innerHTML = rows.join('');
  rosterPreviewDetails.style.display = 'block';

  rosterUploadSubmit.disabled = !(parsed.length > 0 && conflicts.length === 0);
  if (conflicts.length) {
    rosterUploadMsg.style.color = '#b45309';
    rosterUploadMsg.textContent = 'Resolve conflicts (add phone numbers or adjust data) before uploading.';
  }
}

async function uploadRosterSingle() {
  rosterUploadMsg.textContent = '';
  rosterUploadSubmit.disabled = true;
  const data = _rosterPreviewData;
  if (!data || (data.matches.length === 0 && data.news.length === 0)) {
    rosterUploadMsg.textContent = 'Nothing to upload.';
    rosterUploadSubmit.disabled = false;
    return;
  }
  if (data.conflicts && data.conflicts.length) {
    rosterUploadMsg.textContent = 'Resolve conflicts before uploading.';
    rosterUploadSubmit.disabled = false;
    return;
  }

  let updated = 0;
  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const m of data.matches) {
    try {
      const patch = { user_id: m.existing.id };
      let hasChange = false;
      if (!optOnlyChangeDifferentClass.checked || m.existing.class !== m.parsed.class) {
        patch.class = m.parsed.class;
        hasChange = true;
      }
      if (m.parsed.grade && !m.existing.grade) {
        patch.grade = m.parsed.grade;
        hasChange = true;
      }
      if (optUpdatePhoneIfMissing.checked && m.parsed.phone) {
        const formattedPhone = formatPhoneForStorage(m.parsed.phone);
        const existingDigits = normalizePhone(m.existing.phone);
        if (formattedPhone && !existingDigits) {
          patch.phone = formattedPhone;
          hasChange = true;
        }
      }
      if (hasChange) {
        await api('update_student', { method:'POST', body: patch });
        updated++;
      } else {
        skipped++;
      }
    } catch (err) {
      errors++;
    }
  }

  for (const n of data.news) {
    if (!n.class) { skipped++; continue; }
    try {
      const username = usernameFrom(n.name, n.phone);
      const phoneForInsert = formatPhoneForStorage(n.phone);
      const payload = {
        username,
        password: username,
        name: n.name,
        korean_name: n.korean_name,
        class: n.class,
        phone: phoneForInsert,
        grade: n.grade || null,
        school: n.school || null,
        approved: true
      };
      await api('create_student', { method:'POST', body: payload });
      created++;
    } catch (err) {
      errors++;
    }
  }

  rosterUploadMsg.style.color = errors ? '#a11' : '#065f46';
  rosterUploadMsg.textContent = `Done. Updated ${updated}, Created ${created}${skipped ? `, Skipped ${skipped}` : ''}${errors ? `, Errors ${errors}` : ''}`;

  try {
    await populateClassFilter();
    await refresh(true);
  } catch {}

  rosterUploadSubmit.disabled = false;
}

if (rosterPreviewBtn) rosterPreviewBtn.onclick = previewRosterSingle;
if (rosterUploadSubmit) rosterUploadSubmit.onclick = uploadRosterSingle;

document.addEventListener('DOMContentLoaded', async () => {
  registerTeacherServiceWorker();
  wire();
  // auth guard: ensure teacher role
  try {
    const who = await WillenaAPI.fetch('/.netlify/functions/supabase_auth?action=whoami').then(r=>r.json());
    if (!who?.success) throw new Error('not signed in');
    const roleRes = await WillenaAPI.fetch(`/.netlify/functions/supabase_auth?action=get_role&user_id=${encodeURIComponent(who.user_id)}`);
    const role = await roleRes.json();
    const r = String(role?.role || '').toLowerCase();
    if (!['teacher','admin'].includes(r)) throw new Error('forbidden');
    IS_ADMIN = (r === 'admin');
  } catch {
    const msg = 'Not signed in. Please log in as a teacher.';
    const listMsg = el('listMsg');
    const redirect = encodeURIComponent(location.pathname + location.search);
    if (listMsg) listMsg.innerHTML = `${msg} <a href="/Teachers/login.html?redirect=${redirect}">Open login</a>`;
    el('rows').innerHTML = '<tr><td colspan="8">' + msg + '</td></tr>';
    // Cookie diagnostics (best effort)
    try {
      const echo = await WillenaAPI.fetch('/.netlify/functions/supabase_auth?action=cookie_echo').then(r=>r.json());
      if (echo && listMsg) {
        const details = ` (host: ${echo.host || 'n/a'}, origin: ${echo.origin || 'n/a'}, hasAccess: ${echo.hasAccess})`;
        listMsg.textContent += details;
      }
    } catch {}
    return;
  }
  await populateClassFilter();
  // initial search from URL
  const u = new URL(location.href);
  const q = u.searchParams.get('q'); if (q) el('search').value = q;
  await refresh();
});
