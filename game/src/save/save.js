// The save file: cash, story progress and where the player left the city, kept in localStorage.
// Every call is wrapped because storage can be off, and a game that cannot save must still play.

import { SAVE_KEY } from '../core/config.js';

export function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return {
      cash: Number(data.cash) || 0,
      progress: Math.max(0, Math.min(5, Number(data.progress) || 0)),
      x: Number(data.x) || 0,
      y: Number(data.y) || 0,
      savedAt: Number(data.savedAt) || 0,
      stats: data.stats ?? {},
    };
  } catch {
    return null;
  }
}

export function writeSave(state) {
  try {
    const data = {
      cash: Math.round(state.cash),
      progress: state.progress,
      x: Math.round(state.player.x),
      y: Math.round(state.player.y),
      savedAt: Date.now(),
      stats: state.stats,
      version: 1,
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to clear.
  }
}