import { GetMoneroStatsResponse } from "@workspace/api-zod";

type Currency = "usd" | "eur" | "gbp" | "inr" | "chf";
const numberOrNull = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;

/** Preserve missing observations as null rather than inventing a supply or cap. */
export function parseMoneroStats(raw: unknown, currency: Currency, now = Date.now()) {
  const data = raw as {
    id?: unknown;
    market_data?: {
      market_cap?: Partial<Record<Currency, unknown>>;
      circulating_supply?: unknown;
      total_supply?: unknown;
      ath?: Partial<Record<Currency, unknown>>;
      last_updated?: unknown;
    };
  } | null;
  const market = data?.market_data;
  if (data?.id !== "monero" || !market) throw new Error("Invalid Monero statistics");
  const updated = typeof market.last_updated === "string" ? Date.parse(market.last_updated) : NaN;
  if (!Number.isFinite(updated) || updated > now + 60000 || now - updated > 24 * 3600000) {
    throw new Error("Monero statistics are out of date");
  }
  return GetMoneroStatsResponse.parse({
    createdYear: 2014,
    marketCap: numberOrNull(market.market_cap?.[currency]),
    circulatingSupply: numberOrNull(market.circulating_supply),
    totalSupply: numberOrNull(market.total_supply),
    allTimeHigh: numberOrNull(market.ath?.[currency]),
    updatedAt: new Date(updated).toISOString(),
    stale: now - updated > 15 * 60000,
  });
}
