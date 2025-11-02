/**
 * History Manager for Word Arcade
 * 
 * Manages browser back button functionality by tracking app state transitions
 * and restoring previous states when users press the browser back button.
 * 
 * State hierarchy:
 * 1. Opening Menu (main)
 * 2. Levels Menu (levels) - opened from Word Games
 * 3. Mode Selection (mode_selector) - after choosing a level
 * 4. In-Game (game) - during gameplay
 * 5. Modals (modal) - any modal overlay
 */

class HistoryManager {
  constructor() {
    this.stateStack = []; // Stack of state objects
    this.isBackNavigation = false; // Flag to prevent double-processing
    this.maxHistorySize = 50; // Prevent memory issues
    
    // Bind methods to maintain 'this' context
    this.handleBackButton = this.handleBackButton.bind(this);
  }

  /**
   * Initialize the history manager
   * Must be called after app is ready but before any navigation
   */
  init() {
    // Listen for browser back/forward button presses
    window.addEventListener('popstate', this.handleBackButton);
    
    // Initialize with opening menu state
    this.pushState('opening_menu', { type: 'opening_menu' }, true);
    // Also seed the current browser entry so Back/Forward have a concrete state
    try {
      const initHistoryData = {
        stateId: 'opening_menu',
        timestamp: Date.now(),
        payload: { type: 'opening_menu' },
      };
      const url = `${window.location.pathname}#state-opening`;
      window.history.replaceState(initHistoryData, document.title, url);
    } catch (e) {
      console.warn('[HistoryManager] Failed to seed initial history state:', e);
    }
    
    console.log('[HistoryManager] Initialized');
  }

  /**
   * Push a new state onto the stack and update browser history
   * @param {string} id - Unique identifier for this state
   * @param {object} stateData - App state to restore if user goes back
   * @param {boolean} skipHistoryPush - If true, don't modify browser history (for init)
   */
  pushState(id, stateData = {}, skipHistoryPush = false) {
    // Prevent exceeding max size
    if (this.stateStack.length >= this.maxHistorySize) {
      this.stateStack.shift(); // Remove oldest state
    }

    const state = {
      id,
      timestamp: Date.now(),
      data: stateData,
      serialized: JSON.stringify(stateData), // For debug
    };

    this.stateStack.push(state);

    if (!skipHistoryPush) {
      // Add to browser history without reloading the page
      // Use a unique hash to force browser history entries
      const historyData = {
        stateId: id,
        timestamp: state.timestamp,
        payload: stateData, // carry underlyingState etc. for forward/back routing
      };

      const stateTitle = `Word Arcade - ${id}`;
      const url = `${window.location.pathname}#state-${id}-${state.timestamp}`;

      try {
        window.history.pushState(historyData, stateTitle, url);
      } catch (e) {
        console.warn('[HistoryManager] Failed to push state to browser history:', e);
      }
    }

    console.log(
      `[HistoryManager] Pushed state: ${id}`,
      `Stack size: ${this.stateStack.length}`,
      stateData
    );
  }

  /**
   * Handle browser back button press
   */
  async handleBackButton(event) {
    // event.state contains the data we passed to history.pushState for BOTH back and forward
    console.log('[HistoryManager] Back/Forward navigation', event.state);

    // Prevent reentrancy
    if (this.isBackNavigation) return;
    this.isBackNavigation = true;

    try {
      // Cancel any in-flight async work (audio preload, timers)
      try { window.WordArcade?.__abortInFlight?.(); } catch {}

      // Determine target state from browser history
      const navState = event.state || {};
      const targetId = navState.stateId || 'opening_menu';
      const payload = navState.payload || {};

      const target = { id: targetId, data: payload };
      console.log('[HistoryManager] Restoring state:', targetId, payload);
      await this.restoreState(target);
    } catch (e) {
      console.error('[HistoryManager] Error handling navigation:', e);
    } finally {
      this.isBackNavigation = false;
    }
  }

  /**
   * Restore app to a previous state
   * @param {object} state - The state object to restore
   */
  async restoreState(state) {
    // Get access to main app functions through window.WordArcade
    const app = window.WordArcade;
    if (!app) {
      console.warn('[HistoryManager] WordArcade app not found');
      return;
    }

    const { id, data } = state;

    // Route to appropriate restoration logic based on state type
    switch (id) {
      case 'opening_menu':
        this.restoreOpeningMenu(data);
        break;

      case 'levels_menu':
        this.restoreLevelsMenu(data);
        break;

      case 'mode_selector':
        this.restoreModeSelector(data);
        break;

      case 'in_game':
        this.restoreInGame(data);
        break;

      case 'modal':
        this.restoreModal(data);
        break;

      default:
        console.log('[HistoryManager] Unknown state type:', id);
        this.restoreOpeningMenu(data);
    }
  }

  /**
   * Restore to opening menu
   */
  restoreOpeningMenu(data) {
    // Close any modals
    this.closeAllModals();

    // Reset to opening menu via the exposed app API
    if (window.WordArcade?.quitToOpening) {
      window.WordArcade.quitToOpening(true);
    }

    console.log('[HistoryManager] Restored opening menu');
  }

  /**
   * Restore to levels menu
   */
  restoreLevelsMenu(data) {
    // Close any modals
    this.closeAllModals();

    // Show levels menu again
    if (window.WordArcade?.showLevelsMenu) {
      window.WordArcade.showLevelsMenu();
    }

    console.log('[HistoryManager] Restored levels menu');
  }

  /**
   * Restore to mode selector after a word list was chosen
   */
  restoreModeSelector(data) {
    // Close any modals
    this.closeAllModals();
    // Always re-open the mode selector for this target state. The browser
    // history order determines whether another Back lands on levels.
    if (window.WordArcade?.startModeSelector) {
      window.WordArcade.startModeSelector();
    }

    console.log('[HistoryManager] Restored mode selector');
  }

  /**
   * Restore to in-game state
   * This is complex since we can't resume mid-game, so we restart the game
   */
  restoreInGame(data) {
    // Cannot resume mid-game; route back to the appropriate mode selector
    const app = window.WordArcade;
    if (window.__WA_IS_GRAMMAR__ && typeof app?.startGrammarModeSelector === 'function') {
      app.startGrammarModeSelector();
      console.log('[HistoryManager] Restored to grammar mode selector');
      return;
    }
    if (app?.startModeSelector) {
      app.startModeSelector();
      console.log('[HistoryManager] Restored to word mode selector');
      return;
    }
    // Fallback: opening menu
    this.restoreOpeningMenu(data);
  }

  /**
   * Restore by closing a modal
   */
  restoreModal(data) {
    const { modalType } = data;
    this.closeAllModals();

    // Depending on what modal was open, restore the underlying state
    if (data.underlyingState) {
      // Recursively restore the underlying state
      const underlying = {
        id: data.underlyingState,
        data: {},
      };
      this.restoreState(underlying);
    }

    console.log('[HistoryManager] Restored by closing modal:', modalType);
  }

  /**
   * Close all visible modals
   */
  closeAllModals() {
    // List of common modal IDs in the app
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
      'wa_toast_host', // toast messages
    ];

    modalIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el && el.style) {
        // Hide the modal but do not poison it with persistent visibility/pointer-events
        el.style.display = 'none';
        // Clean any previous inline properties that might block reopening
        try {
          el.style.removeProperty('visibility');
          el.style.removeProperty('pointer-events');
          el.style.removeProperty('opacity');
        } catch {}
      }
    });

    // Also close any backdrop overlays
    const overlays = document.querySelectorAll('[style*="z-index"][style*="background"]');
    overlays.forEach((el) => {
      if (el && el.style && el.textContent.trim() === '') {
        // Only hide empty overlay divs
        el.style.display = 'none';
      }
    });
  }

  /**
   * Record navigation to opening menu
   */
  navigateToOpening() {
    this.pushState('opening_menu', { type: 'opening_menu' });
  }

  /**
   * Record navigation to levels menu
   */
  navigateToLevels() {
    this.pushState('levels_menu', { type: 'levels_menu' });
  }

  /**
   * Record navigation to mode selector
   */
  navigateToModeSelector(info = {}) {
    const { underlyingState = 'opening_menu', ...wordListInfo } = info || {};
    this.pushState('mode_selector', {
      type: 'mode_selector',
      wordListInfo,
      underlyingState,
    });
  }

  /**
   * Record entering a game
   */
  navigateToGame(gameMode, wordListInfo = {}) {
    this.pushState('in_game', {
      type: 'in_game',
      mode: gameMode,
      wordListInfo,
    });
  }

  /**
   * Record opening a modal
   */
  navigateToModal(modalType, underlyingState = 'mode_selector') {
    this.pushState('modal', {
      type: 'modal',
      modalType,
      underlyingState,
    });
  }

  /**
   * Get current state
   */
  getCurrentState() {
    return this.stateStack[this.stateStack.length - 1] || null;
  }

  /**
   * Get the entire stack (for debugging)
   */
  getStack() {
    return this.stateStack;
  }

  /**
   * Clear the history stack (for emergency reset)
   */
  clear() {
    this.stateStack = [];
    this.pushState('opening_menu', { type: 'opening_menu' }, true);
    console.log('[HistoryManager] Stack cleared, reset to opening menu');
  }

  /**
   * Destroy and clean up
   */
  destroy() {
    window.removeEventListener('popstate', this.handleBackButton);
    this.stateStack = [];
  }
}

// Export as singleton
export const historyManager = new HistoryManager();
