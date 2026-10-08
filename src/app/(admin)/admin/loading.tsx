import { Bone, SkeletonLabel } from "@/components/ui/Skeleton";

/** Shown at once while an admin page loads its data (the nav above stays put). */
export default function AdminLoading() {
  return (
    <div aria-busy="true">
      <SkeletonLabel text="بنحمّل الصفحة…" />
      <Bone className="h-10 w-40" />
      <div className="mt-5 grid grid-cols-2 gap-3">
        <Bone className="h-24" />
        <Bone className="h-24" />
        <Bone className="h-24" />
        <Bone className="h-24" />
      </div>
      <div className="mt-6 space-y-3">
        <Bone className="h-20" />
        <Bone className="h-20" />
        <Bone className="h-20" />
      </div>
    </div>
  );
}
