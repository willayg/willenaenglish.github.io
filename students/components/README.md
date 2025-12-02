# Student Header Component

A reusable web component for student pages.

Usage:

- Include the script:
  <script defer src="/students/components/student-header.js"></script>

- Add the element:
  <student-header home-href="/index.html" home-label="Home"></student-header>

Props:
- home-href: URL to navigate when the Home button is clicked (default: /index.html).
- home-label: Text for the button (default: "Home").

Styling:
- Inherits CSS variables from page: --pri, --acc, --mut.
- Exposes parts: avatar, name, id, home-button for ::part() styling.

Behavior:
- Reads user_name, user_id, selectedEmojiAvatar from storage.
- Updates automatically on storage changes; call element.refresh() to force rerender.
