import Image from "next/image";
import Link from "next/link";
import { ar } from "@/messages/ar";

/** Compact top bar for inner pages. Scrolls away; the category chips stick instead. */
export function SiteHeader({ phone }: { phone: string }) {
  return (
    <header className="bg-forest text-ivory">
      <div className="mx-auto flex h-16 max-w-xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-3" aria-label={`${ar.brand.name}، الرئيسية`}>
          <Image src="/brand/logo.png" alt="" width={44} height={44} className="size-11" />
          <span className="font-display text-3xl leading-none">{ar.brand.name}</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/track" className="grid h-11 place-items-center rounded-full bg-saffron px-4 text-sm font-bold text-charcoal">
            تتبع طلبك
          </Link>
          <a
            href={`tel:${phone}`}
            className="grid h-11 min-w-11 place-items-center rounded-full border border-leaf/50 px-4 text-sm"
            aria-label="اتصل بينا"
          >
            اتصل
          </a>
        </div>
      </div>
    </header>
  );
}
