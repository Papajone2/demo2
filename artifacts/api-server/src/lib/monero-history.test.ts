import assert from "node:assert/strict";
import { test } from "node:test";
import { parseMoneroHistory } from "./monero-history";

const now = Date.UTC(2026, 10, 10, 23, 40);
const rows = [[now - 24 * 3600000, 200], [now - 600000, 215], [now, 210]];

test("market chart retains real timestamps and derives signed change from endpoints", () => {
  const value = parseMoneroHistory({ prices: rows }, "usd", now);
  assert.deepEqual(value.points, rows.map(([timestamp, price]) => ({ timestamp, price })));
  assert.equal(value.price, 210);
  assert.equal(value.changeAbsolute, 10);
  assert.ok(Math.abs(value.changePercent - 5) < 1e-10);
  assert.equal(value.stale, false);
});

test("declining history returns a real negative change, never a sample gain", () => {
  const value = parseMoneroHistory({ prices: [[rows[0][0], 200], [now, 180]] }, "eur", now);
  assert.equal(value.changeAbsolute, -20);
  assert.ok(Math.abs(value.changePercent + 10) < 1e-10);
});

test("nonpositive, non-finite, unordered and future observations are rejected", () => {
  for (const prices of [
    [[rows[0][0], 0], [now, 210]],
    [[rows[0][0], Number.NaN], [now, 210]],
    [[now, 210], [rows[0][0], 200]],
    [[rows[0][0], 200], [now + 120000, 210]],
    [[now, 210], [now, 220]],
  ]) assert.throws(() => parseMoneroHistory({ prices }, "usd", now));
});

test("short, old and incomplete series are rejected; delayed observations are marked", () => {
  assert.throws(() => parseMoneroHistory({ prices: [[now, 200]] }, "usd", now));
  assert.throws(() => parseMoneroHistory({ prices: [[now - 600000, 200], [now, 210]] }, "usd", now));
  const delayed = rows.map(([t, p]) => [t - 20 * 60000, p]);
  assert.equal(parseMoneroHistory({ prices: delayed }, "gbp", now).stale, true);
  assert.throws(() => parseMoneroHistory({ prices: delayed }, "gbp", now + 60 * 60000));
});

test("one-hour view uses only actual observations from the requested hour", () => {
  const prices = [
    [now - 24 * 3600000, 300],
    ...Array.from({ length: 13 }, (_, i) => [now - (12 - i) * 300000, 200 - i]),
  ];
  const result = parseMoneroHistory({ prices }, "usd", now, "1h");
  assert.equal(result.points.length, 13);
  assert.equal(result.points[0].timestamp, now - 3600000);
  assert.equal(result.changeAbsolute, -12);
  assert.deepEqual(result.points, prices.slice(1).map(([timestamp, price]) => ({ timestamp, price })));
});

test("week, month and year views validate their own period and signed changes", () => {
  for (const [range, days] of [["1w", 7], ["1m", 30], ["1y", 365]] as const) {
    const prices = [[now - days * 86400000, 200], [now, 250]];
    const result = parseMoneroHistory({ prices }, "eur", now, range);
    assert.equal(result.changeAbsolute, 50);
    assert.equal(result.changePercent, 25);
    assert.equal(result.points[0].timestamp, prices[0][0]);
    assert.throws(() => parseMoneroHistory({ prices: rows }, "eur", now, range));
  }
});

test("hourly views reject incomplete or expired windows rather than fabricate prices", () => {
  assert.throws(() => parseMoneroHistory({ prices: rows }, "usd", now, "1h"));
  const old = [[now - 7200000, 200], [now - 3700000, 210]];
  assert.throws(() => parseMoneroHistory({ prices: old }, "usd", now, "1h"));
});
