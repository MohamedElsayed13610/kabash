import { Bone, SkeletonLabel } from "@/components/ui/Skeleton";

export default function StaffLoading() {
  return (
    <div className="min-h-dvh bg-ivory" aria-busy="true">
      <SkeletonLabel text="بنحمّل الطلبات…" />
      <div className="h-24 bg-forest" />
      <div className="mx-auto max-w-3xl space-y-4 px-4 pt-4">
        <Bone className="h-11 w-56" />
        <Bone className="h-64" />
        <Bone className="h-64" />
      </div>
    </div>
  );
}
