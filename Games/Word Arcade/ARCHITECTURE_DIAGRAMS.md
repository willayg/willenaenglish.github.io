# Word Arcade Browser Back Button - Architecture Diagrams

## 1. State Machine Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                     WORD ARCADE STATE FLOW                          │
└─────────────────────────────────────────────────────────────────────┘

                    ┌──────────────────────┐
                    │   OPENING_MENU       │  (App Starts Here)
                    │  - Your Homework     │
                    │  - Word Games        │
                    │  - X3 Challenge      │
                    │  - Discover          │
                    └──────────────────────┘
                           │
                    Click "Word Games"
                           │
                           ▼
                    ┌──────────────────────┐
                    │   LEVELS_MENU        │  (Level Selection)
                    │  - Phonics           │
                    │  - Level 1           │
                    │  - Level 2           │
                    │  - Level 3           │
                    │  - Level 4 (soon)    │
                    │  - Level 5 (soon)    │
                    │  ← Back              │
                    └──────────────────────┘
                           │
                    Click Level 1, 2, 3, or Phonics
                           │
                           ▼
                    ┌──────────────────────┐
                    │   MODE_SELECTOR      │  (After Wordlist Loads)
                    │  - Meaning           │
                    │  - Listening         │
                    │  - Spelling          │
                    │  - Multi-Choice      │
                    │  - Picture           │
                    │  - Sentence          │
                    │  - Level Up          │
                    │  - Time Battle       │
                    └──────────────────────┘
                           │
                    Click a Game Mode
                           │
                           ▼
                    ┌──────────────────────┐
                    │     IN_GAME          │  (Playing Game)
                    │  - Question Display  │
                    │  - User Input        │
                    │  - Progress Bar      │
                    │  - Score/Timer       │
                    └──────────────────────┘
                           │
                  (Optional: Quit Button)
                           │
                           ▼
                    ┌──────────────────────┐
                    │   MODAL_OVERLAY      │  (Any Modal)
                    │  - Coming Soon       │
                    │  - Browse Games      │
                    │  - Phonics Selection │
                    │  - Level Selection   │
                    └──────────────────────┘


        ◄────── BROWSER BACK BUTTON (REVERSE ORDER) ──────
        ◄────── Or: ← Back UI button (where it exists) ────
```

---

## 2. State Stack Visualization

```
┌────────────────────────────────────────────────────────────────┐
│                   STATE STACK IN MEMORY                        │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Position 0:  { id: 'opening_menu', ... }  ← Oldest state    │
│  Position 1:  { id: 'levels_menu', ... }                     │
│  Position 2:  { id: 'mode_selector', ... }                   │
│  Position 3:  { id: 'in_game', ... }  ← Current state        │
│                                                                │
│  (Max 50 states)                                              │
│                                                                │
└────────────────────────────────────────────────────────────────┘

When Back Button Pressed:
  1. Remove Position 3 (in_game)
  2. Current becomes Position 2 (mode_selector)
  3. Restore that state
  4. Next back → Position 1 (levels_menu)
```

---

## 3. History Manager Flow

```
┌─────────────────────────────────────────────────────────────────┐
│              USER PRESSES BROWSER BACK BUTTON                   │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              Browser 'popstate' Event Fired                      │
│  window.addEventListener('popstate', handleBackButton)          │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│         HistoryManager.handleBackButton()                        │
│  - Set isBackNavigation = true (prevent duplicates)             │
│  - Get current state from stack                                 │
│  - Pop it from stack                                            │
│  - Get new current state                                        │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│         HistoryManager.restoreState(targetState)                │
│  - Match state.id against known state types                     │
│  - Route to appropriate restore function                        │
└─────────────────────────────────────────────────────────────────┘
                           │
            ┌──────────────┼──────────────┬─────────────────┐
            │              │              │                 │
            ▼              ▼              ▼                 ▼
    ┌───────────────┐ ┌──────────────┐ ┌────────────────┐ ┌──────────────┐
    │restore Opening│ │restore Levels│ │restore Mode    │ │restore Modal │
    │               │ │              │ │Selector        │ │              │
    │quitToOpening()│ │showLevels()  │ │startMode       │ │closeAllModals│
    │               │ │              │ │Selector()      │ │              │
    └───────────────┘ └──────────────┘ └────────────────┘ └──────────────┘
            │              │              │                 │
            └──────────────┴──────────────┴─────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│         App Returns to Previous State                            │
│  - UI updated with correct content                              │
│  - Audio/animations stopped                                     │
│  - Form inputs reset                                            │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
                    USER SEES PREVIOUS SCREEN
```

---

## 4. Integration Points in Code

```
┌─────────────────────────────────────────────────────────────┐
│                      MAIN.JS                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. IMPORT HISTORY MANAGER                                 │
│     import { historyManager } from './history-manager.js'  │
│                                                             │
│  2. INITIALIZE ON PAGE LOAD                                │
│     window.addEventListener('DOMContentLoaded', () => {    │
│       historyManager.init()  ← CALL THIS FIRST             │
│       ...                                                   │
│     })                                                      │
│                                                             │
│  3. TRACK LEVEL SELECTION                                  │
│     function showLevelsMenu() {                            │
│       historyManager.navigateToLevels()  ← TRACK HERE      │
│       ...                                                   │
│     }                                                       │
│                                                             │
│  4. TRACK MODE SELECTION                                   │
│     function startModeSelector() {                         │
│       historyManager.navigateToModeSelector(...)           │
│       ...                                                   │
│     }                                                       │
│                                                             │
│  5. TRACK GAME START                                       │
│     export async function startGame(mode) {               │
│       historyManager.navigateToGame(mode, ...)             │
│       ...                                                   │
│     }                                                       │
│                                                             │
│  6. TRACK QUIT TO OPENING                                  │
│     function quitToOpening(fully) {                        │
│       ...                                                   │
│       historyManager.navigateToOpening()                   │
│     }                                                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Browser History API Integration

```
┌──────────────────────────────────────────────────────────────┐
│               BROWSER HISTORY API CALLS                      │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  window.history.pushState(state, title, url)                │
│  ├─ state: { stateId, timestamp }                           │
│  ├─ title: "Word Arcade - [state-id]"                       │
│  └─ url: ".../#state-[id]-[timestamp]"                      │
│                                                              │
│  When User Clicks Back:                                      │
│  └─ Browser fires: window.addEventListener('popstate', ...) │
│                                                              │
│  URL in Browser:                                             │
│  └─ Changes to previous hash (visual indicator of back)      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 6. Memory Management

```
┌────────────────────────────────────────────────────────────┐
│           HISTORY STACK SIZE MANAGEMENT                    │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  MAX SIZE: 50 states                                      │
│                                                            │
│  When stack reaches 50 and new state added:               │
│                                                            │
│  BEFORE:                                                   │
│  [state0, state1, state2, ..., state49]  (50 items)       │
│                                                            │
│  ↓ User navigates (new state comes in)                    │
│                                                            │
│  AFTER:                                                    │
│  [state1, state2, ..., state49, new_state]  (50 items)    │
│                                                            │
│  ← oldest state removed automatically                     │
│                                                            │
│  Prevents: Memory leaks, performance issues               │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## 7. Modal Handling

```
┌─────────────────────────────────────────────────────────────┐
│              MODAL STATE RESTORATION                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. User in MODE_SELECTOR                                  │
│     └─ Stack: [..., mode_selector]                        │
│                                                             │
│  2. User opens modal (e.g., "Browse Games")               │
│     └─ Stack: [..., mode_selector, modal]                │
│                                                             │
│  3. User presses back button                               │
│     ├─ restoreModal() called                               │
│     ├─ closeAllModals() executes                           │
│     ├─ Modal closes                                        │
│     └─ Stack: [..., mode_selector]  ← restored            │
│                                                             │
│  4. User presses back again                                │
│     └─ Restores to state before modal was opened           │
│                                                             │
│                                                             │
│  Nested Modals (Modal A → Modal B):                        │
│                                                             │
│  Stack progression:                                         │
│  [... opening] →                                            │
│  [... opening, modal_A] →                                   │
│  [... opening, modal_A, modal_B]                            │
│                                                             │
│  Back presses:                                              │
│  Back 1: closes modal_B → shows modal_A                    │
│  Back 2: closes modal_A → shows opening_menu               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. Data Flow Diagram

```
    ┌─────────────────────┐
    │    User Action      │
    │ (Click button, etc) │
    └──────────┬──────────┘
               │
               ▼
    ┌──────────────────────────────┐
    │  Route Handler in Main.js    │
    │ (onClick, etc)               │
    └──────────┬───────────────────┘
               │
               ▼
    ┌──────────────────────────────┐
    │  Update App State            │
    │ (Load wordlist, etc)         │
    └──────────┬───────────────────┘
               │
               ▼
    ┌──────────────────────────────┐
    │  Call History Tracking       │
    │  historyManager.navigateTo...│
    └──────────┬───────────────────┘
               │
               ▼
    ┌──────────────────────────────┐
    │  HistoryManager              │
    │ • Add to state stack         │
    │ • Call history.pushState()   │
    │ • Update browser history     │
    └──────────┬───────────────────┘
               │
               ▼
    ┌──────────────────────────────┐
    │  Browser History Updated     │
    │  (URL hash changes)          │
    └──────────────────────────────┘


    ┌─────────────────────────────────────────┐
    │  REVERSE FLOW (Back Button Pressed)    │
    ├─────────────────────────────────────────┤
    │                                         │
    │  Browser 'popstate' event fired         │
    │         ↓                               │
    │  HistoryManager.handleBackButton()      │
    │         ↓                               │
    │  Get previous state from stack          │
    │         ↓                               │
    │  Call appropriate restore function      │
    │         ↓                               │
    │  Update UI to previous state            │
    │         ↓                               │
    │  User sees previous screen              │
    │                                         │
    └─────────────────────────────────────────┘
```

---

## 9. File Structure

```
Games/Word Arcade/
├── index.html                          (No changes)
├── main.js                             (5 integration points added)
│   ├── import historyManager ✓
│   ├── historyManager.init() ✓
│   ├── navigateToLevels() ✓
│   ├── navigateToModeSelector() ✓
│   ├── navigateToGame() ✓
│   └── navigateToOpening() ✓
│
├── history-manager.js                  (NEW - Core system)
│   ├── HistoryManager class
│   ├── State stack management
│   ├── popstate event handler
│   └── State restoration logic
│
├── BROWSER_BACK_BUTTON.md             (NEW - User documentation)
├── IMPLEMENTATION_SUMMARY.md          (NEW - Quick reference)
├── TROUBLESHOOTING.md                 (NEW - Debug guide)
├── MODAL_INTEGRATION_GUIDE.js         (NEW - Code examples)
│
├── tts.js                             (No changes)
├── sfx.js                             (No changes)
├── style.css                          (No changes)
├── ui/                                (No changes)
├── modes/                             (No changes)
└── ... (all other files unchanged)
```

---

## 10. Testing Flowchart

```
START TEST
    │
    ├─→ [Open App] → Should show Opening Menu
    │   └─ Stack size should be 1
    │
    ├─→ [Click Word Games] → Should show Levels Menu
    │   └─ Stack size should be 2
    │
    ├─→ [Click Level 1] → Should start loading
    │   └─ Stack size should increase to 3
    │
    ├─→ [Wait for wordlist] → Should show Mode Selector
    │   └─ Stack size should be 3
    │
    ├─→ [Click game mode] → Game should start
    │   └─ Stack size should be 4
    │
    ├─→ [Press Back Button] → Should return to Mode Selector
    │   └─ Stack size should be 3
    │
    ├─→ [Press Back Button] → Should return to Levels Menu
    │   └─ Stack size should be 2
    │
    ├─→ [Press Back Button] → Should return to Opening Menu
    │   └─ Stack size should be 1
    │
    └─→ [Press Back Button] → Should leave app (go to previous page)
        └─ This is expected browser behavior


IF ALL PASS → Implementation working correctly ✓
IF ANY FAIL → Check troubleshooting guide
```

---

**Last Updated**: October 27, 2025
