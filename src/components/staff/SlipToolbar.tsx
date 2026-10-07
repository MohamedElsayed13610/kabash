"use client";

import { useEffect } from "react";
import Link from "next/link";

export function SlipToolbar({ width, id, auto }: { width: 58 | 80; id: string; auto: boolean }) {
  useEffect(() => {
    if (auto) {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [auto]);

  return (
    <div className="no-print sticky top-0 z-10 flex flex-wrap items-center justify-center gap-2 bg-forest p-3 text-ivory">
      <button onClick={() => window.print()} className="h-12 rounded-full bg-saffron px-8 font-display text-xl text-charcoal">
        طباعة
      </button>
      {([58, 80] as const).map((w) => (
        <Link
          key={w}
          href={`/staff/orders/${id}/slip?w=${w}`}
          replace
          className={`grid h-12 place-items-center rounded-full border px-5 ${width === w ? "bg-ivory text-forest" : "border-leaf/60"}`}
        >
          ورق {w} مم
        </Link>
      ))}
      <button onClick={() => window.close()} className="h-12 rounded-full px-4 underline">
        إغلاق
      </button>
    </div>
  );
}
