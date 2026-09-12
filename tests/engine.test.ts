import { describe, it, expect } from 'vitest';
import { checkAnswer } from '../src/engine/quiz';
import type { Question } from '../src/types/quiz';
const question: Question = {
  id: 'science-121',
  type: 'multiple-choice',
  question: '下列关于声音的说法正确的有？',
  options: [
    { id: 'a', text: '振动产生声音' },
    { id: 'b', text: '频率决定音调' },
    { id: 'c', text: '振幅影响响度' },
    { id: 'd', text: '真空能传声' },
  ],
  answer: ['a', 'b', 'c'],
  explanation: '声音需要介质。',
  source: { file: 'fixture', number: 121 },
};
describe('答案判定', () => {
  it('多选按集合判断，少选、错选和重复选项均不通过', () => {
    expect(checkAnswer(question, ['c', 'a', 'b'])).toBe(true);
    expect(checkAnswer(question, ['a', 'b'])).toBe(false);
    expect(checkAnswer(question, ['a', 'b', 'd'])).toBe(false);
    expect(checkAnswer(question, ['a', 'a', 'b', 'c'])).toBe(false);
  });
  it('单选和判断只接受唯一的正确选项', () => {
    expect(checkAnswer({ ...question, type: 'single-choice', answer: ['b'] }, ['b'])).toBe(true);
    expect(checkAnswer({ ...question, type: 'single-choice', answer: ['b'] }, ['b', 'a'])).toBe(
      false,
    );
    expect(checkAnswer({ ...question, type: 'true-false', answer: ['false'] }, ['false'])).toBe(
      true,
    );
    expect(checkAnswer(question, [])).toBe(false);
  });
});

import { startSession } from '../src/engine/quiz';
import type { PracticeQuestion } from '../src/types/quiz';
it('抽题以材料组为单位，保持组内顺序，复习子题仍保留材料', () => {
  const group = {
    id: 's',
    title: '实验',
    material: [{ type: 'text' as const, text: '共同材料' }],
    questionIds: ['q-a', 'q-b', 'q-c'],
  };
  const questions: PracticeQuestion[] = ['q-c', 'q-a', 'q-b'].map((id) => ({
    ...question,
    id,
    topic: 'sound',
    group,
  }));
  expect(startSession(questions, 2, () => 0).map((q) => q.id)).toEqual(['q-a', 'q-b', 'q-c']);
  const review = startSession(
    questions.filter((q) => q.id === 'q-b'),
    10,
  );
  expect(review[0].group?.material).toEqual(group.material);
});
