// Fixed maximum field of view preserves scouting on ultrawide screens.
export const MAX_VIEW_WIDTH = 1600;
export function viewport(cssWidth, cssHeight) {
  const scale = cssHeight / 900;
  const width = Math.min(MAX_VIEW_WIDTH, cssWidth / scale);
  return { width, height: 900, scale, offsetX: (cssWidth - width * scale) / 2 };
}
export function clampCamera(level, width, value) { return Math.max(0, Math.min(Math.max(0, level.width - width), value)); }
export function launcherView(level, width) { return clampCamera(level, width, level.origin.x - Math.min(width * .65, 360)); }
export function receiverView(level, width) { return clampCamera(level, width, level.net.x - width * (width < 650 ? .2 : .55)); }
export function targetIsOffscreen(level, width) { return level.net.x - launcherView(level, width) > width + 80; }
