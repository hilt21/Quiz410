import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  DEFAULT_PRACTICE_COUNT,
  PRACTICE_SETTINGS_KEY,
  isPracticeCount,
  loadPracticeCount,
  savePracticeCount,
} from '../src/progress/settings';

let values: Map<string, string>;
beforeEach(() => {
  values = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
});
afterEach(() => vi.unstubAllGlobals());

it('设置默认为 10；自定义题数可以保存并重新读取，不覆盖学习记录', () => {
  values.set('science-quiz-progress-v1', 'existing progress');
  expect(loadPracticeCount()).toBe(DEFAULT_PRACTICE_COUNT);
  savePracticeCount(23);
  expect(loadPracticeCount()).toBe(23);
  expect(values.get('science-quiz-progress-v1')).toBe('existing progress');
});

it('只接受正的安全整数；损坏设置回退默认且保留原值', () => {
  for (const value of [0, -1, 1.5, Infinity, NaN, '5', null, Number.MAX_SAFE_INTEGER + 1]) {
    expect(isPracticeCount(value)).toBe(false);
  }
  for (const value of ['{broken', '0', '-2', '1.5', '"5"', 'null']) {
    values.set(PRACTICE_SETTINGS_KEY, value);
    expect(loadPracticeCount()).toBe(10);
    expect(values.get(PRACTICE_SETTINGS_KEY)).toBe(value);
  }
  expect(() => savePracticeCount(0)).toThrow();
});

it('存储无法读取时仍能练习，保存失败向调用方报告', () => {
  vi.stubGlobal('localStorage', {
    getItem: () => {
      throw new Error('blocked');
    },
    setItem: () => {
      throw new Error('blocked');
    },
  });
  expect(loadPracticeCount()).toBe(10);
  expect(() => savePracticeCount(5)).toThrow('blocked');
});
