// The player: on foot (accelerate, sprint, collide with walls, take any car) and behind the wheel
// (throttle, brake, steering that tightens with speed, drag, lateral grip you can break with the
// handbrake, and a wall that stops you hard). Car entry and exit live here too.

import { DRIVE, FOOT, PALETTE, WORLD } from '../core/config.js';
import { clamp, dist } from '../core/math.js';
import { circleRectPush } from '../core/math.js';
import { addSkid, spawnSparks, kickShake } from './effects.js';

export function createPlayer(x, y) {
  return {
    x, y, vx: 0, vy: 0, angle: -Math.PI / 2,
    health: 100,
    aim: 0,
    inCar: false,
    step: 0,
    moving: false,
    footSpeed: 0,
  };
}

/** Distance from the player to the nearest car they could take, or null. */
export function nearestCar(state, range = FOOT.enterRange) {
  let best = null;
  let bestD = range;
  for (const car of state.cars) {
    if (!car.alive || car.police) continue;
    const d = dist(car.x, car.y, state.player.x, state.player.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

/** E: get into the closest car, or step out of the one you are driving. */
export function toggleVehicle(state) {
  if (state.player.inCar) {
    exitCar(state);
    return;
  }
  const car = nearestCar(state);
  if (!car) return false;
  enterCar(state, car);
  return true;
}

export function enterCar(state, car) {
  const player = state.player;
  car.axis = null;
  car.parked = true;
  car.driven = true;
  car.speed = 0;
  car.vx = 0;
  car.vy = 0;
  car.angle = car.angle;
  state.car = car;
  player.inCar = true;
  player.x = car.x;
  player.y = car.y;
  if (car.police) state.commitCrime('steal-cruiser', 1.6, car.x, car.y);
  else if (!car.owned) state.commitCrime('carjack', 0.62, car.x, car.y);
  state.sfx('engine');
}

export function exitCar(state) {
  const player = state.player;
  const car = state.car;
  if (!car) return;
  const side = player.angle + Math.PI / 2;
  let x = car.x + Math.cos(side) * 26;
  let y = car.y + Math.sin(side) * 26;
  if (state.city && isWall(state, x, y)) {
    x = car.x - Math.cos(side) * 26;
    y = car.y - Math.sin(side) * 26;
  }
  player.x = x;
  player.y = y;
  player.vx = 0;
  player.vy = 0;
  player.inCar = false;
  car.driven = false;
  car.parked = true;
  car.speed = 0;
  car.vx = 0;
  car.vy = 0;
  state.car = null;
  state.sfx('exit');
}

function isWall(state, x, y) {
  return state.city.buildings.some((b) => x > b.x - 12 && x < b.x + b.w + 12 && y > b.y - 12 && y < b.y + b.h + 12);
}

/** On foot: a short acceleration ramp, friction, sprint, and a hard stop against any facade. */
export function updateOnFoot(state, dt, input) {
  const player = state.player;
  let ax = (input.right() ? 1 : 0) - (input.left() ? 1 : 0);
  let ay = (input.back() ? 1 : 0) - (input.forward() ? 1 : 0);
  const len = Math.hypot(ax, ay);
  if (len > 0) {
    ax /= len;
    ay /= len;
  }
  const sprint = input.sprint();
  const max = sprint ? FOOT.sprintSpeed : FOOT.speed;
  player.step += dt * (len > 0 ? (sprint ? 15 : 10) : 0);
  player.moving = len > 0;

  player.vx += ax * FOOT.accel * dt;
  player.vy += ay * FOOT.accel * dt;
  const speed = Math.hypot(player.vx, player.vy);
  if (speed > max) {
    player.vx = (player.vx / speed) * max;
    player.vy = (player.vy / speed) * max;
  }
  player.vx *= Math.exp(-FOOT.friction * dt * (len ? 0.35 : 1));
  player.vy *= Math.exp(-FOOT.friction * dt * (len ? 0.35 : 1));
  player.x += player.vx * dt;
  player.y += player.vy * dt;
  player.footSpeed = Math.hypot(player.vx, player.vy);
  if (len > 0) player.angle = Math.atan2(ay, ax);

  clampToCity(state, player, FOOT.radius);
}

/** Behind the wheel: the arcade model that gives the game its weight and its drift. */
export function updateDriving(state, dt, input) {
  const car = state.car;
  const player = state.player;
  if (!car) return;
  const throttle = input.forward() ? 1 : 0;
  const brake = input.back() ? 1 : 0;
  const steer = (input.right() ? 1 : 0) - (input.left() ? 1 : 0);
  const handbrake = input.handbrake();

  const cos = Math.cos(car.angle);
  const sin = Math.sin(car.angle);
  let vf = car.vx * cos + car.vy * sin;
  let vr = -car.vx * sin + car.vy * cos;

  if (throttle) vf += DRIVE.accel * dt * (vf < 0 ? 2.2 : 1);
  if (brake) {
    if (vf > 18) vf -= DRIVE.brake * dt;
    else vf -= DRIVE.accel * 0.62 * dt;
  }
  if (handbrake) vf *= Math.exp(-1.9 * dt);
  vf -= vf * DRIVE.drag * dt;
  vf = clamp(vf, -DRIVE.reverseMax, DRIVE.maxSpeed);

  const grip = handbrake ? DRIVE.handbrakeGrip : DRIVE.grip;
  vr *= Math.exp(-grip * dt);

  const turnRate = DRIVE.turn * clamp(Math.abs(vf) / 150, 0, 1) * (vf < 0 ? -1 : 1);
  car.angle += steer * turnRate * dt * (handbrake ? 1.35 : 1);

  const c2 = Math.cos(car.angle);
  const s2 = Math.sin(car.angle);
  car.vx = c2 * vf - s2 * vr;
  car.vy = s2 * vf + c2 * vr;
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  car.speed = Math.hypot(car.vx, car.vy);
  car.brake = brake && vf > 10 ? 1 : 0;
  car.drift = Math.abs(vr);

  if (Math.abs(vr) > DRIVE.skidThreshold && car.speed > 40) {
    const rearX = car.x - c2 * 18;
    const rearY = car.y - s2 * 18;
    const sideX = -s2 * 9;
    const sideY = c2 * 9;
    addSkid(state.effects, rearX + sideX, rearY + sideY, car.angle, 4);
    addSkid(state.effects, rearX - sideX, rearY - sideY, car.angle, 4);
    if (state.effects.particles.length < 380 && Math.random() < 0.5) {
      state.effects.particles.push({
        x: rearX, y: rearY, vx: (Math.random() - 0.5) * 40, vy: -20,
        life: 0.6, max: 0.6, size: 10, color: 'rgba(210,205,220,0.25)', kind: 'smoke', drag: 2,
      });
    }
  }

  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
  state.distanceDriven += car.speed * dt;
  collideWithCity(state, car, dt);
  clampToCity(state, car, 26);
  state.audio.engine(car.speed / DRIVE.maxSpeed, throttle, handbrake);
}

/** Walls, at speed: stop the car, dent the player, throw sparks and shake the lens. */
export function collideWithCity(state, car, dt) {
  for (const b of state.city.buildings) {
    if (Math.abs(car.x - (b.x + b.w / 2)) > b.w / 2 + 40) continue;
    if (Math.abs(car.y - (b.y + b.h / 2)) > b.h / 2 + 40) continue;
    const push = circleRectPush(car.x, car.y, 24, b);
    if (!push) continue;
    car.x = push.x;
    car.y = push.y;
    const into = car.vx * push.nx + car.vy * push.ny;
    if (into < 0) {
      car.vx -= push.nx * into * 1.35;
      car.vy -= push.ny * into * 1.35;
      const impact = Math.abs(into);
      if (impact > 90) {
        spawnSparks(state.effects, car.x, car.y, Math.min(16, Math.round(impact / 20)), '#ffd98a', 220);
        kickShake(state.effects, Math.min(12, impact / 26));
        state.carDamage(Math.min(24, impact / 12));
        state.sfx('crash');
      }
    }
    car.vx *= 0.72;
    car.vy *= 0.72;
  }
}

function clampToCity(state, body, radius) {
  const minY = WORLD.coastY + radius + 12;
  if (body.y < minY) { body.y = minY; if (body.vy < 0) body.vy *= -0.2; }
  if (body.x < radius + 8) { body.x = radius + 8; if (body.vx < 0) body.vx *= -0.2; }
  if (body.x > WORLD.width - radius - 8) { body.x = WORLD.width - radius - 8; if (body.vx > 0) body.vx *= -0.2; }
  if (body.y > WORLD.height - radius - 8) { body.y = WORLD.height - radius - 8; if (body.vy > 0) body.vy *= -0.2; }
}

/** Put the player somewhere specific, on foot or in the given car. */
export function placePlayer(state, x, y, angle = -Math.PI / 2) {
  const player = state.player;
  player.x = x;
  player.y = y;
  player.vx = 0;
  player.vy = 0;
  player.angle = angle;
  if (state.car) {
    state.car.x = x;
    state.car.y = y;
    state.car.vx = 0;
    state.car.vy = 0;
    state.car.angle = angle;
  }
}

export { PALETTE };