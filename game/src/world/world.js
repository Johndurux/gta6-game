// The world: the city, everyone in it, the player, and the rules that connect them. Owns the
// simulation clock, the crime and wanted system, health, the wasted/busted flow and the camera.

import { CRIME, ECON, PALETTE, POLICE, STEP, WORLD } from '../core/config.js';
import { angleDelta, clamp, damp, dist } from '../core/math.js';
import { createRandom } from '../core/random.js';
import { buildCity, isBlocked } from './city.js';
import { createEffects, kickShake, spawnSparks, spawnSmoke, updateEffects } from './effects.js';
import { createPlayer, updateDriving, updateOnFoot, exitCar } from './player.js';
import { populateTraffic, updateTraffic, spawnParkedCar, createCar } from './traffic.js';
import { populatePeds, updatePeds, pedestriansVsCars, panicCrowd } from './peds.js';
import { updatePolice, releasePolice, spawnPoliceCar } from './police.js';
import { createWeapon, fireWeapon, updateBullets, updateAim } from './combat.js';
import {
  MISSIONS, createMissionState, initMissions, updateMissions, handleUse, currentMarker,
  openDialogue,
} from './missions.js';
import { createAudio } from '../audio/audio.js';
import { readSave, writeSave } from '../save/save.js';

export function createWorld(seed, options = {}) {
  const rng = createRandom(seed);
  const city = buildCity(rng);
  const home = city.places.home;
  const startX = home.x + 84;
  const startY = home.y + 84;
  const state = {
    seed,
    rng,
    city,
    time: 0,
    tod: 0.56,
    timeLocked: false,
    player: createPlayer(startX, startY),
    car: null,
    cars: [],
    peds: [],
    bullets: [],
    effects: createEffects(),
    weapon: createWeapon(),
    cash: ECON.startCash,
    wanted: 0,
    heat: 0,
    evadeTimer: 0,
    policeTimer: 0,
    phase: 'play',
    lastPhase: 'play',
    phaseTimer: 0,
    progress: 0,
    missions: createMissionState(),
    toasts: [],
    camera: { x: startX, y: startY, zoom: 1, shake: 0 },
    audio: createAudio(),
    stats: { kills: 0, jacked: 0, missions: 0, pickups: 0, distance: 0 },
    distanceDriven: 0,
    aimDistance: 0,
    autosave: 25,
    paused: false,
    frozen: false,
    pointer: null,
    onProgress: null,
  };

  // Rules that live on the state so every module can reach them without importing each other.
  state.toast = (text, color = PALETTE.hudInk) => {
    state.toasts.push({ text, color, life: 2.8, max: 2.8 });
    if (state.toasts.length > 4) state.toasts.shift();
  };
  state.sfx = (name, ...args) => {
    const fn = state.audio[name];
    if (typeof fn === 'function') fn.apply(state.audio, args);
  };
  state.commitCrime = (kind, amount, x, y, quiet = false) => {
    state.heat = clamp(state.heat + amount, 0, 5);
    const next = Math.min(5, Math.ceil(state.heat));
    if (next > state.wanted) {
      state.wanted = next;
      state.evadeTimer = 0;
      if (!quiet) state.toast(`WANTED LEVEL ${next}`, PALETTE.wanted);
      state.sfx('objective');
    }
    if (!quiet && kind !== 'gunfire') panicCrowd(state, x, y, 300);
  };
  state.setWanted = (level, silent = false) => {
    state.wanted = clamp(Math.round(level), 0, 5);
    state.heat = state.wanted;
    state.evadeTimer = 0;
    if (state.wanted === 0) {
      state.policeTimer = 0;
      releasePolice(state);
      if (!silent) state.toast('WANTED CLEARED', PALETTE.neonGreen);
    } else if (!silent) {
      state.toast(`WANTED LEVEL ${state.wanted}`, PALETTE.wanted);
    }
  };
  state.hurtPlayer = (amount) => {
    if (state.phase !== 'play') return;
    state.player.health = clamp(state.player.health - amount, 0, 100);
    kickShake(state.effects, Math.min(6, amount * 0.4));
    state.sfx('hurt');
    if (state.player.health <= 0) state.waste();
  };
  state.carDamage = (amount) => {
    if (!state.car) return;
    state.car.hp = (state.car.hp ?? 3) - amount * 0.06;
    state.hurtPlayer(amount * 0.22);
    if (state.car.hp <= 0) state.wreckCar(state.car, true);
  };
  state.hitCar = (car, impact) => {
    kickShake(state.effects, Math.min(10, impact / 45));
    spawnSparks(state.effects, car.x, car.y, 6, '#ffd98a', 130);
    state.sfx('crash');
    state.carDamage(Math.min(18, impact / 26));
  };
  state.wreckCar = (car, driven = false) => {
    if (!car.alive) return;
    car.alive = false;
    car.speed = 0;
    spawnSparks(state.effects, car.x, car.y, 30, '#ffb340', 320);
    spawnSmoke(state.effects, car.x, car.y, 14, 'rgba(40,35,40,0.6)');
    kickShake(state.effects, 13);
    state.sfx('crash');
    if (car.police) state.commitCrime('cop-car', CRIME.copCar, car.x, car.y);
    if (driven || car === state.car) {
      state.car = null;
      state.player.inCar = false;
      state.hurtPlayer(38);
      state.waste();
    }
  };
  state.bust = () => {
    if (state.phase !== 'play') return;
    state.lastPhase = 'busted';
    state.phase = 'busted';
    state.phaseTimer = 3.8;
    state.audio.engineOff();
    kickShake(state.effects, 10);
    state.sfx('phone');
  };
  state.waste = () => {
    if (state.phase !== 'play') return;
    state.lastPhase = 'wasted';
    state.phase = 'wasted';
    state.phaseTimer = 3.8;
    state.audio.engineOff();
    kickShake(state.effects, 14);
  };
  state.spawnPolice = () => spawnPoliceCar(state);
  state.marker = () => currentMarker(state);
  state.interact = () => handleUse(state);

  const save = options.save ?? readSave();
  if (save) {
    state.cash = save.cash;
    state.progress = save.progress;
    state.stats = { ...state.stats, ...save.stats };
    if (save.x > 0 && save.y > 0 && !isBlocked(city, save.x, save.y, 20)) {
      state.player.x = save.x;
      state.player.y = save.y;
      state.camera.x = save.x;
      state.camera.y = save.y;
    }
  }

  populateTraffic(state);
  populatePeds(state);
  initMissions(state);
  state.missions.objective = null;
  // A car waiting at the kerb outside the safehouse, so the first job can start at once.
  const starter = spawnParkedCar(state, { x: startX, y: startY });
  starter.x = startX + 26;
  starter.y = startY + 34;
  starter.angle = Math.PI / 2;
  state.onProgress = () => writeSave(state);
  if (options.missionBrief) {
    const def = MISSIONS[options.missionBrief] ?? MISSIONS[0];
    openDialogue(state, def.giver, def.brief);
  }
  return state;
}

/** One fixed step of the whole city. */
export function updateWorld(state, dt, input, pointer) {
  if (state.paused || state.frozen) return;
  state.time += dt;
  if (!state.timeLocked) state.tod = (state.tod + dt / 460) % 1;
  const player = state.player;

  if (state.phase === 'play') {
    updateAim(state, pointer);
    if (player.inCar) updateDriving(state, dt, input);
    else updateOnFoot(state, dt, input);
    if (input.fire()) fireWeapon(state, player.aim);
  } else {
    state.phaseTimer -= dt;
    if (state.phaseTimer <= 0) respawnPlayer(state);
    state.audio.engineOff();
  }

  updateBullets(state, dt);
  updateTraffic(state, dt);
  updatePeds(state, dt);
  pedestriansVsCars(state);
  updatePolice(state, dt);
  updateMissions(state, dt);
  updateEffects(state.effects, dt);
  updateCamera(state, dt);

  for (let i = state.toasts.length - 1; i >= 0; i -= 1) {
    state.toasts[i].life -= dt;
    if (state.toasts[i].life <= 0) state.toasts.splice(i, 1);
  }
  if (state.car) state.car.hp = state.car.hp ?? 4;

  state.autosave -= dt;
  if (state.autosave <= 0) {
    state.autosave = 30;
    writeSave(state);
  }
}

/** The camera trails the player, leads a little in the direction of travel, and pulls back at speed. */
export function updateCamera(state, dt) {
  const player = state.player;
  const car = state.car;
  const speed = car ? Math.hypot(car.vx, car.vy) : Math.hypot(player.vx, player.vy);
  const leadX = car ? car.vx * 0.3 : player.vx * 0.22;
  const leadY = car ? car.vy * 0.3 : player.vy * 0.22;
  const targetX = player.x + clamp(leadX, -130, 130);
  const targetY = player.y + clamp(leadY, -130, 130);
  const targetZoom = car ? clamp(1.14 - speed / 2000, 0.98, 1.14) : 1.18;
  state.camera.x = damp(state.camera.x, targetX, 5.4, dt);
  state.camera.y = damp(state.camera.y, targetY, 5.4, dt);
  state.camera.zoom = damp(state.camera.zoom, targetZoom, 2.4, dt);
}

function respawnPlayer(state) {
  const busted = state.lastPhase === 'busted';
  // Busted is served at the precinct, wasted wakes up at the hospital: two different places, so the
  // screenshot and the HUD can say which one it was.
  const place = busted ? state.city.places.station : state.city.places.hospital;
  const player = state.player;
  if (state.car) {
    state.car.driven = false;
    state.car.parked = true;
    state.car.speed = 0;
    state.car.vx = 0;
    state.car.vy = 0;
  }
  state.car = null;
  player.inCar = false;
  player.x = place.x + 74;
  player.y = place.y + 74;
  player.vx = 0;
  player.vy = 0;
  player.health = 100;
  state.phase = 'play';
  state.phaseTimer = 0;
  state.cash = Math.max(0, state.cash - ECON.wastedFee);
  state.setWanted(0, true);
  state.bullets.length = 0;
  for (const car of state.cars) if (car.police) car.alive = false;
  state.evadeTimer = 0;
  state.camera.x = player.x;
  state.camera.y = player.y;
  state.toast(
    busted ? `RELEASED · ${place.label} · FEE $${ECON.wastedFee}` : `WAKING UP · ${place.label} · FEE $${ECON.wastedFee}`,
    PALETTE.neonPink,
  );
  writeSave(state);
}

/** Jump the player somewhere (used by the staged screenshots and by loading a save). */
export function teleport(state, x, y, angle = -Math.PI / 2) {
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
  state.camera.x = x;
  state.camera.y = y;
}

export { STEP, WORLD, exitCar, createCar, spawnSparks, spawnSmoke, angleDelta, dist };