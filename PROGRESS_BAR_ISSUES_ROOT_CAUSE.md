# Progress Bar Issues: Level 2 and Phonics Modals - Root Cause Analysis

## The Problem

Level 2 and Phonics modals show **incomplete or inaccurate progress** while Sample WordList modal works correctly.

---

## Root Cause: Progress Key Mismatch

### Critical Issue in Level 2 Modal

**Level 2 prepends "Level 2 -" to the list name when passing it to the game:**

```javascript
// Line 275 in level2_modal.js
btn.onclick = () => {
  const file = btn.getAttribute('data-file');
  const label = btn.getAttribute('data-label');
  const progressKey = btn.getAttribute('data-progress') || label;
  modal.style.display = 'none';
  // Prepend Level 2 marker to listName to keep it distinct from Level 1 data
  const level2ListName = `Level 2 - ${label}`;  // <-- THIS IS THE PROBLEM
  if (onChoose) onChoose({ listFile: file, listName: level2ListName, progressKey });
};
```

**But the progressKey is defined as:**
```javascript
{ 
  label: 'Animals Advanced', 
  file: 'sample-wordlists-level2/AnimalsAdvanced.json', 
  emoji: '🐆', 
  progressKey: 'Level 2 - Animals Advanced'  // <-- This is correct
}
```

**What happens during progress lookup:**

1. Modal fetches sessions looking for `progressKey: 'Level 2 - Animals Advanced'` ✅
2. That works and gets sessions with `list_name: 'Level 2 - Animals Advanced'`
3. But when player PLAYS the game, the `listName` passed to the game becomes `'Level 2 - Animals Advanced'` (because it's already in the progressKey)
4. The game saves the session with `list_name: 'Level 2 - Level 2 - Animals Advanced'` ❌ **DOUBLE PREFIX!**

### Problem in Phonics Modal

**Phonics uses progressKey but on game start, the listName is NOT prepended:**

```javascript
// phonics_modal.js line ~225
btn.onclick = () => {
  const file = btn.getAttribute('data-file');
  const label = btn.getAttribute('data-label');
  const progressKey = btn.getAttribute('data-progress') || label;
  modal.style.display = 'none';
  if (onChoose) onChoose({ listFile: file, listName: label, progressKey });  // <-- Uses label, not progressKey
};
```

But progressKey is:
```javascript
progressKey: 'Phonics - Short A Sound'
```

So:
1. Modal fetches sessions looking for `progressKey: 'Phonics - Short A Sound'` ✅
2. Game is called with `listName: 'Short A Sound'` (no prefix)
3. Game saves sessions with `list_name: 'Short A Sound'`
4. Next time, modal tries to find sessions with `list_name: 'Phonics - Short A Sound'` but they're stored as `'Short A Sound'` ❌ **MISMATCH!**

---

## Why Sample WordList Works

**Sample wordlist doesn't have this problem because it doesn't use progressKey:**

```javascript
// sample_wordlist_modal.js - NO progressKey field
const allLists = [
  { label: 'Easy Animals', file: 'EasyAnimals.json', emoji: '🐯' },
  // ... no progressKey
];

// During play, it passes:
if (onChoose) onChoose(allLists[Number(btn.getAttribute('data-idx'))].file);

// And the matching is simple:
function matchesListName(listFile, rowName) {
  const target = norm(listFile);
  const targetNoExt = stripExt(target);
  const n = norm(rowName);
  return (n === target || n === targetNoExt || stripExt(n) === targetNoExt);
}
```

So:
1. Modal fetches sessions looking for `list_name: 'EasyAnimals.json'` (or variations)
2. Game gets called with just the filename
3. Sessions are saved with the same filename
4. Lookup works because the names always match ✅

---

## The Data Flow Problem

### Sample WordList (Working) 🟢
```
Modal shows: "Easy Animals" (file: EasyAnimals.json)
  ↓
User clicks
  ↓
Game gets: listName = 'EasyAnimals.json' (just the filename)
  ↓
Session saved: list_name = 'EasyAnimals.json'
  ↓
Next time modal fetches: list_name = 'EasyAnimals.json'
  ✅ MATCH!
```

### Level 2 (Broken) 🔴
```
Modal shows: "Animals Advanced" (progressKey: 'Level 2 - Animals Advanced')
  ↓
User clicks
  ↓
Game gets: listName = 'Level 2 - Animals Advanced' (prepended)
  ↓
Session saved: list_name = 'Level 2 - Level 2 - Animals Advanced' ❌ DOUBLE PREFIX
  ↓
Next time modal fetches: progressKey = 'Level 2 - Animals Advanced'
  ❌ MISMATCH! (sessions have double prefix)
```

### Phonics (Broken) 🔴
```
Modal shows: "Short A Sound" (progressKey: 'Phonics - Short A Sound')
  ↓
User clicks
  ↓
Game gets: listName = 'Short A Sound' (NO prefix in onclick handler)
  ↓
Session saved: list_name = 'Short A Sound'
  ↓
Next time modal fetches: progressKey = 'Phonics - Short A Sound'
  ❌ MISMATCH! (stored name is missing prefix)
```

---

## The Fix

### For Level 2 Modal:

**Option 1 (Preferred):** Don't prepend in the onclick handler, let the progressKey be used:

```javascript
btn.onclick = () => {
  const file = btn.getAttribute('data-file');
  const label = btn.getAttribute('data-label');
  const progressKey = btn.getAttribute('data-progress') || label;
  modal.style.display = 'none';
  // Use progressKey instead of prepending to label
  if (onChoose) onChoose({ listFile: file, listName: progressKey, progressKey });
};
```

**Option 2:** Ensure game code stores with progressKey too.

### For Phonics Modal:

**Option 1 (Preferred):** Use progressKey as the listName:

```javascript
btn.onclick = () => {
  const file = btn.getAttribute('data-file');
  const label = btn.getAttribute('data-label');
  const progressKey = btn.getAttribute('data-progress') || label;
  modal.style.display = 'none';
  // Use progressKey as the listName
  if (onChoose) onChoose({ listFile: file, listName: progressKey, progressKey });
};
```

**Option 2:** Remove progressKey and use label-based matching like Sample modal.

---

## Summary

| Modal | Issue | Root Cause | Fix |
|-------|-------|-----------|-----|
| **Sample WordList** | ✅ Works | Uses simple filename matching | N/A |
| **Level 2** | ❌ Double prefix | Prepends "Level 2 -" in onclick but progressKey already has it | Use `listName: progressKey` instead of prepending |
| **Phonics** | ❌ Mismatch | Uses progressKey for fetch but label for game | Use `listName: progressKey` in onclick |

---

## Verification Steps

To confirm this is the issue, check:

1. **Level 2 sessions in database:** Look for entries with `list_name: 'Level 2 - Level 2 - Animals Advanced'` (double prefix)
2. **Phonics sessions in database:** Look for entries with `list_name: 'Short A Sound'` (no prefix) vs progressKey fetch looking for `'Phonics - Short A Sound'`
3. **Sample sessions in database:** Should have `list_name: 'EasyAnimals.json'` (or filename variations)
