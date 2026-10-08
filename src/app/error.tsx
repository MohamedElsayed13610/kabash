"use client";

import { ErrorState } from "@/components/site/ErrorState";

export default function RootError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState {...props} />;
}
