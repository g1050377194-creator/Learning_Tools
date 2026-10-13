import type { ModelConfig } from "@/lib/models";
import type { FeedbackResult, LevelId, PathDraft, ReadResult } from "@/lib/types";

export async function requestModel<T>(task: "path" | "read" | "feedback", input: unknown, config: ModelConfig) {
  const response = await fetch("/api/ai", {
    method: "POST",
    headers: { "content-type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      task,
      input,
      config: {
        provider: config.provider,
        baseUrl: config.baseUrl,
        model: config.model,
        apiKey: config.apiKey,
      },
    }),
  });
  const data = (await response.json().catch(() => ({}))) as { error?: string; result?: T };
  if (!response.ok) {
    throw new Error(data.error || "模型请求失败");
  }
  if (!data.result) throw new Error("模型没有返回结果");
  return data.result;
}

export function requestPath(
  input: { goal: string; level: LevelId; weeklyHours: number },
  config: ModelConfig,
) {
  return requestModel<PathDraft>("path", input, config);
}

export function requestRead(passage: string, config: ModelConfig) {
  return requestModel<ReadResult>("read", { passage }, config);
}

export function requestFeedback(
  input: { prompt: string; writing: string; words: string[] },
  config: ModelConfig,
) {
  return requestModel<FeedbackResult>("feedback", input, config);
}
