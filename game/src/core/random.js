// A small seeded random generator (mulberry32) so a seed always builds the same city,
// the same traffic and the same staged screenshot.

export function createRandom(seed) {
  let state = (seed >>> 0) || 0x9e3779b9;
  const rng = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.range = (lo, hi) => lo + rng() * (hi - lo);
  rng.int = (n) => Math.floor(rng() * n);
  rng.pick = (list) => list[Math.floor(rng() * list.length)];
  rng.chance = (p) => rng() < p;
  rng.sign = () => (rng() < 0.5 ? -1 : 1);
  return rng;
}