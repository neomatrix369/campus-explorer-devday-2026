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
  try { await page.locator('.map-pin').first().waitFor({ state: 'visible', timeout: 10000 }); }
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
  await page.keyboard.press('Escape');
  const closedByEscape = await page.getByRole('dialog', { name: /floor explorer/ }).count() === 0;
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
  results.push({ width, initial, answer, closedByEscape, switched, overflow, extras, errors });
  console.log(JSON.stringify(results.at(-1)));
  await page.close();
}

await browser.close();
console.log(JSON.stringify({ out, results }, null, 2));
