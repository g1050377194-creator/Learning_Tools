"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyPanel, LoadingBlock } from "@/components/panels";
import { useStudy } from "@/components/study-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { levelLabel } from "@/lib/offline";
import { createDeck, deletePath, linkStageDeck } from "@/lib/study";

export function PathDetail() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const data = useStudy();
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [linkChoice, setLinkChoice] = useState<Record<string, string>>({});

  useEffect(() => {
    document.title = "路线详情 · 循迹";
  }, []);

  if (!data) return <LoadingBlock label="正在打开这条路线" />;
  const path = data.paths.find((item) => item.id === id);
  if (!path) {
    return (
      <EmptyPanel
        title="找不到这条路线"
        body="它可能已经删掉了。回到列表可以再生成一条。"
        action={
          <Button nativeButton={false} render={<Link href="/paths" />} variant="outline">
            返回路线
          </Button>
        }
      />
    );
  }

  async function makeDeck(stageId: string, title: string) {
    setPending(stageId);
    try {
      const deck = await createDeck({
        name: title,
        description: `来自路线「${path?.title ?? ""}」`,
        pathId: path?.id,
        stageId,
      });
      await linkStageDeck(path!.id, stageId, deck.id);
      toast.success(`已建立并关联「${deck.name}」`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "牌组没有建成");
    } finally {
      setPending(null);
    }
  }

  async function attach(stageId: string, deckId: string | null) {
    if (!deckId) {
      toast.error("先选一个已有牌组");
      return;
    }
    if (path?.stages.some((stage) => stage.id === stageId && stage.deckId === deckId)) {
      setLinkChoice((current) => ({ ...current, [stageId]: deckId }));
      return;
    }
    setLinkChoice((current) => ({ ...current, [stageId]: deckId }));
    try {
      await linkStageDeck(path!.id, stageId, deckId);
      toast.success("已关联牌组");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "没有关联上");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/paths" className="text-xs text-primary">
            全部路线
          </Link>
          <h1 className="mt-2 text-3xl sm:text-4xl">{path.title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{path.overview}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            void deletePath(path.id).then(() => {
              toast.success("路线已删除，牌组还在");
              router.push("/paths");
            });
          }}
        >
          删除路线
        </Button>
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        <Badge variant="secondary">{path.source === "offline" ? "离线草案" : "模型生成"}</Badge>
        <Badge variant="outline">{levelLabel(path.level)}</Badge>
        <Badge variant="outline">每周 {path.weeklyHours} 小时</Badge>
      </div>
      <p className="text-sm leading-6 text-muted-foreground">目标：{path.goal}</p>
      <ol className="space-y-4">
        {path.stages.map((stage, index) => {
          const deck = data.decks.find((item) => item.id === stage.deckId);
          return (
            <li key={stage.id} className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
              <div className="flex flex-wrap items-baseline gap-2">
                <p className="text-xs text-primary">阶段 {index + 1}</p>
                <h2 className="text-xl">{stage.title}</h2>
                <span className="text-xs text-muted-foreground">约 {stage.weeks} 周</span>
              </div>
              <p className="mt-2 text-sm leading-6">{stage.summary}</p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <h3 className="text-sm font-medium">里程碑</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-sm leading-6 text-muted-foreground">
                    {stage.milestones.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="text-sm font-medium">建议练习</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-sm leading-6 text-muted-foreground">
                    {stage.practice.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center">
                {deck ? (
                  <Button nativeButton={false} render={<Link href={`/decks/${deck.id}`} />} variant="secondary">
                    打开牌组「{deck.name}」
                  </Button>
                ) : (
                  <Button type="button" disabled={pending === stage.id} onClick={() => void makeDeck(stage.id, stage.title)}>
                    {pending === stage.id ? "正在建牌组…" : "为此阶段建牌组"}
                  </Button>
                )}
                {data.decks.length > 0 ? (
                  <div className="flex flex-1 flex-wrap items-center gap-2">
                    <Select
                      value={linkChoice[stage.id] ?? stage.deckId ?? null}
                      onValueChange={(value) => {
                        if (!value || value === stage.deckId) return;
                        void attach(stage.id, value);
                      }}
                      items={data.decks.map((item) => ({ value: item.id, label: item.name }))}
                    >
                      <SelectTrigger className="w-full sm:w-56">
                        <SelectValue placeholder="关联已有牌组" />
                      </SelectTrigger>
                      <SelectContent>
                        {data.decks.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="outline" onClick={() => void attach(stage.id, linkChoice[stage.id] ?? stage.deckId)}>
                      关联
                    </Button>
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
