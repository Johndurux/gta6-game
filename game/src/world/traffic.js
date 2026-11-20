// Traffic: park cars along the curbs, run the rest down the lanes, keep them from driving through
// each other, the player or a red light, and recycle the ones that fall too far behind.

import { CAR_SIZE, CITY, TRAFFIC, WORLD } from '../core/config.js';
import { clamp, dist } from '../core/math.js';
import { lightFor, nextJunction, randomLanePoint } from './city.js';

export const BODY_COLORS = ['#c8402f', '#2f6fa8', '#d9c37a', '#3b3f4a', '#e0e2e6', '#5a2d6e', '#2f8f6b', '#b8563a', '#8d8f96', '#243a5e'];

export function createCar(x, y, angle, kind = 'sedan', color = '#c8402f') {
  return {
    x, y, angle, vx: 0, vy: 0,
    kind, color,
    length: CAR_SIZE.length, width: CAR_SIZE.width,
    speed: 0, axis: null, dir: 1, lane: 0, cruise: TRAFFIC.cruise,
    alive: true, hp: 3, police: false, driven: false, parked: true,
    brake: 0, wobble: 0, id: Math.random(),
  };
}

export function spawnTrafficCar(state, spot = null, rng = state.rng) {
  const at = spot ?? randomLanePoint(state.city, rng, state.player.x, state.player.y, 620, 1500);
  const color = BODY_COLORS[rng.int(BODY_COLORS.length)];
  const kind = rng.chance(0.16) ? 'van' : rng.chance(0.2) ? 'sport' : 'sedan';
  const car = createCar(at.x, at.y, at.axis === 'h' ? (at.dir > 0 ? 0 : Math.PI) : (at.dir > 0 ? Math.PI / 2 : -Math.PI / 2), kind, color);
  car.axis = at.axis;
  car.dir = at.dir;
  car.lane = at.lane;
  car.parked = false;
  car.cruise = TRAFFIC.cruise + rng.range(-TRAFFIC.cruiseJitter, TRAFFIC.cruiseJitter);
  car.speed = car.cruise * rng.range(0.4, 1);
  state.cars.push(car);
  return car;
}

/** A car left at the kerb, angled with its street: the free cars the player can take. */
export function spawnParkedCar(state, near = null) {
  const rng = state.rng;
  const horizontal = rng.chance(0.5);
  const city = state.city;
  let x;
  let y;
  let angle;
  const kerb = CITY.roadHalf - 8;
  if (horizontal) {
    const cy = city.rows[rng.int(city.rows.length)];
    const side = rng.sign();
    y = cy + side * kerb;
    x = near ? clamp(near.x + rng.range(-700, 700), 120, WORLD.width - 120) : rng.range(120, WORLD.width - 120);
    angle = side > 0 ? Math.PI : 0;
  } else {
    const cx = city.cols[rng.int(city.cols.length)];
    const side = rng.sign();
    x = cx + side * kerb;
    y = near ? clamp(near.y + rng.range(-700, 700), WORLD.coastY + 80, WORLD.height - 120) : rng.range(WORLD.coastY + 80, WORLD.height - 120);
    angle = side > 0 ? -Math.PI / 2 : Math.PI / 2;
  }
  return spawnParkedCarAt(state, { x, y, angle });
}

/** A car parked at an exact kerb bay, used for the downtown parking rows. */
export function spawnParkedCarAt(state, spot) {
  const rng = state.rng;
  const car = createCar(spot.x, spot.y, spot.angle, rng.pick(['sedan', 'sport', 'van']), BODY_COLORS[rng.int(BODY_COLORS.length)]);
  car.parked = true;
  car.cruise = 0;
  state.cars.push(car);
  return car;
}

/** Fill the streets around the player at boot and keep the count up as the city scrolls past. */
export function populateTraffic(state) {
  for (let i = 0; i < TRAFFIC.count; i += 1) spawnTrafficCar(state);
  for (let i = 0; i < 40; i += 1) spawnParkedCar(state, state.player);
  // The downtown kerbs are always lined: one car in every few bays, spread across the district.
  const spots = state.city.parking ?? [];
  const step = Math.max(1, Math.floor(spots.length / 26));
  for (let i = 0; i < spots.length; i += step) spawnParkedCarAt(state, spots[i]);
}

/**
 * One traffic step. Speed is a target the car eases toward; it drops to zero for the car ahead,
 * for the player standing or driving in its lane, and for a red light at the next junction.
 */
export function updateTraffic(state, dt) {
  const player = state.player;
  const playerCar = state.car;
  for (const car of state.cars) {
    if (!car.alive || car.parked || car.police || car.driven) continue;

    let target = car.cruise;
    for (const other of state.cars) {
      if (other === car || !other.alive || other.parked) continue;
      if (other.axis !== car.axis) continue;
      if (Math.abs(other.lane - car.lane) > 18) continue;
      if (other.dir !== car.dir) continue;
      const ahead = along(car.axis, other, car) * car.dir;
      if (ahead > 0 && ahead < TRAFFIC.lookAhead + car.speed * 0.35) {
        target = Math.min(target, clamp((ahead - TRAFFIC.keepGap) * 2.4, 0, car.cruise));
      }
    }

    if (playerCar && player.inCar) {
      const pAhead = along(car.axis, playerCar, car) * car.dir;
      const pSide = lateral(car.axis, playerCar, car);
      if (pAhead > 0 && pAhead < 150 && Math.abs(pSide) < 40) {
        target = Math.min(target, clamp((pAhead - 60) * 3, 0, car.cruise));
      }
    } else if (Math.abs(lateral(car.axis, player, car)) < 32) {
      const pAhead = along(car.axis, player, car) * car.dir;
      if (pAhead > 0 && pAhead < 120) target = Math.min(target, clamp((pAhead - 44) * 3, 0, car.cruise));
    }

    const junction = nextJunction(state.city, car.axis, car.x, car.y, car.dir);
    const light = lightFor(state.city, car.axis, state.time);
    if (junction < 190 && light !== 'green') {
      target = Math.min(target, clamp((junction - 26) * 2.2, 0, car.cruise));
    }
    if (light === 'green' && junction > 200) target = car.cruise;

    car.speed = approachSpeed(car.speed, target, dt);
    car.brake = target < car.speed - 20 ? 1 : 0;
    car.x += (car.axis === 'h' ? car.dir * car.speed * dt : 0);
    car.y += (car.axis === 'v' ? car.dir * car.speed * dt : 0);
    if (car.axis === 'h') { car.y = car.lane; car.angle = car.dir > 0 ? 0 : Math.PI; }
    else { car.x = car.lane; car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }

    if (car.axis === 'h' && (car.x < -160 || car.x > WORLD.width + 160)) car.x = car.x < 0 ? WORLD.width + 150 : -150;
    if (car.axis === 'v' && (car.y < WORLD.coastY - 380 || car.y > WORLD.height + 160)) car.y = car.y < WORLD.coastY ? WORLD.height + 150 : WORLD.coastY - 340;
    if (dist(car.x, car.y, player.x, player.y) > 2900 || !Number.isFinite(car.x)) {
      const spot = randomLanePoint(state.city, state.rng, player.x, player.y, 900, 1500);
      car.x = spot.x; car.y = spot.y; car.axis = spot.axis; car.dir = spot.dir; car.lane = spot.lane;
      car.angle = spot.axis === 'h' ? (spot.dir > 0 ? 0 : Math.PI) : (spot.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      car.speed = car.cruise * 0.6;
    }
  }
  separateCars(state);
}

function along(axis, a, b) {
  return axis === 'h' ? a.x - b.x : a.y - b.y;
}

function lateral(axis, a, b) {
  return axis === 'h' ? a.y - b.y : a.x - b.x;
}

function approachSpeed(current, target, dt) {
  if (current < target) return Math.min(target, current + 215 * dt);
  return Math.max(target, current - 400 * dt);
}

/** Distance between two car bodies, each treated as the thick segment of its heading. */
function carGap(a, b) {
  const half = CAR_SIZE.length * 0.34;
  const halfW = CAR_SIZE.width * 0.6;
  const ax1 = a.x - Math.cos(a.angle) * half;
  const ay1 = a.y - Math.sin(a.angle) * half;
  const ax2 = a.x + Math.cos(a.angle) * half;
  const ay2 = a.y + Math.sin(a.angle) * half;
  const bx1 = b.x - Math.cos(b.angle) * half;
  const by1 = b.y - Math.sin(b.angle) * half;
  const bx2 = b.x + Math.cos(b.angle) * half;
  const by2 = b.y + Math.sin(b.angle) * half;
  const d = segSegDist(ax1, ay1, ax2, ay2, bx1, by1, bx2, by2);
  return { d, min: halfW };
}

function segSegDist(ax1, ay1, ax2, ay2, bx1, by1, bx2, by2) {
  const d1 = segPointDist(ax1, ay1, ax2, ay2, bx1, by1);
  const d2 = segPointDist(ax1, ay1, ax2, ay2, bx2, by2);
  const d3 = segPointDist(bx1, by1, bx2, by2, ax1, ay1);
  const d4 = segPointDist(bx1, by1, bx2, by2, ax2, ay2);
  return Math.min(d1, d2, d3, d4);
}

function segPointDist(x1, y1, x2, y2, px, py) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = ((px - x1) * dx + (py - y1) * dy) / (len2 || 1);
  t = clamp(t, 0, 1);
  const cx = x1 + dx * t;
  const cy = y1 + dy * t;
  return Math.hypot(px - cx, py - cy);
}

/**
 * Keep car bodies out of each other. The player's car is pushed back and loses speed, which is
 * what makes a crash feel like a crash. Parked and traffic cars stay put apart from a nudge.
 */
export function separateCars(state) {
  const cars = state.cars;
  for (let i = 0; i < cars.length; i += 1) {
    const a = cars[i];
    if (!a.alive) continue;
    for (let j = i + 1; j < cars.length; j += 1) {
      const b = cars[j];
      if (!b.alive) continue;
      const { d, min } = carGap(a, b);
      if (d >= min || (d === 0 && min - d === 0)) continue;
      if (d > 0.0001) {
        const nx = (b.x - a.x) / (Math.hypot(b.x - a.x, b.y - a.y) || 1);
        const ny = (b.y - a.y) / (Math.hypot(b.x - a.x, b.y - a.y) || 1);
        const push = min - d;
        const aMove = a.driven || a.police;
        const bMove = b.driven || b.police;
        if (aMove && !bMove) { a.x -= nx * push; a.y -= ny * push; a.vx -= nx * 40; a.vy -= ny * 40; }
        else if (bMove && !aMove) { b.x += nx * push; b.y += ny * push; b.vx += nx * 40; b.vy += ny * 40; }
        else { a.x -= nx * push * 0.5; a.y -= ny * push * 0.5; b.x += nx * push * 0.5; b.y += ny * push * 0.5; }
        const impact = Math.abs((a.speed ?? 0) - (b.speed ?? 0)) + (a.driven ? Math.hypot(a.vx, a.vy) * 0.3 : 0);
        if (impact > 190 && a.driven) state.hitCar(a, impact);
      } else if (a.driven) {
        a.vx -= 20; a.vy -= 20;
      }
    }
  }
}