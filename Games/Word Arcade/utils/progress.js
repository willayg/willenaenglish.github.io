// Progress utility functions that work in both main Word Arcade and live play contexts
// Falls back to no-op when main.js functions aren't available

let progressFunctions = null;

// Try to import from main.js, but fall back to no-ops if not available
async function getProgressFunctions() {
  if (progressFunctions) return progressFunctions;
  
  try {
    // Try to import from main.js if we're in the main context
    const main = await import('../main.js');
    progressFunctions = {
      showGameProgress: main.showGameProgress,
      updateGameProgress: main.updateGameProgress,
      hideGameProgress: main.hideGameProgress
    };
  } catch (e) {
    // Fall back to no-op functions for live play context
    console.log('[Progress] Using fallback progress functions (live play context)');
    progressFunctions = {
      showGameProgress: () => {},
      updateGameProgress: () => {},
      hideGameProgress: () => {}
    };
  }
  
  return progressFunctions;
}

export async function showGameProgress(total, current = 0) {
  const funcs = await getProgressFunctions();
  return funcs.showGameProgress(total, current);
}

export async function updateGameProgress(current, total) {
  const funcs = await getProgressFunctions();
  return funcs.updateGameProgress(current, total);
}

export async function hideGameProgress() {
  const funcs = await getProgressFunctions();
  return funcs.hideGameProgress();
}

// Synchronous versions that can be called directly (preferred for cleaner code)
export function showGameProgressSync(total, current = 0) {
  if (progressFunctions) {
    progressFunctions.showGameProgress(total, current);
  } else {
    // Queue for when functions become available
    getProgressFunctions().then(funcs => funcs.showGameProgress(total, current));
  }
}

export function updateGameProgressSync(current, total) {
  if (progressFunctions) {
    progressFunctions.updateGameProgress(current, total);
  } else {
    getProgressFunctions().then(funcs => funcs.updateGameProgress(current, total));
  }
}

export function hideGameProgressSync() {
  if (progressFunctions) {
    progressFunctions.hideGameProgress();
  } else {
    getProgressFunctions().then(funcs => funcs.hideGameProgress());
  }
}

// Initialize progress functions early
getProgressFunctions();