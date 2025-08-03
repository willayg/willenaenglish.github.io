# MINT AI Modal & Worksheet Builder TODOs (August 2025)

## Outstanding Issues
- [ ] Formatting issues: Ensure options are always spaced consistently and never doubled, regardless of AI output format. (See recent user feedback for details.)

## Prompt System
- [ ] Refactor prompt construction to use advanced, context-aware templates (see ai.js and ai.js-1 for examples)
- [ ] Support detailed, teacher-style prompt templates for:
    - Multiple Choice
    - Fill in the Blanks
    - Open Ended
    - Reading Comprehension (future)
- [ ] Ensure prompts include explicit answer key formatting instructions
- [ ] Make prompt logic modular and easy to extend for new modes

## UI/UX
- [ ] Add a title input field above the prompt area in the modal
- [ ] Add an answer key button to the left toolbar
    - [ ] Button opens a modal for answer key review/editing
    - [ ] Allow editing and saving of answer key
- [ ] Polish modal layout and spacing for teacher-friendly experience

## Answer Key Management
- [ ] Extract answer key from AI output (where possible)
- [ ] Store answer key with worksheet section
- [ ] Allow manual editing of answer key in modal

## General
- [ ] Review and clean up code for maintainability
- [ ] Document advanced prompt template patterns for future contributors

## Completed
- [x] Multiple choice options appear on a single line below the question.
- [x] Default mode for grammar is multiple choice.
- [x] Prompt template instructs AI to use visible spaces between options.
- [x] Robustness of distractors improved (prompt engineering).
- [x] Error/warning messages for malformed AI output removed.
- [x] No more double-formatting or duplicate options in output.
- [x] Clean, modern modal UI for AI worksheet builder.
- [x] Multi-directional textbox resizing from all sides and corners with visual resize handles.
- [x] Multidirectional textbox resizing functionality finalized and verified.

---
(See ai.js and ai.js-1 for prompt template examples. Prioritize prompt system improvements before UI/answer key work.)
Add new issues above as needed. Check off completed items below.
