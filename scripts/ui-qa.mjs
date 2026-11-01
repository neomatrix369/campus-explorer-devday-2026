/**
 * Author: CampusExplorer team
 * Created: 2026-11-01
 * Scope: Desktop/mobile core journey, exports, imports, keyboard focus and request invalidation.
 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';

const url = process.argv[2] ?? 'http://127.0.0.1:3001';
const out = process.argv[3] ?? `qa/${new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-')}`;
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] });
const results = [];

for (const width of [1280, 390]) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, acceptDownloads: true });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400 && !response.url().endsWith('/api/ai/tts')) errors.push(`${response.status()} ${response.url()}`); });
  await page.goto(url, { waitUntil: 'commit', timeout: 12000 });
  await page.waitForLoadState('domcontentloaded', { timeout: 12000 });
  try { await page.locator('.map-pin:visible').first().waitFor({ state: 'visible', timeout: 30000 }); }
  catch (error) {
    console.log(JSON.stringify({ width, errors, body: (await page.locator('body').innerText()).slice(0, 1000) }));
    await page.screenshot({ path: path.join(out, `failed-home-${width}.png`), timeout: 10000 });
    throw error;
  }
  const initial = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - innerWidth, canvas: Boolean(document.querySelector('canvas')), pins: document.querySelectorAll('.map-pin').length }));
  await page.screenshot({ path: path.join(out, `home-${width}.png`) });
  await page.getByRole('button', { name: 'LSE', exact: true }).click({ timeout: 10000 });
  const switched = await page.locator('.map-title strong').innerText();
  await page.getByRole('button', { name: 'UCL', exact: true }).click({ timeout: 10000 });

  if (width === 390) await page.getByRole('button', { name: 'Open study finder' }).click();
  const query = page.getByRole('textbox', { name: 'Ask for a study space' });
  await query.fill('quiet seat with charging and water');
  await query.press('Enter');
  await page.locator('.answer-card').waitFor({ state: 'visible' });
  const answer = await page.locator('.answer-card strong').innerText();
  await page.screenshot({ path: path.join(out, `finder-${width}.png`) });
  await page.getByRole('button', { name: 'Show in 3D' }).click();
  await page.getByRole('button', { name: 'Open floor explorer' }).click();
  await page.getByRole('dialog', { name: /floor explorer/ }).waitFor({ state: 'visible' });
  await page.screenshot({ path: path.join(out, `floor-${width}.png`) });
  // -- When -- Keyboard traversal must remain within the modal.
  for (let index = 0; index < 18; index++) {
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => Boolean(document.activeElement?.closest('[aria-modal="true"]'))), true, 'Focus escaped the floor dialog');
  }
  await page.keyboard.press('Escape');
  const closedByEscape = await page.getByRole('dialog', { name: /floor explorer/ }).count() === 0;
  // -- Then -- Validate outcomes, rather than only printing observations.
  assert.equal(initial.overflow, 0);
  assert.ok(initial.canvas && initial.pins > 0);
  assert.ok(switched.includes('LSE'));
  assert.ok(answer && !answer.includes('No exact match'));
  assert.ok(closedByEscape);
  // Scenario: New exploration controls work on both screen sizes.
  // Given a ready campus, when choosing London and View, then navigation and scene toggles remain usable.
  await page.getByRole('button', { name: 'Close building details' }).click();
  await page.getByRole('button', { name: 'London', exact: true }).click();
  await page.getByRole('dialog', { name: 'London overview' }).waitFor({ state: 'visible' });
  await page.locator('.london-map-frame[data-map-ready="true"]').waitFor({ timeout: 45000 });
  assert.equal(await page.locator('.campus-map-marker').count(), 7, 'London map needs all seven campus markers');
  await page.screenshot({ path: path.join(out, `london-${width}.png`) });
  await page.getByRole('button', { name: 'Explore UCL, UCL East' }).click();
  assert.equal(await page.locator('.app-shell').getAttribute('data-campus'), 'ucl-east');
  await page.getByRole('button', { name: 'View', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Trees', exact: true }).uncheck();
  await page.getByRole('checkbox', { name: 'Surrounding buildings', exact: true }).uncheck();
  await page.getByRole('button', { name: 'Night', exact: true }).click();
  assert.equal(await page.locator('.app-shell').getAttribute('data-phase'), 'night');
  await page.screenshot({ path: path.join(out, `view-${width}.png`) });
  await page.getByRole('button', { name: 'Day', exact: true }).click();
  await page.getByRole('button', { name: 'Close tools' }).click();
  await page.getByRole('button', { name: 'UCL', exact: true }).click();
  await page.getByRole('button', { name: 'Aerial', exact: true }).click();
  await page.getByRole('button', { name: 'Street', exact: true }).click();
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await page.getByRole('button', { name: 'Hide panels', exact: true }).click();
  assert.equal(await page.locator('.left-rail').isVisible(), false);
  await page.getByRole('button', { name: 'Show panels', exact: true }).click();
  let extras = null;
  if (width === 1280) {
    await page.getByRole('button', { name: 'Photos' }).click();
    await page.getByRole('button', { name: 'Capture view' }).click();
    await page.getByRole('button', { name: 'Download photo 1' }).waitFor({ state: 'visible' });
    const sheetEvent = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Contact sheet' }).click();
    const sheet = await sheetEvent;
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    const pdfEvent = page.waitForEvent('download');
    await page.getByRole('button', { name: /Vector PDF/ }).click();
    const pdf = await pdfEvent;
    const pdfBytes = await fs.readFile(await pdf.path());
    const geoEvent = page.waitForEvent('download');
    await page.getByRole('button', { name: /GeoJSON/ }).click();
    const geo = await geoEvent;
    const geoData = JSON.parse(await fs.readFile(await geo.path(), 'utf8'));
    await page.getByRole('button', { name: 'Map lab' }).click();
    await page.locator('#building-description').fill('Garden study hub');
    await page.getByRole('button', { name: 'Create illustrative 3D building' }).click();
    await page.getByText('Garden study hub added with three illustrative floors.').waitFor({ state: 'visible' });
    const importedPin = await page.locator('.map-pin[data-building-id^="custom-"]').count();
    const footprint = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { name: 'Polygon Study Annex' }, geometry: { type: 'Polygon', coordinates: [[[-0.134, 51.5246], [-0.1339, 51.5246], [-0.1339, 51.5245], [-0.134, 51.5245], [-0.134, 51.5246]]] } }] };
    await page.locator('#geojson-file').setInputFiles({ name: 'study-annex.geojson', mimeType: 'application/geo+json', buffer: Buffer.from(JSON.stringify(footprint)) });
    await page.getByText('1 polygon footprint added as schematic 3D buildings.').waitFor({ state: 'visible' });
    const polygonPin = await page.locator('.map-pin[data-building-id^="geo-"]').count();
    extras = { contactSheet: sheet.suggestedFilename(), pdf: pdf.suggestedFilename(), pdfValid: pdfBytes.subarray(0, 8).toString() === '%PDF-1.4', geoFeatures: geoData.features.length, importedPin, polygonPin };
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  assert.equal(overflow, 0, 'Page overflows horizontally');
  assert.deepEqual(errors, [], 'Browser errors detected');
  if (extras) assert.ok(extras.pdfValid && extras.geoFeatures === 6 && extras.importedPin === 1 && extras.polygonPin === 1);
  results.push({ width, initial, answer, closedByEscape, switched, overflow, extras, errors });
  console.log(JSON.stringify(results.at(-1)));
  await page.close();
}

// Scenario: A delayed answer cannot overwrite a different campus.
// Given an in-flight UCL request, when the student switches campus, then the old response is discarded.
const contextPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await contextPage.goto(url, { waitUntil: 'domcontentloaded' });
await contextPage.locator('.map-pin:visible').first().waitFor({ state: 'visible', timeout: 30000 });
let release;
let arrived;
let finished;
const gate = new Promise(resolve => { release = resolve; });
const intercepted = new Promise(resolve => { arrived = resolve; });
const fulfilled = new Promise(resolve => { finished = resolve; });
await contextPage.route('**/api/ai/concierge', async route => {
  arrived();
  await gate;
  await route.fulfill({ json: { headline: 'Stale UCL answer', explanation: 'Delayed test answer', match: null, criteria: [], source: 'local', costUsd: 0 } }).catch(() => undefined);
  finished();
});
const contextQuery = contextPage.getByRole('textbox', { name: 'Ask for a study space' });
await contextQuery.fill('quiet with charging');
await contextQuery.press('Enter');
await intercepted;
await contextPage.getByRole('button', { name: 'LSE', exact: true }).click();
release();
await fulfilled;
assert.equal(await contextPage.locator('.answer-card').count(), 0, 'A stale recommendation survived the campus switch');
await contextPage.unroute('**/api/ai/concierge');
await contextPage.getByRole('button', { name: 'UCL', exact: true }).click();
await contextQuery.fill('group of 50 with charging and water');
await contextQuery.press('Enter');
assert.equal(await contextPage.locator('.answer-card strong').innerText(), 'No exact match found');
await contextQuery.fill('quiet at UCL East at 2 AM for 2 hours');
await contextQuery.press('Enter');
assert.equal(await contextPage.locator('.app-shell').getAttribute('data-campus'), 'ucl-east');
assert.equal(await contextPage.getByRole('slider', { name: 'Preview hour' }).inputValue(), '2');
await contextPage.getByRole('slider', { name: 'Preview hour' }).fill('14');
assert.equal(await contextPage.locator('.answer-card').count(), 0, 'Time change retained an old answer');

// Scenario: Bundled ElevenLabs audio starts from a user gesture and needs no runtime generation.
// Given the View controls, when starting the tour, then the recorded narration loads successfully.
await contextPage.getByRole('button', { name: 'View', exact: true }).click();
const audioResponse = contextPage.waitForResponse(response => response.url().includes('/audio/tour-1.mp3'));
await contextPage.getByRole('button', { name: 'Start guided tour', exact: true }).click();
const audio = await audioResponse;
assert.ok(audio.ok(), 'Tour MP3 failed to load');
assert.ok((await audio.body()).byteLength > 1000, 'Tour MP3 is empty');
await contextPage.getByRole('button', { name: 'Pause tour', exact: true }).first().click();
await contextPage.getByRole('button', { name: 'Exit tour', exact: true }).click();
const ambienceResponse = contextPage.waitForResponse(response => response.url().includes('/audio/lofi.mp3'));
await contextPage.getByRole('button', { name: 'Sound: off. Change soundscape' }).click();
assert.ok((await ambienceResponse).ok());
await contextPage.getByRole('button', { name: 'Sound: lofi. Change soundscape' }).click();
await contextPage.getByRole('button', { name: 'Sound: rain. Change soundscape' }).click();
console.log(JSON.stringify({ requestInvalidation: 'passed', exactMatch: 'passed', explicitTimeAndCampus: 'passed', elevenLabsAssets: 'loaded' }));
await contextPage.close();

await browser.close();
console.log(JSON.stringify({ out, results }, null, 2));
