export const LEVELS = [
  { id: "beginner", label: "刚开始接触" },
  { id: "basic", label: "有一些基础" },
  { id: "independent", label: "能独立完成简单任务" },
  { id: "fluent", label: "希望把已有能力用熟" },
] as const;

export type LevelId = (typeof LEVELS)[number]["id"];

export type CardType = "basic" | "vocab" | "cloze";

export type AiSource = "ai" | "offline";

export interface DeckRecord {
  id: string;
  name: string;
  description: string;
  pathId: string | null;
  stageId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface CardRecord {
  id: string;
  deckId: string;
  type: CardType;
  front: string;
  back: string;
  extra: string;
  due: number;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  state: number;
  lastReview: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface ReviewLogRecord {
  id: string;
  cardId: string;
  deckId: string;
  rating: number;
  reviewedAt: number;
  due: number;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  state: number;
  reps: number;
  lapses: number;
}

export interface StageRecord {
  id: string;
  title: string;
  weeks: number;
  summary: string;
  milestones: string[];
  practice: string[];
  deckId: string | null;
}

export interface PathRecord {
  id: string;
  title: string;
  goal: string;
  level: LevelId;
  weeklyHours: number;
  overview: string;
  source: AiSource;
  stages: StageRecord[];
  createdAt: number;
}

export interface PrefsRecord {
  id: "prefs";
  desiredRetention: number;
}

export interface StageDraft {
  title: string;
  weeks: number;
  summary: string;
  milestones: string[];
  practice: string[];
}

export interface PathDraft {
  title: string;
  overview: string;
  stages: StageDraft[];
}

export interface VocabItem {
  word: string;
  meaning: string;
  example: string;
}

export interface ReadResult {
  summary: string;
  paragraphs: { original: string; explanation: string }[];
  difficult: { sentence: string; note: string }[];
  vocabulary: VocabItem[];
}

export interface FeedbackResult {
  comment: string;
  revised: string;
  wordNotes: { word: string; used: boolean; note: string }[];
}

export interface StudyData {
  decks: DeckRecord[];
  cards: CardRecord[];
  logs: ReviewLogRecord[];
  paths: PathRecord[];
  retention: number;
}
