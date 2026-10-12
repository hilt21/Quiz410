export const PRACTICE_SETTINGS_KEY = 'science-quiz-practice-count-v1';
export const DEFAULT_PRACTICE_COUNT = 10;

export function isPracticeCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

export function loadPracticeCount(): number {
  try {
    const stored = localStorage.getItem(PRACTICE_SETTINGS_KEY);
    if (stored === null) return DEFAULT_PRACTICE_COUNT;
    const value: unknown = JSON.parse(stored);
    return isPracticeCount(value) ? value : DEFAULT_PRACTICE_COUNT;
  } catch {
    return DEFAULT_PRACTICE_COUNT;
  }
}

export function savePracticeCount(value: number): void {
  if (!isPracticeCount(value)) throw new Error('请输入大于零的整数。');
  localStorage.setItem(PRACTICE_SETTINGS_KEY, JSON.stringify(value));
}
