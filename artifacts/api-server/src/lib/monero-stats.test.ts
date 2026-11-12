import assert from "node:assert/strict";
import { test } from "node:test";
import { parseMoneroStats } from "./monero-stats";

const now = Date.UTC(2026, 10, 12);
const sample = () => ({
  id: "monero",
  market_data: {
    market_cap: { usd: 6000000000, eur: 5000000000 },
    circulating_supply: 18000000,
    total_supply: null,
    ath: { usd: 500, eur: 450 },
    last_updated: new Date(now).toISOString(),
  },
});
test("statistics retain actual currency values and never invent a total supply", () => {
  const result = parseMoneroStats(sample(), "eur", now);
  assert.equal(result.createdYear, 2014);
  assert.equal(result.marketCap, 5000000000);
  assert.equal(result.allTimeHigh, 450);
  assert.equal(result.circulatingSupply, 18000000);
  assert.equal(result.totalSupply, null);
  assert.equal(result.stale, false);
});
test("unknown currencies, missing, negative and non-finite fields remain null", () => {
  const data = sample();
  data.market_data.market_cap.usd = NaN;
  data.market_data.circulating_supply = -1;
  const result = parseMoneroStats(data, "usd", now);
  assert.equal(result.marketCap, null);
  assert.equal(result.circulatingSupply, null);
  assert.equal(parseMoneroStats(data, "gbp", now).allTimeHigh, null);
});
test("old, future, malformed or wrong-asset statistics are rejected", () => {
  const data = sample();
  assert.throws(() => parseMoneroStats({ ...data, id: "bitcoin" }, "usd", now));
  assert.throws(() => parseMoneroStats(null, "usd", now));
  assert.throws(() => parseMoneroStats(data, "usd", now - 120000));
  assert.throws(() => parseMoneroStats(data, "usd", now + 25 * 3600000));
  assert.equal(parseMoneroStats(data, "usd", now + 20 * 60000).stale, true);
});
