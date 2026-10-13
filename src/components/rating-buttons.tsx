"use client";

import { Button } from "@/components/ui/button";
import { formatInterval } from "@/lib/format";
import { Rating, type Grade, type RecordLog } from "@/lib/scheduler";

const ITEMS: { rating: Grade; label: string; hint: string; className: string }[] = [
  {
    rating: Rating.Again,
    label: "重来",
    hint: "没想起来",
    className: "border-destructive/40 bg-destructive/5 text-destructive hover:bg-destructive/10",
  },
  {
    rating: Rating.Hard,
    label: "困难",
    hint: "很勉强",
    className: "border-amber-800/25 bg-amber-50 text-amber-950 hover:bg-amber-100",
  },
  {
    rating: Rating.Good,
    label: "良好",
    hint: "想起来了",
    className: "border-emerald-900/20 bg-emerald-50 text-emerald-950 hover:bg-emerald-100",
  },
  {
    rating: Rating.Easy,
    label: "简单",
    hint: "太容易",
    className: "border-foreground/15 bg-foreground text-background hover:bg-foreground/90",
  },
];

export function RatingButtons({
  preview,
  now,
  disabled,
  onRate,
}: {
  preview: RecordLog;
  now: number;
  disabled?: boolean;
  onRate: (rating: Grade) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {ITEMS.map((item) => {
        const due = preview[item.rating].card.due.getTime();
        return (
          <Button
            key={item.rating}
            type="button"
            variant="outline"
            disabled={disabled}
            className={`h-auto min-h-16 flex-col gap-0.5 px-2 py-2 ${item.className}`}
            onClick={() => onRate(item.rating)}
          >
            <span className="text-sm font-medium">{item.label}</span>
            <span className="text-[11px] opacity-80">{item.hint}</span>
            <span className="mt-1 text-xs tabular-nums">{formatInterval(now, due)}</span>
          </Button>
        );
      })}
    </div>
  );
}

export const RATING_ITEMS = ITEMS;
