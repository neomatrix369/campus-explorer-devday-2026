import type { CampusBuilding, FloorZone } from '../data/campusData.ts';

export interface FloorLayout {
  width: number;
  depth: number;
  pods: { x: number; z: number }[];
  desks: { x: number; z: number; group: boolean; occupied: boolean }[];
}

/** One illustrative furniture layout shared by the 2D plan and 3D cutaway. */
export function floorLayout(building: CampusBuilding, floor: FloorZone, occupancy: number): FloorLayout {
  const width = building.dimensions[0];
  const depth = building.dimensions[2];
  const group = floor.type === 'Group';
  const hasPods = /group rooms/i.test(floor.name);
  const columns = group ? 3 : 5;
  const rows = group ? 3 : 4;
  const count = Math.min(columns * rows, Math.ceil(floor.seats / (group ? 4 : 1)));
  const desks = Array.from({ length: count }, (_, index) => ({
    x: -width * .32 + (index % columns) * width * (hasPods ? .42 : .64) / (columns - 1),
    z: -depth * .22 + Math.floor(index / columns) * depth * .54 / (rows - 1),
    group,
    occupied: index < Math.round(count * occupancy / 100),
  }));
  const pods = hasPods ? [-.15, .12, .39].map(offset => ({ x: width * .34, z: depth * offset })) : [];
  return { width, depth, desks, pods };
}
