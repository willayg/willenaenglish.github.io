# Progress Bar Fixes - Level 2 and Phonics Modals

## Changes Made

Both modals had issues with progress key consistency that caused incomplete or inaccurate progress bars.

---

## Level 2 Modal Fix

### Problem
The Level 2 modal was **prepending "Level 2 -" twice**:
1. Once in the `progressKey` field: `'Level 2 - Animals Advanced'`
2. Again in the onclick handler: `const level2ListName = `Level 2 - ${label}`

This caused sessions to be saved with double prefixes like `'Level 2 - Level 2 - Animals Advanced'`, creating a mismatch during progress lookup.

### Solution
Changed both onclick handlers (initial and after re-render) to use `progressKey` directly instead of prepending to `label`:

**Before:**
```javascript
btn.onclick = () => {
  const file = btn.getAttribute('data-file');
  const label = btn.getAttribute('data-label');
  const progressKey = btn.getAttribute('data-progress') || label;
  modal.style.display = 'none';
  // Prepend Level 2 marker to listName to keep it distinct from Level 1 data
  const level2ListName = `Level 2 - ${label}`;  // ❌ Double prefix!
  if (onChoose) onChoose({ listFile: file, listName: level2ListName, progressKey });
};
```

**After:**
```javascript
btn.onclick = () => {
  const file = btn.getAttribute('data-file');
  const label = btn.getAttribute('data-label');
  const progressKey = btn.getAttribute('data-progress') || label;
  modal.style.display = 'none';
  // Use progressKey to ensure consistency with progress tracking
  if (onChoose) onChoose({ listFile: file, listName: progressKey, progressKey });  // ✅ Single prefix
};
```

### Files Modified
- `Games/Word Arcade/ui/level2_modal.js`
  - Line ~161: First onclick handler
  - Line ~275: Second onclick handler (after re-render)

---

## Phonics Modal Fix

### Problem
The Phonics modal was using **inconsistent list names**:
1. For fetching progress: Used `progressKey` (e.g., `'Phonics - Short A Sound'`)
2. For passing to game: Used `label` (e.g., `'Short A Sound'` - no prefix)

This caused a mismatch:
- Modal looks for sessions with `list_name: 'Phonics - Short A Sound'`
- Game saves sessions with `list_name: 'Short A Sound'`
- Lookup fails because the names don't match

### Solution
Changed both onclick handlers (initial and after re-render) to use `progressKey` as the `listName`:

**Before:**
```javascript
btn.onclick = () => {
  const file = btn.getAttribute('data-file');
  const label = btn.getAttribute('data-label');
  const progressKey = btn.getAttribute('data-progress') || label;
  modal.style.display = 'none';
  if (onChoose) onChoose({ listFile: file, listName: label, progressKey });  // ❌ Mismatch!
};
```

**After:**
```javascript
btn.onclick = () => {
  const file = btn.getAttribute('data-file');
  const label = btn.getAttribute('data-label');
  const progressKey = btn.getAttribute('data-progress') || label;
  modal.style.display = 'none';
  // Use progressKey to ensure consistency with progress tracking
  if (onChoose) onChoose({ listFile: file, listName: progressKey, progressKey });  // ✅ Consistent
};
```

### Files Modified
- `Games/Word Arcade/ui/phonics_modal.js`
  - Line ~173: First onclick handler
  - Line ~290: Second onclick handler (after re-render)

---

## Data Flow After Fix

### Level 2 Modal 🟢
```
Modal shows: "Animals Advanced" (progressKey: 'Level 2 - Animals Advanced')
  ↓
User clicks → Game gets: listName = 'Level 2 - Animals Advanced'
  ↓
Session saved: list_name = 'Level 2 - Animals Advanced'
  ↓
Next time modal fetches: progressKey = 'Level 2 - Animals Advanced'
  ✅ MATCH!
```

### Phonics Modal 🟢
```
Modal shows: "Short A Sound" (progressKey: 'Phonics - Short A Sound')
  ↓
User clicks → Game gets: listName = 'Phonics - Short A Sound'
  ↓
Session saved: list_name = 'Phonics - Short A Sound'
  ↓
Next time modal fetches: progressKey = 'Phonics - Short A Sound'
  ✅ MATCH!
```

---

## Testing Recommendation

After deploying, test by:

1. **Hard refresh** browser (Ctrl+F5)
2. Play a **Level 2 game** (e.g., "Animals Advanced")
3. **Close and reopen** Level 2 modal
4. Verify progress bar shows the **correct percentage**
5. Play a **Phonics game** (e.g., "Short A Sound")
6. **Close and reopen** Phonics modal
7. Verify progress bar shows the **correct percentage**
8. Compare with **Sample WordList modal** (should match now)

---

## Summary

✅ **Fixed:** Level 2 modal duplicate prefix issue  
✅ **Fixed:** Phonics modal list name mismatch  
✅ **Result:** Progress bars will now show accurate and complete data  
✅ **Consistency:** All three modals now use the same progress key logic
