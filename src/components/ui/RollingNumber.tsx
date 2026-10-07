/** Digits that roll like an odometer when the value changes. Transform-only, CSS transition. */
export function RollingNumber({ value, className = "" }: { value: string; className?: string }) {
  return (
    <span className={`inline-flex tabular-nums leading-none ${className}`} dir="ltr" aria-label={value} role="text">
      {[...value].map((ch, i) => {
        if (ch < "0" || ch > "9") {
          return (
            <span key={i} aria-hidden className="inline-block">
              {ch}
            </span>
          );
        }
        return (
          <span key={i} aria-hidden className="relative inline-block h-[1em] overflow-hidden">
            <span
              className="flex flex-col transition-transform duration-300 ease-out"
              style={{ transform: `translateY(-${Number(ch) * 10}%)` }}
            >
              {"0123456789".split("").map((d) => (
                <span key={d} className="h-[1em] leading-[1]">
                  {d}
                </span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
}
