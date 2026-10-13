export const PROVIDERS = [
  {
    id: "openai",
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
  },
  {
    id: "anthropic",
    label: "Anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    model: "claude-sonnet-4-5",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    model: "gemini-2.5-flash",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
  },
  {
    id: "custom",
    label: "OpenAI 兼容",
    baseUrl: "https://api.example.com/v1",
    model: "",
  },
] as const;

export type ProviderId = (typeof PROVIDERS)[number]["id"];

export interface ModelConfig {
  id: string;
  displayName: string;
  provider: ProviderId;
  baseUrl: string;
  model: string;
  apiKey: string;
}

const STORAGE_KEY = "xunji.models.v1";
const ACTIVE_KEY = "xunji.activeModel.v1";
const EVENT = "xunji-models";

export interface ModelSnapshot {
  models: ModelConfig[];
  activeId: string | null;
}

const EMPTY: ModelSnapshot = { models: [], activeId: null };

function readSnapshot(): ModelSnapshot {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const models = raw ? (JSON.parse(raw) as ModelConfig[]) : [];
    const activeId = localStorage.getItem(ACTIVE_KEY);
    return {
      models: Array.isArray(models) ? models.filter(isModel) : [],
      activeId,
    };
  } catch {
    return EMPTY;
  }
}

function isModel(value: unknown): value is ModelConfig {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<ModelConfig>;
  return Boolean(item.id && item.displayName && item.provider && item.baseUrl && item.model);
}

function write(models: ModelConfig[], activeId: string | null) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(models));
  if (activeId) localStorage.setItem(ACTIVE_KEY, activeId);
  else localStorage.removeItem(ACTIVE_KEY);
  window.dispatchEvent(new Event(EVENT));
}

export function subscribeModels(onStoreChange: () => void) {
  window.addEventListener(EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

let cacheKey = "";
let cacheValue = EMPTY;

export function getModelSnapshot(): ModelSnapshot {
  if (typeof window === "undefined") return EMPTY;
  const key = `${localStorage.getItem(STORAGE_KEY) ?? ""}|${localStorage.getItem(ACTIVE_KEY) ?? ""}`;
  if (key === cacheKey) return cacheValue;
  cacheKey = key;
  cacheValue = readSnapshot();
  return cacheValue;
}

export function getServerModelSnapshot(): ModelSnapshot {
  return EMPTY;
}

export function providerPreset(id: ProviderId) {
  return PROVIDERS.find((item) => item.id === id) ?? PROVIDERS[0];
}

export function saveModel(input: ModelConfig) {
  const snapshot = readSnapshot();
  const models = snapshot.models.some((item) => item.id === input.id)
    ? snapshot.models.map((item) => (item.id === input.id ? input : item))
    : [...snapshot.models, input];
  const activeId = snapshot.activeId && models.some((item) => item.id === snapshot.activeId) ? snapshot.activeId : input.id;
  write(models, activeId);
}

export function deleteModel(id: string) {
  const snapshot = readSnapshot();
  const models = snapshot.models.filter((item) => item.id !== id);
  const activeId = snapshot.activeId === id ? (models[0]?.id ?? null) : snapshot.activeId;
  write(models, activeId);
}

export function setActiveModel(id: string) {
  const snapshot = readSnapshot();
  if (!snapshot.models.some((item) => item.id === id)) return;
  write(snapshot.models, id);
}

export function activeModel(snapshot: ModelSnapshot) {
  return snapshot.models.find((item) => item.id === snapshot.activeId) ?? null;
}

export function modelReady(model: ModelConfig | null) {
  return Boolean(model && model.apiKey.trim() && model.model.trim() && model.baseUrl.trim());
}

export function maskKey(apiKey: string) {
  const trimmed = apiKey.trim();
  if (trimmed.length <= 4) return "已保存";
  return `•••• ${trimmed.slice(-4)}`;
}
