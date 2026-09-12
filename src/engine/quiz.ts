import type { Question } from '../types/quiz';
export function checkAnswer(question: Question, selected: string[]): boolean {
  return (
    selected.length === question.answer.length &&
    new Set(selected).size === selected.length &&
    selected.every((id) => question.answer.includes(id))
  );
}

import type { PracticeQuestion } from '../types/quiz';
export function startSession(
  questions: PracticeQuestion[],
  limit = 10,
  random = Math.random,
): PracticeQuestion[] {
  const units = new Map<string, PracticeQuestion[]>();
  for (const q of questions) {
    const key = q.group ? `${q.topic}:${q.group.id}` : q.id;
    const unit = units.get(key) ?? [];
    unit.push(q);
    units.set(key, unit);
  }
  const shuffled = [...units.values()];
  for (const unit of shuffled)
    if (unit[0].group) {
      const order = unit[0].group.questionIds;
      unit.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    }
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const result: PracticeQuestion[] = [];
  for (const unit of shuffled) {
    if (result.length >= limit) break;
    if (result.length && result.length + unit.length > limit) continue;
    result.push(...unit);
  }
  return result;
}
