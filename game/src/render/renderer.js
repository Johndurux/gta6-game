// The frame: sizes the canvas to the window, builds the camera view, draws the city, the actors and
// their effects, grades the light for the time of day, then lays the HUD and the menus over it.

import { PALETTE } from '../core/config.js';
import { clamp } from '../core/math.js';
import { drawSea, drawBeach, drawStreets, drawSkids, drawBuildings, drawPalms } from './city-view.js';
import { drawCar, drawPed, drawPlayer, drawMarker, drawPickups, drawBullets, drawParticles } from './actors.js';
import { drawSky } from './sky.js';
import { drawHud } from './hud.js';
import { drawTitle, drawPause, drawDialogue, drawBanner, drawPhaseCard } from './screens.js';
import { mood, hexToRgba } from './palette.js';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const view = { x: 0, y: 0, zoom: 1, width: 1280, height: 720, left: 0, top: 0, right: 0, bottom: 0 };

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    view.width = w;
    view.height = h;
    view.dpr = dpr;
  }

  function draw(state, ui = {}) {
    if (!view.dpr) resize();
    const { width: w, height: h, dpr } = view;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = PALETTE.deep;
    ctx.fillRect(0, 0, w, h);

    const cam = state.camera;
    view.zoom = cam.zoom;
    view.x = cam.x + state.effects.shakeX;
    view.y = cam.y + state.effects.shakeY;
    view.left = view.x - w / (2 * view.zoom) - 60;
    view.right = view.x + w / (2 * view.zoom) + 60;
    view.top = view.y - h / (2 * view.zoom) - 60;
    view.bottom = view.y + h / (2 * view.zoom) + 60;

    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(view.zoom, view.zoom);
    ctx.translate(-view.x, -view.y);

    drawSea(ctx, state, view);
    drawBeach(ctx, state, view);
    drawStreets(ctx, state, view);
    drawSkids(ctx, state, view);
    drawBuildings(ctx, state, view);
    drawPalms(ctx, state, view);
    drawMarker(ctx, state.marker(), state);
    drawPickups(ctx, state);

    const bodies = [];
    for (const car of state.cars) if (car.alive) bodies.push({ y: car.y, kind: 'car', ref: car });
    for (const ped of state.peds) bodies.push({ y: ped.y, kind: 'ped', ref: ped });
    bodies.push({ y: state.player.y, kind: 'player', ref: state.player });
    bodies.sort((a, b) => a.y - b.y);
    for (const body of bodies) {
      if (body.kind === 'car') drawCar(ctx, body.ref, state);
      else if (body.kind === 'ped') drawPed(ctx, body.ref, state);
      else if (!state.player.inCar) drawPlayer(ctx, state);
    }
    drawBullets(ctx, state);
    drawParticles(ctx, state);
    ctx.restore();

    // Light grade, then the sky band, so the horizon keeps its colour.
    const m = mood(state.tod);
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = hexToRgba(m.grade, m.gradeAlpha);
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
    drawSky(ctx, state, view);

    if (ui.screen !== 'title') drawHud(ctx, state, view, ui);
    drawBanner(ctx, state, view);
    if (ui.screen === 'title') {
      drawTitle(ctx, state, view, ui);
    } else if (ui.screen === 'pause') {
      drawPause(ctx, state, view, ui);
    }
    if (state.missions.dialogue) drawDialogue(ctx, state, view);
    drawPhaseCard(ctx, state, view);

    // A faint scanline and grit pass keeps the flat shapes from looking like a prototype.
    const scan = ctx.createLinearGradient(0, 0, 0, h);
    scan.addColorStop(0, 'rgba(255,255,255,0.02)');
    scan.addColorStop(0.5, 'rgba(0,0,0,0.03)');
    scan.addColorStop(1, 'rgba(0,0,0,0.12)');
    ctx.fillStyle = scan;
    ctx.fillRect(0, 0, w, h);
  }

  function screenToWorld(x, y) {
    return {
      x: (x - view.width / 2) / view.zoom + view.x,
      y: (y - view.height / 2) / view.zoom + view.y,
    };
  }

  function worldToScreen(x, y) {
    return {
      x: (x - view.x) * view.zoom + view.width / 2,
      y: (y - view.y) * view.zoom + view.height / 2,
    };
  }

  return { draw, resize, view, screenToWorld, worldToScreen, ctx };
}

export { clamp };