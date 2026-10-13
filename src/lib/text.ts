export function uid() {
  return crypto.randomUUID();
}

export function clip(text: string, max: number) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max).trim()}…`;
}

export function looksEnglish(text: string) {
  const letters = text.match(/[A-Za-z]/g)?.length ?? 0;
  const cjk = text.match(/[\u4e00-\u9fff]/g)?.length ?? 0;
  return letters >= 2 && letters >= cjk;
}

export function splitSentences(text: string) {
  return text
    .split(/(?<=[。！？.!?;；])\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function splitParagraphs(text: string) {
  const chunks = text
    .split(/\n\s*\n/)
    .map((part) => part.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);
  if (chunks.length > 1) return chunks;
  const sentences = splitSentences(text.replace(/\s+/g, " ").trim());
  if (sentences.length <= 2) return [text.trim()].filter(Boolean);
  const groups: string[] = [];
  for (let index = 0; index < sentences.length; index += 2) {
    groups.push(sentences.slice(index, index + 2).join(""));
  }
  return groups;
}

export function normalizeAnswer(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[“”"‘’]/g, "")
    .replace(/[.,!?;:()[\]{}]/g, "")
    .replace(/\s+/g, " ");
}

export function levenshtein(a: string, b: string) {
  const left = a;
  const right = b;
  const rows = left.length + 1;
  const cols = right.length + 1;
  const matrix = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  for (let i = 0; i < rows; i += 1) matrix[i][0] = i;
  for (let j = 0; j < cols; j += 1) matrix[0][j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
    }
  }
  return matrix[left.length][right.length];
}

export function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function blankWord(sentence: string, word: string) {
  const trimmed = word.trim();
  if (!trimmed || !sentence.trim()) return null;
  if (looksEnglish(trimmed)) {
    const pattern = new RegExp(`\\b${escapeRegExp(trimmed)}\\b`, "i");
    if (!pattern.test(sentence)) return null;
    return sentence.replace(pattern, "____");
  }
  if (!sentence.includes(trimmed)) return null;
  return sentence.replace(trimmed, "____");
}

export function hashString(text: string) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function shuffle<T>(items: T[], seedText: string) {
  const copy = [...items];
  let seed = hashString(seedText) || 1;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

export function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
