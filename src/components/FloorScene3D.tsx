import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { CampusBuilding } from '../data/campusData.ts';
import { estimatedOccupancy, occupancyBand } from '../utils/campusLogic.ts';
import { createBox } from '../utils/sceneGeometry.ts';
import { floorLayout } from '../utils/floorLayout.ts';

function cuboid(parent: THREE.Group, size: [number, number, number], position: [number, number, number], color: string, opacity = 1): THREE.Mesh {
  const mesh = createBox(size, position, color, opacity);
  parent.add(mesh);
  return mesh;
}

function floorLabel(parent: THREE.Group, level: string, width: number, depth: number, active: boolean): void {
  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  if (!context) return;
  context.fillStyle = active ? '#5b4bd8' : level.startsWith('B') ? '#385f7c' : '#56606a';
  context.fillRect(10, 6, 140, 52);
  context.fillStyle = '#ffffff';
  context.font = 'bold 34px sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(level, 80, 33);
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }));
  sprite.scale.set(5.5, 2.2, 1);
  sprite.position.set(-width / 2 - 3, 1.1, depth / 2 + 1);
  parent.add(sprite);
}

function addGroundRim(scene: THREE.Scene, width: number, depth: number, elevation: number): void {
  const ground = new THREE.Group();
  ground.name = 'ground-level-rim';
  cuboid(ground, [width + 10, .65, 3], [0, elevation, -depth / 2 - 1.5], '#c3cbbd', .72);
  cuboid(ground, [3, .65, depth + 8], [-width / 2 - 1.5, elevation, 0], '#c3cbbd', .72);
  cuboid(ground, [3, .65, depth + 8], [width / 2 + 1.5, elevation, 0], '#c3cbbd', .72);
  scene.add(ground);
}

export function FloorScene3D({ building, selectedFloor, hour, onSelect }: { building: CampusBuilding; selectedFloor: string; hour: number; onSelect: (floor: string) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const select = useRef(onSelect);
  select.current = onSelect;
  useEffect(() => {
    if (!host.current) return;
    const container = host.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#f5f5fb');
    const camera = new THREE.PerspectiveCamera(40, 1, .1, 500);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    container.append(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.minDistance = 12;
    controls.maxDistance = 150;
    controls.maxPolarAngle = Math.PI * .64;
    scene.add(new THREE.HemisphereLight('#ffffff', '#a19dba', 2.8));
    const light = new THREE.DirectionalLight('#fff5e0', 2);
    light.position.set(20, 40, 30);
    scene.add(light);
    const floors = building.floors;
    const spacing = 6;
    const groundIndex = Math.max(0, floors.findIndex(floor => floor.level === 'G'));
    const elevation = (index: number): number => (index - groundIndex) * spacing;
    const bottomY = elevation(0);
    const topY = elevation(floors.length - 1);
    const focusY = (bottomY + topY) / 2;
    controls.target.set(0, focusY, 0);
    const distance = Math.max(building.dimensions[0], building.dimensions[2], (topY - bottomY) * 1.25) * 1.1;
    camera.position.set(distance, focusY + distance * .8, distance * 1.2);
    const meshes: THREE.Object3D[] = [];
    if (groundIndex > 0) addGroundRim(scene, building.dimensions[0], building.dimensions[2], -spacing / 2);
    floors.forEach((floor, index) => {
      const active = floor.level === selectedFloor;
      const group = new THREE.Group();
      group.position.y = elevation(index);
      const occupancy = estimatedOccupancy(floor, hour);
      const band = occupancyBand(occupancy);
      const { width, depth, desks, pods } = floorLayout(building, floor, occupancy);
      const color = band === 'quiet' ? '#adc78b' : band === 'moderate' ? '#ddb974' : '#d79b82';
      const slab = cuboid(group, [width, .45, depth], [0, 0, 0], color, active ? 1 : index < groundIndex ? .35 : .16);
      slab.userData.floor = floor.level;
      meshes.push(slab);
      floorLabel(group, floor.level, width, depth, active);
      if (active) {
        cuboid(group, [width, 1.7, .2], [0, 1, -depth / 2], '#e4e3d8', .5);
        cuboid(group, [.2, 1.7, depth], [-width / 2, 1, 0], '#e4e3d8', .5);
        desks.forEach(desk => {
          cuboid(group, [desk.group ? 2 : 1.6, .22, desk.group ? 1.6 : .85], [desk.x, 1.3, desk.z], '#b99a72');
          cuboid(group, [.2, 1, .2], [desk.x, .75, desk.z], '#8f8578');
          const chairs = desk.group ? [-.95, .95] : [.8];
          chairs.forEach(offset => {
            cuboid(group, [.55, .6, .55], [desk.x, .65, desk.z + offset], desk.occupied ? '#455067' : '#f1eee5');
            cuboid(group, [.55, .8, .15], [desk.x, 1.15, desk.z + offset + .2], desk.occupied ? '#455067' : '#f1eee5');
          });
        });
        pods.forEach(pod => {
          cuboid(group, [width * .18, 2.3, .12], [pod.x, 1.4, pod.z - depth * .09], '#87b6c4', .35);
          cuboid(group, [.12, 2.3, depth * .18], [pod.x + width * .09, 1.4, pod.z], '#87b6c4', .35);
          cuboid(group, [1.5, .2, 1], [pod.x, 1.3, pod.z], '#b99a72');
          cuboid(group, [.55, .6, .55], [pod.x, .65, pod.z + .9], '#788e8a');
        });
        cuboid(group, [width * .18, 2.5, depth * .15], [-width * .3, 1.5, -depth * .35], '#a6b2c4');
        if (floor.type === 'Silent') cuboid(group, [width * .45, 1.8, .8], [width * .15, 1.1, -depth * .4], '#94795b');
        if (floor.water) cuboid(group, [.65, 1.3, .65], [width * .38, .9, -depth * .35], '#6ba9d0');
        if (floor.sockets) cuboid(group, [.9, .1, .4], [width * .28, .35, -depth * .35], '#e0aa55');
      }
      scene.add(group);
    });
    const ray = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let down = [0, 0];
    const onDown = (event: PointerEvent): void => { down = [event.clientX, event.clientY]; };
    const onUp = (event: PointerEvent): void => {
      if (Math.hypot(event.clientX - down[0], event.clientY - down[1]) > 5) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
      ray.setFromCamera(pointer, camera);
      const hit = ray.intersectObjects(meshes)[0];
      if (hit) select.current(String(hit.object.userData.floor));
    };
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointerup', onUp);
    controls.update();
    const render = (): void => { renderer.render(scene, camera); };
    const resize = new ResizeObserver(() => {
      camera.aspect = container.clientWidth / Math.max(1, container.clientHeight);
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
      render();
    });
    resize.observe(container);
    controls.addEventListener('change', render);
    render();
    return () => {
      resize.disconnect(); controls.removeEventListener('change', render); controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', onDown); renderer.domElement.removeEventListener('pointerup', onUp);
      scene.traverse(item => {
        if (item instanceof THREE.Mesh) { item.geometry.dispose(); (item.material as THREE.Material).dispose(); }
        if (item instanceof THREE.Sprite) { item.material.map?.dispose(); item.material.dispose(); }
      });
      renderer.dispose(); renderer.domElement.remove();
    };
  }, [building, selectedFloor, hour]);
  const hasBasement = building.floors.some(floor => floor.level.startsWith('B'));
  return <div className="floor-scene" ref={host} role="img" aria-label={`Rotatable furnished schematic of ${building.name}, floor ${selectedFloor}. ${hasBasement ? 'Basement floors are below street level.' : ''} Use the floor buttons to change levels.`}>
    {hasBasement && <div className="floor-ground-key">Street level <span>↓ Basements</span></div>}
  </div>;
}
