import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateBank, validateManifest } from '../src/engine/content';
const root = resolve('content');
const manifest = validateManifest(
  JSON.parse(await readFile(resolve(root, 'manifest.json'), 'utf8')),
);
const ids = new Set<string>();
let groups = 0;
for (const topic of manifest.topics) {
  const bank = validateBank(
    JSON.parse(await readFile(resolve(root, topic.file), 'utf8')),
    topic.id,
  );
  groups += bank.groups.length;
  for (const q of bank.questions) {
    if (ids.has(q.id)) throw new Error(`跨主题 ID 重复: ${q.id}`);
    ids.add(q.id);
  }
}
console.log(`题库通过: ${manifest.topics.length} 个主题，${ids.size} 道题，${groups} 组材料。`);
