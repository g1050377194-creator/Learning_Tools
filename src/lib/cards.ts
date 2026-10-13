import type { CardRecord } from "@/lib/types";
import { blankWord, looksEnglish } from "@/lib/text";

export function headword(card: CardRecord) {
  if (card.type === "cloze") {
    return card.back.split("·")[0]?.trim() || card.front.trim();
  }
  return card.front.trim();
}

export function gloss(card: CardRecord) {
  if (card.type === "cloze") {
    const parts = card.back.split("·").map((part) => part.trim()).filter(Boolean);
    return parts[1] || parts[0] || card.extra;
  }
  return card.back.trim();
}

export function englishWord(card: CardRecord) {
  const word = headword(card);
  if (looksEnglish(word)) return word;
  const back = card.back.split("·")[0]?.trim() ?? "";
  if (looksEnglish(back)) return back;
  return word;
}

export function clozeOf(card: CardRecord) {
  const answer = headword(card);
  if (card.front.includes("____")) return { prompt: card.front, answer };
  const source = card.extra || (card.type === "basic" ? "" : card.front);
  const blanked = blankWord(source, answer);
  if (blanked) return { prompt: blanked, answer };
  const hint = gloss(card);
  return { prompt: hint ? `____  （${hint}）` : "____", answer };
}

export function cardKindLabel(type: CardRecord["type"]) {
  if (type === "vocab") return "词汇";
  if (type === "cloze") return "完形";
  return "普通";
}
