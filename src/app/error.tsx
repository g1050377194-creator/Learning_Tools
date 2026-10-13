"use client";

import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-5 py-8">
      <h1 className="text-2xl">这一页没有打开</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{error.message || "出了一点问题，可以再试一次。"}</p>
      <Button type="button" className="mt-4" onClick={reset}>
        再试一次
      </Button>
    </div>
  );
}
