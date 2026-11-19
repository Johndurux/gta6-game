// The people of Velara Bay: they walk the pavements around their block, scatter when a car bears
// down on them or shots go off, and lie where they fall. No pathfinding: each one heads for a
// point on the sidewalk ring of the nearest block and picks a new one when it gets there.

import { TRAFFIC, WORLD } from '../core/config.js';
import { clamp, damp, dist } from '../core/math.js';
import { isBlocked, nearestWalkTarget, randomSidewalkPoint } from './city.js';

const SHIRTS = ['#e8e1d3', '#d2604a', '#3a7ba8', '#e0b34a', '#7a5fb0', '#3f8f70', '#c9c9c9', '#b04a6e', '#4a4f5a', '#d98c3f'];
const PANTS = ['#2b3446', '#3c3a3a', '#5a4a3a', '#1f2a38', '#6a6a72', '#43304a'];
const SKIN = ['#c98d63', '#8a5a3c', '#e3b48d', '#5d3a28', '#f0c9a4', '#a26b47'];
const HAIR = ['#1a1a1a', '#2e1d12', '#5c3a20', '#c7b28a', '#26262e', '#7a4a2a'];

export function createPed(rng, x, y, opts = {}) {
  return {
    x, y, vx: 0, vy: 0,
    angle: rng.range(0, Math.PI * 2),
    speed: opts.speed ?? rng.range(30, 48),
    state: 'walk',
    panic: 0,
    down: 0,
    health: 2,
    stride: rng.range(0, Math.PI * 2),
    strideSpeed: rng.range(6, 9),
    shirt: opts.shirt ?? rng.pick(SHIRTS),
    pants: rng.pick(PANTS),
    skin: rng.pick(SKIN),
    hair: rng.pick(HAIR),
    hat: rng.chance(0.12),
    target: null,
    hostile: Boolean(opts.hostile),
    role: opts.role ?? 'civilian',
    armed: false,
    alive: true,
    scale: rng.range(0.92, 1.08),
  };
}

export function spawnPedNear(state, away = 500) {
  const rng = state.rng;
  const spot = randomSidewalkPoint(state.city, rng, state.player.x, state.player.y, away);
  const ped = createPed(rng, spot.x, spot.y, { speed: rng.range(30, 52) });
  ped.target = nearestWalkTarget(state.city, ped.x, ped.y, rng);
  state.peds.push(ped);
  return ped;
}

export function populatePeds(state) {
  for (let i = 0; i < TRAFFIC.pedCount; i += 1) spawnPedNear(state, 120);
}

/** Everybody within `radius` drops what they are doing and runs from (x, y). */
export function panicCrowd(state, x, y, radius = 340) {
  for (const ped of state.peds) {
    if (!ped.alive || ped.state === 'down') continue;
    if (dist(ped.x, ped.y, x, y) < radius) {
      ped.state = 'flee';
      ped.panic = 3.2 + state.rng.range(0, 2.4);
      ped.threatX = x;
      ped.threatY = y;
    }
  }
}

export function killPed(state, ped, vx = 0, vy = 0) {
  if (!ped.alive) return;
  ped.alive = false;
  ped.state = 'down';
  ped.down = 14;
  ped.vx = vx;
  ped.vy = vy;
  state.effects && state.effects.particles.push({
    x: ped.x, y: ped.y, vx: 0, vy: 0, life: 8, max: 8, size: 12, color: 'rgba(120,15,40,0.55)', kind: 'stain', drag: 0,
  });
}

export function updatePeds(state, dt) {
  const rng = state.rng;
  const player = state.player;
  for (let i = state.peds.length - 1; i >= 0; i -= 1) {
    const ped = state.peds[i];
    if (ped.state === 'down') {
      ped.down -= dt;
      ped.vx *= Math.exp(-4 * dt);
      ped.vy *= Math.exp(-4 * dt);
      ped.x += ped.vx * dt;
      ped.y += ped.vy * dt;
      if (ped.down <= 0) state.peds.splice(i, 1);
      continue;
    }

    ped.stride += dt * ped.strideSpeed * (ped.state === 'flee' ? 1.6 : 1);
    let speed = ped.speed;
    let tx = ped.target ? ped.target.x : ped.x;
    let ty = ped.target ? ped.target.y : ped.y;

    if (ped.state === 'flee') {
      ped.panic -= dt;
      speed = ped.speed * 3.4;
      const ax = ped.x - (ped.threatX ?? player.x);
      const ay = ped.y - (ped.threatY ?? player.y);
      const d = Math.hypot(ax, ay) || 1;
      tx = ped.x + (ax / d) * 120;
      ty = ped.y + (ay / d) * 120;
      if (ped.panic <= 0) {
        ped.state = 'walk';
        ped.target = nearestWalkTarget(state.city, ped.x, ped.y, rng);
      }
    } else if (ped.hostile) {
      // Dealers and rivals stand their ground until the shooting starts, then they run for cover.
      const d = dist(ped.x, ped.y, player.x, player.y);
      if (d < 260) {
        tx = player.x;
        ty = player.y;
        speed = 22;
      }
    }

    const dx = tx - ped.x;
    const dy = ty - ped.y;
    const d = Math.hypot(dx, dy);
    if (d < 10) {
      if (!ped.hostile) ped.target = nearestWalkTarget(state.city, ped.x, ped.y, rng);
    } else {
      const nx = dx / d;
      const ny = dy / d;
      const step = speed * dt;
      const nextX = ped.x + nx * step;
      const nextY = ped.y + ny * step;
      if (!isBlocked(state.city, nextX, nextY, 6)) {
        ped.x = nextX;
        ped.y = nextY;
        ped.angle = Math.atan2(ny, nx);
      } else {
        ped.target = nearestWalkTarget(state.city, ped.x, ped.y, rng);
        ped.x += Math.cos(ped.angle + Math.PI / 2) * step * 0.4;
        ped.y += Math.sin(ped.angle + Math.PI / 2) * step * 0.4;
      }
    }

    ped.x = clamp(ped.x, 20, WORLD.width - 20);
    ped.y = clamp(ped.y, WORLD.coastY + 20, WORLD.height - 20);

    if (dist(ped.x, ped.y, player.x, player.y) > 2200) {
      state.peds.splice(i, 1);
    }
    if (state.peds.length < TRAFFIC.pedCount - 6 && rng.chance(dt * 0.4)) spawnPedNear(state, 900);
  }
}

/**
 * Cars against people. A body at speed knocks a pedestrian down and earns heat; doing it in front
 * of a patrol is the quickest way to a pursuit.
 */
export function pedestriansVsCars(state) {
  for (const ped of state.peds) {
    if (!ped.alive) continue;
    for (const car of state.cars) {
      if (!car.alive) continue;
      const moving = car.driven || car.police ? Math.hypot(car.vx, car.vy) : Math.abs(car.speed ?? 0);
      if (moving < 70) continue;
      if (Math.abs(car.x - ped.x) > 34 || Math.abs(car.y - ped.y) > 34) continue;
      if (dist(car.x, car.y, ped.x, ped.y) > 30) continue;
      const vx = (car.vx ?? Math.cos(car.angle) * car.speed) * 1.1;
      const vy = (car.vy ?? Math.sin(car.angle) * car.speed) * 1.1;
      killPed(state, ped, vx, vy);
      state.effects && state.effects.particles.length < 400 && spawnHit(state, ped.x, ped.y);
      if (car.driven) state.commitCrime('hit-and-run', 0.9, ped.x, ped.y);
      break;
    }
  }
}

function spawnHit(state, x, y) {
  for (let i = 0; i < 8; i += 1) {
    const a = Math.random() * Math.PI * 2;
    state.effects.particles.push({
      x, y, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90, life: 0.5, max: 0.5,
      size: 3, color: '#b3173a', kind: 'spark', drag: 4,
    });
  }
}

/** Pedestrians near a point, for a mission's targets. */
export function pedsNear(state, x, y, radius) {
  return state.peds.filter((p) => p.alive && dist(p.x, p.y, x, y) < radius);
}

export { damp };