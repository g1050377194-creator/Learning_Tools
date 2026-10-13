"use client";

import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-dvh bg-background px-6 py-16 text-foreground">
        <h1 className="text-2xl">这一页没有打开</h1>
        <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
          {error.message || "出了一点问题。刷新之后，牌组和路线还在这台浏览器里。"}
        </p>
        <button type="button" className="mt-6 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground" onClick={reset}>
          再试一次
        </button>
      </body>
    </html>
  );
}
