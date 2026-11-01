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
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  results.push({ width, initial, answer, closedByEscape, switched, overflow, errors });
  console.log(JSON.stringify(results.at(-1)));
  await page.close();
}

await browser.close();
console.log(JSON.stringify({ out, results }, null, 2));
