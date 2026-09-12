export type QuestionType = 'single-choice' | 'multiple-choice' | 'true-false';
export type Material =
  { type: 'text'; text: string } | { type: 'table'; headers: string[]; rows: string[][] };
export interface Question {
  id: string;
  type: QuestionType;
  question: string;
  material?: Material[];
  options: { id: string; text: string }[];
  answer: string[];
  explanation: string;
  source: { file: string; number: number };
}
export interface Group {
  id: string;
  title: string;
  material: Material[];
  questionIds: string[];
}
export interface Bank {
  schemaVersion: 1;
  topic: string;
  groups: Group[];
  questions: Question[];
}
export interface Topic {
  id: string;
  title: string;
  description: string;
  icon: string;
  file: string;
}
export interface Manifest {
  version: 1;
  topics: Topic[];
}
export interface PracticeQuestion extends Question {
  topic: string;
  group?: Group;
}
