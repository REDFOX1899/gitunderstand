"use client";

export function SectionSkeleton({ lines = 8 }: { lines?: number }) {
  return (
    <div className="animate-pulse space-y-3">
      {/* Title skeleton */}
      <div className="h-6 w-48 rounded bg-stone-200" />
      <div className="h-4 w-32 rounded bg-stone-100" />
      {/* Content skeletons */}
      <div className="mt-4 space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="h-4 rounded bg-stone-100"
            style={{ width: `${Math.random() * 40 + 60}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export function DiagramSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-6 w-48 rounded bg-stone-200" />
      <div className="mt-4 flex h-[400px] items-center justify-center rounded-lg border border-stone-200 bg-stone-50">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-stone-200" />
          <div className="mx-auto mt-3 h-4 w-32 rounded bg-stone-200" />
        </div>
      </div>
    </div>
  );
}

export function TreeSkeleton() {
  return (
    <div className="animate-pulse space-y-2">
      <div className="h-6 w-48 rounded bg-stone-200" />
      <div className="mt-4 space-y-1.5">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2" style={{ paddingLeft: `${(i % 4) * 16}px` }}>
            <div className="h-4 w-4 rounded bg-stone-200" />
            <div
              className="h-4 rounded bg-stone-100"
              style={{ width: `${Math.random() * 80 + 60}px` }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
