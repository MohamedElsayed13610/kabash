import Image from "next/image";
import type { ReactNode } from "react";

/** One layout for every "something is not as expected" screen, so they feel like the same restaurant. */
export function StateScreen({
  eyebrow,
  title,
  children,
  actions,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
  actions: ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center px-6 py-16 text-center" data-testid="state-screen">
      <Image src="/brand/logo.png" alt="" width={96} height={96} className="size-24" priority />
      <p className="mt-6 font-display text-6xl leading-none text-ember" aria-hidden>
        {eyebrow}
      </p>
      <h1 className="mt-3 font-display text-4xl leading-tight text-forest">{title}</h1>
      <div className="sadu mx-auto mt-3 h-2 w-32 text-leaf" aria-hidden />
      <div className="mt-4 max-w-sm text-lg text-charcoal/80">{children}</div>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">{actions}</div>
    </main>
  );
}

export const primaryBtn = "grid min-h-12 place-items-center rounded-full bg-ember px-7 font-display text-xl text-ivory";
export const secondaryBtn = "grid min-h-12 place-items-center rounded-full border-2 border-forest px-7 font-display text-xl text-forest";
