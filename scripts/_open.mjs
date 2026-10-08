// Test helper: force the restaurant "open" so order tests don't depend on the time of day.
// Returns a function that puts the previous manual override back.
export async function forceOpen(rest) {
  const prev = (await rest("settings?key=eq.open_override&select=value")).body?.[0]?.value ?? "auto";
  await rest("settings?key=eq.open_override", { method: "PATCH", body: JSON.stringify({ value: "open" }) });
  return () => rest("settings?key=eq.open_override", { method: "PATCH", body: JSON.stringify({ value: prev }) });
}
