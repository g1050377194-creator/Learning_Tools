import { Suspense } from "react";
import { ReviewSession } from "./review-session";

export default function ReviewPage() {
  return (
    <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-muted" />}>
      <ReviewSession />
    </Suspense>
  );
}
