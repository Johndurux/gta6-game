// Sparks, smoke, skid marks, muzzle flashes, floating money labels and camera shake: every
// short-lived visual. The renderer draws what this collects; nothing here knows about drawing.

import { clamp } from '../core/math.js';

const MAX_SKIDS = 420;
const MAX_PARTICLES = 520;

export function createEffects() {
  return { particles: [], skids: [], texts: [], shake: 0, shakeX: 0, shakeY: 0, clock: 0 };
}

export function spawnSparks(fx, x, y, count, color = '#ffd98a', speed = 200) {
  for (let i = 0; i < count && fx.particles.length < MAX_PARTICLES; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.3 + Math.random());
    fx.particles.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      life: 0.24 + Math.random() * 0.45, max: 0.7, size: 1.2 + Math.random() * 2.2,
      color, kind: 'spark', drag: 3.5,
    });
  }
}

export function spawnSmoke(fx, x, y, count, color = 'rgba(200,190,210,0.5)') {
  for (let i = 0; i < count && fx.particles.length < MAX_PARTICLES; i += 1) {
    fx.particles.push({
      x: x + (Math.random() - 0.5) * 16, y: y + (Math.random() - 0.5) * 16,
      vx: (Math.random() - 0.5) * 30, vy: -12 - Math.random() * 20,
      life: 0.8 + Math.random() * 0.8, max: 1.6, size: 10 + Math.random() * 18,
      color, kind: 'smoke', drag: 1.4,
    });
  }
}

export function spawnMuzzle(fx, x, y, angle) {
  const color = '#ffe6a8';
  for (let i = 0; i < 5; i += 1) {
    const a = angle + (Math.random() - 0.5) * 0.7;
    const v = 120 + Math.random() * 160;
    fx.particles.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      life: 0.06 + Math.random() * 0.07, max: 0.13, size: 3 + Math.random() * 3,
      color, kind: 'spark', drag: 6,
    });
  }
  fx.particles.push({ x, y, vx: 0, vy: 0, life: 0.07, max: 0.07, size: 16, color, kind: 'flash', drag: 0 });
}

export function addSkid(fx, x, y, angle, w = 4) {
  if (fx.skids.length > MAX_SKIDS) fx.skids.splice(0, 12);
  fx.skids.push({ x, y, angle, w, life: 16, max: 16 });
}

export function addText(fx, x, y, text, color = '#7dff9a', size = 15) {
  fx.texts.push({ x, y, text, color, size, life: 1.5, max: 1.5 });
}

export function kickShake(fx, amount) {
  fx.shake = clamp(fx.shake + amount, 0, 26);
}

export function updateEffects(fx, dt) {
  fx.clock += dt;
  for (let i = fx.particles.length - 1; i >= 0; i -= 1) {
    const p = fx.particles[i];
    p.life -= dt;
    if (p.life <= 0) { fx.particles.splice(i, 1); continue; }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= Math.exp(-p.drag * dt);
    p.vy *= Math.exp(-p.drag * dt);
    if (p.kind === 'smoke') p.vy -= 6 * dt;
  }
  for (let i = fx.skids.length - 1; i >= 0; i -= 1) {
    fx.skids[i].life -= dt;
    if (fx.skids[i].life <= 0) fx.skids.splice(i, 1);
  }
  for (let i = fx.texts.length - 1; i >= 0; i -= 1) {
    const t = fx.texts[i];
    t.life -= dt;
    t.y -= 26 * dt;
    if (t.life <= 0) fx.texts.splice(i, 1);
  }
  fx.shake *= Math.exp(-6.5 * dt);
  if (fx.shake < 0.15) fx.shake = 0;
  const a = fx.clock * 41;
  fx.shakeX = Math.cos(a) * fx.shake + Math.cos(a * 1.7) * fx.shake * 0.4;
  fx.shakeY = Math.sin(a * 1.3) * fx.shake + Math.sin(a * 2.1) * fx.shake * 0.3;
}