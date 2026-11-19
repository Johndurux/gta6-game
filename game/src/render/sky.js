// The sunset over the bay: a sky band that sits only above the water's horizon, with the sun low
// over the sea, a neon skyline silhouette, stars after dark and a faint haze inland.

import { WORLD } from '../core/config.js';
import { hash01 } from '../core/math.js';
import { mood, hexToRgba } from './palette.js';
import { drawGlow } from './city-view.js';

/** Where the horizon sits on screen for this frame: the top of the drawn sea. */
export function horizonScreen(view, depth = 210) {
  const shore = (WORLD.coastY - view.y) * view.zoom + view.height / 2;
  if (shore < 0) return 0;
  return Math.max(0, shore - Math.min(depth, shore));
}

export function drawSky(ctx, state, view) {
  const m = mood(state.tod);
  const w = view.width;
  const h = view.height;
  const shore = (WORLD.coastY - view.y) * view.zoom + h / 2;
  const seaTop = horizonScreen(view);
  const band = seaTop;

  if (band > 4) {
    const grad = ctx.createLinearGradient(0, 0, 0, band);
    grad.addColorStop(0, hexToRgba(m.top, 0.98));
    grad.addColorStop(0.55, hexToRgba(m.mid, 0.95));
    grad.addColorStop(0.92, hexToRgba(m.horizon, 0.95));
    grad.addColorStop(1, hexToRgba(m.horizon, 0.98));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, band);

    if (m.night < 0.8) {
      const sunX = w * (0.14 + m.sunX * 0.72);
      const sunY = band * (0.94 - m.sunY * 0.5);
      drawGlow(ctx, sunX, sunY, Math.max(70, band * 0.9), m.sun, 0.55);
      ctx.fillStyle = hexToRgba(m.sun, 0.9);
      ctx.beginPath();
      ctx.arc(sunX, sunY, 14, 0, Math.PI * 2);
      ctx.fill();
      // Its reflection on the water just below the horizon.
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = m.sun;
      ctx.fillRect(sunX - 22, band, 44, 8);
      ctx.globalAlpha = 1;
    }

    if (m.night > 0.4) {
      for (let i = 0; i < 70; i += 1) {
        const x = hash01(i, 11) * w;
        const y = hash01(i, 23) * band * 0.7;
        const twinkle = 0.4 + 0.6 * Math.abs(Math.sin(state.time * 1.4 + i));
        ctx.fillStyle = `rgba(255,255,240,${(m.night - 0.4) * 1.2 * twinkle})`;
        ctx.fillRect(x, y, 1.6, 1.6);
      }
    }

    // Distant skyline: two silhouettes, a few windows lit, sitting on the horizon.
    for (let layer = 0; layer < 2; layer += 1) {
      const colour = layer === 0 ? hexToRgba(m.top, 0.75) : 'rgba(6,6,14,0.92)';
      ctx.fillStyle = colour;
      let x = -20;
      let i = layer * 7;
      while (x < w + 40) {
        const bw = 16 + hash01(i, 3) * 40;
        const bh = 8 + hash01(i, 5) * (layer === 0 ? 40 : 62);
        ctx.fillRect(x, band - bh, bw, bh + 2);
        if (hash01(i, 9) > 0.5) {
          ctx.fillStyle = hexToRgba('#ffb340', 0.3 * m.night + 0.12);
          ctx.fillRect(x + bw * 0.3, band - bh * 0.65, 2.4, 2.4);
          ctx.fillRect(x + bw * 0.6, band - bh * 0.4, 2.4, 2.4);
          ctx.fillStyle = colour;
        }
        x += bw + 5 + hash01(i, 13) * 9;
        i += 1;
      }
    }
    // The waterline highlight.
    ctx.fillStyle = 'rgba(255,225,190,0.5)';
    ctx.fillRect(0, band - 1, w, 1.5);
    return;
  }

  // Inland: a thin band of haze so the top edge never looks cut off.
  const haze = ctx.createLinearGradient(0, 0, 0, 64);
  haze.addColorStop(0, hexToRgba(m.horizon, 0.28));
  haze.addColorStop(1, hexToRgba(m.horizon, 0));
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, w, 64);
}