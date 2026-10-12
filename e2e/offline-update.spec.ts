import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';

// The previous release's worker lifecycle: cache-first reads, no skipWaiting.
const legacyWorker = `
const prefix = 'science-quiz-' + new URL(self.registration.scope).pathname;
const cacheName = prefix + 'legacy';
const url = path => new URL(path, self.registration.scope).href;
self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll([
    url('index.html'), url('science/earth/questions.json')
  ])));
});
self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.registration.scope)) return;
  const path = event.request.mode === 'navigate' ? url('index.html') : event.request.url;
  event.respondWith(caches.open(cacheName).then(async cache => (await cache.match(path)) || fetch(event.request)));
});
`;

// Only the legacy shell is reduced; it uses the real production worker and bank after upgrade.
const legacyHtml = `<!doctype html><html lang="zh"><head><meta charset="utf-8"></head><body>
<h1>地球与宇宙：20 题</h1><p>正在练习第 1 题</p>
<script>navigator.serviceWorker.register('./sw.js');</script>
</body></html>`;

test('旧版20题升级：保持旧标签页和答题，不等待关闭，刷新获得252题且保留本地记录', async ({
  page,
  context,
}) => {
  const base = process.env.TEST_BASE_PATH ?? '/';
  const bankPath = 'science/earth/questions.json';
  const currentBank = JSON.parse(await readFile(join('dist', bankPath), 'utf8'));
  const legacyBank = JSON.stringify({
    ...currentBank,
    questions: currentBank.questions.filter((q: { id: string }) => !q.id.startsWith('astronomy-')),
  });
  let upgraded = false;
  const server = createServer(async (request, response) => {
    const path = new URL(request.url!, 'http://localhost').pathname;
    if (!path.startsWith(base)) {
      response.writeHead(404).end();
      return;
    }
    const file = path.slice(base.length) || 'index.html';
    const contentType = file.endsWith('.js')
      ? 'text/javascript'
      : file.endsWith('.json')
        ? 'application/json'
        : file.endsWith('.css')
          ? 'text/css'
          : file.endsWith('.png')
            ? 'image/png'
            : 'text/html';
    try {
      const content =
        !upgraded && file === 'sw.js'
          ? legacyWorker
          : !upgraded && file === 'index.html'
            ? legacyHtml
            : !upgraded && file === bankPath
              ? legacyBank
              : await readFile(join('dist', file));
      // Banks may remain in the browser HTTP cache across a deployment.
      response
        .writeHead(200, {
          'Content-Type': contentType,
          'Cache-Control': file === bankPath ? 'max-age=3600' : 'no-cache',
        })
        .end(content);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}${base}`;
  try {
    await page.goto(url);
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    const other = await context.newPage();
    await other.goto(url);
    await expect(other.getByRole('heading', { name: '地球与宇宙：20 题' })).toBeVisible();
    await page.evaluate(async () => {
      localStorage.setItem('science-quiz-practice-count-v1', '7');
      localStorage.setItem(
        'science-quiz-progress-v1',
        JSON.stringify({
          version: 1,
          syncKey: 'a'.repeat(64),
          revision: 1,
          syncedRevision: 0,
          records: {
            'science-161': {
              id: 'science-161',
              topic: 'sound',
              attempts: 1,
              wrongCount: 1,
              lastResult: false,
              lastAttemptAt: '2026-10-12T08:00:00Z',
              lastWrongAt: '2026-10-12T08:00:00Z',
            },
          },
        }),
      );
      await (await caches.open('unrelated-app')).put('/keep', new Response('keep'));
    });
    const progressBefore = await page.evaluate(() =>
      localStorage.getItem('science-quiz-progress-v1'),
    );
    upgraded = true;
    await page.evaluate(async () => {
      await (await navigator.serviceWorker.ready).update();
    });
    await expect
      .poll(
        async () =>
          page.evaluate(async () => {
            const bank = await (await fetch('./science/earth/questions.json')).json();
            return bank.questions.length;
          }),
        { timeout: 10000 },
      )
      .toBe(252);
    // Claiming a new worker must not navigate/reload a learner's current exercise.
    await expect(other.getByText('正在练习第 1 题')).toBeVisible();
    await expect(other.getByRole('heading', { name: '地球与宇宙：20 题' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: '今天想挑战什么？' })).toBeVisible();
    await expect(page.getByRole('button', { name: '练习设置' })).toBeVisible();
    await page.getByRole('button', { name: '开始挑战：地球与宇宙', exact: true }).click();
    await expect(page.getByText('252', { exact: true })).toBeVisible();
    await expect(page.getByText('每次练习 7 题', { exact: false })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('science-quiz-progress-v1'))).toBe(
      progressBefore,
    );
    expect(await page.evaluate(() => caches.has('unrelated-app'))).toBe(true);
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('heading', { name: '今天想挑战什么？' })).toBeVisible();
    await page.getByRole('button', { name: '开始挑战：地球与宇宙', exact: true }).click();
    await expect(page.getByText('252', { exact: true })).toBeVisible();
  } finally {
    await context.setOffline(false);
    await context.close();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
