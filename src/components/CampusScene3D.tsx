import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { CampusBuilding, CampusProfile } from '../data/campusData.ts';
import { buildingOccupancy, occupancyBand, sunState } from '../utils/campusLogic.ts';

export interface SceneHandle {
  focus: (buildingId: string) => void;
  reset: () => void;
  capture: () => string | null;
}

export type PetPhase = 'desktop' | 'entering' | 'touring' | 'exiting';

interface SceneProps {
  campus: CampusProfile;
  hour: number;
  selectedId: string | null;
  selectedFloor: string | null;
  heatmap: boolean;
  flow: boolean;
  petGuide: boolean;
  petPhase: PetPhase;
  petMessage: string | null;
  onSelect: (id: string) => void;
}

type SceneRuntime = {
  focus: (buildingId: string) => void;
  reset: () => void;
  capture: () => string | null;
  update: (props: Pick<SceneProps, 'hour' | 'selectedId' | 'selectedFloor' | 'heatmap' | 'flow' | 'petGuide' | 'petPhase' | 'petMessage'>) => void;
  dispose: () => void;
};

function cssColor(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function box(w: number, h: number, d: number, color: THREE.ColorRepresentation, x: number, y: number, z: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: .83 }));
  mesh.position.set(x, y, z);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  return mesh;
}

function sheepPart(parent: THREE.Group, color: string, position: [number, number, number], scale: [number, number, number]): THREE.Mesh {
  const part = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshStandardMaterial({ color, roughness: .9 }));
  part.position.set(...position);
  part.scale.set(...scale);
  part.castShadow = true;
  parent.add(part);
  return part;
}

function createGuideSheep(): { group: THREE.Group; feet: THREE.Mesh[] } {
  const group = new THREE.Group();
  sheepPart(group, '#fff7df', [0, 1.2, 0], [1.15, .78, .78]);
  for (const [x, y, z] of [[-.65, 1.6, -.35], [0, 1.8, -.4], [.65, 1.6, -.35], [-.6, 1.5, .35], [.6, 1.5, .35]])
    sheepPart(group, '#fffaf0', [x, y, z], [.54, .52, .52]);
  sheepPart(group, '#524944', [0, 1.35, .83], [.56, .55, .38]);
  sheepPart(group, '#fffaf0', [0, 1.83, .65], [.56, .35, .36]);
  for (const x of [-.36, .36]) sheepPart(group, '#574c44', [x, 1.45, .53], [.28, .18, .2]);
  for (const x of [-.2, .2]) sheepPart(group, '#fff', [x, 1.48, 1.13], [.12, .15, .06]);
  for (const x of [-.2, .2]) sheepPart(group, '#211d1c', [x, 1.48, 1.18], [.06, .08, .04]);
  const feet = [-.65, .65].flatMap(x => [-.4, .4].map(z => sheepPart(group, '#524944', [x, .44, z], [.2, .45, .2])));
  group.scale.setScalar(5);
  return { group, feet };
}

function facadeTexture(color: string, glass: boolean): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d')!;
  context.fillStyle = color;
  context.fillRect(0, 0, 256, 256);
  context.fillStyle = glass ? 'rgba(61,80,88,.22)' : 'rgba(73,57,50,.1)';
  for (let y = 0; y < 256; y += 32) context.fillRect(0, y, 256, 2);
  for (let row = 0; row < 7; row++) {
    for (let column = 0; column < 8; column++) {
      const x = 8 + column * 31;
      const y = 9 + row * 35;
      context.fillStyle = glass ? 'rgba(55,83,89,.63)' : 'rgba(66,70,67,.56)';
      context.fillRect(x, y, glass ? 22 : 16, 23);
      context.fillStyle = glass ? 'rgba(239,244,233,.32)' : 'rgba(247,235,205,.46)';
      context.fillRect(x + 2, y + 2, glass ? 8 : 6, 15);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1.25, 1.25);
  return texture;
}

function makeBuilding(building: CampusBuilding, textures: THREE.Texture[]): { group: THREE.Group; roof: THREE.MeshStandardMaterial; body: THREE.MeshStandardMaterial; slabs: THREE.Mesh[] } {
  const group = new THREE.Group();
  group.position.set(building.position[0], 0, building.position[1]);
  const [w, h, d] = building.dimensions;
  const glass = building.style === 'glass';
  const texture = facadeTexture(building.color, glass);
  textures.push(texture);
  const body = new THREE.MeshStandardMaterial({ map: texture, color: '#ffffff', roughness: glass ? .44 : .84, metalness: glass ? .15 : 0 });
  const roof = new THREE.MeshStandardMaterial({ color: building.style === 'brick' ? '#c38964' : building.style === 'glass' ? '#8da7a7' : '#a6bd82', roughness: .85 });
  let geometry: THREE.BufferGeometry = new THREE.BoxGeometry(w, h, d);
  if (building.footprint && building.footprint.length >= 3) {
    const shape = new THREE.Shape();
    building.footprint.forEach(([x, z], index) => index ? shape.lineTo(x, -z) : shape.moveTo(x, -z));
    shape.closePath();
    geometry = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false });
    geometry.rotateX(-Math.PI / 2);
  }
  const mass = new THREE.Mesh(geometry, building.footprint ? [roof, body] : [body, body, roof, body, body, body]);
  mass.position.y = building.footprint ? 0 : h / 2;
  mass.castShadow = true;
  mass.receiveShadow = true;
  mass.userData.buildingId = building.id;
  group.add(mass);
  if (!building.footprint) {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(w + .5, .45, d + .5), roof);
    cap.position.y = h + .2;
    cap.userData.buildingId = building.id;
    group.add(cap);
  }
  const slabs = building.floors.map((floor, index) => {
    const slab = box(w * .92, .32, d * .92, floor.type === 'Silent' ? '#a8d0a0' : floor.type === 'Quiet' ? '#e0b86d' : '#d99a70', 0, 2 + index * ((h - 3) / building.floors.length), 0);
    slab.visible = false;
    slab.userData.buildingId = building.id;
    group.add(slab);
    return slab;
  });
  if (building.style === 'classical') addClassicalDetails(group, w, h, d);
  if (building.style === 'tower') addTowerDetails(group, w, h);
  if (building.style === 'library' || building.style === 'brick') addBrickDetails(group, w, h, d);
  if (glass) addGlassDetails(group, w, h, d);
  group.traverse(object => { if (object instanceof THREE.Mesh) object.userData.buildingId = building.id; });
  return { group, roof, body, slabs };
}

function addClassicalDetails(group: THREE.Group, w: number, h: number, d: number): void {
  const front = d / 2 + .8;
  group.add(box(w * .6, 1.4, 4, '#ede6d4', 0, h * .62, front));
  for (let i = -2; i <= 2; i++) {
    const column = new THREE.Mesh(new THREE.CylinderGeometry(.55, .6, h * .48, 10), new THREE.MeshStandardMaterial({ color: '#eee8d8' }));
    column.position.set(i * w * .11, h * .36, front + 1.6);
    group.add(column);
  }
  const dome = new THREE.Mesh(new THREE.SphereGeometry(Math.min(w, d) * .22, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#cf9a5f' }));
  dome.position.set(0, h + .6, 0);
  group.add(dome);
  group.add(box(1.7, 3, 1.7, '#d6b988', 0, h + 4.1, 0));
}

function addTowerDetails(group: THREE.Group, w: number, h: number): void {
  const spire = new THREE.Mesh(new THREE.ConeGeometry(w * .38, 8, 8), new THREE.MeshStandardMaterial({ color: '#b7a791' }));
  spire.position.y = h + 4;
  group.add(spire);
}

function addBrickDetails(group: THREE.Group, w: number, h: number, d: number): void {
  const parapet = box(w + 1, 1.3, d + 1, '#ad765f', 0, h + .7, 0);
  group.add(parapet);
  for (let i = -1; i <= 1; i++) group.add(box(2, 1.8, 2, '#b38666', i * w * .3, h + 1.8, -d * .22));
}

function addGlassDetails(group: THREE.Group, w: number, h: number, d: number): void {
  group.add(box(w * .78, h * .55, .55, '#72888b', 0, h * .54, d / 2 + .2));
  group.add(box(w * .62, .5, d * .7, '#d5b28c', 0, h + .65, 0));
}

function createGround(scene: THREE.Scene): void {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(270, 270), new THREE.MeshStandardMaterial({ color: cssColor('--map-ground'), roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  for (const x of [-70, -13, 64]) scene.add(box(11, .1, 270, cssColor('--map-road'), x, .06, 0));
  for (const z of [-65, -6, 61]) scene.add(box(270, .1, 11, cssColor('--map-road'), 0, .07, z));
  for (const [x, z, w, d] of [[-95, 27, 25, 34], [77, 79, 35, 31], [-5, -90, 48, 26], [3, 42, 33, 19]] as const) {
    scene.add(box(w, .12, d, cssColor('--map-park'), x, .14, z));
  }
  for (let i = -4; i <= 4; i++) {
    scene.add(box(1.6, .02, .2, '#f5f3eb', i * 5.6, .14, -6));
    scene.add(box(.2, .02, 1.6, '#f5f3eb', -13, .14, i * 5.6));
  }
}

function random(seed: number): number {
  const value = Math.sin(seed * 127.1 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function addCityContext(scene: THREE.Scene, campus: CampusProfile, textures: THREE.Texture[]): void {
  let n = 0;
  for (let x = -117; x <= 117; x += 15) {
    for (let z = -115; z <= 115; z += 15) {
      n++;
      if (Math.abs(x + 70) < 8 || Math.abs(x + 13) < 8 || Math.abs(x - 64) < 8) continue;
      if (Math.abs(z + 65) < 8 || Math.abs(z + 6) < 8 || Math.abs(z - 61) < 8) continue;
      if (Math.hypot(x, z) < 58 || campus.buildings.some(item => Math.hypot(item.position[0] - x, item.position[1] - z) < 17)) continue;
      if (random(n + 6) < .22) continue;
      const h = 7 + random(n + 13) * 13;
      const color = ['#d3d0c7', '#c6c3b9', '#bfbab0', '#d7d2c6'][Math.floor(random(n + 39) * 4)];
      const texture = facadeTexture(color, false);
      textures.push(texture);
      const material = new THREE.MeshStandardMaterial({ map: texture, roughness: .95 });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(11 + random(n) * 3, h, 11 + random(n + 1) * 3), material);
      mesh.position.set(x + random(n + 31) * 2, h / 2, z + random(n + 22) * 2);
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      scene.add(mesh);
    }
  }
}

function addTrees(scene: THREE.Scene): void {
  for (let i = 0; i < 46; i++) {
    const angle = random(i + 911) * Math.PI * 2;
    const radius = 35 + random(i + 20) * 78;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (Math.abs(x + 70) < 7 || Math.abs(x + 13) < 7 || Math.abs(x - 64) < 7) continue;
    if (Math.abs(z + 65) < 7 || Math.abs(z + 6) < 7 || Math.abs(z - 61) < 7) continue;
    scene.add(box(.7, 3.5, .7, '#88745e', x, 1.75, z));
    const canopy = new THREE.Mesh(new THREE.IcosahedronGeometry(2.3 + random(i + 9) * .9, 1), new THREE.MeshStandardMaterial({ color: i % 3 ? '#8aaa73' : '#a2b984', roughness: 1 }));
    canopy.position.set(x, 4.8, z);
    scene.add(canopy);
  }
}

function makeScene(container: HTMLDivElement, labels: HTMLDivElement, campus: CampusProfile, onSelect: (id: string) => void): SceneRuntime {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 1, 600);
  camera.position.set(85, 145, 155);
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = .08;
  controls.minDistance = 28;
  controls.maxDistance = 280;
  controls.maxPolarAngle = Math.PI * .48;
  controls.target.set(0, 4, 0);
  const hemi = new THREE.HemisphereLight('#eff4ed', '#737c70', 1.3);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff6de', 2.1);
  sun.position.set(40, 78, 40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(512, 512);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -130;
  sun.shadow.camera.right = sun.shadow.camera.top = 130;
  sun.shadow.bias = -.0005;
  scene.add(sun);
  createGround(scene);
  const textures: THREE.Texture[] = [];
  addCityContext(scene, campus, textures);
  addTrees(scene);

  const buildings = new Map<string, ReturnType<typeof makeBuilding>>();
  const pins = new Map<string, HTMLButtonElement>();
  for (const building of campus.buildings) {
    const model = makeBuilding(building, textures);
    buildings.set(building.id, model);
    scene.add(model.group);
    const pin = document.createElement('button');
    pin.type = 'button';
    pin.className = 'map-pin';
    pin.dataset.buildingId = building.id;
    pin.setAttribute('aria-label', `Inspect ${building.name}`);
    const dot = document.createElement('span');
    dot.className = 'map-pin-dot';
    const name = document.createElement('span');
    name.textContent = building.name;
    const value = document.createElement('strong');
    value.className = 'map-pin-value';
    pin.append(dot, name, value);
    pin.addEventListener('click', () => onSelect(building.id));
    labels.appendChild(pin);
    pins.set(building.id, pin);
  }

  const flowGeometry = new THREE.BufferGeometry();
  const flowPositions = new Float32Array(100 * 3);
  const flowDots = new THREE.Points(flowGeometry, new THREE.PointsMaterial({ color: '#6655dd', size: .6, transparent: true, opacity: .58 }));
  flowGeometry.setAttribute('position', new THREE.BufferAttribute(flowPositions, 3));
  scene.add(flowDots);
  const ring = new THREE.Mesh(new THREE.RingGeometry(10.5, 11.2, 64), new THREE.MeshBasicMaterial({ color: '#564be3', transparent: true, opacity: .55, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  scene.add(ring);
  const sheep = createGuideSheep();
  sheep.group.visible = false;
  scene.add(sheep.group);
  const speechCloud = document.createElement('div');
  speechCloud.className = 'sheep-cloud';
  speechCloud.setAttribute('role', 'status');
  speechCloud.setAttribute('aria-live', 'polite');
  speechCloud.hidden = true;
  labels.appendChild(speechCloud);

  let state: Pick<SceneProps, 'hour' | 'selectedId' | 'selectedFloor' | 'heatmap' | 'flow' | 'petGuide' | 'petPhase' | 'petMessage'> = { hour: 16, selectedId: null, selectedFloor: null, heatmap: false, flow: true, petGuide: false, petPhase: 'desktop', petMessage: null };
  let phaseStarted = performance.now();
  let desiredCamera: THREE.Vector3 | null = null;
  let desiredTarget: THREE.Vector3 | null = null;
  let frame = 0;
  let animation = 0;
  let disposed = false;
  let lastRender = 0;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let pointerStart: [number, number] | null = null;

  let firstResize = true;
  const resize = () => {
    const width = container.clientWidth;
    const height = container.clientHeight;
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    if (firstResize && width < 760) camera.position.set(85, 220, 230);
    firstResize = false;
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  resize();

  const pointerDown = (event: PointerEvent) => { pointerStart = [event.clientX, event.clientY]; };
  const pointerUp = (event: PointerEvent) => {
    if (!pointerStart || Math.hypot(event.clientX - pointerStart[0], event.clientY - pointerStart[1]) > 6) return;
    const bounds = renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -((event.clientY - bounds.top) / bounds.height * 2 - 1));
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects([...buildings.values()].map(item => item.group), true).find(item => item.object.userData.buildingId);
    if (hit) onSelect(hit.object.userData.buildingId as string);
  };
  renderer.domElement.addEventListener('pointerdown', pointerDown);
  renderer.domElement.addEventListener('pointerup', pointerUp);

  const applyState = () => {
    const solar = sunState(state.hour);
    scene.background = new THREE.Color(solar.sky);
    scene.fog = new THREE.FogExp2(solar.sky, solar.phase === 'night' ? .0028 : .0016);
    hemi.intensity = solar.phase === 'night' ? .75 : 1.25;
    sun.intensity = solar.light;
    sun.color.set(solar.phase === 'dusk' ? '#ffe0b4' : '#fff5e4');
    for (const building of campus.buildings) {
      const model = buildings.get(building.id)!;
      const occupancy = buildingOccupancy(building, state.hour);
      const band = occupancyBand(occupancy);
      const pin = pins.get(building.id)!;
      pin.dataset.band = band;
      pin.dataset.selected = String(building.id === state.selectedId);
      pin.querySelector('.map-pin-value')!.textContent = `${occupancy}%`;
      model.roof.color.set(state.heatmap ? band === 'quiet' ? '#92bd76' : band === 'moderate' ? '#dfae62' : '#d97954' : building.style === 'brick' ? '#c38964' : building.style === 'glass' ? '#8da7a7' : '#a6bd82');
      model.body.transparent = building.id === state.selectedId && Boolean(state.selectedFloor);
      model.body.opacity = model.body.transparent ? .35 : 1;
      model.body.depthWrite = !model.body.transparent;
      model.slabs.forEach((slab, index) => {
        slab.visible = building.id === state.selectedId && Boolean(state.selectedFloor);
        (slab.material as THREE.MeshStandardMaterial).emissive.set(building.floors[index].level === state.selectedFloor ? '#5a50dc' : '#000000');
        (slab.material as THREE.MeshStandardMaterial).emissiveIntensity = .32;
      });
    }
  };
  applyState();

  const animate = (timestamp: number) => {
    if (disposed) return;
    animation = requestAnimationFrame(animate);
    if (document.hidden || timestamp - lastRender < 30) return;
    lastRender = timestamp;
    frame++;
    if (desiredCamera && desiredTarget) {
      camera.position.lerp(desiredCamera, .055);
      controls.target.lerp(desiredTarget, .055);
      if (camera.position.distanceTo(desiredCamera) < .2) desiredCamera = desiredTarget = null;
    }
    controls.update();
    const selected = campus.buildings.find(building => building.id === state.selectedId);
    ring.visible = Boolean(selected);
    sheep.group.visible = Boolean(state.petGuide && selected);
    if (selected) {
      ring.position.set(selected.position[0], .5, selected.position[1]);
      ring.scale.setScalar(1 + Math.sin(frame * .045) * .06);
      if (sheep.group.visible) {
        const standingY = selected.dimensions[1] + .5;
        const destination = new THREE.Vector3(selected.position[0] + selected.dimensions[0] * .2, standingY, selected.position[1] + selected.dimensions[2] * .2);
        if (state.petPhase === 'entering' || state.petPhase === 'exiting') {
          const duration = state.petPhase === 'entering' ? 1400 : 1200;
          const progress = reducedMotion ? 1 : Math.min(1, (timestamp - phaseStarted) / duration);
          const eased = progress * progress * (3 - 2 * progress);
          const portal = state.petPhase === 'entering'
            ? new THREE.Vector3(destination.x - 34, Math.max(2, standingY - 18), destination.z + 30)
            : new THREE.Vector3(destination.x + 36, standingY + 17, destination.z + 32);
          sheep.group.position.copy(state.petPhase === 'entering' ? portal.lerp(destination, eased) : destination.lerp(portal, eased));
          sheep.group.position.y += reducedMotion ? 0 : Math.sin(progress * Math.PI) * 3;
          sheep.group.scale.setScalar(5 * (state.petPhase === 'entering' ? .55 + .45 * eased : 1 - .55 * eased));
        } else {
          if (sheep.group.position.lengthSq() === 0) sheep.group.position.copy(destination);
          sheep.group.position.lerp(destination, .09);
          sheep.group.position.y = standingY + (reducedMotion ? 0 : Math.abs(Math.sin(frame * .12)) * .18);
          sheep.group.scale.setScalar(5);
        }
        sheep.feet.forEach((foot, index) => { foot.rotation.x = reducedMotion ? 0 : Math.sin(frame * .12 + index * Math.PI) * .35; });
      }
    }
    speechCloud.hidden = !sheep.group.visible || !state.petMessage;
    if (!speechCloud.hidden) {
      if (speechCloud.textContent !== state.petMessage) speechCloud.textContent = state.petMessage;
      const point = sheep.group.position.clone().add(new THREE.Vector3(0, 13, 0)).project(camera);
      speechCloud.hidden = point.z < -1 || point.z > 1 || Math.abs(point.x) > 1.15 || Math.abs(point.y) > 1.15;
      speechCloud.style.left = `${Math.max(115, Math.min(container.clientWidth - 115, (point.x * .5 + .5) * container.clientWidth))}px`;
      speechCloud.style.top = `${Math.max(80, Math.min(container.clientHeight - 30, (-point.y * .5 + .5) * container.clientHeight))}px`;
    }
    flowDots.visible = state.flow && !reducedMotion;
    if (flowDots.visible) {
      for (let i = 0; i < 100; i++) {
        const lane = i % 4;
        const progress = ((i * .137 + frame * .0018 * (i % 3 + 1)) % 1) * 210 - 105;
        flowPositions[i * 3] = lane < 2 ? progress : lane === 2 ? -13 : 64;
        flowPositions[i * 3 + 1] = .45;
        flowPositions[i * 3 + 2] = lane < 2 ? lane === 0 ? -6 : 61 : progress;
      }
      flowGeometry.attributes.position.needsUpdate = true;
    }
    for (const building of campus.buildings) {
      const pin = pins.get(building.id)!;
      const point = new THREE.Vector3(building.position[0], building.dimensions[1] + 2, building.position[1]).project(camera);
      const visible = point.z < 1 && point.z > -1 && Math.abs(point.x) < 1.3 && Math.abs(point.y) < 1.3;
      pin.style.display = visible && !(state.petGuide && building.id === state.selectedId) ? 'inline-flex' : 'none';
      pin.style.left = `${(point.x * .5 + .5) * container.clientWidth}px`;
      pin.style.top = `${(-point.y * .5 + .5) * container.clientHeight}px`;
    }
    renderer.render(scene, camera);
  };
  animate(performance.now());

  return {
    focus: buildingId => {
      const building = campus.buildings.find(item => item.id === buildingId);
      if (!building) return;
      desiredTarget = new THREE.Vector3(building.position[0], building.dimensions[1] * .45, building.position[1]);
      const zoom = container.clientWidth < 600 ? .65 : 1;
      desiredCamera = new THREE.Vector3(building.position[0] + 41 * zoom, building.dimensions[1] + 45 * zoom, building.position[1] + 55 * zoom);
    },
    reset: () => { desiredTarget = new THREE.Vector3(0, 4, 0); desiredCamera = container.clientWidth < 760 ? new THREE.Vector3(85, 220, 230) : new THREE.Vector3(85, 145, 155); },
    capture: () => { renderer.render(scene, camera); return renderer.domElement.toDataURL('image/png'); },
    update: next => { if (state.petPhase !== next.petPhase) phaseStarted = performance.now(); state = next; applyState(); },
    dispose: () => {
      disposed = true;
      cancelAnimationFrame(animation);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', pointerDown);
      renderer.domElement.removeEventListener('pointerup', pointerUp);
      labels.replaceChildren();
      controls.dispose();
      scene.traverse(object => {
        if (!(object instanceof THREE.Mesh || object instanceof THREE.Points)) return;
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach(material => material.dispose());
      });
      textures.forEach(texture => texture.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

export const CampusScene3D = forwardRef<SceneHandle, SceneProps>(function CampusScene3D(props, ref) {
  const container = useRef<HTMLDivElement>(null);
  const labels = useRef<HTMLDivElement>(null);
  const runtime = useRef<SceneRuntime | null>(null);
  const onSelect = useRef(props.onSelect);
  onSelect.current = props.onSelect;

  useImperativeHandle(ref, () => ({
    focus: id => runtime.current?.focus(id),
    reset: () => runtime.current?.reset(),
    capture: () => runtime.current?.capture() ?? null,
  }), []);

  useEffect(() => {
    if (!container.current || !labels.current) return;
    const scene = makeScene(container.current, labels.current, props.campus, id => onSelect.current(id));
    runtime.current = scene;
    return () => { scene.dispose(); runtime.current = null; };
  }, [props.campus]);

  useEffect(() => {
    runtime.current?.update({ hour: props.hour, selectedId: props.selectedId, selectedFloor: props.selectedFloor, heatmap: props.heatmap, flow: props.flow, petGuide: props.petGuide, petPhase: props.petPhase, petMessage: props.petMessage });
  }, [props.hour, props.selectedId, props.selectedFloor, props.heatmap, props.flow, props.petGuide, props.petPhase, props.petMessage, props.campus]);

  return <div className="scene-root" aria-label={`Interactive 3D map of ${props.campus.name}`}>
    <div className="scene-canvas" ref={container} />
    <div className="scene-labels" ref={labels} />
  </div>;
});
