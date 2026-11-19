// Geometry and timing helpers shared by the simulation and the renderer.

export const TAU = Math.PI * 2;

export function clamp(value, lo, hi) {
  return value < lo ? lo : value > hi ? hi : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Frame-rate independent easing toward a target: `rate` is the fraction left after one second. */
export function damp(current, target, rate, dt) {
  return target + (current - target) * Math.exp(-rate * dt);
}

export function approach(current, target, step) {
  if (current < target) return Math.min(current + step, target);
  return Math.max(current - step, target);
}

/** Shortest signed difference between two angles, in (-PI, PI]. */
export function angleDelta(from, to) {
  let d = (to - from) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

export function angleTo(x, y, tx, ty) {
  return Math.atan2(ty - y, tx - x);
}

export function dist(x, y, tx, ty) {
  return Math.hypot(tx - x, ty - y);
}

export function dist2(x, y, tx, ty) {
  const dx = tx - x;
  const dy = ty - y;
  return dx * dx + dy * dy;
}

export function pointInRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

/** Distance from a point to a rectangle (0 when inside). */
export function rectDistance(x, y, r) {
  const dx = Math.max(r.x - x, 0, x - (r.x + r.w));
  const dy = Math.max(r.y - y, 0, y - (r.y + r.h));
  return Math.hypot(dx, dy);
}

/** Push a circle out of a rectangle; returns the corrected point or null when it never overlapped. */
export function circleRectPush(x, y, radius, r) {
  const cx = clamp(x, r.x, r.x + r.w);
  const cy = clamp(y, r.y, r.y + r.h);
  const dx = x - cx;
  const dy = y - cy;
  const d = Math.hypot(dx, dy);
  if (d > radius) return null;
  if (d > 0.0001) return { x: cx + (dx / d) * radius, y: cy + (dy / d) * radius, nx: dx / d, ny: dy / d };
  // Dead centre: the smallest axis push wins.
  const left = x - r.x;
  const right = r.x + r.w - x;
  const top = y - r.y;
  const bottom = r.y + r.h - y;
  const m = Math.min(left, right, top, bottom);
  if (m === left) return { x: r.x - radius, y, nx: -1, ny: 0 };
  if (m === right) return { x: r.x + r.w + radius, y, nx: 1, ny: 0 };
  if (m === top) return { x, y: r.y - radius, nx: 0, ny: -1 };
  return { x, y: r.y + r.h + radius, nx: 0, ny: 1 };
}

/** A stable 0..1 hash from integers, for per-building detail that never changes. */
export function hash01(a, b = 0, c = 0) {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x165667b1, 0xc2b2ae35) ^ Math.imul(c + 0x27d4eb2f, 0x27d4eb2f);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2545f491);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

/** Mix two #rrggbb colours, t=0 gives a, t=1 gives b. */
export function mixColor(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const r = Math.round(lerp((pa >> 16) & 255, (pb >> 16) & 255, t));
  const g = Math.round(lerp((pa >> 8) & 255, (pb >> 8) & 255, t));
  const bl = Math.round(lerp(pa & 255, pb & 255, t));
  return `rgb(${r},${g},${bl})`;
}