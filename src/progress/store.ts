export interface LearningRecord {
  id: string;
  topic: string;
  attempts: number;
  wrongCount: number;
  lastResult: boolean;
  lastAttemptAt: string;
  lastWrongAt?: string;
}
export interface Progress {
  version: 1;
  syncKey: string;
  revision: number;
  syncedRevision: number;
  records: Record<string, LearningRecord>;
}
const key = 'science-quiz-progress-v1';
export function createProgress(): Progress {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return {
    version: 1,
    syncKey: Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(''),
    revision: 0,
    syncedRevision: 0,
    records: {},
  };
}
export function recordAnswer(
  progress: Progress,
  id: string,
  topic: string,
  correct: boolean,
  now = new Date().toISOString(),
): Progress {
  const old = progress.records[id];
  const isLatest = !old || Date.parse(now) >= Date.parse(old.lastAttemptAt);
  const entry: LearningRecord = {
    id,
    topic,
    attempts: (old?.attempts ?? 0) + 1,
    wrongCount: (old?.wrongCount ?? 0) + (correct ? 0 : 1),
    lastResult: isLatest ? correct : old.lastResult,
    lastAttemptAt: isLatest ? now : old.lastAttemptAt,
  };
  if (old?.lastWrongAt) entry.lastWrongAt = old.lastWrongAt;
  if (!correct && (!entry.lastWrongAt || Date.parse(now) >= Date.parse(entry.lastWrongAt)))
    entry.lastWrongAt = now;
  return {
    ...progress,
    revision: progress.revision + 1,
    records: { ...progress.records, [id]: entry },
  };
}
export function saveProgress(
  progress: Progress,
  storage: Pick<Storage, 'setItem'> = localStorage,
): void {
  storage.setItem(key, JSON.stringify(progress));
}
export function loadProgress(storage: Pick<Storage, 'getItem'> = localStorage): Progress {
  const raw = storage.getItem(key);
  if (raw === null) return createProgress();
  const data = JSON.parse(raw);
  if (
    !data ||
    data.version !== 1 ||
    !/^[a-f0-9]{64}$/.test(data.syncKey) ||
    !Number.isSafeInteger(data.revision) ||
    !Number.isSafeInteger(data.syncedRevision) ||
    data.syncedRevision < 0 ||
    data.revision < data.syncedRevision ||
    !data.records ||
    typeof data.records !== 'object' ||
    Array.isArray(data.records)
  )
    throw new Error('学习记录格式无效，原记录已保留');
  for (const [id, r] of Object.entries(data.records)) {
    if (!isLearningRecord(r) || id !== r.id) throw new Error('学习记录损坏，原记录已保留');
  }
  return data as Progress;
}
export function isLearningRecord(value: unknown): value is LearningRecord {
  if (!value || typeof value !== 'object') return false;
  const r = value as LearningRecord;
  return (
    typeof r.id === 'string' &&
    /^[a-z][a-z0-9-]*$/.test(r.id) &&
    typeof r.topic === 'string' &&
    /^[a-z][a-z0-9-]*$/.test(r.topic) &&
    Number.isSafeInteger(r.attempts) &&
    r.attempts > 0 &&
    Number.isSafeInteger(r.wrongCount) &&
    r.wrongCount >= 0 &&
    r.wrongCount <= r.attempts &&
    typeof r.lastResult === 'boolean' &&
    typeof r.lastAttemptAt === 'string' &&
    Number.isFinite(Date.parse(r.lastAttemptAt)) &&
    (r.wrongCount === 0 ||
      (typeof r.lastWrongAt === 'string' &&
        Number.isFinite(Date.parse(r.lastWrongAt)) &&
        Date.parse(r.lastWrongAt) <= Date.parse(r.lastAttemptAt)))
  );
}
export function wrongQuestions(progress: Progress): LearningRecord[] {
  return Object.values(progress.records).filter((r) => !r.lastResult);
}

interface ProgressLock {
  request<T>(name: string, task: () => T | Promise<T>): Promise<T>;
}
export async function updateStoredProgress(
  update: (current: Progress) => Progress,
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage,
  lock: ProgressLock = navigator.locks,
): Promise<Progress> {
  if (!lock) throw new Error('当前浏览器不支持安全保存学习记录');
  return lock.request(key, () => {
    const next = update(loadProgress(storage));
    saveProgress(next, storage);
    return next;
  });
}
