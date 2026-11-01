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

interface Footprint { left: number; right: number; top: number; bottom: number }

const CLEARANCE = 1.1;

function footprint(building: CampusBuilding): Footprint {
  const [x, z] = building.position;
  const [width, , depth] = building.dimensions;
  return { left: x - width / 2 - CLEARANCE, right: x + width / 2 + CLEARANCE, top: z - depth / 2 - CLEARANCE, bottom: z + depth / 2 + CLEARANCE };
}

function blocked(point: GroundPoint, walls: Footprint[]): boolean {
  return walls.some(wall => point.x > wall.left && point.x < wall.right && point.z > wall.top && point.z < wall.bottom);
}

function crossesWall(a: GroundPoint, b: GroundPoint, walls: Footprint[]): boolean {
  return walls.some(wall => a.x === b.x
    ? a.x > wall.left && a.x < wall.right && Math.max(a.z, b.z) > wall.top && Math.min(a.z, b.z) < wall.bottom
    : a.z > wall.top && a.z < wall.bottom && Math.max(a.x, b.x) > wall.left && Math.min(a.x, b.x) < wall.right);
}

function routeCost(a: GroundPoint, b: GroundPoint): number {
  const onRoad = a.x === b.x ? ROAD_X.includes(a.x) : ROAD_Z.includes(a.z);
  return Math.hypot(a.x - b.x, a.z - b.z) * (onRoad ? .45 : 1);
}

function compressRoute(points: GroundPoint[]): GroundPoint[] {
  const route: GroundPoint[] = [];
  for (const point of points) {
    const [before, last] = route.slice(-2);
    if (before && last && ((before.x === last.x && last.x === point.x) || (before.z === last.z && last.z === point.z))) route[route.length - 1] = point;
    else route.push(point);
  }
  return route;
}

/** Orthogonal walkways prefer streets and detour around every building footprint. */
export function streetRoute(start: GroundPoint, end: GroundPoint, buildings: readonly CampusBuilding[]): GroundPoint[] {
  const walls = buildings.map(footprint);
  const xs = [...new Set([start.x, end.x, ...ROAD_X, ...walls.flatMap(wall => [wall.left, wall.right])])].sort((a, b) => a - b);
  const zs = [...new Set([start.z, end.z, ...ROAD_Z, ...walls.flatMap(wall => [wall.top, wall.bottom])])].sort((a, b) => a - b);
  const nodes = xs.flatMap(x => zs.map(z => ({ x, z })));
  const allowed = nodes.map(point => !blocked(point, walls));
  const index = (x: number, z: number): number => x * zs.length + z;
  const origin = index(xs.indexOf(start.x), zs.indexOf(start.z));
  const goal = index(xs.indexOf(end.x), zs.indexOf(end.z));
  const distance = nodes.map((_, node) => node === origin ? 0 : Infinity);
  const previous = nodes.map(() => -1);
  const visited = new Set<number>();
  while (visited.size < nodes.length) {
    let current = -1;
    distance.forEach((cost, node) => { if (allowed[node] && !visited.has(node) && (current < 0 || cost < distance[current])) current = node; });
    if (current < 0 || !Number.isFinite(distance[current]) || current === goal) break;
    visited.add(current);
    const x = Math.floor(current / zs.length);
    const z = current % zs.length;
    for (const [nx, nz] of [[x - 1, z], [x + 1, z], [x, z - 1], [x, z + 1]]) {
      if (nx < 0 || nx >= xs.length || nz < 0 || nz >= zs.length) continue;
      const next = index(nx, nz);
      if (!allowed[next] || visited.has(next) || crossesWall(nodes[current], nodes[next], walls)) continue;
      const candidate = distance[current] + routeCost(nodes[current], nodes[next]);
      if (candidate < distance[next]) { distance[next] = candidate; previous[next] = current; }
    }
  }
  if (!Number.isFinite(distance[goal])) return [start];
  const path: GroundPoint[] = [];
  for (let node = goal; node !== -1; node = previous[node]) path.unshift(nodes[node]);
  return compressRoute(path);
}

/** A short, clear corridor from the nearest road-facing wall into the lobby. */
export function buildingInteriorRoute(building: CampusBuilding, access: GroundPoint): GroundPoint[] {
  const [x, z] = building.position;
  const [width, , depth] = building.dimensions;
  const alongX = Math.abs(access.x - x) - width / 2 > Math.abs(access.z - z) - depth / 2;
  const side = alongX ? Math.sign(access.x - x) || 1 : Math.sign(access.z - z) || 1;
  const half = alongX ? width / 2 : depth / 2;
  const point = (distance: number): GroundPoint => alongX ? { x: x + side * distance, z } : { x, z: z + side * distance };
  return [point(half + 2), point(half - 2), point(0)];
}
