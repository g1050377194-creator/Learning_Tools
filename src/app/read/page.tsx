"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ErrorNote, LoadingBlock, ModeNote, PageHeader } from "@/components/panels";
import { useStudy } from "@/components/study-provider";
import { useModels } from "@/components/use-models";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { requestRead } from "@/lib/ai";
import { SAMPLE_PASSAGE, offlineRead } from "@/lib/offline";
import { createCard, createDeck } from "@/lib/study";
import { blankWord } from "@/lib/text";
import type { AiSource, ReadResult, VocabItem } from "@/lib/types";

export default function ReadPage() {
  const data = useStudy();
  const models = useModels();
  const [passage, setPassage] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "done">("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<ReadResult | null>(null);
  const [source, setSource] = useState<AiSource>("offline");
  const [deckChoice, setDeckChoice] = useState<string | null>(null);
  const [newDeck, setNewDeck] = useState("");
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const deckId =
    data && deckChoice && data.decks.some((deck) => deck.id === deckChoice)
      ? deckChoice
      : (data?.decks[0]?.id ?? "");

  useEffect(() => {
    document.title = "辅助阅读 · 循迹";
  }, []);

  async function analyze(forceOffline: boolean) {
    const text = passage.trim();
    if (text.length < 20) {
      setStatus("error");
      setError("再贴长一点。至少一段完整的话，离线模式和模型都需要上下文。");
      return;
    }
    setStatus("loading");
    setError("");
    const useModel = !forceOffline && models.ready && models.current;
    try {
      const next = useModel ? await requestRead(text.slice(0, 8000), models.current!) : offlineRead(text);
      setResult(next);
      setSource(useModel ? "ai" : "offline");
      setStatus("done");
    } catch (cause) {
      setStatus("error");
      setError(cause instanceof Error ? cause.message : "没有读完");
    }
  }

  async function ensureDeck() {
    if (deckId) return deckId;
    const name = newDeck.trim();
    if (!name) {
      toast.error("先选择牌组，或写一个新牌组的名字");
      return "";
    }
    const deck = await createDeck({ name, description: "从阅读里收下的卡片" });
    setDeckChoice(deck.id);
    setNewDeck("");
    return deck.id;
  }

  async function addWord(item: VocabItem, kind: "vocab" | "cloze") {
    const target = await ensureDeck();
    if (!target) return;
    const key = `${target}:${kind}:${item.word}`;
    if (kind === "vocab") {
      await createCard({
        deckId: target,
        type: "vocab",
        front: item.word,
        back: item.meaning,
        extra: item.example,
      });
    } else {
      const front = blankWord(item.example, item.word) ?? `____（${item.meaning}）`;
      await createCard({
        deckId: target,
        type: "cloze",
        front,
        back: `${item.word} · ${item.meaning}`,
        extra: item.example,
      });
    }
    setAdded((current) => ({ ...current, [key]: true }));
    toast.success(kind === "vocab" ? `「${item.word}」已收入牌组` : `「${item.word}」已做成完形卡`);
  }

  if (!data) return <LoadingBlock label="正在准备阅读台" />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="辅助阅读"
        title="贴进一篇文章，把生词留成卡片"
        description="会得到短摘要、按段说明、难句和词汇。每个词可以一键收进牌组，或做成完形。"
      />
      <ModeNote ready={models.ready} name={models.current?.displayName} />
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          void analyze(false);
        }}
      >
        <Label htmlFor="passage">文章或段落</Label>
        <Textarea
          id="passage"
          value={passage}
          onChange={(event) => setPassage(event.target.value)}
          placeholder="把英语文章或中文讲义贴在这里。"
          className="min-h-48"
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={status === "loading"}>
            {status === "loading" ? "正在读…" : models.ready ? "开始阅读" : "用离线方式阅读"}
          </Button>
          <button type="button" className="text-xs text-primary" onClick={() => setPassage(SAMPLE_PASSAGE)}>
            填入示例短文
          </button>
          {passage.length > 8000 ? <span className="text-xs text-muted-foreground">模型只会看前 8000 字，离线会看全文。</span> : null}
        </div>
      </form>
      {status === "loading" ? <LoadingBlock label="正在整理摘要、难句和词汇" /> : null}
      {status === "error" ? (
        <ErrorNote
          message={error}
          onRetry={() => void analyze(false)}
          extra={
            <Button type="button" variant="secondary" onClick={() => void analyze(true)}>
              改用离线阅读
            </Button>
          }
        />
      ) : null}
      {status === "done" && result ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{source === "offline" ? "离线摘录" : `模型 · ${models.current?.displayName ?? "已调用"}`}</Badge>
          </div>
          <section className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
            <h2 className="text-xl">摘要</h2>
            <p className="mt-2 text-sm leading-7">{result.summary}</p>
          </section>
          <section className="space-y-3">
            <h2 className="text-xl">分段说明</h2>
            {result.paragraphs.length === 0 ? <p className="text-sm text-muted-foreground">没有拆出段落。</p> : null}
            {result.paragraphs.map((paragraph) => (
              <article key={paragraph.original} className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
                <p className="text-sm leading-7">{paragraph.original}</p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{paragraph.explanation}</p>
              </article>
            ))}
          </section>
          <section className="space-y-3">
            <h2 className="text-xl">难句</h2>
            {result.difficult.length === 0 ? <p className="text-sm text-muted-foreground">这篇里没有特别长或转折很多的句子。</p> : null}
            {result.difficult.map((item) => (
              <article key={item.sentence} className="rounded-xl border border-border px-4 py-3">
                <p className="text-sm leading-7">{item.sentence}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.note}</p>
              </article>
            ))}
          </section>
          <section className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <h2 className="text-xl">词汇</h2>
              <div className="flex flex-wrap items-end gap-2">
                {data.decks.length > 0 ? (
                  <Select
                    value={deckId || null}
                    onValueChange={(value) => value && setDeckChoice(value)}
                    items={data.decks.map((deck) => ({ value: deck.id, label: deck.name }))}
                  >
                    <SelectTrigger className="w-full sm:w-56">
                      <SelectValue placeholder="选择牌组" />
                    </SelectTrigger>
                    <SelectContent>
                      {data.decks.map((deck) => (
                        <SelectItem key={deck.id} value={deck.id}>
                          {deck.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
                <Input value={newDeck} onChange={(event) => setNewDeck(event.target.value)} placeholder="或新建牌组" className="w-full sm:w-40" />
              </div>
            </div>
            {result.vocabulary.length === 0 ? <p className="text-sm text-muted-foreground">没有抽出适合做卡的词。可以换一篇，或在牌组里手写。</p> : null}
            <ul className="space-y-2">
              {result.vocabulary.map((item) => {
                const vocabKey = `${deckId}:vocab:${item.word}`;
                const clozeKey = `${deckId}:cloze:${item.word}`;
                return (
                  <li key={`${item.word}-${item.example}`} className="rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-medium">{item.word}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{item.meaning}</p>
                        {item.example ? <p className="mt-2 text-sm leading-6">{item.example}</p> : null}
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button type="button" size="sm" disabled={added[vocabKey]} onClick={() => void addWord(item, "vocab")}>
                          {added[vocabKey] ? "已收入" : "收入牌组"}
                        </Button>
                        <Button type="button" size="sm" variant="outline" disabled={added[clozeKey]} onClick={() => void addWord(item, "cloze")}>
                          {added[clozeKey] ? "已做成完形" : "做成完形"}
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      ) : null}
    </div>
  );
}
