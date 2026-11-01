import type { CampusBuilding } from '../data/campusData.ts';

export interface GroundPoint { x: number; z: number }

const ROAD_X = [-70, -13, 64];
const ROAD_Z = [-65, -6, 61];

export function roadAccess(building: CampusBuilding): GroundPoint {
  const [x, z] = building.position;
  const [width, , depth] = building.dimensions;
  const candidates = [
    ...ROAD_X.filter(road => Math.abs(road - x) > width / 2 + 4).map(road => ({ x: road, z })),
    ...ROAD_Z.filter(road => Math.abs(road - z) > depth / 2 + 4).map(road => ({ x, z: road })),
  ];
  const fallback = [...ROAD_X.map(road => ({ x: road, z })), ...ROAD_Z.map(road => ({ x, z: road }))];
  return (candidates.length ? candidates : fallback).sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0];
}

function shareRoad(a: GroundPoint, b: GroundPoint): boolean {
  return (Math.abs(a.x - b.x) < .01 && ROAD_X.includes(a.x)) || (Math.abs(a.z - b.z) < .01 && ROAD_Z.includes(a.z));
}

export function streetRoute(start: GroundPoint, end: GroundPoint): GroundPoint[] {
  const nodes = [start, end, ...ROAD_X.flatMap(x => ROAD_Z.map(z => ({ x, z })))];
  const distance = nodes.map((_, index) => index ? Infinity : 0);
  const previous = nodes.map(() => -1);
  const visited = new Set<number>();
  while (visited.size < nodes.length) {
    let current = -1;
    distance.forEach((value, index) => { if (!visited.has(index) && (current < 0 || value < distance[current])) current = index; });
    if (current < 0 || !Number.isFinite(distance[current]) || current === 1) break;
    visited.add(current);
    nodes.forEach((next, index) => {
      if (visited.has(index) || !shareRoad(nodes[current], next)) return;
      const candidate = distance[current] + Math.hypot(next.x - nodes[current].x, next.z - nodes[current].z);
      if (candidate < distance[index]) { distance[index] = candidate; previous[index] = current; }
    });
  }
  if (!Number.isFinite(distance[1])) return [start, end];
  const route: GroundPoint[] = [];
  for (let node = 1; node !== -1; node = previous[node]) route.unshift(nodes[node]);
  return route;
}
