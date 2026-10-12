import { expect, it } from 'vitest';
import earth from '../content/science/earth/questions.json';
import crosswalk from '../docs/astronomy/source-crosswalk.json';
import { validateBank } from '../src/engine/content';

it('天文来源逐号有去向，合并题引用可练题，排除残题不混入题库', () => {
  const bank = validateBank(earth, 'earth');
  const imported = bank.questions.filter((q) => q.id.startsWith('astronomy-'));
  expect(imported).toHaveLength(232);
  expect(new Set(crosswalk.map((r) => r.source)).size).toBe(265);
  expect(crosswalk.filter((r) => r.status === 'imported')).toHaveLength(imported.length);
  for (const row of crosswalk) {
    if (row.status !== 'excluded') expect(bank.questions.some((q) => q.id === row.id)).toBe(true);
  }
  for (const q of imported) {
    expect(q.question).not.toMatch(/[□\x01]/);
    expect(new Set(q.options.map((o) => o.text)).size).toBe(q.options.length);
    expect(q.source.file).toMatch(/\.pdf#[ABCS]$/);
  }
});

it('保留关键纠错：FAST 贵州、首位登月来自美国、岁星木星与多答案潮汐锁定', () => {
  const answerText = (id: string) => {
    const q = earth.questions.find((q) => q.id === id)!;
    return q.options.filter((o) => q.answer.includes(o.id)).map((o) => o.text);
  };
  expect(answerText('astronomy-a-025')).toEqual(['贵州']);
  expect(answerText('astronomy-a-079')).toEqual(['美国']);
  expect(answerText('astronomy-b-050')).toEqual(['岁星']);
  expect(answerText('astronomy-a-101')).toHaveLength(4);
  expect(answerText('astronomy-s-003')).toEqual(['C/2008 C1']);
});
