"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { clozeOf, englishWord, gloss, headword } from "@/lib/cards";
import { ErrorNote, EmptyPanel, LoadingBlock, ModeNote, PageHeader } from "@/components/panels";
import { RatingButtons } from "@/components/rating-buttons";
import { useStudy } from "@/components/study-provider";
import { useModels } from "@/components/use-models";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { requestFeedback } from "@/lib/ai";
import { formatDateTime, formatInterval, ratingLabel } from "@/lib/format";
import type { ModelConfig } from "@/lib/models";
import { fallbackGlosses, offlineFeedback, writingPrompt } from "@/lib/offline";
import { Rating, previewCard, type Grade, type RecordLog } from "@/lib/scheduler";
import { commitReview } from "@/lib/study";
import { levenshtein, normalizeAnswer, shuffle, wordCount } from "@/lib/text";
import type { AiSource, CardRecord, FeedbackResult } from "@/lib/types";

const MODES = [
  { id: "recognition", label: "认词" },
  { id: "recall", label: "回忆" },
  { id: "cloze", label: "完形" },
  { id: "translation", label: "短译" },
  { id: "writing", label: "写作" },
] as const;

type Mode = (typeof MODES)[number]["id"];

interface ObjectiveResult {
  correct: boolean;
  rating: Grade;
  answer: string;
  detail: string;
  due: number;
  reviewedAt: number;
}

export function PracticeSession() {
  const data = useStudy();
  const models = useModels();
  const search = useSearchParams();
  const queryDeck = search.get("deck");
  const [deckChoice, setDeckChoice] = useState<{ query: string | null; id: string } | null>(null);
  const [mode, setMode] = useState<Mode>("recognition");
  const [seed, setSeed] = useState(1);
  const [progress, setProgress] = useState({ key: "", index: 0 });

  useEffect(() => {
    document.title = "英语练习 · 循迹";
  }, []);

  const deckId = !data
    ? ""
    : deckChoice && deckChoice.query === queryDeck && data.decks.some((deck) => deck.id === deckChoice.id)
      ? deckChoice.id
      : queryDeck && data.decks.some((deck) => deck.id === queryDeck)
        ? queryDeck
        : (data.decks[0]?.id ?? "");
  const membership =
    data?.cards
      .filter((card) => card.deckId === deckId && card.front.trim() && card.back.trim())
      .map((card) => card.id)
      .sort()
      .join(",") ?? "";
  const roundKey = `${deckId}:${mode}:${seed}:${membership}`;
  const order = useMemo(
    () => shuffle(membership ? membership.split(",") : [], `${deckId}:${mode}:${seed}`),
    [membership, deckId, mode, seed],
  );
  const index = progress.key === roundKey ? progress.index : 0;
  const step = mode === "writing" ? 3 : 1;
  const slice = order.slice(index, index + step);
  const turnCards = slice
    .map((id) => data?.cards.find((card) => card.id === id))
    .filter((card): card is CardRecord => Boolean(card));

  if (!data) return <LoadingBlock label="正在准备练习" />;

  const deckOptions = data.decks.map((deck) => ({ value: deck.id, label: deck.name }));
  const done = order.length > 0 && index >= order.length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="英语练习"
        title="用同一叠牌把词用出来"
        description="题目和反馈用英语，按钮用中文。认词、回忆、完形和短译会自动记入 FSRS；写作看完反馈后，由你给目标词打分。"
      />
      <ModeNote ready={models.ready} name={models.current?.displayName} />
      {data.decks.length === 0 ? (
        <EmptyPanel
          title="还没有牌组"
          body="先建一叠牌，或从阅读里收下生词。练习用的就是这些卡。"
          action={
            <Button nativeButton={false} render={<Link href="/decks" />}>
              去建牌组
            </Button>
          }
        />
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Select
              value={deckId || null}
              onValueChange={(value) => value && setDeckChoice({ query: queryDeck, id: value })}
              items={deckOptions}
            >
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue placeholder="选择牌组" />
              </SelectTrigger>
              <SelectContent>
                {deckOptions.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" onClick={() => setSeed((value) => value + 1)}>
              换一批
            </Button>
          </div>
          <Tabs value={mode} onValueChange={(value) => setMode(value as Mode)}>
            <TabsList className="h-auto! w-full flex-wrap justify-start">
              {MODES.map((item) => (
                <TabsTrigger key={item.id} value={item.id}>
                  {item.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          {order.length === 0 ? (
            <EmptyPanel
              title="这个牌组还没有卡片"
              body="加一张正面和背面都写好的卡，再回到这里。"
              action={
                deckId ? (
                  <Button nativeButton={false} render={<Link href={`/decks/${deckId}`} />} variant="outline">
                    打开牌组
                  </Button>
                ) : null
              }
            />
          ) : done || turnCards.length === 0 ? (
            <EmptyPanel
              title="这一轮做完了"
              body="可以换一批，或去复习里看这些卡的下次到期时间。"
              action={
                <Button type="button" onClick={() => setSeed((value) => value + 1)}>
                  再来一轮
                </Button>
              }
            />
          ) : (
            <PracticeTurn
              key={`${roundKey}:${index}`}
              mode={mode}
              cards={turnCards}
              pool={data.cards.filter((card) => card.deckId === deckId)}
              retention={data.retention}
              modelReady={models.ready}
              model={models.current}
              onAdvance={() => setProgress({ key: roundKey, index: index + step })}
            />
          )}
        </>
      )}
    </div>
  );
}

function PracticeTurn({
  mode,
  cards,
  pool,
  retention,
  modelReady,
  model,
  onAdvance,
}: {
  mode: Mode;
  cards: CardRecord[];
  pool: CardRecord[];
  retention: number;
  modelReady: boolean;
  model: ModelConfig | null;
  onAdvance: () => void;
}) {
  const card = cards[0];
  const [draft, setDraft] = useState("");
  const [tries, setTries] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [wrong, setWrong] = useState<string[]>([]);
  const [objective, setObjective] = useState<ObjectiveResult | null>(null);
  const [feedback, setFeedback] = useState<{ result: FeedbackResult; source: AiSource } | null>(null);
  const [feedbackError, setFeedbackError] = useState("");
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [rated, setRated] = useState<Record<string, { rating: Grade; due: number; reviewedAt: number }>>({});
  const [previews, setPreviews] = useState<Record<string, { now: number; log: RecordLog }>>({});
  const prompt = writingPrompt(cards.map((item) => englishWord(item)));
  const [options] = useState(() => {
    if (!card || mode !== "recognition") return [];
    const correct = gloss(card) || card.back;
    const others = pool
      .filter((item) => item.id !== card.id)
      .map((item) => gloss(item) || item.back)
      .filter((text) => text && text !== correct);
    const fillers = fallbackGlosses().filter((text) => text !== correct && !others.includes(text));
    const selected = [...new Set([...others, ...fillers])].filter((text) => text !== correct).slice(0, 3);
    return shuffle([correct, ...selected], `${card.id}:options`);
  });

  async function settle(target: CardRecord, rating: Grade, view: Omit<ObjectiveResult, "rating" | "due" | "reviewedAt">) {
    const now = new Date();
    const log = previewCard(target, now, retention);
    const updated = await commitReview(target.id, rating, log[rating].card, now.getTime());
    setObjective({ ...view, rating, due: updated.due, reviewedAt: now.getTime() });
  }

  async function chooseOption(option: string) {
    if (!card || objective) return;
    const correct = gloss(card) || card.back;
    setPicked(option);
    if (option === correct) {
      await settle(card, tries === 0 ? Rating.Good : Rating.Hard, {
        correct: true,
        answer: correct,
        detail: tries === 0 ? "第一次就选对了。" : "第二次选对了，间隔会短一些。",
      });
      return;
    }
    const nextTries = tries + 1;
    setTries(nextTries);
    setWrong((current) => [...current, option]);
    if (nextTries >= 2) {
      await settle(card, Rating.Again, {
        correct: false,
        answer: correct,
        detail: "两次都没选对，这张卡会很快再出现。",
      });
    }
  }

  async function checkTyped() {
    if (!card) return;
    const expected = mode === "cloze" ? clozeOf(card).answer : mode === "translation" ? englishWord(card) : headword(card);
    const rating = gradeAnswer(expected, draft, mode === "translation" ? "contains" : "exact");
    await settle(card, rating, {
      correct: rating !== Rating.Again,
      answer: expected,
      detail: rating === Rating.Good ? "答案对上了。" : rating === Rating.Hard ? "很接近，按困难记下。" : "还没对上，先看答案。",
    });
  }

  async function loadFeedback(forceOffline: boolean) {
    if (!draft.trim()) {
      setFeedbackError("先用英语写几句，再获取反馈。");
      return;
    }
    setFeedbackLoading(true);
    setFeedbackError("");
    const words = cards.map((item) => englishWord(item));
    const useModel = !forceOffline && modelReady && model;
    try {
      const result = useModel
        ? await requestFeedback({ prompt, writing: draft, words }, model)
        : offlineFeedback({ writing: draft, words });
      const now = new Date();
      const nextPreviews: Record<string, { now: number; log: RecordLog }> = {};
      for (const item of cards) {
        nextPreviews[item.id] = { now: now.getTime(), log: previewCard(item, now, retention) };
      }
      setPreviews(nextPreviews);
      setFeedback({ result, source: useModel ? "ai" : "offline" });
    } catch (error) {
      setFeedbackError(error instanceof Error ? error.message : "反馈没有生成");
    } finally {
      setFeedbackLoading(false);
    }
  }

  async function rateWriting(item: CardRecord, rating: Grade) {
    const preview = previews[item.id];
    if (!preview || rated[item.id]) return;
    const updated = await commitReview(item.id, rating, preview.log[rating].card, preview.now);
    setRated((current) => ({
      ...current,
      [item.id]: { rating, due: updated.due, reviewedAt: preview.now },
    }));
  }

  if (!card) return <LoadingBlock label="正在取下一题" />;

  if (mode === "writing") {
    return (
      <WritingPane
        prompt={prompt}
        cards={cards}
        draft={draft}
        onDraft={setDraft}
        loading={feedbackLoading}
        error={feedbackError}
        feedback={feedback}
        previews={previews}
        rated={rated}
        onFeedback={() => void loadFeedback(false)}
        onOffline={() => void loadFeedback(true)}
        onRate={(item, rating) => void rateWriting(item, rating)}
        onNext={onAdvance}
      />
    );
  }

  return (
    <ObjectivePane
      mode={mode}
      card={card}
      options={options}
      draft={draft}
      picked={picked}
      wrong={wrong}
      result={objective}
      onDraft={setDraft}
      onChoose={(option) => void chooseOption(option)}
      onCheck={() => void checkTyped()}
      onGiveUp={() =>
        void settle(card, Rating.Again, {
          correct: false,
          answer: mode === "cloze" ? clozeOf(card).answer : mode === "translation" ? englishWord(card) : headword(card),
          detail: "这题先记成重来。",
        })
      }
      onNext={onAdvance}
    />
  );
}

function gradeAnswer(expected: string, given: string, kind: "exact" | "contains"): Grade {
  const answer = normalizeAnswer(expected);
  const input = normalizeAnswer(given);
  if (!input || !answer) return Rating.Again;
  if (kind === "contains" ? input === answer || input.includes(answer) : input === answer) return Rating.Good;
  const distance = levenshtein(input, answer);
  const allowance = answer.length > 6 ? 2 : 1;
  if (distance <= allowance) return Rating.Hard;
  return Rating.Again;
}

function ObjectivePane({
  mode,
  card,
  options,
  draft,
  picked,
  wrong,
  result,
  onDraft,
  onChoose,
  onCheck,
  onGiveUp,
  onNext,
}: {
  mode: Mode;
  card: CardRecord;
  options: string[];
  draft: string;
  picked: string | null;
  wrong: string[];
  result: ObjectiveResult | null;
  onDraft: (value: string) => void;
  onChoose: (option: string) => void;
  onCheck: () => void;
  onGiveUp: () => void;
  onNext: () => void;
}) {
  const cloze = clozeOf(card);
  const stem =
    mode === "recognition"
      ? headword(card)
      : mode === "cloze"
        ? cloze.prompt
        : mode === "translation"
          ? gloss(card) || card.back
          : gloss(card) || card.back;
  const instruction =
    mode === "recognition"
      ? "选出词义"
      : mode === "cloze"
        ? "填出空缺的词"
        : mode === "translation"
          ? "用英语写出下面的意思"
          : "根据词义写出英语";

  return (
    <article className="rounded-3xl bg-card px-5 py-6 ring-1 ring-foreground/10 sm:px-8">
      <p className="text-xs text-muted-foreground">{instruction}</p>
      <p className="mt-4 font-heading text-3xl leading-snug">{stem}</p>
      {mode === "recognition" ? (
        <div className="mt-6 grid gap-2">
          {options.map((option) => {
            const missed = wrong.includes(option);
            const chosen = picked === option && result?.correct;
            return (
              <Button
                key={option}
                type="button"
                variant="outline"
                className={`h-auto justify-start px-3 py-3 text-left ${missed ? "border-destructive/40 text-destructive" : ""} ${chosen ? "border-emerald-800/30 bg-emerald-50" : ""}`}
                disabled={Boolean(result) || missed}
                onClick={() => onChoose(option)}
              >
                {option}
              </Button>
            );
          })}
        </div>
      ) : (
        <form
          className="mt-6 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            onCheck();
          }}
        >
          <Textarea value={draft} onChange={(event) => onDraft(event.target.value)} placeholder="Write in English" className="min-h-24" spellCheck disabled={Boolean(result)} />
          {!result ? (
            <div className="flex flex-wrap gap-2">
              <Button type="submit">核对</Button>
              <Button type="button" variant="outline" onClick={onGiveUp}>
                这题不会
              </Button>
            </div>
          ) : null}
        </form>
      )}
      {!result && mode === "recognition" ? (
        <Button type="button" variant="ghost" className="mt-3" onClick={onGiveUp}>
          这题不会
        </Button>
      ) : null}
      {result ? (
        <div className="mt-6 space-y-2 rounded-2xl bg-secondary px-4 py-4 text-sm leading-6">
          <p>{result.detail}</p>
          <p>答案：{result.answer}</p>
          <p>
            已记为「{ratingLabel(result.rating)}」。下次到期 {formatDateTime(result.due)}（{formatInterval(result.reviewedAt, result.due)}）。
          </p>
          <Button type="button" onClick={onNext}>
            下一题
          </Button>
        </div>
      ) : null}
    </article>
  );
}

function WritingPane({
  prompt,
  cards,
  draft,
  onDraft,
  loading,
  error,
  feedback,
  previews,
  rated,
  onFeedback,
  onOffline,
  onRate,
  onNext,
}: {
  prompt: string;
  cards: CardRecord[];
  draft: string;
  onDraft: (value: string) => void;
  loading: boolean;
  error: string;
  feedback: { result: FeedbackResult; source: AiSource } | null;
  previews: Record<string, { now: number; log: RecordLog }>;
  rated: Record<string, { rating: Grade; due: number; reviewedAt: number }>;
  onFeedback: () => void;
  onOffline: () => void;
  onRate: (card: CardRecord, rating: Grade) => void;
  onNext: () => void;
}) {
  const allRated = cards.length > 0 && cards.every((card) => rated[card.id]);
  return (
    <div className="space-y-4">
      <article className="rounded-3xl bg-card px-5 py-6 ring-1 ring-foreground/10 sm:px-8">
        <p className="text-xs text-muted-foreground">写作题</p>
        <p className="mt-3 text-lg leading-8">{prompt}</p>
        <p className="mt-2 text-xs text-muted-foreground">目标词：{cards.map((card) => englishWord(card)).join(", ") || "无"}</p>
        <Textarea value={draft} onChange={(event) => onDraft(event.target.value)} className="mt-4 min-h-36" placeholder="Write 40 to 80 words." spellCheck disabled={Boolean(feedback)} />
        <p className="mt-2 text-xs text-muted-foreground">{wordCount(draft)} words</p>
        {!feedback ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" disabled={loading} onClick={onFeedback}>
              {loading ? "正在看短文…" : "获取反馈"}
            </Button>
          </div>
        ) : null}
        {loading ? <div className="mt-4"><LoadingBlock label="正在对照目标词看你的短文" /></div> : null}
        {error ? (
          <div className="mt-4">
            <ErrorNote message={error} onRetry={onFeedback} extra={<Button type="button" variant="secondary" onClick={onOffline}>改用离线反馈</Button>} />
          </div>
        ) : null}
      </article>
      {feedback ? (
        <article className="space-y-4 rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
          <Badge variant="secondary">{feedback.source === "offline" ? "离线反馈" : "模型反馈"}</Badge>
          <div>
            <h2 className="text-lg">Comment</h2>
            <p className="mt-2 text-sm leading-7">{feedback.result.comment}</p>
          </div>
          {feedback.result.revised ? (
            <div>
              <h2 className="text-lg">A clearer version</h2>
              <p className="mt-2 text-sm leading-7">{feedback.result.revised}</p>
            </div>
          ) : null}
          {feedback.result.wordNotes.length > 0 ? (
            <ul className="space-y-1 text-sm leading-6">
              {feedback.result.wordNotes.map((note) => (
                <li key={note.word}>
                  <span className="font-medium">{note.word}</span> · {note.used ? "used" : "missing"} · {note.note}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="space-y-4 border-t border-border pt-4">
            <h2 className="text-lg">给这些词打分</h2>
            <p className="text-sm leading-6 text-muted-foreground">评分会计入复习。用过且写得顺，可以给良好或简单；没写出来就给重来或困难。</p>
            {cards.map((card) => {
              const preview = previews[card.id];
              const mark = rated[card.id];
              return (
                <div key={card.id} className="space-y-2">
                  <p className="text-sm font-medium">
                    {englishWord(card)} <span className="font-normal text-muted-foreground">· {gloss(card)}</span>
                  </p>
                  {mark ? (
                    <p className="text-sm text-muted-foreground">
                      已记为「{ratingLabel(mark.rating)}」，下次 {formatDateTime(mark.due)}（{formatInterval(mark.reviewedAt, mark.due)}）
                    </p>
                  ) : preview ? (
                    <RatingButtons preview={preview.log} now={preview.now} onRate={(rating) => onRate(card, rating)} />
                  ) : null}
                </div>
              );
            })}
            <Button type="button" disabled={!allRated} onClick={onNext}>
              下一篇
            </Button>
          </div>
        </article>
      ) : null}
    </div>
  );
}
