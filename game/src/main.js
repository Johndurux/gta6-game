// Boot plus the single frame loop: fixed 1/60 s simulation steps, one render per frame, the title/play/pause cards, and the ?shot= hook that stages a screenshot scene instead.

import { ECON, STEP } from './core/config.js';
import { createInput, createNullInput } from './core/input.js';
import { createWorld, updateWorld, teleport } from './world/world.js';
import { advanceDialogue, handleUse, initMissions } from './world/missions.js';
import { createRenderer } from './render/renderer.js';
import { readSave, writeSave } from './save/save.js';
import { stageShot } from './shots.js';

/** A frame longer than this is a stall (a hidden tab, a breakpoint), not time to catch up on. */
const MAX_FRAME = 0.25;
const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);
renderer.resize();

// Anything that goes wrong is visible in the page's text, so a headless check can see it.
function reportError(message) {
  status.textContent = `ERROR ${message}`;
  document.title = `ERROR ${message}`;
}
window.addEventListener('error', (event) => reportError(event.message));
window.addEventListener('unhandledrejection', (event) => reportError(String(event.reason)));

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261120;

const input = createInput(canvas);
const quiet = createNullInput();
const ui = { screen: 'title', hasSave: Boolean(readSave()), pauseIndex: 0, saveMessage: false, seed };
let state = createWorld(seed, { save: shot ? null : readSave() });
let saveTimer = null;

function announce(message) {
  status.textContent = message;
}

function startGame(useSave) {
  state = createWorld(seed, { save: useSave ? readSave() : null });
  if (!useSave) {
    state.cash = ECON.startCash;
    state.progress = 0;
    state.missions.index = 0;
    initMissions(state);
    const home = state.city.places.home;
    teleport(state, home.x + 84, home.y + 84);
  }
  ui.screen = 'play';
  ui.saveMessage = false;
  input.clearQueue();
  state.audio.start();
  state.toast(useSave ? 'SAVE LOADED' : 'WELCOME TO VELARA BAY', '#ffd24a');
  announce('Velvet Coast. On foot outside the safehouse. Press E at the car to take it.');
}

function openPause() {
  ui.screen = 'pause';
  ui.pauseIndex = 0;
  state.audio.engineOff();
  writeSave(state);
  announce('Paused.');
}

function pauseAction() {
  if (ui.pauseIndex === 0) {
    ui.screen = 'play';
    announce('Playing.');
  } else if (ui.pauseIndex === 1) {
    writeSave(state);
    ui.saveMessage = true;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { ui.saveMessage = false; }, 2400);
    announce('Game saved to this browser.');
  } else {
    ui.screen = 'title';
    ui.hasSave = Boolean(readSave());
    announce('Title screen.');
  }
}

/** Input for the menu screens: confirm, back, and the up/down selection. */
function handleMenu(actions) {
  if (ui.screen === 'title') {
    if (actions.includes('confirm') || actions.includes('click')) {
      state.audio.start();
      startGame(false);
    } else if (actions.includes('KeyC')) {
      if (ui.hasSave) {
        state.audio.start();
        startGame(true);
      }
    }
    return;
  }
  if (actions.includes('pause')) {
    ui.screen = 'play';
    return;
  }
  if (actions.includes('KeyW') || actions.includes('ArrowUp')) ui.pauseIndex = (ui.pauseIndex + 2) % 3;
  if (actions.includes('KeyS') || actions.includes('ArrowDown')) ui.pauseIndex = (ui.pauseIndex + 1) % 3;
  if (actions.includes('confirm') || actions.includes('use')) pauseAction();
}

function runGame() {
  let last = performance.now();
  let accumulator = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    const elapsed = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.take();
    state.pointer = renderer.screenToWorld(input.mouse.x, input.mouse.y);
    state.pointerScreen = { x: input.mouse.x, y: input.mouse.y };

    if (ui.screen !== 'play') {
      handleMenu(actions);
      if (ui.screen === 'title') {
        updateWorld(state, elapsed, quiet, state.pointer);
      } else if (ui.screen === 'pause') {
        state.paused = true;
      }
      renderer.draw(state, ui);
      return;
    }
    state.paused = false;

    if (actions.includes('pause')) {
      openPause();
      renderer.draw(state, ui);
      return;
    }
    if (state.missions.dialogue) {
      if (actions.includes('space') || actions.includes('use') || actions.includes('click')) advanceDialogue(state);
    } else if (actions.includes('use')) {
      handleUse(state);
    }
    if (actions.length) state.audio.start();

    accumulator += elapsed;
    let steps = 0;
    while (accumulator >= STEP && steps < 6) {
      updateWorld(state, STEP, input, state.pointer);
      accumulator -= STEP;
      steps += 1;
    }
    renderer.draw(state, ui);
  }
  requestAnimationFrame(frame);
}

function runShot(name) {
  stageShot(name, state);
  let painted = 0;
  window.__shotReady = false;
  // The aim reads this pointer, so shots that fire or face something aim where the frame looks.
  state.pointer = state.pointerScreen ? { ...state.pointerScreen } : { x: 760, y: 300 };
  function paint() {
    renderer.draw(state, { screen: 'play', showPrompt: false });
    painted += 1;
    if (painted >= 3) window.__shotReady = true;
    requestAnimationFrame(paint);
  }
  requestAnimationFrame(paint);
}

window.addEventListener('resize', () => renderer.resize());
if (shot) runShot(shot);
else runGame();