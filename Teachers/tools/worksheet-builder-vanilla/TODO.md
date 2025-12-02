# Worksheet Builder TODO

# Worksheet Builder TODO

## ✅ **COMPLETED: Code Modularization - MASSIVE SUCCESS!**
- ✅ **Step 1: Core Data/State Management** - Extracted to `js/state.js` (82 lines)
- ✅ **Step 2: History/Undo System** - Extracted to `js/history.js` (159 lines)
- ✅ **Step 3: Text Box Operations** - Extracted to `js/textbox.js` (295 lines)
- ✅ **Step 4: UI Rendering** - Extracted to `js/render.js` (375 lines)
- ✅ **Step 5: Toolbar & Controls** - Extracted to `js/toolbar.js` (609 lines)
- ✅ **Step 6: Context Menu System** - Extracted to `js/contextmenu.js` (118 lines)
- ✅ **Step 7: Event Listeners & App Init** - Extracted to `js/events.js` (196 lines)

**🎉 INCREDIBLE RESULTS:**
- **Original main.js**: ~1,400+ lines
- **Final main.js**: 18 lines (99% reduction!)
- **Total extracted**: 1,834 lines across 7 focused modules
- **Modular architecture**: Clean separation of concerns with proper dependencies

## 🚧 **Remaining Development Tasks:**

3. ✅ Add a more user-friendly color selector for border color (palette + custom color picker). **COMPLETED: Integrated iro.js with Tailwind color palette**

8. The font sizer had two sets of controls. Only have the large ones on the outside.
9. ✅Poppins and other fonts not being recgonized

11. ✅Underline and strikeput dont work

14. ✅ Add test box copy delete and paste functions
14.1. ✅ Add undo (Ctrl+Z) and redo (Ctrl+Y) functionality (fully working)
15. ✅ Make text box resizable from every side (FIXED: removed minWidth/minHeight constraints)
16. Theres a weird bug where if I have a long passage in a text box and add a new page, the text box will resize to fit the full size of the page
17. ✅ File burger and other dropdowns should be on a higher layer to the border modal (FIXED: z-index hierarchy properly established)
18. ✅ theres a weird bug where the border turns off after the first time i edit it
19. Burger menu needs to be white?
20. ✅ Integrate Pickr color picker for font, border, and fill colors: **COMPLETED: Used iro.js instead with Tailwind palette**
    - ✅ Replace the toolbar font color input with a iro.js-powered div and ensure it updates the selected textbox's font color.
    - ✅ Ensure the border modal loads and displays iro.js for border and fill colors, updating the selected textbox in real time.
    - ✅ Remove any event listeners or code that reference the old native color inputs.
    - ✅ Clean up any unused/conflicting color picker code.

21. Weird print behaviour if I add a second page the text box shrinks vertically
22. ✅ After a box resize, it cant be made smaller again (FIXED: removed minWidth/minHeight being set to current size)
23. ✅ pASTING SHOULD PASTE WHERE THE CURSOR IS
24. Resizing is a bit weird when the text box has rounded edges
25. ✅ BUG: If you add a new page and then paste a textbox, color pickers and color logic do not work on the pasted item (needs investigation)
26. ✅ The color dropdown needsd a higher z index than the border modal
27. ✅ Build an AI modal (textbox-ai-modal.js) to automate quizzes and other features using the GPT-3.5 Turbo API. The modal allows users to generate content and auto-insert it into a textbox for later use. (COMPLETED)
28. 🚧 Add more tools to the left toolbar:
    - Vocab List Tool: Allows creation of vocabulary lists with AI-powered image generation for each word.
    - Puzzle Tool: Lets users generate and insert puzzles (e.g., crosswords, word searches) into the worksheet.
    - Reading Passage Tool: For inserting and managing reading passages, possibly with AI assistance.
    - (The toolset will continue to grow as new needs are identified.)
29. 🚧 As index.html grows, modularize:
    - Move inline scripts to dedicated JS files (one per tool/feature/modal where possible)
    - Move inline styles and style attributes to CSS files
    - Use HTML includes or JS templates for reusable UI (modals, toolbars, etc.)
    - Keep index.html focused on structure and layout only
    - This will keep the project scalable and maintainable as more tools are added
30. ✅ Add a Title/Header/Footer Tool:
    - Users can add and edit a title, header, and footer that appear on all pages.
    - Supports templated titles and multiple layout options.
    - Easy to update and preview across the worksheet. (COMPLETED)

31. 🚧 Add an automated image insertion tool that uses pixabay and lexica with api or backend.  CGDream.ai and https://www.lummi.ai/ with some others for image search


32. ✅ Print needs to ignore all modals. (FIXED)
33. ✅ Inserting a text box removes the header (FIXED)
34. ✅ Fix border modal event handler conflicts (FIXED):
    - Unified handler for border modal for both textboxes and headers.
    - No more duplicate/conflicting event handlers.
    - Modal never freezes or blocks the UI, and always reflects the correct border state for the selected element.
35. 🚧 Fix drag handle and dragging for vocab boxes and text boxes:
    - Drag handle should always appear and work reliably for both vocab boxes and text boxes.
    - Dragging should never interfere with text editing or other features.
    - Drag handle should be visible and usable on all platforms/browsers.
    - Refactor and modularize drag logic if needed for maintainability.
    - Test with long text, resizing, and all box types.
    36. 🚧 Rescale the main UI (toolbars, buttons, menubars, etc.) for better usability and visual balance across devices.