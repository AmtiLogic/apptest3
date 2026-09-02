export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "—";
  // Round to whole seconds first: rounding each part separately can carry a
  // fractional value up to 60 and render "31:60".
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

/** Coarse "3h 7m" form for sleep and other long spans. */
export function formatHoursMinutes(seconds: number | null | undefined): string | null {
  if (!seconds) return null;
  const totalMinutes = Math.round(seconds / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

export function formatDistance(metres: number | null | undefined): string {
  if (!metres) return "—";
  return metres >= 1000 ? `${(metres / 1000).toFixed(2)} km` : `${Math.round(metres)} m`;
}

/** Pace in min/km, which is more useful than m/s for most activities. */
export function formatPace(metresPerSecond: number | null | undefined): string {
  if (!metresPerSecond) return "—";
  const secondsPerKm = 1000 / metresPerSecond;
  const m = Math.floor(secondsPerKm / 60);
  const s = Math.round(secondsPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")} /km`;
}

export function formatActivityType(typeKey: string | null | undefined): string {
  if (!typeKey) return "Activity";
  return typeKey.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  // Garmin returns local time as "YYYY-MM-DD HH:MM:SS" with no zone marker.
  const parsed = new Date(value.replace(" ", "T"));
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
