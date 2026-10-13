"use client";

import { percent, startOfDay } from "@/lib/format";
import { Rating, isDueToday } from "@/lib/scheduler";
import type { CardRecord, ReviewLogRecord } from "@/lib/types";

export function StatsStrip({
  cards,
  logs,
  retention,
}: {
  cards: CardRecord[];
  logs: ReviewLogRecord[];
  retention: number;
}) {
  const due = cards.filter((card) => isDueToday(card)).length;
  const reviewed = logs.filter((log) => log.reviewedAt >= startOfDay()).length;
  const recent = [...logs].sort((a, b) => b.reviewedAt - a.reviewedAt).slice(0, 50);
  const rate = recent.length === 0 ? null : recent.filter((log) => log.rating !== Rating.Again).length / recent.length;

  const items = [
    { label: "今日到期", value: String(due), hint: "不含未学的新卡" },
    { label: "今日已复习", value: String(reviewed), hint: "含练习里记入的评分" },
    {
      label: "保持率",
      value: rate === null ? "—" : percent(rate),
      hint: rate === null ? `还没有评分 · 目标 ${percent(retention)}` : `近 ${recent.length} 次 · 目标 ${percent(retention)}`,
    },
  ];

  return (
    <dl className="grid grid-cols-3 gap-2 sm:gap-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl bg-card px-3 py-3 ring-1 ring-foreground/10">
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd className="mt-1 font-heading text-2xl tabular-nums">{item.value}</dd>
          <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{item.hint}</p>
        </div>
      ))}
    </dl>
  );
}
