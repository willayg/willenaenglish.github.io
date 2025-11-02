# Troubleshooting Guide - Browser Back Button

## Common Issues & Solutions

### ❌ Issue: Back button doesn't work at all

**Check 1: Is history-manager.js loaded?**
```javascript
// In browser console, type:
window.WordArcade.historyManager
// Should return an object, not undefined
```

**Fix**: Make sure `history-manager.js` is in the Word Arcade folder
- Location: `/Games/Word Arcade/history-manager.js`

**Check 2: Is initialization running?**
```javascript
// Should see in console:
[HistoryManager] Initialized
```

**Fix**: Clear browser cache (Ctrl+Shift+Delete) and reload

**Check 3: JavaScript errors?**
- Open DevTools (F12)
- Check "Console" tab for red error messages
- Look for any errors before the app loads

---

### ❌ Issue: Back button returns to wrong state

**Check**: View the current state stack
```javascript
window.WordArcade.historyManager.getStack()
// Should show array of states with proper IDs
```

**Common Cause**: Navigated to a state but didn't call tracking function

**Fix**: Verify these functions are being called:
- `historyManager.navigateToLevels()` - when showing levels menu
- `historyManager.navigateToModeSelector()` - when showing game mode selection
- `historyManager.navigateToGame()` - when starting a game
- `historyManager.navigateToOpening()` - when returning to main menu

---

### ❌ Issue: Back button only works sometimes

**Possible Cause 1**: Multiple back button presses too fast
- History manager includes debounce protection
- Try pressing back slower (1-2 seconds apart)

**Possible Cause 2**: Modal interference
- If a modal is open, back button closes the modal first
- Press back a second time to go to previous state

**Possible Cause 3**: App reload in middle of navigation
- Don't reload the page while in game
- If stuck, do a full page reload

---

### ❌ Issue: Back button doesn't close modals

**Cause**: Modal not registered in closeAllModals()

**Fix**: Add your modal ID to history-manager.js, around line 150:
```javascript
closeAllModals() {
  const modalIds = [
    'comingSoonModal',
    'yourNewModal',  // ← Add here
    'anotherModal',  // ← And here
    // ... rest of list
  ];
```

---

### ❌ Issue: History stops working after visiting saved game

**Cause**: Saved game loading doesn't track in history

**Fix**: After loading a saved game, manually push state
```javascript
// In openSavedGameById() function, after loading words:
await processWordlist(mapped);
// Add this line:
window.WordArcade.historyManager.navigateToModeSelector({ 
  listName: row.title 
});
```

---

### ❌ Issue: Browser back button interferes with browser navigation

**Expected Behavior**:
- Word Arcade back button → navigates within app
- Last Word Arcade state + back button → goes to previous browser page

**Check**: After going back through all app states:
```javascript
window.WordArcade.historyManager.getStack().length
// Should be 1 (just the opening_menu state)
// Next back press will leave the app
```

---

## Performance Issues

### 🐌 Issue: App is slow with many states

**Cause**: History stack is too large

**Fix**: Clear history stack
```javascript
window.WordArcade.historyManager.clear()
```

**Prevention**: The system auto-limits to 50 states, so this shouldn't happen

---

## Mobile-Specific Issues

### 📱 Issue: Back gesture doesn't work on iPhone

**Cause**: Gesture conflicts with page scroll

**Fix**: 
1. Make sure not mid-scroll when swiping
2. Swipe from very edge of screen (not from middle)
3. Try using browser back button if available

### 🤖 Issue: Back button doesn't work on Android

**Cause**: Back button might close the app instead

**Fix**:
1. Check if device back button goes to app home first
2. Try browser's hardware back button if device supports it
3. Use back button in browser toolbar (top right menu)

---

## Console Commands for Debugging

### View Debug Information
```javascript
// Current state
window.WordArcade.historyManager.getCurrentState()

// Full stack history
window.WordArcade.historyManager.getStack()

// Stack size
window.WordArcade.historyManager.getStack().length

// Formatted output
console.table(window.WordArcade.historyManager.getStack())
```

### Trigger Actions
```javascript
// Simulate back button press
window.history.back()

// Clear history and reset
window.WordArcade.historyManager.clear()

// Go to opening menu
window.WordArcade.quitToOpening(true)

// Go to levels menu
window.showLevelsMenu()
```

---

## Testing Procedures

### Test 1: Full Navigation Path
```
1. Click Word Games → should see "levels_menu" in stack
2. Click Level 1 → should see "mode_selector" added
3. Click a game mode → should see "in_game" added
4. Press back 3 times → should go through reverse order
```

Verify with:
```javascript
window.WordArcade.historyManager.getStack().map(s => s.id)
// Result should show: ['opening_menu', 'levels_menu', 'mode_selector', 'in_game']
```

### Test 2: Modal Back Button
```
1. Open any modal (Coming Soon, Browse, etc)
2. Press back button → modal should close
3. Check console → should show modal restoration
```

### Test 3: Rapid Back Button Presses
```
1. Navigate through several states
2. Press back button rapidly (5+ times)
3. App should handle gracefully without crashing
```

---

## Network Issues

### Issue: Can't load word lists after back button

**Cause**: Session state not preserved

**Fix**: The system uses sessionStorage to preserve word lists
- Check DevTools → Application → Session Storage
- Look for `WA_words` and `WA_list_name`

---

## Browser-Specific Issues

### Firefox
- If back button doesn't work: Check privacy mode (cookies disabled)
- Solution: Disable tracking protection for this site

### Safari
- If back button inconsistent: Clear site data (Settings → Privacy → Manage Website Data)
- Swipe back gesture: Swipe from very edge of screen

### Chrome/Edge
- Most compatible, should work without issues
- If problems: Try incognito mode to rule out extensions

### Internet Explorer / Old Browsers
- Limited support (IE 10+)
- Consider using modern browser for best experience

---

## Still Having Issues?

### Collect Debug Information
```javascript
// Copy this output and save:
{
  isWorking: !!window.WordArcade.historyManager,
  stackLength: window.WordArcade.historyManager.getStack().length,
  currentState: window.WordArcade.historyManager.getCurrentState(),
  fullStack: window.WordArcade.historyManager.getStack(),
  browserInfo: navigator.userAgent
}
```

### Steps to Report Issue
1. Open DevTools (F12)
2. Go to Console tab
3. Copy debug info above
4. Note exact steps to reproduce
5. Check browser and device
6. Screenshot of error

---

## Prevention Checklist

- ✅ Clear browser cache after code changes
- ✅ Test on multiple browsers/devices
- ✅ Check console for errors (F12)
- ✅ Don't mix back button with page reloads
- ✅ Wait for modals to fully close before pressing back
- ✅ Ensure internet connection is stable
- ✅ Use latest browser version
- ✅ Disable browser extensions if testing
- ✅ Clear browser cookies if session issues

---

**Last Updated**: October 27, 2025
**Support**: Check BROWSER_BACK_BUTTON.md and IMPLEMENTATION_SUMMARY.md for more info
