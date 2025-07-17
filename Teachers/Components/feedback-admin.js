// Feedback Admin Tool Logic

const STATUS_OPTIONS = [
  'new', 'urgent', 'fixed', 'unfixed', 'ignore'
];

async function fetchFeedback() {
  const resp = await fetch('/.netlify/functions/supabase_proxy_fixed?feedback_list', { method: 'GET' });
  const data = await resp.json();
  if (!Array.isArray(data)) return [];
  return data;
}

async function updateStatus(id, newStatus) {
  const resp = await fetch('/.netlify/functions/supabase_proxy_fixed?feedback_update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, status: newStatus })
  });
  return await resp.json();
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString();
}

function renderToolState(toolState) {
  if (!toolState) return '';
  let json = '';
  try { json = JSON.stringify(toolState, null, 2); } catch {}
  return `<span class="json-toggle" onclick="this.nextElementSibling.classList.toggle('json-collapsed')">[show]</span><pre class="tool-state-details json-collapsed">${json}</pre>`;
}

function renderStatusDropdown(id, currentStatus) {
  return `<select class="status-dropdown" data-id="${id}">
    ${STATUS_OPTIONS.map(opt => `<option value="${opt}"${opt===currentStatus?' selected':''}>${opt.charAt(0).toUpperCase()+opt.slice(1)}</option>`).join('')}
  </select>`;
}

function renderTable(feedbacks, statusFilter, moduleFilter, searchValue) {
  const tbody = document.getElementById('feedbackTableBody');
  let filtered = feedbacks;
  // Filter by status
  if (statusFilter && statusFilter !== 'all') {
    if (statusFilter === 'open') {
      filtered = filtered.filter(f => {
        const s = String(f.status).toLowerCase();
        return s === 'new' || s === 'urgent';
      });
    } else {
      filtered = filtered.filter(f => String(f.status).toLowerCase() === statusFilter);
    }
  }
  // Filter by module
  if (moduleFilter && moduleFilter !== 'all') {
    filtered = filtered.filter(f => (f.module||'') === moduleFilter);
  }
  // Filter by search
  if (searchValue) {
    const val = searchValue.trim().toLowerCase();
    filtered = filtered.filter(f =>
      (f.feedback||'').toLowerCase().includes(val) ||
      (f.module||'').toLowerCase().includes(val) ||
      (f.user_id||'').toLowerCase().includes(val) ||
      (f.page_url||'').toLowerCase().includes(val)
    );
  }
  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#888;">No feedback found.</td></tr>';
    return;
  }
  tbody.innerHTML = filtered.map(f => `
    <tr class="feedback-row">
      <td>${formatDate(f.created_at)}</td>
      <td>${(f.feedback||'').replace(/</g,'&lt;')}</td>
      <td>${f.module||''}</td>
      <td>${renderToolState(f.tool_state)}</td>
      <td>${f.username||''}</td>
      <td>${f.page_url||''}</td>
      <td>${renderStatusDropdown(f.id, f.status || 'new')}</td>
    </tr>
  `).join('');
}

async function loadAndRender() {
  document.getElementById('feedbackTableBody').innerHTML = '<tr><td colspan="8" style="text-align:center; color:#888;">Loading...</td></tr>';
  let feedbacks = await fetchFeedback();
  window._allFeedbacks = feedbacks;
  populateModuleFilter(feedbacks);
  renderTable(feedbacks, getStatusFilter(), getModuleFilter(), getSearchValue());
}

function getStatusFilter() {
  return document.getElementById('statusFilter').value;
}
function getModuleFilter() {
  return document.getElementById('moduleFilter').value;
}
function getSearchValue() {
  return document.getElementById('searchInput').value || '';
}
function populateModuleFilter(feedbacks) {
  const select = document.getElementById('moduleFilter');
  // Always include these static modules
  const staticModules = ['grammar', 'survey_builder'];
  const dynamicModules = Array.from(new Set(feedbacks.map(f => f.module||'').filter(Boolean)));
  // Merge and deduplicate
  const modules = Array.from(new Set([...staticModules, ...dynamicModules]));
  select.innerHTML = '<option value="all">All Modules</option>' + modules.map(m => `<option value="${m}">${m}</option>`).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  loadAndRender();
  document.getElementById('refreshBtn').onclick = loadAndRender;

  function updateTable() {
    renderTable(window._allFeedbacks || [], getStatusFilter(), getModuleFilter(), getSearchValue());
  }

  document.getElementById('searchInput').oninput = updateTable;
  document.getElementById('statusFilter').onchange = updateTable;
  document.getElementById('moduleFilter').onchange = updateTable;

  document.getElementById('feedbackTableBody').addEventListener('change', async function(e) {
    if (e.target.classList.contains('status-dropdown')) {
      const id = e.target.getAttribute('data-id');
      const newStatus = e.target.value;
      await updateStatus(id, newStatus);
      // Update local data and re-render, don't reload all
      if (window._allFeedbacks) {
        const idx = window._allFeedbacks.findIndex(f => String(f.id) === String(id));
        if (idx !== -1) window._allFeedbacks[idx].status = newStatus;
      }
      updateTable();
    }
  });
});
