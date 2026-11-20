// The player-facing overlay: minimap of the avenues, cash, wanted stars, health, the current objective, key prompts, speed, toasts and the aim crosshair.

import { FONT, PALETTE } from '../core/config.js';
import { clamp } from '../core/math.js';
import { clockLabel, mood, hexToRgba } from './palette.js';

const MAP_RADIUS = 88;

export function drawStar(ctx, x, y, r, fill) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = x + Math.cos(a) * radius;
    const py = y + Math.sin(a) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function panel(ctx, x, y, w, h, r = 10) {
  ctx.fillStyle = 'rgba(8,8,16,0.62)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

export function drawHud(ctx, state, view, options = {}) {
  const w = view.width;
  const h = view.height;
  const m = mood(state.tod);

  // --- Objective, top left -------------------------------------------------
  const objective = state.missions.objective;
  ctx.textAlign = 'left';
  ctx.font = `700 11px ${FONT}`;
  ctx.fillStyle = PALETTE.neonAmber;
  const order = objective?.order ?? Math.min(state.missions.index + 1, state.missions.total ?? 5);
  ctx.fillText(objective ? `JOB ${order} OF ${state.missions.total ?? 5} · ${objective.title}` : 'VELARA BAY · FREE ROAM', 26, 34);
  ctx.font = `600 15px ${FONT}`;
  ctx.fillStyle = '#f6f2ea';
  const line = objective ? objective.text : 'Find a gold marker and press E to start a job';
  ctx.fillText(line, 26, 56);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(26, 66, 220, 2);
  // Story progress pips.
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < state.progress ? PALETTE.neonAmber : 'rgba(255,255,255,0.18)';
    ctx.fillRect(26 + i * 14, 74, 9, 4);
  }
  // The payslips for the jobs already finished, with what each one paid, on their own dark card so
  // the list reads against a lit street.
  const ledger = state.missions.ledger ?? [];
  if (ledger.length) {
    const cardW = 236;
    const cardH = 16 + ledger.slice(-3).length * 14;
    ctx.fillStyle = 'rgba(8,8,16,0.5)';
    ctx.beginPath();
    ctx.roundRect(20, 82, cardW, cardH, 6);
    ctx.fill();
    ctx.font = `700 9px ${FONT}`;
    ctx.fillStyle = PALETTE.hudInk;
    ctx.fillText('JOBS PAID', 26, 95);
    ledger.slice(-3).forEach((row, i) => {
      const ly = 108 + i * 14;
      ctx.font = `600 10px ${FONT}`;
      ctx.fillStyle = 'rgba(244,241,234,0.85)';
      ctx.fillText(`JOB ${row.order} · ${row.title}`, 26, ly);
      ctx.fillStyle = PALETTE.cash;
      ctx.fillText(`+$${row.reward.toLocaleString('en-US')}`, 26 + 148, ly);
    });
  }

  // --- Cash, stars, clock, top right --------------------------------------
  ctx.textAlign = 'right';
  ctx.font = `700 30px ${FONT}`;
  ctx.fillStyle = '#eafff0';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 8;
  ctx.fillText(`$${Math.round(state.cash).toLocaleString('en-US')}`, w - 26, 46);
  ctx.shadowBlur = 0;
  ctx.font = `700 10px ${FONT}`;
  ctx.fillStyle = PALETTE.hudDim;
  ctx.fillText('CASH', w - 26, 60);

  // The wanted stars, on their own card with the label, so the row still reads in a still frame.
  ctx.fillStyle = 'rgba(8,8,16,0.5)';
  ctx.beginPath();
  ctx.roundRect(w - 200, 66, 174, 32, 6);
  ctx.fill();
  ctx.font = `700 9px ${FONT}`;
  ctx.fillStyle = PALETTE.hudInk;
  ctx.textAlign = 'left';
  ctx.fillText('WANTED', w - 192, 87);
  ctx.textAlign = 'right';
  for (let i = 0; i < 5; i += 1) {
    const lit = i < state.wanted;
    const x = w - 30 - (4 - i) * 22 - 9;
    const y = 84;
    if (lit) {
      drawStar(ctx, x, y, 8.5, PALETTE.wanted);
      ctx.globalAlpha = 0.25 + 0.2 * Math.sin(state.time * 6 + i);
      drawStar(ctx, x, y, 12, PALETTE.wanted);
      ctx.globalAlpha = 1;
    } else {
      drawStar(ctx, x, y, 8.5, 'rgba(255,255,255,0.3)');
    }
  }
  ctx.textAlign = 'right';
  if (state.wanted > 0) {
    const hot = state.evadeTimer < 0.4;
    const units = state.cars.filter((c) => c.police && c.alive).length || state.wanted;
    ctx.font = `700 12px ${FONT}`;
    ctx.fillStyle = hot ? '#ff5b7a' : PALETTE.neonGreen;
    ctx.fillText(hot ? `IN PURSUIT · ${units} UNIT${units === 1 ? '' : 'S'}` : 'EVADING · STAY OUT OF SIGHT', w - 26, 116);
    ctx.font = `600 10px ${FONT}`;
    ctx.fillStyle = PALETTE.hudDim;
    ctx.fillText(`${clockLabel(state.tod)}  ·  ${m.night > 0.5 ? 'NIGHT' : 'GOLDEN HOUR'}`, w - 26, 132);
  } else {
    ctx.font = `600 11px ${FONT}`;
    ctx.fillStyle = PALETTE.hudDim;
    ctx.fillText(`${clockLabel(state.tod)}  ·  ${m.night > 0.5 ? 'NIGHT' : 'GOLDEN HOUR'}`, w - 26, 116);
  }

  // --- Minimap, bottom left ------------------------------------------------
  const cx = MAP_RADIUS + 24;
  const cy = h - MAP_RADIUS - 26;
  const scale = MAP_RADIUS / 1150;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, MAP_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(6,6,12,0.82)';
  ctx.fill();
  ctx.clip();

  ctx.fillStyle = 'rgba(86,88,116,0.5)';
  const down = state.city.downtown;
  for (const block of state.city.blocks) {
    const bx = cx + (block.x - state.player.x) * scale;
    const by = cy + (block.y - state.player.y) * scale;
    const inDown = down && (block.x + block.w / 2) >= down.x0 && (block.x + block.w / 2) <= down.x1
      && (block.y + block.h / 2) >= down.y0 && (block.y + block.h / 2) <= down.y1;
    if (inDown) {
      ctx.fillStyle = 'rgba(122,126,168,0.85)';
      ctx.fillRect(bx, by, block.w * scale, block.h * scale);
      ctx.fillStyle = 'rgba(86,88,116,0.5)';
    } else {
      ctx.fillRect(bx, by, block.w * scale, block.h * scale);
    }
  }
  // The downtown plaza reads as a lit square on the map.
  if (down?.plaza) {
    const p = down.plaza;
    const bx = cx + (p.x - state.player.x) * scale;
    const by = cy + (p.y - state.player.y) * scale;
    ctx.fillStyle = 'rgba(144,214,214,0.9)';
    ctx.fillRect(bx, by, Math.max(2, p.w * scale), Math.max(2, p.h * scale));
  }
  ctx.strokeStyle = 'rgba(225,232,255,0.72)';
  ctx.lineWidth = state.city.half * 2 * scale;
  for (const col of state.city.cols) {
    const x = cx + (col - state.player.x) * scale;
    if (x < cx - MAP_RADIUS - 10 || x > cx + MAP_RADIUS + 10) continue;
    ctx.beginPath();
    ctx.moveTo(x, cy - MAP_RADIUS);
    ctx.lineTo(x, cy + MAP_RADIUS);
    ctx.stroke();
  }
  for (const row of state.city.rows) {
    const y = cy + (row - state.player.y) * scale;
    if (y < cy - MAP_RADIUS - 10 || y > cy + MAP_RADIUS + 10) continue;
    ctx.beginPath();
    ctx.moveTo(cx - MAP_RADIUS, y);
    ctx.lineTo(cx + MAP_RADIUS, y);
    ctx.stroke();
  }
  // The bay at the top of the map.
  const coast = cy + (380 - state.player.y) * scale;
  if (coast > cy - MAP_RADIUS) {
    ctx.fillStyle = 'rgba(60,120,155,0.55)';
    ctx.fillRect(cx - MAP_RADIUS, cy - MAP_RADIUS, MAP_RADIUS * 2, Math.max(0, coast - (cy - MAP_RADIUS)));
  }

  // Blips.
  for (const p of state.pickups) {
    const bx = cx + (p.x - state.player.x) * scale;
    const by = cy + (p.y - state.player.y) * scale;
    ctx.fillStyle = PALETTE.cash;
    ctx.fillRect(bx - 1.6, by - 1.6, 3.2, 3.2);
  }
  for (const car of state.cars) {
    if (!car.alive || !car.police) continue;
    const bx = cx + (car.x - state.player.x) * scale;
    const by = cy + (car.y - state.player.y) * scale;
    ctx.fillStyle = Math.sin(state.time * 12) > 0 ? '#ff3b52' : '#4a6bff';
    ctx.beginPath();
    ctx.arc(bx, by, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  const marker = state.marker();
  if (marker) {
    const bx = cx + (marker.x - state.player.x) * scale;
    const by = cy + (marker.y - state.player.y) * scale;
    const inMap = Math.hypot(bx - cx, by - cy) < MAP_RADIUS - 6;
    if (inMap) {
      ctx.fillStyle = marker.kind === 'courier' ? PALETTE.neonCyan : PALETTE.marker;
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-4, -4, 8, 8);
      ctx.restore();
    }
  }
  // The player, always at the middle.
  const p = state.player;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(p.angle + Math.PI / 2);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, -7);
  ctx.lineTo(5, 5);
  ctx.lineTo(0, 2.5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();

  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, MAP_RADIUS, 0, Math.PI * 2);
  ctx.stroke();
  ctx.font = `700 9px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.textAlign = 'center';
  ctx.fillText('N', cx, cy - MAP_RADIUS + 12);
  ctx.textAlign = 'left';

  // Health bar above the map.
  const hw = 176;
  const hy = cy - MAP_RADIUS - 22;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.roundRect(24, hy, hw, 10, 5);
  ctx.fill();
  const hp = clamp(state.player.health / 100, 0, 1);
  const grad = ctx.createLinearGradient(24, 0, 24 + hw, 0);
  grad.addColorStop(0, '#ff4a5e');
  grad.addColorStop(0.5, '#ffb340');
  grad.addColorStop(1, '#6dff9a');
  ctx.fillStyle = hp > 0.35 ? grad : '#ff4a5e';
  ctx.beginPath();
  ctx.roundRect(24, hy, hw * hp, 10, 5);
  ctx.fill();
  ctx.font = `700 9px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText('HEALTH', 24, hy - 6);
  ctx.textAlign = 'right';
  ctx.font = `700 10px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText('RICO VALE', 24 + hw, hy - 6);
  ctx.textAlign = 'left';

  // --- Speed, bottom right -------------------------------------------------
  if (state.player.inCar && state.car) {
    const mph = Math.round(Math.hypot(state.car.vx, state.car.vy) * 0.21);
    ctx.textAlign = 'right';
    ctx.font = `700 40px ${FONT}`;
    ctx.fillStyle = '#f7f3ea';
    ctx.fillText(String(mph), w - 62, h - 44);
    ctx.font = `700 12px ${FONT}`;
    ctx.fillStyle = PALETTE.hudDim;
    ctx.fillText('MPH', w - 26, h - 48);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(w - 220, h - 32, 194, 5);
    ctx.fillStyle = state.wanted ? PALETTE.wanted : PALETTE.neonCyan;
    ctx.fillRect(w - 220, h - 32, 194 * clamp(mph / 96, 0, 1), 5);
    if (state.car.drift > 55) {
      ctx.font = `700 11px ${FONT}`;
      ctx.fillStyle = PALETTE.neonPink;
      ctx.fillText('DRIFT', w - 26, h - 12);
    }
  } else {
    ctx.textAlign = 'right';
    ctx.font = `700 11px ${FONT}`;
    ctx.fillStyle = PALETTE.hudDim;
    ctx.fillText('ON FOOT', w - 26, h - 34);
  }

  // --- Prompt --------------------------------------------------------------
  const prompt = state.missions.prompt;
  if (prompt && !state.missions.dialogue && options.showPrompt !== false) {
    ctx.font = `700 12px ${FONT}`;
    const textW = ctx.measureText(prompt.text).width;
    const boxW = textW + 62;
    const bx = w / 2 - boxW / 2;
    const by = h - 128;
    panel(ctx, bx, by, boxW, 34, 8);
    ctx.fillStyle = PALETTE.neonAmber;
    ctx.beginPath();
    ctx.roundRect(bx + 8, by + 7, 26, 20, 4);
    ctx.fill();
    ctx.fillStyle = '#12121a';
    ctx.textAlign = 'center';
    ctx.font = `700 11px ${FONT}`;
    ctx.fillText(prompt.key, bx + 21, by + 21);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f4f1ea';
    ctx.font = `600 12px ${FONT}`;
    ctx.fillText(prompt.text, bx + 42, by + 22);
  }

  // --- Toasts --------------------------------------------------------------
  ctx.textAlign = 'center';
  let ty = 132;
  for (const toast of state.toasts) {
    const alpha = clamp(toast.life / 0.6, 0, 1);
    ctx.globalAlpha = alpha;
    ctx.font = `700 15px ${FONT}`;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    const tw = ctx.measureText(toast.text).width + 30;
    ctx.fillRect(w / 2 - tw / 2, ty - 16, tw, 24);
    ctx.fillStyle = toast.color;
    ctx.fillText(toast.text, w / 2, ty);
    ctx.globalAlpha = 1;
    ty += 28;
  }

  // --- Off-screen marker arrow --------------------------------------------
  if (marker) drawMarkerArrow(ctx, state, view, marker);

  // --- Crosshair -----------------------------------------------------------
  if (state.pointerScreen && state.phase === 'play' && !state.paused) {
    const { x, y } = state.pointerScreen;
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.moveTo(x - 12, y);
    ctx.lineTo(x - 4, y);
    ctx.moveTo(x + 4, y);
    ctx.lineTo(x + 12, y);
    ctx.moveTo(x, y - 12);
    ctx.lineTo(x, y - 4);
    ctx.moveTo(x, y + 4);
    ctx.lineTo(x, y + 12);
    ctx.stroke();
  }

  // --- Night vignette ------------------------------------------------------
  if (m.night > 0.2) {
    const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, h * 0.95);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(4,4,14,${0.35 * m.night})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
}

/** An arrow at the edge of the frame pointing at a marker that is off screen. */
function drawMarkerArrow(ctx, state, view, marker) {
  const w = view.width;
  const h = view.height;
  const sx = (marker.x - view.x) * view.zoom + w / 2;
  const sy = (marker.y - view.y) * view.zoom + h / 2;
  if (sx > 60 && sx < w - 60 && sy > 90 && sy < h - 150) return;
  const dx = sx - w / 2;
  const dy = sy - h / 2;
  const angle = Math.atan2(dy, dx);
  const rx = w / 2 - 54;
  const ry = h / 2 - 88;
  const scale = Math.min(Math.abs(rx / (Math.cos(angle) || 0.001)), Math.abs(ry / (Math.sin(angle) || 0.001)));
  const px = w / 2 + Math.cos(angle) * scale;
  const py = h / 2 + Math.sin(angle) * scale;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(angle);
  ctx.fillStyle = hexToRgba(marker.kind === 'courier' ? PALETTE.neonCyan : PALETTE.marker, 0.85);
  ctx.beginPath();
  ctx.moveTo(10, 0);
  ctx.lineTo(-6, 7);
  ctx.lineTo(-6, -7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}