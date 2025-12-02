# Textbox Module TODO

## High Priority Improvements


### 1. Remove Hidden Globals
**Status:** ✅ Complete (August 2025)
- `selectionFrame` and `dragHandle` are now passed as parameters to event handlers and not accessed as undeclared globals.
- All modules refactored for explicit parameter passing, improving code clarity and testability.


### 2. Clarify Click-to-Edit Behavior
**Status:** ✅ Complete (August 2025)
- Chosen model: **Canva-style single-click edit** for text boxes (edit mode on click, unless just resized).
- Code comment added in `textbox-events.js` to clarify this UX decision for future maintainers.
- If two-step select-then-edit is desired in the future, update the click handler logic as noted in the comment.


### 3. Use or Remove Keyboard Movement Constants
**Status:** ✅ Complete (August 2025)
- Keyboard arrow key movement is implemented for both the drag handle and the textbox itself when selected.
- Uses `KEYBOARD_STEP_SMALL` (2px) and `KEYBOARD_STEP_LARGE` (10px with Shift).
- When textbox is selected (not in edit mode), arrow keys move the box and update position data.
- See code comments in `textbox-drag.js` and `textbox-events.js` for details.

## Medium Priority Improvements

### 4. Add Pointer Events Support
**Status:** ✅ Complete (August 2025)
- Replaced `mousedown`/`mousemove`/`mouseup` with `pointerdown`/`pointermove`/`pointerup` across all textbox modules.
- Added `pointercancel` event handling for better reliability.
- Unified mouse, touch, and pen input handling for better mobile and tablet support.
- Updated hover events to use `pointerenter`/`pointerleave` for consistency.
- **Files Updated:** `textbox-drag.js`, `textbox-resize.js`, `textbox-events.js`

### 5. Finish and Integrate Guide Code
**Status:** ✅ Complete (August 2025)
- Added `SNAP_TOLERANCE` constant (15px) for snapping sensitivity.
- Implemented `snapToCenter()` function that checks if textbox center is within tolerance of A4 center coordinates.
- Shows vertical and horizontal center guides (dashed blue lines) when snapping occurs.
- Integrated snapping into both drag handle movement and keyboard arrow key movement.
- Guides automatically hide when movement stops (drag release or key release).
- **Files Updated:** `textbox-events.js` (snap logic + guides), `textbox-drag.js` (drag snapping), `textbox-main.js` (module coordination)
- **Guide Features:** Center snap guides with proper z-index, pointer-events: none, styled with dashed blue lines

### 6. Reduce Redundant Global Listeners
**Status:** ✅ Complete (August 2025)
- Replaced per-textbox document listeners with centralized global `pointermove`/`pointerup` handlers.
- Implemented `Session.active` object to track the currently interacting textbox and its state.
- Single set of global listeners now handles all textbox resize operations efficiently.
- **Benefits Achieved:** Better performance, cleaner event management, easier debugging.
- **Files Updated:** `textbox-events.js` (centralized session management and global pointer handlers)
- **Implementation:** Global interaction manager using `Session` object with active box tracking.

## Low Priority Improvements

### 7. Add MutationObserver Cleanup ✅ **COMPLETE - January 15, 2025**
**Status:** ✅ Complete - Memory Management
- ✅ Store MutationObserver reference in styleObserver variable 
- ✅ Add destroyTextbox() method that calls styleObserver.disconnect()
- ✅ Include Session.active cleanup and guide hiding in destroy method
- ✅ Return destroyTextbox in public interface for proper memory management
- **Implementation:** Added comprehensive cleanup preventing memory leaks when textboxes are removed

### 8. Make Edge Detection Safer ✅ **COMPLETE - January 15, 2025**
**Status:** ✅ Complete - Robustness
- ✅ Enhanced `edgeAt()` function to use explicit `getBoundingClientRect()` calls instead of helper shorthand
- ✅ Added comprehensive comments and improved code readability for edge detection logic
- ✅ Ensured cursor detection works reliably with nested elements by always calculating relative to textbox
- ✅ Structured corner detection with higher priority than edge detection for better hit accuracy
- **Implementation:** More reliable hit detection using consistent `getBoundingClientRect()` math regardless of event target

### 9. Store Fixed Initial Minimum Height ✅ **COMPLETE - January 15, 2025**
**Status:** ✅ Complete - Auto-resize Consistency
- ✅ Added `initialHeight` property to boxData during textbox creation in `textbox-core.js`
- ✅ Modified `autoHeight()` function to use `initialHeight` instead of current `boxData.height`
- ✅ Preserved initial height even when users manually resize textboxes smaller
- ✅ Ensured auto-resize always respects the original intended minimum height
- **Implementation:** Fixed auto-resize consistency by storing and using initial height value

### 10. Overlapping boxes hide the selection box ✅ **COMPLETE - January 15, 2025**
**Status:** ✅ Complete - Visual Layer Management
- ✅ Increased selection frame z-index from 15 to 1001 (above all textboxes and guides)
- ✅ Added DOM reordering logic to move selection frame to end of container when shown
- ✅ Ensured selection frame is always visible above overlapping textboxes
- ✅ Applied fix to both legacy and modular textbox systems
- **Implementation:** High z-index + DOM reordering ensures selection visibility regardless of textbox stacking 

### 11. weird selection box thing in upper left corner before selecting a box ✅ **COMPLETE - January 15, 2025**
**Status:** ✅ Complete - Selection Frame Validation
- ✅ Added validation to check textbox has valid position and dimensions before showing selection frame
- ✅ Prevents selection frame from appearing at (0,0) when textbox dimensions are invalid
- ✅ Enhanced condition to verify width > 0, height > 0, and position exists
- ✅ Applied fix to both legacy and modular textbox systems
- **Implementation:** Validates textbox geometry before rendering selection frame, eliminating phantom selection boxes

## Implementation Notes

### Module Dependencies
- Some improvements may require cross-module coordination
- Consider creating a `textbox-manager.js` for centralized state management
- Maintain backwards compatibility with existing API

### Testing Strategy
- Each improvement should include test cases
- Focus on edge cases and interaction between modules
- Test on both desktop and mobile devices for pointer events

### Performance Considerations
- Monitor impact of centralized event listeners
- Profile memory usage before/after MutationObserver cleanup
- Benchmark edge detection performance improvements

## Priority Matrix
```
High Impact + High Effort: Remove Hidden Globals, Pointer Events
High Impact + Low Effort:  Clarify Click Behavior, Keyboard Constants
Low Impact + High Effort:  Guide Integration, Global Listener Manager
Low Impact + Low Effort:   Observer Cleanup, Edge Detection, Initial Height
```

---
*Created: August 2025*
*Last Updated: August 2025*
*Target Completion: Incremental over next development cycle*
