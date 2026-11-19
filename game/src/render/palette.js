// The city's light: a day clock that runs from dawn through a long orange sunset into neon night.
// Sky colours, the tint laid over the streets and the world clock all come from the time of day.

const KEYS = [
  { t: 0.00, top: '#2a4a72', mid: '#7fb3c8', hor: '#ffd9a0', sun: '#fff3c4', night: 0.06 },
  { t: 0.26, top: '#2f6ea8', mid: '#8fc8dc', hor: '#ffe6b0', sun: '#fff8dd', night: 0.0 },
  { t: 0.42, top: '#4c3f7a', mid: '#e08a63', hor: '#ffc36b', sun: '#fff0b8', night: 0.16 },
  { t: 0.54, top: '#3a2158', mid: '#b3426b', hor: '#ff8a4a', sun: '#ffd88a', night: 0.4 },
  { t: 0.64, top: '#1a1338', mid: '#4a2352', hor: '#b3446a', sun: '#ff9a5a', night: 0.68 },
  { t: 0.80, top: '#0a0a1e', mid: '#161033', hor: '#3a2050', sun: '#7a5a9a', night: 0.92 },
  { t: 0.93, top: '#241a3f', mid: '#5a3457', hor: '#e88a5a', sun: '#ffd0a0', night: 0.5 },
  { t: 1.00, top: '#2a4a72', mid: '#7fb3c8', hor: '#ffd9a0', sun: '#fff3c4', night: 0.06 },
];

export function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const r = Math.round((((pa >> 16) & 255) * (1 - t)) + (((pb >> 16) & 255) * t));
  const g = Math.round((((pa >> 8) & 255) * (1 - t)) + (((pb >> 8) & 255) * t));
  const bl = Math.round(((pa & 255) * (1 - t)) + ((pb & 255) * t));
  return `#${((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1)}`;
}

export function hexToRgba(hex, alpha) {
  const p = parseInt(hex.slice(1), 16);
  return `rgba(${(p >> 16) & 255},${(p >> 8) & 255},${p & 255},${alpha})`;
}

const cache = new Map();
export function mood(tod) {
  const key = Math.round(tod * 400);
  if (cache.has(key)) return cache.get(key);
  let a = KEYS[0];
  let b = KEYS[1];
  for (let i = 0; i < KEYS.length - 1; i += 1) {
    if (tod >= KEYS[i].t && tod <= KEYS[i + 1].t) { a = KEYS[i]; b = KEYS[i + 1]; break; }
  }
  const span = b.t - a.t || 1;
  const t = Math.max(0, Math.min(1, (tod - a.t) / span));
  const result = {
    top: mixHex(a.top, b.top, t),
    mid: mixHex(a.mid, b.mid, t),
    horizon: mixHex(a.hor, b.hor, t),
    sun: mixHex(a.sun, b.sun, t),
    night: a.night + (b.night - a.night) * t,
    // The tint that sits over the streets, multiplied into the render.
    grade: tod < 0.45 ? '#bfd8ff' : tod < 0.58 ? '#ffb08a' : tod < 0.7 ? '#b06a9a' : '#4a5aa8',
    gradeAlpha: tod < 0.42 ? 0.05 : tod < 0.56 ? 0.16 : tod < 0.66 ? 0.3 : tod < 0.9 ? 0.46 : 0.24,
    sunX: 0.12 + tod * 0.95,
    sunY: Math.max(0.06, Math.sin(Math.min(1, tod / 0.62) * Math.PI) * 0.55),
  };
  cache.set(key, result);
  return result;
}

/** "19:42" for the HUD, with the game day starting at six in the morning. */
export function clockLabel(tod) {
  const hours = (6 + tod * 24) % 24;
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}