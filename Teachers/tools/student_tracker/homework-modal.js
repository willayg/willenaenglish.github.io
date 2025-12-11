// Homework Assignment Modal Module
// Handles opening, closing, and assignment creation flow

const HomeworkModal = (() => {
  let overlay = null;
  let selectedClass = null;
  let selectedList = null;
  let searchTimeout = null;
  let loadedListContents = {}; // Cache for fetched JSON content

  // Real wordlist registry - dynamically loaded from actual game files
  // Dynamically include all wordlists from all levels and the main folder
  // Dynamically include all wordlists and grammar files from all levels and the main folder
  const WORDLIST_REGISTRY = [
    // Level 1 Vocab
    ...[
      'Animals2.json','EasyAnimals.json','EasyHobbies.json','EasyJobs.json','EasyVerbs.json','Feelings.json','Food1.json','Food2.json','Food3.json','QuestionsBasics.json','SchoolSupplies.json','Sports.json','Transportation.json'
    ].map(f => ({ path: `Games/english_arcade/sample-wordlists/${f}`, level: 1, type: 'wordlist', tags: [] })),
    // Phonics lists
    ...[
      // Consonant blends
      'blend-br-bl.json','blend-cr-cl.json','blend-dr-fl-fr.json','blend-gr-gl.json','blend-pl-pr-sc.json','blend-sk-sl-sm-sn-sp-st-sw.json','blend-tr-tw.json'
    ].map(f => ({ path: `Games/english_arcade/phonics-lists/consonant-blends/${f}`, type: 'phonics', tags: ['consonant-blend'] })),
    // Level 1 Grammar
    ...[
      'am_are_is.json','articles.json','can_cant.json','contractions_be.json','countable_uncountable.json','do_does_questions.json','dont_doesnt.json','have_vs_has.json','he_she_it.json','in_on_under.json','is_are_questions.json','isnt_arent.json','it_vs_they.json','like_vs_likes.json','negative_contractions.json','plurals_es.json','plurals_ies.json','plurals_irregular.json','plurals_s.json',
      /* 'there_are_vs_they_are.json','there_is_are.json', */
      'these_vs_those.json','this_vs_that.json','want_vs_wants.json'
    ].map(f => ({ path: `Games/english_arcade/data/grammar/level1/${f}`, level: 1, type: 'grammar', tags: [] })),
    // Level 2 Vocab
    ...[
      'Adjectives1.json','Adjectives2.json','Adjectives3.json','AnimalsAdvanced.json','ArtCulture.json','ClothingAccessories.json','CommunityPlaces2.json','Feelings2.json','HomeRooms.json','KitchenAppliances.json','MusicalInstruments.json','NatureLandforms.json','PoliteRequestsKids.json','RareAnimals.json','SchoolSupplies2.json','Vegetables.json','Verbs1.json','Verbs2.json','Verbs3.json','Verbs4.json','Weather.json'
    ].map(f => ({ path: `Games/english_arcade/sample-wordlists-level2/${f}`, level: 2, type: 'wordlist', tags: [] })),
    // Long vowels
    ...[
      'long-a-ai-ay.json','long-a.json','long-e.json','long-i.json','long-o-oa-oe.json','long-o.json','long-u.json'
    ].map(f => ({ path: `Games/english_arcade/phonics-lists/long-vowels/${f}`, type: 'phonics', tags: ['long-vowel'] })),
    // More
    ...[
      'ch-sh.json','ck-ng-mp.json','th-wh.json'
    ].map(f => ({ path: `Games/english_arcade/phonics-lists/more/${f}`, type: 'phonics', tags: ['phonics'] })),
    // Short vowels
    ...[
      'short-a.json','short-e.json','short-i.json','short-o.json','short-u.json'
    ].map(f => ({ path: `Games/english_arcade/phonics-lists/short-vowels/${f}`, type: 'phonics', tags: ['short-vowel'] })),
    // Level 2 Grammar
    ...[
      'are_there_vs_is_there.json','how_many_is_that.json','in_on_at_time.json','prepositions_between_above_below.json','prepositions_between_near_acrossfrom.json','prepositions_next_to_behind_infront.json','prepositions_review.json','present_progressive_negative.json','present_progressive_questions_wh.json','present_progressive_questions_yesno.json','present_progressive.json','present_simple_negative.json','present_simple_questions_wh.json','present_simple_questions_yesno.json','present_simple_sentences.json','present_simple_vs_progressive.json','short_questions_1.json','short_questions_2.json','some_vs_any.json','there_is_vs_there_are.json','wh_how_why_which.json','wh_where_when_whattime.json','wh_who_what.json'
    ].map(f => ({ path: `Games/english_arcade/data/grammar/level2/${f}`, level: 2, type: 'grammar', tags: [] })),
    // Level 3 Vocab
    ...[
      'Activities1.json','Activities2.json','Activities3.json','Adjectives4.json','Adjectives5.json','Adjectives6.json','BathroomItems.json','KitchenUtensilsTools.json','NatureObjects.json','PersonalQualities.json','SchoolSubjectsRooms.json','SnacksTreats.json','Verbs5.json','Verbs6.json','Verbs7.json','Verbs8.json'
    ].map(f => ({ path: `Games/english_arcade/sample-wordlists-level3/${f}`, level: 3, type: 'wordlist', tags: [] })),
    // Level 3 Grammar - explicit curated list (match level3_grammar_modal.js)
    ...[
      'past_simple_irregular.json',
      'past_simple_regular.json',
      'be_going_to_future.json',
      'be_going_to_questions.json',
      'past_vs_future.json'
    ].map(f => ({ path: `Games/english_arcade/data/grammar/level3/${f}`, level: 3, type: 'grammar', tags: [] })),
    // Level 4 Grammar (kept commented out previously) - leave available for future
    ...[
      'adverbs_frequency.json','all_comparatives_review.json','all_superlatives_review.json','all_tenses_review.json','and_vs_but.json','every_vs_all.json'
    ].map(f => ({ path: `Games/english_arcade/data/grammar/level4/${f}`, level: 4, type: 'grammar', tags: [] })),
    // Level 4 Vocab
    ...[
      'ChoresKids.json','ClassroomPhrasesKids.json','CommunityHelpersJobs.json','DailyRoutines2.json','EmotionsInStories.json','EnvironmentalActions.json','FeelingsAboutWeather.json','FeelingsInSchool.json','FeelingsSocialSkills.json','FoodCookingActions.json','GamesBoardGames.json','HouseholdToolsFixes.json','OutdoorAdventureCamping.json','PhrasalVerbsKids1.json','PhrasalVerbsKids2.json','PlaygroundActions.json','SchoolClubsHobbies.json','ScienceLabTools.json','ShoppingMoney.json','SimpleScienceActions.json','SportsHobbiesKids2.json','TechnologyGadgets.json','TravelTransportation.json'
    ].map(f => ({ path: `Games/english_arcade/sample-wordlists-level4/${f}`, level: 4, type: 'wordlist', tags: [] })),
    /*
    // Level 4 Grammar
    ...[
      'adverbs_frequency.json','all_comparatives_review.json','all_superlatives_review.json','all_tenses_review.json','and_vs_but.json','every_vs_all.json'
      // Add more level 4 grammar files here as needed
    ].map(f => ({ path: `Games/english_arcade/data/grammar/level4/${f}`, level: 4, type: 'grammar', tags: [] })),
    */
    // Level 5 Vocab/Grammar (add as needed)
    // ...
  ];

  // Files to exclude from the modal registry (useful for hiding in-progress lists)
  const HIDDEN_WORDLIST_FILES = new Set([
    'there_are_vs_they_are.json',
    'there_is_are.json',
    'adverbs_frequency.json',
    'all_comparatives_review.json',
    'all_superlatives_review.json',
    'all_tenses_review.json'
  ]);

  function filenameFromPath(path) {
    return String(path || '').split('/').pop();
  }

  function getAvailableRegistry() {
    return WORDLIST_REGISTRY.filter(l => !HIDDEN_WORDLIST_FILES.has(filenameFromPath(l.path)));
  }

  // Helper function to generate display title from filename
  function getDisplayTitle(path, level, type) {
    const filename = path.split('/').pop().replace('.json', '');
    // Replace underscores and dashes with spaces
    let formatted = filename.replace(/[_-]/g, ' ');
    // Replace 'vs' and 'Vs' with 'vs'
    formatted = formatted.replace(/\bvs\b/gi, 'vs');
    // Capitalize each word, but keep 'vs' lowercase
    formatted = formatted.split(' ').map(word => {
      if (word.toLowerCase() === 'vs') return 'vs';
      if (!word) return '';
      return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
    // Remove extra spaces
    formatted = formatted.replace(/\s+/g, ' ').trim();
    const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
    return `${formatted}`;
  }

  function init() {
    overlay = document.getElementById('homeworkModalOverlay');
    if (!overlay) return;

    // Close modal on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });

    // Close button
    const closeBtn = document.getElementById('hwModalClose');
    if (closeBtn) closeBtn.addEventListener('click', close);

    // Cancel button
    const cancelBtn = document.getElementById('hwModalCancel');
    if (cancelBtn) cancelBtn.addEventListener('click', close);

    // Assign button
    const assignBtn = document.getElementById('hwModalAssign');
    if (assignBtn) assignBtn.addEventListener('click', handleAssign);

    // Search input
    const searchInput = document.getElementById('hwModalSearch');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => handleSearch(e.target.value), 300);
      });
    }

    // Filter buttons: support separate subject and level groups so they can be combined
    const filterBtns = Array.from(document.querySelectorAll('.homework-modal-filter-btn'));
    // Define groups by data-filter content: subject filters are 'all', 'vocab', 'grammar', 'phonics'
    const subjectBtns = filterBtns.filter(b => ['all','vocab','grammar','phonics'].includes(b.dataset.filter));
    const levelBtns = filterBtns.filter(b => b.dataset.filter && b.dataset.filter.startsWith('level:'));

    // Track selected filters
    let selectedSubjectFilter = 'all';
    let selectedLevelFilter = null;

    function applyFilters() {
      // Build the filtered set based on selectedSubjectFilter and selectedLevelFilter
      let registry = getAvailableRegistry();
      if (selectedSubjectFilter && selectedSubjectFilter !== 'all') {
        if (selectedSubjectFilter === 'vocab') registry = registry.filter(l => l.type === 'wordlist');
        else if (selectedSubjectFilter === 'grammar') registry = registry.filter(l => l.type === 'grammar');
        else if (selectedSubjectFilter === 'phonics') registry = registry.filter(l => l.type === 'phonics');
      }
      if (selectedLevelFilter) {
        const levelNum = parseInt(selectedLevelFilter, 10);
        if (!isNaN(levelNum)) registry = registry.filter(l => Number(l.level) === levelNum);
      }
      renderSearchResults(registry);
    }

    // Setup subject buttons (toggleable: clicking active button clears the subject filter)
    subjectBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const wasActive = btn.classList.contains('active');
        subjectBtns.forEach(b => b.classList.remove('active'));
        if (wasActive) {
          // clear subject filter -> treat as 'all'
          selectedSubjectFilter = 'all';
        } else {
          btn.classList.add('active');
          selectedSubjectFilter = btn.dataset.filter || 'all';
        }
        applyFilters();
      });
    });

    // Setup level buttons
    levelBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        // Toggleable level: clicking active level clears it; otherwise select it exclusively
        const wasActive = btn.classList.contains('active');
        levelBtns.forEach(b => b.classList.remove('active'));
        if (wasActive) {
          selectedLevelFilter = null;
        } else {
          btn.classList.add('active');
          const parts = (btn.dataset.filter || '').split(':');
          selectedLevelFilter = parts[1] || null;
        }
        applyFilters();
      });
    });

    // ESC key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay && overlay.classList.contains('active')) {
        close();
      }
    });

    // Preview modal setup
    initPreviewModal();
  }

  function handleFilter(filter) {
    const registry = getAvailableRegistry();
    let filtered;
    if (!filter || filter === 'all') {
      filtered = registry;
    } else if (filter === 'vocab') {
      filtered = registry.filter(l => l.type === 'wordlist');
    } else if (filter === 'grammar') {
      filtered = registry.filter(l => l.type === 'grammar');
    } else if (filter === 'phonics') {
      filtered = registry.filter(l => l.type === 'phonics');
    } else if (filter.startsWith && filter.startsWith('level:')) {
      const parts = filter.split(':');
      const levelNum = parseInt(parts[1], 10);
      if (!isNaN(levelNum)) {
        filtered = registry.filter(l => Number(l.level) === levelNum);
      } else {
        filtered = registry;
      }
    } else {
      filtered = registry;
    }
    renderSearchResults(filtered);
  }

  function open(className, classDisplay) {
    if (!overlay) return;
    
    selectedClass = className;
    selectedList = null;

    // Update modal title with class name
    const classLabel = document.getElementById('hwModalClassLabel');
    if (classLabel) classLabel.textContent = classDisplay || className;

    // Reset form
    document.getElementById('hwModalTitle').value = '';
    document.getElementById('hwModalDescription').value = '';
    document.getElementById('hwModalDueDate').value = getDefaultDueDate();
    document.getElementById('hwModalSearch').value = '';
    
    // Clear selected list display
    const selectedDisplay = document.getElementById('hwModalSelectedList');
    if (selectedDisplay) selectedDisplay.style.display = 'none';

  // Show initial search results (filtered to exclude hidden files)
  renderSearchResults(getAvailableRegistry());

    // Disable assign button until list selected
    document.getElementById('hwModalAssign').disabled = true;

    overlay.classList.add('active');
    
    // Focus search input
    setTimeout(() => {
      document.getElementById('hwModalSearch').focus();
    }, 100);
  }

  function close() {
    if (!overlay) return;
    overlay.classList.remove('active');
    selectedClass = null;
    selectedList = null;
  }

  function getDefaultDueDate() {
    const date = new Date();
  date.setDate(date.getDate() + 2); // Default to 2 days from now
    return date.toISOString().split('T')[0];
  }

  function handleSearch(query) {
    const q = query.trim().toLowerCase();
    
    if (!q) {
      renderSearchResults(getAvailableRegistry());
      return;
    }

    // Search across path, tags, level
  const results = getAvailableRegistry().filter(list => {
      const pathMatch = list.path.toLowerCase().includes(q);
      const tagMatch = list.tags.some(tag => tag.toLowerCase().includes(q));
      const typeMatch = list.type.toLowerCase().includes(q);
      const levelMatch = `level ${list.level}`.includes(q);
      return pathMatch || tagMatch || typeMatch || levelMatch;
    });

    renderSearchResults(results);
  }

  function renderSearchResults(results) {
    const container = document.getElementById('hwModalResults');
    if (!container) return;

    if (results.length === 0) {
      container.innerHTML = '<div class="homework-modal-empty-state">No wordlists found. Try a different search term.</div>';
      return;
    }

      container.innerHTML = results.map((list, idx) => {
        const title = getDisplayTitle(list.path, list.level, list.type);
        let meta;
        if (list.type === 'phonics') {
          meta = 'Phonics';
        } else {
          const typeLabel = list.type.charAt(0).toUpperCase() + list.type.slice(1);
          meta = `Level ${list.level} - ${typeLabel}`;
        }
        return `
          <div class="homework-modal-result-item" data-idx="${idx}" data-file="${list.path}">
            <div class="homework-modal-result-content">
              <div class="homework-modal-result-title">${title}</div>
              <div class="homework-modal-result-meta">${meta}</div>
            </div>
            <button type="button" class="homework-modal-result-preview-btn" data-preview-idx="${idx}">Preview</button>
          </div>
        `;
      }).join('');

    // Add click handlers for selection
    container.querySelectorAll('.homework-modal-result-item').forEach((item, idx) => {
      item.addEventListener('click', (e) => {
        if (!e.target.classList.contains('homework-modal-result-preview-btn')) {
          selectList(results[idx]);
        }
      });
    });

    // Add click handlers for preview buttons
    container.querySelectorAll('.homework-modal-result-preview-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.previewIdx);
        showPreview(results[idx]);
      });
    });
  }

  function selectList(list) {
    selectedList = list;

    // Update visual selection
    document.querySelectorAll('.homework-modal-result-item').forEach(item => {
      item.classList.remove('selected');
    });
  const selectedItem = document.querySelector(`.homework-modal-result-item[data-file="${list.path}"]`);
    if (selectedItem) selectedItem.classList.add('selected');

    // Show selected list display
    const title = getDisplayTitle(list.path, list.level, list.type);
    const selectedDisplay = document.getElementById('hwModalSelectedList');
    if (selectedDisplay) {
      selectedDisplay.style.display = 'block';
      document.getElementById('hwModalSelectedTitle').textContent = title;
      document.getElementById('hwModalSelectedMeta').textContent = `Level ${list.level} • ${list.type} • ${list.tags.join(', ')}`;
    }

    // Always update title when a new list is selected unless user has manually edited.
    // Strategy: Track the last auto-filled value on the input element via dataset.
    const titleInput = document.getElementById('hwModalTitle');
    if (titleInput) {
      const lastAuto = titleInput.dataset.lastAutoTitle || '';
      const currentVal = titleInput.value.trim();
      // If current value equals last auto-filled value OR is empty, replace with new auto title.
      if (!currentVal || currentVal === lastAuto) {
        titleInput.value = title;
        titleInput.dataset.lastAutoTitle = title;
      } else {
        // User modified manually; do not override, but update lastAutoTitle for future comparisons.
        titleInput.dataset.lastAutoTitle = title;
      }
    }

    // Enable assign button
    document.getElementById('hwModalAssign').disabled = false;
  }

  async function handleAssign() {
    if (!selectedList || !selectedClass) {
      alert('Please select a wordlist before assigning.');
      return;
    }

    const title = document.getElementById('hwModalTitle').value.trim();
    const description = document.getElementById('hwModalDescription').value.trim();
    const dueDate = document.getElementById('hwModalDueDate').value;

    if (!title) {
      alert('Please enter a homework title.');
      document.getElementById('hwModalTitle').focus();
      return;
    }

    if (!dueDate) {
      alert('Please select a due date.');
      document.getElementById('hwModalDueDate').focus();
      return;
    }

    // Build assignment payload
    const assignment = {
      class: selectedClass,
      title: title,
      description: description,
      list_key: selectedList.path,
      list_title: getDisplayTitle(selectedList.path, selectedList.level, selectedList.type),
      list_meta: {
        tags: selectedList.tags,
        level: selectedList.level,
        type: selectedList.type
      },
      start_at: new Date().toISOString(),
      due_at: new Date(dueDate + 'T23:59:59').toISOString(),
      goal_type: 'stars',
      goal_value: 5
    };

    console.log('Assignment payload:', assignment);

    try {\n      const apiUrl = window.WillenaAPI ? window.WillenaAPI.getApiUrl('/.netlify/functions/homework_api?action=create_assignment') : '/.netlify/functions/homework_api?action=create_assignment';\n      const resp = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(assignment)
      });

      const rawText = await resp.text();
      let data;
      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch (parseErr) {
        console.error('Homework assign error: non-JSON response from server', {
          status: resp.status,
          rawText,
          parseErr
        });
        throw new Error('Server returned an unexpected response while creating homework.');
      }

      if (!resp.ok || !data.success) {
        console.error('Homework assign error payload:', data);
        throw new Error(data.error || `HTTP ${resp.status}`);
      }

      const listTitle = getDisplayTitle(selectedList.path, selectedList.level, selectedList.type);
      alert(`Homework assigned!\n\nClass: ${selectedClass}\nTitle: ${title}\nList: ${listTitle}\nDue: ${dueDate}`);
      close();
      if (window.loadHomeworkForClass && window.currentHomeworkClass) {
        window.loadHomeworkForClass(window.currentHomeworkClass.name, window.currentHomeworkClass.display);
      }
    } catch (err) {
      console.error('Homework assign error:', err);
      alert('Error assigning homework: ' + err.message);
    }
  }

  // Preview Modal Functions
  function initPreviewModal() {
    const previewOverlay = document.getElementById('homeworkPreviewOverlay');
    if (!previewOverlay) return;

    const previewClose = document.getElementById('hwPreviewClose');
    if (previewClose) {
      previewClose.addEventListener('click', closePreview);
    }

    previewOverlay.addEventListener('click', (e) => {
      if (e.target === previewOverlay) closePreview();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && previewOverlay.classList.contains('active')) {
        closePreview();
      }
    });
  }

  async function showPreview(list) {
    const previewOverlay = document.getElementById('homeworkPreviewOverlay');
    const previewTitle = document.getElementById('hwPreviewTitle');
    const previewList = document.getElementById('hwPreviewList');
    
    if (!previewOverlay || !previewTitle || !previewList) return;

    const title = getDisplayTitle(list.path, list.level, list.type);
    previewTitle.textContent = title;

    // Show loading state
    previewList.innerHTML = '<div class="homework-preview-loading">Loading content...</div>';
    previewOverlay.classList.add('active');

    try {
      // Check cache first
      let content = loadedListContents[list.path];
      
      if (!content) {
        // Fetch from file
        const response = await fetch(`/${list.path}`);
        if (!response.ok) {
          throw new Error(`Failed to load: ${response.statusText}`);
        }
        content = await response.json();
        
        // Cache it
        loadedListContents[list.path] = content;
      }

      if (!content || content.length === 0) {
        previewList.innerHTML = '<div class="homework-preview-empty">No content available for this list.</div>';
        return;
      }

      if (list.type === 'grammar') {
        // Grammar list with sentences and translations
        // Grammar files have: en, ko, exampleSentence, exampleSentenceKo
        previewList.innerHTML = content.map((item, idx) => `
          <li>
            <span class="homework-preview-number">${idx + 1}.</span>
            <div class="homework-preview-content">
              <div class="homework-preview-sentence">${item.en || item.exampleSentence || ''}</div>
              <div class="homework-preview-translation">${item.ko || item.exampleSentenceKo || ''}</div>
            </div>
          </li>
        `).join('');
      } else {
        // Wordlist - show English words with Korean translation
        // Vocab files have: eng, kor, def, ex, ex_kor
        previewList.innerHTML = content.map((item, idx) => `
          <li>
            <span class="homework-preview-number">${idx + 1}.</span>
            <div class="homework-preview-content">
              <div class="homework-preview-word"><strong>${item.eng || ''}</strong> - ${item.kor || ''}</div>
              ${item.def ? `<div class="homework-preview-def">${item.def}</div>` : ''}
            </div>
          </li>
        `).join('');
      }
    } catch (error) {
      console.error('Error loading preview:', error);
      previewList.innerHTML = `<div class="homework-preview-error">Error loading content: ${error.message}</div>`;
    }
  }

  function closePreview() {
    const previewOverlay = document.getElementById('homeworkPreviewOverlay');
    if (previewOverlay) {
      previewOverlay.classList.remove('active');
    }
  }

  return {
    init,
    open,
    close
  };
})();

// Auto-init when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', HomeworkModal.init);
} else {
  HomeworkModal.init();
}

// Expose globally for main.js to call
window.HomeworkModal = HomeworkModal;
