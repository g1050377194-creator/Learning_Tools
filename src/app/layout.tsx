import type { Metadata } from "next";
import { Suspense } from "react";
import { AppChrome } from "@/components/app-chrome";
import { StudyProvider } from "@/components/study-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "循迹",
    template: "%s · 循迹",
  },
  description: "定一条学习路线，把读到的词收进牌组，再用 FSRS 复习留下来。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-dvh">
        <StudyProvider>
          <div className="min-h-dvh md:pl-60">
            <Suspense fallback={null}>
              <AppChrome />
            </Suspense>
            <main className="mx-auto w-full max-w-5xl px-4 py-6 pb-24 md:px-8 md:py-8">{children}</main>
          </div>
        </StudyProvider>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
