export const PANEL_RESIZE_CORNERS = ["nw", "ne", "sw", "se"];

export function calculatePanelResize(
  rect,
  corner,
  deltaX,
  deltaY,
  viewportWidth,
  viewportHeight,
) {
  const west = corner.includes("w");
  const north = corner.includes("n");
  const right = rect.left + rect.width;
  const bottom = rect.top + rect.height;
  const maxWidth = Math.max(370, Math.min(900, viewportWidth));
  const maxHeight = Math.max(300, Math.min(viewportHeight * 0.92, viewportHeight - 8));
  const width = Math.max(
    370,
    Math.min(maxWidth, rect.width + (west ? -deltaX : deltaX)),
  );
  const height = Math.max(
    300,
    Math.min(maxHeight, rect.height + (north ? -deltaY : deltaY)),
  );

  return {
    left: west ? right - width : rect.left,
    top: north ? bottom - height : rect.top,
    width,
    height,
  };
}
