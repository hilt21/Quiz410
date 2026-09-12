import { validateBank, validateManifest, practiceQuestions } from './content';
import type { Bank, Manifest, PracticeQuestion } from '../types/quiz';
export interface Library {
  manifest: Manifest;
  banks: Record<string, Bank>;
  questions: PracticeQuestion[];
}
export async function loadLibrary(): Promise<Library> {
  const root = new URL(import.meta.env.BASE_URL, location.origin);
  async function read(path: string) {
    const response = await fetch(new URL(path, root));
    if (!response.ok) throw new Error('题库暂时无法读取');
    return response.json();
  }
  const manifest = validateManifest(await read('manifest.json'));
  const pairs = await Promise.all(
    manifest.topics.map(async (t) => [t.id, validateBank(await read(t.file), t.id)] as const),
  );
  const questions = pairs.flatMap(([, bank]) => practiceQuestions(bank));
  if (new Set(questions.map((q) => q.id)).size !== questions.length)
    throw new Error('跨主题题目编号重复');
  return { manifest, banks: Object.fromEntries(pairs), questions };
}
