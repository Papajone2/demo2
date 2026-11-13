import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lockoutMs, AUTO_LOCK_MS } from './security-policy.ts';
test('five attempts per persisted escalating lockout stage, cycling after an hour', () => {
  for (let i = 1; i <= 30; i++) {
    assert.equal(lockoutMs(i), i % 5 ? 0 : [60000, 300000, 3600000][(i / 5 - 1) % 3]);
  }
  assert.equal(AUTO_LOCK_MS, 300000);
});
