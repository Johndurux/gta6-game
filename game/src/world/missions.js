// The story: five jobs from Doc Vela, each with a brief, objectives, a marker and a cash reward,
// plus the two things to do between them — collect the drops left around the city and run the
// depot's courier delivery. Markers, prompts and the objective line all come from here.

import { ECON, PALETTE, PLACES, WORLD } from '../core/config.js';
import { clamp, dist } from '../core/math.js';
import { addText, spawnSparks } from './effects.js';
import { createCar } from './traffic.js';
import { createPed } from './peds.js';
import { enterCar, nearestCar, toggleVehicle } from './player.js';

export const MISSIONS = [
  {
    id: 'sunset-run',
    title: 'SUNSET RUN',
    giverPlace: 'home',
    giver: 'DOC VELA',
    brief: [
      "You're late, and you're on foot. That's two problems at once, chico.",
      'Take anything at the kerb. Something with a little rust — less paperwork.',
      'Then come find me at Pier 9. The sunset makes the water look expensive.',
    ],
    objectives: [
      { type: 'car', text: 'TAKE A CAR — anything parked at the kerb' },
      { type: 'goto', place: 'pier', radius: 95, text: 'DRIVE TO PIER 9' },
    ],
    reward: 380,
  },
  {
    id: 'salt-static',
    title: 'SALT & STATIC',
    giverPlace: 'pier',
    giver: 'DOC VELA',
    brief: [
      'Three crates came off a boat that does not exist, on a manifest nobody signed.',
      'They are sitting on the sand between here and the marina. Go and get them before the tide does.',
      'Then run them up to the radio tower and do not open the lids. I like you curious, not dead.',
    ],
    objectives: [
      { type: 'collect', kind: 'crate', count: 3, text: 'PICK UP THE CRATES ON THE BEACH', spawn: 'beach' },
      { type: 'goto', place: 'tower', radius: 90, needsCar: true, text: 'DRIVE THE CRATES TO THE RADIO TOWER' },
    ],
    reward: 720,
  },
  {
    id: 'bad-signal',
    title: 'BAD SIGNAL',
    giverPlace: 'tower',
    giver: 'MIRA SOL',
    brief: [
      'The tower is clean, but somebody has been talking on our frequency.',
      'Two of the marina boys, dealing out of the boat yard like they invented it.',
      'Go and have a word. Bring the pistol. The word is short.',
    ],
    objectives: [
      { type: 'goto', place: 'marina', radius: 110, text: 'GET TO THE MARINA' },
      { type: 'kill', count: 2, text: 'SHUT DOWN THE DEALERS', spawn: 'marina' },
    ],
    reward: 980,
  },
  {
    id: 'heat-index',
    title: 'HEAT INDEX',
    giverPlace: 'club',
    giver: 'MIRA SOL',
    brief: [
      'Every cop in Velara Bay thinks you are the reason the marina went quiet.',
      'Good. Let them think it. But do not let them hold you.',
      'Get their attention, then lose it. Three minutes of nothing and they go back to chasing tourists.',
    ],
    objectives: [
      { type: 'evade', stars: 2, text: 'LOSE THE POLICE' },
    ],
    reward: 1450,
  },
  {
    id: 'last-wave',
    title: 'THE LAST WAVE',
    giverPlace: 'observatory',
    giver: 'DOC VELA',
    brief: [
      'The man from the boat is in a purple coupe, up on the hill, watching his city burn.',
      'He is going to run for the coast. Do not let him get there with the manifest.',
      'Put that car in a wall. Then come home and we will talk about what comes next.',
    ],
    objectives: [
      { type: 'wreck', text: 'WRECK THE PURPLE COUPE' },
      { type: 'goto', place: 'home', radius: 100, text: 'GET BACK TO THE SAFEHOUSE' },
    ],
    reward: 2600,
  },
];

export function createMissionState() {
  return {
    index: 0,
    total: MISSIONS.length,
    active: null,
    marker: null,
    dialogue: null,
    prompt: null,
    banner: null,
    objective: null,
    pickups: [],
    crates: [],
    targets: [],
    rival: null,
    courier: null,
    pickupTimer: 0,
    completed: 0,
    /** The payslips: one line per job passed, kept for the HUD's paid-so-far list. */
    ledger: [],
  };
}

/** Scatter the free cash drops and start the first marker. */
export function initMissions(state) {
  const m = state.missions;
  m.index = state.progress;
  m.marker = giverMarker(state);
  state.pickups = [];
  for (let i = 0; i < 10; i += 1) spawnCashDrop(state);
  state.pickups = m.pickups;
}

function spawnCashDrop(state) {
  const rng = state.rng;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const col = rng.chance(0.5);
    let x;
    let y;
    if (col) {
      x = state.city.cols[rng.int(state.city.cols.length)] + rng.sign() * 70;
      y = rng.range(WORLD.coastY + 120, WORLD.height - 100);
    } else {
      x = rng.range(80, WORLD.width - 80);
      y = state.city.rows[rng.int(state.city.rows.length)] + rng.sign() * 70;
    }
    if (state.city.buildings.some((b) => x > b.x - 20 && x < b.x + b.w + 20 && y > b.y - 20 && y < b.y + b.h + 20)) continue;
    if (dist(x, y, state.player.x, state.player.y) < 350) continue;
    state.missions.pickups.push({ x, y, value: ECON.pickup, phase: rng.range(0, 6.28) });
    return;
  }
}

function giverMarker(state) {
  const def = MISSIONS[state.missions.index];
  if (!def) return null;
  const place = state.city.places[def.giverPlace];
  if (!place) return null;
  return { x: place.x, y: place.y, label: place.label, kind: 'job', mission: def.title, radius: 110 };
}

/** Talk through the brief, then hand the job over. */
export function startMission(state, def = MISSIONS[state.missions.index]) {
  if (!def) return;
  const m = state.missions;
  m.active = { def, stage: 0, targets: [], rival: null, everWanted: 0, timer: 0 };
  m.marker = null;
  m.objective = null;
  openDialogue(state, def.giver, def.brief, () => beginObjectives(state, def));
  state.sfx('phone');
}

export function openDialogue(state, speaker, lines, onEnd = null) {
  state.missions.dialogue = { speaker, lines: [...lines], index: 0, onEnd, clock: 0 };
  state.missions.prompt = null;
}

export function advanceDialogue(state) {
  const d = state.missions.dialogue;
  if (!d) return false;
  d.index += 1;
  if (d.index >= d.lines.length) {
    state.missions.dialogue = null;
    if (d.onEnd) d.onEnd();
  }
  return true;
}

function beginObjectives(state, def) {
  const m = state.missions;
  const first = def.objectives[0];
  if (first.type === 'collect') {
    const spots = [3, 6, 9].map((col) => ({ x: state.city.cols[col], y: WORLD.beachY - 70 }));
    m.crates = spots.map((s) => ({ x: s.x, y: s.y, taken: false, phase: Math.random() * 6.28 }));
  }
  if (first.type === 'kill') {
    spawnDealers(state, state.city.places.marina, 2);
  }
  if (first.type === 'wreck') {
    spawnRival(state);
  }
  if (first.type === 'evade') {
    m.active.everWanted = 1;
    state.setWanted(first.stars ?? 2, false);
    state.toast('THEY SAW YOU', PALETTE.neonPink);
  }
  refreshObjective(state);
}

function spawnDealers(state, place, count) {
  const m = state.missions;
  for (let i = 0; i < count; i += 1) {
    const ped = createPed(state.rng, place.x + (i === 0 ? -60 : 70), place.y + 90 + i * 40, { hostile: true, role: 'dealer', speed: 40 });
    ped.health = 2;
    ped.armed = true;
    state.peds.push(ped);
    m.targets.push(ped);
  }
}

function spawnRival(state) {
  const place = state.city.places.observatory;
  const car = createCar(place.x + 90, place.y + 90, -Math.PI / 2, 'sport', '#6a2fa8');
  car.axis = null;
  car.parked = false;
  car.rival = true;
  car.hp = 4;
  car.speed = 200;
  car.cruise = 260;
  state.cars.push(car);
  state.missions.rival = car;
  state.missions.targets = [car];
}

function refreshObjective(state) {
  const m = state.missions;
  m.marker = null;
  if (!m.active) { m.objective = null; return; }
  const def = m.active.def;
  const obj = def.objectives[m.active.stage];
  if (!obj) return;
  m.objective = {
    text: obj.text, title: def.title, order: m.index + 1,
    stage: m.active.stage + 1, count: def.objectives.length,
  };
  if (obj.type === 'goto') {
    const place = state.city.places[obj.place];
    m.marker = place ? { x: place.x, y: place.y, label: place.label, kind: 'goal', radius: obj.radius ?? 90 } : null;
  } else if (obj.type === 'collect') {
    const crate = firstCrate(state);
    m.marker = crate ? { ...crate, kind: 'goal' } : null;
  } else if (obj.type === 'kill') {
    const target = m.targets.find((t) => t.alive);
    m.marker = target ? { x: target.x, y: target.y, label: 'THE DEALERS', kind: 'goal', radius: 70, follow: target } : null;
  } else if (obj.type === 'wreck') {
    const rival = m.rival;
    m.marker = rival ? { x: rival.x, y: rival.y, label: 'THE COUPE', kind: 'goal', radius: 60, follow: rival } : null;
  } else if (obj.type === 'evade') {
    m.marker = null;
  } else {
    m.marker = null;
  }
}

function firstCrate(state) {
  const m = state.missions;
  const crate = m.crates.find((c) => !c.taken);
  if (!crate) return null;
  return { x: crate.x, y: crate.y, label: 'CRATE', kind: 'goal', radius: 70, follow: crate };
}

function completeObjective(state) {
  const m = state.missions;
  const def = m.active.def;
  m.active.stage += 1;
  if (m.active.stage >= def.objectives.length) {
    passMission(state);
  } else {
    state.sfx('objective');
    state.toast('OBJECTIVE COMPLETE', PALETTE.neonGreen);
    const next = def.objectives[m.active.stage];
    if (next.type === 'collect') {
      const spots = [3, 6, 9].map((col) => ({ x: state.city.cols[col], y: WORLD.beachY - 70 }));
      m.crates = spots.map((s) => ({ x: s.x, y: s.y, taken: false, phase: Math.random() * 6.28 }));
    }
    if (next.type === 'kill') spawnDealers(state, state.city.places.marina, next.count ?? 2);
    if (next.type === 'wreck') spawnRival(state);
    refreshObjective(state);
  }
}

function passMission(state) {
  const m = state.missions;
  const def = m.active.def;
  const order = m.index + 1;
  state.cash += def.reward;
  state.stats.missions += 1;
  m.completed += 1;
  m.ledger.push({ order, title: def.title, reward: def.reward });
  if (m.ledger.length > 5) m.ledger.shift();
  m.index = Math.min(MISSIONS.length, m.index + 1);
  state.progress = m.index;
  m.active = null;
  m.crates = [];
  m.targets = [];
  m.rival = null;
  m.objective = null;
  m.marker = giverMarker(state);
  m.banner = {
    text: 'JOB PASSED',
    sub: `JOB ${order} · ${def.title}   +$${def.reward.toLocaleString('en-US')}`,
    life: 5,
    color: PALETTE.neonAmber,
  };
  state.sfx('mission');
  state.onProgress();
}

/**
 * One mission step: follow a moving marker, tick the courier, catch the rival, and test whatever
 * the current objective asks for. Also hands out prompts when the player stands somewhere useful.
 */
export function updateMissions(state, dt) {
  const m = state.missions;
  if (m.banner) {
    m.banner.life -= dt;
    if (m.banner.life <= 0) m.banner = null;
  }
  if (m.dialogue) m.dialogue.clock += dt;

  // The rival's escape drive.
  if (m.rival && m.rival.alive) {
    driveRival(state, m.rival, dt);
    if (m.marker && m.marker.follow === m.rival) {
      m.marker.x = m.rival.x;
      m.marker.y = m.rival.y;
    }
  }

  // Collectable crates and cash drops.
  for (const crate of m.crates) {
    if (crate.taken) continue;
    if (dist(state.player.x, state.player.y, crate.x, crate.y) < (state.player.inCar ? 64 : 38)) {
      crate.taken = true;
      addText(state.effects, crate.x, crate.y - 26, 'CRATE SECURED', PALETTE.neonCyan, 14);
      state.sfx('pickup');
      const left = m.crates.filter((c) => !c.taken).length;
      state.toast(left === 0 ? 'ALL CRATES SECURED' : `${left} CRATE${left === 1 ? '' : 'S'} LEFT`, PALETTE.neonCyan);
      if (m.marker && m.marker.follow === crate) m.marker = firstCrate(state) ? { ...firstCrate(state), kind: 'goal' } : null;
    }
  }
  for (let i = state.pickups.length - 1; i >= 0; i -= 1) {
    const p = state.pickups[i];
    if (dist(state.player.x, state.player.y, p.x, p.y) < (state.player.inCar ? 46 : 28)) {
      state.pickups.splice(i, 1);
      state.cash += p.value;
      state.stats.pickups += 1;
      addText(state.effects, p.x, p.y - 18, `+$${p.value}`, PALETTE.cash, 16);
      spawnSparks(state.effects, p.x, p.y, 8, PALETTE.cash, 110);
      state.sfx('cash');
    }
  }
  m.pickupTimer -= dt;
  if (m.pickupTimer <= 0 && state.pickups.length < 11) {
    spawnCashDrop(state);
    m.pickupTimer = 18;
  }

  updateCourier(state, dt);

  // Objectives.
  const active = m.active;
  if (!active) {
    m.prompt = interactionPrompt(state);
    return;
  }
  const obj = active.def.objectives[active.stage];
  if (!obj) return;
  if (obj.type === 'car') {
    if (state.player.inCar) completeObjective(state);
  } else if (obj.type === 'goto') {
    const place = state.city.places[obj.place];
    if (place && dist(state.player.x, state.player.y, place.x, place.y) < (obj.radius ?? 90) && (!obj.needsCar || state.player.inCar)) {
      completeObjective(state);
    }
  } else if (obj.type === 'collect') {
    if (m.crates.length && m.crates.every((c) => c.taken)) completeObjective(state);
  } else if (obj.type === 'kill') {
    if (m.targets.length && m.targets.every((t) => !t.alive)) completeObjective(state);
  } else if (obj.type === 'wreck') {
    if (m.rival && !m.rival.alive) completeObjective(state);
  } else if (obj.type === 'evade') {
    if (state.wanted > 0) active.everWanted = 1;
    if (active.everWanted && state.wanted === 0) completeObjective(state);
  }
  m.prompt = interactionPrompt(state);
}

function driveRival(state, car, dt) {
  const player = state.player;
  const away = Math.atan2(car.y - player.y, car.x - player.x);
  const towardCoast = Math.atan2(300 - car.y, car.x - player.x);
  const goal = dist(car.x, car.y, player.x, player.y) < 500 ? away : towardCoast;
  car.angle += clamp(Math.atan2(Math.sin(goal - car.angle), Math.cos(goal - car.angle)), -2.4 * dt, 2.4 * dt);
  car.speed = Math.min(300, car.speed + 160 * dt);
  car.vx = Math.cos(car.angle) * car.speed;
  car.vy = Math.sin(car.angle) * car.speed;
  car.x = clamp(car.x + car.vx * dt, 40, WORLD.width - 40);
  car.y = clamp(car.y + car.vy * dt, WORLD.coastY + 60, WORLD.height - 40);
  if (state.effects.particles.length < 300 && car.speed > 200 && Math.random() < 0.15) {
    state.effects.particles.push({
      x: car.x, y: car.y, vx: 0, vy: -10, life: 0.5, max: 0.5, size: 9,
      color: 'rgba(200,190,210,0.2)', kind: 'smoke', drag: 2,
    });
  }
}

export function startCourier(state) {
  const m = state.missions;
  if (m.courier || m.active) return;
  const keys = ['marina', 'tower', 'observatory', 'club', 'pier', 'home'];
  const targetKey = keys[state.rng.int(keys.length)];
  const place = state.city.places[targetKey];
  m.courier = { target: { x: place.x, y: place.y, label: place.label, kind: 'courier', radius: 90 }, reward: ECON.courierReward, timer: 0 };
  state.toast(`COURIER RUN · ${place.label}`, PALETTE.neonCyan);
  state.sfx('objective');
}

function updateCourier(state, dt) {
  const m = state.missions;
  if (!m.courier) return;
  m.courier.timer += dt;
  const t = m.courier.target;
  if (dist(state.player.x, state.player.y, t.x, t.y) < t.radius) {
    state.cash += m.courier.reward;
    addText(state.effects, state.player.x, state.player.y - 30, `+$${m.courier.reward}`, PALETTE.cash, 18);
    state.toast('DELIVERY PAID', PALETTE.cash);
    state.sfx('cash');
    m.courier = null;
    return;
  }
  if (m.courier.timer > 120) {
    state.toast('DELIVERY EXPIRED', PALETTE.neonPink);
    m.courier = null;
  }
}

/** What the HUD's little key hint should offer right now. */
export function interactionPrompt(state) {
  const m = state.missions;
  if (m.dialogue) return { key: 'SPACE', text: 'CONTINUE' };
  if (m.marker && m.marker.kind === 'job' && dist(state.player.x, state.player.y, m.marker.x, m.marker.y) < 130) {
    return { key: 'E', text: `START JOB · ${MISSIONS[m.index]?.title ?? 'THE CITY'}` };
  }
  if (!m.active && !m.courier) {
    const depot = state.city.places.depot;
    if (dist(state.player.x, state.player.y, depot.x, depot.y) < 130) return { key: 'E', text: 'START COURIER RUN · $250' };
  }
  if (state.player.inCar) return { key: 'E', text: 'STEP OUT' };
  const car = nearestCar(state);
  if (car) return { key: 'E', text: 'TAKE THE CAR' };
  return null;
}

/** E: talk, start a job, take a car, step out — in that order of importance. */
export function handleUse(state) {
  const m = state.missions;
  if (m.dialogue) { advanceDialogue(state); return true; }
  if (m.marker && m.marker.kind === 'job' && dist(state.player.x, state.player.y, m.marker.x, m.marker.y) < 130) {
    startMission(state);
    return true;
  }
  if (!m.active && !m.courier) {
    const depot = state.city.places.depot;
    if (dist(state.player.x, state.player.y, depot.x, depot.y) < 130) { startCourier(state); return true; }
  }
  if (state.player.inCar) { toggleVehicle(state); return true; }
  const car = nearestCar(state);
  if (car) { enterCar(state, car); return true; }
  return false;
}

/** Where the HUD should point the player: the live marker, or the next job's giver. */
export function currentMarker(state) {
  const m = state.missions;
  if (m.dialogue) return null;
  if (m.marker) return m.marker;
  if (m.courier) return m.courier.target;
  return giverMarker(state);
}