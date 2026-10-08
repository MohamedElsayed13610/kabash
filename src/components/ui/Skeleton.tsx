/** Calm placeholder blocks shown instantly while a page streams in. Pulse is opacity-only and respects reduced motion. */
export function Bone({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-xl bg-charcoal/10 ${className}`} />;
}

export function SkeletonLabel({ text }: { text: string }) {
  return (
    <span role="status" className="sr-only">
      {text}
    </span>
  );
}
