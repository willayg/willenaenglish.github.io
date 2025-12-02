# Game Builder Refactoring Plan

## Current State Analysis
**File:** `main.js` - **2,334 lines** (monolithic)

### Problems Identified
1. ❌ **Single massive file** - Hard to navigate and maintain
2. ❌ **Mixed concerns** - UI, state, networking, AI generation, audio, storage all in one file
3. ❌ **Redundant logic** - Multiple similar modal handlers, duplicate validation
4. ❌ **Hard-coded dependencies** - Direct DOM manipulation scattered throughout
5. ❌ **No clear separation** - Business logic mixed with UI rendering
6. ❌ **Large function blocks** - Some functions exceed 100+ lines
7. ❌ **Global state pollution** - Many module-level variables

### Current File Structure
```
Teachers/tools/game-builder/
├── main.js (2,334 lines) ⚠️
├── images.js (image search/upload)
├── MintAi-list-builder.js (AI generation)
├── create-game-modal.js (1,048 lines) ⚠️
└── styles.css
```

---

## Refactoring Strategy

### Phase 1: Extract Core Utilities (Low Risk)
**Goal:** Create shared utility modules with no dependencies

#### 1.1 Create `utils/dom-helpers.js` (~100 lines)
Extract DOM manipulation utilities:
```javascript
export function escapeHtml(str)
export function toast(msg, statusEl)
export function showTinyToast(msg, options)
export function ensureLoadingOverlay()
export function buildSkeletonHTML(count)
```
**Benefits:** Reusable across all modules, easier to test

#### 1.2 Create `utils/network.js` (~80 lines)
Extract network utilities:
```javascript
export async function fetchJSONSafe(url, init, opts)
export async function timedJSONFetch(label, url, init)
export function recordPerfSample(sample)
export function isLocalHost()
```
**Benefits:** Centralized error handling, performance tracking

#### 1.3 Create `utils/validation.js` (~50 lines)
Extract validation and text processing:
```javascript
export function cleanDefinitionResponse(text)
export function escapeRegExp(str)
export function normalizeForKey(str)
```
**Benefits:** Single source of truth for validation rules

---

### Phase 2: Extract State Management (Medium Risk)
**Goal:** Centralize application state with clear APIs

#### 2.1 Create `state/game-state.js` (~200 lines)
Manage the word list and game metadata:
```javascript
export class GameState {
  constructor()
  
  // Word list operations
  getList()
  setList(newList)
  addWord(wordData)
  removeWord(index)
  updateWord(index, field, value)
  
  // Metadata
  getTitle()
  setTitle(title)
  getCurrentGameId()
  setCurrentGameId(id)
  
  // Undo/Redo
  saveSnapshot()
  undo()
  redo()
  canUndo()
  canRedo()
  
  // Payload building
  buildPayload()
  buildRow(data)
}
```
**Benefits:** Testable state logic, undo/redo isolated, clear API

#### 2.2 Create `state/cache-manager.js` (~150 lines)
Manage all caching logic:
```javascript
export class CacheManager {
  constructor(key, options)
  
  get(key)
  set(key, value)
  invalidate(key)
  getSessionCache()
  getPersistentCache()
  setSessionCache(data)
  setPersistentCache(data)
  isStale(timestamp, maxAgeMs)
}
```
**Benefits:** Single cache strategy, easier to debug cache issues

---

### Phase 3: Extract AI & Content Generation (Medium Risk)
**Goal:** Isolate AI-powered features

#### 3.1 Create `services/ai-service.js` (~250 lines)
Consolidate all OpenAI/AI operations:
```javascript
export class AIService {
  async generateDefinition(word, koreanTranslation)
  async generateExample(word, definition)
  async generateTranslations(words)
  async generateDefinitionsForList(list)
  async generateExamplesForList(list)
  
  // Private helpers
  _callOpenAI(prompt)
  _cleanDefinition(text)
  _cleanExample(text)
}
```
**Benefits:** Easy to swap AI providers, rate limiting in one place

#### 3.2 Create `services/audio-service.js` (~300 lines)
Move audio generation logic (currently scattered):
```javascript
export class AudioService {
  async ensureAudioForWords(words, options)
  async checkExistingAudio(keys)
  async generateAudio(text, voiceId)
  async uploadAudio(key, audioBase64)
  
  // Configuration
  isLocalHost()
  getPreferredVoice()
  setPreferredVoice(voiceId)
}
```
**Benefits:** Centralized TTS logic, easier to add voice options

---

### Phase 4: Extract File Operations (Medium Risk)
**Goal:** Separate file/worksheet loading and saving

#### 4.1 Create `services/file-service.js` (~400 lines)
Handle all file operations:
```javascript
export class FileService {
  async loadGameList(options)
  async loadGame(gameId)
  async saveGame(payload, gameId)
  async deleteGame(gameId)
  async deleteGames(gameIds)
  
  // Worksheet operations
  async importWorksheet(worksheetData)
  async exportToWorksheet(gameData)
  
  // Helper methods
  async checkExistingGame(title, userId)
  async prepareAndUploadImages(payload, gameId, options)
}
```
**Benefits:** Consistent save/load logic, batch operations easier

#### 4.2 Create `services/user-service.js` (~80 lines)
User authentication and identification:
```javascript
export class UserService {
  async getCurrentUserId()
  async bootstrapUserId()
  async whoAmI()
  
  // Storage helpers
  getUserIdFromStorage()
  setUserIdInStorage(userId)
}
```
**Benefits:** Centralized auth logic, easier to add SSO later

---

### Phase 5: Extract UI Components (High Risk)
**Goal:** Component-based UI architecture

#### 5.1 Create `components/word-table.js` (~300 lines)
Word list table rendering and editing:
```javascript
export class WordTable {
  constructor(containerEl, gameState, options)
  
  render()
  bindEvents()
  updateRow(index)
  addRow()
  removeRow(index)
  
  // Event handlers
  onWordChange(callback)
  onRowDelete(callback)
  onImageDrop(callback)
}
```

#### 5.2 Create `components/edit-list-modal.js` (~120 lines)
Extract edit list modal:
```javascript
export class EditListModal {
  constructor(gameState)
  
  show()
  hide()
  populateFromList()
  parseAndUpdateList()
}
```

#### 5.3 Create `components/file-list-modal.js` (~500 lines)
Extract saved games modal (currently ~800 lines in main.js):
```javascript
export class FileListModal {
  constructor(fileService, gameState)
  
  show()
  hide()
  loadList(offset, limit)
  renderList(items)
  setupFilters()
  setupBatchDelete()
  
  // Event handlers
  onGameOpen(callback)
  onGameDelete(callback)
}
```

#### 5.4 Create `components/save-modal.js` (~200 lines)
Extract save/save-as modal:
```javascript
export class SaveModal {
  constructor(fileService, gameState, audioService)
  
  show(mode) // 'save' or 'save-as'
  hide()
  validate()
  handleSave()
  handleOverwrite()
  
  // Audio options
  showAudioOptions()
  getAudioPreferences()
}
```

---

### Phase 6: Main Entry Point Refactoring (Final Phase)
**Goal:** Thin orchestration layer

#### 6.1 Create `main.js` (New, ~300 lines max)
Orchestrate all modules:
```javascript
import { GameState } from './state/game-state.js';
import { AIService } from './services/ai-service.js';
import { FileService } from './services/file-service.js';
import { AudioService } from './services/audio-service.js';
import { WordTable } from './components/word-table.js';
import { FileListModal } from './components/file-list-modal.js';
import { SaveModal } from './components/save-modal.js';
import { EditListModal } from './components/edit-list-modal.js';

// Initialize services
const gameState = new GameState();
const aiService = new AIService();
const fileService = new FileService();
const audioService = new AudioService();

// Initialize components
const wordTable = new WordTable(document.getElementById('rows'), gameState);
const fileListModal = new FileListModal(fileService, gameState);
const saveModal = new SaveModal(fileService, gameState, audioService);
const editListModal = new EditListModal(gameState);

// Wire up toolbar actions
setupToolbar();
setupKeyboardShortcuts();
setupAutoSave();

// Bootstrap
async function init() {
  await userService.bootstrapUserId();
  wordTable.render();
  setupImportFromWordBuilder();
}

init();
```

---

## Implementation Order (Safest to Riskiest)

### Week 1: Foundation
- [ ] Create `utils/` modules (dom-helpers, network, validation)
- [ ] Update main.js to import and use utilities
- [ ] Test all existing functionality
- [ ] **No breaking changes**

### Week 2: State Layer
- [ ] Create `state/game-state.js`
- [ ] Create `state/cache-manager.js`
- [ ] Migrate main.js to use GameState
- [ ] Test undo/redo extensively

### Week 3: Services
- [ ] Create `services/ai-service.js`
- [ ] Create `services/audio-service.js`
- [ ] Create `services/user-service.js`
- [ ] Migrate AI calls to AIService

### Week 4: File Operations
- [ ] Create `services/file-service.js`
- [ ] Migrate save/load logic
- [ ] Test with real games and worksheets

### Week 5: UI Components
- [ ] Create `components/word-table.js`
- [ ] Create smaller modal components
- [ ] Test each component in isolation

### Week 6: Final Integration
- [ ] Refactor main.js into thin orchestrator
- [ ] Remove all dead code
- [ ] Final testing and optimization

---

## Code Reduction Estimates

| Module | Current Lines | Target Lines | Reduction |
|--------|--------------|--------------|-----------|
| main.js | 2,334 | 300 | **-87%** |
| utils/* | 0 | 230 | +230 |
| state/* | 0 | 350 | +350 |
| services/* | 0 | 630 | +630 |
| components/* | 0 | 1,120 | +1,120 |
| **Total** | **2,334** | **2,630** | **+296** |

### Net Result
- **Lines added:** +2,330 (new modular structure)
- **Lines removed:** -2,034 (from main.js)
- **Net increase:** +296 lines (12% more code for **much** better maintainability)

---

## Redundancy Elimination Targets

### 1. **Duplicate Modal Handlers** (Save ~80 lines)
- Multiple `onclick` handlers for modal close buttons
- Repeated backdrop-click-to-close logic
- **Solution:** Create `BaseModal` class with common behavior

### 2. **Duplicate Network Calls** (Save ~50 lines)
- Multiple places checking `isLocalHost()` and trying multiple endpoints
- Repeated retry logic
- **Solution:** Centralize in `network.js` with endpoint resolution

### 3. **Duplicate Validation** (Save ~40 lines)
- Similar title/word validation in multiple places
- Repeated empty-check patterns
- **Solution:** Create validation functions in `validation.js`

### 4. **Duplicate Image URL Normalization** (Save ~60 lines)
- R2 URL rewriting scattered throughout
- Multiple regex patterns for same thing
- **Solution:** Single normalization function in `images.js`

### 5. **Duplicate OpenAI Prompts** (Save ~30 lines)
- Similar prompt construction for definitions and examples
- Repeated response cleaning
- **Solution:** Template functions in `ai-service.js`

**Total Redundancy Savings: ~260 lines**

---

## Testing Strategy

### Unit Tests (New)
```javascript
// utils/dom-helpers.test.js
test('escapeHtml prevents XSS', () => { ... });

// state/game-state.test.js
test('undo/redo maintains history correctly', () => { ... });

// services/ai-service.test.js
test('cleanDefinition removes conversational fluff', () => { ... });
```

### Integration Tests
```javascript
// Test save → load → edit → save cycle
// Test undo → edit → redo logic
// Test image upload → game save → reload
```

### Manual Testing Checklist
- [ ] Create new game from scratch
- [ ] Import from worksheet manager
- [ ] Save and reload game
- [ ] Use undo/redo multiple times
- [ ] Generate AI definitions/examples
- [ ] Upload custom images
- [ ] Create live game
- [ ] Test on mobile viewport

---

## Migration Safety Net

### Rollback Strategy
1. **Keep original `main.js` as `main.legacy.js`**
2. Use feature flags to switch between old/new code paths
3. A/B test with small user group first

### Gradual Migration
```javascript
// Allow both old and new state management simultaneously
const USE_NEW_STATE = localStorage.getItem('gb_beta_mode') === '1';
const state = USE_NEW_STATE ? new GameState() : legacyStateObject;
```

---

## Success Metrics

### Code Quality
- ✅ Main file under 500 lines
- ✅ No function over 50 lines
- ✅ Each module has single responsibility
- ✅ 80%+ test coverage on services

### Performance
- ✅ Initial load time unchanged or faster
- ✅ Render performance maintained
- ✅ Bundle size increase < 10%

### Developer Experience
- ✅ New features take 50% less time to add
- ✅ Bugs easier to locate and fix
- ✅ Onboarding time for new developers cut in half

---

## Next Steps

1. **Review this plan** with team
2. **Create feature branch** `refactor/modularize-game-builder`
3. **Start with Week 1 tasks** (utils extraction)
4. **Commit after each working module**
5. **Test continuously** - never break existing functionality

---

## Questions to Resolve

1. **Bundle strategy:** Use bundler (Vite/Webpack) or keep ES modules?
2. **TypeScript migration:** Do this refactor simultaneously or after?
3. **Framework consideration:** Stay vanilla JS or migrate to Lit/Svelte later?
4. **Backward compatibility:** Support importing old saved games?

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Breaking existing games | Medium | High | Extensive testing, gradual rollout |
| Performance regression | Low | Medium | Performance monitoring, benchmarking |
| Scope creep | High | Medium | Stick to plan, no feature additions |
| User disruption | Low | High | Beta flag, easy rollback path |

**Overall Risk Level: Medium** ✅ Manageable with proper planning and testing
