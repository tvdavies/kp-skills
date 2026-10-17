// Headless Chromium rendering: slide HTML to exact-size JPEG or PNG.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { PLUGIN_ROOT, runtimeDir, readJson, UserError } from './paths.mjs';

export function loadSizes() {
  return readJson(path.join(PLUGIN_ROOT, 'sizes.json')).sizes;
}

export function resolveSizes(spec) {
  const sizes = loadSizes();
  if (!spec || spec === 'default') return sizes.filter((s) => s.default);
  if (spec === 'all') return sizes;
  const ids = String(spec).split(/[,\s]+/).filter(Boolean);
  return ids.map((id) => {
    const s = sizes.find((x) => x.id === id);
    if (!s) throw new UserError(`Unknown size "${id}". Sizes: ${sizes.map((x) => x.id).join(', ')}`);
    return s;
  });
}

let playwrightCache;
export function loadPlaywright() {
  if (playwrightCache) return playwrightCache;
  const dir = runtimeDir();
  if (!process.env.PLAYWRIGHT_BROWSERS_PATH) process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(dir, 'browsers');
  const req = createRequire(path.join(dir, 'package.json'));
  try {
    playwrightCache = req('playwright');
  } catch (err) {
    throw new UserError(
      `The image renderer isn't installed yet (looked in ${dir}). ` +
        'Run the kp-help skill, or ask Tom to run setup.sh on this Mac.'
    );
  }
  return playwrightCache;
}

export const CHROMIUM_ARGS = [
  '--force-color-profile=srgb',
  '--font-render-hinting=none',
  '--disable-lcd-text',
  '--hide-scrollbars',
  '--disable-gpu',
  '--no-first-run',
  '--disable-extensions',
  '--disable-background-networking',
];

export async function withBrowser(fn) {
  const { chromium } = loadPlaywright();
  let browser;
  try {
    browser = await chromium.launch({ headless: true, args: CHROMIUM_ARGS });
  } catch (err) {
    throw new UserError(`The renderer's browser wouldn't start: ${err.message.split('\n')[0]}. Run the kp-help skill to repair it.`);
  }
  try {
    return await fn(browser);
  } finally {
    await browser.close();
  }
}

async function newPage(browser, size) {
  const context = await browser.newContext({
    viewport: { width: size.width, height: size.height },
    deviceScaleFactor: 1,
    locale: 'en-GB',
    timezoneId: 'Europe/London',
    colorScheme: 'light',
    reducedMotion: 'reduce',
    offline: true,
  });
  const page = await context.newPage();
  const blocked = [];
  // Slides must only use local files: block anything from the network.
  await page.route(/^(https?|wss?):/, (route) => {
    blocked.push(route.request().url());
    route.abort();
  });
  const consoleErrors = [];
  page.on('pageerror', (err) => consoleErrors.push(String(err.message || err)));
  return { context, page, blocked, consoleErrors };
}

/**
 * Render one HTML file at one size. Returns { file, report, blocked, errors }.
 * format: 'jpg' | 'png'. quality: JPEG quality (1-100).
 */
export async function renderSlide(browser, htmlFile, size, outFile, { format = 'jpg', quality = 95 } = {}) {
  const { context, page, blocked, consoleErrors } = await newPage(browser, size);
  try {
    const url = `${pathToFileURL(htmlFile).href}?size=${encodeURIComponent(size.id)}&render=1`;
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    try {
      await page.waitForSelector('html[data-kp-ready="1"]', { state: 'attached', timeout: 20000 });
    } catch {
      throw new UserError(`${path.basename(htmlFile)} never finished loading. Does it still link _kp/kp.js?`);
    }
    const report = await page.evaluate(() => window.__kpReport || null);
    const dims = await page.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }));
    if (dims.w !== size.width || dims.h !== size.height) throw new Error(`viewport is ${dims.w}x${dims.h}, expected ${size.width}x${size.height}`);
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    const shot = {
      path: outFile,
      type: format === 'png' ? 'png' : 'jpeg',
      clip: { x: 0, y: 0, width: size.width, height: size.height },
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    };
    if (shot.type === 'jpeg') shot.quality = quality;
    await page.screenshot(shot);
    return { file: outFile, report, blocked: [...new Set(blocked)], errors: consoleErrors };
  } finally {
    await context.close();
  }
}

/** Screenshot an arbitrary local HTML page (used for contact sheets). */
export async function screenshotPage(browser, htmlFile, outFile, { width = 1600, quality = 88 } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 100 }, deviceScaleFactor: 1, offline: true });
  const page = await context.newPage();
  try {
    await page.goto(pathToFileURL(htmlFile).href, { waitUntil: 'load' });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((i) => (i.decode ? i.decode().catch(() => {}) : null)));
    });
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    await page.screenshot({ path: outFile, fullPage: true, type: outFile.endsWith('.png') ? 'png' : 'jpeg', ...(outFile.endsWith('.png') ? {} : { quality }) });
  } finally {
    await context.close();
  }
}

/** Plain-English lines for a slide's render report. Empty when all is well. */
export function describeReport(label, result) {
  const lines = [];
  const r = result.report;
  if (!r) return [`${label}: no report from the slide (is kp.js linked?)`];
  for (const o of r.overflow) lines.push(`${label}: "${o.field}" doesn't fit (${o.note}). Shorten it, or allow a smaller size.`);
  for (const o of r.offCanvas) lines.push(`${label}: "${o.field}" runs off the edge by ${o.by}px.`);
  for (const p of r.missingPhotos) lines.push(`${label}: photo "${p.field}" is missing${p.src ? ` (${p.src} not found)` : ''}.`);
  for (const f of r.missingFonts) lines.push(`${label}: font "${f}" isn't available, so a fallback font was used. Add it with add-font.`);
  for (const u of result.blocked) lines.push(`${label}: blocked a request to the internet (${u}). Slides must use local files.`);
  for (const e of result.errors) lines.push(`${label}: script error: ${e}`);
  if (r.error) lines.push(`${label}: ${r.error}`);
  return lines;
}

export function describeNotes(label, result) {
  const r = result.report;
  if (!r) return [];
  const lines = [];
  for (const o of r.atMinimum) lines.push(`${label}: "${o.field}" is at its smallest size (${o.fontSize}px); it fits but a shorter version would read better.`);
  for (const o of r.nearEdge) lines.push(`${label}: "${o.field}" is ${o.gap}px from the edge (brand safe margin is 64px).`);
  return lines;
}
