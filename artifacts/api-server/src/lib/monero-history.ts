import { GetMoneroHistoryResponse } from "@workspace/api-zod";
export type HistoryRange = "1h" | "1d" | "1w" | "1m" | "1y";
export const HISTORY_DAYS: Record<HistoryRange, number> = { "1h": 1, "1d": 1, "1w": 7, "1m": 30, "1y": 365 };
const HOUR = 3600000;
const PERIOD_BOUNDS: Record<HistoryRange, [number, number]> = {
  "1h": [HOUR / 2, HOUR * 1.1],
  "1d": [20 * HOUR, 27 * HOUR],
  "1w": [5 * 24 * HOUR, 8 * 24 * HOUR],
  "1m": [25 * 24 * HOUR, 32 * 24 * HOUR],
  "1y": [330 * 24 * HOUR, 370 * 24 * HOUR],
};

/**
 * Validate provider observations without manufacturing or smoothing history.
 * Epoch milliseconds are retained, including irregular observation intervals.
 */
export function parseMoneroHistory(raw: unknown, currency: "usd" | "eur" | "gbp", now = Date.now(), range: HistoryRange = "1d") {
  const rows = (raw as { prices?: unknown } | null)?.prices;
  if (!Array.isArray(rows) || rows.length < 2 || rows.length > 5000) {
    throw new Error("Market history is incomplete");
  }
  let previous = 0;
  const observations = rows.map((row: unknown) => {
    if (!Array.isArray(row) || row.length < 2) throw new Error("Invalid market observation");
    const [timestamp, price] = row;
    if (typeof timestamp !== "number" || !Number.isSafeInteger(timestamp) ||
        timestamp <= previous || timestamp > now + 60000 ||
        typeof price !== "number" || !Number.isFinite(price) || price <= 0) {
      throw new Error("Invalid market observation");
    }
    previous = timestamp;
    return { timestamp, price };
  });
  // Hourly view is a real subset of the provider's daily observations.
  const points = range === "1h" ? observations.filter(p => p.timestamp >= now - HOUR) : observations;
  if (points.length < 2) throw new Error("Market history is incomplete");
  const first = points[0];
  const last = points[points.length - 1];
  const span = last.timestamp - first.timestamp;
  const [minimum, maximum] = PERIOD_BOUNDS[range];
  if (!minimum || span < minimum || span > maximum || now - last.timestamp > 60 * 60000) {
    throw new Error("Market history is out of date or outside the requested period");
  }
  return GetMoneroHistoryResponse.parse({
    currency, points, price: last.price,
    changeAbsolute: last.price - first.price,
    changePercent: (last.price / first.price - 1) * 100,
    updatedAt: new Date(last.timestamp).toISOString(),
    source: "CoinGecko",
    stale: now - last.timestamp > 15 * 60000,
  });
}
