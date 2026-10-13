"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Library,
  PenLine,
  RotateCcw,
  Settings,
  Route,
  SunMedium,
} from "lucide-react";
import { useStudy } from "@/components/study-provider";
import { useModels } from "@/components/use-models";
import { isDueToday } from "@/lib/scheduler";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "今日", icon: SunMedium },
  { href: "/paths", label: "路线", icon: Route },
  { href: "/read", label: "阅读", icon: BookOpen },
  { href: "/practice", label: "练习", icon: PenLine },
  { href: "/review", label: "复习", icon: RotateCcw },
  { href: "/decks", label: "牌组", icon: Library },
  { href: "/settings", label: "设置", icon: Settings },
];

const MOBILE = NAV.slice(0, 5);

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppChrome() {
  const pathname = usePathname();
  const study = useStudy();
  const models = useModels();
  const due = study?.cards.filter((card) => isDueToday(card)).length ?? 0;

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <div className="px-5 pt-6 pb-4">
          <Link href="/" className="flex items-center gap-2">
            <Mark />
            <span>
              <span className="block font-heading text-xl leading-none">循迹</span>
              <span className="mt-1 block text-xs text-muted-foreground">从目标走到记忆</span>
            </span>
          </Link>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
                  active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-sidebar-accent",
                )}
              >
                <Icon className="size-4" />
                <span className="flex-1">{item.label}</span>
                {item.href === "/review" && due > 0 ? (
                  <span className={cn("rounded-full px-1.5 text-xs tabular-nums", active ? "bg-primary-foreground/15" : "bg-primary/10 text-primary")}>
                    {due}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <p className="px-5 pt-4 pb-16 text-xs leading-5 text-muted-foreground">
          {models.ready ? `模型 · ${models.current?.displayName}` : "离线模式"}
        </p>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/90 px-4 py-3 backdrop-blur md:hidden">
        <Link href="/" className="flex items-center gap-2">
          <Mark />
          <span className="font-heading text-lg">循迹</span>
        </Link>
        <p className="min-w-0 flex-1 truncate px-3 text-center text-[11px] text-muted-foreground">
          {models.ready ? models.current?.displayName : "离线模式"}
        </p>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/decks" className={cn(isActive(pathname, "/decks") && "text-primary")}>
            牌组
          </Link>
          <Link href="/settings" className={cn(isActive(pathname, "/settings") && "text-primary")}>
            设置
          </Link>
        </div>
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-background/95 backdrop-blur md:hidden">
        {MOBILE.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 py-2 text-[11px]",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="size-4" />
              {item.label}
              {item.href === "/review" && due > 0 ? <span className="sr-only">{due} 张到期</span> : null}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

function Mark() {
  return (
    <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
      <svg viewBox="0 0 32 32" className="size-5" aria-hidden>
        <path d="M6 22c4-1 6-8 9-8s4.2 7 11 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="24" cy="20" r="1.6" fill="currentColor" />
      </svg>
    </span>
  );
}
