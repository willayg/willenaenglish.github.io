# Teachers Dashboard Spec

## Navigation information architecture

The top-level Teachers dashboard menu is a product-level contract. Do not reorder, regroup, rename, or add top-level navigation items casually.

### Group 1 — Student Information
1. Students
2. Classes

### Group 2 — Data and Tracking
3. 내신
4. Vocab
5. Grammar
6. English Arcade

### Group 3 — Tools
7. Apps
8. Utilities

## Navigation rules

- Desktop navigation must show the three group labels: **Student Information**, **Data and Tracking**, and **Tools**.
- Desktop and mobile must preserve the same item order.
- Top-level additions require an explicit product decision; app-specific views should normally live inside an existing top-level area rather than becoming another menu item.
- Puzzles is not a top-level menu item. Puzzle usage can be surfaced inside student tracking or another appropriate analytics surface.
- Class lists shown by the Teachers dashboard must follow the Admin class order from `classes.sort_order`; they must not be alphabetized independently.
- General teacher analytics should exclude the `Test` class unless a workflow explicitly needs test data.
- Browser/device Back and Forward must preserve top-level tab history and supported student drawers.
- Shared navigation behavior belongs in the dashboard history/shell layers; feature tabs should not rewrite the core navigation system.

## Current supported history states

- Top-level Teachers view
- Main Students drawer
- Grammar student drawer
- 내신 student drawer

Opening a supported drawer pushes history. Device/browser Back closes the drawer before leaving the current top-level view; Forward restores it when possible.
