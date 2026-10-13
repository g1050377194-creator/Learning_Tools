import type { Card } from "ts-fsrs";
import { getDb } from "@/lib/db";
import { clampRetention, emptyMemory } from "@/lib/scheduler";
import type { Grade } from "@/lib/scheduler";
import { uid } from "@/lib/text";
import type {
  AiSource,
  CardRecord,
  CardType,
  DeckRecord,
  LevelId,
  PathDraft,
  PathRecord,
  ReviewLogRecord,
  StudyData,
} from "@/lib/types";

export async function loadStudy(): Promise<StudyData> {
  const db = getDb();
  const existing = await db.prefs.get("prefs");
  if (!existing) {
    await db.prefs.put({ id: "prefs", desiredRetention: 0.9 });
  }
  const [decks, cards, logs, paths, prefs] = await Promise.all([
    db.decks.toArray(),
    db.cards.toArray(),
    db.logs.toArray(),
    db.paths.toArray(),
    db.prefs.get("prefs"),
  ]);
  return {
    decks: decks.sort((a, b) => b.updatedAt - a.updatedAt),
    cards,
    logs,
    paths: paths.sort((a, b) => b.createdAt - a.createdAt),
    retention: prefs?.desiredRetention ?? 0.9,
  };
}

export async function createDeck(input: {
  name: string;
  description?: string;
  pathId?: string | null;
  stageId?: string | null;
}) {
  const db = getDb();
  const now = Date.now();
  const deck: DeckRecord = {
    id: uid(),
    name: input.name.trim(),
    description: input.description?.trim() ?? "",
    pathId: input.pathId ?? null,
    stageId: input.stageId ?? null,
    createdAt: now,
    updatedAt: now,
  };
  await db.decks.add(deck);
  return deck;
}

export async function renameDeck(deckId: string, name: string, description: string) {
  const db = getDb();
  await db.decks.update(deckId, {
    name: name.trim(),
    description: description.trim(),
    updatedAt: Date.now(),
  });
}

export async function deleteDeck(deckId: string) {
  const db = getDb();
  await db.transaction("rw", db.decks, db.cards, db.logs, db.paths, async () => {
    await db.cards.where("deckId").equals(deckId).delete();
    await db.logs.where("deckId").equals(deckId).delete();
    const paths = await db.paths.toArray();
    for (const path of paths) {
      if (!path.stages.some((stage) => stage.deckId === deckId)) continue;
      await db.paths.put({
        ...path,
        stages: path.stages.map((stage) => (stage.deckId === deckId ? { ...stage, deckId: null } : stage)),
      });
    }
    await db.decks.delete(deckId);
  });
}

export async function createCard(input: {
  deckId: string;
  type: CardType;
  front: string;
  back: string;
  extra?: string;
}) {
  const db = getDb();
  const now = new Date();
  const memory = emptyMemory(now);
  const card: CardRecord = {
    id: uid(),
    deckId: input.deckId,
    type: input.type,
    front: input.front.trim(),
    back: input.back.trim(),
    extra: input.extra?.trim() ?? "",
    due: memory.due.getTime(),
    stability: memory.stability,
    difficulty: memory.difficulty,
    elapsedDays: memory.elapsed_days,
    scheduledDays: memory.scheduled_days,
    reps: memory.reps,
    lapses: memory.lapses,
    state: memory.state,
    lastReview: null,
    createdAt: now.getTime(),
    updatedAt: now.getTime(),
  };
  await db.transaction("rw", db.cards, db.decks, async () => {
    await db.cards.add(card);
    await db.decks.update(input.deckId, { updatedAt: now.getTime() });
  });
  return card;
}

export async function updateCardContent(
  cardId: string,
  input: { front: string; back: string; extra: string; type: CardType },
) {
  const db = getDb();
  await db.cards.update(cardId, {
    front: input.front.trim(),
    back: input.back.trim(),
    extra: input.extra.trim(),
    type: input.type,
    updatedAt: Date.now(),
  });
}

export async function deleteCard(cardId: string) {
  const db = getDb();
  await db.transaction("rw", db.cards, db.logs, async () => {
    await db.logs.where("cardId").equals(cardId).delete();
    await db.cards.delete(cardId);
  });
}

export async function commitReview(cardId: string, rating: Grade, next: Card, reviewedAt: number) {
  const db = getDb();
  const current = await db.cards.get(cardId);
  if (!current) throw new Error("找不到这张卡片");
  const updated: CardRecord = {
    ...current,
    due: next.due.getTime(),
    stability: next.stability,
    difficulty: next.difficulty,
    elapsedDays: next.elapsed_days,
    scheduledDays: next.scheduled_days,
    reps: next.reps,
    lapses: next.lapses,
    state: next.state,
    lastReview: next.last_review ? next.last_review.getTime() : reviewedAt,
    updatedAt: reviewedAt,
  };
  const log: ReviewLogRecord = {
    id: uid(),
    cardId,
    deckId: current.deckId,
    rating,
    reviewedAt,
    due: updated.due,
    stability: updated.stability,
    difficulty: updated.difficulty,
    elapsedDays: updated.elapsedDays,
    scheduledDays: updated.scheduledDays,
    state: updated.state,
    reps: updated.reps,
    lapses: updated.lapses,
  };
  await db.transaction("rw", db.cards, db.logs, db.decks, async () => {
    await db.cards.put(updated);
    await db.logs.add(log);
    await db.decks.update(current.deckId, { updatedAt: reviewedAt });
  });
  return updated;
}

export async function savePath(
  draft: PathDraft,
  meta: { goal: string; level: LevelId; weeklyHours: number; source: AiSource },
) {
  const db = getDb();
  const path: PathRecord = {
    id: uid(),
    title: draft.title.trim() || "未命名路线",
    goal: meta.goal.trim(),
    level: meta.level,
    weeklyHours: meta.weeklyHours,
    overview: draft.overview.trim(),
    source: meta.source,
    stages: draft.stages.map((stage) => ({
      id: uid(),
      title: stage.title.trim(),
      weeks: Math.max(1, Math.round(stage.weeks) || 1),
      summary: stage.summary.trim(),
      milestones: stage.milestones.map((item) => item.trim()).filter(Boolean),
      practice: stage.practice.map((item) => item.trim()).filter(Boolean),
      deckId: null,
    })),
    createdAt: Date.now(),
  };
  await db.paths.add(path);
  return path;
}

export async function deletePath(pathId: string) {
  const db = getDb();
  await db.paths.delete(pathId);
}

export async function linkStageDeck(pathId: string, stageId: string, deckId: string | null) {
  const db = getDb();
  const path = await db.paths.get(pathId);
  if (!path) throw new Error("找不到这条路线");
  await db.paths.put({
    ...path,
    stages: path.stages.map((stage) => (stage.id === stageId ? { ...stage, deckId } : stage)),
  });
  if (deckId) {
    await db.decks.update(deckId, { pathId, stageId, updatedAt: Date.now() });
  }
}

export async function setRetention(value: number) {
  const db = getDb();
  await db.prefs.put({ id: "prefs", desiredRetention: clampRetention(value) });
}
