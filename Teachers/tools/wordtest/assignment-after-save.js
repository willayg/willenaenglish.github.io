(function () {
  'use strict';

  const HOMEWORK_PATH = '/.netlify/functions/homework_api?action=create_assignment';
  const CLASSES_PATH = '/.netlify/functions/progress_summary?section=teacher_classes';

  function apiUrl(path) {
    return window.WillenaAPI && typeof window.WillenaAPI.getApiUrl === 'function'
      ? window.WillenaAPI.getApiUrl(path)
      : path;
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    })[ch]);
  }

  function tomorrowIsoDate(days = 7) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function dueAtFromDate(value) {
    const text = String(value || '').trim();
    if (!text) return null;
    const d = new Date(text + 'T23:59:59');
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  async function getJson(path, options) {
    const response = await (window.WillenaAPI ? window.WillenaAPI.fetch(path, options) : fetch(apiUrl(path), {
      credentials:'include',
      ...(options || {})
    }));
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) {
      throw new Error(data.error || ('Request failed (' + response.status + ')'));
    }
    return data;
  }

  async function loadClasses() {
    const data = await getJson(CLASSES_PATH);
    return Array.isArray(data.classes) ? data.classes : [];
  }

  function ensureModal() {
    let overlay = document.getElementById('wordBuilderAssignOverlay');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'wordBuilderAssignOverlay';
    overlay.className = 'wb-assign-overlay';
    overlay.hidden = true;
    overlay.innerHTML =
      '<div class="wb-assign-modal" role="dialog" aria-modal="true" aria-labelledby="wbAssignTitle">' +
        '<button class="wb-assign-close" type="button" aria-label="Close">×</button>' +
        '<div class="wb-assign-kicker">WORKSHEET SAVED</div>' +
        '<h2 id="wbAssignTitle">Assign for Vocabulary Study?</h2>' +
        '<p class="wb-assign-copy">You can assign the saved words now, or leave the worksheet saved without assigning it.</p>' +
        '<div class="wb-assign-saved-title" id="wbAssignSavedTitle"></div>' +
        '<label class="wb-assign-field"><span>Class</span><select id="wbAssignClass"><option value="">Loading classes…</option></select></label>' +
        '<label class="wb-assign-field"><span>Due date</span><input id="wbAssignDue" type="date"></label>' +
        '<fieldset class="wb-assign-modes"><legend>Practice</legend>' +
          '<label><input type="checkbox" value="quiz" checked> Quiz</label>' +
          '<label><input type="checkbox" value="spelling_test" checked> Spelling</label>' +
          '<label><input type="checkbox" value="speaking" checked> Speaking</label>' +
        '</fieldset>' +
        '<div class="wb-assign-note" id="wbAssignNote"></div>' +
        '<div class="wb-assign-actions">' +
          '<button id="wbAssignLater" class="wb-assign-secondary" type="button">Not now</button>' +
          '<button id="wbAssignSubmit" class="wb-assign-primary" type="button">Assign</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    const close = () => {
      overlay.hidden = true;
      document.body.classList.remove('wb-assign-open');
    };
    overlay.querySelector('.wb-assign-close').addEventListener('click', close);
    overlay.querySelector('#wbAssignLater').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    return overlay;
  }

  async function openAssignmentModal(saveResult) {
    const overlay = ensureModal();
    const classSelect = overlay.querySelector('#wbAssignClass');
    const dueInput = overlay.querySelector('#wbAssignDue');
    const titleEl = overlay.querySelector('#wbAssignSavedTitle');
    const noteEl = overlay.querySelector('#wbAssignNote');
    const submitBtn = overlay.querySelector('#wbAssignSubmit');
    const targets = Array.isArray(saveResult?.targets) ? saveResult.targets : [];
    const worksheet = saveResult?.worksheet || {};
    const collectionId = saveResult?.id || worksheet.id || '';

    titleEl.textContent = worksheet.title || saveResult?.title || 'Saved worksheet';
    dueInput.value = tomorrowIsoDate(7);
    noteEl.textContent = targets.length
      ? targets.length + ' saved word' + (targets.length === 1 ? '' : 's')
      : 'No assignable vocabulary targets were returned.';
    submitBtn.disabled = !collectionId || !targets.length;
    classSelect.innerHTML = '<option value="">Loading classes…</option>';
    overlay.hidden = false;
    document.body.classList.add('wb-assign-open');

    try {
      const classes = await loadClasses();
      classSelect.innerHTML = '<option value="">Choose a class…</option>' +
        classes.map(c => '<option value="' + esc(c.name) + '">' + esc(c.name) +
          (Number(c.student_count) >= 0 ? ' (' + Number(c.student_count) + ')' : '') +
          '</option>').join('');
      if (!classes.length) classSelect.innerHTML = '<option value="">No classes found</option>';
    } catch (error) {
      classSelect.innerHTML = '<option value="">Could not load classes</option>';
      noteEl.textContent = 'Worksheet saved. Classes could not be loaded: ' + error.message;
    }

    submitBtn.onclick = async () => {
      const className = classSelect.value;
      const dueAt = dueAtFromDate(dueInput.value);
      const modes = Array.from(overlay.querySelectorAll('.wb-assign-modes input:checked')).map(x => x.value);
      if (!className) {
        noteEl.textContent = 'Choose a class, or click Not now.';
        return;
      }
      if (!dueAt) {
        noteEl.textContent = 'Choose a valid due date.';
        return;
      }
      if (!modes.length) {
        noteEl.textContent = 'Choose at least one practice mode.';
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Assigning…';
      noteEl.textContent = '';
      try {
        const payload = {
          class: className,
          title: worksheet.title || saveResult?.title || 'Vocabulary Practice',
          description: 'Assigned from Word Builder',
          source_type: 'vocab_study',
          list_key: 'word_builder:' + collectionId,
          list_title: worksheet.title || saveResult?.title || null,
          list_meta: {
            source_app: 'word_builder',
            word_builder_collection_id: collectionId,
            required_modes: modes
          },
          targets: targets.map((target, index) => ({
            lexical_entry_id: target.lexical_entry_id,
            position: Number.isFinite(Number(target.position)) ? Number(target.position) : index,
            english: target.english || '',
            korean: target.korean || ''
          })),
          start_at: new Date().toISOString(),
          due_at: dueAt,
          goal_type: 'clean_pass',
          goal_value: 100
        };
        const data = await getJson(HOMEWORK_PATH, {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify(payload)
        });
        noteEl.textContent = 'Assigned to ' + className + '.';
        noteEl.classList.add('is-success');
        submitBtn.textContent = 'Assigned';
        setTimeout(() => {
          overlay.hidden = true;
          document.body.classList.remove('wb-assign-open');
          noteEl.classList.remove('is-success');
          submitBtn.textContent = 'Assign';
          submitBtn.disabled = false;
        }, 850);
        window.dispatchEvent(new CustomEvent('wordbuilder:assignment-created', {
          detail:{ assignment:data.assignment || null, collection_id:collectionId }
        }));
      } catch (error) {
        noteEl.textContent = 'Could not assign: ' + error.message;
        submitBtn.disabled = false;
        submitBtn.textContent = 'Assign';
      }
    };
  }

  window.onWordBuilderSaved = function (saveResult) {
    if (!saveResult || !saveResult.success) return;
    openAssignmentModal(saveResult).catch(error => {
      console.error('[Word Builder] assignment modal failed:', error);
    });
  };
})();