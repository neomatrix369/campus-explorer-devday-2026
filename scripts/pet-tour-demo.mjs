import { chromium } from 'playwright-core';
import { mkdir, copyFile } from 'node:fs/promises';

const output = new URL('../demo-video/out/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] });
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: output.pathname, size: { width: 1280, height: 720 } },
});
const page = await context.newPage();
await page.goto(process.env.CAMPUS_URL ?? 'http://127.0.0.1:3100', { waitUntil: 'domcontentloaded' });
await page.locator('.scene-canvas canvas').waitFor();
await page.waitForTimeout(1500);
await page.getByRole('button', { name: /Follow Woolly/ }).click();
await page.getByText('Woolly is leading').waitFor();
await page.waitForTimeout(2600);
await page.getByRole('button', { name: 'Next tour stop' }).click();
await page.waitForTimeout(2600);
await page.getByRole('button', { name: 'Surprise me with a tour stop' }).click();
await page.waitForTimeout(2800);
await page.getByRole('button', { name: "Woolly's quiet pick" }).click();
await page.getByText('Woolly found a quiet spot').waitFor();
await page.waitForTimeout(3500);
await page.getByRole('button', { name: 'Resume tour' }).first().click();
await page.waitForTimeout(2600);
await page.getByRole('button', { name: 'Exit tour' }).click();
await page.waitForTimeout(1800);
const video = page.video();
await context.close();
if (!video) throw new Error('Browser video was not captured');
await copyFile(await video.path(), new URL('woolly-3d-tour.webm', output));
await browser.close();
console.log('Saved demo-video/out/woolly-3d-tour.webm');
