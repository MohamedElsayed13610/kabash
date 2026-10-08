import { Bone, SkeletonLabel } from "@/components/ui/Skeleton";

/** Shown the instant a customer taps a link, until the page arrives (usually already prefetched, so it barely shows). */
export default function SiteLoading() {
  return (
    <div aria-busy="true">
      <SkeletonLabel text="ثواني ونجيبلك الصفحة…" />
      <div className="bg-forest px-5 pb-8 pt-20">
        <div className="mx-auto max-w-xl">
          <div className="h-12 w-56 animate-pulse rounded-xl bg-ivory/20" />
          <div className="mt-4 h-5 w-72 max-w-full animate-pulse rounded-lg bg-ivory/15" />
        </div>
      </div>
      <div className="mx-auto max-w-xl px-4 pt-5">
        <div className="flex gap-2 overflow-hidden">
          {[0, 1, 2, 3].map((i) => (
            <Bone key={i} className="h-11 w-24 shrink-0 rounded-full" />
          ))}
        </div>
        <div className="mt-6 space-y-5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <Bone className="size-28 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Bone className="h-6 w-2/3" />
                <Bone className="h-4 w-full" />
                <Bone className="h-6 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
