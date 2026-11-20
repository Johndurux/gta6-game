import * as THREE from '../../vendor/three.module.min.js';
import { CITY, DOWNTOWN, PALETTE, PLACES, TRAFFIC, WORLD } from '../core/config.js';

export function buildCityMeshes(rng, cityData, foamTime) {
  const cityGroup = new THREE.Group();

  // Aesthetic tone mapping from the sim's palette
  const TONES = ['#2b2438', '#332a3f', '#242c3c', '#3a2b36', '#2a3444', '#3b3030', '#2d2a2a', '#26323a'];
  const NEON = [0xff2d78, 0x3ff0ff, 0xffb340, 0xa25bff, 0x4dff9e];

  // Build every sim block into a Three.js mesh
  for (const block of cityData.blocks) {
    const style = rng() < 0.33 ? 'tower' : rng() < 0.66 ? 'bar' : 'cluster';
    let parts;

    if (style === 'tower') {
      // Single tall tower filling the block
      const height = 80 + Math.random() * 200;
      const tone = TONES[Math.floor(Math.random() * TONES.length)];
      const neon = NEON[Math.floor(Math.random() * NEON.length)];
      const building = new THREE.Mesh(
        new THREE.BoxGeometry(block.w, height, block.h),
        new THREE.MeshStandardMaterial({ color: tone, metalness: 0.2, roughness: 0.7 })
      );
      building.position.set(block.x + block.w / 2, height / 2, block.y + block.h / 2);
      // Emissive window quads: every floor has warm windows
      const windowCountX = Math.max(1, Math.floor(block.w / 40));
      const windowCountY = Math.max(1, Math.floor(block.h / 40));
      for (let gx = 0; gx < windowCountX; gx += 1) {
        for (let gy = 0; gy < windowCountY; gy += 1) {
          const win = new THREE.Mesh(
            new THREE.PlaneGeometry(block.w / windowCountX - 4, block.h / windowCountY - 4),
            new THREE.MeshBasicMaterial({ color: neon, transparent: true, opacity: 0.9 })
          );
          win.position.set(
            block.x + 2 + gx * (block.w / windowCountX),
            building.position.y + building.scale.y / 2 + 20 + gy * (block.h / windowCountY),
            block.y + 2 + gy * (block.h / windowCountY)
          );
          building.add(win);
        }
      }
      cityGroup.add(building);
    } else if (style === 'bar') {
      // Two bars side by side
      const split = block.w * 0.48;
      const leftHeight = 40 + Math.random() * 120;
      const rightHeight = 40 + Math.random() * 120;
      const leftTone = TONES[Math.floor(Math.random() * TONES.length)];
      const rightTone = TONES[Math.floor(Math.random() * TONES.length)];
      const leftNeon = NEON[Math.floor(Math.random() * NEON.length)];
      const rightNeon = NEON[Math.floor(Math.random() * NEON.length)];

      const left = new THREE.Mesh(
        new THREE.BoxGeometry(split - 6, leftHeight, block.h),
        new THREE.MeshStandardMaterial({ color: leftTone, metalness: 0.2, roughness: 0.7 })
      );
      left.position.set(block.x + split / 2, leftHeight / 2, block.y + block.h / 2);
      // Windows
      for (let gx = 0; gx < Math.max(1, Math.floor((split - 12) / 40)); gx += 1) {
        for (let gy = 0; gy < Math.max(1, Math.floor(block.h / 40)); gy += 1) {
          const win = new THREE.Mesh(
            new THREE.PlaneGeometry((split - 12) / Math.max(1, Math.floor((split - 12) / 40)) - 4, block.h / Math.max(1, Math.floor(block.h / 40)) - 4),
            new THREE.MeshBasicMaterial({ color: leftNeon, transparent: true, opacity: 0.9 })
          );
          win.position.set(
            block.x + 3 + gx * ((split - 12) / Math.max(1, Math.floor((split - 12) / 40))),
            left.position.y + left.scale.y / 2 + 10 + gy * (block.h / Math.max(1, Math.floor(block.h / 40))),
            block.y + 2 + gy * (block.h / Math.max(1, Math.floor(block.h / 40)))
          );
          left.add(win);
        }
      }
      cityGroup.add(left);

      const right = new THREE.Mesh(
        new THREE.BoxGeometry(block.w - split - 6, rightHeight, block.h),
        new THREE.MeshStandardMaterial({ color: rightTone, metalness: 0.2, roughness: 0.7 })
      );
      right.position.set(block.x + split + 3, rightHeight / 2, block.y + block.h / 2);
      for (let gx = 0; gx < Math.max(1, Math.floor((block.w - split - 12) / 40)); gx += 1) {
        for (let gy = 0; gy < Math.max(1, Math.floor(block.h / 40)); gy += 1) {
          const win = new THREE.Mesh(
            new THREE.PlaneGeometry((block.w - split - 12) / Math.max(1, Math.floor((block.w - split - 12) / 40)) - 4, block.h / Math.max(1, Math.floor(block.h / 40)) - 4),
            new THREE.MeshBasicMaterial({ color: rightNeon, transparent: true, opacity: 0.9 })
          );
          win.position.set(
            block.x + split + 3 + gx * ((block.w - split - 12) / Math.max(1, Math.floor((block.w - split - 12) / 40))),
            right.position.y + right.scale.y / 2 + 10 + gy * (block.h / Math.max(1, Math.floor(block.h / 40))),
            block.y + 2 + gy * (block.h / Math.max(1, Math.floor(block.h / 40)))
          );
          right.add(win);
        }
      }
      cityGroup.add(right);
    } else {
      // Four-shop cluster
      const gw = (block.w - 18) / 2;
      const gh = (block.h - 18) / 2;
      const positions = [
        { x: block.x + 9, y: block.y + 9 },
        { x: block.x + block.w - 9, y: block.y + 9 },
        { x: block.x + 9, y: block.y + block.h - 9 },
        { x: block.x + block.w - 9, y: block.y + block.h - 9 },
      ];
      for (const pos of positions) {
        const h = 30 + Math.random() * 80;
        const tone = TONES[Math.floor(Math.random() * TONES.length)];
        const neon = NEON[Math.floor(Math.random() * NEON.length)];
        const shop = new THREE.Mesh(
          new THREE.BoxGeometry(gw - 6, h, gh - 6),
          new THREE.MeshStandardMaterial({ color: tone, metalness: 0.2, roughness: 0.7 })
        );
        shop.position.set(pos.x + gw / 2, h / 2, pos.y + gh / 2);
        // Small neon sign on top
        const sign = new THREE.Mesh(
          new THREE.PlaneGeometry(gw - 16, 12),
          new THREE.MeshBasicMaterial({ color: neon, transparent: true, opacity: 0.8 })
        );
        sign.position.set(pos.x + gw / 2, h + 8, pos.y + gh / 2);
        shop.add(sign);
        cityGroup.add(shop);
      }
    }
  }

  // Downtown district: taller towers, plaza with fountain (already in cityData),
  // billboards, parking, palms — we add Three.js versions here
  if (DOWNTOWN && DOWNTOWN.blocks) {
    for (const db of DOWNTOWN.blocks) {
      const height = 120 + Math.random() * 250;
      const tone = TONES[Math.floor(Math.random() * TONES.length)];
      const neon = NEON[Math.floor(Math.random() * NEON.length)];
      const building = new THREE.Mesh(
        new THREE.BoxGeometry(db.w, height, db.h),
        new THREE.MeshStandardMaterial({ color: tone, metalness: 0.3, roughness: 0.6 })
      );
      building.position.set(db.x + db.w / 2, height / 2, db.y + db.h / 2);
      // More dense windows in downtown
      const wx = Math.max(1, Math.floor(db.w / 30));
      const wy = Math.max(1, Math.floor(db.h / 30));
      for (let gx = 0; gx < wx; gx += 1) {
        for (let gy = 0; gy < wy; gy += 1) {
          const win = new THREE.Mesh(
            new THREE.PlaneGeometry(db.w / wx - 6, db.h / wy - 6),
            new THREE.MeshBasicMaterial({ color: neon, transparent: true, opacity: 0.85 })
          );
          win.position.set(
            db.x + 3 + gx * (db.w / wx),
            building.position.y + building.scale.y / 2 + 15 + gy * (db.h / wy),
            db.y + 3 + gy * (db.h / wy)
          );
          building.add(win);
        }
      }
      cityGroup.add(building);
    }
  }

  // Plaza: fountain already in sim, add a lit version
  if (DOWNTOWN && DOWNTOWN.plaza) {
    const plaza = DOWNTOWN.plaza;
    const fountain = new THREE.Mesh(
      new THREE.BoxGeometry(plaza.w, 10, plaza.h),
      new THREE.MeshStandardMaterial({ color: 0x8a9ba8, metalness: 0.4, roughness: 0.5 })
    );
    fountain.position.set(plaza.fx, 5, plaza.fy);
    cityGroup.add(fountain);

    // Monument
    const monument = new THREE.Mesh(
      new THREE.BoxGeometry(20, 60, 20),
      new THREE.MeshStandardMaterial({ color: 0x5d3a28, metalness: 0.5, roughness: 0.6 })
    );
    monument.position.set(plaza.fx, 30, plaza.fy);
    cityGroup.add(monument);

    // Trees at plaza flanks
    const palmTrunkGeom = new THREE.CylinderGeometry(6, 6, 50, 12);
    const palmFrondGeom = new THREE.PlaneGeometry(30, 50);
    for (const off of [62, plaza.w + 62]) {
      const trunk = new THREE.Mesh(palmTrunkGeom, new THREE.MeshStandardMaterial({ color: 0x8b5a2b }));
      trunk.position.set(plaza.fx + off, 25, plaza.fy);
      for (let j = 0; j < 3; j += 1) {
        const frond = new THREE.Mesh(palmFrondGeom, new THREE.MeshStandardMaterial({ color: 0x2d5a27 }));
        frond.position.set(0, 25 + j * 18, 0);
        frond.rotation.z = (j / 3) * Math.PI * 2;
        frond.rotation.x = -Math.PI / 2;
        trunk.add(frond);
      }
      cityGroup.add(trunk);
    }
  }

  // Kerbside parking bays as parked cars
  for (const spot of cityData.parking) {
    const carGeo = new THREE.BoxGeometry(44, 21, 16);
    const carMat = new THREE.MeshStandardMaterial({ color: 0x5a2d6e, metalness: 0.2, roughness: 0.6 });
    const parked = new THREE.Mesh(carGeo, carMat);
    parked.position.set(spot.x, 10.5, spot.y);
    parked.rotation.z = spot.angle;
    parked.castShadow = false;
    parked.receiveShadow = true;
    cityGroup.add(parked);
  }

  // Boats on the bay
  for (const boat of cityData.boats) {
    const boatGeo = new THREE.BoxGeometry(boat.size * 15, 12, boat.size * 5);
    const boatMat = new THREE.MeshStandardMaterial({ color: boat.colour, metalness: 0.1, roughness: 0.8 });
    const b = new THREE.Mesh(boatGeo, boatMat);
    b.position.set(boat.x, 6, boat.y);
    b.rotation.z = boat.angle;
    b.castShadow = false;
    cityGroup.add(b);
  }

  return cityGroup;
}