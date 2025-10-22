# Progress Bar Comparison: Sample WordList vs Phonics vs Level 2 Modals

## Summary
All three modals use **nearly identical progress bar styling and calculation logic**, with only minor differences in CSS class naming and progress key handling.

---

## Visual Styling Comparison

| Feature | Sample WordList | Phonics Modal | Level 2 Modal |
|---------|-----------------|---------------|---------------|
| **CSS Prefix** | `wl-` | `phonics-` | `l2-` |
| **Bar Height** | 16px | 16px | 16px |
| **Bar Border** | 2px solid #27c5ca | 2px solid #27c5ca | 2px solid #27c5ca |
| **Bar Background** | #ffffff | #ffffff | #ffffff |
| **Bar Radius** | 9999px (pill) | 9999px (pill) | 9999px (pill) |
| **Fill Segments** | 12 segments, 2px gap | 12 segments, 2px gap | 12 segments, 2px gap |
| **Segment Color** | #ffc107 | #ffc107 | #ffc107 |
| **Gradient Base** | #ffe082 → #ffb300 | #ffe082 → #ffb300 | #ffe082 → #ffb300 |
| **Loading Animation** | `wlBarGlow` | `phonicsBarGlow` | `l2BarGlow` |
| **Loading Duration** | 1.5s ease-in-out | 1.5s ease-in-out | 1.5s ease-in-out |
| **Transition** | width .3s ease | width .3s ease | width .3s ease |

### **CSS Details**

All three use **identical dual-layer backgrounds**:

```css
background-image:
  linear-gradient(to right,
    #ffc107 0,
    #ffc107 calc(100%/12 - 2px),
    transparent calc(100%/12 - 2px),
    transparent calc(100%/12)
  ),
  linear-gradient(90deg, #ffe082, #ffb300);
background-size: calc(100%/12) 100%, 100% 100%;
background-repeat: repeat-x, no-repeat;
```

**Layer 1 (Top):** Segmented stripes (12 segments)  
**Layer 2 (Bottom):** Warm yellow gradient

### **Loading Animation**

All three use identical keyframes:
```css
@keyframes [NAME]Glow {
  0%, 100% { background-position: 200% 0; opacity: 0.7; }
  50% { background-position: 0% 0; opacity: 1; }
}
```

---

## Progress Calculation - IDENTICAL

All three modals use **the exact same calculation logic**:

### **Step 1: Fetch Sessions**
```javascript
const urlBase = new URL(FN('progress_summary'), window.location.origin);
urlBase.searchParams.set('section', 'sessions');
// Try progressKey first (fast path)
scoped.searchParams.set('list_name', item.progressKey);
```

### **Step 2: Normalize Modes**
```javascript
const canonicalMode = (raw) => {
  const m = (raw || 'unknown').toString().toLowerCase();
  if (m === 'matching' || m.startsWith('matching_') || m === 'meaning') return 'meaning';
  if (m === 'listening' || (m.startsWith('listening_') && !m.includes('spell'))) return 'listening';
  if (m.includes('listen') && m.includes('spell')) return 'listen_and_spell';
  if (m === 'multi_choice' || m.includes('multi_choice') || m.includes('picture_multi_choice') || m === 'easy_picture' || m === 'picture' || m === 'picture_mode' || m.includes('read')) return 'multi_choice';
  if (m === 'spelling' || (m.includes('spell') && !m.includes('listen'))) return 'spelling';
  if (m.includes('level_up')) return 'level_up';
  return m;
};
```

### **Step 3: Track Best Score Per Mode**
```javascript
const modeIds = ['meaning', 'listening', 'multi_choice', 'listen_and_spell', 'spelling', 'level_up'];
const bestByMode = {};

// Extract percentage from multiple possible formats
if (sum && typeof sum.score === 'number' && typeof sum.total === 'number' && sum.total > 0) {
  pct = Math.round((sum.score / sum.total) * 100);
} else if (sum && typeof sum.score === 'number' && typeof sum.max === 'number' && sum.max > 0) {
  pct = Math.round((sum.score / sum.max) * 100);
} else if (sum && typeof sum.accuracy === 'number') {
  pct = Math.round((sum.accuracy || 0) * 100);
} else if (typeof s.correct === 'number' && typeof s.total === 'number' && s.total > 0) {
  pct = Math.round((s.correct / s.total) * 100);
} else if (typeof s.accuracy === 'number') {
  pct = Math.round((s.accuracy || 0) * 100);
}

if (pct != null) {
  if (!(key in bestByMode) || (bestByMode[key].pct ?? -1) < pct) {
    bestByMode[key] = { pct };
  }
}
```

### **Step 4: Average Across 6 Modes**
```javascript
let total = 0;
modeIds.forEach(m => { 
  const v = bestByMode[m]; 
  if (v && typeof v.pct === 'number') total += v.pct; 
});
return Math.round(total / 6);
```

---

## Key Differences

### **1. Progress Key Matching**

**Sample WordList Modal:**
```javascript
async function fetchSessionsFor(listFile) {
  // Only tries list_name directly, no progressKey
  scoped.searchParams.set('list_name', listFile);
}

function matchesListName(listFile, rowName) {
  const target = norm(listFile);
  const targetNoExt = stripExt(target);
  const n = norm(rowName);
  return (n === target || n === targetNoExt || stripExt(n) === targetNoExt);
}
```

**Phonics & Level 2 Modals:**
```javascript
async function fetchSessionsFor(item) {
  // Tries progressKey first (fast path)
  let scoped = new URL(urlBase.toString());
  scoped.searchParams.set('list_name', item.progressKey);
  try {
    let res = await fetch(scoped.toString(), { cache: 'no-store', credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length) return data;
    }
  } catch {}
  // Fallback: fetch all and filter client-side
}

function matchesListName(item, rowName) {
  const targets = [
    norm(item.progressKey),
    norm(item.label),
    norm(item.file)
  ];
  const n = norm(rowName);
  if (!n) return false;
  return targets.some(t => n === t);
}
```

**Why the difference?**
- Sample WordList lists don't have explicit `progressKey` fields
- Phonics and Level 2 lists have human-readable `progressKey` values (e.g., "Phonics - Short A Sound", "Level 2 - Animals Advanced")
- This allows faster lookup in the sessions database

### **2. List Definition Structure**

**Sample WordList:**
```javascript
{ label: 'Easy Animals', file: 'EasyAnimals.json', emoji: '🐯' }
```

**Phonics & Level 2:**
```javascript
{ label: 'Short A Sound', file: 'phonics-lists/short-vowels/short-a.json', emoji: '🐱', progressKey: 'Phonics - Short A Sound' }
```

### **3. Button Click Handler (Level 2 Only)**

**Level 2 Modal:**
```javascript
// Prepend Level 2 marker to listName to keep it distinct from Level 1 data
const level2ListName = `Level 2 - ${label}`;
if (onChoose) onChoose({ listFile: file, listName: level2ListName, progressKey });
```

**Sample & Phonics:**
```javascript
if (onChoose) onChoose({ listFile: file, listName: label, progressKey });
```

**Why?** Level 2 prepends the marker to distinguish Level 2 progress data from Level 1 data in the backend.

---

## List Counts

| Modal | Count | Category |
|-------|-------|----------|
| **Sample WordList** | 14 | Level 1 (General Vocabulary) |
| **Phonics** | 21 | Phonics (Sound patterns) |
| **Level 2** | 14 | Level 2 (Advanced Vocabulary) |

---

## Similarities Summary

✅ **Identical:**
- Visual bar styling (12-segment segmented yellow bars)
- Loading animation (glowing effect)
- Progress calculation algorithm (average of 6 modes)
- Mode normalization logic
- Modal layout (emoji + label + percentage + bar)
- Color scheme (#27c5ca border, #ffc107 segments)
- Button styling and hover effects

❌ **Different:**
- CSS class prefixes (for scoping)
- `progressKey` field definition and lookup
- List content (different word lists for each context)
- Level 2 appends "Level 2 -" prefix to list names

---

## Code Reusability Opportunity

All three modals have nearly identical logic. They could be refactored into a single reusable component:

```javascript
function createWordListModal({ 
  modalId, 
  cssPrefix, 
  title, 
  lists, 
  onChoose, 
  onClose 
}) {
  // Single generic function for all three
}
```

This would reduce code duplication and make maintenance easier.
