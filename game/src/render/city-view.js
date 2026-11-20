// Paints the ground layer the actors stand on: the bay and beach, the avenue grid with its asphalt and paint, palms and street lamps, and the 2.5D buildings with windows and neon.

import { CITY, NEON_NAMES, PALETTE, WORLD } from '../core/config.js';
import { hash01 } from '../core/math.js';
import { lightFor } from '../world/city.js';
import { mixHex, mood, hexToRgba } from './palette.js';

const glowCache = new Map();

export function glowSprite(color) {
  if (glowCache.has(color)) return glowCache.get(color);
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, hexToRgba(color, 0.9));
  grad.addColorStop(0.35, hexToRgba(color, 0.35));
  grad.addColorStop(1, hexToRgba(color, 0));
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  glowCache.set(color, c);
  return c;
}

export function drawGlow(ctx, x, y, radius, color, alpha = 1) {
  const sprite = glowSprite(color);
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(sprite, x - radius, y - radius, radius * 2, radius * 2);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}

export function drawSea(ctx, state, view) {
  const { left, right, top, bottom } = view;
  const shore = WORLD.coastY;
  if (bottom < shore - 30) return;
  const shoreScreen = (shore - view.y) * view.zoom + view.height / 2;
  const topScreen = Math.max(0, shoreScreen - Math.min(230, Math.max(0, shoreScreen)));
  const far = Math.max(shore - 1500, view.y + (topScreen - view.height / 2) / view.zoom);
  const grad = ctx.createLinearGradient(0, far, 0, shore);
  grad.addColorStop(0, '#2b2450');
  grad.addColorStop(0.5, '#38325f');
  grad.addColorStop(0.82, '#2f5a77');
  grad.addColorStop(1, '#43919f');
  ctx.fillStyle = grad;
  ctx.fillRect(left - 200, far, right - left + 400, shore - far);

  // Sun glitter and slow swell lines.
  ctx.strokeStyle = 'rgba(255,214,180,0.16)';
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 16; i += 1) {
    const y = shore - 24 - i * 26 - ((state.time * 8) % 26);
    if (y < top - 30) break;
    ctx.beginPath();
    for (let x = left - 100; x < right + 100; x += 40) {
      const yy = y + Math.sin(x * 0.013 + state.time * 1.1 + i) * 2.4;
      if (x === left - 100) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.globalAlpha = 0.06 + 0.1 * (i / 16);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Foam where the bay meets the sand.
  ctx.strokeStyle = 'rgba(240,245,255,0.5)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let x = left - 100; x < right + 100; x += 26) {
    const y = shore + Math.sin(x * 0.02 + state.time * 1.6) * 4;
    if (x === left - 100) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Boats: a hull, a cabin and a wake trailing behind.
  for (const boat of state.city.boats ?? []) {
    if (boat.x < left - 120 || boat.x > right + 120 || boat.y < top - 120 || boat.y > bottom + 60) continue;
    const bob = Math.sin(state.time * 1.6 + boat.x) * 1.5;
    ctx.save();
    ctx.translate(boat.x, boat.y + bob);
    ctx.rotate(boat.angle);
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = '#cfe8f2';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-14 * boat.size, 0);
    ctx.lineTo(-48 * boat.size, 10 * boat.size);
    ctx.moveTo(-14 * boat.size, 0);
    ctx.lineTo(-48 * boat.size, -10 * boat.size);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = boat.colour;
    ctx.beginPath();
    ctx.moveTo(20 * boat.size, 0);
    ctx.lineTo(6 * boat.size, -6 * boat.size);
    ctx.lineTo(-16 * boat.size, -6 * boat.size);
    ctx.lineTo(-16 * boat.size, 6 * boat.size);
    ctx.lineTo(6 * boat.size, 6 * boat.size);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(30,40,60,0.55)';
    ctx.fillRect(-6 * boat.size, -4 * boat.size, 10 * boat.size, 8 * boat.size);
    ctx.restore();
  }

  // The pier, plank by plank.
  const pier = state.city.pier;
  if (pier && pier.y < bottom && pier.y + pier.h > top) {
    ctx.fillStyle = 'rgba(10,8,16,0.5)';
    ctx.fillRect(pier.x + 8, pier.y + 10, pier.w, pier.h);
    ctx.fillStyle = '#3a3040';
    ctx.fillRect(pier.x, pier.y, pier.w, pier.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1;
    for (let y = pier.y; y < pier.y + pier.h; y += 12) {
      ctx.beginPath();
      ctx.moveTo(pier.x, y);
      ctx.lineTo(pier.x + pier.w, y);
      ctx.stroke();
    }
    ctx.fillStyle = '#4a3a52';
    ctx.fillRect(pier.x - 6, pier.y - 6, pier.w + 12, 12);
    drawGlow(ctx, pier.x + pier.w / 2, pier.y + 10, 60, PALETTE.neonPink, 0.35);
  }
}

export function drawBeach(ctx, state, view) {
  const { left, right, top, bottom } = view;
  const y0 = WORLD.coastY;
  const y1 = WORLD.beachY;
  if (bottom < y0 || top > y1 + 40) return;
  const grad = ctx.createLinearGradient(0, y0, 0, y1);
  grad.addColorStop(0, '#d9bc8e');
  grad.addColorStop(0.55, '#c9a578');
  grad.addColorStop(1, '#a8845c');
  ctx.fillStyle = grad;
  ctx.fillRect(left - 100, y0, right - left + 200, y1 - y0 + 4);

  // Drift lines in the sand.
  ctx.strokeStyle = 'rgba(90,60,40,0.12)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 10; i += 1) {
    const y = y0 + 16 + i * 24;
    if (y > bottom) break;
    ctx.beginPath();
    for (let x = left - 50; x < right + 50; x += 34) {
      const yy = y + Math.sin(x * 0.02 + i) * 3;
      if (x === left - 50) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }

  // The boardwalk along the sea-front, with its planks and railing.
  const bw = 34;
  ctx.fillStyle = '#6a4a3c';
  ctx.fillRect(left - 100, y1 - bw, right - left + 200, bw);
  ctx.strokeStyle = 'rgba(30,20,16,0.35)';
  for (let x = Math.floor((left - 100) / 14) * 14; x < right + 100; x += 14) {
    ctx.beginPath();
    ctx.moveTo(x, y1 - bw);
    ctx.lineTo(x, y1);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,220,180,0.16)';
  ctx.fillRect(left - 100, y1 - bw - 2, right - left + 200, 2);
}

export function drawStreets(ctx, state, view) {
  const city = state.city;
  const { left, right, top, bottom } = view;
  const half = city.half;

  // Land under everything south of the sand.
  ctx.fillStyle = '#14141c';
  ctx.fillRect(left - 100, WORLD.beachY, right - left + 200, WORLD.height - WORLD.beachY);

  // Avenues and streets first: the asphalt the paint sits on.
  ctx.fillStyle = '#20202b';
  for (const cx of city.cols) {
    if (cx + half < left || cx - half > right) continue;
    ctx.fillRect(cx - half, Math.max(WORLD.beachY, top - 40), half * 2, Math.min(WORLD.height, bottom + 40) - Math.max(WORLD.beachY, top - 40));
  }
  for (const cy of city.rows) {
    if (cy + half < top || cy - half > bottom) continue;
    ctx.fillRect(left - 40, cy - half, right - left + 80, half * 2);
  }

  // Each block: pavement ring, a darker yard inside, curbs.
  for (let i = 0; i < city.cols.length - 1; i += 1) {
    for (let j = 0; j < city.rows.length - 1; j += 1) {
      const x0 = city.cols[i] + half;
      const y0 = city.rows[j] + half;
      const x1 = city.cols[i + 1] - half;
      const y1 = city.rows[j + 1] - half;
      if (x1 < left - 60 || x0 > right + 60 || y1 < top - 60 || y0 > bottom + 60) continue;
      const park = state.city.parks.find((p) => p.x > x0 - 30 && p.y > y0 - 30 && p.x + p.w < x1 + 10 && p.y + p.h < y1 + 10);
      const down = state.city.downtown;
      const downtown = Boolean(down) && (x0 + x1) / 2 >= down.x0 && (x0 + x1) / 2 <= down.x1
        && (y0 + y1) / 2 >= down.y0 && (y0 + y1) / 2 <= down.y1;
      const sw = city.sidewalk;
      // The pavement ring, then the yard or the park inside it.
      ctx.fillStyle = park ? '#3a4a44' : downtown ? '#3f3f4e' : '#3b3b48';
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      ctx.fillStyle = park ? '#1b3b31' : downtown ? '#262734' : '#22222c';
      ctx.fillRect(x0 + sw, y0 + sw, x1 - x0 - sw * 2, y1 - y0 - sw * 2);
      if (park) {
        ctx.fillStyle = '#16362c';
        ctx.fillRect(park.x, park.y, park.w, park.h);
        ctx.fillStyle = 'rgba(190,180,150,0.22)';
        ctx.fillRect(park.x + park.w * 0.44, park.y, 14, park.h);
        ctx.fillRect(park.x, park.y + park.h * 0.46, park.w, 12);
      }
      // Paving joints and curbs, so the pavement reads as a place people walk.
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.lineWidth = 1;
      for (let sx = x0 + 18; sx < x1; sx += 26) {
        ctx.beginPath();
        ctx.moveTo(sx, y0 + 2);
        ctx.lineTo(sx, y0 + sw - 2);
        ctx.moveTo(sx, y1 - sw + 2);
        ctx.lineTo(sx, y1 - 2);
        ctx.stroke();
      }
      for (let sy = y0 + 18; sy < y1; sy += 26) {
        ctx.beginPath();
        ctx.moveTo(x0 + 2, sy);
        ctx.lineTo(x0 + sw - 2, sy);
        ctx.moveTo(x1 - sw + 2, sy);
        ctx.lineTo(x1 - 2, sy);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x0 + 1, y0 + 1, x1 - x0 - 2, y1 - y0 - 2);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x0 + sw - 1, y0 + sw - 1, x1 - x0 - sw * 2 + 2, y1 - y0 - sw * 2 + 2);
    }
  }

  // The downtown plaza and its fountain sit on top of the district's pavement ring.
  if (city.downtown?.plaza) drawPlaza(ctx, state, view, city.downtown.plaza);

  // Paint. Every avenue is a four-lane boulevard: a double-yellow centre line through the
  // junction-to-junction stretch, a dashed white divider down each half, a white kerb line and
  // angle-parked bays along it, then stop bars, turn arrows and crossings at each corner.
  drawRoadPaint(ctx, city, view);
  drawTrafficLights(ctx, state, view);

  // Street lamps: a pool of warm light after dark.
  const m = mood(state.tod);
  if (m.night > 0.15) {
    for (const lamp of city.lamps) {
      if (lamp.x < left - 60 || lamp.x > right + 60 || lamp.y < top - 60 || lamp.y > bottom + 60) continue;
      drawGlow(ctx, lamp.x, lamp.y, 74, '#ffcf94', 0.28 * (0.4 + m.night));
      ctx.fillStyle = '#0e0e14';
      ctx.beginPath();
      ctx.arc(lamp.x, lamp.y, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** The downtown plaza: laid paving, benches, a fountain with a plume and a lit monument. */
function drawPlaza(ctx, state, view, plaza) {
  if (plaza.x > view.right + 40 || plaza.x + plaza.w < view.left - 40) return;
  if (plaza.y > view.bottom + 40 || plaza.y + plaza.h < view.top - 40) return;
  const m = mood(state.tod);

  // Paving: a lighter stone square, a laid pattern of slabs, a kerb ring and two inlaid circles.
  ctx.fillStyle = '#3a3648';
  ctx.fillRect(plaza.x, plaza.y, plaza.w, plaza.h);
  ctx.fillStyle = '#423e56';
  ctx.fillRect(plaza.x + 10, plaza.y + 10, plaza.w - 20, plaza.h - 20);
  ctx.strokeStyle = 'rgba(0,0,0,0.16)';
  ctx.lineWidth = 1;
  for (let x = plaza.x + 10; x < plaza.x + plaza.w - 10; x += 24) {
    ctx.beginPath();
    ctx.moveTo(x, plaza.y + 10);
    ctx.lineTo(x, plaza.y + plaza.h - 10);
    ctx.stroke();
  }
  for (let y = plaza.y + 10; y < plaza.y + plaza.h - 10; y += 24) {
    ctx.beginPath();
    ctx.moveTo(plaza.x + 10, y);
    ctx.lineTo(plaza.x + plaza.w - 10, y);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 3;
  ctx.strokeRect(plaza.x + 1.5, plaza.y + 1.5, plaza.w - 3, plaza.h - 3);
  ctx.strokeStyle = 'rgba(214,222,248,0.2)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(plaza.fx, plaza.fy, plaza.fountainR + 44, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(plaza.fx, plaza.fy, plaza.fountainR + 58, 0, Math.PI * 2);
  ctx.stroke();

  // Benches down the two flanks.
  for (const b of plaza.benches) {
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(b.x - 13, b.y + 3, 26, 4);
    ctx.fillStyle = '#5a4632';
    ctx.fillRect(b.x - 13, b.y - 4, 26, 8);
  }

  // The fountain: basin, water, ripples, then the plume and the light it throws.
  const r = plaza.fountainR;
  ctx.fillStyle = 'rgba(6,6,12,0.32)';
  ctx.beginPath();
  ctx.ellipse(plaza.fx + 8, plaza.fy + 8, r, r * 0.86, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4c4658';
  ctx.beginPath();
  ctx.arc(plaza.fx, plaza.fy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#5d5770';
  ctx.beginPath();
  ctx.arc(plaza.fx, plaza.fy, r - 7, 0, Math.PI * 2);
  ctx.fill();
  const water = ctx.createRadialGradient(plaza.fx, plaza.fy, 4, plaza.fx, plaza.fy, r - 12);
  water.addColorStop(0, '#8fe6f5');
  water.addColorStop(0.6, '#2f8fb0');
  water.addColorStop(1, '#1a5570');
  ctx.fillStyle = water;
  ctx.beginPath();
  ctx.arc(plaza.fx, plaza.fy, r - 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(220,250,255,0.42)';
  ctx.lineWidth = 1.4;
  for (let k = 0; k < 3; k += 1) {
    const rr = 20 + ((state.time * 24 + k * 22) % (r - 24));
    ctx.globalAlpha = Math.max(0, 1 - rr / (r - 12));
    ctx.beginPath();
    ctx.arc(plaza.fx, plaza.fy, rr, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#3c3748';
  ctx.beginPath();
  ctx.arc(plaza.fx, plaza.fy, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#57506a';
  ctx.beginPath();
  ctx.arc(plaza.fx, plaza.fy, 9, 0, Math.PI * 2);
  ctx.fill();
  const plume = 76 + Math.sin(state.time * 2.2) * 6;
  const spray = ctx.createLinearGradient(plaza.fx, plaza.fy, plaza.fx, plaza.fy - plume);
  spray.addColorStop(0, 'rgba(200,244,255,0.5)');
  spray.addColorStop(0.55, 'rgba(150,220,250,0.24)');
  spray.addColorStop(1, 'rgba(150,220,250,0)');
  ctx.fillStyle = spray;
  ctx.beginPath();
  ctx.moveTo(plaza.fx - 13, plaza.fy);
  ctx.quadraticCurveTo(plaza.fx - 10, plaza.fy - plume * 0.6, plaza.fx - 6, plaza.fy - plume);
  ctx.lineTo(plaza.fx + 7, plaza.fy - plume);
  ctx.quadraticCurveTo(plaza.fx + 11, plaza.fy - plume * 0.6, plaza.fx + 14, plaza.fy);
  ctx.closePath();
  ctx.fill();
  drawGlow(ctx, plaza.fx, plaza.fy - plume * 0.45, 48, '#bfeaff', 0.18 + m.night * 0.16);
  for (let k = 0; k < 12; k += 1) {
    const t = (state.time * 0.85 + k / 12) % 1;
    const a = k * 1.7;
    ctx.fillStyle = `rgba(226,248,255,${0.5 * (1 - t)})`;
    ctx.beginPath();
    ctx.arc(plaza.fx + Math.cos(a) * (12 + t * 46), plaza.fy - Math.sin(Math.PI * t) * plume * 0.8,
      1.8 - t, 0, Math.PI * 2);
    ctx.fill();
  }

  // The monument: a plinth, a tapered stone shaft with a lit cap, and its own long shadow.
  const mo = plaza.monument;
  const mw = 30;
  const mh = 78;
  const skew = 9;
  ctx.fillStyle = 'rgba(4,4,10,0.3)';
  ctx.beginPath();
  ctx.moveTo(mo.x - mw / 2 + 15, mo.y + 15);
  ctx.lineTo(mo.x + mw / 2 + 15, mo.y + 15);
  ctx.lineTo(mo.x + mw / 2 + 15 - 46, mo.y + 15 - 22);
  ctx.lineTo(mo.x - mw / 2 + 15 - 46, mo.y + 15 - 22);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#6a6478';
  ctx.fillRect(mo.x - mw / 2 - 7, mo.y - 8, mw + 14, 16);
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1;
  ctx.strokeRect(mo.x - mw / 2 - 7, mo.y - 8, mw + 14, 16);
  const topY = mo.y - mh;
  ctx.fillStyle = '#8b86a0';
  ctx.beginPath();
  ctx.moveTo(mo.x - mw / 2, mo.y - 4);
  ctx.lineTo(mo.x + mw / 2, mo.y - 4);
  ctx.lineTo(mo.x + skew + 8, topY);
  ctx.lineTo(mo.x + skew - 8, topY);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.26)';
  ctx.stroke();
  ctx.fillStyle = '#ffd88a';
  ctx.beginPath();
  ctx.moveTo(mo.x + skew - 8, topY);
  ctx.lineTo(mo.x + skew + 8, topY);
  ctx.lineTo(mo.x + skew, topY - 17);
  ctx.closePath();
  ctx.fill();
  drawGlow(ctx, mo.x + skew, topY - 12, 24, '#ffd88a', 0.26 + m.night * 0.3);

  // Trees round the square, drawn last so their canopies sit over the paving.
  for (const t of plaza.trees) {
    const s = t.size;
    ctx.fillStyle = 'rgba(6,6,10,0.3)';
    ctx.beginPath();
    ctx.ellipse(t.x + 8 * s, t.y + 5 * s, 16 * s, 7 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3a2a24';
    ctx.lineWidth = 3 * s;
    ctx.beginPath();
    ctx.moveTo(t.x, t.y);
    ctx.lineTo(t.x + t.lean * 6, t.y - 17 * s);
    ctx.stroke();
    ctx.fillStyle = '#1c5539';
    ctx.beginPath();
    ctx.arc(t.x + t.lean * 6, t.y - 22 * s, 15 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#276b4f';
    ctx.beginPath();
    ctx.arc(t.x + t.lean * 6 - 3 * s, t.y - 26 * s, 11 * s, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Street markings: the grid reads as a four-lane boulevard network, not one lane a side. */
function drawRoadPaint(ctx, city, view) {
  const { left, right, top, bottom } = view;
  const half = city.half;
  const lane = half * 0.5;

  const inH = (cx) => cx + half >= left - 40 && cx - half <= right + 40;
  const inV = (cy) => cy + half >= top - 40 && cy - half <= bottom + 40;

  const dash = (x, y, dx, dy, color, w, on, off) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.setLineDash([on, off]);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + dx, y + dy);
    ctx.stroke();
    ctx.setLineDash([]);
  };

  // Centre lines: double yellow down the avenue, double yellow across the street.
  for (const cx of city.cols) {
    if (!inH(cx)) continue;
    const yA = Math.max(WORLD.beachY + 8, top - 60);
    const yB = Math.min(WORLD.height, bottom + 60);
    dash(cx - 2.5, yA, 0, yB - yA, 'rgba(210,178,72,0.55)', 2, 1, 0);
    dash(cx + 2.5, yA, 0, yB - yA, 'rgba(210,178,72,0.55)', 2, 1, 0);
    // Lane marker each side of the centre, dashed.
    dash(cx - lane, yA, 0, yB - yA, 'rgba(230,232,240,0.42)', 2, 20, 18);
    dash(cx + lane, yA, 0, yB - yA, 'rgba(230,232,240,0.42)', 2, 20, 18);
    // Kerb lines.
    dash(cx - half + 3, yA, 0, yB - yA, 'rgba(255,255,255,0.3)', 1.6, 34, 20);
    dash(cx + half - 3, yA, 0, yB - yA, 'rgba(255,255,255,0.3)', 1.6, 34, 20);
  }
  for (const cy of city.rows) {
    if (!inV(cy)) continue;
    const xA = Math.max(left - 60, 0);
    const xB = Math.min(right + 60, WORLD.width);
    dash(xA, cy - 2.5, xB - xA, 0, 'rgba(210,178,72,0.55)', 2, 1, 0);
    dash(xA, cy + 2.5, xB - xA, 0, 'rgba(210,178,72,0.55)', 2, 1, 0);
    dash(xA, cy - lane, xB - xA, 0, 'rgba(230,232,240,0.42)', 2, 20, 18);
    dash(xA, cy + lane, xB - xA, 0, 'rgba(230,232,240,0.42)', 2, 20, 18);
    dash(xA, cy - half + 3, xB - xA, 0, 'rgba(255,255,255,0.3)', 1.6, 34, 20);
    dash(xA, cy + half - 3, xB - xA, 0, 'rgba(255,255,255,0.3)', 1.6, 34, 20);
  }

  // Zebra crossings on every approach to every junction.
  ctx.fillStyle = 'rgba(230,232,240,0.35)';
  for (const cx of city.cols) {
    if (!inH(cx)) continue;
    for (const cy of city.rows) {
      if (!inV(cy)) continue;
      for (let k = 0; k < 4; k += 1) {
        const off = -half + 12 + k * 20;
        ctx.fillRect(cx + off, cy - half - 15, 11, 13);
        ctx.fillRect(cx + off, cy + half + 2, 11, 13);
        ctx.fillRect(cx - half - 15, cy + off, 13, 11);
        ctx.fillRect(cx + half + 2, cy + off, 13, 11);
      }
    }
  }

  // Stop bars where an approach lane meets the crossing.
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 5;
  for (const cx of city.cols) {
    if (!inH(cx)) continue;
    for (const cy of city.rows) {
      if (!inV(cy)) continue;
      ctx.fillRect(cx - half - 24, cy + 15, 4, half - 32);
      ctx.fillRect(cx + half + 20, cy + 15, 4, half - 32);
      ctx.fillRect(cx - half + 32, cy + 15, 4, half - 32);
      ctx.fillRect(cx - half + 32, cy - half - 15, 4, half - 32);
      ctx.fillRect(cx + half - 36, cy - half - 15, 4, half - 32);
    }
  }
}

/** A signal head at each corner of every junction, lit the colour traffic is seeing. */
function drawTrafficLights(ctx, state, view) {
  const city = state.city;
  const { left, right, top, bottom } = view;
  const half = city.half;
  const m = mood(state.tod);
  if (m.night < 0.08) return; // unlit heads just read as noise in daylight
  for (const cx of city.cols) {
    if (cx + half < left - 40 || cx - half > right + 40) continue;
    for (const cy of city.rows) {
      if (cy + half < top - 40 || cy - half > bottom + 40) continue;
      for (let side = 0; side < 2; side += 1) {
        const sx = cx + (side ? 1 : -1) * (half + 12);
        const hState = lightFor(city, side === 0 ? 'h' : 'v', state.time);
        ctx.fillStyle = '#1a1a24';
        ctx.fillRect(sx - 1.5, cy - 4, 3, 18);
        const lamps = hState === 'green' ? ['#33141a', '#33140d', '#3dff9a']
          : hState === 'amber' ? ['#33141a', '#ffaa2a', '#12281d']
          : ['#ff4a3a', '#33100d', '#12281d'];
        for (let i = 0; i < 3; i += 1) {
          ctx.beginPath();
          ctx.arc(sx, cy - 2 + i * 5, 2.3, 0, Math.PI * 2);
          ctx.fillStyle = lamps[i];
          ctx.fill();
        }
        if (hState !== 'red') {
          drawGlow(ctx, sx, cy + 3, 24, hState === 'green' ? '#4dff9a' : '#ffaa2a', 0.24);
        }
      }
    }
  }
}
export function drawSkids(ctx, state, view) {
  const { left, right, top, bottom } = view;
  ctx.lineCap = 'round';
  for (const skid of state.effects.skids) {
    if (skid.x < left - 40 || skid.x > right + 40 || skid.y < top - 40 || skid.y > bottom + 40) continue;
    ctx.strokeStyle = `rgba(4,4,8,${0.6 * (skid.life / skid.max)})`;
    ctx.lineWidth = skid.w;
    ctx.beginPath();
    ctx.moveTo(skid.x, skid.y);
    ctx.lineTo(skid.x + Math.cos(skid.angle) * 6, skid.y + Math.sin(skid.angle) * 6);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
}

export function drawBuildings(ctx, state, view) {
  const { left, right, top, bottom } = view;
  const m = mood(state.tod);
  const dusk = 0.08 + m.night * 0.12;
  const visible = [];
  for (const b of state.city.buildings) {
    const ext = 14 + b.height * 28;
    if (b.x + b.w < left - 40 || b.x > right + 40) continue;
    if (b.y + b.h + 20 < top - 40 || b.y - ext - 70 > bottom + 40) continue;
    visible.push(b);
  }
  visible.sort((a, b) => (a.y + a.h) - (b.y + b.h));

  // Soft ground shadows first, so no shadow lands on a roof in front.
  for (const b of visible) {
    const ext = 14 + b.height * 28;
    const skew = ext * 0.42;
    const base = b.y + b.h;
    const layers = [
      ['rgba(4,4,10,0.30)', 8, 6, ext * 0.78],
      ['rgba(4,4,10,0.20)', 13, 10, ext * 0.55],
      ['rgba(4,4,10,0.10)', 17, 13, ext * 0.32],
    ];
    for (const [fill, ox, oy, hgt] of layers) {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(b.x + 4 + skew + ox, base + oy);
      ctx.lineTo(b.x + b.w + skew + ox, base + oy);
      ctx.lineTo(b.x + b.w + skew + ox - hgt, base + oy - hgt * 0.22);
      ctx.lineTo(b.x + 4 + skew + ox - hgt, base + oy - hgt * 0.22);
      ctx.closePath();
      ctx.fill();
    }
  }

  for (const b of visible) {
    const ext = 14 + b.height * 28;
    const skew = ext * 0.42;
    const base = b.y + b.h;
    const topY = base - ext;

    // Face tones: a flat tone, a side darker by a fixed factor, a roof nearer the sky.
    let front = shade(b.tone, -0.28);
    if (dusk > 0) front = mixHex(front, m.horizon, dusk);
    let side = shade(b.tone, -0.28 - 0.38);
    if (dusk > 0) side = mixHex(side, m.horizon, dusk);
    let roofTone = shade(b.tone, 0.3 + b.height * 0.02);
    if (dusk > 0) roofTone = mixHex(roofTone, m.horizon, dusk);

    // Side face (east wall) first, so the front face and roof sit on top of it.
    ctx.fillStyle = side;
    ctx.beginPath();
    ctx.moveTo(b.x + b.w, base);
    ctx.lineTo(b.x + b.w, b.y);
    ctx.lineTo(b.x + b.w + skew, b.y - ext);
    ctx.lineTo(b.x + b.w + skew, base - ext);
    ctx.closePath();
    ctx.fill();
    // A crisp edge where the side meets the front, and a darker seam at the base.
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(b.x + b.w, base);
    ctx.lineTo(b.x + b.w + skew, base - ext);
    ctx.stroke();

    // Front face.
    ctx.fillStyle = front;
    ctx.beginPath();
    ctx.moveTo(b.x, base);
    ctx.lineTo(b.x + b.w, base);
    ctx.lineTo(b.x + b.w + skew, topY);
    ctx.lineTo(b.x + skew, topY);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(b.x, base - 2, b.w + skew, 2);

    // Windows: a grid of small quads riding the face's lean, mostly lit with a few dark cells.
    const litChance = 0.34 + m.night * 0.5;
    const cols = Math.max(2, Math.floor((b.w - 14) / 15));
    const rows = ext > 24 ? 4 : ext > 14 ? 3 : 2;
    const winW = Math.min(7, (b.w - 16) / cols - 4);
    const winH = Math.min(9, ext / rows - 3);
    const colStep = (b.w - 16) / cols;
    for (let r = 0; r < rows; r += 1) {
      const f = 0.12 + (r / rows) * 0.76;
      const wy = topY + ext * f;
      const lean = skew * f;
      for (let c = 0; c < cols; c += 1) {
        const h = hash01(b.seed, c, r);
        if (h > 0.96) continue;
        const lit = h <= litChance;
        const wx = b.x + 8 + c * colStep;
        ctx.fillStyle = lit ? (h > 0.86 ? 'rgba(255,240,210,0.95)' : 'rgba(255,196,120,0.72)')
          : 'rgba(8,10,16,0.55)';
        ctx.beginPath();
        ctx.moveTo(wx + lean, wy);
        ctx.lineTo(wx + lean + winW, wy + Math.max(1.5, lean * 0.08));
        ctx.lineTo(wx + lean + winW, wy + winH);
        ctx.lineTo(wx + lean, wy + winH);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Roof: a tarred deck inside a parapet, the footprint pushed up and over.
    const rx = b.x + skew;
    const ry = b.y - ext;
    ctx.fillStyle = roofTone;
    ctx.fillRect(rx, ry, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(rx, ry, b.w, 3);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    for (let k = 1; k < 3; k += 1) {
      const ly = ry + (b.h * k) / 3;
      ctx.beginPath();
      ctx.moveTo(rx + 4, ly);
      ctx.lineTo(rx + b.w - 4, ly);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    ctx.lineWidth = 4;
    ctx.strokeRect(rx + 3, ry + 3, b.w - 6, b.h - 6);

    // Stains on the deck.
    for (let s = 0; s < 3; s += 1) {
      if (hash01(b.seed, s, 21) < 0.45) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.1)';
      ctx.beginPath();
      ctx.ellipse(rx + b.w * (0.2 + hash01(b.seed, s, 5) * 0.6), ry + b.h * (0.2 + hash01(b.seed, s, 9) * 0.6),
        4 + hash01(b.seed, s, 13) * 10, 3 + hash01(b.seed, s, 17) * 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Rooftop plant: air handlers, a water tank, a skylight or a little pool.
    const detail = hash01(b.seed, 7, 3);
    const ux = rx + b.w * 0.16;
    const uy = ry + b.h * 0.2;
    if (detail < 0.4) {
      const uw = Math.min(30, b.w * 0.26);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(ux + 3, uy + 3, uw, 15);
      ctx.fillStyle = shade(b.tone, 0.55);
      ctx.fillRect(ux, uy, uw, 15);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.strokeRect(ux, uy, uw, 15);
      ctx.beginPath();
      ctx.moveTo(ux + 4, uy + 5);
      ctx.lineTo(ux + uw - 4, uy + 5);
      ctx.moveTo(ux + 4, uy + 10);
      ctx.lineTo(ux + uw - 4, uy + 10);
      ctx.stroke();
    } else if (detail < 0.55 && b.w > 90) {
      const pw = Math.min(48, b.w * 0.42);
      const ph = Math.min(26, b.h * 0.3);
      ctx.fillStyle = '#0f5a74';
      ctx.fillRect(rx + b.w - pw - 12, ry + 10, pw, ph);
      ctx.strokeStyle = 'rgba(130,245,255,0.65)';
      ctx.lineWidth = 1.4;
      ctx.strokeRect(rx + b.w - pw - 12, ry + 10, pw, ph);
      ctx.fillStyle = 'rgba(160,250,255,0.16)';
      ctx.fillRect(rx + b.w - pw - 12, ry + 10, pw, 3);
    } else if (detail < 0.7) {
      // Water tank on legs.
      const tx = rx + b.w * 0.68;
      const ty = ry + b.h * 0.62;
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(tx - 7, ty + 6); ctx.lineTo(tx - 5, ty + 12);
      ctx.moveTo(tx + 7, ty + 6); ctx.lineTo(tx + 5, ty + 12);
      ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.arc(tx + 2, ty + 3, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = shade(b.tone, 0.6);
      ctx.beginPath();
      ctx.arc(tx, ty, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.stroke();
    } else if (detail < 0.82) {
      ctx.fillStyle = 'rgba(10,12,20,0.55)';
      ctx.fillRect(ux, uy, Math.min(24, b.w * 0.2), 18);
      ctx.strokeStyle = 'rgba(140,220,255,0.4)';
      ctx.strokeRect(ux + 2, uy + 2, Math.min(24, b.w * 0.2) - 4, 14);
    }

    // Neon: a sign band above the shopfront, and an edge light on some roofs.
    if (b.shop && b.w > 60) {
      const bandW = Math.min(b.w - 16, 120);
      const bx = b.x + skew * 0.35;
      const by = base - 11;
      ctx.fillStyle = hexToRgba(b.neon, 0.9);
      ctx.fillRect(bx, by, bandW, 3);
      drawGlow(ctx, bx + bandW / 2, by, Math.max(28, bandW * 0.5), b.neon, 0.32 + m.night * 0.3);
      drawGlow(ctx, bx + bandW / 2, by + 20, Math.max(40, bandW * 0.7), b.neon, 0.1 + m.night * 0.16);
      if (b.label && b.w > 92) {
        ctx.font = '700 8px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = hexToRgba(b.neon, 0.95);
        ctx.textAlign = 'left';
        ctx.fillText(b.label.toUpperCase(), bx + 2, by - 3);
      }
    }
    if (b.height > 1.3) {
      ctx.strokeStyle = hexToRgba(b.neon, 0.25 + m.night * 0.5);
      ctx.lineWidth = 1.4;
      ctx.strokeRect(rx + 2, ry + 2, b.w - 4, b.h - 4);
    }
  }

  // Billboards stand above their roofs, so they are drawn after every building.
  for (const bb of state.city.billboards) {
    if (bb.x < left - 120 || bb.x > right + 120 || bb.y < top - 140 || bb.y > bottom + 80) continue;
    const x = bb.x - bb.w / 2;
    const y = bb.y - 46 - 18;
    ctx.fillStyle = '#0b0b12';
    ctx.fillRect(x - 3, y - 3, bb.w + 6, bb.h + 6);
    ctx.strokeStyle = hexToRgba(bb.color, 0.95);
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, bb.w, bb.h);
    drawGlow(ctx, bb.x, y + bb.h / 2, bb.w * 0.62, bb.color, 0.3 + m.night * 0.25);
    ctx.fillStyle = hexToRgba(bb.color, 0.16);
    ctx.fillRect(x, y, bb.w, bb.h);
    ctx.fillStyle = '#fff6ea';
    ctx.font = '700 13px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(bb.label, bb.x, y + bb.h / 2 + 1);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }
}

/** Palms: a leaning trunk and a crown of fronds, drawn over the pavement they line. */
export function drawPalms(ctx, state, view) {
  const { left, right, top, bottom } = view;
  for (const palm of state.city.palms) {
    if (palm.x < left - 70 || palm.x > right + 70 || palm.y < top - 90 || palm.y > bottom + 40) continue;
    const s = palm.size;
    ctx.fillStyle = 'rgba(6,6,10,0.35)';
    ctx.beginPath();
    ctx.ellipse(palm.x + 8 * s, palm.y + 5 * s, 20 * s, 9 * s, palm.lean, 0, Math.PI * 2);
    ctx.fill();

    const topX = palm.x + palm.lean * 26 * s;
    const topY = palm.y - 34 * s;
    ctx.strokeStyle = '#3a2a24';
    ctx.lineWidth = 3.4 * s;
    ctx.beginPath();
    ctx.moveTo(palm.x, palm.y);
    ctx.quadraticCurveTo(palm.x + palm.lean * 8, palm.y - 18 * s, topX, topY);
    ctx.stroke();

    for (let i = 0; i < 7; i += 1) {
      const a = (i / 7) * Math.PI * 2 + palm.lean + 0.3;
      const len = 22 * s + (i % 2) * 5;
      ctx.strokeStyle = i % 2 ? '#1d5240' : '#276b4f';
      ctx.lineWidth = 3 * s;
      ctx.beginPath();
      ctx.moveTo(topX, topY);
      ctx.quadraticCurveTo(topX + Math.cos(a) * len * 0.7, topY + Math.sin(a) * len * 0.7 - 6,
        topX + Math.cos(a) * len, topY + Math.sin(a) * len * 0.85 + 4);
      ctx.stroke();
    }
    ctx.fillStyle = '#153a2c';
    ctx.beginPath();
    ctx.arc(topX, topY, 4 * s, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function shade(hex, amount) {
  const p = parseInt(hex.slice(1), 16);
  const clampByte = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const r = clampByte(((p >> 16) & 255) * (1 + amount));
  const g = clampByte(((p >> 8) & 255) * (1 + amount));
  const b = clampByte((p & 255) * (1 + amount));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export { NEON_NAMES, CITY };