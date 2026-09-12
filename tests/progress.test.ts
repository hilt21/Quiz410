import { it, expect } from 'vitest';
import {
  createProgress,
  recordAnswer,
  saveProgress,
  loadProgress,
  wrongQuestions,
} from '../src/progress/store';
it('答错后刷新仍保留错题，再次答对保留历史但移出待复习列表', () => {
  const data = new Map<string, string>();
  const storage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
  };
  const first = recordAnswer(
    createProgress(),
    'science-161',
    'sound',
    false,
    '2026-09-12T08:00:00Z',
  );
  saveProgress(first, storage);
  const restored = loadProgress(storage);
  expect(wrongQuestions(restored)).toHaveLength(1);
  expect(restored.records['science-161'].wrongCount).toBe(1);
  const correct = recordAnswer(restored, 'science-161', 'sound', true, '2026-09-12T09:00:00Z');
  saveProgress(correct, storage);
  expect(wrongQuestions(loadProgress(storage))).toHaveLength(0);
  expect(loadProgress(storage).records['science-161']).toMatchObject({
    attempts: 2,
    wrongCount: 1,
    lastResult: true,
  });
});
it('损坏或写入失败必须显式报错，不能覆盖原记录或宣称成功', () => {
  expect(() => loadProgress({ getItem: () => '{broken' })).toThrow();
  expect(() =>
    saveProgress(createProgress(), {
      setItem: () => {
        throw new Error('quota');
      },
    }),
  ).toThrow('quota');
});

import { updateStoredProgress } from '../src/progress/store';
it('独立页面使用锁串行读取最新记录，不丢另一页的答案或切换设备身份', async () => {
  const data = new Map<string, string>();
  const storage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
  };
  let tail = Promise.resolve();
  const lock = {
    request: <T>(_name: string, task: () => Promise<T> | T): Promise<T> => {
      const next = tail.then(task);
      tail = next.then(
        () => undefined,
        () => undefined,
      );
      return next;
    },
  };
  const [a, b] = await Promise.all([
    updateStoredProgress((p) => recordAnswer(p, 'science-161', 'sound', false), storage, lock),
    updateStoredProgress((p) => recordAnswer(p, 'science-162', 'sound', true), storage, lock),
  ]);
  expect(a.syncKey).toBe(b.syncKey);
  expect(Object.keys(loadProgress(storage).records)).toEqual(['science-161', 'science-162']);
  await updateStoredProgress((p) => recordAnswer(p, 'science-161', 'sound', true), storage, lock);
  expect(loadProgress(storage).records['science-161']).toMatchObject({
    attempts: 2,
    wrongCount: 1,
    lastResult: true,
  });
});

it('延迟保存的旧答案计入次数，但不倒退最近结果与最近错误时间', () => {
  const recent = recordAnswer(
    createProgress(),
    'science-161',
    'sound',
    false,
    '2026-09-12T10:00:00Z',
  );
  const delayed = recordAnswer(recent, 'science-161', 'sound', true, '2026-09-12T09:00:00Z');
  expect(delayed.records['science-161']).toMatchObject({
    attempts: 2,
    lastResult: false,
    lastAttemptAt: '2026-09-12T10:00:00Z',
    lastWrongAt: '2026-09-12T10:00:00Z',
  });
});
