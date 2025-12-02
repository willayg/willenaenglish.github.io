## Dark Mode Overrides (2025-09-30)

Added additional dark theme support inside `students/theme.css` for Word Arcade live modes:

- Quit Game pill button (`#wa-quit-btn`)
- Time Battle UI (`.tb-wrap`, `.tb-card`, `.tb-meta`, `.tb-title`, spelling input `#tbSpellInput`)
- Star overlay panel (`.star-round-overlay`, `.star-round-panel`)
- Sample word list modal structural elements
- End-of-game / summary panels in sentence & full arcade modes (inline-styled white backgrounds)
- Choice button splash animations now use dark-friendly backgrounds to prevent white flash.

Implementation notes:
1. All overrides are scoped under `html.dark` to avoid affecting light mode.
2. Colors reference the shared dark tokens when possible (`--bg-surface`, `--text-high`, `--text-mid`).
3. High-contrast teal `#67e2e6` used for primary accent text/borders on dark background.
4. Animations for `.splash-correct` / `.splash-wrong` have dark variants defined directly in `ui/buttons.js`.

If new UI components are added with inline light backgrounds, prefer adding a semantic class and extending the dark block in `students/theme.css` rather than more inline style substring selectors.
