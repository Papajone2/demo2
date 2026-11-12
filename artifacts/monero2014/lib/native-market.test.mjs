import { test } from 'node:test';
import assert from 'node:assert/strict';
import { observedHistory } from './native-market.ts';

test('native chart retains real timestamps and reports currency/source', () => {
  const now = 1800000000000;
  const rows = Array.from({ length: 25 }, (_, i) => [now - (24 - i) * 3600000, 140 + i]);
  const m = observedHistory(rows, 'usd', '1d', 'Fixture observations', now);
  assert.equal(m.price, 164);
  assert.equal(m.changeAbsolute, 24);
  assert.equal(m.points.length, 25);
  assert.equal(m.source, 'Fixture observations');
});
test('native chart rejects fabricated-looking invalid or stale points', () => {
  const now = 1800000000000;
  assert.throws(() => observedHistory([[now - 3600000, -1], [now, 20]], 'usd', '1h', 'fixture', now));
  assert.throws(() => observedHistory([[now - 7200000, 10], [now - 7100000, 11]], 'usd', '1h', 'fixture', now));
  assert.throws(() => observedHistory([[now, 10], [now, 11]], 'usd', '1h', 'fixture', now));
});
