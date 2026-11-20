// Cars, people, the player, arrows of light over markers, dropped cash, bullets and particles.
// Everything is shape-drawn: rounded bodies, windscreens, headlights, swinging legs, muzzle glow.

import { CAR_SIZE, PALETTE } from '../core/config.js';
import { clamp } from '../core/math.js';
import { mood, hexToRgba } from './palette.js';
import { shade, drawGlow } from './city-view.js';

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

const TAILLIGHT = '#ff3b52';

export function drawCar(ctx, car, state) {
  if (!car.alive) return;
  const m = mood(state.tod);
  const len = CAR_SIZE.length;
  const wid = CAR_SIZE.width;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);

  // Shadow and body.
  if (car.driven) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(63,240,255,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 0, len * 0.72, wid * 0.95, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  roundRect(ctx, -len / 2 + 2, -wid / 2 + 4, len, wid, 7);
  ctx.fill();
  ctx.fillStyle = car.color;
  roundRect(ctx, -len / 2, -wid / 2, len, wid, 7);
  ctx.fill();
  ctx.strokeStyle = car.driven ? 'rgba(190,255,255,0.85)' : 'rgba(0,0,0,0.45)';
  ctx.lineWidth = car.driven ? 1.4 : 1;
  ctx.stroke();
  // A racing stripe down the middle of the car the player is in.
  ctx.fillStyle = car.driven ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.1)';
  ctx.fillRect(-len / 2 + 6, -1.4, len - 12, 2.8);

  // A painted highlight along the driver's side.
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  roundRect(ctx, -len / 2 + 4, -wid / 2 + 2, len - 10, 3, 1.5);
  ctx.fill();

  // Cabin and glass.
  ctx.fillStyle = shade(car.color, -0.42);
  roundRect(ctx, -len * 0.2, -wid / 2 + 3, len * 0.46, wid - 6, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(150,205,235,0.55)';
  roundRect(ctx, len * 0.14, -wid / 2 + 4, len * 0.12, wid - 8, 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(120,170,210,0.35)';
  roundRect(ctx, -len * 0.26, -wid / 2 + 4, len * 0.08, wid - 8, 2);
  ctx.fill();

  // Lights.
  ctx.fillStyle = '#ffeec2';
  ctx.fillRect(len / 2 - 3, -wid / 2 + 3, 2.5, 4);
  ctx.fillRect(len / 2 - 3, wid / 2 - 7, 2.5, 4);
  ctx.fillStyle = TAILLIGHT;
  ctx.fillRect(-len / 2 + 1, -wid / 2 + 3, 2, 4);
  ctx.fillRect(-len / 2 + 1, wid / 2 - 7, 2, 4);

  if (car.police) {
    // A roof bar that reads at any zoom: a dark housing, both lenses lit, and the colour thrown on
    // the tarmac round the car, alternating red and blue on the siren's own clock.
    ctx.fillStyle = '#0d0d14';
    roundRect(ctx, -8, -wid / 2 + 1, 17, 8, 2);
    ctx.fill();
    const flash = Math.sin(state.time * 14 + (car.siren ?? 0) * 6) > 0;
    ctx.fillStyle = flash ? '#ff2d4a' : '#1b2340';
    ctx.fillRect(-7, -wid / 2 + 2, 7, 6);
    ctx.fillStyle = flash ? '#1b2340' : '#3a5bff';
    ctx.fillRect(1, -wid / 2 + 2, 7, 6);
    ctx.fillStyle = '#f2f4ff';
    ctx.fillRect(-8, wid / 2 - 8, 16, 3);
    drawGlow(ctx, 0, 0, 86, flash ? '#ff2d4a' : '#3a5bff', 0.6);
    drawGlow(ctx, flash ? 5 : -5, 0, 40, flash ? '#ff2d4a' : '#5b7bff', 0.85);
  }
  ctx.restore();

  // The light bar's colour on the road under the cruiser, so a chase reads from any camera.
  if (car.police) {
    const flash = Math.sin(state.time * 14 + (car.siren ?? 0) * 6) > 0;
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.globalCompositeOperation = 'lighter';
    const halo = ctx.createRadialGradient(0, 0, 4, 0, 0, 96);
    halo.addColorStop(0, flash ? 'rgba(255,45,74,0.5)' : 'rgba(58,91,255,0.5)');
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, 96, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }

  // Headlight cones after dark.
  if (m.night > 0.12) {
    const beam = 74 + m.night * 40;
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.globalCompositeOperation = 'lighter';
    const grad = ctx.createLinearGradient(len / 2, 0, len / 2 + beam, 0);
    grad.addColorStop(0, `rgba(255,235,190,${0.22 * m.night + 0.05})`);
    grad.addColorStop(1, 'rgba(255,235,190,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(len / 2 - 2, -wid / 2 + 3);
    ctx.lineTo(len / 2 + beam, -wid / 2 - 12);
    ctx.lineTo(len / 2 + beam, wid / 2 + 12);
    ctx.lineTo(len / 2 - 2, wid / 2 - 3);
    ctx.closePath();
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }
}

export function drawPed(ctx, ped, state) {
  if (!ped.alive) {
    // Down on the pavement.
    ctx.save();
    ctx.translate(ped.x, ped.y);
    ctx.rotate(ped.angle + Math.PI / 2);
    ctx.globalAlpha = clamp(ped.down / 3, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(3, 4, 17, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.shirt;
    roundRect(ctx, -7, -12, 14, 24, 6);
    ctx.fill();
    ctx.fillStyle = ped.skin;
    ctx.beginPath();
    ctx.arc(0, -14, 5.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
    return;
  }
  const swing = Math.sin(ped.stride) * (ped.state === 'flee' ? 4.4 : 2.6);
  ctx.save();
  ctx.translate(ped.x, ped.y);
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.beginPath();
  ctx.ellipse(2.5, 4, 10 * ped.scale, 5 * ped.scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(ped.angle + Math.PI / 2);
  ctx.scale(ped.scale, ped.scale);

  // Legs.
  ctx.fillStyle = ped.pants;
  ctx.beginPath();
  ctx.ellipse(-3.4, 4 + swing, 3.2, 5, 0, 0, Math.PI * 2);
  ctx.ellipse(3.4, 4 - swing, 3.2, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Torso, arms, head.
  ctx.fillStyle = ped.shirt;
  roundRect(ctx, -6.4, -7, 12.8, 14, 5);
  ctx.fill();
  ctx.fillStyle = ped.skin;
  ctx.beginPath();
  ctx.arc(-7, -1 + swing * 0.5, 2.6, 0, Math.PI * 2);
  ctx.arc(7, -1 - swing * 0.5, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, -5.4, 5.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ped.hair;
  ctx.beginPath();
  ctx.arc(0, -6.6, 4.6, Math.PI * 0.9, Math.PI * 2.1);
  ctx.fill();
  if (ped.hat) {
    ctx.fillStyle = '#1d1d24';
    ctx.beginPath();
    ctx.arc(0, -6.6, 5.4, Math.PI, Math.PI * 2);
    ctx.fill();
  }
  if (ped.hostile) {
    ctx.strokeStyle = 'rgba(255,60,80,0.7)';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(-7.4, -8, 14.8, 16);
  }
  ctx.restore();

  // Scattering: a pedestrian running from a car gets the panic mark and dust off the heels, so a
  // crowd breaking up reads in a still frame.
  if (ped.state === 'flee') {
    ctx.save();
    ctx.translate(ped.x, ped.y);
    ctx.font = '700 13px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillText('!', 1, -20);
    ctx.fillStyle = '#ffd24a';
    ctx.fillText('!', 0, -21);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#cfc8c0';
    const backX = -Math.cos(ped.angle) * 12;
    const backY = -Math.sin(ped.angle) * 12;
    ctx.beginPath();
    ctx.arc(backX, backY + 3, 4.5, 0, Math.PI * 2);
    ctx.arc(backX * 1.7, backY * 1.7 + 3, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

export function drawPlayer(ctx, state) {
  const p = state.player;
  if (p.inCar) return;
  const m = mood(state.tod);
  const sprint = p.footSpeed > 200;
  const swing = Math.sin(p.step) * (sprint ? 5.2 : 3.4);
  ctx.save();
  ctx.translate(p.x, p.y);
  drawGlow(ctx, p.x, p.y + 2, 30, '#3ff0ff', 0.16);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(3, 5, 12, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(120,245,255,0.35)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(0, 4, 14, 7, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Aim line: a thin dashed ray with a small bracket where it lands.
  ctx.save();
  ctx.rotate(p.aim);
  ctx.strokeStyle = 'rgba(120,240,255,0.28)';
  ctx.lineWidth = 1.2;
  ctx.setLineDash([5, 7]);
  ctx.beginPath();
  ctx.moveTo(16, 0);
  ctx.lineTo(clamp(state.aimDistance, 60, 420), 0);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  ctx.rotate(p.angle + Math.PI / 2);
  // Legs.
  ctx.fillStyle = '#1c2430';
  ctx.beginPath();
  ctx.ellipse(-3.8, 5 + swing, 3.5, 5.6, 0, 0, Math.PI * 2);
  ctx.ellipse(3.8, 5 - swing, 3.5, 5.6, 0, 0, Math.PI * 2);
  ctx.fill();
  // Jacket.
  ctx.fillStyle = '#20b3ad';
  roundRect(ctx, -7.4, -8, 14.8, 16, 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  roundRect(ctx, -7.4, -8, 14.8, 4, 4);
  ctx.fill();
  // Arms.
  ctx.fillStyle = '#0f8c88';
  ctx.beginPath();
  ctx.arc(-8, 0 + swing * 0.6, 3, 0, Math.PI * 2);
  ctx.arc(8, 0 - swing * 0.6, 3, 0, Math.PI * 2);
  ctx.fill();
  // Head, hair.
  ctx.fillStyle = '#e9c49a';
  ctx.beginPath();
  ctx.arc(0, -6.2, 5.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a1a20';
  ctx.beginPath();
  ctx.arc(0, -7.6, 5, Math.PI * 0.92, Math.PI * 2.08);
  ctx.fill();
  ctx.restore();

  // The pistol, held out toward the aim.
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.aim);
  ctx.fillStyle = '#14141a';
  ctx.fillRect(12, -1.4, 9, 3);
  ctx.fillStyle = 'rgba(255,220,150,0.28)';
  ctx.fillRect(20, -1, 3, 2);
  ctx.restore();
  if (state.weapon && state.weapon.kick > 0) {
    drawGlow(ctx, p.x + Math.cos(p.aim) * 22, p.y + Math.sin(p.aim) * 22, 26, '#ffd98a', state.weapon.kick * 0.6);
  }
  if (m.night > 0.2) drawGlow(ctx, p.x, p.y, 34, '#5fe6e0', 0.1);
}

export function drawMarker(ctx, marker, state) {
  if (!marker) return;
  const pulse = 0.5 + 0.5 * Math.sin(state.time * 2.6);
  const color = marker.kind === 'courier' ? PALETTE.neonCyan : PALETTE.marker;
  const r = (marker.radius ?? 80) * (0.55 + pulse * 0.12);
  ctx.save();
  ctx.strokeStyle = hexToRgba(color, 0.5 + pulse * 0.3);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(marker.x, marker.y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = hexToRgba(color, 0.16);
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(marker.x, marker.y, r * 0.72, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = hexToRgba(color, 0.08);
  ctx.beginPath();
  ctx.arc(marker.x, marker.y, r, 0, Math.PI * 2);
  ctx.fill();

  // A diamond bobbing over the spot.
  const bob = Math.sin(state.time * 3) * 4;
  const y = marker.y - 34 + bob;
  ctx.translate(marker.x, y);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = color;
  ctx.fillRect(-7, -7, 14, 14);
  ctx.strokeStyle = 'rgba(10,10,16,0.6)';
  ctx.lineWidth = 2;
  ctx.strokeRect(-7, -7, 14, 14);
  ctx.restore();
  drawGlow(ctx, marker.x, marker.y - 34 + bob, 42, color, 0.4);
  if (marker.label) {
    ctx.font = '700 11px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(8,8,14,0.6)';
    const w = ctx.measureText(marker.label).width + 12;
    ctx.fillRect(marker.x - w / 2, marker.y - 66 + bob, w, 16);
    ctx.fillStyle = color;
    ctx.fillText(marker.label, marker.x, marker.y - 54 + bob);
    ctx.textAlign = 'left';
  }
}

export function drawPickups(ctx, state) {
  for (const p of state.pickups) {
    const bob = Math.sin(state.time * 3 + (p.phase ?? 0)) * 2.5;
    drawGlow(ctx, p.x, p.y + bob, 30, PALETTE.cash, 0.4);
    ctx.fillStyle = '#0f3a22';
    roundRect(ctx, p.x - 9, p.y - 7 + bob, 18, 14, 3);
    ctx.fill();
    ctx.fillStyle = PALETTE.cash;
    ctx.fillRect(p.x - 9, p.y - 7 + bob, 18, 3);
    ctx.font = '700 9px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#d9ffe4';
    ctx.textAlign = 'center';
    ctx.fillText('$', p.x, p.y + 2.5 + bob);
    ctx.textAlign = 'left';
  }
  for (const crate of state.missions.crates ?? []) {
    if (crate.taken) continue;
    const bob = Math.sin(state.time * 2.5 + crate.phase) * 2;
    drawGlow(ctx, crate.x, crate.y, 40, PALETTE.neonCyan, 0.35);
    ctx.save();
    ctx.translate(crate.x, crate.y + bob);
    ctx.fillStyle = '#3a2a1c';
    ctx.fillRect(-12, -10, 24, 20);
    ctx.fillStyle = '#5a4028';
    ctx.fillRect(-12, -10, 24, 4);
    ctx.strokeStyle = PALETTE.neonCyan;
    ctx.lineWidth = 1.4;
    ctx.strokeRect(-12, -10, 24, 20);
    ctx.restore();
  }
}

export function drawBullets(ctx, state) {
  ctx.lineCap = 'round';
  for (const b of state.bullets) {
    ctx.strokeStyle = b.hostile ? 'rgba(255,150,120,0.9)' : 'rgba(255,240,190,0.95)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - b.vx * 0.018, b.y - b.vy * 0.018);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
}

export function drawParticles(ctx, state) {
  const fx = state.effects;
  for (const p of fx.particles) {
    const t = clamp(p.life / p.max, 0, 1);
    if (p.kind === 'stain') {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.size, p.size * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'smoke') {
      ctx.globalAlpha = t * 0.5;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1.6 - t), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else if (p.kind === 'flash') {
      drawGlow(ctx, p.x, p.y, p.size * 2.4, p.color, t);
    } else {
      ctx.strokeStyle = p.color;
      ctx.globalAlpha = t;
      ctx.lineWidth = p.size * 0.7;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 0.02, p.y - p.vy * 0.02);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  ctx.font = '700 14px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  for (const t of fx.texts) {
    ctx.globalAlpha = clamp(t.life / t.max, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillText(t.text, t.x + 1, t.y + 1);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
    ctx.globalAlpha = 1;
  }
  ctx.textAlign = 'left';
}