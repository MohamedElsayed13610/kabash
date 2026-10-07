"use client";

import { RollingNumber } from "../ui/RollingNumber";

const TICK = 30; // px between ticks

interface Props {
  value: number;
  min: number;
  step: number;
  max: number;
  onChange: (v: number) => void;
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** A ruler that slides under a fixed needle, with big minus/plus buttons. Weight in kg. */
export function WeightScale({ value, min, step, max, onChange }: Props) {
  const ticks = Math.round(max / step);
  const set = (v: number) => onChange(Math.min(max, Math.max(min, round3(v))));
  const perKg = Math.round(1 / step);

  return (
    <div>
      <div className="flex items-end justify-center gap-2 text-forest" aria-live="polite">
        <RollingNumber value={String(value)} className="font-display text-6xl" />
        <span className="pb-1.5 font-display text-2xl">كجم</span>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => set(value - step)}
          disabled={value <= min}
          aria-label="تقليل الوزن"
          className="grid size-14 shrink-0 place-items-center rounded-full border-2 border-forest text-3xl text-forest transition active:scale-90 disabled:opacity-30"
        >
          −
        </button>

        <div
          dir="ltr"
          className="relative h-16 flex-1 overflow-hidden"
          style={{ maskImage: "linear-gradient(90deg, transparent, #000 22%, #000 78%, transparent)" }}
          aria-hidden
        >
          <div
            className="absolute top-0 h-full transition-transform duration-300 ease-out"
            style={{ insetInlineStart: "50%", width: ticks * TICK + 1, transform: `translateX(${-(value / step) * TICK}px)` }}
          >
            {Array.from({ length: ticks + 1 }, (_, i) => {
              const whole = perKg > 0 && i % perKg === 0;
              return (
                <span key={i} className="absolute top-0 flex -translate-x-1/2 flex-col items-center" style={{ left: i * TICK }}>
                  <span className={`w-px bg-charcoal/50 ${whole ? "h-7" : "h-4"}`} />
                  {whole && <span className="mt-0.5 text-xs font-medium tabular-nums text-charcoal/70">{(i * step).toString()}</span>}
                </span>
              );
            })}
          </div>
          <span className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-ember" />
          <span className="absolute left-1/2 top-0 size-2.5 -translate-x-1/2 rounded-full bg-ember" />
        </div>

        <button
          type="button"
          onClick={() => set(value + step)}
          disabled={value >= max}
          aria-label="زيادة الوزن"
          className="grid size-14 shrink-0 place-items-center rounded-full bg-forest text-3xl text-ivory transition active:scale-90 disabled:opacity-30"
        >
          +
        </button>
      </div>
    </div>
  );
}
