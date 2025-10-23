# Word Arcade - Complete Architecture Overview

## High-Level Flow

Word Arcade is an interactive English learning game platform where students solve vocabulary challenges in multiple game modes using pre-built word lists. The app is built as a modular ES module system with lazy-loaded game modes.

```
User Login → Opening Page → Choose Mode → Load Wordlist → Play Game → Track Progress
```

---

## 1. Core Architecture

### Entry Point: `main.js`
The main orchestrator that:
- Manages app state (current wordlist, current mode, game area DOM)
- Handles user authentication & session management
- Routes between opening page, mode selection, and game modes
- Manages audio preloading and preparation
- Handles progress tracking and quitting

### App State Variables
```javascript
let wordList = [];              // Current loaded words array
let currentMode = null;         // Currently active game mode (e.g., 'picture', 'spelling')
let currentListName = null;     // Name of current wordlist file
let currentPreloadAbort = null; // Controller to abort mid-flight audio preload
let activeModeCleanup = null;   // Cleanup function from active mode
```

---

## 2. Wordlist System

### Wordlist Data Format
Each word object has this structure:
```json
{
  "eng": "speak",              // English word (required)
  "kor": "말하다",             // Korean translation (required)
  "def": "to say words aloud", // Definition (optional)
  "ex": "He speaks loudly.",   // Example sentence (optional)
  "img": "https://...",        // Image URL (optional, gets normalized)
  "emoji": "🗣️"               // Emoji alternative to image (optional)
}
```

### Wordlist Sources

#### 1. **Sample Wordlists** (Static JSON files)
Located in two directories:
- `Games/Word Arcade/sample-wordlists/` (Level 1 - Basic)
- `Games/Word Arcade/sample-wordlists-level2/` (Level 2 - Advanced)

Examples:
- `sample-wordlists/Animals2.json`
- `sample-wordlists/Food1.json`
- `sample-wordlists-level2/Verbs4.json`
- `sample-wordlists-level2/ArtCulture.json`

#### 2. **Teacher Assignments** (Backend)
Teachers can assign specific wordlists via the student dashboard. Fetched from:
- `/.netlify/functions/student_assignments` - returns teacher's custom wordlists

#### 3. **Review Lists** (Generated from Progress)
The system intelligently creates review sessions from:
- `/.netlify/functions/progress_summary?section=challenging` - words student struggled with
- `/.netlify/functions/progress_summary?section=challenging_v2` - new algorithm (preferred)

Data is sanitized, with Hangul/Latin detection to ensure proper eng/kor alignment.

#### 4. **Browse/Discover Lists** (From Backend)
- `/.netlify/functions/browse_wordlists` - returns available public wordlists
- Lists include metadata: name, image, word count, difficulty

### Loading Wordlists

#### Function: `loadSampleWordlistByFilename(filename, options)`

1. **Resolve filename** - handles spaces vs underscores/hyphens
   ```javascript
   const candidates = [filename];
   if (filename.includes(' ')) {
     candidates.push(filename.replace(/\s+/g, '_'));  // "My List" → "My_List"
     candidates.push(filename.replace(/\s+/g, '-'));  // "My List" → "My-List"
   }
   ```

2. **Build URL** - prepends folder path if needed
   ```javascript
   const path = cand.includes('/') ? `./${cand}` : `./sample-wordlists/${cand}`;
   ```

3. **Fetch & Parse**
   ```javascript
   const res = await fetch(url.href, { cache: 'no-store' });
   const data = await res.json();
   ```

4. **Process wordlist** - calls `processWordlist(data)`

---

## 3. Wordlist Processing Pipeline

### Function: `processWordlist(data)`

1. **Validate** - ensure array with words
   ```javascript
   wordList = Array.isArray(data) ? data : [];
   if (!wordList.length) throw new Error('No words provided');
   ```

2. **Normalize Images** - handles legacy URL prefixes
   ```javascript
   normalizeWordImages(wordList);
   // Strips invalid /images/ prefixes from R2 CDN URLs
   // Converts relative paths to absolute if R2_PUBLIC_BASE available
   ```

3. **Save Session State** - persist to sessionStorage
   ```javascript
   sessionStorage.setItem('WA_words', JSON.stringify(wordList));
   sessionStorage.setItem('WA_list_name', currentListName);
   ```

4. **Preload Audio** - async prepare all word audio files
   ```javascript
   const summary = await preloadAllAudio(wordList, progressCallback);
   // Checks cache, generates TTS if missing
   // Returns: { missing: [words without audio], ... }
   ```

5. **Show Start Screen** - "Ready! All words loaded"

6. **Start Mode Selector** - let student pick game mode

### Image Normalization: `normalizeImageUrl(raw, base)`

Fixes various image URL issues:
- Strips legacy `/images/` prefix from R2 CDN URLs
- Converts relative paths to absolute using R2_PUBLIC_BASE
- Preserves data URIs and Netlify proxy URLs as-is
- Updates all image field variants: `img`, `image_url`, `image`, `picture`

---

## 4. Audio System

### Audio Loading: `tts.js`

The app preloads audio for all words before game starts to ensure smooth playback.

#### Process
1. **Check Cache** - look for existing audio files (IndexedDB or HTTP cache)
2. **Generate Missing** - call Netlify function to generate TTS for missing words
3. **Load All** - fetch audio files into memory

#### API Endpoints
- `/.netlify/functions/generate_audio` - create TTS audio files
- Audio stored on S3/R2 CDN with cache headers
- Fallback: if generation fails, game continues (audio simply unavailable)

#### Usage in Games
```javascript
import { playTTS } from './tts.js';
playTTS('word', language); // language: 'en' or 'ko'
```

---

## 5. Game Modes Architecture

### Mode Lazy Loading
Modes are loaded on-demand only when selected to reduce initial page size:

```javascript
const modeLoaders = {
  meaning:         () => import('./modes/meaning.js').then(m => m.runMeaningMode),
  spelling:        () => import('./modes/spelling.js').then(m => m.runSpellingMode),
  listening:       () => import('./modes/listening.js').then(m => m.runListeningMode),
  picture:         () => import('./modes/picture.js').then(m => m.runPictureMode),
  easy_picture:    () => import('./modes/easy_picture.js').then(m => m.runEasyPictureMode),
  listen_and_spell:() => import('./modes/listen_and_spell.js').then(m => m.runListenAndSpellMode),
  multi_choice:    () => import('./modes/multi_choice.js').then(m => m.runMultiChoiceMode),
  level_up:        () => import('./modes/level_up.js').then(m => m.runLevelUpMode),
  time_battle:     () => import('./modes/time_battle.js').then(m => m.run),
  // ... more modes
};
```

### Mode Runner Pattern
Each mode exports an async function with signature:
```javascript
export async function runModeNameMode({ 
  wordList,        // Array of word objects
  gameArea,        // DOM element to render into
  startGame,       // Callback when game starts
  listName = null  // Name of current wordlist
}) {
  // 1. Validate wordList
  // 2. Set up session tracking (startSession)
  // 3. Render UI
  // 4. Handle interactions
  // 5. Log attempts (logAttempt)
  // 6. End session (endSession)
}
```

### Available Modes (in `/modes/`)
| Mode | Description | Input Type |
|------|-------------|-----------|
| `picture.js` | Show image/emoji, pick English word | Multiple choice |
| `meaning.js` | Show definition, pick word | Multiple choice |
| `spelling.js` | Hear pronunciation, type word | Text input |
| `listening.js` | Hear English, pick meaning | Multiple choice |
| `multi_choice.js` | Various multiple-choice formats | MC |
| `listen_and_spell.js` | Hear Korean, type English | Text input |
| `level_up.js` | Progressive difficulty | MC |
| `time_battle.js` | Timed speed challenge | MC |
| `phonics_*.js` | Phonics-specific modes | Various |

---

## 6. Progress Tracking & Session Recording

### Session Lifecycle

#### Start Session: `startSession()`
Called at game start from `students/records.js`:
```javascript
const sessionId = startSession({ 
  mode: 'picture', 
  wordList, 
  listName 
});
```
Returns: UUID for this game session

#### Log Attempt: `logAttempt()`
Called for each question answered:
```javascript
await logAttempt({
  sessionId,
  word: wordObj,
  mode: 'picture',
  isCorrect: true/false,
  timing: msElapsed,
  audioUsed: boolean,
  // ... mode-specific data
});
```
Sends to `/.netlify/functions/log_word_attempt`

#### End Session: `endSession()`
Called when game finishes:
```javascript
await endSession(sessionId, { 
  totalScore: 85,
  totalTime: 1200000,
  // ... summary
});
```

### Backend Recording
- API: `/.netlify/functions/log_word_attempt`
- Table: `student_word_attempts` in Supabase
- Tracks: word, mode, correctness, timing, date/time
- Used to build review lists and progress reports

---

## 7. UI Structure

### Entry Page: `index.html`
```
┌─────────────────────────────────────┐
│  Student Header                     │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────┐  ┌─────────┐          │
│  │Your     │  │Word     │          │
│  │Homework │  │Games    │          │
│  └─────────┘  └─────────┘          │
│                                     │
│  ┌─────────┐  ┌─────────┐          │
│  │X3 Point │  │Discover │          │
│  │Challenge│  │         │          │
│  └─────────┘  └─────────┘          │
│                                     │
└─────────────────────────────────────┘
```

### Mode Selection: `ui/mode_selector.js`
After wordlist loaded, shows cards for each available game mode:
```
Mode Cards
├─ Picture Mode (visual recognition)
├─ Meaning Mode (vocabulary definition)
├─ Spelling Mode (auditory input)
├─ Listening Mode (comprehension)
└─ ... [more modes]
```

### Game View: `ui/game_view.js`
Renders active game UI:
- Question display
- Choice buttons (with animations)
- Progress bar (current question / total)
- Score tracking

### Modals (in `/ui/`)
- `sample_wordlist_modal.js` - browse & select wordlists
- `mode_modal.js` - confirm mode with options
- `browse_modal.js` - discover new wordlists
- `phonics_modal.js` - phonics mode selection
- `level2_modal.js` - level 2 wordlist selection
- `star_overlay.js` - celebrate completion with stars

---

## 8. Feature: Live Game Mode

From `LIVE_GAME_FLOW.md`: Teachers can create real-time games for class.

### Flow
1. Teacher creates game in Game Builder modal
2. POST to `/.netlify/functions/live_game` with game payload
3. Backend creates record in `live_games` table, returns UUID `id`
4. QR code generated: `?id=<uuid>`
5. Any student scans QR → fetches game data
6. Student plays created game
7. Progress still tracked to student's account

### API
- **Create**: `POST /.netlify/functions/live_game`
  ```json
  { "mode": "multi_choice_eng_to_kor", "words": [...], "config": {...}, "ttlMinutes": 180 }
  ```
  Returns: `{ "success": true, "id": "<uuid>" }`

- **Fetch**: `GET /.netlify/functions/live_game?id=<uuid>`
  Returns: Full game payload

---

## 9. Session & State Management

### Session Storage
Persists wordlist across navigation within same browser session:
```javascript
// Save on load
sessionStorage.setItem('WA_words', JSON.stringify(wordList));
sessionStorage.setItem('WA_list_name', currentListName);

// Restore if navigating back
const cached = JSON.parse(sessionStorage.getItem('WA_words'));
```

### Page Lifecycle
1. **Auth Gate** - early redirect to login if unauthorized
2. **Heavy Scripts Load** - main.js loads game engine
3. **UI Initialization** - show opening buttons
4. **Event Listeners** - attach to homework, browse, etc.
5. **Ready** - user can choose action

---

## 10. Security & Auth

### Authentication Flow
1. **Early Auth Check** (`index.html` inline script):
   ```javascript
   fetch('/.netlify/functions/supabase_auth?action=whoami')
     .then(r => !r.ok ? redirectToStudentLogin() : null);
   ```

2. **Cookie-Based Sessions**:
   - HTTP-only cookies set by Netlify functions
   - No direct Supabase client in frontend
   - All API calls use `credentials: 'include'`

3. **Auth Redirect**:
   ```javascript
   function redirectToStudentLogin() {
     location.href = `/students/login.html?next=${encodeURIComponent(current_url)}`;
   }
   ```

### Data Flow
- All data requests require valid session cookie
- Unauthorized (401/403) redirects to login
- Student progress tied to authenticated user_id

---

## 11. File Organization

```
Games/Word Arcade/
├── main.js                        # Entry point & orchestrator
├── index.html                     # Page shell
├── style.css                      # Main styles
├── tts.js                         # Audio loading & playback
├── sfx.js                         # Sound effects
├── game.js                        # Deprecated shim
├── modes/                         # Game mode implementations
│   ├── picture.js
│   ├── meaning.js
│   ├── spelling.js
│   ├── listening.js
│   ├── multi_choice.js
│   ├── time_battle.js
│   ├── phonics_listening.js
│   ├── review_session.js          # Review mode orchestrator
│   └── shared/
│       └── tap_spell_shared.js
├── ui/                            # UI components
│   ├── mode_selector.js           # Shows game mode options
│   ├── game_view.js               # Active game display
│   ├── sample_wordlist_modal.js   # Browse wordlists
│   ├── mode_modal.js              # Confirm mode selection
│   ├── browse_modal.js            # Discover wordlists
│   ├── phonics_modal.js           # Phonics options
│   ├── level2_modal.js            # Level 2 wordlists
│   ├── buttons.js                 # Choice button UI
│   ├── star_overlay.js            # Celebration animation
│   └── image_styles.js            # Image display helpers
├── sample-wordlists/              # Level 1 word lists (JSON)
│   ├── Animals2.json
│   ├── Food1.json
│   ├── Sports.json
│   └── ... (15+ more)
├── sample-wordlists-level2/       # Level 2 word lists (JSON)
│   ├── Verbs4.json
│   ├── ArtCulture.json
│   ├── MusicalInstruments.json
│   └── ... (17+ more)
├── emoji-list/                    # Emoji mappings
│   └── emoji-mappings.json
├── core/                          # Shared utilities
├── scripts/                       # Build & helper scripts
├── utils/                         # Utility functions
└── assets/                        # Images & icons
    ├── Images/
    ├── audio/
    └── ...
```

---

## 12. Key Data Flows

### Flow 1: Student Plays Homework Assignment
```
1. Student clicks "Your Homework" on opening page
2. app.js calls fetchJSON(/.netlify/functions/student_assignments)
3. Backend returns student's assigned wordlists
4. showSampleWordlistModal() displays them
5. User picks wordlist → loadSampleWordlistByFilename(name)
6. processWordlist() loads & prepares words
7. preloadAllAudio() generates TTS
8. startModeSelector() shows game mode cards
9. User picks mode → mode loaded & rendered
10. User plays → logAttempt() for each question
11. On completion → endSession() & show results
```

### Flow 2: Student Browses & Plays
```
1. "Discover" button clicked
2. showBrowseModal() fetches available lists
3. Backend query `/.netlify/functions/browse_wordlists`
4. Modal shows public lists with previews
5. User selects → loadSampleWordlistByFilename()
6. ... continues same as Flow 1 from step 6
```

### Flow 3: Review Challenging Words
```
1. "X3 Point Challenge" clicked
2. callProgressSummary('challenging_v2') fetches user's struggle list
3. Backend returns words where student had low accuracy
4. processWordlist() with review data
5. preloadAllAudio() for review words
6. showReviewSelectionModal() → picks mode
7. runReviewSession() plays with 3x points for correct
8. Progress tracked as review attempts
```

### Flow 4: Teacher Creates Live Game
```
1. Teacher uses Game Builder modal
2. Composes word list & game config
3. "Share" button → POST to /.netlify/functions/live_game
4. Backend stores in live_games table, returns UUID
5. QR code generated with ?id=<uuid>
6. Students scan QR
7. Frontend redirects to Word Arcade with ?id=<uuid>
8. play-main.js fetches game data from /.netlify/functions/live_game?id=<uuid>
9. Student plays created game
10. Progress recorded under student's account
```

---

## 13. Debugging & Common Issues

### Console Tools
```javascript
// Check current wordlist
console.log(window.WordArcade?.wordList);

// Check missing audio
console.log(window.__WA_MISSING_AUDIO);

// Force reload current list
window.location.reload();
```

### Session Cache
```javascript
// Clear cached wordlist
sessionStorage.removeItem('WA_words');
sessionStorage.removeItem('WA_list_name');

// View cached data
JSON.parse(sessionStorage.getItem('WA_words'));
```

### Audio Issues
- Check `/.netlify/functions/generate_audio` response
- Look for 403 (auth) or 500 (generation failed)
- Fallback: game continues without audio

### Wordlist Not Loading
1. Check file path: `./sample-wordlists/YourList.json`
2. Verify JSON is valid: wrap in array `[{...}]`
3. Check required fields: `eng`, `kor` must exist
4. Verify cache-busting: use `cache: 'no-store'` in fetch

---

## 14. Extension Points

### Add New Game Mode
1. Create `/modes/new_mode.js` with function:
   ```javascript
   export async function runNewModeMode({ wordList, gameArea, startGame, listName }) { ... }
   ```
2. Add to `main.js` modeLoaders:
   ```javascript
   new_mode: () => import('./modes/new_mode.js').then(m => m.runNewModeMode),
   ```
3. Mode automatically appears in mode selector

### Add Wordlist from Backend
1. Create Netlify function returning array of word objects
2. Fetch in appropriate modal/selector
3. Call `processWordlist(data)` with result

### Customize Progress Tracking
- Edit `/students/records.js`
- Modify `logAttempt()` parameters
- Backend function: `/.netlify/functions/log_word_attempt`

---

## Summary

Word Arcade is a modular, session-based learning game that:
- ✅ Loads wordlists from multiple sources (JSON, backend, generated)
- ✅ Normalizes image URLs and audio
- ✅ Provides 10+ interactive game modes
- ✅ Tracks progress in real-time to Supabase
- ✅ Supports teacher assignments and live games
- ✅ Uses lazy loading for performance
- ✅ Maintains session state for seamless navigation
- ✅ Secures access with cookie-based auth
