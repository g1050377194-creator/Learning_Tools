"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ErrorNote, LoadingBlock, ModeNote, PageHeader } from "@/components/panels";
import { useStudy } from "@/components/study-provider";
import { useModels } from "@/components/use-models";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { requestPath } from "@/lib/ai";
import { formatDateTime } from "@/lib/format";
import { SAMPLE_GOAL, levelLabel, offlinePath } from "@/lib/offline";
import { savePath } from "@/lib/study";
import { LEVELS, type LevelId } from "@/lib/types";

export default function PathsPage() {
  const data = useStudy();
  const models = useModels();
  const router = useRouter();
  const [goal, setGoal] = useState("");
  const [level, setLevel] = useState<LevelId>("basic");
  const [hours, setHours] = useState(6);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = "学习路线 · 循迹";
  }, []);

  async function generate(forceOffline: boolean) {
    const trimmed = goal.trim();
    if (trimmed.length < 2) {
      setError("先写下一个具体目标，比如“能读懂英语技术文章”。");
      setStatus("error");
      return;
    }
    setStatus("loading");
    setError("");
    const weeklyHours = Math.min(40, Math.max(1, Math.round(Number(hours)) || 1));
    const input = { goal: trimmed, level, weeklyHours };
    const useModel = !forceOffline && models.ready && models.current;
    try {
      const draft = useModel ? await requestPath(input, models.current!) : offlinePath(input);
      const saved = await savePath(draft, {
        goal: trimmed,
        level,
        weeklyHours,
        source: useModel ? "ai" : "offline",
      });
      router.push(`/paths/${saved.id}`);
    } catch (cause) {
      setStatus("error");
      setError(cause instanceof Error ? cause.message : "路线没有生成");
    }
  }

  if (!data) return <LoadingBlock label="正在读取已保存的路线" />;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="学习路线"
        title="把目标拆成能开工的阶段"
        description="填目标、当前水平和每周时间。有模型就用模型，没有密钥就生成本机草案。路线保存在这台浏览器里。"
      />
      <ModeNote ready={models.ready} name={models.current?.displayName} />
      <form
        className="grid gap-4 rounded-2xl bg-card p-4 ring-1 ring-foreground/10 md:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          void generate(false);
        }}
      >
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="goal">学习目标</Label>
          <Textarea
            id="goal"
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
            placeholder={SAMPLE_GOAL}
            className="min-h-24"
          />
          <button type="button" className="text-xs text-primary" onClick={() => setGoal(SAMPLE_GOAL)}>
            填入示例目标
          </button>
        </div>
        <div className="space-y-2">
          <Label>当前水平</Label>
          <Select
            value={level}
            onValueChange={(value) => value && setLevel(value as LevelId)}
            items={LEVELS.map((item) => ({ value: item.id, label: item.label }))}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEVELS.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="hours">每周可投入（小时）</Label>
          <Input
            id="hours"
            type="number"
            min={1}
            max={40}
            value={hours}
            onChange={(event) => setHours(Number(event.target.value))}
          />
        </div>
        <div className="flex flex-wrap gap-2 md:col-span-2">
          <Button type="submit" disabled={status === "loading"}>
            {status === "loading" ? "正在整理路线…" : models.ready ? "生成路线" : "生成离线草案"}
          </Button>
        </div>
        {status === "loading" ? <LoadingBlock label="正在按你的时间和水平排阶段" /> : null}
        {status === "error" ? (
          <div className="md:col-span-2">
            <ErrorNote
              message={error}
              onRetry={() => void generate(false)}
              extra={
                <Button type="button" variant="secondary" onClick={() => void generate(true)}>
                  改用离线草案
                </Button>
              }
            />
          </div>
        ) : null}
      </form>

      <section className="space-y-3">
        <h2 className="text-xl">已保存</h2>
        {data.paths.length === 0 ? (
          <p className="text-sm leading-6 text-muted-foreground">还没有路线。上面的表单提交后会留在这里，刷新也不会丢。</p>
        ) : (
          <ul className="space-y-3">
            {data.paths.map((path) => (
              <li key={path.id}>
                <Link href={`/paths/${path.id}`} className="block rounded-2xl bg-card p-4 ring-1 ring-foreground/10 hover:ring-primary/40">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg">{path.title}</h3>
                    <Badge variant="secondary">{path.source === "offline" ? "离线草案" : "模型生成"}</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{path.goal}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {levelLabel(path.level)} · 每周 {path.weeklyHours} 小时 · {path.stages.length} 个阶段 · {formatDateTime(path.createdAt)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
