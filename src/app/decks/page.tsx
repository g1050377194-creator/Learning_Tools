"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LoadingBlock, PageHeader } from "@/components/panels";
import { useStudy } from "@/components/study-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { State, isDueToday } from "@/lib/scheduler";
import { createDeck } from "@/lib/study";

export default function DecksPage() {
  const data = useStudy();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.title = "牌组 · 循迹";
  }, []);

  async function onCreate() {
    if (!name.trim()) {
      toast.error("先给牌组起个名字");
      return;
    }
    setSaving(true);
    try {
      const deck = await createDeck({ name, description });
      setName("");
      setDescription("");
      toast.success(`已建立「${deck.name}」`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "没有建成");
    } finally {
      setSaving(false);
    }
  }

  if (!data) return <LoadingBlock label="正在读取牌组" />;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="牌组"
        title="所有卡片都住在这里"
        description="路线、阅读和练习加进来的卡，都按牌组收着。刷新之后还在，因为数据写在这台浏览器的 IndexedDB 里。"
      />
      <form
        className="grid gap-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/10 md:grid-cols-[1fr_1fr_auto] md:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          void onCreate();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="deck-name">牌组名称</Label>
          <Input id="deck-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：技术阅读词汇" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="deck-desc">一句话说明</Label>
          <Textarea id="deck-desc" value={description} onChange={(event) => setDescription(event.target.value)} className="min-h-10" placeholder="这叠牌用来做什么" />
        </div>
        <Button type="submit" disabled={saving}>
          {saving ? "正在建立…" : "建立牌组"}
        </Button>
      </form>
      {data.decks.length === 0 ? (
        <p className="text-sm leading-6 text-muted-foreground">还没有牌组。先建一叠，再加卡片，或者从阅读里把生词收进来。</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {data.decks.map((deck) => {
            const cards = data.cards.filter((card) => card.deckId === deck.id);
            const due = cards.filter((card) => isDueToday(card)).length;
            const fresh = cards.filter((card) => card.state === State.New).length;
            return (
              <li key={deck.id}>
                <Link href={`/decks/${deck.id}`} className="block h-full rounded-2xl bg-card p-4 ring-1 ring-foreground/10 hover:ring-primary/40">
                  <h2 className="text-xl">{deck.name}</h2>
                  {deck.description ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{deck.description}</p> : null}
                  <p className="mt-3 text-xs text-muted-foreground">
                    {cards.length} 张 · 新卡 {fresh} · 今日到期 {due}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
