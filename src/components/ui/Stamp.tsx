import Image from "next/image";

/** Rubber-stamp label with the ram emblem. Used for "طازج النهارده" and similar marks. */
export function Stamp({ label, className = "" }: { label: string; className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 -rotate-6 items-center gap-1.5 rounded-md border-2 border-ember py-0.5 ps-1 pe-2.5 font-display text-base leading-tight text-ember ${className}`}
    >
      <Image src="/brand/logo.png" alt="" width={24} height={24} className="size-6 rounded-full" />
      {label}
    </span>
  );
}
