"use client";

import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";

type SceneKey = "received" | "preparing" | "delivery" | "pickup" | "delivered" | "cancelled";

const fillBox = { transformBox: "fill-box" } as const;

function Received() {
  return (
    <g>
      <circle cx="120" cy="116" r="60" fill="none" stroke="#8fd16b" strokeWidth="2" className="ripple" />
      <circle cx="120" cy="116" r="60" fill="none" stroke="#8fd16b" strokeWidth="2" className="ripple" style={{ animationDelay: "1.1s" }} />
      <rect x="82" y="64" width="76" height="104" rx="8" fill="#f5f2e4" />
      <path d="M82 160l9 8 9-8 9 8 9-8 9 8 9-8 9 8 9-8v8H82z" fill="#f5f2e4" />
      {[84, 98, 112, 126].map((y, i) => (
        <rect key={y} x="94" y={y} width={i === 3 ? 30 : 52} height="5" rx="2.5" fill="#0b5128" opacity="0.35" />
      ))}
      <g className="pop" style={{ ...fillBox, animationDelay: "0.25s" }}>
        <circle cx="150" cy="150" r="22" fill="#e2a93b" />
        <path d="M139 150l8 8 15-17" fill="none" stroke="#1e1b18" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </g>
  );
}

function Preparing() {
  return (
    <g>
      {/* steam */}
      {[104, 124, 144].map((x, i) => (
        <ellipse key={x} cx={x} cy="96" rx="7" ry="16" fill="#f5f2e4" opacity="0.4" className="steam" style={{ ...fillBox, animationDelay: `${i * 1.2}s` }} />
      ))}
      {/* flames */}
      {[
        { x: 92, d: "0s" },
        { x: 120, d: "0.25s" },
        { x: 148, d: "0.5s" },
      ].map((f) => (
        <path
          key={f.x}
          d={`M${f.x} 196c-10-9-9-18-3-26 1 6 4 8 6 9 0-8 3-14 8-19 1 11 10 15 4 36z`}
          fill="#e8591a"
          className="flame"
          style={{ animationDelay: f.d }}
        />
      ))}
      {[106, 134].map((x) => (
        <path key={x} d={`M${x} 196c-6-6-5-12-1-17 1 4 3 5 4 6 0-5 2-8 5-11 0 8 6 10 2 22z`} fill="#e2a93b" className="flame" style={{ animationDelay: "0.15s" }} />
      ))}
      {/* pot */}
      <rect x="76" y="124" width="88" height="46" rx="10" fill="#f5f2e4" />
      <rect x="64" y="134" width="14" height="8" rx="4" fill="#f5f2e4" />
      <rect x="162" y="134" width="14" height="8" rx="4" fill="#f5f2e4" />
      <g className="lid">
        <rect x="72" y="114" width="96" height="12" rx="6" fill="#e2a93b" />
        <circle cx="120" cy="110" r="6" fill="#e2a93b" />
      </g>
      <rect x="86" y="140" width="68" height="5" rx="2.5" fill="#0b5128" opacity="0.3" />
    </g>
  );
}

function Delivery() {
  return (
    <g>
      <rect x="0" y="176" width="240" height="64" fill="#05301a" />
      <g className="road">
        {Array.from({ length: 10 }, (_, i) => (
          <rect key={i} x={i * 32 - 10} y="205" width="18" height="4" rx="2" fill="#8fd16b" opacity="0.7" />
        ))}
      </g>
      <g opacity="0.5">
        <circle cx="48" cy="52" r="18" fill="#e2a93b" />
      </g>
      <g className="drive">
        <g className="bob" transform="translate(120 0)">
          {/* speed lines */}
          <rect x="34" y="148" width="26" height="3" rx="1.5" fill="#f5f2e4" opacity="0.5" />
          <rect x="42" y="160" width="20" height="3" rx="1.5" fill="#f5f2e4" opacity="0.35" />
          {/* delivery box */}
          <rect x="12" y="116" width="30" height="28" rx="4" fill="#b93f0a" />
          <rect x="12" y="116" width="30" height="7" rx="3" fill="#e8591a" />
          {/* body */}
          <path d="M-30 168h58l8-24-18-4-8 14h-24z" fill="#f5f2e4" />
          <path d="M-26 150h24l-4-14h-14z" fill="#e2a93b" />
          {/* rider */}
          <circle cx="2" cy="112" r="8" fill="#e2a93b" />
          <path d="M-6 122h16l6 22h-12l-3-10-7 10h-8z" fill="#8fd16b" />
          {/* wheels */}
          <circle cx="-24" cy="174" r="12" fill="#1e1b18" />
          <circle cx="-24" cy="174" r="5" fill="#f5f2e4" />
          <circle cx="26" cy="174" r="12" fill="#1e1b18" />
          <circle cx="26" cy="174" r="5" fill="#f5f2e4" />
        </g>
      </g>
    </g>
  );
}

function Pickup() {
  return (
    <g>
      <rect x="40" y="170" width="160" height="14" rx="4" fill="#f5f2e4" />
      <rect x="52" y="184" width="136" height="40" fill="#05301a" />
      <g className="hop">
        <path d="M92 108h56l8 62H84z" fill="#e2a93b" />
        <path d="M106 108c0-22 28-22 28 0" fill="none" stroke="#f5f2e4" strokeWidth="5" strokeLinecap="round" />
        <text x="120" y="150" textAnchor="middle" className="font-display" fontSize="26" fill="#1e1b18">
          جاهز
        </text>
      </g>
      <g className="twinkle" style={{ ...fillBox, animationDelay: "0.4s" }}>
        <path d="M176 84l4 10 10 4-10 4-4 10-4-10-10-4 10-4z" fill="#8fd16b" />
      </g>
    </g>
  );
}

function Delivered() {
  return (
    <g>
      <rect x="64" y="70" width="112" height="120" rx="10" fill="#f5f2e4" />
      <path d="M84 190v-76c0-22 18-30 36-30s36 8 36 30v76z" fill="#0b5128" />
      <circle cx="146" cy="150" r="4" fill="#e2a93b" />
      <g className="pop" style={fillBox}>
        <circle cx="120" cy="120" r="30" fill="#e2a93b" />
        <path d="M104 120l12 12 22-24" fill="none" stroke="#1e1b18" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      {[
        { x: 52, y: 66, d: "0s" },
        { x: 190, y: 92, d: "0.5s" },
        { x: 58, y: 150, d: "0.9s" },
        { x: 186, y: 168, d: "1.3s" },
      ].map((s) => (
        <path key={s.x} className="twinkle" style={{ ...fillBox, animationDelay: s.d }} d={`M${s.x} ${s.y - 9}l3 6 6 3-6 3-3 6-3-6-6-3 6-3z`} fill="#8fd16b" />
      ))}
    </g>
  );
}

function Cancelled() {
  return (
    <g opacity="0.9">
      <circle cx="120" cy="120" r="62" fill="none" stroke="#f5f2e4" strokeWidth="4" strokeDasharray="6 8" opacity="0.5" />
      <circle cx="120" cy="120" r="40" fill="none" stroke="#f5f2e4" strokeWidth="3" opacity="0.35" />
      <path d="M86 86l68 68" stroke="#e8591a" strokeWidth="9" strokeLinecap="round" />
    </g>
  );
}

const SCENES: Record<SceneKey, () => React.JSX.Element> = {
  received: Received,
  preparing: Preparing,
  delivery: Delivery,
  pickup: Pickup,
  delivered: Delivered,
  cancelled: Cancelled,
};

/** The round "tray window" at the top of the tracking page. Scene crossfades when the stage changes. */
export function Scene({ scene, label }: { scene: SceneKey; label: string }) {
  const Current = SCENES[scene];
  return (
    <div
      role="img"
      aria-label={label}
      className={`relative mx-auto size-60 overflow-hidden rounded-full ring-4 ring-offset-4 ring-offset-ivory ${
        scene === "cancelled" ? "bg-charcoal ring-charcoal/40" : "bg-forest ring-leaf/50"
      }`}
    >
      <AnimatePresence mode="wait" initial={false}>
        <m.svg
          key={scene}
          viewBox="0 0 240 240"
          className="absolute inset-0 size-full"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.06 }}
          transition={{ duration: 0.25 }}
          aria-hidden
        >
          <Current />
        </m.svg>
      </AnimatePresence>
    </div>
  );
}

export type { SceneKey };
