// homework-ui.js
// UI wiring for Homework tab: modal open/close and future data hooks.

import { HomeworkAPI } from './homework-api.js';

let homeworkUiInitialized = false;
let wordlistDataset = [];
let selectedWordlist = null;

export function initHomeworkUI() {
  if (homeworkUiInitialized) return;
  homeworkUiInitialized = true;

  const assignTop = document.getElementById('hwAssignBtnTop');
  const assignInline = document.getElementById('hwAssignBtn');
  const modal = document.getElementById('hwAssignModal');
  const closeBtn = document.getElementById('hwAssignModalClose');
  const cancelBtn = document.getElementById('hwAssignModalCancel');
  const classInput = document.getElementById('hwAssignClass');
  const titleInput = document.getElementById('hwAssignTitle');
  const startDateInput = document.getElementById('hwStartDate');
  const dueDateInput = document.getElementById('hwDueDate');
  const listSearchInput = document.getElementById('hwListSearch');
  const listResults = document.getElementById('hwListResults');
  const goalStarsInput = document.getElementById('hwGoalStars');
  const saveBtn = document.getElementById('hwAssignModalSave');

  const openModal = () => {
    if (!modal) return;
    // Prefill class from selected Homework class, or main class selector as fallback
    if (classInput) {
      const hwActive = document.querySelector('#homeworkClassList .class-item.active');
      const hwDisplay = hwActive && hwActive.dataset.display;
      const mainSel = document.getElementById('classSel');
      const mainVal = mainSel && mainSel.value;
      classInput.value = hwDisplay || mainVal || '';
    }

    // Default dates: today for start, +7 days for due
    const today = new Date();
    const toIsoDate = (d) => d.toISOString().split('T')[0];
    if (startDateInput && !startDateInput.value) {
      startDateInput.value = toIsoDate(today);
    }
    if (dueDateInput && !dueDateInput.value) {
      const due = new Date(today);
      due.setDate(due.getDate() + 7);
      dueDateInput.value = toIsoDate(due);
    }

    // Clear title on open; you can auto-fill from a selected list later
    if (titleInput) {
      titleInput.value = '';
    }

    modal.hidden = false;
  };

  const closeModal = () => {
    if (!modal) return;
    modal.hidden = true;
  };

  if (assignTop) assignTop.addEventListener('click', openModal);
  if (assignInline) assignInline.addEventListener('click', openModal);
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

  // --- Stub dataset (replace with server search later) ---
  wordlistDataset = [
    { file_path: 'Games/english_arcade/sample-wordlists-level3/Activities1.json', title: 'L3 • Activities 1', tags: ['activities','present','verbs'] },
    { file_path: 'Games/english_arcade/sample-wordlists-level3/Animals1.json', title: 'L3 • Animals 1', tags: ['animals','nouns'] },
    { file_path: 'Games/english_arcade/sample-wordlists-level2/DailyRoutines.json', title: 'L2 • Daily Routines', tags: ['daily','routines','present'] },
    { file_path: 'Games/english_arcade/sample-wordlists-level2/SchoolStuff.json', title: 'L2 • School Stuff', tags: ['school','objects'] },
    { file_path: 'Games/english_arcade/sample-wordlists-level3/Sports1.json', title: 'L3 • Sports 1', tags: ['sports','activities'] },
    { file_path: 'Games/english_arcade/sample-wordlists-level3/Food1.json', title: 'L3 • Food 1', tags: ['food','nouns'] }
  ];

  function renderSearchResults(results){
    if (!listResults) return;
    if (!results.length) {
      listResults.innerHTML = '<div class="empty">No matches.</div>';
      return;
    }
    listResults.innerHTML = results.map(r => {
      const safeTitle = r.title.replace(/"/g,'&quot;');
      const tagLine = r.tags && r.tags.length ? r.tags.join(', ') : '';
      return `<div class="hw-list-row" data-path="${r.file_path}" data-title="${safeTitle}">
        <div class="hw-list-row-title">${safeTitle}</div>
        <div class="hw-list-row-tags">${tagLine}</div>
        <div class="hw-list-row-path">${r.file_path}</div>
      </div>`;
    }).join('');
    listResults.querySelectorAll('.hw-list-row').forEach(row => {
      row.addEventListener('click', () => {
        listResults.querySelectorAll('.hw-list-row').forEach(r => r.classList.remove('selected'));
        row.classList.add('selected');
        selectedWordlist = {
          file_path: row.dataset.path,
          title: row.dataset.title
        };
        if (titleInput && !titleInput.value) titleInput.value = selectedWordlist.title;
        validateForm();
      });
    });
  }

  function performSearch(){
    if (!listSearchInput) return;
    const q = listSearchInput.value.trim().toLowerCase();
    if (!q) {
      renderSearchResults([]);
      listResults.innerHTML = '<div class="empty">Type to search available wordlists.</div>';
      return;
    }
    const results = wordlistDataset.filter(r => {
      const hay = [r.title, r.file_path, (r.tags||[]).join(' ')].join(' ').toLowerCase();
      return hay.includes(q);
    }).slice(0, 25);
    renderSearchResults(results);
  }

  function validateForm(){
    if (!saveBtn) return;
    const hasClass = classInput && classInput.value.trim().length > 0;
    const hasTitle = titleInput && titleInput.value.trim().length > 0;
    const hasWordlist = !!selectedWordlist;
    const hasGoal = goalStarsInput && Number(goalStarsInput.value) > 0;
    saveBtn.disabled = !(hasClass && hasTitle && hasWordlist && hasGoal);
  }

  function resetForm(){
    selectedWordlist = null;
    if (titleInput) titleInput.value = '';
    if (listSearchInput) listSearchInput.value = '';
    if (listResults) listResults.innerHTML = '<div class="empty">Type to search available wordlists.</div>';
    validateForm();
  }

  if (listSearchInput) {
    listSearchInput.addEventListener('input', () => {
      performSearch();
      validateForm();
    });
  }

  if (titleInput) titleInput.addEventListener('input', validateForm);
  if (goalStarsInput) goalStarsInput.addEventListener('input', validateForm);

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      if (saveBtn.disabled) return;
      const payload = {
        class: classInput ? classInput.value.trim() : null,
        list_key: selectedWordlist ? selectedWordlist.file_path : null,
        list_title: selectedWordlist ? selectedWordlist.title : null,
        title: titleInput ? titleInput.value.trim() : null,
        start_at: startDateInput ? startDateInput.value : null,
        due_at: dueDateInput ? dueDateInput.value : null,
        goal_type: 'stars',
        goal_value: goalStarsInput ? Number(goalStarsInput.value) : null
      };
      console.debug('[HomeworkUI] Assign payload (stub):', payload);
      alert('Stub: would assign homework for ' + payload.class + '\nList: ' + payload.list_title);
      modal.hidden = true;
      resetForm();
    });
  }
}
