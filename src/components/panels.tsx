"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        {eyebrow ? <p className="text-xs font-medium tracking-[0.16em] text-primary">{eyebrow}</p> : null}
        <h1 className="mt-1 text-3xl leading-tight text-foreground sm:text-4xl">{title}</h1>
        {description ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function LoadingBlock({ label }: { label: string }) {
  return (
    <div className="space-y-3" aria-live="polite">
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="h-28 animate-pulse rounded-xl bg-muted" />
      <div className="h-16 animate-pulse rounded-xl bg-muted" />
      <div className="h-16 w-2/3 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}

export function EmptyPanel({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/70 px-5 py-8">
      <h2 className="text-xl text-foreground">{title}</h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorNote({
  message,
  onRetry,
  extra,
}: {
  message: string;
  onRetry?: () => void;
  extra?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm" role="alert">
      <p className="font-medium text-destructive">没有完成</p>
      <p className="mt-1 leading-6 text-foreground">{message}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {onRetry ? (
          <Button type="button" variant="outline" onClick={onRetry}>
            再试一次
          </Button>
        ) : null}
        {extra}
      </div>
    </div>
  );
}

export function ModeNote({
  ready,
  name,
}: {
  ready: boolean;
  name?: string;
}) {
  return (
    <p
      className={cn(
        "rounded-xl px-3 py-2 text-sm leading-6",
        ready ? "bg-accent text-accent-foreground" : "bg-secondary text-secondary-foreground",
      )}
    >
      {ready
        ? `当前会调用「${name ?? "已选模型"}」。密钥只在这台浏览器里，并由本机接口转发给服务商。`
        : "离线模式：还没有可用的模型密钥。路线、阅读和写作反馈会用本机规则生成，并标明离线。配好密钥后，同样的按钮会改走模型。"}
    </p>
  );
}
