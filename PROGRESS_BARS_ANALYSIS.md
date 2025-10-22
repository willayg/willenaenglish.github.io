# Progress Bars in Modals - Analysis

## Overview
The application has two main modal systems with progress bars:

1. **Sample Wordlist Modal** (`ui/sample_wordlist_modal.js`)
2. **Mode Modal** (`ui/mode_modal.js`)

Both use different approaches for displaying student progress.

---

## 1. Sample Wordlist Modal (`sample_wordlist_modal.js`)

### Purpose
Shows a flat list of 14 sample word lists with progress for each one.

### Progress Bar Design

#### Visual Style
- **Container (`.wl-bar`):**
  - Width: 100%
  - Height: 16px
  - Border: 2px solid #27c5ca (light blue outline)
  - Background: white interior
  - Border-radius: rounded ends (9999px)

- **Fill (`.wl-bar-fill`):**
  - **When Loading (showing initial skeleton):**
    - Width: 100%
    - Animated with glowing effect (`wlBarGlow` animation)
    - Colors: Light blue gradient (#b0e2e4 to #7fc5ca)
    - Opacity animates between 0.7 and 1.0 over 1.5s
    
  - **When Loaded (showing actual progress):**
    - Width: set to percentage (0-100%)
    - **Dual-layer background:**
      1. **Segmented stripes layer (top):**
         - 12 segments with 2px gaps between them
         - Yellow color (#ffc107)
         - Creates a segmented appearance
      2. **Gradient base layer:**
         - Linear gradient: #ffe082 to #ffb300 (warm yellow)
      - Combined with `background-image` and `background-size`
    - Smooth transition: 0.3s ease

### Progress Calculation

For each word list, calculates a single percentage by:

1. **Fetches sessions** via `/progress_summary?section=sessions&list_name={listFile}`
2. **Groups by mode** (meaning, listening, multi_choice, listen_and_spell, spelling, level_up)
3. **For each mode, finds best score:**
   - Tries: `score/total`, `score/max`, `accuracy`, or raw `score`
   - Only keeps highest percentage for each mode
4. **Averages across all 6 modes:**
   - `total / 6 = final percentage`
5. **Clamps** to 0-100%

**Code:**
```javascript
let total = 0;
modeIds.forEach(m => { const v = bestByMode[m]; if (v && typeof v.pct === 'number') total += v.pct; });
return Math.round(total / 6);
```

### UI Flow

1. **Initial Render (Skeleton):**
   - Shows 14 list buttons immediately
   - Each has `wl-bar-fill.loading` with animation
   - Percent display: "0%"
   - Allows user to interact while data loads

2. **After Fetch Completes:**
   - Re-renders all list items
   - Sets actual percentages in `wl-percent` elements
   - Removes `.loading` class from fills
   - Progress bars now show segmented yellow fills with smooth widths

### Rendering Template
```html
<div style="display:flex;align-items:center;justify-content:space-between;">
  <span style="font-size:2em;">${emoji}</span>
  <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex:1;">
    <div style="display:flex;align-items:baseline;gap:8px;">
      <span>${label}</span>
      <span class="wl-percent">${pct}%</span>
    </div>
    <div class="wl-bar">
      <div class="wl-bar-fill" style="width:${pct}%;"></div>
    </div>
  </div>
</div>
```

---

## 2. Mode Modal (`mode_modal.js`)

### Purpose
Shows 6 different game modes for the current word list, with per-mode progress.

### Progress Display

Unlike the sample modal, the mode modal uses **stars + percentage text** instead of a visual bar:

#### Visual Elements (per mode):
1. **Mode Title:** Capitalized mode name (e.g., "Match", "Listen", "Read")
2. **Star Rating:** 0-5 stars based on percentage
3. **Percentage Text:** Colored badge with percentage or "0%"
4. **Mode Icon:** 92×92px PNG icon

#### Star Mapping
```javascript
const pctToStars = (pct) => {
  if (pct == null) return 0;
  if (pct >= 100) return 5;  // Perfect
  if (pct > 90) return 4;    // Excellent
  if (pct > 80) return 3;    // Great
  if (pct > 70) return 2;    // Good
  if (pct >= 60) return 1;   // Started
  return 0;                  // Not played
};
```

### Progress Calculation

Similar to sample modal but **per-mode**:

1. **Fetches sessions** via `/progress_summary?section=sessions&list_name={listName}`
2. **For each session, normalizes the mode name:**
   - "matching" / "matching_*" / "meaning" → "meaning"
   - "listening" / "listening_*" (not including spell) → "listening"
   - "listen*spell" → "listen_and_spell"
   - "multi_choice" / picture modes / read modes → "multi_choice"
   - "spelling" / spell modes → "spelling"
   - "level_up" → "level_up"
3. **Stores best percentage for each mode** (highest score wins)
4. **Returns `bestByMode` object:**
   ```javascript
   {
     "meaning": { pct: 85 },
     "listening": { pct: 92 },
     "multi_choice": { pct: 75 },
     // ... etc
   }
   ```

### Special Cases

#### Review Mode
When `listName === 'Review List'`:
- **Hides all stats** (percentage, stars)
- Shows **icon-only layout**
- Simplifies visual to just mode title + mode icon

#### Picture Mode Availability
- Only shows "Easy Picture" mode if **at least 4 words have explicit images** (not emoji)
- Checks: `pictureCount >= 4`

### Rendering Layout
```html
<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
  <div style="display:flex;flex-direction:column;align-items:flex-start;">
    <div class="mode-title">${label}</div>
    <div class="star-row">${stars}</div>
    <div>${percentage_badge}</div>
  </div>
  <div style="flex-shrink:0;">
    <img src="${mode_icon}" alt="${label}" style="width:92px;height:92px;"/>
  </div>
</div>
```

---

## 3. Game Progress Bar (`main.js`)

### Purpose
Shows progress **during** active gameplay (current question vs total).

### Visual Style
```html
<div id="gameProgressBar">
  <div style="height:8px;background:#ffffff;border-radius:6px;overflow:hidden;">
    <div id="gameProgressFill" 
         style="height:100%;width:0%;background:linear-gradient(90deg,#93cbcf,#19777e);transition:width .3s ease;"></div>
  </div>
  <div id="gameProgressText">0/0</div>
</div>
```

- **Thin bar:** 8px tall
- **Gradient fill:** Teal (#93cbcf) to dark teal (#19777e)
- **Text:** "X/Y" format showing current/total questions

### Updates During Play
```javascript
showGameProgress(total, current = 0);      // Initialize
updateGameProgress(current, total);        // Update per question
hideGameProgress();                        // Hide when done
```

---

## API Endpoint: `/progress_summary`

Both modals fetch from the same Netlify function endpoint:

### Query Parameters
- `section=sessions` - Retrieve session records
- `list_name={filename}` - (Optional) Filter to specific word list

### Response Format
```javascript
[
  {
    list_name: "EasyAnimals.json",
    mode: "meaning",
    summary: {
      score: 8,
      total: 10,
      accuracy: 0.8  // or score/total
    }
  },
  // ... more sessions
]
```

### Fallback Logic
If `list_name` filter returns empty, retries with full session list and client-side filters.

---

## Color Scheme

| Element | Color | Usage |
|---------|-------|-------|
| Border/Outline | #27c5ca | Sample modal bar outline, modal borders |
| Text/Primary | #19777e | Titles, mode labels |
| Progress Fill (Segmented) | #ffc107 | Sample modal segments |
| Progress Gradient | #ffe082 → #ffb300 | Sample modal base gradient |
| Loading Glow | #b0e2e4 → #7fc5ca | Skeleton loading animation |
| Game Progress | #93cbcf → #19777e | In-game progress bar gradient |
| Stats Badge | Varies by class | Percentage badge coloring |

---

## Summary

| Feature | Sample Modal | Mode Modal | Game Progress |
|---------|-------------|-----------|----------------|
| **Type** | Segmented bar | Stars + % | Linear gradient bar |
| **Scope** | List average (6 modes) | Per-mode specific | Current gameplay |
| **Display** | 0-100% width fill | 0-5 stars | X/Y text + bar |
| **Animation** | Loading glow, smooth transition | None | Smooth width transition |
| **Fetches Data** | Yes (async) | Yes (async) | No (realtime) |
| **Purpose** | Summary across all modes | Choose best mode | Track game progress |
