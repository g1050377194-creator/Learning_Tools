import { Suspense } from "react";
import { PracticeSession } from "./practice-session";

export default function PracticePage() {
  return (
    <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-muted" />}>
      <PracticeSession />
    </Suspense>
  );
}
