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
      delete: 'Delete'
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
    bulkClass: 'Class',
    bulkList: 'Paste Korean name and English name (one per line, tab/comma separated)',
    bulkSubmit: 'Add Students',
    editStudent: 'Edit Student',
    editName: "Name",
    editUsername: "Username",
    editKoreanName: "Korean Name",
    editClass: "Class",
    editSubmit: "Update",
    moveClassModal: "Move Class Up",
    selectCurrentClass: "Select Current Class",
    newClassName: "New Class Name",
    moveBtn: "Move",
    cancel: "Cancel",
    search: "Search by username or name",
    refresh: "Refresh",
    classLabel: "Class:",
    tableHeaders: ["Username", "Name", "Korean Name", "Class", "Approved", "Tools"]
  },
  ko: {
    toolNames: {
      edit: '수정',
      approve: '승인',
      unapprove: '승인 취소',
      reset: '비번 초기화',
      delete: '삭제'
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
    bulkClass: '반',
    bulkList: '한국 이름과 영어 이름을 붙여넣기 (한 줄에 하나씩, 탭/쉼표 구분)',
    bulkSubmit: '학생 추가',
    editStudent: '학생 정보 수정',
    editName: "이름",
    editUsername: "아이디",
    editKoreanName: "한국 이름",
    editClass: "반",
    editSubmit: "수정",
    moveClassModal: "반 이동",
    selectCurrentClass: "현재 반 선택",
    newClassName: "새 반 이름",
    moveBtn: "이동",
    cancel: "취소",
    search: "아이디 또는 이름으로 검색",
    refresh: "새로고침",
    classLabel: "반:",
    tableHeaders: ["아이디", "이름", "한국 이름", "반", "승인됨", "도구"]
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
  document.getElementById('openRenameClassModal').textContent = langMap[lang].moveClassUp;
  langToggleBtn.textContent = langMap[lang].koreanEnglish;
  // Table headers
  const ths = document.querySelectorAll('.worksheet-preview thead th, .word-list-container thead th, table thead th');
  langMap[lang].tableHeaders.forEach((txt, i) => { if (ths[i]) ths[i].textContent = txt; });
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
const API = '/.netlify/functions/teacher_admin';

async function api(action, opts = {}) {
  const method = opts.method || (opts.body ? 'POST' : 'GET');
  const url = `${API}?action=${encodeURIComponent(action)}`;
  const res = await fetch(url, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    cache: 'no-store'
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

const el = (id) => document.getElementById(id);

function rowTpl(s) {
  const lang = currentLang || 'en';
  const tnames = langMap[lang].toolNames;
  const approved = s.approved ? '<span class="pill yes">Yes</span>' : '<span class="pill no">No</span>';
  return `<tr data-id="${s.id}" data-username="${s.username}" data-name="${s.name || ''}" data-korean="${s.korean_name || ''}" data-class="${s.class || ''}">
    <td>${s.username || ''}</td>
    <td>${s.name || ''}</td>
    <td>${s.korean_name || ''}</td>
    <td>${s.class || ''}</td>
    <td>${approved}</td>
    <td class="tools">
      <button class="layout-btn" data-act="edit">${tnames.edit}</button>
      <button class="layout-btn" data-act="approve">${s.approved ? tnames.unapprove : tnames.approve}</button>
      <button class="layout-btn" data-act="reset">${tnames.reset}</button>
      <button class="layout-btn" data-act="delete">${tnames.delete}</button>
    </td>
  </tr>`;
}

// Edit Student Modal logic
const editModalBg = document.getElementById('editModalBg');
const editName = document.getElementById('editName');
const editUsername = document.getElementById('editUsername');
const editKoreanName = document.getElementById('editKoreanName');
const editClass = document.getElementById('editClass');
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
  if (!username) { editMsg.textContent = 'Username required.'; return; }
  try {
    await api('update_student', { method:'POST', body: { user_id: editingId, name, username, korean_name, class: className } });
    hideEditModal();
  await populateClassFilter();
  await refresh();
  } catch (e) {
    editMsg.textContent = e.message || 'Update failed.';
  }
};

async function load() {
  const q = el('search').value.trim();
  const data = await api('list_students', { method:'GET', body: null, query: { search: q } });
  // list_students ignores body; use query via URL param instead
}

async function refresh() {
  const q = el('search').value.trim();
  const classVal = el('classFilter')?.value || '';
  const u = new URL(location.href);
  if (q) u.searchParams.set('q', q); else u.searchParams.delete('q');
  if (classVal) u.searchParams.set('class', classVal); else u.searchParams.delete('class');
  history.replaceState(null, '', u.toString());
  let url = `${API}?action=list_students&search=${encodeURIComponent(q)}`;
  if (classVal) url += `&class=${encodeURIComponent(classVal)}`;
  let data;
  try {
    const res = await fetch(url, { credentials:'include', cache:'no-store' });
    data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) throw new Error(data.error || `HTTP ${res.status}`);
  } catch (err) {
    const msg = (err.message || '').toLowerCase().includes('not signed in') || (err.message || '').includes('401')
      ? 'Not signed in. Please log in as a teacher and refresh.'
      : (err.message || 'Failed to load students.');
    const listMsg = el('listMsg'); if (listMsg) listMsg.textContent = msg;
    el('rows').innerHTML = '<tr><td colspan="6">' + msg + '</td></tr>';
    return;
  }
  const listMsg = el('listMsg'); if (listMsg) listMsg.textContent = '';
  let students = data.students || [];
  if (classVal) students = students.filter(s => s.class === classVal);
  const rows = students.map(rowTpl).join('');
  el('rows').innerHTML = rows || '<tr><td colspan="6">No students found</td></tr>';
}

async function createStudent() {
  const username = el('newUsername').value.trim();
  const password = el('newPassword').value;
  const name = el('newName').value.trim();
  const koreanName = el('newKoreanName').value.trim();
  const klass = el('newClass').value.trim();
  const approved = el('newApproved').checked;
  el('createMsg').textContent = '';
  if (!username || !password) { el('createMsg').textContent = 'Username and password are required.'; return; }
  try {
    await api('create_student', { method:'POST', body:{ username, password, name, korean_name: koreanName, class: klass, approved } });
    el('createMsg').textContent = 'Created.';
    el('newUsername').value = ''; el('newPassword').value=''; el('newName').value=''; el('newKoreanName').value=''; el('newClass').value=''; el('newApproved').checked=true;
    await refresh();
  } catch (e) {
    el('createMsg').textContent = e.message || 'Failed to create';
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
    if (act === 'edit') {
      showEditModal({
        id: uid,
        name: tr?.dataset?.name,
        username: tr?.dataset?.username,
  korean_name: tr?.dataset?.korean,
  class: tr?.dataset?.class
      });
      return;
    }
    try {
      if (act === 'approve') {
        const currentlyApproved = btn.textContent.includes('Unapprove');
        await api('set_approved', { method:'POST', body:{ user_id: uid, approved: !currentlyApproved } });
      } else if (act === 'reset') {
        const npw = prompt(`Enter new password for ${username}`);
        if (npw) await api('reset_password', { method:'POST', body:{ user_id: uid, new_password: npw } });
      } else if (act === 'delete') {
        if (confirm(`Delete ${username}? This cannot be undone.`)) await api('delete_student', { method:'POST', body:{ user_id: uid } });
      }
      await refresh();
    } catch (err) {
      alert(err.message || 'Action failed');
    }
  });
}

function wire() {
  el('createBtn').addEventListener('click', createStudent);
  el('refreshBtn').addEventListener('click', refresh);
  el('search').addEventListener('input', () => { clearTimeout(wire._t); wire._t = setTimeout(refresh, 300); });
  const classFilter = el('classFilter');
  if (classFilter) classFilter.addEventListener('change', refresh);
  attachRowHandlers();
}

// Bulk Insert Modal logic
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
    const res = await fetch('/.netlify/functions/teacher_admin?action=list_students', { credentials:'include', cache:'no-store' });
    const data = await res.json();
    if (res.ok && data.success && Array.isArray(data.students)) {
      const classes = Array.from(new Set(data.students.map(s => s.class).filter(Boolean))).sort();
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
    await refresh();
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

function showBulkModal() {
  bulkModalBg.style.display = 'flex';
  bulkMsg.textContent = '';
  bulkList.value = '';
  bulkClass.value = '';
}
function hideBulkModal() {
  bulkModalBg.style.display = 'none';
}
if (openBulkModal) openBulkModal.onclick = showBulkModal;
if (bulkCancel) bulkCancel.onclick = hideBulkModal;
if (bulkModalBg) bulkModalBg.onclick = (e) => { if (e.target === bulkModalBg) hideBulkModal(); };

if (bulkSubmit) bulkSubmit.onclick = async function() {
  bulkMsg.textContent = '';
  const classVal = bulkClass.value.trim();
  const lines = bulkList.value.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!classVal) { bulkMsg.textContent = 'Class is required.'; return; }
  if (!lines.length) { bulkMsg.textContent = 'Paste at least one name.'; return; }
  // Parse lines: "Korean name, English name" or "Korean name\tEnglish name"
  const students = lines.map(line => {
    let [korean, name] = line.split(/[,\t]/).map(s => s.trim());
    if (!name) return null;
    // Username: lowercased, no spaces, only letters/numbers from English name
    const username = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    // Password: same as username (can be changed later)
    return { username, password: username, name, korean_name: korean || '', class: classVal, approved: true };
  }).filter(Boolean);
  if (!students.length) { bulkMsg.textContent = 'No valid names found.'; return; }
  bulkSubmit.disabled = true;
  let errors = 0;
  for (const s of students) {
    try {
      await api('create_student', { method:'POST', body: s });
    } catch (e) {
      errors++;
    }
  }
  bulkSubmit.disabled = false;
  if (errors) bulkMsg.textContent = `${errors} failed (likely duplicate usernames)`;
  else hideBulkModal();
  await refresh();
}

// Populate class filter after auth
async function populateClassFilter() {
  try {
    const res = await fetch('/.netlify/functions/teacher_admin?action=list_students', { credentials:'include', cache:'no-store' });
    const data = await res.json();
    if (res.ok && data.success && Array.isArray(data.students)) {
      const classes = Array.from(new Set(data.students.map(s => s.class).filter(Boolean))).sort();
      const classFilter = el('classFilter');
      if (classFilter) {
        const selected = new URL(location.href).searchParams.get('class') || '';
        classFilter.innerHTML = '<option value="">All Classes</option>' + classes.map(c => `<option value="${c}">${c}</option>`).join('');
        if (selected) classFilter.value = selected;
      }
    }
  } catch {}
}

document.addEventListener('DOMContentLoaded', async () => {
  wire();
  // auth guard: ensure teacher role
  try {
    const who = await fetch('/.netlify/functions/supabase_auth?action=whoami', { credentials:'include', cache:'no-store' }).then(r=>r.json());
    if (!who?.success) throw new Error('not signed in');
    const roleRes = await fetch(`/.netlify/functions/supabase_auth?action=get_role&user_id=${encodeURIComponent(who.user_id)}`, { credentials:'include', cache:'no-store' });
    const role = await roleRes.json();
    if (!role?.role || !['teacher','admin'].includes(String(role.role).toLowerCase())) throw new Error('forbidden');
  } catch {
    const msg = 'Not signed in. Please log in as a teacher.';
    const listMsg = el('listMsg'); if (listMsg) listMsg.innerHTML = `${msg} <a href="/Teachers/login.html?next=${encodeURIComponent(location.pathname)}">Open login</a>`;
    el('rows').innerHTML = '<tr><td colspan="6">' + msg + '</td></tr>';
    // Cookie diagnostics (best effort)
    try {
      const echo = await fetch('/.netlify/functions/supabase_auth?action=cookie_echo', { credentials:'include', cache:'no-store' }).then(r=>r.json());
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
