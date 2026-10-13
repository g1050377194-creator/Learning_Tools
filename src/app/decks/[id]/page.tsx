import { Suspense } from "react";
import { DeckDetail } from "./deck-detail";

export default function DeckPage() {
  return (
    <Suspense fallback={<div className="h-32 animate-pulse rounded-xl bg-muted" />}>
      <DeckDetail />
    </Suspense>
  );
}
