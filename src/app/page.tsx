"use client";

import Link from "next/link";
import { useEffect } from "react";
import { LoadingBlock, PageHeader } from "@/components/panels";
import { StatsStrip } from "@/components/stats-strip";
import { useStudy } from "@/components/study-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatToday, greeting, stateLabel } from "@/lib/format";
import { State, buildQueue, isDueToday } from "@/lib/scheduler";
import { levelLabel } from "@/lib/offline";

const STEPS = [
  { href: "/paths", title: "学习路线", body: "写下目标、水平和每周时间，得到可以开工的阶段。" },
  { href: "/read", title: "辅助阅读", body: "贴进一篇文章，收下生词或做成完形卡。" },
  { href: "/practice", title: "英语练习", body: "用同一叠牌做认词、回忆、完形、短译和短文。" },
  { href: "/review", title: "FSRS 复习", body: "重来、困难、良好、简单，下次到期由 FSRS-5 计算。" },
];

export default function HomePage() {
  const data = useStudy();
  useEffect(() => {
    document.title = "今日 · 循迹";
  }, []);
  if (!data) return <LoadingBlock label="正在打开今天的学习桌" />;

  const due = data.cards.filter((card) => isDueToday(card)).length;
  const fresh = data.cards.filter((card) => card.state === State.New).length;
  const queue = buildQueue(data.cards).length;
  const path = data.paths[0];
  const linked = path?.stages.filter((stage) => stage.deckId).length ?? 0;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={formatToday()}
        title={`${greeting()}。${queue > 0 ? `有 ${queue} 张卡可以现在过。` : "今天还没有要翻的卡片。"}`}
        description="循迹把路线、阅读、英语练习和复习接在同一套牌组上。卡片留在这台浏览器里。"
        action={
          <Button nativeButton={false} render={<Link href="/review" />} size="lg">
            {queue > 0 ? "开始复习" : "打开复习"}
          </Button>
        }
      />
      <StatsStrip cards={data.cards} logs={data.logs} retention={data.retention} />
      <p className="text-sm text-muted-foreground">
        今日到期 {due} 张，另有新卡 {fresh} 张。复习一轮最多带上 20 张新卡。
      </p>

      {data.cards.length === 0 && data.paths.length === 0 ? (
        <section className="grid gap-3 sm:grid-cols-2">
          {STEPS.map((step, index) => (
            <Link key={step.href} href={step.href} className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10 hover:ring-primary/40">
              <p className="text-xs text-primary">0{index + 1}</p>
              <h2 className="mt-2 text-xl">{step.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.body}</p>
            </Link>
          ))}
        </section>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl">最近的路线</h2>
              <Link href="/paths" className="text-sm text-primary">
                全部路线
              </Link>
            </div>
            {path ? (
              <Link href={`/paths/${path.id}`} className="mt-3 block rounded-xl bg-secondary/70 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg">{path.title}</h3>
                  <Badge variant="secondary">{path.source === "offline" ? "离线草案" : "模型生成"}</Badge>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{path.overview}</p>
                <p className="mt-3 text-xs text-muted-foreground">
                  {levelLabel(path.level)} · 每周 {path.weeklyHours} 小时 · 已关联 {linked}/{path.stages.length} 个阶段牌组
                </p>
              </Link>
            ) : (
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                还没有路线。先去写下一个具体目标，离线也能生成阶段。
              </p>
            )}
          </section>
          <section className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl">牌组</h2>
              <Link href="/decks" className="text-sm text-primary">
                管理
              </Link>
            </div>
            {data.decks.length === 0 ? (
              <p className="mt-3 text-sm leading-6 text-muted-foreground">建一叠牌，或从阅读里把生词收进来。</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {data.decks.slice(0, 5).map((deck) => {
                  const cards = data.cards.filter((card) => card.deckId === deck.id);
                  const dueCount = cards.filter((card) => isDueToday(card) || card.state === State.New).length;
                  return (
                    <li key={deck.id}>
                      <Link href={`/decks/${deck.id}`} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-muted">
                        <span>
                          <span className="block text-sm font-medium">{deck.name}</span>
                          <span className="text-xs text-muted-foreground">{cards.length} 张</span>
                        </span>
                        <span className="text-xs text-muted-foreground">{dueCount > 0 ? `${dueCount} 张可学` : stateLabel(State.Review)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
