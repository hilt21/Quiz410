import { it, expect } from 'vitest';
import { validateBank } from '../src/engine/content';
import draft from '../docs/schema-validation/real-bank.draft.json';
const valid = () => ({
  schemaVersion: 1,
  topic: 'science',
  groups: [],
  questions: [{ ...draft.questions[160], explanation: '频率由 240 Hz 降到 120 Hz。' }],
});
it('接受真实单题，发布时拒绝缺少解析的原始题库', () => {
  expect(validateBank(valid(), 'science').questions).toHaveLength(1);
  expect(() => validateBank(draft, 'science-training')).toThrow(/explanation/);
});
it('拒绝未知答案引用、重复编号、材料悬空引用和不齐的表格', () => {
  const b = valid();
  b.questions[0].answer = ['z'];
  expect(() => validateBank(b, 'science')).toThrow(/答案/);
  const dup = valid();
  dup.questions.push(dup.questions[0]);
  expect(() => validateBank(dup, 'science')).toThrow(/重复/);
  expect(() =>
    validateBank(
      {
        ...valid(),
        groups: [
          {
            id: 's',
            title: '情境',
            material: [{ type: 'text', text: '材料' }],
            questionIds: ['missing', 'also-missing'],
          },
        ],
      },
      'science',
    ),
  ).toThrow(/引用/);
  expect(() =>
    validateBank(
      {
        ...valid(),
        questions: [
          {
            ...valid().questions[0],
            material: [{ type: 'table', headers: ['A', 'B'], rows: [['1']] }],
          },
        ],
      },
      'science',
    ),
  ).toThrow(/列数/);
  expect(() => validateBank(valid(), 'other')).toThrow(/主题/);
});
