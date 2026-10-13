import type { ProviderId } from "@/lib/models";
import {
  feedbackMessages,
  normalizeFeedback,
  normalizePath,
  normalizeRead,
  parseModelJson,
  pathMessages,
  readMessages,
} from "@/lib/prompts";
import type { LevelId } from "@/lib/types";

const PROVIDERS = new Set<ProviderId>(["openai", "anthropic", "gemini", "deepseek", "custom"]);
const LEVELS = new Set<LevelId>(["beginner", "basic", "independent", "fluent"]);

interface ProxyConfig {
  provider: ProviderId;
  baseUrl: string;
  model: string;
  apiKey: string;
}

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function sanitize(message: string, apiKey: string) {
  let text = message.replace(/\s+/g, " ").slice(0, 280);
  if (apiKey.trim()) text = text.split(apiKey.trim()).join("***");
  return text;
}

function assertUrl(baseUrl: string) {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new Error("服务地址不是合法的 URL");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("只支持 http 或 https 地址");
  }
  const blocked = new Set(["169.254.169.254", "metadata.google.internal"]);
  if (blocked.has(url.hostname) || url.hostname.endsWith(".metadata.google.internal")) {
    throw new Error("这个地址不能作为模型服务");
  }
  return url;
}

function messageText(content: unknown) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object" && "text" in part) return String((part as { text?: unknown }).text ?? "");
      return "";
    })
    .join("\n");
}

async function readError(response: Response, apiKey: string) {
  const text = await response.text().catch(() => "");
  return sanitize(text || `模型返回了 HTTP ${response.status}`, apiKey);
}

async function openaiChat(config: ProxyConfig, system: string, user: string, jsonMode: boolean): Promise<string> {
  const base = config.baseUrl.replace(/\/$/, "");
  const url = /\/chat\/completions$/.test(base) ? base : `${base}/chat/completions`;
  const body: Record<string, unknown> = {
    model: config.model,
    temperature: 0.4,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };
  if (jsonMode) body.response_format = { type: "json_object" };
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok && jsonMode && response.status === 400) {
    return openaiChat(config, system, user, false);
  }
  if (!response.ok) throw new Error(await readError(response, config.apiKey));
  const data = (await response.json()) as { choices?: { message?: { content?: unknown } }[] };
  const text = messageText(data.choices?.[0]?.message?.content);
  if (!text.trim()) throw new Error("模型返回了空内容");
  return text;
}

async function anthropicChat(config: ProxyConfig, system: string, user: string) {
  const base = config.baseUrl.replace(/\/$/, "");
  const url = /\/messages$/.test(base) ? base : `${base}/messages`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 4096,
      temperature: 0.4,
      system,
      messages: [{ role: "user", content: user }],
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(await readError(response, config.apiKey));
  const data = (await response.json()) as { content?: { text?: string }[] };
  const text = (data.content ?? []).map((part) => part.text ?? "").join("\n");
  if (!text.trim()) throw new Error("模型返回了空内容");
  return text;
}

async function geminiChat(config: ProxyConfig, system: string, user: string) {
  const base = config.baseUrl.replace(/\/$/, "");
  const url = `${base}/models/${encodeURIComponent(config.model)}:generateContent`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": config.apiKey,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { temperature: 0.4, responseMimeType: "application/json" },
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(await readError(response, config.apiKey));
  const data = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n") ?? "";
  if (!text.trim()) throw new Error("模型返回了空内容");
  return text;
}

async function complete(config: ProxyConfig, system: string, user: string) {
  if (config.provider === "anthropic") return anthropicChat(config, system, user);
  if (config.provider === "gemini") return geminiChat(config, system, user);
  return openaiChat(config, system, user, true);
}

function readConfig(value: unknown): ProxyConfig {
  if (!value || typeof value !== "object") throw new Error("缺少模型配置");
  const record = value as Partial<ProxyConfig>;
  if (!record.provider || !PROVIDERS.has(record.provider)) throw new Error("不认识这个服务商");
  if (!record.baseUrl || !record.model || !record.apiKey) throw new Error("模型名称、地址和密钥都要填");
  assertUrl(record.baseUrl);
  return {
    provider: record.provider,
    baseUrl: record.baseUrl.trim(),
    model: record.model.trim(),
    apiKey: record.apiKey.trim(),
  };
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("请求格式不正确", 400);
  }
  const record = body && typeof body === "object" ? (body as { task?: unknown; input?: unknown; config?: unknown }) : {};
  let config: ProxyConfig;
  try {
    config = readConfig(record.config);
  } catch (error) {
    const message = error instanceof Error ? error.message : "模型配置不正确";
    return jsonError(message, 400);
  }

  try {
    if (record.task === "path") {
      const input = record.input as { goal?: unknown; level?: unknown; weeklyHours?: unknown } | undefined;
      const goal = typeof input?.goal === "string" ? input.goal.trim() : "";
      const level = input?.level;
      const weeklyHours = Number(input?.weeklyHours);
      if (!goal || typeof level !== "string" || !LEVELS.has(level as LevelId) || !Number.isFinite(weeklyHours)) {
        return jsonError("请填写目标、水平和每周时间", 400);
      }
      const messages = pathMessages({ goal, level: level as LevelId, weeklyHours });
      const text = await complete(config, messages.system, messages.user);
      return Response.json({ result: normalizePath(parseModelJson(text)) });
    }
    if (record.task === "read") {
      const passage = typeof (record.input as { passage?: unknown } | undefined)?.passage === "string"
        ? (record.input as { passage: string }).passage.trim()
        : "";
      if (passage.length < 20) return jsonError("文章太短，至少贴上一段完整的话", 400);
      const messages = readMessages(passage.slice(0, 8000));
      const text = await complete(config, messages.system, messages.user);
      return Response.json({ result: normalizeRead(parseModelJson(text)) });
    }
    if (record.task === "feedback") {
      const input = record.input as { prompt?: unknown; writing?: unknown; words?: unknown } | undefined;
      const prompt = typeof input?.prompt === "string" ? input.prompt.trim() : "";
      const writing = typeof input?.writing === "string" ? input.writing.trim() : "";
      const words = Array.isArray(input?.words) ? input.words.filter((item): item is string => typeof item === "string") : [];
      if (!prompt || !writing) return jsonError("先写完短文再获取反馈", 400);
      const messages = feedbackMessages({ prompt, writing: writing.slice(0, 4000), words: words.slice(0, 8) });
      const text = await complete(config, messages.system, messages.user);
      return Response.json({ result: normalizeFeedback(parseModelJson(text)) });
    }
    return jsonError("不认识这个任务", 400);
  } catch (error) {
    const raw = error instanceof Error ? error.message : "模型请求失败";
    const timeout = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    const message = timeout ? "模型超时了，可以改用离线结果。" : sanitize(raw, config.apiKey);
    return jsonError(message || "模型请求失败", timeout ? 504 : 502);
  }
}
