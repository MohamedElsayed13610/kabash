"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const INTERVAL_MS = 2600;

declare global {
  interface Window {
    /** Read by the browser tests to confirm the alarm really rang. */
    __kabashAlarm?: { enabled: boolean; ringing: boolean; plays: number };
  }
}

/** Three rising notes, loud and hard to miss over kitchen noise. */
function chime(ctx: AudioContext) {
  const notes = [880, 1174.66, 1567.98];
  const t0 = ctx.currentTime;
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = freq;
    const start = t0 + i * 0.18;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.5, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.34);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.36);
  });
}

/**
 * Repeating alarm while `ringing` is true. Browsers only allow audio after a tap, so `enable()` must be
 * called from a button press; until then `enabled` is false and the UI shows "تفعيل الصوت".
 */
export function useAlarm(ringing: boolean) {
  const ctx = useRef<AudioContext | null>(null);
  const [enabled, setEnabled] = useState(false);
  const plays = useRef(0);

  const play = useCallback(() => {
    const c = ctx.current;
    if (!c) return;
    if (c.state === "suspended") void c.resume();
    chime(c);
    navigator.vibrate?.([250, 100, 250, 100, 500]);
    plays.current += 1;
    if (window.__kabashAlarm) window.__kabashAlarm.plays = plays.current;
  }, []);

  const enable = useCallback(async () => {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!ctx.current) ctx.current = new Ctor();
    await ctx.current.resume();
    setEnabled(true);
    play(); // short confirmation so staff hear that the sound works
  }, [play]);

  useEffect(() => {
    if (!enabled || !ringing) return;
    play();
    const id = setInterval(play, INTERVAL_MS);
    // a phone that was locked suspends audio; wake it when the screen comes back
    const onVis = () => !document.hidden && ctx.current?.state === "suspended" && void ctx.current.resume();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [enabled, ringing, play]);

  useEffect(() => {
    window.__kabashAlarm = { enabled, ringing: enabled && ringing, plays: plays.current };
  });

  return { enabled, enable, test: play };
}
