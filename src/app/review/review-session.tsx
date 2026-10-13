"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { FSRSVersion } from "ts-fsrs";
import { EmptyPanel, LoadingBlock, PageHeader } from "@/components/panels";
import { RatingButtons } from "@/components/rating-buttons";
import { StatsStrip } from "@/components/stats-strip";
import { useStudy } from "@/components/study-provider";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateTime, formatDue, formatInterval, ratingLabel, stateLabel } from "@/lib/format";
import { NEW_CARD_LIMIT, Rating, State, buildQueue, previewCard, type Grade } from "@/lib/scheduler";
import { commitReview } from "@/lib/study";
import type { CardRecord } from "@/lib/types";

export function ReviewSession() {
  const data = useStudy();
  const search = useSearchParams();
  const queryDeck = search.get("deck") ?? "";
  const [picked, setPicked] = useState<{ query: string; id: string } | null>(null);
  const [round, setRound] = useState(0);
  const [cursorState, setCursorState] = useState<{ key: string; cursor: number }>({ key: "", cursor: 0 });
  const deckId = picked && picked.query === queryDeck ? picked.id : queryDeck || "all";

  useEffect(() => {
    document.title = "复习 · 循迹";
  }, []);

  const membership =
    data?.cards
      .filter((card) => deckId === "all" || card.deckId === deckId)
      .map((card) => card.id)
      .sort()
      .join(",") ?? "";
  const queueKey = `${deckId}:${round}:${membership}`;
  const [frozen, setFrozen] = useState<{ key: string; ids: string[] } | null>(null);
  if (data && frozen?.key !== queueKey) {
    const allowed = new Set(membership ? membership.split(",") : []);
    const pool = data.cards.filter((card) => allowed.has(card.id));
    setFrozen({ key: queueKey, ids: buildQueue(pool).map((card) => card.id) });
  }
  const queueIds = frozen?.key === queueKey ? frozen.ids : [];
  const cursor = cursorState.key === queueKey ? cursorState.cursor : 0;

  if (!data) return <LoadingBlock label="正在准备复习" />;

  const pool = data.cards.filter((card) => deckId === "all" || card.deckId === deckId);
  const fresh = pool.filter((card) => card.state === State.New).length;
  const sessionReady = frozen?.key === queueKey;
  const card = data.cards.find((item) => item.id === queueIds[cursor]);
  const options = [{ value: "all", label: "全部牌组" }, ...data.decks.map((deck) => ({ value: deck.id, label: deck.name }))];
  const finished = sessionReady && cursor >= queueIds.length;

  function chooseDeck(value: string) {
    setPicked({ query: queryDeck, id: value });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="复习"
        title="按 FSRS 决定下次什么时候见"
        description="先看正面，再翻面。重来、困难、良好、简单对应的间隔来自 ts-fsrs 的 FSRS-5，评分会写回这张卡的到期时间。"
      />
      <StatsStrip cards={pool} logs={data.logs.filter((log) => deckId === "all" || log.deckId === deckId)} retention={data.retention} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Select value={deckId} onValueChange={(value) => value && chooseDeck(value)} items={options}>
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {queueIds.length === 0 ? "本轮没有卡片" : `第 ${Math.min(cursor + 1, queueIds.length)} / ${queueIds.length} 张`}
          {fresh > NEW_CARD_LIMIT ? ` · 新卡超过 ${NEW_CARD_LIMIT} 张，其余留到下一轮` : ""}
          {" · "}
          {FSRSVersion}
        </p>
      </div>

      {data.cards.length === 0 ? (
        <EmptyPanel
          title="还没有可以复习的卡片"
          body="先建一个牌组并加一张卡，或者从阅读里收下生词。新卡会马上出现在这一轮里。"
          action={
            <Button nativeButton={false} render={<Link href="/decks" />}>
              去建牌组
            </Button>
          }
        />
      ) : !sessionReady ? (
        <LoadingBlock label="正在排列这一轮" />
      ) : pool.length === 0 ? (
        <EmptyPanel
          title="这个牌组还没有卡片"
          body="加一张卡，或从阅读里把生词收进来。新卡会进入这一轮。"
          action={
            <Button nativeButton={false} render={<Link href={deckId === "all" ? "/decks" : `/decks/${deckId}`} />} variant="outline">
              打开牌组
            </Button>
          }
        />
      ) : finished || !card ? (
        <RoundEmpty
          pool={pool}
          onRestart={() => {
            setRound((value) => value + 1);
            setCursorState({ key: "", cursor: 0 });
          }}
        />
      ) : (
        <ReviewCard
          key={`${queueKey}:${cursor}:${card.id}`}
          card={card}
          deckName={data.decks.find((deck) => deck.id === card.deckId)?.name ?? ""}
          retention={data.retention}
          onNext={() => setCursorState({ key: queueKey, cursor: cursor + 1 })}
        />
      )}
    </div>
  );
}

function ReviewCard({
  card,
  deckName,
  retention,
  onNext,
}: {
  card: CardRecord;
  deckName: string;
  retention: number;
  onNext: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    rating: Grade;
    before: string;
    due: number;
    reviewedAt: number;
    stability: number;
    difficulty: number;
    reps: number;
    state: number;
  } | null>(null);
  const preview = useMemo(() => {
    const now = new Date();
    return { now, log: previewCard(card, now, retention) };
  }, [card, retention]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) return;
      if (event.key === " " && !revealed && !result) {
        event.preventDefault();
        setRevealed(true);
      }
      if (result && event.key === "Enter") {
        event.preventDefault();
        onNext();
      }
      if (revealed && !result && !busy) {
        const map: Record<string, Grade> = {
          "1": Rating.Again,
          "2": Rating.Hard,
          "3": Rating.Good,
          "4": Rating.Easy,
        };
        const rating = map[event.key];
        if (rating) void rate(rating);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  async function rate(rating: Grade) {
    if (busy || result) return;
    setBusy(true);
    try {
      const next = preview.log[rating].card;
      const updated = await commitReview(card.id, rating, next, preview.now.getTime());
      setResult({
        rating,
        before: card.state === State.New ? "新卡，原来可以立即学习" : formatDue(card.due, preview.now.getTime()),
        due: updated.due,
        reviewedAt: preview.now.getTime(),
        stability: updated.stability,
        difficulty: updated.difficulty,
        reps: updated.reps,
        state: updated.state,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "这次评分没有记下");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="rounded-3xl bg-card px-5 py-6 ring-1 ring-foreground/10 sm:px-8">
      <p className="text-xs text-muted-foreground">
        {stateLabel(card.state)} · {deckName}
      </p>
      <p className="mt-6 font-heading text-3xl leading-snug sm:text-4xl">{card.front}</p>
      {revealed || result ? (
        <div className="mt-6 border-t border-border pt-5">
          <p className="text-lg leading-7">{card.back}</p>
          {card.extra ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{card.extra}</p> : null}
        </div>
      ) : (
        <Button type="button" className="mt-8" size="lg" onClick={() => setRevealed(true)}>
          显示答案
        </Button>
      )}
      {revealed && !result ? (
        <div className="mt-6 space-y-3">
          <p className="text-xs text-muted-foreground">空格翻面，1 到 4 评分。按钮上的时间就是这次评分后的间隔。</p>
          <RatingButtons preview={preview.log} now={preview.now.getTime()} disabled={busy} onRate={(rating) => void rate(rating)} />
        </div>
      ) : null}
      {result ? (
        <div className="mt-6 space-y-3 rounded-2xl bg-secondary px-4 py-4">
          <p className="text-sm">已记为「{ratingLabel(result.rating)}」。</p>
          <p className="text-sm leading-6">
            之前：{result.before}
            <br />
            下次到期：{formatDateTime(result.due)}（{formatInterval(result.reviewedAt, result.due)}）
          </p>
          <p className="text-xs text-muted-foreground">
            {stateLabel(result.state)} · 稳定度 {result.stability.toFixed(2)} · 难度 {result.difficulty.toFixed(2)} · 第 {result.reps} 次
          </p>
          <Button type="button" onClick={onNext}>
            下一张
          </Button>
        </div>
      ) : null}
    </article>
  );
}

function RoundEmpty({ pool, onRestart }: { pool: CardRecord[]; onRestart: () => void }) {
  const upcoming = [...pool].filter((card) => card.state !== State.New).sort((a, b) => a.due - b.due)[0];
  return (
    <EmptyPanel
      title="这一轮没有要翻的卡片"
      body={
        upcoming
          ? `最近一张在 ${formatDue(upcoming.due)}。到点再来，或先去加新卡、做一次练习。`
          : "牌组里的卡都还没到复习时间。可以去阅读里再收几个词。"
      }
      action={
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onRestart}>
            重新排这一轮
          </Button>
          <Button nativeButton={false} render={<Link href="/read" />} variant="secondary">
            去阅读
          </Button>
        </div>
      }
    />
  );
}
