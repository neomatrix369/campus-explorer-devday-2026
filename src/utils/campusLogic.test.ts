/**
 * Author: CampusExplorer team
 * Created: 2026-11-01
 * Scope: Campus data, time-based study ranking, and portable exports.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ALL_BUILDINGS, UNIVERSITIES } from '../data/campusData.ts';
import { estimatedOccupancy, formatHour, isOpenAt, parseStudyQuery, rankStudySpaces, recommendStudySpot } from './campusLogic.ts';
import { campusGeoJson, campusPdf, parseBlueprint } from './mapExports.ts';

/** Scenario: The first-run map covers London. Slice: multi-university exploration.
 * Given the bundled campus profiles, when they are counted, then all four universities and seven campuses have 27 selectable buildings. */
test('bundled campuses provide four universities, seven campuses and 27 buildings', () => {
  // -- Given --
  const campuses = UNIVERSITIES.flatMap(university => university.campuses);
  // -- When --
  const counts = [UNIVERSITIES.length, campuses.length, ALL_BUILDINGS.length];
  // -- Then --
  assert.deepEqual(counts, [4, 7, 27]);
});

/** Scenario: A time slider wraps across midnight. Slice: time preview.
 * Given hours outside the clock range, when formatted, then they display a valid 24-hour time. */
test('hour formatting wraps before and after midnight', () => {
  // -- Given --
  const hours = [-.5, 24.5];
  // -- When --
  const labels = hours.map(formatHour);
  // -- Then --
  assert.deepEqual(labels, ['23:30', '00:30']);
});

/** Scenario: Overnight access crosses midnight. Slice: study access.
 * Given a building open from 20:00 to 04:00, when checking 02:00 and 12:00, then only 02:00 is open. */
test('overnight opening hours cross midnight correctly', () => {
  // -- Given --
  const building = { ...ALL_BUILDINGS[0], hours: [20, 4] as [number, number] };
  // -- When --
  const status = [isOpenAt(building, 2), isOpenAt(building, 12)];
  // -- Then --
  assert.deepEqual(status, [true, false]);
});

/** Scenario: A seat estimate changes with the selected hour. Slice: simulated occupancy.
 * Given the same study floor, when comparing 14:00 and 02:00, then midday is more occupied. */
test('occupancy estimates are higher during the day than at night', () => {
  // -- Given --
  const floor = ALL_BUILDINGS[0].floors[1];
  // -- When --
  const day = estimatedOccupancy(floor, 14);
  const night = estimatedOccupancy(floor, 2);
  // -- Then --
  assert.ok(day > night);
});

/** Scenario: Closed buildings are excluded. Slice: quiet finder.
 * Given an evening hour and a building with daytime access, when ranking, then that building is absent. */
test('study ranking excludes buildings that are closed', () => {
  // -- Given --
  const building = ALL_BUILDINGS[0];
  // -- When --
  const ranked = rankStudySpaces([building], 2);
  // -- Then --
  assert.equal(ranked.length, 0);
});

/** Scenario: Spoken preferences become filters. Slice: study concierge.
 * Given a group request for charging and water, when parsed, then all three needs are retained. */
test('study query extracts group size and amenities', () => {
  // -- Given --
  const query = 'Group of 4 with charging and water';
  // -- When --
  const preference = parseStudyQuery(query);
  // -- Then --
  assert.deepEqual([preference.type, preference.minSeats, preference.sockets, preference.water], ['Group', 4, true, true]);
});

/** Scenario: Quiet results explain their estimate. Slice: recommendation.
 * Given an open campus and a quiet request, when recommended, then the answer identifies a selectable floor and labels its estimates. */
test('local recommendation points to a real floor and explains estimates', () => {
  // -- Given --
  const buildings = UNIVERSITIES[0].campuses[0].buildings;
  // -- When --
  const answer = recommendStudySpot('quiet with charging', buildings, 16);
  // -- Then --
  assert.ok(answer.match && answer.explanation.includes('estimated') && buildings.includes(answer.match.building));
});

/** Scenario: Students can carry the schematic away. Slice: map exports.
 * Given a campus, when exporting, then the PDF opens as PDF 1.4 and GeoJSON contains one polygon per building. */
test('PDF and GeoJSON exports contain the current campus buildings', () => {
  // -- Given --
  const university = UNIVERSITIES[0];
  const campus = university.campuses[0];
  // -- When --
  const pdf = campusPdf(university, campus, 16);
  const geo = campusGeoJson(campus) as { features: object[] };
  // -- Then --
  assert.ok(new TextDecoder().decode(pdf).startsWith('%PDF-1.4') && pdf.byteLength > 1200 && geo.features.length === campus.buildings.length);
});

/** Scenario: A map lab input becomes selectable geometry. Slice: blueprint import.
 * Given a valid minimal JSON building, when parsed, then it has a usable default floor and is marked schematic. */
test('blueprint parser creates a bounded schematic building', () => {
  // -- Given --
  const raw = JSON.stringify({ name: 'Test Study Annex', position: [200, 0], dimensions: [4, 99, 4] });
  // -- When --
  const building = parseBlueprint(raw, 3);
  // -- Then --
  assert.deepEqual([building.position[0], building.dimensions, building.floors.length, building.schematic], [70, [8, 45, 8], 1, true]);
});
