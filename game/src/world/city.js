// The city of Velara Bay: a grid of twelve avenues by eleven streets, each block holding towers,
// low shops or a pocket park, a palm-lined beach along the north shore and a pier over the water.
// Build once from a seed; everything the simulation needs (colliders, road queries, lane spawns,
// the named corners missions use) is read off the result.

import { CITY, NEON_NAMES, PALETTE, PLACES, TRAFFIC, WORLD } from '../core/config.js';
import { clamp, hash01 } from '../core/math.js';

const TONES = ['#2b2438', '#332a3f', '#242c3c', '#3a2b36', '#2a3444', '#3b3030', '#2d2a2a', '#26323a'];
const NEON = [PALETTE.neonPink, PALETTE.neonCyan, PALETTE.neonAmber, PALETTE.neonViolet, PALETTE.neonGreen];

export function buildCity(rng) {
  const cols = [];
  const rows = [];
  for (let i = 0; i < CITY.cols; i += 1) cols.push(CITY.originX + i * CITY.block);
  for (let j = 0; j < CITY.rows; j += 1) rows.push(CITY.originY + j * CITY.block);

  const city = {
    cols,
    rows,
    buildings: [],
    parks: [],
    palms: [],
    lamps: [],
    billboards: [],
    blocks: [],
    places: {},
    pier: null,
    half: CITY.roadHalf,
    sidewalk: CITY.sidewalk,
    lights: { cycle: TRAFFIC.lightCycle },
  };

  const inset = CITY.roadHalf + CITY.sidewalk;

  for (let i = 0; i < cols.length - 1; i += 1) {
    for (let j = 0; j < rows.length - 1; j += 1) {
      const x0 = cols[i] + inset;
      const y0 = rows[j] + inset;
      const x1 = cols[i + 1] - inset;
      const y1 = rows[j + 1] - inset;
      const w = x1 - x0;
      const h = y1 - y0;
      const seed = i * 31 + j * 7;
      const roll = rng();
      city.blocks.push({ x: x0, y: y0, w, h });

      if (roll < 0.14) {
        // A pocket park: grass, a crossing path and palms, no buildings to hit.
        city.parks.push({ x: x0 + 4, y: y0 + 4, w: w - 8, h: h - 8, seed });
        for (let p = 0; p < 7; p += 1) {
          city.palms.push({
            x: rng.range(x0 + 20, x1 - 20),
            y: rng.range(y0 + 20, y1 - 20),
            size: rng.range(0.8, 1.35),
            lean: rng.range(-0.4, 0.4),
          });
        }
        continue;
      }

      const parts = layoutBlock(rng, x0, y0, w, h, i, j);
      for (const part of parts) {
        const tall = clamp(0.7 + rng() * 1.5 + (j < 3 ? 0.55 : 0) + (part.big ? 0.4 : 0), 0.55, 2.6);
        const tone = TONES[Math.floor(rng() * TONES.length)];
        const neon = NEON[Math.floor(rng() * NEON.length)];
        const building = {
          x: part.x,
          y: part.y,
          w: part.w,
          h: part.h,
          height: tall,
          tone,
          seed: Math.floor(rng() * 100000),
          neon,
          label: rng.chance(0.55) ? NEON_NAMES[Math.floor(rng() * NEON_NAMES.length)] : null,
          shop: rng.chance(0.72),
        };
        city.buildings.push(building);
        if (rng.chance(0.18) && part.w > 110) {
          city.billboards.push({
            x: part.x + part.w * 0.5,
            y: part.y + 8,
            w: Math.min(150, part.w * 0.7),
            h: 40,
            color: neon,
            label: NEON_NAMES[Math.floor(rng() * NEON_NAMES.length)],
            seed: building.seed,
          });
        }
      }
    }
  }

  // Sea-front palms: two rows along the sand, plus a sparse line down the two widest avenues.
  for (let x = 40; x < WORLD.width - 40; x += 74) {
    city.palms.push({ x, y: WORLD.coastY + rng.range(40, 74), size: rng.range(0.9, 1.3), lean: rng.range(-0.5, 0.5) });
    city.palms.push({ x: x + 37, y: rng.range(505, 610), size: rng.range(1.0, 1.45), lean: rng.range(-0.5, 0.5) });
  }
  for (let j = 0; j < rows.length; j += 1) {
    for (let i = 0; i < cols.length; i += 3) {
      city.palms.push({ x: cols[i] + 62, y: rows[j] + 66, size: rng.range(0.75, 1.1), lean: rng.range(-0.4, 0.4) });
    }
  }

  // Street lamps at the four corners of every intersection, which is also where they read best.
  for (let i = 0; i < cols.length; i += 1) {
    for (let j = 0; j < rows.length; j += 1) {
      const ox = CITY.roadHalf + 12;
      city.lamps.push({ x: cols[i] - ox, y: rows[j] - ox });
      city.lamps.push({ x: cols[i] + ox, y: rows[j] + ox });
    }
  }

  // Boats out on the bay, each with a wake, so the water is not an empty band.
  city.boats = [];
  for (let i = 0; i < 14; i += 1) {
    city.boats.push({
      x: rng.range(120, WORLD.width - 120),
      y: rng.range(150, WORLD.coastY - 70),
      angle: rng.range(-0.4, 0.4),
      size: rng.range(0.8, 1.7),
      colour: rng.pick(['#e8e4dc', '#d9d2c4', '#8f9aa8', '#3d4a5a']),
      drift: rng.range(4, 12) * (rng.chance(0.5) ? 1 : -1),
    });
  }

  // The pier: planks on stilts running from the sand out over the water, with a neon sign.
  const pierX = cols[8] + CITY.block * 0.5;
  city.pier = { x: pierX - 30, y: WORLD.coastY - 210, w: 60, h: 300, label: 'PIER 9', color: PALETTE.neonPink };

  // Named corners the story uses. A row of -1 means the beach rather than a street.
  for (const [name, place] of Object.entries(PLACES)) {
    const x = place.col >= 0 && cols[place.col] !== undefined ? cols[place.col] : WORLD.width * 0.5;
    let y;
    if (place.row < 0) y = 560;
    else y = rows[place.row] ?? WORLD.height * 0.5;
    city.places[name] = { x, y, label: place.label, name };
  }
  city.places.pier.x = pierX;
  city.places.pier.y = WORLD.coastY - 40;

  return city;
}

/** Split a block into one tower, two bars or a four-shop cluster, leaving service alleys. */
function layoutBlock(rng, x0, y0, w, h, i, j) {
  const margin = 9;
  const style = rng();
  if (style < 0.33) {
    return [{ x: x0 + margin, y: y0 + margin, w: w - margin * 2, h: h - margin * 2, big: true }];
  }
  if (style < 0.66) {
    const split = w * rng.range(0.42, 0.58);
    return [
      { x: x0 + margin, y: y0 + margin, w: split - margin * 2, h: h - margin * 2, big: false },
      { x: x0 + split + margin, y: y0 + margin, w: w - split - margin * 2, h: h - margin * 2, big: false },
    ];
  }
  const gap = 9;
  const bw = (w - gap - margin * 2) / 2;
  const bh = (h - gap - margin * 2) / 2;
  const out = [];
  for (let a = 0; a < 2; a += 1) {
    for (let b = 0; b < 2; b += 1) {
      const px = x0 + margin + a * (bw + gap);
      const py = y0 + margin + b * (bh + gap);
      out.push({ x: px, y: py, w: bw, h: bh, big: false });
    }
  }
  // A fourth lot is sometimes left empty, so the block has a yard instead of a wall of shops.
  if (hash01(i, j, 3) < 0.4) out.pop();
  return out;
}

/** True when (x, y) is on the asphalt of any avenue or street. */
export function isOnRoad(city, x, y) {
  const h = city.half;
  for (const cx of city.cols) if (Math.abs(x - cx) <= h) return true;
  for (const cy of city.rows) if (Math.abs(y - cy) <= h) return true;
  return false;
}

/** True when the point is inside a building footprint (plus `radius` of clearance). */
export function isBlocked(city, x, y, radius = 0) {
  if (x < radius || y < radius || x > WORLD.width - radius || y > WORLD.height - radius) return true;
  for (const b of city.buildings) {
    if (x > b.x - radius && x < b.x + b.w + radius && y > b.y - radius && y < b.y + b.h + radius) return true;
  }
  return false;
}

/** The building whose footprint holds the point, or null. */
export function buildingAt(city, x, y) {
  for (const b of city.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  }
  return null;
}

/** A random point on a sidewalk, at least `away` from (nearX, nearY); used to place people and drops. */
export function randomSidewalkPoint(city, rng, nearX, nearY, away = 200) {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const col = rng.chance(0.5);
    if (col) {
      const cx = city.cols[rng.int(city.cols.length)];
      const side = rng.sign();
      const x = cx + side * (city.half + city.sidewalk * 0.5);
      const y = rng.range(WORLD.coastY + 40, WORLD.height - 60);
      if (Math.hypot(x - nearX, y - nearY) < away) continue;
      return { x, y };
    }
    const cy = city.rows[rng.int(city.rows.length)];
    const side = rng.sign();
    const y = cy + side * (city.half + city.sidewalk * 0.5);
    const x = rng.range(60, WORLD.width - 60);
    if (Math.hypot(x - nearX, y - nearY) < away) continue;
    return { x, y };
  }
  return { x: city.cols[3] + 66, y: city.rows[2] + 66 };
}

/** A point in a random traffic lane, `away` from the given point: where new cars and police arrive. */
export function randomLanePoint(city, rng, nearX, nearY, minDistance = 700, maxDistance = 1500) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const horizontal = rng.chance(0.5);
    if (horizontal) {
      const cy = city.rows[rng.int(city.rows.length)];
      const dir = rng.sign();
      const y = cy + dir * TRAFFIC.laneOffset;
      const x = clamp(nearX + rng.range(minDistance, maxDistance) * rng.sign(), 80, WORLD.width - 80);
      if (Math.hypot(x - nearX, y - nearY) < minDistance) continue;
      return { x, y, axis: 'h', dir, lane: y };
    }
    const cx = city.cols[rng.int(city.cols.length)];
    const dir = rng.sign();
    const x = cx + dir * TRAFFIC.laneOffset;
    const y = clamp(nearY + rng.range(minDistance, maxDistance) * rng.sign(), WORLD.coastY + 80, WORLD.height - 80);
    if (Math.hypot(x - nearX, y - nearY) < minDistance) continue;
    return { x, y, axis: 'v', dir, lane: x };
  }
  return { x: city.cols[2], y: city.rows[2] + TRAFFIC.laneOffset, axis: 'h', dir: 1, lane: city.rows[2] + TRAFFIC.laneOffset };
}

/**
 * The nearest point on the sidewalk ring of the block that holds (x, y); pedestrians aim at
 * these so they keep to the pavement without any pathfinding.
 */
export function nearestWalkTarget(city, x, y, rng) {
  let best = null;
  let bestD = Infinity;
  const maxD = CITY.block * 2.2;
  for (const block of city.blocks) {
    const cx = clamp(x, block.x - city.sidewalk, block.x + block.w + city.sidewalk);
    const cy = clamp(y, block.y - city.sidewalk, block.y + block.h + city.sidewalk);
    const d = Math.hypot(cx - x, cy - y);
    if (d < bestD && d < maxD) {
      bestD = d;
      const ring = [
        { x: cx, y: block.y - city.sidewalk },
        { x: cx, y: block.y + block.h + city.sidewalk },
        { x: block.x - city.sidewalk, y: cy },
        { x: block.x + block.w + city.sidewalk, y: cy },
      ];
      best = ring[rng.int(ring.length)];
    }
  }
  return best ?? { x: x + rng.range(-80, 80), y: y + rng.range(-80, 80) };
}

/** Traffic lights: 15 s cycle, avenues green first, then the cross streets, with a short all-red. */
export function lightFor(city, axis, time) {
  const p = time % city.lights.cycle;
  if (axis === 'h') return p < 6.4 ? 'green' : p < 7.4 ? 'amber' : 'red';
  return p >= 7.4 && p < 13.8 ? 'green' : p >= 13.8 ? 'amber' : 'red';
}

/** Distance from (x, y) to the next junction ahead on a lane, or Infinity when off the grid. */
export function nextJunction(city, axis, x, y, dir) {
  if (axis === 'h') {
    for (let i = 0; i < city.cols.length; i += 1) {
      const cx = city.cols[i];
      if (dir > 0 && cx > x) return cx - city.half - 6;
      if (dir < 0 && cx < x) return x - (cx + city.half + 6);
    }
    return Infinity;
  }
  for (let j = 0; j < city.rows.length; j += 1) {
    const cy = city.rows[j];
    if (dir > 0 && cy > y) return cy - city.half - 6;
    if (dir < 0 && cy < y) return y - (cy + city.half + 6);
  }
  return Infinity;
}