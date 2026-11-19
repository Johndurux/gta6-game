// Everything under the actors: the bay and its beach, the block grid, asphalt, paint, palms, street
// lamps, and the buildings themselves as chunky 2.5D blocks with lit windows and neon signs.

import { CITY, NEON_NAMES, PALETTE, WORLD } from '../core/config.js';
import { hash01 } from '../core/math.js';
import { mood, hexToRgba } from './palette.js';

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
      const sw = city.sidewalk;
      // The pavement ring, then the yard or the park inside it.
      ctx.fillStyle = park ? '#3a4a44' : '#3b3b48';
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      ctx.fillStyle = park ? '#1b3b31' : '#22222c';
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

  // Paint: centre dashes, junction boxes, crossings.
  ctx.strokeStyle = 'rgba(214,190,120,0.35)';
  ctx.lineWidth = 2;
  ctx.setLineDash([22, 26]);
  for (const cx of city.cols) {
    if (cx + half < left || cx - half > right) continue;
    ctx.beginPath();
    ctx.moveTo(cx, Math.max(WORLD.beachY + 10, top - 40));
    ctx.lineTo(cx, Math.min(WORLD.height, bottom + 40));
    ctx.stroke();
  }
  for (const cy of city.rows) {
    if (cy + half < top || cy - half > bottom) continue;
    ctx.beginPath();
    ctx.moveTo(left - 40, cy);
    ctx.lineTo(right + 40, cy);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  for (const cx of city.cols) {
    if (cx + half < left || cx - half > right) continue;
    for (const cy of city.rows) {
      if (cy + half < top || cy - half > bottom) continue;
      // Crossings on all four sides of the junction.
      for (let k = 0; k < 5; k += 1) {
        const off = -half + 10 + k * 18;
        ctx.fillRect(cx + off, cy - half - 16, 10, 14);
        ctx.fillRect(cx + off, cy + half + 2, 10, 14);
        ctx.fillRect(cx - half - 16, cy + off, 14, 10);
        ctx.fillRect(cx + half + 2, cy + off, 14, 10);
      }
    }
  }

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

/** Tyre marks: two dark strokes per skid sample, fading with the rest of the list. */
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
  const visible = [];
  for (const b of state.city.buildings) {
    const ext = 8 + b.height * 11;
    if (b.x + b.w < left - 40 || b.x > right + 40) continue;
    if (b.y + b.h + 20 < top - 40 || b.y - ext - 70 > bottom + 40) continue;
    visible.push(b);
  }
  visible.sort((a, b) => (a.y + a.h) - (b.y + b.h));

  // Ground shadows first, so no shadow lands on a roof in front.
  ctx.fillStyle = 'rgba(4,4,10,0.42)';
  for (const b of visible) {
    const ext = 8 + b.height * 11;
    ctx.fillRect(b.x + 10, b.y + b.h - ext + 12, b.w - 4, ext + 4);
  }

  for (const b of visible) {
    const ext = 8 + b.height * 11;
    const wallY = b.y + b.h - ext;
    const dark = shade(b.tone, -0.5);
    const roofTone = shade(b.tone, 0.3 + b.height * 0.02);

    // Facade.
    ctx.fillStyle = dark;
    ctx.fillRect(b.x, wallY, b.w, ext);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(b.x, wallY, b.w, 2);

    // Windows: small warm rectangles, more of them lit as the light goes.
    const litChance = 0.18 + m.night * 0.55;
    const cols = Math.max(2, Math.floor((b.w - 12) / 15));
    const rows = ext > 22 ? 2 : 1;
    const winW = Math.min(7, (b.w - 14) / cols - 4);
    const winH = rows === 2 ? 5 : 6;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const h = hash01(b.seed, c, r);
        if (h > litChance) continue;
        const x = b.x + 8 + c * ((b.w - 16) / cols);
        const y = wallY + 5 + r * (ext / rows);
        ctx.fillStyle = h > 0.82 ? 'rgba(255,240,210,0.95)' : 'rgba(255,196,120,0.72)';
        ctx.fillRect(x, y, winW, winH);
      }
    }

    // Roof: a tarred deck inside a parapet.
    const rx = b.x;
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
      const bx = b.x + 8;
      const by = wallY + ext - 11;
      ctx.fillStyle = hexToRgba(b.neon, 0.9);
      ctx.fillRect(bx, by, bandW, 3);
      drawGlow(ctx, bx + bandW / 2, by, Math.max(28, bandW * 0.5), b.neon, 0.32 + m.night * 0.3);
      drawGlow(ctx, bx + bandW / 2, by + 20, Math.max(40, bandW * 0.7), b.neon, 0.1 + m.night * 0.16);
      if (b.label && b.w > 92) {
        ctx.font = `700 8px "Segoe UI", Arial, sans-serif`;
        ctx.fillStyle = hexToRgba(b.neon, 0.95);
        ctx.textAlign = 'left';
        ctx.fillText(b.label.toUpperCase(), bx + 2, by - 3);
      }
    }
    if (b.height > 1.3) {
      ctx.strokeStyle = hexToRgba(b.neon, 0.25 + m.night * 0.5);
      ctx.lineWidth = 1.4;
      ctx.strokeRect(b.x + 2, b.y - ext + 2, b.w - 4, b.h - 4);
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