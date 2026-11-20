// The frames around the game: the title over a live, dimmed city, the pause menu, the mission
// dialogue with drawn portraits, the job-passed banner and the wasted/busted cards.

import { FONT, GAME_HOOK, GAME_NAME, GAME_TAGLINE, PALETTE } from '../core/config.js';
import { clamp } from '../core/math.js';
import { MISSIONS } from '../world/missions.js';
import { mood, mixHex } from './palette.js';
import { drawStar } from './hud.js';

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function keyCap(ctx, x, y, w, label) {
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, 20, 4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.stroke();
  ctx.fillStyle = '#f2eee6';
  ctx.font = `700 10px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + 14);
  ctx.textAlign = 'left';
}

export function drawTitle(ctx, state, view, options) {
  const w = view.width;
  const h = view.height;
  const m = mood(state.tod);

  const shade = ctx.createLinearGradient(0, 0, w, 0);
  shade.addColorStop(0, 'rgba(4,4,12,0.92)');
  shade.addColorStop(0.55, 'rgba(4,4,12,0.72)');
  shade.addColorStop(1, 'rgba(4,4,12,0.25)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, w, h);
  const floor = ctx.createLinearGradient(0, h * 0.55, 0, h);
  floor.addColorStop(0, 'rgba(4,4,12,0)');
  floor.addColorStop(1, 'rgba(4,4,12,0.85)');
  ctx.fillStyle = floor;
  ctx.fillRect(0, h * 0.55, w, h * 0.45);

  const left = 78;
  let y = h * 0.28;
  ctx.textAlign = 'left';
  ctx.font = `700 13px ${FONT}`;
  ctx.fillStyle = PALETTE.neonCyan;
  ctx.fillText('A VELARA BAY CRIME STORY', left, y - 52);

  const grad = ctx.createLinearGradient(left, y - 40, left + 620, y + 60);
  grad.addColorStop(0, '#ffe6b8');
  grad.addColorStop(0.45, mixHex(m.horizon, '#ffffff', 0.25));
  grad.addColorStop(1, '#ff4f8b');
  ctx.font = `800 86px ${FONT}`;
  ctx.fillStyle = grad;
  ctx.fillText('VELVET', left, y + 10);
  ctx.fillText('COAST', left, y + 92);
  ctx.fillStyle = 'rgba(255,79,139,0.85)';
  ctx.fillRect(left + 4, y + 112, 250, 3);

  // The hook, the season label, then the promise that the game is waiting for you.
  ctx.font = `600 15px ${FONT}`;
  ctx.fillStyle = 'rgba(240,236,228,0.72)';
  ctx.fillText(GAME_TAGLINE, left + 4, y + 134);
  ctx.font = `700 16px ${FONT}`;
  ctx.fillStyle = '#f7f3ea';
  ctx.fillText(GAME_HOOK, left + 4, y + 160);
  ctx.font = `600 11px ${FONT}`;
  ctx.fillStyle = PALETTE.hudDim;
  ctx.fillText('FIVE JOBS · ONE CITY · WALK IT OR DRIVE IT · SAVES IN THIS BROWSER', left + 4, y + 182);

  const pulse = 0.6 + 0.4 * Math.sin(state.time * 3);
  ctx.globalAlpha = pulse;
  ctx.font = `800 24px ${FONT}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('PRESS START', left + 4, y + 226);
  ctx.globalAlpha = 1;
  ctx.fillStyle = PALETTE.neonPink;
  ctx.fillRect(left + 4, y + 236, 186, 2);
  ctx.font = `600 12px ${FONT}`;
  ctx.fillStyle = 'rgba(240,236,228,0.6)';
  ctx.fillText('ENTER', left + 4, y + 258);
  ctx.fillStyle = 'rgba(240,236,228,0.4)';
  ctx.fillText('or click, to begin · walk, drive, and take the first job', left + 66, y + 258);
  ctx.font = `600 12px ${FONT}`;
  ctx.fillStyle = options.hasSave ? 'rgba(240,236,228,0.85)' : 'rgba(240,236,228,0.3)';
  ctx.fillText(options.hasSave ? 'C  ·  CONTINUE FROM YOUR LAST SAVE' : 'C  ·  NO SAVE YET', left + 4, y + 280);

  // Controls panel on the right.
  const px = w - 372;
  const py = h * 0.28 - 40;
  ctx.fillStyle = 'rgba(6,6,14,0.55)';
  ctx.beginPath();
  ctx.roundRect(px, py, 302, 292, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.stroke();
  ctx.font = `700 11px ${FONT}`;
  ctx.fillStyle = PALETTE.neonAmber;
  ctx.fillText('CONTROLS', px + 18, py + 26);
  const rows = [
    ['W A S D', 'walk / drive'],
    ['SHIFT', 'sprint'],
    ['E', 'take a car · talk · jobs'],
    ['SPACE', 'handbrake · skip a line'],
    ['MOUSE', 'aim'],
    ['CLICK', 'fire'],
    ['M · ESC', 'pause · save · restart'],
  ];
  rows.forEach((row, i) => {
    const ry = py + 52 + i * 28;
    keyCap(ctx, px + 18, ry - 14, row[0].length > 5 ? 72 : 44, row[0]);
    ctx.fillStyle = 'rgba(240,236,228,0.85)';
    ctx.font = `500 12px ${FONT}`;
    ctx.fillText(row[1], px + 102, ry);
  });
  ctx.font = `600 10px ${FONT}`;
  ctx.fillStyle = 'rgba(240,236,228,0.5)';
  ctx.fillText('THE JOB LIST, IN ORDER', px + 18, py + 254);
  ctx.fillStyle = PALETTE.hudDim;
  ctx.fillText('1 SUNSET RUN · 2 SALT & STATIC', px + 18, py + 268);
  ctx.fillText('3 BAD SIGNAL · 4 HEAT INDEX · 5 THE LAST WAVE', px + 18, py + 282);

  // Footer.
  ctx.font = `500 11px ${FONT}`;
  ctx.fillStyle = 'rgba(240,236,228,0.42)';
  ctx.fillText('An original city, story and soundtrack. Canvas 2D, no engine, no assets, no network.', left + 4, h - 46);
  ctx.fillStyle = PALETTE.neonPink;
  ctx.font = `700 11px ${FONT}`;
  ctx.fillText('VELVET COAST · v1.0', w - 210, h - 46);
}

export function drawPause(ctx, state, view, options) {
  const w = view.width;
  const h = view.height;
  ctx.fillStyle = 'rgba(4,4,12,0.72)';
  ctx.fillRect(0, 0, w, h);
  const pw = 420;
  const ph = 330;
  const px = w / 2 - pw / 2;
  const py = h / 2 - ph / 2;
  ctx.fillStyle = 'rgba(10,10,20,0.9)';
  ctx.beginPath();
  ctx.roundRect(px, py, pw, ph, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.font = `800 40px ${FONT}`;
  ctx.fillStyle = '#f7f3ea';
  ctx.fillText('PAUSED', w / 2, py + 68);
  ctx.font = `600 12px ${FONT}`;
  ctx.fillStyle = PALETTE.neonAmber;
  ctx.fillText('VELVET COAST · VELARA BAY · M', w / 2, py + 92);
  const items = options.saveMessage
    ? ['RESUME', 'SAVED TO THIS BROWSER', 'RESTART · BACK TO TITLE']
    : ['RESUME', 'SAVE GAME', 'RESTART · BACK TO TITLE'];
  items.forEach((item, i) => {
    const y = py + 142 + i * 40;
    ctx.font = `${i === options.pauseIndex ? 700 : 500} 16px ${FONT}`;
    ctx.fillStyle = i === options.pauseIndex ? '#ffffff' : 'rgba(240,236,228,0.5)';
    ctx.fillText(item, w / 2, y);
    if (i === options.pauseIndex) {
      ctx.fillStyle = PALETTE.neonPink;
      ctx.fillRect(w / 2 - 96, y + 6, 192, 2);
    }
  });
  ctx.font = `500 11px ${FONT}`;
  ctx.fillStyle = 'rgba(240,236,228,0.4)';
  ctx.fillText('M or ESC opens and closes this · arrows + ENTER to choose', w / 2, py + ph - 44);
  ctx.fillText('RESTART drops the run and puts you back on the title screen', w / 2, py + ph - 26);
  ctx.textAlign = 'left';
}

/** The job brief: a wide card that names the job, a portrait, and one line at a time. */
export function drawDialogue(ctx, state, view) {
  const d = state.missions.dialogue;
  if (!d) return;
  const w = view.width;
  const h = view.height;

  // Between jobs there is no active def yet, so fall back to the job waiting to be taken: the order
  // and the payout on the band are the point of the band.
  const def = state.missions.active?.def ?? MISSIONS[Math.min(state.missions.index, MISSIONS.length - 1)];
  const total = state.missions.total ?? MISSIONS.length;
  const title = def?.title ?? 'JOB';
  const order = Math.min(state.missions.index + 1, total);

  const pw = Math.min(880, w - 140);
  const ph = 168;
  const px = w / 2 - pw / 2;
  const py = h - ph - 44;

  // The job band sits directly above the card, where it cannot land on top of the HUD's own
  // objective and payslip list in the top-left corner.
  const bandY = py - 54;
  ctx.fillStyle = 'rgba(6,6,14,0.78)';
  ctx.fillRect(0, bandY, w, 48);
  ctx.fillStyle = PALETTE.neonPink;
  ctx.fillRect(0, bandY, w, 2);
  ctx.textAlign = 'center';
  ctx.font = `800 20px ${FONT}`;
  ctx.fillStyle = '#f7f3ea';
  ctx.fillText(`JOB ${order} OF ${total} · ${title}`, w / 2, bandY + 26);
  ctx.font = `600 10px ${FONT}`;
  ctx.fillStyle = PALETTE.neonPink;
  ctx.fillText(`VELARA BAY · JOB BRIEF · PAYS $${(def?.reward ?? 0).toLocaleString('en-US')}`, w / 2, bandY + 42);
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(8,8,16,0.92)';
  ctx.beginPath();
  ctx.roundRect(px, py, pw, ph, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = PALETTE.neonPink;
  ctx.fillRect(px, py, 5, ph);

  drawPortrait(ctx, d.speaker, px + 40, py + ph / 2, 46);

  ctx.font = `700 12px ${FONT}`;
  ctx.fillStyle = PALETTE.neonAmber;
  ctx.fillText(d.speaker, px + 106, py + 40);
  ctx.font = `500 18px ${FONT}`;
  ctx.fillStyle = '#f4f0e8';
  const line = d.lines[d.index] ?? '';
  const lines = wrapText(ctx, line, pw - 160);
  lines.slice(0, 2).forEach((text, i) => ctx.fillText(text, px + 106, py + 72 + i * 26));

  ctx.font = `600 10px ${FONT}`;
  ctx.fillStyle = 'rgba(240,236,228,0.45)';
  ctx.fillText(`${d.index + 1} / ${d.lines.length}`, px + 106, py + ph - 22);
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(240,236,228,0.7)';
  ctx.fillText('SPACE · CONTINUE', px + pw - 24, py + ph - 22);
  ctx.textAlign = 'left';
}

/** A drawn head and shoulders, so the story has faces without a single image file. */
export function drawPortrait(ctx, name, x, y, r) {
  const mira = name === 'MIRA SOL';
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = mira ? 'rgba(120,40,90,0.55)' : 'rgba(40,90,100,0.55)';
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  // Shoulders.
  ctx.fillStyle = mira ? '#7d2a55' : '#2b4a52';
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.95, r * 0.95, r * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  // Neck and head.
  ctx.fillStyle = '#c98d63';
  ctx.fillRect(x - r * 0.16, y + r * 0.28, r * 0.32, r * 0.4);
  ctx.beginPath();
  ctx.ellipse(x, y - r * 0.05, r * 0.42, r * 0.52, 0, 0, Math.PI * 2);
  ctx.fill();
  // Hair.
  ctx.fillStyle = mira ? '#221520' : '#2a2622';
  ctx.beginPath();
  if (mira) {
    ctx.ellipse(x - r * 0.12, y - r * 0.18, r * 0.55, r * 0.62, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b48d';
    ctx.beginPath();
    ctx.ellipse(x + r * 0.04, y - r * 0.02, r * 0.36, r * 0.46, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.ellipse(x, y - r * 0.24, r * 0.46, r * 0.36, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x - r * 0.5, y - r * 0.38, r * 1.0, r * 0.16);
  }
  // Sunglasses.
  ctx.fillStyle = '#101018';
  ctx.fillRect(x - r * 0.34, y - r * 0.1, r * 0.28, r * 0.16);
  ctx.fillRect(x + r * 0.06, y - r * 0.1, r * 0.28, r * 0.16);
  ctx.fillRect(x - r * 0.06, y - r * 0.06, r * 0.12, r * 0.03);
  if (!mira) {
    // Doc Vela's beard.
    ctx.fillStyle = 'rgba(40,36,34,0.9)';
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.26, r * 0.3, r * 0.2, 0, 0, Math.PI);
    ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = mira ? PALETTE.neonPink : PALETTE.neonCyan;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function drawBanner(ctx, state, view) {
  const b = state.missions.banner;
  if (!b) return;
  const w = view.width;
  const t = 1 - clamp(b.life / 5, 0, 1);
  const slide = Math.min(1, t * 3);
  const y = 150 - (1 - slide) * 30;
  ctx.globalAlpha = slide;
  ctx.textAlign = 'center';
  ctx.font = `800 40px ${FONT}`;
  ctx.fillStyle = 'rgba(6,6,14,0.55)';
  const wd = ctx.measureText(b.text).width + 80;
  ctx.fillRect(w / 2 - wd / 2, y - 44, wd, 78);
  ctx.fillStyle = b.color ?? PALETTE.neonAmber;
  ctx.fillText(b.text, w / 2, y);
  ctx.font = `600 15px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText(b.sub ?? '', w / 2, y + 26);
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

export function drawPhaseCard(ctx, state, view) {
  if (state.phase === 'play') return;
  const w = view.width;
  const h = view.height;
  const busted = state.lastPhase === 'busted';
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  if (busted) {
    grad.addColorStop(0, 'rgba(10,20,60,0.85)');
    grad.addColorStop(1, 'rgba(4,6,20,0.92)');
  } else {
    grad.addColorStop(0, 'rgba(70,6,16,0.85)');
    grad.addColorStop(1, 'rgba(10,4,8,0.92)');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.font = `800 84px ${FONT}`;
  ctx.fillStyle = busted ? '#9fc4ff' : '#ff5b6e';
  ctx.fillText(busted ? 'BUSTED' : 'WASTED', w / 2, h / 2 - 6);
  ctx.font = `600 15px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  const now = clockLabel(state.tod);
  // Say which building you come back at, because busted and wasted are not the same night.
  const where = busted ? state.city?.places?.station?.label ?? 'VELARA BAY PD' : state.city?.places?.hospital?.label ?? 'MERCY GENERAL';
  ctx.fillText(`${now} · ${where} · FEES $250`, w / 2, h / 2 + 34);
  ctx.font = `600 12px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText(busted ? 'RELEASED WITH YOUR WALLET LIGHTER' : 'PATCHED UP AND BACK ON THE STREET', w / 2, h / 2 + 56);
  const dots = Math.ceil(state.phaseTimer / 0.4) % 2;
  ctx.fillStyle = dots ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.15)';
  ctx.fillText('RECOVERING', w / 2, h / 2 + 68);
  ctx.textAlign = 'left';
}

export function drawMinimalStarRow(ctx, x, y, count) {
  for (let i = 0; i < count; i += 1) drawStar(ctx, x + i * 14, y, 5, PALETTE.wanted);
}

export { GAME_NAME };