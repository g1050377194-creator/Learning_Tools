import type { FeedbackResult, LevelId, PathDraft, ReadResult } from "@/lib/types";
import { levelLabel } from "@/lib/offline";

export function pathMessages(input: { goal: string; level: LevelId; weeklyHours: number }) {
  const system = [
    "你是学习规划教练。只用简体中文。",
    "只返回一个 JSON 对象，不要 markdown。",
    "路线要能立刻开工，阶段 3 到 5 个，每阶段给出周数、两到四条里程碑、两到四条练习。",
    "练习要能收成记忆卡片，不要空泛地建议“多努力”。",
  ].join("");
  const user = JSON.stringify({
    goal: input.goal,
    level: levelLabel(input.level),
    weeklyHours: input.weeklyHours,
    shape: {
      title: "18字以内",
      overview: "两三句",
      stages: [{ title: "", weeks: 2, summary: "", milestones: [""], practice: [""] }],
    },
  });
  return { system, user };
}

export function readMessages(passage: string) {
  const system = [
    "你是阅读教练。解释用简体中文。",
    "只返回一个 JSON 对象，不要 markdown。",
    "summary 是短摘要。paragraphs 按原文段落给 explanation，original 必须来自原文，不要编造没写过的句子。",
    "difficult 挑真正难的句子。vocabulary 最多 10 条，meaning 用简体中文，example 必须是原文中的句子。",
  ].join("");
  const user = JSON.stringify({
    passage,
    shape: {
      summary: "",
      paragraphs: [{ original: "", explanation: "" }],
      difficult: [{ sentence: "", note: "" }],
      vocabulary: [{ word: "", meaning: "", example: "" }],
    },
  });
  return { system, user };
}

export function feedbackMessages(input: { prompt: string; writing: string; words: string[] }) {
  const system = [
    "You are an English writing coach for a short study exercise.",
    "Return one JSON object only. comment, revised, and notes must be in English.",
    "Be specific. Quote problems briefly. Do not invent a completely different essay.",
  ].join(" ");
  const user = JSON.stringify({
    prompt: input.prompt,
    writing: input.writing,
    targetWords: input.words,
    shape: {
      comment: "",
      revised: "",
      wordNotes: [{ word: "", used: true, note: "" }],
    },
  });
  return { system, user };
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function asStringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asString(item)).filter(Boolean).slice(0, 6);
}

export function normalizePath(value: unknown): PathDraft {
  if (!value || typeof value !== "object") throw new Error("模型返回的路线不完整");
  const record = value as Record<string, unknown>;
  const stages = Array.isArray(record.stages) ? record.stages : [];
  const normalized = stages
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const stage = item as Record<string, unknown>;
      const title = asString(stage.title);
      if (!title) return null;
      const weeks = Number(stage.weeks);
      return {
        title,
        weeks: Number.isFinite(weeks) ? Math.min(12, Math.max(1, Math.round(weeks))) : 2,
        summary: asString(stage.summary),
        milestones: asStringList(stage.milestones),
        practice: asStringList(stage.practice),
      };
    })
    .filter((item): item is PathDraft["stages"][number] => Boolean(item))
    .slice(0, 6);
  if (normalized.length === 0) throw new Error("模型没有给出可以执行的阶段");
  return {
    title: asString(record.title, "学习路线"),
    overview: asString(record.overview),
    stages: normalized,
  };
}

export function normalizeRead(value: unknown): ReadResult {
  if (!value || typeof value !== "object") throw new Error("模型返回的阅读结果不完整");
  const record = value as Record<string, unknown>;
  const paragraphs = Array.isArray(record.paragraphs)
    ? record.paragraphs
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const row = item as Record<string, unknown>;
          const original = asString(row.original);
          if (!original) return null;
          return { original, explanation: asString(row.explanation, "这一段可以先抓第一句。") };
        })
        .filter((item): item is ReadResult["paragraphs"][number] => Boolean(item))
        .slice(0, 10)
    : [];
  const difficult = Array.isArray(record.difficult)
    ? record.difficult
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const row = item as Record<string, unknown>;
          const sentence = asString(row.sentence);
          if (!sentence) return null;
          return { sentence, note: asString(row.note) };
        })
        .filter((item): item is ReadResult["difficult"][number] => Boolean(item))
        .slice(0, 8)
    : [];
  const vocabulary = Array.isArray(record.vocabulary)
    ? record.vocabulary
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const row = item as Record<string, unknown>;
          const word = asString(row.word);
          if (!word) return null;
          return { word, meaning: asString(row.meaning, "待补充释义"), example: asString(row.example) };
        })
        .filter((item): item is ReadResult["vocabulary"][number] => Boolean(item))
        .slice(0, 12)
    : [];
  const summary = asString(record.summary);
  if (!summary && paragraphs.length === 0) throw new Error("模型没有给出摘要");
  return { summary: summary || "模型没有单独写摘要，下面按段落看。", paragraphs, difficult, vocabulary };
}

export function normalizeFeedback(value: unknown): FeedbackResult {
  if (!value || typeof value !== "object") throw new Error("模型返回的反馈不完整");
  const record = value as Record<string, unknown>;
  const comment = asString(record.comment);
  const revised = asString(record.revised);
  if (!comment && !revised) throw new Error("模型没有给出反馈");
  const wordNotes = Array.isArray(record.wordNotes)
    ? record.wordNotes
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const row = item as Record<string, unknown>;
          const word = asString(row.word);
          if (!word) return null;
          return { word, used: Boolean(row.used), note: asString(row.note) };
        })
        .filter((item): item is FeedbackResult["wordNotes"][number] => Boolean(item))
        .slice(0, 8)
    : [];
  return {
    comment: comment || "The model returned a revision without a separate comment.",
    revised,
    wordNotes,
  };
}

export function parseModelJson(text: string) {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1)) as unknown;
    throw new Error("模型没有返回可解析的 JSON");
  }
}
