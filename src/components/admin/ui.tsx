"use client";

import { useId } from "react";

export const inputCls =
  "h-12 w-full rounded-xl border-2 border-charcoal/20 bg-white px-3 text-lg outline-none focus:border-forest aria-[invalid=true]:border-ember";

export function Field({
  label,
  error,
  hint,
  children,
  className = "",
}: {
  label: string;
  error?: string;
  hint?: string;
  children: (id: string) => React.ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block font-medium">
        {label}
      </label>
      {children(id)}
      {hint && !error && <p className="mt-1 text-sm text-charcoal/70">{hint}</p>}
      {error && (
        <p role="alert" className="mt-1 text-sm font-medium text-ember">
          {error}
        </p>
      )}
    </div>
  );
}

/** Big, thumb-friendly on/off switch. */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-50 ${checked ? "bg-forest" : "bg-charcoal/25"}`}
    >
      <span
        aria-hidden
        className={`absolute top-1 size-6 rounded-full bg-white shadow transition-[inset-inline-start] ${checked ? "start-7" : "start-1"}`}
      />
    </button>
  );
}

export function SampleBadge() {
  return <span className="rounded bg-saffron px-2 py-0.5 text-xs font-bold text-charcoal">عينة</span>;
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-charcoal/20 px-5 py-10 text-center">
      <p className="font-display text-2xl text-forest">{title}</p>
      <p className="mt-1 text-charcoal/70">{body}</p>
    </div>
  );
}

export const btn = {
  primary: "h-12 rounded-full bg-forest px-6 font-display text-xl text-ivory disabled:opacity-50",
  ember: "h-12 rounded-full bg-ember px-6 font-display text-xl text-ivory disabled:opacity-50",
  ghost: "h-12 rounded-full border-2 border-forest px-5 text-forest disabled:opacity-50",
  danger: "h-12 rounded-full border-2 border-ember px-5 text-ember disabled:opacity-50",
};
