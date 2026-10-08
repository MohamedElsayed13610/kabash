"use client";

import { LazyMotion, MotionConfig, domMax } from "motion/react";

// reducedMotion="user": anyone with "reduce motion" switched on gets no transform animations from this library.
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domMax}>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
