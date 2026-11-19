// The scenes behind ?shot=1..4 (also cover / foot / pursuit / mission). Each one sets up a real
// moment of the game, runs the simulation forward on a scripted input, then parks it and frames the
// camera. The same seed always gives the same picture.

import { PALETTE, STEP, WORLD } from './core/config.js';
import { createNullInput } from './core/input.js';
import { updateWorld, teleport } from './world/world.js';
import { createCar } from './world/traffic.js';
import { createPed, spawnPedNear } from './world/peds.js';
import { addSkid, spawnSparks } from './world/effects.js';
import { startMission, openDialogue, MISSIONS, startCourier } from './world/missions.js';
import { dist } from './core/math.js';

const SILENT = {
  start() {}, engine() {}, engineOff() {}, siren() {}, shot() {}, crash() {}, pickup() {}, cash() {},
  objective() {}, mission() {}, phone() {}, exit() {}, hurt() {}, toggleMute() { return true; },
};

const holding = {
  ...createNullInput(),
  forward: () => true,
  fire: () => false,
};

export function stageShot(name, state) {
  state.audio = SILENT;
  state.frozen = false;
  state.timeLocked = true;
  state.time = 2.4;
  const shot = String(name);
  if (shot === '2' || shot === 'foot') stageFoot(state);
  else if (shot === '3' || shot === 'pursuit') stagePursuit(state);
  else if (shot === '4' || shot === 'mission') stageMission(state);
  else stageCover(state);
  state.frozen = true;
  return state;
}

function clearTraffic(state) {
  state.cars = state.cars.filter((c) => c.alive);
  state.peds = [];
}

function settle(state, frames, input = holding) {
  const pointer = { x: state.player.x + 220, y: state.player.y - 40 };
  for (let i = 0; i < frames; i += 1) {
    updateWorld(state, STEP, input, pointer);
  }
}

function laneCar(state, x, y, angle, color, kind = 'sedan') {
  const car = createCar(x, y, angle, kind, color);
  car.parked = true;
  car.axis = null;
  state.cars.push(car);
  return car;
}

function trafficCar(state, axis, lane, along, dir, color, kind = 'sedan', speed = 60) {
  const car = createCar(0, 0, 0, kind, color);
  car.parked = false;
  car.axis = axis;
  car.dir = dir;
  car.lane = lane;
  if (axis === 'h') { car.x = along; car.y = lane; car.angle = dir > 0 ? 0 : Math.PI; }
  else { car.y = along; car.x = lane; car.angle = dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
  car.speed = speed;
  car.cruise = 130;
  state.cars.push(car);
  return car;
}

function person(state, x, y, angle, opts = {}) {
  const ped = createPed(state.rng, x, y, opts);
  ped.angle = angle;
  ped.target = { x: x + Math.cos(angle) * 220, y: y + Math.sin(angle) * 220 };
  ped.speed = opts.speed ?? 38;
  state.peds.push(ped);
  return ped;
}


/** A pedestrian on a pavement within `radius` of the player, for a street that looks lived in. */
function crowd(state, count, radius = 620) {
  const city = state.city;
  for (let i = 0; i < count; i += 1) {
    const horizontal = state.rng.chance(0.5);
    let x;
    let y;
    let angle;
    if (horizontal) {
      const row = city.rows[Math.max(0, Math.min(city.rows.length - 1, Math.round((state.player.y - 700) / 470) + state.rng.int(3) - 1))];
      const side = state.rng.sign();
      x = state.player.x + state.rng.range(-radius, radius);
      y = row + side * (city.half + state.rng.range(5, city.sidewalk - 4));
      angle = side > 0 ? Math.PI : 0;
    } else {
      const col = city.cols[Math.max(0, Math.min(city.cols.length - 1, Math.round((state.player.x - 260) / 470) + state.rng.int(3) - 1))];
      const side = state.rng.sign();
      y = state.player.y + state.rng.range(-radius * 0.7, radius * 0.7);
      x = col + side * (city.half + state.rng.range(5, city.sidewalk - 4));
      angle = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    }
    if (x < 40 || y < WORLD.coastY + 30 || x > 5600 || y > 5600) continue;
    if (state.city.buildings.some((b) => x > b.x - 8 && x < b.x + b.w + 8 && y > b.y - 8 && y < b.y + b.h + 8)) continue;
    person(state, x, y, angle, { speed: state.rng.range(26, 44) });
  }
}

/** A few more cars on the lanes around the player, none of them in the player's own lane. */
function streetLife(state, count, radius = 800) {
  const city = state.city;
  for (let i = 0; i < count; i += 1) {
    const horizontal = state.rng.chance(0.5);
    const dir = state.rng.sign();
    if (horizontal) {
      const row = city.rows[state.rng.int(city.rows.length)];
      const lane = row + dir * 26;
      const x = state.player.x + state.rng.range(-radius, radius);
      const sameLane = state.car && Math.abs(state.car.y - lane) < 30 && Math.abs(state.car.x - x) < 140;
      if (sameLane) continue;
      trafficCar(state, 'h', lane, x, dir, state.rng.pick(['#c8402f', '#2f6fa8', '#d9c37a', '#3b3f4a', '#e0e2e6', '#5a2d6e']), 'sedan', state.rng.range(50, 110));
    } else {
      const col = city.cols[state.rng.int(city.cols.length)];
      const lane = col + dir * 26;
      const y = state.player.y + state.rng.range(-radius, radius);
      const sameLane = state.car && Math.abs(state.car.x - lane) < 30 && Math.abs(state.car.y - y) < 140;
      if (sameLane) continue;
      trafficCar(state, 'v', lane, y, dir, state.rng.pick(['#c8402f', '#2f6fa8', '#d9c37a', '#3b3f4a', '#e0e2e6', '#8d8f96']), 'sedan', state.rng.range(50, 110));
    }
  }
}

function frameCamera(state, dx = 0, dy = 0, zoom = 1) {
  state.camera.x = state.player.x + dx;
  state.camera.y = state.player.y + dy;
  state.camera.zoom = zoom;
}

/** Shot 1: the hero car on the sand at sunset, crates ahead, traffic on the boulevard below. */
function stageCover(state) {
  const city = state.city;
  const roadY = city.rows[0];
  const x = city.cols[3] + 40;
  state.tod = 0.5;
  state.cash = 1480;
  state.progress = 2;
  state.wanted = 0;
  state.heat = 0;
  state.pickups = [];
  state.missions.index = 2;
  state.missions.crates = [3, 6, 9].map((col, i) => ({ x: city.cols[col] + (i === 0 ? 40 : 0), y: WORLD.beachY - 70, taken: false, phase: i }));
  state.missions.marker = { x: city.cols[3] + 40, y: WORLD.beachY - 70, label: 'CRATE', kind: 'goal', radius: 70 };
  state.missions.objective = { text: 'PICK UP THE CRATES ON THE BEACH', title: 'SALT & STATIC', stage: 1, count: 2 };
  state.missions.prompt = null;

  clearTraffic(state);
  const car = laneCar(state, x, 556, -0.04, '#12b0c9', 'sport');
  car.driven = true;
  car.hp = 5;
  state.car = car;
  state.player.inCar = true;
  teleport(state, car.x, car.y, 0);

  // Crates ahead on the sand, a marker over the first.
  state.missions.crates = [
    { x: x + 250, y: 566, taken: false, phase: 0 },
    { x: x + 610, y: 548, taken: false, phase: 2 },
    { x: -900, y: 560, taken: false, phase: 4 },
  ];
  state.missions.marker = { x: x + 250, y: 566, label: 'CRATE', kind: 'goal', radius: 70 };

  // Traffic on the boulevard below the boardwalk.
  trafficCar(state, 'h', roadY + 26, x + 40, 1, '#2f6fa8', 'sedan', 120);
  trafficCar(state, 'h', roadY + 26, x + 250, 1, '#d9c37a', 'van', 100);
  trafficCar(state, 'h', roadY - 26, x - 120, -1, '#e0e2e6', 'sport', 90);
  trafficCar(state, 'h', roadY - 26, x + 190, -1, '#3b3f4a', 'sedan', 80);
  laneCar(state, x + 120, roadY + 46, 0, '#5a2d6e');
  laneCar(state, x - 210, roadY - 46, Math.PI, '#b8563a');
  laneCar(state, x - 420, 560, 0, '#243a5e');

  for (let i = 0; i < 8; i += 1) {
    person(state, x - 130 + i * 56, WORLD.beachY - 12, i % 2 ? 0.2 : Math.PI - 0.2, { speed: 34 });
  }
  for (let i = 0; i < 6; i += 1) {
    person(state, x - 90 + i * 74, roadY + 76, i % 2 ? 0.1 : Math.PI - 0.1, { speed: 30 });
  }
  crowd(state, 12, 600);
  settle(state, 40);
  if (state.car) {
    state.car.angle = -0.06;
    for (let i = 0; i < 14; i += 1) addSkid(state.effects, state.car.x - 44 - i * 9, state.car.y + 7, 0.06, 4);
  }
  frameCamera(state, 60, -156, 0.95);
}

/** Shot 2: on foot in a neon block, people about, a job marker waiting up the street. */
function stageFoot(state) {
  const city = state.city;
  state.tod = 0.42;
  state.cash = 2640;
  state.progress = 2;
  state.wanted = 0;
  clearTraffic(state);
  const place = city.places.club;
  const x = place.x + 66;
  const y = place.y + 210;
  teleport(state, x, y, -Math.PI / 2);
  state.missions.index = 3;
  state.missions.marker = { x: place.x + 40, y: place.y + 40, label: 'CLUB HALO', kind: 'job', mission: 'HEAT INDEX', radius: 110 };
  state.missions.objective = { text: 'MEET MIRA SOL AT CLUB HALO', title: 'BAD SIGNAL', stage: 2, count: 2 };
  state.missions.prompt = { key: 'E', text: 'START JOB · HEAT INDEX' };

  laneCar(state, x - 78, y + 40, 0, '#c8402f');
  laneCar(state, x + 132, y + 62, 0, '#3b3f4a');
  trafficCar(state, 'v', place.x - 26, y + 260, -1, '#2f6fa8', 'sedan', 80);
  person(state, x + 26, y + 26, -Math.PI / 2, { speed: 26 });
  person(state, x - 20, y + 96, Math.PI / 2, { speed: 30 });
  person(state, x + 70, y + 150, -Math.PI / 2, { speed: 34 });
  person(state, x - 62, y - 40, Math.PI / 2, { speed: 28 });
  crowd(state, 22, 520);
  streetLife(state, 6, 700);
  settle(state, 26, createNullInput());
  state.player.aim = -Math.PI / 2 + 0.25;
  state.pointerScreen = { x: 760, y: 300 };
  frameCamera(state, 0, -10, 1.08);
}

/** Shot 3: three stars, a cruiser on the bumper, one alongside, the avenue lit up. */
function stagePursuit(state) {
  const city = state.city;
  const roadX = city.cols[5];
  const y = city.rows[4] + 30;
  state.tod = 0.57;
  state.cash = 5120;
  state.progress = 3;
  state.wanted = 3;
  state.heat = 3;
  state.evadeTimer = 0;
  clearTraffic(state);
  const car = laneCar(state, roadX + 26, y, Math.PI / 2, '#12b0c9', 'sport');
  car.driven = true;
  car.hp = 4;
  car.angle = Math.PI / 2 - 0.12;
  state.car = car;
  state.player.inCar = true;
  teleport(state, car.x, car.y, Math.PI / 2);
  car.x = roadX + 26;
  car.y = y;

  const p1 = laneCar(state, roadX + 26, y - 96, Math.PI / 2 - 0.06, '#e9edf5', 'police');
  p1.police = true; p1.hp = 3; p1.siren = 0;
  const p2 = laneCar(state, roadX - 32, y - 44, Math.PI / 2, '#e9edf5', 'police');
  p2.police = true; p2.hp = 3; p2.siren = 0.5;
  const p3 = laneCar(state, roadX - 30, y + 320, -Math.PI / 2, '#e9edf5', 'police');
  p3.police = true; p3.hp = 3; p3.siren = 0.8;

  // A civilian car already shunted onto the pavement, smoking.
  const wreck = laneCar(state, roadX + 96, y + 210, Math.PI / 2 + 0.6, '#c8402f');
  wreck.hp = 0;
  for (let i = 0; i < 10; i += 1) {
    state.effects.particles.push({
      x: wreck.x + (Math.random() - 0.5) * 30, y: wreck.y + (Math.random() - 0.5) * 30,
      vx: (Math.random() - 0.5) * 24, vy: -18 - Math.random() * 26,
      life: 1.4 + Math.random(), max: 2.4, size: 16, color: 'rgba(50,44,52,0.5)', kind: 'smoke', drag: 1.2,
    });
  }

  trafficCar(state, 'v', roadX + 26, y + 430, 1, '#d9c37a', 'van', 50);
  trafficCar(state, 'v', roadX - 26, y + 150, -1, '#b8563a', 'sedan', 40);
  for (let i = 0; i < 5; i += 1) {
    person(state, roadX + 74, y + 40 + i * 60, Math.PI / 2, { speed: 30 });
  }
  crowd(state, 14, 520);
  streetLife(state, 7, 800);
  for (let i = 0; i < 34; i += 1) {
    addSkid(state.effects, roadX + 8 + (i % 2) * 20, y - 40 + i * 9, Math.PI / 2, 5);
  }
  spawnSparks(state.effects, car.x + 24, car.y + 24, 14, '#ffcf7a', 180);
  state.missions.index = 4;
  state.missions.marker = null;
  state.missions.objective = { text: 'LOSE THE POLICE', title: 'HEAT INDEX', stage: 1, count: 1 };
  settle(state, 14);
  if (state.car) {
    state.car.vx = 40;
    state.car.vy = 360;
    state.car.speed = 362;
    state.car.angle = Math.PI / 2 - 0.14;
  }
  for (const cop of [p1, p2]) {
    if (cop.alive) { cop.speed = 330; cop.vy = 330; cop.vx = 0; }
  }
  state.effects.shake = 4;
  frameCamera(state, 0, 60, 1.02);
}

/** Shot 4: a job brief at the pier, the crates waiting on the sand. */
function stageMission(state) {
  const city = state.city;
  state.tod = 0.54;
  state.cash = 3260;
  state.progress = 2;
  state.wanted = 0;
  clearTraffic(state);
  const def = MISSIONS[1];
  state.missions.index = 1;
  state.missions.active = { def, stage: 0, targets: [], rival: null, everWanted: 0, timer: 0 };
  state.missions.crates = [3, 6, 9].map((col, i) => ({ x: city.cols[col], y: WORLD.beachY - 70, taken: false, phase: i }));
  state.missions.objective = { text: 'PICK UP THE CRATES ON THE BEACH', title: 'SALT & STATIC', stage: 1, count: 2 };
  const x = city.cols[5] + 60;
  const y = WORLD.beachY - 40;
  const car = laneCar(state, x, y, 0, '#c8402f');
  car.driven = true;
  car.hp = 5;
  state.car = car;
  state.player.inCar = true;
  teleport(state, x, y, 0);
  laneCar(state, x + 90, y + 40, 0, '#3b3f4a');
  laneCar(state, x - 110, y - 30, Math.PI, '#2f6fa8');
  person(state, x + 40, y - 30, 0, { speed: 22 });
  person(state, x + 100, y + 30, Math.PI, { speed: 26 });
  for (let i = 0; i < 5; i += 1) person(state, x - 140 + i * 60, y - 80, 0, { speed: 20 });
  crowd(state, 14, 560);
  settle(state, 8);
  openDialogue(state, def.giver, def.brief);
  state.missions.dialogue.index = 1;
  frameCamera(state, 40, -30, 1.08);
}

export { startMission, startCourier, dist, PALETTE };