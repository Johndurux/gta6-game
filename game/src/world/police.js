// The Velara Bay Police Department. Heat becomes patrol cars that arrive from off screen, drive
// straight at the player, ram, and stop to shoot when they get close. Stay out of their sight for
// a few seconds and the stars start falling off.

import { PALETTE, POLICE, TRAFFIC } from '../core/config.js';
import { angleDelta, clamp, dist, damp } from '../core/math.js';
import { randomLanePoint } from './city.js';
import { createCar } from './traffic.js';
import { kickShake, spawnSparks } from './effects.js';

export function spawnPoliceCar(state) {
  const spot = randomLanePoint(state.city, state.rng, state.player.x, state.player.y, POLICE.spawnDistance, POLICE.spawnDistance + 500);
  const car = createCar(spot.x, spot.y, Math.atan2(state.player.y - spot.y, state.player.x - spot.x), 'police', '#e9edf5');
  car.axis = null;
  car.dir = 1;
  car.police = true;
  car.parked = false;
  car.hp = 3;
  car.speed = 40;
  car.cruise = POLICE.chaseSpeed;
  car.shootTimer = 0.9;
  car.siren = state.rng.range(0, 1);
  state.cars.push(car);
  state.sfx('siren', true);
  return car;
}

/**
 * Wanted level upkeep: spawn what the stars call for, run every cruiser's pursuit, count how long
 * the player has been out of sight, and decide on a bust.
 */
export function updatePolice(state, dt) {
  const player = state.player;
  const wanted = state.wanted;

  if (wanted > 0) {
    state.policeTimer -= dt;
    const cruisers = state.cars.filter((c) => c.police && c.alive);
    const target = Math.min(wanted, POLICE.maxCars);
    if (state.policeTimer <= 0 && cruisers.length < target) {
      spawnPoliceCar(state);
      state.policeTimer = 1.5;
    }
  }

  let nearest = Infinity;
  let nearestCar = null;
  for (const car of state.cars) {
    if (!car.police || !car.alive) continue;
    const d = dist(car.x, car.y, player.x, player.y);
    if (d < nearest) { nearest = d; nearestCar = car; }
    chase(state, car, dt, d);
    if (d > 2400 && state.wanted < 4) { car.alive = false; }
  }

  // Out of sight: the pursuit cools and the stars drop one at a time.
  if (wanted > 0) {
    if (nearest > POLICE.sightRange || !nearestCar) {
      state.evadeTimer += dt;
      if (state.evadeTimer > POLICE.evadeSeconds) {
        state.setWanted(wanted - 1, true);
        state.evadeTimer = 0;
        state.toast(wanted - 1 === 0 ? 'YOU LOST THEM' : 'HEAT FALLING', PALETTE.neonGreen);
      }
    } else {
      state.evadeTimer = Math.max(0, state.evadeTimer - dt * 0.7);
    }
  }

  if (state.wanted > 0 && nearestCar && !player.inCar && nearest < POLICE.bustRange) {
    state.bust();
  }
  for (const car of state.cars) {
    if (car.police && car.alive) car.siren = (car.siren + dt * 1.4) % 1;
  }
  state.audio.siren(state.wanted > 0 && nearest < 1300, nearest < 500 ? 1 : 0.5);
}

function chase(state, car, dt, distance) {
  const player = state.player;
  const targetX = player.x + (player.inCar ? state.car.vx * 0.22 : 0);
  const targetY = player.y + (player.inCar ? state.car.vy * 0.22 : 0);
  const wantedAngle = Math.atan2(targetY - car.y, targetX - car.x);
  const turn = clamp(angleDelta(car.angle, wantedAngle), -3.2 * dt, 3.2 * dt);
  const facing = Math.cos(angleDelta(car.angle, wantedAngle));

  let targetSpeed = POLICE.chaseSpeed;
  if (distance < 130) targetSpeed = 70;
  else if (distance < 320) targetSpeed = 190;
  if (facing < 0) targetSpeed = 120;
  if (car.shootTimer > 0 && distance < 260) targetSpeed = 0;
  car.speed = damp(car.speed, targetSpeed, 2.4, dt);
  car.angle += turn * (0.4 + Math.min(1, car.speed / 160));
  car.vx = Math.cos(car.angle) * car.speed;
  car.vy = Math.sin(car.angle) * car.speed;
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  car.drift = 0;

  // Nudge round corners instead of grinding to a halt on a facade.
  const ahead = 34 + car.speed * 0.16;
  const probeX = car.x + Math.cos(car.angle) * ahead;
  const probeY = car.y + Math.sin(car.angle) * ahead;
  if (state.city.buildings.some((b) => probeX > b.x - 18 && probeX < b.x + b.w + 18 && probeY > b.y - 18 && probeY < b.y + b.h + 18)) {
    car.angle += (car.side ?? 1) * 1.6 * dt;
    car.speed *= 0.85;
  }
  car.x = clamp(car.x, 30, 5670);
  car.y = clamp(car.y, 420, 5670);

  // Close enough to open fire.
  car.shootTimer -= dt;
  if (distance < 300 && car.shootTimer <= -0.2) {
    const aim = Math.atan2(player.y - car.y, player.x - car.x) + (Math.random() - 0.5) * 0.16;
    state.bullets.push({
      x: car.x + Math.cos(aim) * 26, y: car.y + Math.sin(aim) * 26,
      vx: Math.cos(aim) * 700, vy: Math.sin(aim) * 700, life: 0.8, hostile: true,
    });
    spawnSparks(state.effects, car.x + Math.cos(aim) * 20, car.y + Math.sin(aim) * 20, 2, '#ffe6a8', 90);
    car.shootTimer = 1.2;
    state.sfx('shot', true, 0.5);
  }

  // Ramming the player's car.
  const reach = player.inCar ? 40 : 24;
  if (distance < reach) {
    if (player.inCar) {
      state.car.vx += Math.cos(car.angle) * 90;
      state.car.vy += Math.sin(car.angle) * 90;
      state.hurtPlayer(POLICE.ramDamage);
      kickShake(state.effects, 7);
      state.sfx('crash', true);
    } else {
      state.hurtPlayer(4);
    }
  }
}

/** Clear the street when the heat is gone: cruisers leave once they are out of view. */
export function releasePolice(state) {
  for (const car of state.cars) {
    if (car.police && car.alive) {
      const d = dist(car.x, car.y, state.player.x, state.player.y);
      if (d > 1200) car.alive = false;
    }
  }
  state.audio.siren(false, 0);
}

export { TRAFFIC };