// Direct, click-driven audit runner for Question Render Lab.
// Deliberately avoids module boot timing: modules are imported only after the user clicks Audit All DB.
(() => {
  const $ = (s) => document.querySelector(s);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let results = [];
  let previewRenderer = null;

  function setSummary(text) {
    const el = $('#auditSummary');
    if (el) el.textContent = text;
  }

  function mergeHeaders(base, extra) {
    const out = {};
    if (base instanceof Headers) base.forEach((v, k) => out[k] = v);
    else Object.assign(out, base || {});
    Object.assign(out, extra || {});
    return out;
  }

  async function getJson(path, range = '') {
    const conn = window.__renderLabApi;
    if (!conn) throw new Error('Render Lab DB connection is not ready.');
    const headers = mergeHeaders(conn.headers, range ? { Range: range } : {});
    const r = await fetch(conn.base + path, { headers, cache: 'no-store' });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }

  async function paged(path) {
    const rows = [];
    for (let start = 0; start < 50000; start += 1000) {
      const batch = await getJson(path, `${start}-${start + 999}`);
      rows.push(...batch);
      if (batch.length < 1000) break;
    }
    return rows;
  }

  function counts() {
    const c = { pass: 0, warning: 0, fail: 0 };
    for (const x of results) c[x.audit.status] = (c[x.audit.status] || 0) + 1;
    return c;
  }

  function filteredResults() {
    const wanted = $('#auditStatus')?.value || 'all';
    return wanted === 'all' ? results : results.filter(x => x.audit.status === wanted);
  }

  function preview(id, QuestionRenderer) {
    const hit = results.find(x => String(x.q.id) === String(id));
    const card = $('#card');
    if (!hit || !card) return;
    try { previewRenderer?.destroy?.(); } catch {}
    previewRenderer = new QuestionRenderer(card).render(hit.q, {});
    const summary = hit.audit.findings.map(f => `${f.severity.toUpperCase()}: ${f.code} — ${f.message}`).join(' | ') || 'PASS';
    const count = $('#count');
    if (count) count.textContent = `Audit preview · ${summary}`;
  }

  function renderResults(QuestionRenderer) {
    const box = $('#auditResults');
    if (!box) return;
    const list = filteredResults().slice();
    box.hidden = false;
    box.style.cssText = 'margin:10px 0 14px;padding:10px;border:1px solid #ddd;border-radius:12px;max-height:320px;overflow:auto;background:var(--surface,#fff);';
    if (!list.length) {
      box.innerHTML = '<div class="empty">No audit results match this filter.</div>';
      return;
    }
    const rank = { fail: 0, warning: 1, pass: 2 };
    list.sort((a, b) => rank[a.audit.status] - rank[b.audit.status] || String(a.q.section || '').localeCompare(String(b.q.section || '')));
    box.innerHTML = list.map(x => {
      const codes = x.audit.findings.map(f => f.code).join(', ') || 'OK';
      const prompt = String(x.q.prompt || '').replace(/\s+/g, ' ').slice(0, 110);
      return `<button type="button" data-audit-id="${esc(x.q.id)}" style="display:block;width:100%;text-align:left;padding:8px 10px;margin:4px 0;border:1px solid #ddd;border-radius:9px;background:transparent;cursor:pointer"><strong>${esc(x.audit.status.toUpperCase())}</strong> · ${esc(x.q.section || '—')} · ${esc(x.q.form || '—')}<br><small>${esc(codes)}</small>${prompt ? `<br><span>${esc(prompt)}</span>` : ''}</button>`;
    }).join('');
    box.querySelectorAll('[data-audit-id]').forEach(btn => btn.addEventListener('click', () => preview(btn.dataset.auditId, QuestionRenderer)));
  }

  async function run() {
    const button = $('#auditAll');
    if (!button || button.disabled) return;
    button.disabled = true;
    const old = button.textContent;
    button.textContent = 'Auditing…';
    setSummary('AUDIT · starting…');
    const box = $('#auditResults');
    if (box) { box.hidden = false; box.innerHTML = '<div class="empty">Starting audit…</div>'; }

    try {
      const [{ adaptStored }, { QuestionRenderer }, { auditQuestions, AUDIT_STATUS }] = await Promise.all([
        import('../test-prep-v2/question-model.js'),
        import('../test-prep-v2/question-renderer.js'),
        import('./audit.js?v=4')
      ]);

      setSummary('AUDIT · loading DB…');
      const fields = 'id,book_id,unit_id,source_id,source_question_number,source_page,section,question_type,prompt_text,context,choices,correct_answer,answer_mode,student_source_label,content_status,metadata,targets,replacement_needed,created_at,updated_at';
      const rows = (await paged(`/rest/v1/test_prep_questions?select=${encodeURIComponent(fields)}&student_usable=eq.true`)).filter(r => r.replacement_needed !== true);
      setSummary(`AUDIT · loaded ${rows.length} · adapting…`);

      const canonical = [];
      for (const row of rows) {
        try {
          canonical.push({ ...adaptStored(row), _auditRaw: row });
        } catch (error) {
          canonical.push({ id: row.id, form: 'unsupported', prompt: row.prompt_text || '', section: row.section || '', correctAnswer: row.correct_answer || [], context: row.context || {}, _adaptError: String(error?.message || error) });
        }
      }

      const map = await auditQuestions(canonical, QuestionRenderer, {
        yieldEvery: 10,
        onProgress: (done, total) => {
          if (done === 1 || done === total || done % 25 === 0) setSummary(`AUDIT · ${done}/${total}…`);
        }
      });

      results = canonical.map(q => ({
        q,
        audit: map.get(String(q.id)) || { status: AUDIT_STATUS.FAIL, findings: [{ severity: AUDIT_STATUS.FAIL, code: 'NO_RESULT', message: 'No audit result returned.' }] }
      }));
      for (const x of results) {
        if (x.q._adaptError) {
          x.audit.status = AUDIT_STATUS.FAIL;
          x.audit.findings.unshift({ severity: AUDIT_STATUS.FAIL, code: 'ADAPT_EXCEPTION', message: x.q._adaptError });
        }
      }

      const c = counts();
      setSummary(`AUDIT · ${results.length} · ${c.fail} fail · ${c.warning} warn · ${c.pass} pass`);
      renderResults(QuestionRenderer);
      $('#auditStatus')?.addEventListener('change', () => renderResults(QuestionRenderer));
    } catch (error) {
      console.error('Render Lab audit failed', error);
      setSummary(`AUDIT ERROR · ${String(error?.message || error)}`);
      if (box) box.innerHTML = `<div class="empty">${esc(String(error?.message || error))}</div>`;
    } finally {
      button.disabled = false;
      button.textContent = old;
    }
  }

  function wire() {
    const button = $('#auditAll');
    if (!button) return;
    button.onclick = run;
    setSummary('AUDIT · ready');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire, { once: true });
  else wire();
})();
