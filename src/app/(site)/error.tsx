"use client";

import { ErrorState } from "@/components/site/ErrorState";

export default function SiteError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState {...props} />;
}
