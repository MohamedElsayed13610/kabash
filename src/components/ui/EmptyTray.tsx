/** An empty serving tray with a little question-mark of steam. Decorative; the words next to it carry the meaning. */
export function EmptyTray({ className = "mx-auto h-28 w-44" }: { className?: string }) {
  return (
    <svg viewBox="0 0 176 112" className={className} aria-hidden fill="none">
      <ellipse cx="88" cy="92" rx="76" ry="14" className="fill-charcoal/10" />
      <ellipse cx="88" cy="80" rx="72" ry="16" className="fill-saffron" />
      <ellipse cx="88" cy="76" rx="58" ry="11" className="fill-ivory" stroke="currentColor" strokeWidth="2" style={{ color: "var(--forest)" }} />
      <ellipse cx="88" cy="76" rx="40" ry="6.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 5" style={{ color: "var(--leaf)" }} />
      <path d="M78 54c-10-8 10-12 0-22M98 52c-10-8 10-12 0-22" stroke="currentColor" strokeWidth="3" strokeLinecap="round" style={{ color: "var(--ember)", opacity: 0.55 }} />
    </svg>
  );
}
