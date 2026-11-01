/**
 * Author: CampusExplorer team
 * Created: 2026-11-01
 * Scope: Campus data, time-based study ranking, and portable exports.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ALL_BUILDINGS, UNIVERSITIES } from '../data/campusData.ts';
import { estimatedOccupancy, formatHour, isOpenAt, parseStudyQuery, rankStudySpaces, recommendStudySpot } from './campusLogic.ts';
import { campusGeoJson, campusPdf, parseBlueprint, synthesizeBlueprint } from './mapExports.ts';

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

/** Scenario: Map lab inputs become selectable geometry. Slice: blueprint import.
 * Given JSON and a written building description, when parsed, then both create bounded schematic buildings and the description has three floors. */
test('blueprint parser creates a bounded schematic building', () => {
  // -- Given --
  const raw = JSON.stringify({ name: 'Test Study Annex', position: [200, 0], dimensions: [4, 99, 4] });
  // -- When --
  const building = parseBlueprint(raw, 3);
  const described = synthesizeBlueprint('Garden study hub', 4);
  // -- Then --
  assert.deepEqual([building.position[0], building.dimensions, building.floors.length, building.schematic], [70, [8, 45, 8], 1, true]);
  assert.deepEqual([described.name, described.floors.length, described.schematic], ['Garden study hub', 3, true]);
});

/** Scenario: Impossible requests stay impossible. Slice: trustworthy recommendations.
 * Given a group larger than any available room, when asking for water and charging, then no unrelated floor is suggested. */
test('recommendations never silently relax hard requirements', () => {
  // -- Given --
  const buildings = UNIVERSITIES[0].campuses[0].buildings;
  // -- When --
  const result = recommendStudySpot('group of 50 with charging and water', buildings, 16);
  // -- Then --
  assert.equal(result.match, null);
});

/** Scenario: Duration and group size are different needs. Slice: study planning.
 * Given two hours of solo study at 2 AM, when parsed, then one seat, two hours and 02:00 are retained. */
test('duration is not interpreted as a group size', () => {
  // -- Given --
  const query = 'quiet study for 2 hours at 2 AM';
  // -- When --
  const result = parseStudyQuery(query);
  // -- Then --
  assert.deepEqual([result.minSeats, result.durationHours, result.startHour], [1, 2, 2]);
});

/** Scenario: A student needs the whole study session. Slice: study planning.
 * Given a building closing at 17:00, when requesting four hours at 16:30, then it is excluded. */
test('recommendations require opening hours to cover the full duration', () => {
  // -- Given --
  const building = { ...ALL_BUILDINGS[0], hours: [8, 17] as [number, number] };
  // -- When --
  const result = recommendStudySpot('quiet for 4 hours', [building], 16.5);
  // -- Then --
  assert.equal(result.match, null);
});

/** Scenario: Quiet work can use silent areas. Slice: study finder.
 * Given a silent study floor, when asking for quiet, then it remains eligible. */
test('quiet requests include silent study floors', () => {
  // -- Given --
  const building = { ...ALL_BUILDINGS[0], floors: ALL_BUILDINGS[0].floors.filter(floor => floor.type === 'Silent') };
  // -- When --
  const result = rankStudySpaces([building], 16, { type: 'Quiet' });
  // -- Then --
  assert.ok(result.length > 0);
});

/** Scenario: Explicit time overrides the preview. Slice: study planning.
 * Given a daytime-only building and a 16:00 preview, when asking for 02:00, then no daytime result is returned. */
test('explicit requested time controls recommendations', () => {
  // -- Given --
  const building = { ...ALL_BUILDINGS[0], hours: [8, 17] as [number, number] };
  // -- When --
  const result = recommendStudySpot('quiet at 2 AM', [building], 16);
  // -- Then --
  assert.equal(result.match, null);
});

/** Scenario: Imported maps survive export. Slice: map portability.
 * Given a polygon with a courtyard, height and floor count, when imported and exported, then its source geometry and properties are retained. */
test('GeoJSON round trips geometry, holes and metadata', async () => {
  // -- Given --
  const { parseGeoJsonBuildings } = await import('./mapExports.ts');
  const feature = { type: 'Feature', properties: { name: 'Courtyard', height: 30, 'building:levels': 6, source: 'user survey' }, geometry: { type: 'Polygon', coordinates: [[[-.134, 51.524], [-.133, 51.524], [-.133, 51.525], [-.134, 51.524]], [[-.1338, 51.5241], [-.1336, 51.5241], [-.1336, 51.5242], [-.1338, 51.5241]]] } };
  // -- When --
  const buildings = parseGeoJsonBuildings(JSON.stringify({ type: 'FeatureCollection', features: [feature] }), 0);
  const exported = campusGeoJson({ ...UNIVERSITIES[0].campuses[0], buildings }) as { features: typeof feature[] };
  // -- Then --
  assert.deepEqual([exported.features[0].geometry, exported.features[0].properties, buildings[0].dimensions[1], buildings[0].floors.length], [feature.geometry, feature.properties, 30, 6]);
});

/** Scenario: A building footprint is not evidence of study access. Slice: truthful imports.
 * Given geometry without verified study data, when ranking spaces, then it is excluded from study recommendations. */
test('imported geometry does not invent available study seats', async () => {
  // -- Given --
  const { parseGeoJsonBuildings } = await import('./mapExports.ts');
  const input = { type: 'FeatureCollection', features: [{ geometry: { type: 'Polygon', coordinates: [[[0, 0], [.001, 0], [.001, .001], [0, 0]]] } }] };
  // -- When --
  const buildings = parseGeoJsonBuildings(JSON.stringify(input), 0);
  // -- Then --
  assert.deepEqual(rankStudySpaces(buildings, 12), []);
});
