import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
async function list(dir = 'dist', prefix = '') {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = prefix + entry.name;
    if (entry.isDirectory()) result.push(...(await list(`${dir}/${entry.name}`, `${path}/`)));
    else if (entry.name !== 'sw.js') result.push(path);
  }
  return result;
}
const files = (await list()).sort();
const hash = createHash('sha256');
for (const file of files) hash.update(await readFile(`dist/${file}`));
const version = hash.digest('hex').slice(0, 12);
await writeFile(
  'dist/sw.js',
  `
const prefix = 'science-quiz-' + new URL(self.registration.scope).pathname;
const cacheName = prefix + '${version}';
const files = ${JSON.stringify(files)};
const url = path => new URL(path, self.registration.scope).href;
self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(files.map(url))));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(prefix) && key !== cacheName).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.registration.scope)) return;
  const path = event.request.mode === 'navigate' ? url('index.html') : event.request.url;
  event.respondWith(caches.open(cacheName).then(async cache => (await cache.match(path)) || fetch(event.request)));
});
`,
);
console.log(`离线缓存已生成：${files.length} 个文件。`);
