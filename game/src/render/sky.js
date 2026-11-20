import * as THREE from '../../vendor/three.module.min.js';
import { PALETTE } from '../core/config.js';

export function createSky() {
  // Simple sky dome with gradient, sun, and stars
  const skyGeo = new THREE.SphereGeometry(2000, 32, 32);
  // We'll tint this per-time-of-day in the main loop via material color
  const skyMat = new THREE.MeshBasicMaterial({
    side: THREE.BackSide,
    transparent: true,
    opacity: 0.9
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.position.set(0, 0, 0);
  return sky;
}

export function updateSky(sky, state, m) {
  if (!sky) return;
  // Update sky material color based on time of day
  const tod = state.tod;
  if (tod < 0.45) {
    sky.material.color.set('#bfd8ff');
  } else if (tod < 0.58) {
    sky.material.color.set('#ffb08a');
  } else if (tod < 0.7) {
    sky.material.color.set('#b06a9a');
  } else {
    sky.material.color.set('#4a5aa8');
  }
  // Sun position
  const sunX = 0.12 + tod * 0.95;
  const sunY = Math.max(0.06, Math.sin(Math.min(1, tod / 0.62) * Math.PI) * 0.55);
  // In a real implementation, we'd move a directional light or rotate the sky
  // For now, just update the color; the sun glint is separate
}