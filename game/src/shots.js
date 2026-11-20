// Owns the canned screenshot scenes behind ?shot=...: each one sets up a real moment, drives the simulation with scripted input and parks the camera on a deterministic frame.

import { DOWNTOWN, PALETTE, STEP, WORLD } from './core/config.js';
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
  else if (shot === '4' || shot === 'mission' || shot === 'coast') stageMission(state);
  else if (shot === 'downtown' || shot === '5') stageDowntown(state);
  else if (shot === '6' || shot === 'aerial') stageAerial(state);
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

/** The cover: the hero car mid-junction downtown at dusk, traffic on all four approaches. */
function stageDowntown(state) {
  const city = state.city;
  const x = city.cols[DOWNTOWN.col0 + 3];
  const y = city.rows[DOWNTOWN.row0 + 2];
  state.tod = 0.6;
  state.cash = 4310;
  state.progress = 3;
  state.wanted = 0;
  state.heat = 0;
  state.pickups = [];
  state.missions.index = 2;
  state.missions.marker = null;
  state.missions.prompt = null;
  state.missions.objective = { text: 'REACH THE DOWNTOWN DROP', title: 'CITY LIGHTS', stage: 2, count: 2 };
  clearTraffic(state);

  // The hero car, stopped in the middle of the junction.
  const car = laneCar(state, x - 10, y + 12, 0.05, '#12b0c9', 'sport');
  car.driven = true;
  car.hp = 5;
  state.car = car;
  state.player.inCar = true;
  teleport(state, car.x, car.y, 0.05);
  car.x = x - 10;
  car.y = y + 12;
  car.speed = 0;

  // The people of downtown first, so the streets around the junction are already busy.
  crowd(state, 34, 820);
  settle(state, 24);

  // Traffic by hand, one car on every approach and two crossing the junction, so all four
  // directions read at once. Nothing steps the world after this, so the frame is exactly this.
  trafficCar(state, 'h', y + 26, x + 214, 1, '#2f6fa8', 'sedan', 120);
  trafficCar(state, 'h', y + 26, x - 306, 1, '#d9c37a', 'van', 96);
  trafficCar(state, 'h', y - 26, x + 304, -1, '#e0e2e6', 'sport', 104);
  trafficCar(state, 'h', y - 26, x - 176, -1, '#3b3f4a', 'sedan', 88);
  trafficCar(state, 'v', x + 26, y + 256, 1, '#c8402f', 'sedan', 92);
  trafficCar(state, 'v', x + 26, y - 54, 1, '#5a2d6e', 'sedan', 112);
  trafficCar(state, 'v', x - 26, y - 300, -1, '#2f8f6b', 'van', 84);
  trafficCar(state, 'v', x - 26, y + 162, -1, '#8d8f96', 'sport', 100);

  // Cars at the kerbs of all four blocks.
  laneCar(state, x + 128, y + 44, 0, '#b8563a');
  laneCar(state, x - 132, y - 44, Math.PI, '#243a5e');
  laneCar(state, x + 44, y + 132, Math.PI / 2, '#3b3f4a');
  laneCar(state, x - 44, y - 128, -Math.PI / 2, '#d9c37a');

  // Pedestrians on each of the four corners, walking the pavement they sit on.
  const cor = city.half + 20;
  for (let k = 0; k < 4; k += 1) {
    const sx = k < 2 ? -cor : cor;
    const sy = k % 2 === 0 ? -cor : cor;
    for (let i = 0; i < 4; i += 1) {
      const along = -34 + i * 24;
      if (i % 2 === 0) person(state, x + sx + along, y + sy, sx > 0 ? Math.PI : 0, { speed: 28 + i * 4 });
      else person(state, x + sx, y + sy + along, sy > 0 ? -Math.PI / 2 : Math.PI / 2, { speed: 30 + i * 4 });
    }
  }

  // Rubber laid down where the hero car braked into the junction.
  for (const dy of [-10, 10]) {
    for (let i = 0; i < 9; i += 1) addSkid(state.effects, car.x - 62 - i * 11, car.y + dy, 0.05, 3.5);
  }
  spawnSparks(state.effects, x + 300, y + 26, 5, '#ffd98a', 60);
  frameCamera(state, -104, -176, 0.96);
}

/** Shot 2: on foot on a downtown sidewalk, people about, a job marker waiting on the plaza. */
function stageFoot(state) {
  const city = state.city;
  const plaza = city.downtown.plaza;
  state.tod = 0.46;
  state.cash = 2640;
  state.progress = 2;
  state.wanted = 0;
  clearTraffic(state);
  const x = plaza.fx + 96;
  const y = plaza.y + plaza.h + 14;
  teleport(state, x, y, -Math.PI / 2);
  state.missions.index = 3;
  state.missions.marker = { x: plaza.fx - 40, y: plaza.y + 40, label: 'CITY HALL', kind: 'job', mission: 'HEAT INDEX', radius: 110 };
  state.missions.objective = { text: 'MEET MIRA SOL AT CITY HALL', title: 'BAD SIGNAL', stage: 2, count: 2 };
  state.missions.prompt = { key: 'E', text: 'START JOB · HEAT INDEX' };

  laneCar(state, x - 82, y + 44, 0, '#c8402f');
  laneCar(state, x + 136, y + 44, 0, '#3b3f4a');
  laneCar(state, plaza.x - 44, y - 6, -Math.PI / 2, '#2f6fa8');
  trafficCar(state, 'h', plaza.y + plaza.h + 44, x + 300, -1, '#d9c37a', 'van', 80);
  trafficCar(state, 'v', plaza.x + plaza.w + 26, y + 210, -1, '#8d8f96', 'sedan', 90);
  // The plaza crowd, walking to and from the fountain.
  for (let i = 0; i < 8; i += 1) {
    person(state, plaza.fx - 150 + i * 42, plaza.fy + 118 + (i % 2) * 16, i % 2 ? Math.PI : 0, { speed: 30 + (i % 3) * 6 });
  }
  for (let i = 0; i < 6; i += 1) {
    person(state, plaza.fx - 96 + i * 38, plaza.fy + 46, i % 2 ? 0.1 : Math.PI - 0.1, { speed: 26 + (i % 4) * 5 });
  }
  person(state, x + 26, y + 26, -Math.PI / 2, { speed: 26 });
  person(state, x - 22, y + 74, Math.PI / 2, { speed: 32 });
  person(state, x + 74, y + 30, -Math.PI / 2, { speed: 34 });
  crowd(state, 16, 620);
  settle(state, 22, createNullInput());
  state.player.aim = -Math.PI / 2 + 0.25;
  state.pointerScreen = { x: 760, y: 300 };
  frameCamera(state, 0, -34, 1.06);
}

/** Shot 3: three stars, a cruiser on the bumper, one alongside, the downtown avenue lit up. */
function stagePursuit(state) {
  const city = state.city;
  const roadX = city.cols[5];
  const y = city.rows[4] + 30;
  state.tod = 0.62;
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

/** Shot 4: a job brief on the coast road at sunset, the crates waiting on the sand behind. */
function stageMission(state) {
  const city = state.city;
  state.tod = 0.5;
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
  const y = city.rows[0] + 26;
  const car = laneCar(state, x, y, 0, '#c8402f');
  car.driven = true;
  car.hp = 5;
  state.car = car;
  state.player.inCar = true;
  teleport(state, x, y, 0);
  laneCar(state, x + 90, y + 44, 0, '#3b3f4a');
  laneCar(state, x - 110, y + 44, 0, '#d9c37a');
  laneCar(state, x - 210, y - 44, Math.PI, '#2f6fa8');
  person(state, x + 40, y - 30, 0, { speed: 22 });
  person(state, x + 100, y + 30, Math.PI, { speed: 26 });
  for (let i = 0; i < 5; i += 1) person(state, x - 140 + i * 60, y - 80, 0, { speed: 20 });
  crowd(state, 14, 560);
  settle(state, 8);
  openDialogue(state, def.giver, def.brief);
  state.missions.dialogue.index = 1;
  frameCamera(state, 40, -50, 1.02);
}

/**
 * Shot 6: the aerial. The camera hangs back over the bay at dusk so the grid reads whole in one
 * frame: the water and the sand along the top edge, nine avenues by four streets of blocks below
 * it, traffic down every lane in both directions, cruisers working the downtown blocks and the HUD
 * over the top. Only what lands inside the frame is placed, so the shot stays cheap to paint.
 */
const AERIAL = { zoom: 0.33, x: 2610, y: 1290 };

function stageAerial(state) {
  const city = state.city;
  const zoom = AERIAL.zoom;
  const camX = AERIAL.x;
  const camY = AERIAL.y;
  const halfW = 640 / zoom;
  const halfH = 360 / zoom;
  const inFrameX = (x) => x > camX - halfW - 80 && x < camX + halfW + 80;
  const inFrameY = (y) => y > camY - halfH - 80 && y < camY + halfH + 80;
  state.tod = 0.52;
  state.cash = 4875;
  state.progress = 3;
  state.wanted = 2;
  state.heat = 2;
  state.evadeTimer = 0;
  state.pickups = [];
  state.toasts = [];
  state.missions.index = 3;
  state.missions.prompt = null;
  const plaza = city.downtown.plaza;
  state.missions.marker = { x: plaza.fx, y: plaza.y - 30, label: 'CITY HALL', kind: 'job', mission: 'HEAT INDEX', radius: 110 };
  state.missions.objective = { text: 'CRUISE THE CITY · THE JOB IS MARKED ON THE MAP', title: 'CITY LIGHTS', stage: 2, count: 5 };

  // The kerbside cars the city already parked along the downtown bays stay; the loose cruisers go,
  // so every lane in the frame below is placed by hand and lands exactly where the frame shows it.
  state.cars = state.cars.filter((c) => c.alive && c.parked);
  state.peds = [];

  const colors = ['#c8402f', '#2f6fa8', '#d9c37a', '#3b3f4a', '#e0e2e6', '#5a2d6e', '#2f8f6b', '#b8563a', '#8d8f96', '#243a5e'];
  const kinds = ['sedan', 'sedan', 'sedan', 'van', 'sport'];
  let n = 0;
  const next = () => {
    const color = colors[(n * 7) % colors.length];
    const kind = kinds[(n * 3) % kinds.length];
    n += 1;
    return [color, kind];
  };

  // Both lanes of every street in frame, spaced unevenly so the traffic reads as moving, not parked.
  for (let j = 0; j <= 5; j += 1) {
    const row = city.rows[j];
    for (const dir of [1, -1]) {
      let x = camX - halfW + ((j * 173 + (dir > 0 ? 40 : 220)) % 300);
      while (x < camX + halfW) {
        const [color, kind] = next();
        trafficCar(state, 'h', row + dir * 26, x, dir, color, kind, 45 + (n * 37) % 85);
        x += 205 + ((n * 97) % 120);
      }
    }
  }
  // And both lanes of every avenue, kept south of the sand.
  for (let i = 0; i <= 11; i += 1) {
    const col = city.cols[i];
    for (const dir of [1, -1]) {
      let y = Math.max(WORLD.beachY + 44, camY - halfH + ((i * 121 + (dir > 0 ? 0 : 160)) % 280));
      while (y < camY + halfH) {
        const [color, kind] = next();
        trafficCar(state, 'v', col + dir * 26, y, dir, color, kind, 45 + (n * 37) % 85);
        y += 215 + ((n * 97) % 115);
      }
    }
  }

  // Three cruisers working the downtown blocks, lights turning: the ambience the aerial needs.
  for (const [ci, rj, siren] of [[1, 2, 0.2], [4, 3, 0.55], [7, 1, 0.85]]) {
    const cop = laneCar(state, city.cols[ci] + 26, city.rows[rj] - 26, Math.PI, '#e9edf5', 'police');
    cop.police = true;
    cop.hp = 3;
    cop.siren = siren;
  }

  // Pedestrians on the pavements at every junction in frame, walking their own side of it.
  const corner = city.half + 20;
  for (let j = 0; j <= 5; j += 1) {
    for (let i = 0; i <= 11; i += 1) {
      const x = city.cols[i];
      const y = city.rows[j];
      if (!inFrameX(x) || !inFrameY(y)) continue;
      person(state, x - corner, y - corner, 0, { speed: 28 });
      person(state, x + corner, y + corner, Math.PI, { speed: 34 });
      person(state, x - corner - 48, y - corner, 0, { speed: 31 });
      if ((i + j) % 2 === 0) person(state, x + corner, y - corner, Math.PI / 2, { speed: 26 });
      person(state, x + corner, y + corner + 56, -Math.PI / 2, { speed: 30 });
    }
  }

  // Swell lines and foam over the bay, so the water along the top edge reads as water, not sky.
  for (let i = 0; i < 5; i += 1) {
    state.effects.particles.push({
      x: camX - halfW * 0.8 + i * (halfW * 0.4), y: WORLD.coastY - 130 - (i % 3) * 70,
      vx: 0, vy: 0, life: 0.55, max: 1, size: 150 + (i % 2) * 40, color: i % 2 ? '#3fa8cc' : '#2f7fb0', kind: 'flash', drag: 0,
    });
  }
  for (let row = 0; row < 9; row += 1) {
    const y = WORLD.coastY - 22 - row * 40;
    for (let i = 0; i < 26; i += 1) {
      state.effects.particles.push({
        x: camX - halfW * 0.94 + ((i + (row % 2) * 0.5) / 25) * halfW * 1.88,
        y: y + ((i * 7 + row) % 5) - 2, vx: 0, vy: 0, life: 1, max: 1,
        size: 24 + ((i * 13 + row * 5) % 26), color: `rgba(210,238,255,${0.22 + (row % 3) * 0.14})`, kind: 'stain', drag: 0,
      });
    }
  }
  // The surf where the bay meets the sand.
  for (let i = 0; i < 30; i += 1) {
    const x = camX - halfW * 0.94 + (i / 29) * halfW * 1.88;
    state.effects.particles.push({ x, y: WORLD.coastY - 5 - (i % 3) * 10, vx: 0, vy: 0, life: 0.85, max: 1, size: 22 + (i % 4) * 9, color: 'rgba(238,250,255,0.7)', kind: 'stain', drag: 0 });
  }

  // The hero car on the boulevard, mid-block and heading east along the front.
  const car = laneCar(state, city.cols[5] + 40, city.rows[1] + 26, 0, '#12b0c9', 'sport');
  car.driven = true;
  car.hp = 5;
  car.speed = 300;
  car.vx = 300;
  state.car = car;
  state.player.inCar = true;
  teleport(state, car.x, car.y, 0);
  car.x = city.cols[5] + 40;
  car.y = city.rows[1] + 26;
  // Rolling east along the front, so the HUD reads a speed and the frame reads mid-motion.
  car.vx = 300;
  car.speed = 300;
  // Rubber already laid down behind it.
  for (let i = 0; i < 12; i += 1) addSkid(state.effects, car.x - 96 - i * 13, car.y + 9, 0, 3.2);

  frameCamera(state, camX - state.player.x, camY - state.player.y, zoom);
}

export { startMission, startCourier, dist, PALETTE };