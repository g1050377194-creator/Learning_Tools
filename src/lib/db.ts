import Dexie, { type EntityTable } from "dexie";
import type { CardRecord, DeckRecord, PathRecord, PrefsRecord, ReviewLogRecord } from "@/lib/types";

class XunjiDB extends Dexie {
  decks!: EntityTable<DeckRecord, "id">;
  cards!: EntityTable<CardRecord, "id">;
  logs!: EntityTable<ReviewLogRecord, "id">;
  paths!: EntityTable<PathRecord, "id">;
  prefs!: EntityTable<PrefsRecord, "id">;

  constructor() {
    super("xunji");
    this.version(1).stores({
      decks: "id, updatedAt, pathId",
      cards: "id, deckId, due, state",
      logs: "id, cardId, deckId, reviewedAt",
      paths: "id, createdAt",
      prefs: "id",
    });
  }
}

let instance: XunjiDB | null = null;

export function getDb() {
  if (typeof indexedDB === "undefined") {
    throw new Error("牌组只保存在浏览器里，服务器上没有这份数据。");
  }
  if (!instance) instance = new XunjiDB();
  return instance;
}
