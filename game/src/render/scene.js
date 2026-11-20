import * as THREE from '../vendor/three.module.min.js';

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.deviceRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Camera: perspective, golden-hour FOV, fit to city bounds
  const fov = 75;
  const aspect = 1280 / 720;
  const near = 0.1;
  const far = 5000;
  const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
  camera.position.set(0, 200, 400);
  camera.lookAt(0, 0, 0);

  // Sun directional light with soft shadows
  const sun = new THREE.DirectionalLight(0xffe8c3, 1.2);
  sun.position.set(500, 800, 300);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 2048;
  sun.shadow.mapSize.height = 2048;
  sun.shadow.camera.near = 200;
  sun.shadow.camera.far = 2000;
  sun.shadow.bias = -0.0001;
  scene.add(sun);

  // Ambient light for fill
  const ambient = new THREE.AmbientLight(0x4a3f32, 0.6);
  scene.add(ambient);

  // Fog: warm horizon fog
  scene.fog = new THREE.Fog(0x2a1a3c, 800, 3000);

  // Ocean plane: large thin with animated normal simulation + sun glint
  const oceanGeom = new THREE.PlaneGeometry(5000, 5000, 256, 256);
  oceanGeom.rotateX(-Math.PI / 2);
  const oceanMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a40,
    roughness: 0.6,
    metalness: 0.05,
    onBeforeCompile: shader => {
      // Inject animated foam normals via a shared uniform
      const vertexShader = shader.vertexShader;
      shader.vertexShader = vertexShader.replace(
        '#include <beginnormal>',
        '#include <beginnormal>\nuniform float foamTime;'
      );
      const fragmentShader = shader.fragmentShader;
      shader.fragmentShader = fragmentShader.replace(
        '#include <normalfragment>',
        '#include <normalfragment>\nuniform float foamTime;\nvarying vec3 vNormal;'
      );
      // Store the normal for the glint calculation
      shader.fragmentShader = shader.fragmentShader.replace(
        'varying vec3 vNormal;',
        'varying vec3 vNormal; varying vec2 vUv;'
      );
      shader.uniforms['foamTime'] = { value: 0 };
      shader.uniforms['vUv'] = { value: new THREE.Vector2() };
    }
  });
  const ocean = new THREE.Mesh(oceanGeom, oceanMat);
  ocean.receiveShadow = true;
  scene.add(ocean);

  // Sun glint on ocean
  const glint = new THREE.Mesh(
    new THREE.SphereGeometry(150, 32, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd93d, transparent: true, opacity: 0.08 })
  );
  glint.position.set(400, 120, -200);
  scene.add(glint);

  // City: procedural blocks with varied heights and warm emissive windows
  const cityGroup = new THREE.Group();
  scene.add(cityGroup);

  // Thin clouds: a hemisphere of semi-transparent boxes above the city
  const cloudGeom = new THREE.BoxGeometry(200, 40, 200);
  const cloudCount = 40;
  for (let i = 0; i < cloudCount; i += 1) {
    const cloud = new THREE.Mesh(cloudGeom, new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.4,
      roughness: 0.8,
      metalness: 0.0
    }));
    cloud.position.set(
      (Math.random() - 0.5) * 2000,
      300 + Math.random() * 400,
      (Math.random() - 0.5) * 2000
    );
    cloud.castShadow = false;
    cityGroup.add(cloud);
  }

  // Street lamps: along the grid avenues
  const lampGeom = new THREE.CylinderGeometry(4, 4, 30, 12);
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xffd24a, emissive: 0xffd24a, emissiveIntensity: 0.15 });
  for (let i = 0; i < 30; i += 1) {
    const lamp = new THREE.Mesh(lampGeom, lampMat);
    lamp.position.set(
      (Math.random() - 0.5) * 2000,
      15,
      (Math.random() - 0.5) * 2000
    );
    lamp.castShadow = false;
    cityGroup.add(lamp);
  }

  // Marina: a few low-poly boats
  const boatGeom = new THREE.BoxGeometry(80, 12, 20);
  const boatMat = new THREE.MeshStandardMaterial({ color: 0x8b7355 });
  for (let i = 0; i < 6; i += 1) {
    const boat = new THREE.Mesh(boatGeom, boatMat);
    boat.position.set(
      (Math.random() - 0.5) * 1500 + 800,
      6,
      (Math.random() - 0.5) * 1500 + 800
    );
    boat.rotation.z = Math.random() * Math.PI * 2;
    boat.castShadow = false;
    cityGroup.add(boat);
  }

  // Palm trees: procedural trunk + fronds (fronds as scaled planes)
  const palmTrunkGeom = new THREE.CylinderGeometry(8, 8, 80, 12);
  const palmFrondGeom = new THREE.PlaneGeometry(40, 80);
  for (let i = 0; i < 20; i += 1) {
    const trunk = new THREE.Mesh(palmTrunkGeom, new THREE.MeshStandardMaterial({ color: 0x8b5a2b }));
    trunk.position.set(
      (Math.random() - 0.5) * 2000,
      40,
      (Math.random() - 0.5) * 2000
    );
    const frondCount = 6;
    for (let j = 0; j < frondCount; j += 1) {
      const frond = new THREE.Mesh(palmFrondGeom, new THREE.MeshStandardMaterial({ color: 0x2d5a27 }));
      frond.position.set(0, 40 + j * 15, 0);
      frond.rotation.z = (j / frondCount) * Math.PI * 2;
      frond.rotation.x = -Math.PI / 2;
      trunk.add(frond);
    }
    cityGroup.add(trunk);
  }

  // Plaza fountain: central feature
  const fountainGeom = new THREE.BoxGeometry(40, 40, 40);
  const fountainMat = new THREE.MeshStandardMaterial({ color: 0x8a9ba8, metalness: 0.4 });
  const fountain = new THREE.Mesh(fountainGeom, fountainMat);
  fountain.position.set(0, 20, 0);
  cityGroup.add(fountain);

  // Player third-person articulated figure (simple stick figure)
  const playerGeom = new THREE.SphereGeometry(20, 16, 16);
  const playerMat = new THREE.MeshStandardMaterial({ color: 0xf5e6d0, metalness: 0.0, roughness: 0.3 });
  const playerMesh = new THREE.Mesh(playerGeom, playerMat);
  playerMesh.position.y = 20;
  cityGroup.add(playerMesh);

  // Car: player vehicle (box with wheels)
  const carGeom = new THREE.BoxGeometry(48, 25, 12);
  const carMat = new THREE.MeshStandardMaterial({ color: 0x12b0c9, metalness: 0.3, roughness: 0.4 });
  const carMesh = new THREE.Mesh(carGeom, carMat);
  carMesh.position.y = 12.5;
  carMesh.castShadow = true;
  carMesh.receiveShadow = true;
  cityGroup.add(carMesh);

  // Sky sphere (inverted, only drawn after opaque objects)
  const skyGeom = new THREE.SphereGeometry(2000, 32, 32);
  const skyMat = new THREE.MeshBasicMaterial({
    color: 0x2a4a72,
    side: THREE.BackSide,
    transparent: true,
    opacity: 0.95
  });
  const sky = new THREE.Mesh(skyGeom, skyMat);
  sky.position.set(0, 0, 0);
  // Insert after opaque meshes so it renders last
  scene.add(sky);

  // Resize handler
  const resize = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize);

  return { renderer, camera, scene, resize, sun, foamTime: 0 };
}