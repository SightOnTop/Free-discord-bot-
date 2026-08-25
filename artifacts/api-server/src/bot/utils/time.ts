/** Parse a duration string like "10m", "1h", "2d" → milliseconds */
export function parseDuration(input: string): number | null {
  const match = input.match(/^(\d+)(s|m|h|d)$/i);
  if (!match) return null;
  const value = parseInt(match[1]!, 10);
  switch (match[2]!.toLowerCase()) {
    case "s": return value * 1000;
    case "m": return value * 60 * 1000;
    case "h": return value * 3600 * 1000;
    case "d": return value * 86400 * 1000;
    default: return null;
  }
}

/** Format ms → human string */
export function formatDuration(ms: number): string {
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h`;
  return `${Math.floor(ms / 86_400_000)}j`;
}

/** Format a Date → Discord timestamp */
export function discordTimestamp(date: Date, style: "R" | "F" | "D" | "T" = "R"): string {
  return `<t:${Math.floor(date.getTime() / 1000)}:${style}>`;
}
