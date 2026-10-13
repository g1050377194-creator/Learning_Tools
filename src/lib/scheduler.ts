import {
  createEmptyCard,
  fsrs,
  Rating,
  State,
  type Card,
  type Grade,
  type RecordLog,
} from "ts-fsrs";
import type { CardRecord } from "@/lib/types";

export { Rating, State };
export type { Grade, RecordLog };

export const NEW_CARD_LIMIT = 20;
export const DEFAULT_RETENTION = 0.9;

export function clampRetention(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_RETENTION;
  return Math.min(0.97, Math.max(0.7, Math.round(value * 100) / 100));
}

export function toFsrsCard(record: CardRecord): Card {
  return {
    due: new Date(record.due),
    stability: record.stability,
    difficulty: record.difficulty,
    elapsed_days: record.elapsedDays,
    scheduled_days: record.scheduledDays,
    reps: record.reps,
    lapses: record.lapses,
    state: record.state as State,
    last_review: record.lastReview ? new Date(record.lastReview) : undefined,
  };
}

export function emptyMemory(now = new Date()) {
  return createEmptyCard(now);
}

export function previewCard(record: CardRecord, now: Date, retention: number): RecordLog {
  const scheduler = fsrs({
    request_retention: clampRetention(retention),
    maximum_interval: 36500,
    enable_fuzz: true,
    enable_short_term: true,
  });
  return scheduler.repeat(toFsrsCard(record), now);
}

export function buildQueue(cards: CardRecord[], now = Date.now()) {
  const learning = cards
    .filter((card) => (card.state === State.Learning || card.state === State.Relearning) && card.due <= now)
    .sort((a, b) => a.due - b.due);
  const review = cards
    .filter((card) => card.state === State.Review && card.due <= now)
    .sort((a, b) => a.due - b.due);
  const fresh = cards
    .filter((card) => card.state === State.New)
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(0, NEW_CARD_LIMIT);
  return [...learning, ...review, ...fresh];
}

export function isDueToday(card: CardRecord, now = Date.now()) {
  if (card.state === State.New) return false;
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return card.due <= end.getTime();
}
