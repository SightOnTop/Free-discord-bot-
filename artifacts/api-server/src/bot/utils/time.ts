/** Maximum delay accepted by Node.js setTimeout. */
export const MAX_TIMEOUT_MS = 2_147_000_000;

/** Parse a duration string like 10m, 1h, 2d → milliseconds */
export function parseDuration(input: string): number | null {
  const match = input.trim().match(/^(\d+)(s|m|h|d)$/i);
  if (!match) return null;

  const value = Number(match[1]);
  if (!Number.isSafeInteger(value) || value <= 0) return null;

  const units = { s: 1000, m: 60000, h: 3600000, d: 86400000 } as const;
  const multiplier = units[match[2]!.toLowerCase() as keyof typeof units];
  const milliseconds = value * multiplier;
  return Number.isSafeInteger(milliseconds) && milliseconds > 0 ? milliseconds : null;
}

/** Format ms → human string */
export function formatDuration(ms: number): string {
  if (ms < 60000) return Math.floor(ms / 1000) + "s";
  if (ms < 3600000) return Math.floor(ms / 60000) + "m";
  if (ms < 86400000) return Math.floor(ms / 3600000) + "h";
  return Math.floor(ms / 86400000) + "j";
}

/** Format a Date → Discord timestamp */
/** @param style Discord timestamp style */
export function discordTimestamp(date: Date, style: "R" | "F" | "D" | "T" = "R"): string {
  return "<t:" + Math.floor(date.getTime() / 1000) + ":" + style + ">";
}
