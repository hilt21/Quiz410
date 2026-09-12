import Ajv2020 from 'ajv/dist/2020.js';
import schema from '../../schemas/question.schema.json';
import type { Bank, Material, Manifest, PracticeQuestion } from '../types/quiz';
const check = new Ajv2020({ allErrors: true, strict: false }).compile<Bank>(schema);
export function validateBank(value: unknown, topic: string): Bank {
  if (!check(value))
    throw new Error(check.errors?.map((e) => `${e.instancePath} ${e.message}`).join('; '));
  if (value.topic !== topic) throw new Error('题库主题与 manifest 不一致');
  const ids = new Set<string>();
  function checkMaterial(blocks: Material[] = []) {
    for (const block of blocks)
      if (block.type === 'table' && block.rows.some((row) => row.length !== block.headers.length))
        throw new Error('表格列数不一致');
  }
  for (const q of value.questions) {
    if (ids.has(q.id)) throw new Error(`题目 ID 重复: ${q.id}`);
    ids.add(q.id);
    const options = new Set(q.options.map((o) => o.id));
    if (options.size !== q.options.length) throw new Error(`选项 ID 重复: ${q.id}`);
    if (q.answer.some((a) => !options.has(a))) throw new Error(`答案引用不存在: ${q.id}`);
    if (!q.question.trim() || !q.explanation.trim() || q.options.some((o) => !o.text.trim()))
      throw new Error(`题目内容为空: ${q.id}`);
    checkMaterial(q.material);
  }
  const groupIds = new Set<string>();
  const grouped = new Set<string>();
  for (const group of value.groups) {
    if (groupIds.has(group.id)) throw new Error('材料 ID 重复');
    groupIds.add(group.id);
    checkMaterial(group.material);
    for (const id of group.questionIds) {
      if (!ids.has(id)) throw new Error(`材料引用不存在: ${id}`);
      if (grouped.has(id)) throw new Error(`题目重复归组: ${id}`);
      grouped.add(id);
    }
  }
  return value;
}
export function validateManifest(value: unknown): Manifest {
  if (
    !value ||
    typeof value !== 'object' ||
    !('version' in value) ||
    value.version !== 1 ||
    !('topics' in value) ||
    !Array.isArray(value.topics) ||
    !value.topics.length
  )
    throw new Error('无效的主题目录');
  const ids = new Set<string>();
  for (const t of value.topics) {
    if (
      !t ||
      typeof t !== 'object' ||
      !['id', 'title', 'description', 'icon', 'file'].every(
        (k) => typeof t[k] === 'string' && t[k].trim(),
      ) ||
      !/^[a-z][a-z0-9-]*$/.test(t.id) ||
      !/^\.\/science\/[a-z0-9-]+\/questions\.json$/.test(t.file) ||
      ids.has(t.id)
    )
      throw new Error('主题目录字段或路径无效');
    ids.add(t.id);
  }
  return value as Manifest;
}
export function practiceQuestions(bank: Bank): PracticeQuestion[] {
  const groups = new Map(
    bank.groups.flatMap((group) => group.questionIds.map((id) => [id, group] as const)),
  );
  return bank.questions.map((q) => ({ ...q, topic: bank.topic, group: groups.get(q.id) }));
}
