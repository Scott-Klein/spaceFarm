// Real-browser verification, driven by Playwright against a throwaway Vite dev server.
//
//   node tools/starmap/browser.mjs [parity] [view] [timing]     (no arguments = parity + view)
//
//   parity  the module's pixels in Chromium are byte-identical to the Node harness, so
//           what render.mjs shows is exactly what the browser will produce
//   view    the tuning view at /star: a control for every option, edits reach the
//           overrides, old / new toggle, sphere mode; screenshots are saved
//   timing  how long 8192x4096 takes in an actual worker, old generator and new
//
// Needs the Playwright browser once: npx playwright install chromium
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { OUT, loadGenerator } from './shim.mjs';

const want = new Set(process.argv.slice(2));
const on = (name) => (want.size ? want.has(name) : name !== 'timing');
const out = path.join(OUT, 'browser');
fs.mkdirSync(out, { recursive: true });

const { makeStarMap, STAR_MAP_RANGES } = await loadGenerator();
const root = path.resolve(import.meta.dirname, '../..');
const server = await createServer({
  root,
  logLevel: 'error',
  server: { port: 5199, strictPort: true, host: '127.0.0.1' },
});
await server.listen();
const base = 'http://127.0.0.1:5199';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
let failed = 0;
const report = (ok, text) => {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${text}`);
};
const finished = (which = '\\w+') =>
  page.waitForFunction((w) => new RegExp(`\\(${w}\\) in [\\d.]+s`).test(document.body.innerText), which, {
    timeout: 300000,
  });
const status = () => page.locator('aside p').first().innerText();

try {
  if (on('parity')) {
    await page.goto(base + '/');
    for (const o of [{ size: 1024 }, { size: 1024, seed: 3, band: { tilt: 60, node: 25 } }]) {
      const inBrowser = await page.evaluate(async (opts) => {
        const m = await import('/src/engine/stars/starMap.ts');
        const cv = m.makeStarMap(opts);
        const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
        const h = await crypto.subtle.digest('SHA-1', d);
        return {
          hash: [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join(''),
          real: cv instanceof OffscreenCanvas,
        };
      }, o);
      const inNode = crypto.createHash('sha1').update(makeStarMap(o).pixels).digest('hex');
      report(
        inBrowser.real && inBrowser.hash === inNode,
        `parity ${JSON.stringify(o)}: Chromium ${inBrowser.hash.slice(0, 12)} / Node ${inNode.slice(0, 12)}`,
      );
    }
  }

  if (on('view')) {
    await page.goto(base + '/star');
    await page.evaluate(() => localStorage.removeItem('starPreview.overrides'));
    await page.reload();
    await finished('new');
    console.log('      view loaded:', await status());

    let expected = 0;
    const count = (node, top) => {
      for (const [k, v] of Object.entries(node)) {
        if ('min' in v && 'value' in v) expected += top && k === 'size' ? 0 : 1;
        else count(v, false);
      }
    };
    count(STAR_MAP_RANGES, true);
    const rows = await page.locator('details > div').count();
    report(rows === expected, `a control for every option: ${rows} of ${expected} (+ the size select)`);
    await page.screenshot({ path: path.join(out, 'view_new.png') });

    // edit one field through the UI: it must reach the overrides, storage and a re-render
    await page.locator('summary', { hasText: /^\s*dust\s*$/ }).click();
    const row = page.locator('details > div', { has: page.locator('button', { hasText: /^\s*tauMax\s*$/ }) });
    await row.locator('input[type=number]').fill('1.5');
    await row.locator('input[type=number]').dispatchEvent('change');
    await page.waitForFunction(() => /Generating/.test(document.body.innerText), null, { timeout: 5000 });
    await finished('new');
    const text = (await page.locator('textarea').inputValue()).replace(/\s+/g, '');
    const stored = await page.evaluate(() => localStorage.getItem('starPreview.overrides'));
    report(text === '{"dust":{"tauMax":1.5}}' && stored === text, `edit reaches overrides and storage: ${text}`);
    await page.locator('button', { hasText: 'Reset all' }).click();
    await finished('new');

    await page.locator('button', { hasText: 'On the sphere' }).click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(out, 'view_sphere.png') });

    await page.locator('button', { hasText: 'Old generator' }).click();
    await finished('old');
    report(true, `old generator behind the toggle: ${await status()}`);
    await page.locator('button', { hasText: '1:1' }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(out, 'view_old.png') });
    console.log(`      screenshots in ${out}`);
  }

  if (on('timing')) {
    await page.goto(base + '/star');
    await finished();
    for (const which of ['new', 'old']) {
      await page.locator('button', { hasText: which === 'new' ? 'New generator' : 'Old generator' }).click();
      await page.locator('select').selectOption('8192');
      await page.waitForFunction(
        (w) => new RegExp(`8192x4096 \\(${w}\\) in [\\d.]+s`).test(document.body.innerText),
        which,
        { timeout: 600000 },
      );
      console.log('      8K in a Chromium worker:', await status());
      await page.locator('select').selectOption('2048');
      await finished(which);
    }
  }
  report(errors.length === 0, errors.length ? `page errors:\n${errors.join('\n')}` : 'no page errors');
} finally {
  await browser.close();
  await server.close();
}
process.exit(failed ? 1 : 0);
