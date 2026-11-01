/**
 * Author: CampusExplorer team
 * Created: 2026-11-01
 * Scope: Woolly's collision-free routes through schematic campus streets.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ALL_BUILDINGS, UNIVERSITIES } from '../data/campusData.ts';
import { buildingInteriorRoute, roadAccess, streetRoute, type GroundPoint } from './petRoute.ts';

function crossesBuilding(a: GroundPoint, b: GroundPoint, building: typeof ALL_BUILDINGS[number]): boolean {
  const [x, z] = building.position;
  const [width, , depth] = building.dimensions;
  const left = x - width / 2;
  const right = x + width / 2;
  const top = z - depth / 2;
  const bottom = z + depth / 2;
  return a.x === b.x
    ? a.x > left && a.x < right && Math.max(a.z, b.z) > top && Math.min(a.z, b.z) < bottom
    : a.z > top && a.z < bottom && Math.max(a.x, b.x) > left && Math.min(a.x, b.x) < right;
}

/** Scenario: A building blocks a direct street crossing. Slice: realistic pet navigation.
 * Given a building between Woolly and a doorway, when she plans a route, then she walks around its footprint. */
test('Woolly detours around a blocking building', () => {
  // -- Given --
  const building = { ...ALL_BUILDINGS[0], position: [0, 0] as [number, number], dimensions: [20, 12, 20] as [number, number, number] };
  const start = { x: -30, z: 0 };
  const end = { x: 30, z: 0 };
  // -- When --
  const route = streetRoute(start, end, [building]);
  // -- Then --
  assert.deepEqual(route[0], start);
  assert.deepEqual(route.at(-1), end);
  assert.ok(route.length > 2);
  assert.ok(route.slice(1).every((point, index) => !crossesBuilding(route[index], point, building)));
});

/** Scenario: Every bundled campus entrance is reachable. Slice: sheep-led campus tour.
 * Given all eight campus layouts, when Woolly walks from the spawn and between entrances, then she reaches each doorway without crossing another building. */
test('all campus doorways have routes clear of building footprints', () => {
  // -- Given --
  const campuses = UNIVERSITIES.flatMap(university => university.campuses);
  // -- When --
  const routes = campuses.flatMap(campus => {
    const entries = campus.buildings.map(building => buildingInteriorRoute(building, roadAccess(building))[0]);
    return entries.flatMap(end => [{ campus, start: { x: -13, z: 61 }, end }, ...entries.map(start => ({ campus, start, end }))]);
  });
  // -- Then --
  for (const { campus, start, end } of routes) {
    const route = streetRoute(start, end, campus.buildings);
    assert.deepEqual(route.at(-1), end, `${campus.id}: doorway unreachable`);
    assert.ok(route.slice(1).every((point, index) => campus.buildings.every(building => !crossesBuilding(route[index], point, building))), `${campus.id}: route crossed a building`);
  }
});
