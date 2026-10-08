"use client";

import { LazyMotion, MotionConfig } from "motion/react";

// The animation features are fetched AFTER the page is interactive instead of being part of the first load.
// reducedMotion="user": anyone with "reduce motion" switched on gets no transform animations from this library.
const loadFeatures = () => import("@/lib/motion-features").then((m) => m.default);

export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={loadFeatures}>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
