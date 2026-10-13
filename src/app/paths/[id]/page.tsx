import { Suspense } from "react";
import { PathDetail } from "./path-detail";

export default function PathPage() {
  return (
    <Suspense fallback={<div className="h-32 animate-pulse rounded-xl bg-muted" />}>
      <PathDetail />
    </Suspense>
  );
}
