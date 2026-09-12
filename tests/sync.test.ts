import { it, expect } from 'vitest';
import { handleSync } from '../worker/github-sync/index';
import { createProgress, recordAnswer } from '../src/progress/store';
const env = {
  ALLOWED_ORIGIN: 'https://quiz.example',
  GITHUB_REPOSITORY: 'owner/private-backup',
  GITHUB_BRANCH: 'main',
  GITHUB_TOKEN: 'server-only-token',
  ALLOWED_DEVICE_HASHES: '',
  SYNC_RATE_LIMIT: { limit: async () => ({ success: true }) },
};
const progress = recordAnswer(createProgress(), 'science-161', 'sound', false);
env.ALLOWED_DEVICE_HASHES = Array.from(
  new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(progress.syncKey))),
  (b) => b.toString(16).padStart(2, '0'),
).join('');
const request = (
  body: unknown = { version: 1, questions: Object.values(progress.records) },
  origin = env.ALLOWED_ORIGIN,
) =>
  new Request('https://sync.example', {
    method: 'POST',
    headers: { Origin: origin, Authorization: `Bearer ${progress.syncKey}` },
    body: JSON.stringify(body),
  });
it('拒绝错误来源和非法答案记录，不调用GitHub', async () => {
  const upstream: typeof fetch = async () => {
    throw new Error('must not reach GitHub');
  };
  expect((await handleSync(request(undefined, 'https://evil.example'), env, upstream)).status).toBe(
    403,
  );
  expect(
    (await handleSync(request({ version: 1, questions: [{ id: '../secret' }] }), env, upstream))
      .status,
  ).toBe(400);
});
it('首次写入仅保存引用，重试合并不重复累加，修正后的状态覆盖旧状态', async () => {
  let stored: any;
  let version = 0;
  const upstream: typeof fetch = async (url, init) => {
    expect(String(url)).toMatch(/\/progress\/profile-[a-f0-9]{32}\/wrong-questions.json/);
    expect(String(url)).not.toContain(progress.syncKey);
    if (init?.method === 'PUT') {
      const payload = JSON.parse(String(init.body));
      if (version) expect(payload.sha).toBe(String(version));
      stored = JSON.parse(Buffer.from(payload.content, 'base64').toString());
      version++;
      return Response.json({ content: { sha: String(version) } });
    }
    return stored
      ? Response.json({
          sha: String(version),
          content: Buffer.from(JSON.stringify(stored)).toString('base64'),
        })
      : new Response('', { status: 404 });
  };
  expect((await handleSync(request(), env, upstream)).status).toBe(200);
  await handleSync(request(), env, upstream);
  expect(stored.questions).toHaveLength(1);
  expect(stored.questions[0]).toMatchObject({ attempts: 1, wrongCount: 1, lastResult: false });
  expect(stored.questions[0]).not.toHaveProperty('question');
  const corrected = recordAnswer(progress, 'science-161', 'sound', true);
  await handleSync(
    request({ version: 1, questions: Object.values(corrected.records) }),
    env,
    upstream,
  );
  expect(stored.questions[0]).toMatchObject({ attempts: 2, wrongCount: 1, lastResult: true });
});
it('GitHub写入失败不会收到成功收据', async () => {
  const upstream: typeof fetch = async (_, init) =>
    new Response('', { status: init?.method === 'PUT' ? 500 : 404 });
  const response = await handleSync(request(), env, upstream);
  expect(response.status).toBe(502);
  expect(await response.json()).not.toHaveProperty('ok');
});

it('未配置设备准入、未知设备和超过限额都在GitHub之前拒绝', async () => {
  const upstream: typeof fetch = async () => {
    throw new Error('must not reach GitHub');
  };
  expect(
    (await handleSync(request(), { ...env, ALLOWED_DEVICE_HASHES: '' }, upstream)).status,
  ).toBe(503);
  expect(
    (await handleSync(request(), { ...env, ALLOWED_DEVICE_HASHES: 'b'.repeat(64) }, upstream))
      .status,
  ).toBe(403);
  expect(
    (
      await handleSync(
        request(),
        { ...env, SYNC_RATE_LIMIT: { limit: async () => ({ success: false }) } },
        upstream,
      )
    ).status,
  ).toBe(429);
});
