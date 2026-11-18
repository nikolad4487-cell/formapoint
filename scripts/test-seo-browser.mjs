// Exercises the built application plus its real public HTML handler, without external services.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { chromium } from '@playwright/test';
import { createPublicHandler } from '../api/public.js';
import { fixture } from '../tests/seo/fixture.mjs';
const dist = resolve('dist');
const template = await readFile(resolve(dist, 'index.html'), 'utf8');
const environment = {};
const handler = createPublicHandler({
  load: async () => fixture(),
  template: async () => template,
  environment,
});
const mime = {
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain',
};
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  const file = resolve(dist, `.${path}`);
  if (file.startsWith(`${dist}/`) && path !== '/index.html') {
    try {
      if ((await stat(file)).isFile()) {
        res.setHeader('Content-Type', mime[extname(file)] || 'application/octet-stream');
        res.end(await readFile(file));
        return;
      }
    } catch {
      /* Public route, rather than an asset. */
    }
  }
  if (/^\/(app|admin|prijava|registracija)(\/|$)/.test(path)) {
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('X-Robots-Tag', 'noindex,nofollow');
    res.end(template);
  } else await handler(req, res);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
    (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
});
try {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    for (const javaScriptEnabled of [false, true]) {
      const context = await browser.newContext({ viewport, javaScriptEnabled });
      await context.route('**/*.supabase.co/**', async (route) => {
        const url = new URL(route.request().url());
        const table = url.pathname.split('/rest/v1/')[1];
        const data = fixture();
        let response = [];
        if (table === 'rpc/discount_banner') response = null;
        else if (table?.startsWith('site_settings')) response = data.settings;
        else if (table?.startsWith('content_pages'))
          response =
            data.pages.find((p) => url.searchParams.get('slug') === `eq.${p.slug}`) || null;
        else if (table?.startsWith('services')) response = data.services;
        else if (table?.startsWith('service_variants'))
          response = data.services.flatMap((s) => s.packages);
        else if (table?.startsWith('rpc/refresh_service_prices')) response = null;
        await route.fulfill({ json: response });
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const waitForApp = async () => {
        if (javaScriptEnabled)
          await page.waitForFunction(() => !document.getElementById('fp-public-data'));
      };
      let response = await page.goto(`${origin}/prezentacije/izrada`);
      assert.equal(response.status(), 200);
      await waitForApp();
      assert.equal(await page.locator('h1').textContent(), 'Izrada prezentacije');
      assert.match(await page.title(), /Izrada prezentacije/);
      assert.equal(
        await page.locator('link[rel=canonical]').getAttribute('href'),
        'https://www.formapoint.online/prezentacije/izrada',
      );
      assert.equal(await page.locator('meta[name=robots]').getAttribute('content'), 'index,follow');
      assert.match(await page.locator('body').innerText(), /20,00/);
      const graph = JSON.parse(await page.locator('#fp-jsonld').textContent())['@graph'];
      assert.equal(graph.find((item) => item['@type'] === 'Service').offers.price, '20.00');
      await page.goto(`${origin}/administracija/e-posta`);
      await waitForApp();
      assert.match(await page.locator('#paket-variant-1').innerText(), /70,00/);
      assert.match(await page.locator('#paket-variant-2').innerText(), /90,00/);
      assert.ok(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        'No horizontal overflow',
      );
      await page.goto(`${origin}/usluge`);
      await waitForApp();
      if (javaScriptEnabled) {
        await page
          .getByRole('navigation', { name: 'Kategorije usluga' })
          .getByRole('link', { name: 'Prezentacije', exact: true })
          .click();
        await page.waitForURL('**/prezentacije');
        await page.waitForFunction(() => document.title.includes('Prezentacije online'));
        assert.equal(await page.locator('h1').textContent(), 'Prezentacije');
        assert.equal(await page.locator('#fp-jsonld').count(), 1);
      }
      response = await page.goto(`${origin}/nepostojeca-stranica`);
      assert.equal(response.status(), 404);
      await waitForApp();
      assert.match(await page.locator('meta[name=robots]').getAttribute('content'), /noindex/);
      environment.VERCEL_ENV = 'preview';
      response = await page.goto(`${origin}/prezentacije/izrada`);
      await waitForApp();
      assert.match(response.headers()['x-robots-tag'], /noindex/);
      assert.match(await page.locator('meta[name=robots]').getAttribute('content'), /noindex/);
      assert.equal(await page.locator('#fp-jsonld').count(), 0);
      delete environment.VERCEL_ENV;
      assert.deepEqual(errors, []);
      console.log(
        `PASS ${viewport.width}px / JavaScript ${javaScriptEnabled ? 'enabled' : 'disabled'}: content, EUR, packages, canonical, navigation, 404 and preview noindex`,
      );
      await context.close();
    }
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
