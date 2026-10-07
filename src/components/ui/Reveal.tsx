"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Slide-and-settle on scroll. Content is fully visible until JS has hydrated, and anything
 * already on screen at hydration is left alone, so a slow phone never sees hidden content.
 */
export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"visible" | "hidden" | "shown">("visible");

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.95) return; // already on screen
    setState("hidden");
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setState("shown");
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`${className} ${state === "hidden" ? "translate-y-6 opacity-0" : "translate-y-0 opacity-100"} ${
        state === "shown" ? "transition duration-500 ease-out" : ""
      }`}
      style={state === "shown" ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
