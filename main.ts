// Entry point for the gta6-01 bounty: three steps, one function each.
//
//   1. prepareOutputDirectory  makes sure there is something to hand in and creates the output folder
//   2. copyTree                puts game/ and screenshots/ where the judge expects them
//   3. buildManifest           writes dossier.json from the copied tree, using the vendored library
//
// The game itself is plain static files under game/ (index.html plus its ES modules), loaded offline by a
// desktop browser. Nothing here is served over the network.
//
// Run it beside the repo:
//   MAKEFUN_OUTPUT_DIR=out node main.ts
// Inside the grader, MAKEFUN_OUTPUT_DIR is unset and /output is the destination. `node serve.ts` serves the
// game locally on http://localhost:8080.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

/** Where this file lives: the repo root, with game/ and screenshots/ as its neighbours. */
const HERE = fileURLToPath(new URL('.', import.meta.url));
/** The folder the judge reads: /output in the grader, overridable so the build can run anywhere. */
const OUTPUT = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/**
 * The limits from the scorer's gate.json, passed through unchanged. Only text_max_bytes changes the dossier's
 * bytes (it caps the source text); the rest are ceilings whose only job is to fail here, loudly, on anything
 * the scorer would refuse anyway: at most 4 screenshots of 256 KiB each, at most 993 entries under game/ and
 * 48 MiB of them, and no path under game/ longer than 1000 bytes. 993 rather than 1000 leaves room for
 * /output itself, screenshots/ and dossier.json inside the grader's 1000-entry cap.
 */
const LIMITS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

/** How many plain files sit under a directory, recursively: the count reported at the end. */
function countFiles(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    total += entry.isDirectory() ? countFiles(join(dir, entry.name)) : 1;
  }
  return total;
}

/**
 * Step 1: refuse early when there is no game/, then create the output tree and return its path.
 * A missing game/ is the one failure worth naming plainly, because copying it would otherwise end in a raw
 * ENOENT from cpSync.
 */
function prepareOutputDirectory() {
  const source = join(HERE, 'game');
  if (!existsSync(source) || !statSync(source).isDirectory()) {
    throw new Error(`nothing to hand in: expected the game at ${source} (a folder of static files, index.html at its root)`);
  }
  mkdirSync(OUTPUT, { recursive: true });
  mkdirSync(join(OUTPUT, 'screenshots'), { recursive: true });
  return OUTPUT;
}

/**
 * Step 2: copy one directory (recursively) into the output and report how many files it held. A missing
 * source copies nothing, which keeps screenshots/ optional at this level: the dossier is what rejects an
 * entry without renders.
 */
function copyTree(from, to) {
  if (!existsSync(from)) return 0;
  cpSync(from, to, { recursive: true });
  return countFiles(from);
}

/**
 * Step 3: write dossier.json exactly as buildDossier produces it and return its size in bytes. The bytes are
 * written untouched, canonical JSON with no re-serialisation, because the scorer compares them byte for byte.
 */
function buildManifest(out) {
  const dossier = buildDossier(out, LIMITS);
  writeFileSync(join(out, 'dossier.json'), dossier);
  return dossier.length;
}

const out = prepareOutputDirectory();
const copied = copyTree(join(HERE, 'game'), join(out, 'game')) + copyTree(join(HERE, 'screenshots'), join(out, 'screenshots'));
const dossierBytes = buildManifest(out);

console.log(`handed in ${copied} files to ${out}, dossier.json ${dossierBytes} bytes`);