export default function Loading() {
  return (
    <div className="space-y-3" aria-live="polite">
      <div className="h-8 w-36 animate-pulse rounded-md bg-muted" />
      <div className="h-28 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}
