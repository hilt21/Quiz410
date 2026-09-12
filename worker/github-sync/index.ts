import { isLearningRecord } from '../../src/progress/store';
import type { LearningRecord } from '../../src/progress/store';
export interface Env {
  ALLOWED_ORIGIN: string;
  GITHUB_REPOSITORY: string;
  GITHUB_BRANCH: string;
  GITHUB_TOKEN: string;
  ALLOWED_DEVICE_HASHES: string;
  SYNC_RATE_LIMIT: { limit(options: { key: string }): Promise<{ success: boolean }> };
}
class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
async function readLimited(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, '缺少请求内容');
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 65536) {
      await reader.cancel();
      throw new HttpError(413, '请求过大');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new HttpError(400, '无效 JSON');
  }
}
function parseQuestions(value: unknown): LearningRecord[] {
  if (
    !value ||
    typeof value !== 'object' ||
    !('version' in value) ||
    value.version !== 1 ||
    !('questions' in value) ||
    !Array.isArray(value.questions) ||
    value.questions.length > 1000
  )
    throw new HttpError(400, '无效学习记录');
  const ids = new Set<string>();
  return value.questions.map((r: unknown) => {
    if (
      !isLearningRecord(r) ||
      !r.wrongCount ||
      r.attempts > 1000000 ||
      r.id.length > 100 ||
      r.topic.length > 100 ||
      Date.parse(r.lastAttemptAt) > Date.now() + 300000 ||
      ids.has(r.id)
    )
      throw new HttpError(400, '无效题目记录');
    ids.add(r.id);
    return {
      id: r.id,
      topic: r.topic,
      attempts: r.attempts,
      wrongCount: r.wrongCount,
      lastResult: r.lastResult,
      lastAttemptAt: r.lastAttemptAt,
      lastWrongAt: r.lastWrongAt,
    };
  });
}
function decodeContent(content: string): unknown {
  return JSON.parse(
    new TextDecoder().decode(
      Uint8Array.from(atob(content.replace(/\s/g, '')), (c) => c.charCodeAt(0)),
    ),
  );
}
function encodeContent(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value, null, 2) + '\n');
  return btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(''));
}
export async function handleSync(
  request: Request,
  env: Env,
  upstream: typeof fetch = fetch,
): Promise<Response> {
  const origin = request.headers.get('Origin');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  };
  const respond = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers });
  if (!env.ALLOWED_ORIGIN || origin !== env.ALLOWED_ORIGIN)
    return respond({ error: 'Origin not allowed' }, 403);
  headers['Access-Control-Allow-Origin'] = env.ALLOWED_ORIGIN;
  headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
  headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return respond({ error: 'Method not allowed' }, 405);
  const token = request.headers.get('Authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if (!token) return respond({ error: 'Invalid device credential' }, 401);
  if (
    !env.ALLOWED_DEVICE_HASHES ||
    !env.SYNC_RATE_LIMIT ||
    !env.GITHUB_TOKEN ||
    !/^[\w.-]+\/[\w.-]+$/.test(env.GITHUB_REPOSITORY) ||
    !env.GITHUB_BRANCH
  )
    return respond({ error: 'Service unavailable' }, 503);
  try {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
    const hash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join(
      '',
    );
    const allowed = env.ALLOWED_DEVICE_HASHES.split(',').map((value) => value.trim());
    if (!allowed.includes(hash)) return respond({ error: 'Device not authorized' }, 403);
    if (!(await env.SYNC_RATE_LIMIT.limit({ key: hash })).success)
      return respond({ error: 'Too many requests' }, 429);
    const questions = parseQuestions(await readLimited(request));
    if (!questions.length) return respond({ ok: true, updatedAt: new Date().toISOString() });
    const profile = 'profile-' + hash.slice(0, 32);
    const path = `progress/${profile}/wrong-questions.json`;
    const endpoint = `https://api.github.com/repos/${env.GITHUB_REPOSITORY}/contents/${path}`;
    const githubHeaders = {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'Science-Quiz-Sync',
      'Content-Type': 'application/json',
    };
    for (let attempt = 0; attempt < 3; attempt++) {
      const existing = await upstream(`${endpoint}?ref=${encodeURIComponent(env.GITHUB_BRANCH)}`, {
        headers: githubHeaders,
        signal: AbortSignal.timeout(10000),
      });
      let sha: string | undefined;
      let previous: LearningRecord[] = [];
      if (existing.ok) {
        const file = (await existing.json()) as { sha: string; content: string };
        sha = file.sha;
        previous = parseQuestions(decodeContent(file.content));
      } else if (existing.status !== 404) throw new HttpError(502, '备份服务读取失败');
      const merged = new Map(previous.map((r) => [r.id, r]));
      for (const incoming of questions) {
        const old = merged.get(incoming.id);
        if (!old) {
          merged.set(incoming.id, incoming);
          continue;
        }
        const latest =
          Date.parse(incoming.lastAttemptAt) >= Date.parse(old.lastAttemptAt) ? incoming : old;
        merged.set(incoming.id, {
          ...latest,
          attempts: Math.max(old.attempts, incoming.attempts),
          wrongCount: Math.max(old.wrongCount, incoming.wrongCount),
          lastWrongAt:
            Date.parse(old.lastWrongAt!) > Date.parse(incoming.lastWrongAt!)
              ? old.lastWrongAt
              : incoming.lastWrongAt,
        });
      }
      const payload = {
        version: 1,
        updatedAt: new Date().toISOString(),
        questions: [...merged.values()].sort((a, b) => a.id.localeCompare(b.id)),
      };
      const response = await upstream(endpoint, {
        method: 'PUT',
        headers: githubHeaders,
        body: JSON.stringify({
          message: `Update learning records for ${profile}`,
          content: encodeContent(payload),
          branch: env.GITHUB_BRANCH,
          ...(sha ? { sha } : {}),
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (response.ok) return respond({ ok: true, updatedAt: payload.updatedAt });
      if (response.status !== 409 && response.status !== 422)
        throw new HttpError(502, '备份服务写入失败');
    }
    return respond({ error: '记录更新冲突，请重试' }, 409);
  } catch (error) {
    return respond(
      { error: error instanceof HttpError ? error.message : '备份服务暂不可用' },
      error instanceof HttpError ? error.status : 502,
    );
  }
}
export default {
  fetch(request: Request, env: Env) {
    return handleSync(request, env);
  },
};
