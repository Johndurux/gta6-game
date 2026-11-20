// Boot plus the single frame loop: fixed 1/60 s simulation steps, one render per frame, the title/play/pause cards, and the ?shot= hook that stages a screenshot scene instead.
// Three.js is loaded as a second renderer: the 2.5D canvas renderer stays for the title screen and as fallback,
// and takes over the WebGL context when the 3D gameplay mode is active.

import * as THREE from '../vendor/three.module.min.js';
import { ECON, STEP } from './core/config.js';
import { createInput, createNullInput } from './core/input.js';
import { createWorld, updateWorld, teleport } from './world/world.js';
import { advanceDialogue, handleUse, initMissions } from './world/missions.js';
import { createRenderer } from './render/renderer.js';
import { readSave, writeSave } from './save/save.js';
import { stageShot, shotUi } from './shots.js';

/** A frame longer than this is a stall (a hidden tab, a breakpoint), not time to catch up on. */
const MAX_FRAME = 0.25;
const canvas = document.getElementById('game');
const status = document.getElementById('status');

// ---- Three.js setup (shared the canvas element) ----
let threeRenderer = null;
let threeCamera = null;
let threeScene = null;

function initThree() {
  threeRenderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  threeRenderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  threeRenderer.shadowMap.enabled = true;
  threeRenderer.shadowMap.type = THREE.PCFSoftShadowMap;

  threeScene = new THREE.Scene();

  threeCamera = new THREE.PerspectiveCamera(75, 1280 / 720, 0.1, 5000);
  threeCamera.position.set(0, 200, 400);
  threeCamera.lookAt(0, 0, 0);

  // Sun directional light with soft shadows
  const sun = new THREE.DirectionalLight(0xffe8c3, 1.2);
  sun.position.set(500, 800, 300);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 2048;
  sun.shadow.mapSize.height = 2048;
  sun.shadow.camera.near = 200;
  sun.shadow.camera.far = 2000;
  sun.shadow.bias = -0.0001;
  threeScene.add(sun);

  // Ambient light
  const ambient = new THREE.AmbientLight(0x4a3f32, 0.6);
  threeScene.add(ambient);

  // Fog: warm horizon fog
  threeScene.fog = new THREE.Fog(0x2a1a3c, 800, 3000);

  // Ocean plane
  const oceanGeom = new THREE.PlaneGeometry(5000, 5000, 256, 256);
  oceanGeom.rotateX(-Math.PI / 2);
  const oceanMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a40,
    roughness: 0.6,
    metalness: 0.05,
  });
  const ocean = new THREE.Mesh(oceanGeom, oceanMat);
  ocean.receiveShadow = true;
  threeScene.add(ocean);

  // City group (populated later when game starts)
  threeScene.cityGroup = new THREE.Group();
  threeScene.add(threeScene.cityGroup);

  // Sun glint
  const glint = new THREE.Mesh(
    new THREE.SphereGeometry(150, 32, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd93d, transparent: true, opacity: 0.08 })
  );
  glint.position.set(400, 120, -200);
  threeScene.add(glint);

  // Sky sphere
  const skyGeo = new THREE.SphereGeometry(2000, 32, 32);
  const skyMat = new THREE.MeshBasicMaterial({
    color: 0x2a4a72,
    side: THREE.BackSide,
    transparent: true,
    opacity: 0.9,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.name = 'sky';
  threeScene.add(sky);

  // Resize handler
  const onResize = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    threeRenderer.setSize(w, h, false);
    threeCamera.aspect = w / h;
    threeCamera.updateProjectionMatrix();
  };
  window.addEventListener('resize', onResize);
  onResize();
}

// Initialize Three.js if the vendor file is available
try {
  initThree();
} catch (e) {
  // Three.js not available; threeRenderer stays null and we fall back to 2D only
}

// ---- End Three.js setup ----

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
  if (threeRenderer) threeRenderer.domElement.style.display = 'none';
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
    announce('Restarted. Back on the title screen.');
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
      // Render 3D if active
      if (threeRenderer) {
        renderThreeScene(state);
        threeRenderer.render(threeScene, threeCamera);
      }
      return;
    }

    state.paused = false;

    if (actions.includes('pause')) {
      openPause();
      renderer.draw(state, ui);
      if (threeRenderer) {
        renderThreeScene(state);
        threeRenderer.render(threeScene, threeCamera);
      }
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
    // 3D render pass during gameplay
    if (threeRenderer) {
      renderThreeScene(state);
      threeRenderer.render(threeScene, threeCamera);
    }
  }
  requestAnimationFrame(frame);
}

function renderThreeScene(state) {
  if (!threeScene || !threeCamera) return;

  // Update sky color based on time of day
  const sky = threeScene.getObjectByName('sky');
  if (sky) {
    if (state.tod < 0.45) sky.material.color.set('#bfd8ff');
    else if (state.tod < 0.58) sky.material.color.set('#ffb08a');
    else if (state.tod < 0.7) sky.material.color.set('#b06a9a');
    else sky.material.color.set('#4a5aa8');
  }

  // Position city group from sim data
  if (state.city && threeScene.cityGroup) {
    const player = state.player;
    // Player figure
    const playerFig = threeScene.cityGroup.getObjectByName('playerFigure');
    if (playerFig) {
      playerFig.position.set(player.x, 20, player.y);
      playerFig.rotation.z = player.angle;
    }
    // Player car
    const playerCar = threeScene.cityGroup.getObjectByName('playerCar');
    if (playerCar && state.car) {
      playerCar.position.set(state.car.x, 12.5, state.car.y);
      playerCar.rotation.z = state.car.angle;
    }
  }

  // Camera: trail the player
  const player = state.player;
  const car = state.car;
  const speed = car ? Math.hypot(car.vx, car.vy) : Math.hypot(player.vx, player.vy);
  const leadX = car ? car.vx * 0.3 : player.vx * 0.22;
  const leadY = car ? car.vy * 0.3 : player.vy * 0.22;
  const targetX = player.x + leadX;
  const targetY = player.y + leadY;
  threeCamera.position.set(targetX, 200, targetY + 200);
  threeCamera.lookAt(targetX, 20, targetY);
}

function runShot(name) {
  stageShot(name, state);
  const shotOverlay = shotUi(name);
  let painted = 0;
  window.__shotReady = false;
  state.pointer = state.pointerScreen ? { ...state.pointerScreen } : { x: 760, y: 300 };
  function paint() {
    renderer.draw(state, shotOverlay);
    painted += 1;
    if (painted >= 3) window.__shotReady = true;
    requestAnimationFrame(paint);
  }
  requestAnimationFrame(paint);
}

window.addEventListener('resize', () => {
  renderer.resize();
  if (threeRenderer) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    threeRenderer.setSize(w, h, false);
    threeCamera.aspect = w / h;
    threeCamera.updateProjectionMatrix();
  }
});

if (shot) runShot(shot);
else runGame();
