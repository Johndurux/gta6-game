// Gunfire: the player's pistol on foot, the bullets both sides fire, and what a hit does to a
// body, a car or a wall. Nothing here draws a shot; the effects list does.

import { CAR_SIZE, PALETTE } from '../core/config.js';
import { clamp, dist } from '../core/math.js';
import { addText, spawnMuzzle, spawnSparks, kickShake } from './effects.js';
import { killPed, panicCrowd } from './peds.js';

const BULLET_SPEED = 760;
const FIRE_DELAY = 0.17;

export function createWeapon() {
  return { cooldown: 0, shots: 0, kick: 0 };
}

/** Fire toward `aim`; heat, panic and a muzzle flash all come from here. */
export function fireWeapon(state, aim) {
  const weapon = state.weapon;
  if (weapon.cooldown > 0 || state.player.inCar || state.phase !== 'play' || state.dialogue) return;
  weapon.cooldown = FIRE_DELAY;
  weapon.shots += 1;
  weapon.kick = 1;
  const player = state.player;
  const spread = (Math.random() - 0.5) * 0.06;
  const angle = aim + spread;
  const muzzleX = player.x + Math.cos(angle) * 16;
  const muzzleY = player.y + Math.sin(angle) * 16;
  state.bullets.push({
    x: muzzleX, y: muzzleY,
    vx: Math.cos(angle) * BULLET_SPEED, vy: Math.sin(angle) * BULLET_SPEED,
    life: 0.85, hostile: false,
  });
  spawnMuzzle(state.effects, muzzleX, muzzleY, angle);
  kickShake(state.effects, 2.2);
  state.sfx('shot');
  panicCrowd(state, player.x, player.y, 420);
  state.commitCrime('gunfire', 0.5, player.x, player.y, true);
}

export function updateBullets(state, dt) {
  const player = state.player;
  for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
    const b = state.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0;

    if (!dead) {
      for (const city of [state.city]) {
        for (const building of city.buildings) {
          if (b.x > building.x && b.x < building.x + building.w && b.y > building.y && b.y < building.y + building.h) {
            dead = true;
            spawnSparks(state.effects, b.x, b.y, 4, '#ffe1a0', 120);
            break;
          }
        }
      }
    }

    if (!dead && b.hostile) {
      const reach = player.inCar ? 26 : 14;
      if (dist(b.x, b.y, player.x, player.y) < reach) {
        dead = true;
        state.hurtPlayer(9 + Math.random() * 5);
        spawnSparks(state.effects, b.x, b.y, 5, PALETTE.blood, 90);
      }
    }

    if (!dead && !b.hostile) {
      for (const ped of state.peds) {
        if (!ped.alive) continue;
        if (dist(b.x, b.y, ped.x, ped.y) < 15) {
          dead = true;
          const speed = Math.hypot(b.vx, b.vy) || 1;
          killPed(state, ped, (b.vx / speed) * 260, (b.vy / speed) * 260);
          state.commitCrime('homicide', 1.3, ped.x, ped.y);
          state.stats.kills += 1;
          addText(state.effects, ped.x, ped.y - 20, '+ HEAT', '#ff5b7a', 13);
          break;
        }
      }
    }

    if (!dead) {
      for (const car of state.cars) {
        if (!car.alive || car.driven) continue;
        if (Math.abs(b.x - car.x) < CAR_SIZE.length / 2 && Math.abs(b.y - car.y) < CAR_SIZE.length / 2) {
          dead = true;
          car.hp -= 1;
          spawnSparks(state.effects, b.x, b.y, 5, '#ffcf7a', 140);
          if (car.hp <= 0) state.wreckCar(car);
          break;
        }
      }
    }

    if (dead) state.bullets.splice(i, 1);
  }
  state.weapon.cooldown = Math.max(0, state.weapon.cooldown - dt);
  state.weapon.kick = Math.max(0, state.weapon.kick - dt * 6);
}

/** Aim at the pointer when the player is on foot; the HUD draws a thin aim line. */
export function updateAim(state, pointer) {
  const player = state.player;
  if (!pointer) return;
  player.aim = Math.atan2(pointer.y - player.y, pointer.x - player.x);
  const dx = pointer.x - player.x;
  const dy = pointer.y - player.y;
  state.aimDistance = clamp(Math.hypot(dx, dy), 0, 600);
}