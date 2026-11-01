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
    controls.maxPolarAngle = Math.PI * .48;
    scene.add(new THREE.HemisphereLight('#ffffff', '#a19dba', 2.8));
    const light = new THREE.DirectionalLight('#fff5e0', 2);
    light.position.set(20, 40, 30);
    scene.add(light);
    const floors = building.floors;
    const selectedIndex = Math.max(0, floors.findIndex(floor => floor.level === selectedFloor));
    const spacing = 6;
    const focusY = selectedIndex * spacing;
    controls.target.set(0, focusY, 0);
    const distance = Math.max(building.dimensions[0], building.dimensions[2]) * 1.2;
    camera.position.set(distance, focusY + distance * .95, distance * 1.1);
    const meshes: THREE.Object3D[] = [];
    floors.forEach((floor, index) => {
      const active = floor.level === selectedFloor;
      const group = new THREE.Group();
      group.position.y = index * spacing;
      const occupancy = estimatedOccupancy(floor, hour);
      const band = occupancyBand(occupancy);
      const { width, depth, desks, pods } = floorLayout(building, floor, occupancy);
      const color = band === 'quiet' ? '#adc78b' : band === 'moderate' ? '#ddb974' : '#d79b82';
      const slab = cuboid(group, [width, .45, depth], [0, 0, 0], color, active ? 1 : .12);
      slab.userData.floor = floor.level;
      meshes.push(slab);
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
      scene.traverse(item => { if (item instanceof THREE.Mesh) { item.geometry.dispose(); (item.material as THREE.Material).dispose(); } });
      renderer.dispose(); renderer.domElement.remove();
    };
  }, [building, selectedFloor, hour]);
  return <div className="floor-scene" ref={host} role="img" aria-label={`Rotatable furnished schematic of ${building.name}, floor ${selectedFloor}. Use the floor buttons to change levels.`} />;
}
