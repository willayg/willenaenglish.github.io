(function () {
  function getApiUrl(path) {
    if (window.WillenaAPI && typeof window.WillenaAPI.getApiUrl === 'function') {
      return window.WillenaAPI.getApiUrl(path);
    }
    return path;
  }

  function toIsoDueAt(dueDate) {
    const due = String(dueDate || '').trim();
    if (!due) return null;
    const iso = new Date(due + 'T23:59:59').toISOString();
    if (Number.isNaN(new Date(iso).getTime())) return null;
    return iso;
  }

  function normalizeMeta(listMeta) {
    return listMeta && typeof listMeta === 'object' ? { ...listMeta } : {};
  }

  function buildAssignmentPayload({
    className,
    title,
    description,
    listKey,
    listTitle,
    listMeta,
    dueDate,
    startAt,
    goalType,
    goalValue,
  }) {
    const payload = {
      class: String(className || '').trim(),
      title: String(title || '').trim(),
      description: String(description || '').trim(),
      list_key: String(listKey || '').trim(),
      list_title: String(listTitle || '').trim() || null,
      list_meta: normalizeMeta(listMeta),
      start_at: startAt || new Date().toISOString(),
      due_at: toIsoDueAt(dueDate),
      goal_type: goalType || 'stars',
      goal_value: Number.isFinite(goalValue) ? goalValue : 5,
    };

    if (!payload.description) payload.description = '';

    return payload;
  }

  function validateAssignmentPayload(payload) {
    if (!payload || typeof payload !== 'object') {
      return { ok: false, error: 'Invalid assignment payload.' };
    }
    if (!payload.class) return { ok: false, error: 'Class is required.' };
    if (!payload.title) return { ok: false, error: 'Homework title is required.' };
    if (!payload.list_key) return { ok: false, error: 'List key is required.' };
    if (!payload.due_at) return { ok: false, error: 'Valid due date is required.' };
    return { ok: true };
  }

  async function createAssignment(payload) {
    const validation = validateAssignmentPayload(payload);
    if (!validation.ok) {
      throw new Error(validation.error || 'Invalid homework payload.');
    }

    const endpoint = getApiUrl('/.netlify/functions/homework_api?action=create_assignment');
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    const rawText = await resp.text();
    let data = {};
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch (parseErr) {
      throw new Error('Server returned an unexpected response while creating homework.');
    }

    if (!resp.ok || !data.success) {
      throw new Error(data.error || `HTTP ${resp.status}`);
    }

    return data;
  }

  window.TeacherHomeworkAssignment = {
    buildAssignmentPayload,
    validateAssignmentPayload,
    createAssignment,
  };
})();