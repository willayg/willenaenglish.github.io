import './manage_students-original.js?v=20260901a';

const approvalUi = {
  activeId: null,
  approved: false,
  button: null,
  status: null
};

function syncApprovalUi() {
  const { button, status, approved } = approvalUi;
  if (!button || !status) return;
  button.textContent = approved ? 'Unapprove student' : 'Approve student';
  button.style.color = approved ? '#a11' : '#0f5a68';
  status.textContent = approved
    ? 'Approved — student can use the student apps.'
    : 'Not approved — student is hidden from approved-student views.';
}

function installApprovalControl() {
  const modal = document.getElementById('editModal');
  const editCancel = document.getElementById('editCancel');
  if (!modal || !editCancel || document.getElementById('editApprovalToggle')) return;

  const box = document.createElement('div');
  box.id = 'editApprovalBox';
  box.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:14px;padding:12px 14px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;';
  box.innerHTML = '<div><strong style="display:block;color:#1f2937;">Account approval</strong><span id="editApprovalStatus" style="font-size:12px;color:#64748b;">Select a student</span></div><button id="editApprovalToggle" class="layout-btn" type="button">Approve student</button>';

  const actions = editCancel.parentElement;
  modal.insertBefore(box, actions);
  approvalUi.button = document.getElementById('editApprovalToggle');
  approvalUi.status = document.getElementById('editApprovalStatus');
  syncApprovalUi();

  approvalUi.button.addEventListener('click', async () => {
    if (!approvalUi.activeId || !window.WillenaAPI) return;
    const next = !approvalUi.approved;
    const button = approvalUi.button;
    const status = approvalUi.status;
    button.disabled = true;
    button.textContent = 'Saving…';
    try {
      const res = await WillenaAPI.fetch('/.netlify/functions/teacher_admin?action=set_approved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: approvalUi.activeId, approved: next }),
        cache: 'no-store'
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) throw new Error(data.error || `Request failed: ${res.status}`);
      approvalUi.approved = next;
      syncApprovalUi();
      document.getElementById('refreshBtn')?.click();
    } catch (err) {
      status.textContent = err?.message || 'Could not update approval.';
    } finally {
      button.disabled = false;
      if (status.textContent && !status.textContent.startsWith('Could not') && !status.textContent.startsWith('Request failed')) syncApprovalUi();
    }
  });
}

document.addEventListener('click', (event) => {
  const editButton = event.target.closest('button[data-act="edit"]');
  if (!editButton) return;
  const row = editButton.closest('tr[data-id]');
  if (!row) return;
  approvalUi.activeId = row.dataset.id || null;
  approvalUi.approved = row.dataset.approved === '1';
  syncApprovalUi();
}, true);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', installApprovalControl, { once: true });
} else {
  installApprovalControl();
}
