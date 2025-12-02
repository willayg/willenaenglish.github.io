// worksheet-textbox-drag-resize-guide.md

# Making a Draggable and Resizable Textbox in Vanilla JS (All Edges)

## Prompt

**Prompt:**
> Make a text box that is draggable and resizable from all four edges (top, right, bottom, left) and the bottom-right corner, using only vanilla JavaScript. Show the correct resize cursor for each edge/corner. No visible resize handles. Keep the code minimal and easy to integrate.

## Instructions

1. **Create a `div` for your textbox** and set its `position: absolute`.
2. **Add mouse event listeners** to the textbox for `mousedown`, `mousemove`, and `mouseleave` to detect which edge/corner the mouse is near.
3. **On `mousedown`,** determine if the mouse is near an edge or corner (within 18px). Set a flag for which edge/corner is being resized, or set a flag for dragging.
4. **On `mousemove` (document level),** if resizing, update the width/height/position of the box according to the mouse movement and which flag is set. If dragging, update the box's position.
5. **On `mouseup`,** clear all flags and reset user-select.
6. **On `mousemove` (box level),** update the cursor to show the correct resize or move cursor depending on mouse position.
7. **Enforce minimum width/height** when resizing.
8. **No visible handles** are needed; all logic is based on mouse proximity to the edges/corner.

## Explanation

- **Edge Detection:**
  - The code checks the mouse position relative to the box (`e.offsetX`, `e.offsetY`) to see if it's within 18px of any edge or the bottom-right corner.
- **Resizing:**
  - If the mouse is near an edge/corner and the user presses the mouse button, the code sets a flag for that edge/corner and records the starting mouse position and box size/position.
  - On mousemove, the code updates the box's size and/or position based on the mouse movement and which flag is set.
  - For left/top edges, the box's position is also updated so the edge stays under the mouse.
- **Dragging:**
  - If the mouse is not near any edge/corner, the box can be dragged by clicking and moving.
- **Cursor Feedback:**
  - The cursor changes to `e-resize`, `s-resize`, `w-resize`, `n-resize`, or `se-resize` when the mouse is near the right, bottom, left, top, or bottom-right corner, respectively. Otherwise, it shows `move` or `text`.
- **Minimum Size:**
  - The code enforces a minimum width (120px) and height (40px) when resizing.
- **No Handles:**
  - There are no visible resize handles; the user resizes by dragging near the edges/corner.

## Example Code Snippet

```js
// ...inside your setupTextboxEvents function...
let resizingRight = false, resizingBottom = false, resizingDiagonal = false, resizingLeft = false, resizingTop = false;
let startX, startY, startWidth, startHeight, startLeft, startTop;

box.addEventListener('mousedown', function(e) {
  const right = box.offsetWidth - (e.offsetX || 0);
  const bottom = box.offsetHeight - (e.offsetY || 0);
  if (right < 18 && bottom < 18) { /* bottom-right corner */ }
  else if (right < 18 && bottom >= 18) { /* right edge */ }
  else if (bottom < 18 && right >= 18) { /* bottom edge */ }
  else if (e.offsetX < 18 && bottom >= 18) { /* left edge */ }
  else if (e.offsetY < 18 && right >= 18) { /* top edge */ }
  else { /* drag */ }
});

document.addEventListener('mousemove', function(e) {
  if (resizingRight) { /* update width */ }
  if (resizingLeft) { /* update width and left */ }
  if (resizingTop) { /* update height and top */ }
  // ...etc...
});

box.addEventListener('mousemove', function(e) {
  // Set cursor based on proximity to edge/corner
});
```

---

**This pattern allows for a minimal, intuitive, and handle-free drag/resize experience for textboxes in any vanilla JS project.**
