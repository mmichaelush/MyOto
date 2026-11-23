import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { strict as assert } from 'node:assert';
import { extname, resolve, sep } from 'node:path';
import { chromium } from 'playwright';
import resources from '../src/data/resources.json' with { type: 'json' };

const revision = execFileSync('git', ['rev-parse', 'origin/main'], {
  encoding: 'utf8',
}).trim();
const previous = execFileSync('git', ['show', revision + ':index.html']);
const root = resolve(process.argv[2] ?? 'dist');
const candidate = await readFile(resolve(root, 'index.html'));
const previousIcon = execFileSync('git', ['show', revision + ':favicon.ico']);
const mediaTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};
let active = 'candidate';
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  const send = (type, bytes) =>
    response
      .writeHead(200, { 'cache-control': 'no-store', 'content-type': type })
      .end(bytes);
  if (active === 'previous') {
    if (pathname === '/MyOto/') return send(mediaTypes['.html'], previous);
    if (pathname === '/MyOto/favicon.ico')
      return send(mediaTypes['.ico'], previousIcon);
  } else if (pathname.startsWith('/MyOto/')) {
    const asset = resolve(
      root,
      pathname.slice(7) + (pathname.endsWith('/') ? 'index.html' : ''),
    );
    const type = mediaTypes[extname(asset)];
    if (type && asset.startsWith(root + sep)) {
      const bytes = await readFile(asset).catch(() => undefined);
      if (bytes) return send(type, bytes);
    }
  }
  response.writeHead(404).end();
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
try {
  const base = 'http://127.0.0.1:' + server.address().port + '/MyOto/';
  const read = async (address) => {
    const response = await fetch(base + address);
    assert.equal(response.status, 200);
    return Buffer.from(await response.arrayBuffer());
  };
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.route(
      (url) => url.origin !== new URL(base).origin,
      async (route) => {
        const url = new URL(route.request().url());
        if (url.origin !== 'https://data.gov.il') return route.abort();
        const records =
          url.searchParams.get('resource_id') === resources.private_cars_1.id
            ? [
                {
                  mispar_rechev: 11234567,
                  tozeret_nm: 'Rollback',
                  kinuy_mishari: 'Vehicle',
                },
              ]
            : [];
        const body = { success: true, result: { records } };
        const callback = url.searchParams.get('callback');
        if (callback && /^\w+$/.test(callback))
          return route.fulfill({
            contentType: 'text/javascript',
            body: callback + '(' + JSON.stringify(body) + ');',
          });
        await route.fulfill({
          headers: { 'access-control-allow-origin': '*' },
          json: body,
        });
      },
    );
    for (const step of ['candidate', 'previous', 'candidate']) {
      active = step;
      assert.deepEqual(
        await read('?search=11234567'),
        step === 'candidate' ? candidate : previous,
      );
      await page.goto(base + '?search=11234567');
      if (step === 'candidate') {
        await page
          .locator('.vehicle-heading', { hasText: 'Rollback' })
          .waitFor();
        assert.deepEqual(
          await read('models/'),
          await readFile(resolve(root, 'models/index.html')),
        );
        assert.deepEqual(
          await read('myoto-32.png'),
          await readFile(resolve(root, 'myoto-32.png')),
        );
      } else {
        await page.locator('#resultsArea', { hasText: 'Rollback' }).waitFor();
        assert.deepEqual(await read('favicon.ico'), previousIcon);
        assert.equal((await fetch(base + 'models/')).status, 404);
      }
    }
  } finally {
    await browser.close();
  }
  console.log(
    JSON.stringify({
      revision,
      steps: ['candidate', 'previous', 'candidate'],
      result: 'ok',
    }),
  );
} finally {
  server.close();
}
