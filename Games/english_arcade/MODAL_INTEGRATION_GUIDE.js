/**
 * Modal Integration Guide for History Manager
 * 
 * If you create new modals or want to enhance modal history tracking,
 * follow these patterns:
 */

// ============================================================================
// PATTERN 1: Simple Modal - Auto-Close on Back
// ============================================================================
// For modals that are just overlays (like Coming Soon), they automatically
// close when user presses back. No additional code needed.

// Example: In your modal show function
function showMyNewModal() {
  const modal = document.getElementById('myNewModal');
  modal.style.display = 'flex';
  
  // Optional: Track that a modal opened
  // historyManager.navigateToModal('myNewModal', 'mode_selector');
  
  const closeBtn = modal.querySelector('.close-btn');
  closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
    // User manually closed - don't call historyManager.handleBackButton
  });
}


// ============================================================================
// PATTERN 2: Modal with History Awareness
// ============================================================================
// For modals that should be part of history (user expects back button behavior)

function showMyComplexModal() {
  const modal = document.getElementById('myComplexModal');
  modal.style.display = 'flex';
  
  // Track this modal in history
  const currentState = historyManager.getCurrentState();
  const underlyingState = currentState?.id || 'mode_selector';
  historyManager.navigateToModal('myComplexModal', underlyingState);
  
  const closeBtn = modal.querySelector('.close-btn');
  closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
  });
}


// ============================================================================
// PATTERN 3: Cascading Modals (Modal opens another modal)
// ============================================================================
// If you have modals that open other modals

function showFirstModal() {
  historyManager.navigateToModal('firstModal', 'mode_selector');
  document.getElementById('firstModal').style.display = 'flex';
}

function showSecondModalFromFirst() {
  // Back button will close second modal and return to first modal
  historyManager.navigateToModal('secondModal', 'firstModal');
  document.getElementById('secondModal').style.display = 'flex';
}


// ============================================================================
// PATTERN 4: Modal with Confirmation (Before Closing)
// ============================================================================
// For modals that need to confirm before closing

function showModalWithConfirm() {
  const modal = document.getElementById('myModal');
  modal.style.display = 'flex';
  historyManager.navigateToModal('myModal', 'mode_selector');
  
  const backBtn = modal.querySelector('.back-btn');
  backBtn.addEventListener('click', (e) => {
    e.preventDefault();
    
    // Show confirmation
    if (confirm('Are you sure? Your progress will be lost.')) {
      modal.style.display = 'none';
      // Simulate pressing back button
      window.history.back();
    }
  });
}


// ============================================================================
// PATTERN 5: Modal That Selects and Navigates
// ============================================================================
// For modals that lead to new states (like level or game selection)

function showLevelSelectionModal() {
  const modal = document.getElementById('levelModal');
  modal.style.display = 'flex';
  historyManager.navigateToModal('levelModal', 'opening_menu');
  
  const buttons = modal.querySelectorAll('.level-btn');
  buttons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const levelId = btn.dataset.level;
      modal.style.display = 'none';
      
      // Load level and transition to next state
      // This will automatically push a new history state
      loadLevel(levelId);
    });
  });
}


// ============================================================================
// ADDING NEW MODAL CLOSING TO HISTORY MANAGER
// ============================================================================
// If you want to explicitly handle modal closure in history manager,
// update the closeAllModals() function in history-manager.js:

/*

  closeAllModals() {
    const modalIds = [
      'comingSoonModal',
      'modalOverlay',
      'modeModal',
      'sampleWordlistModal',
      'browseModal',
      'phonicsModal',
      'level2Modal',
      'level3Modal',
      'reviewSelectionModal',
      'myNewModal',          // ← ADD YOUR NEW MODAL HERE
      'myComplexModal',      // ← ADD YOUR NEW MODAL HERE
      'wa_toast_host',
    ];
    // ... rest of function
  }

*/


// ============================================================================
// TRACKING MODAL INTERACTIONS
// ============================================================================
// To track when modals are opened for analytics or debugging:

// In history-manager.js, in the restoreModal() method:
/*

  restoreModal(data) {
    const { modalType } = data;
    console.log('[HistoryManager] Modal closed:', modalType, 'via back button');
    
    // Track event for analytics if needed
    if (window.trackEvent) {
      window.trackEvent('modal_closed_via_back', { modalType });
    }
    
    this.closeAllModals();
    // ... rest of function
  }

*/


// ============================================================================
// TESTING NEW MODALS
// ============================================================================
/*

Test checklist for new modals:

1. Open modal
   → Console: Check for "Pushed state: modal"
   → Browser history: Check URL has #state- hash

2. Close modal normally (click X button)
   → Modal should disappear
   → History stack remains (ready for back button)

3. Press back button while modal open
   → Modal should disappear
   → Should return to previous state
   → Console: Check for "Restored state: [previous]"

4. Cascade test (if multiple modals):
   → Open Modal A
   → From Modal A, open Modal B
   → Press back → Should see Modal A again (not skip to state before Modal A)
   → Press back again → Should go to state before modals

5. Rapid back button presses
   → Should navigate smoothly without errors
   → Should never get stuck or crash

6. Mobile test
   → Test back gesture on iOS
   → Test back gesture on Android
   → Test browser back button on tablet

*/


// ============================================================================
// EXAMPLE: Complete Modal Implementation with History
// ============================================================================

export function showNewFeatureModal(options = {}) {
  const { onConfirm = () => {}, onCancel = () => {} } = options;
  
  // Create/get modal element
  let modal = document.getElementById('newFeatureModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'newFeatureModal';
    modal.style.cssText = `
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0,0,0,0.5);
      z-index: 9998;
      align-items: center;
      justify-content: center;
    `;
    
    const content = document.createElement('div');
    content.style.cssText = `
      background: white;
      padding: 30px;
      border-radius: 12px;
      max-width: 400px;
    `;
    content.innerHTML = `
      <h2>New Feature</h2>
      <p>Description of feature...</p>
      <div style="display: flex; gap: 10px; justify-content: flex-end;">
        <button id="newFeatureCancel">Cancel</button>
        <button id="newFeatureConfirm">OK</button>
      </div>
    `;
    
    modal.appendChild(content);
    document.body.appendChild(modal);
  }
  
  // Show modal
  modal.style.display = 'flex';
  
  // Get current state for history
  const currentState = window.WordArcade?.historyManager?.getCurrentState();
  const underlyingState = currentState?.id || 'mode_selector';
  
  // Record in history
  if (window.WordArcade?.historyManager) {
    window.WordArcade.historyManager.navigateToModal('newFeatureModal', underlyingState);
  }
  
  // Set up buttons
  const confirmBtn = document.getElementById('newFeatureConfirm');
  const cancelBtn = document.getElementById('newFeatureCancel');
  
  // Remove old listeners by cloning
  const newConfirmBtn = confirmBtn.cloneNode(true);
  const newCancelBtn = cancelBtn.cloneNode(true);
  confirmBtn.replaceWith(newConfirmBtn);
  cancelBtn.replaceWith(newCancelBtn);
  
  // Add new listeners
  newConfirmBtn.addEventListener('click', () => {
    modal.style.display = 'none';
    onConfirm();
  });
  
  newCancelBtn.addEventListener('click', () => {
    modal.style.display = 'none';
    onCancel();
    // Back button will handle history restoration
  });
}
