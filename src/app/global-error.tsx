"use client";

/** Last resort, replaces the root layout: no fonts or Tailwind guaranteed, so it is plain on purpose. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ar" dir="rtl">
      <body style={{ margin: 0, background: "#f5f2e4", color: "#1e1b18", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", textAlign: "center", padding: 24 }}>
          <div>
            <h1 style={{ color: "#0b5128", fontSize: 32, margin: 0 }}>الصينية وقعت مننا</h1>
            <p style={{ fontSize: 18, marginTop: 12 }}>حصلت مشكلة عندنا، مش عندك. جرّب تاني كمان شوية.</p>
            <button
              type="button"
              onClick={reset}
              style={{ marginTop: 20, minHeight: 48, padding: "0 28px", borderRadius: 999, border: 0, background: "#b93f0a", color: "#f5f2e4", fontSize: 18 }}
            >
              جرّب تاني
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
