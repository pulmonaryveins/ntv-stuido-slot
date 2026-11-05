/**
 * Cursor over the 3D canvas. Sets body[data-cursor] instead of body.style.cursor so the pixel
 * cursors in index.css apply (an inline `cursor: pointer` would bring back the system hand).
 */
export function setStageCursor(cursor: 'pointer' | null) {
  if (cursor) document.body.dataset.cursor = cursor
  else delete document.body.dataset.cursor
}
