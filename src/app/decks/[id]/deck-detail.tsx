"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyPanel, LoadingBlock } from "@/components/panels";
import { useStudy } from "@/components/study-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cardKindLabel } from "@/lib/cards";
import { formatDue, stateLabel } from "@/lib/format";
import { State } from "@/lib/scheduler";
import { createCard, deleteCard, deleteDeck, updateCardContent } from "@/lib/study";
import type { CardRecord, CardType } from "@/lib/types";

const TYPES = [
  { value: "basic", label: "普通" },
  { value: "vocab", label: "词汇" },
  { value: "cloze", label: "完形" },
];

export function DeckDetail() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const data = useStudy();
  const router = useRouter();
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [extra, setExtra] = useState("");
  const [type, setType] = useState<CardType>("vocab");
  const [editing, setEditing] = useState<CardRecord | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    document.title = "牌组详情 · 循迹";
  }, []);

  if (!data) return <LoadingBlock label="正在打开牌组" />;
  const deck = data.decks.find((item) => item.id === id);
  if (!deck) {
    return (
      <EmptyPanel
        title="找不到这个牌组"
        body="它可能已经删除。卡片不会跑到别的牌组里。"
        action={
          <Button nativeButton={false} render={<Link href="/decks" />} variant="outline">
            返回牌组
          </Button>
        }
      />
    );
  }

  const cards = data.cards
    .filter((card) => card.deckId === deck.id)
    .filter((card) => {
      const haystack = `${card.front} ${card.back} ${card.extra}`.toLowerCase();
      return haystack.includes(query.trim().toLowerCase());
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);

  async function addCard() {
    if (!front.trim() || !back.trim()) {
      toast.error("正面和背面都要写");
      return;
    }
    await createCard({ deckId: deck!.id, type, front, back, extra });
    setFront("");
    setBack("");
    setExtra("");
    toast.success("卡片已加入，可以马上复习");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/decks" className="text-xs text-primary">
            全部牌组
          </Link>
          <h1 className="mt-2 text-3xl sm:text-4xl">{deck.name}</h1>
          {deck.description ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{deck.description}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button nativeButton={false} render={<Link href={`/review?deck=${deck.id}`} />} variant="secondary">
            复习这个牌组
          </Button>
          <Button nativeButton={false} render={<Link href={`/practice?deck=${deck.id}`} />} variant="outline">
            用来练习
          </Button>
          <Button type="button" variant="destructive" onClick={() => setConfirmDelete(true)}>
            删除
          </Button>
        </div>
      </div>

      <form
        className="grid gap-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/10 md:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          void addCard();
        }}
      >
        <div className="space-y-2">
          <Label>类型</Label>
          <Select
            value={type}
            onValueChange={(value) => value && setType(value as CardType)}
            items={TYPES}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPES.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="front">{type === "cloze" ? "带空的句子" : "正面"}</Label>
          <Input id="front" value={front} onChange={(event) => setFront(event.target.value)} placeholder={type === "cloze" ? "Memory is not a ____." : "acquire"} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="back">{type === "cloze" ? "答案" : "背面"}</Label>
          <Input id="back" value={back} onChange={(event) => setBack(event.target.value)} placeholder={type === "vocab" ? "获得" : "warehouse"} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="extra">例句或备注</Label>
          <Input id="extra" value={extra} onChange={(event) => setExtra(event.target.value)} placeholder="You acquire a word by meeting it again." />
        </div>
        <div className="md:col-span-2">
          <Button type="submit">加入卡片</Button>
        </div>
      </form>

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl">卡片</h2>
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索" className="max-w-48" />
      </div>
      {cards.length === 0 ? (
        <p className="text-sm text-muted-foreground">{query ? "没有匹配的卡片。" : "这叠牌还是空的。加一张后就可以去复习。"}</p>
      ) : (
        <ul className="space-y-2">
          {cards.map((card) => (
            <li key={card.id} className="rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{cardKindLabel(card.type)}</Badge>
                    <Badge variant="secondary">{stateLabel(card.state)}</Badge>
                  </div>
                  <p className="mt-2 text-sm font-medium">{card.front}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{card.back}</p>
                  {card.extra ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{card.extra}</p> : null}
                  <p className="mt-2 text-xs text-muted-foreground">
                    {card.state === State.New ? "未复习" : `下次 ${formatDue(card.due)}`}
                    {card.reps > 0 ? ` · 稳定度 ${card.stability.toFixed(1)} · 难度 ${card.difficulty.toFixed(1)} · ${card.reps} 次` : ""}
                    {card.lapses > 0 ? ` · 遗忘 ${card.lapses}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setEditing(card)}>
                    编辑
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      void deleteCard(card.id).then(() => toast.success("卡片已删除"));
                    }}
                  >
                    删除
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>编辑卡片</DialogTitle>
            <DialogDescription>改文字不会重置记忆参数。</DialogDescription>
          </DialogHeader>
          {editing ? (
            <CardEditor
              card={editing}
              onClose={() => setEditing(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除「{deck.name}」？</DialogTitle>
            <DialogDescription>里面的卡片和复习记录会一起删掉。已经关联的路线阶段会解开，路线本身还在。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmDelete(false)}>
              留下
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                void deleteDeck(deck.id).then(() => {
                  toast.success("牌组已删除");
                  router.push("/decks");
                });
              }}
            >
              删除牌组
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CardEditor({ card, onClose }: { card: CardRecord; onClose: () => void }) {
  const [front, setFront] = useState(card.front);
  const [back, setBack] = useState(card.back);
  const [extra, setExtra] = useState(card.extra);
  const [type, setType] = useState<CardType>(card.type);

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!front.trim() || !back.trim()) {
          toast.error("正面和背面都要写");
          return;
        }
        void updateCardContent(card.id, { front, back, extra, type }).then(() => {
          toast.success("已保存");
          onClose();
        });
      }}
    >
      <div className="space-y-2">
        <Label>类型</Label>
        <Select value={type} onValueChange={(value) => value && setType(value as CardType)} items={TYPES}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPES.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="edit-front">正面</Label>
        <Textarea id="edit-front" value={front} onChange={(event) => setFront(event.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="edit-back">背面</Label>
        <Textarea id="edit-back" value={back} onChange={(event) => setBack(event.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="edit-extra">例句或备注</Label>
        <Textarea id="edit-extra" value={extra} onChange={(event) => setExtra(event.target.value)} />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          取消
        </Button>
        <Button type="submit">保存</Button>
      </DialogFooter>
    </form>
  );
}
