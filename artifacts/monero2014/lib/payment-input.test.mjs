import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fiatToAtomic, readPaymentQr } from './payment-input.ts';
import { compactXmr, ATOMIC_PER_XMR } from './money.ts';
import { estimatedRestoreHeight } from './restore-policy.ts';
import { errorKey } from './wallet-errors.ts';
test('fiat input uses integer atomic math, never floating point', () => {
  assert.equal(fiatToAtomic('5.00', 20000n), 25000000000n);
  assert.equal(fiatToAtomic('5.001', 20000n), null);
  assert.equal(fiatToAtomic('5', null), null);
  assert.equal(fiatToAtomic('0', 20000n), 0n);
});
test('QR parsing only accepts addresses and valid Monero payment URIs', () => {
  const address = '4' + 'a'.repeat(94); // Syntax fixture only, not a funded address.
  assert.deepEqual(readPaymentQr(address), { address, amount: '' });
  assert.deepEqual(readPaymentQr(`monero:${address}?tx_amount=0.125`), { address, amount: '0.125' });
  for (const value of ['https://example.com', 'monero:bad', `monero:${address}?tx_amount=-1`, `monero:${address}?tx_payment_id=123`]) assert.throws(() => readPaymentQr(value));
});
test('compact amounts retain roughly ten cents or less of precision', () => {
  const atomic = 213242000000n;
  assert.equal(compactXmr(atomic, 20000n), '0.2132');
  assert.equal(compactXmr(atomic, 2000000n), '0.213242');
  assert.equal(ATOMIC_PER_XMR, 1000000000000n);
});
test('date estimates start before the chosen month; unknown/early starts at genesis', () => {
  assert.equal(estimatedRestoreHeight(2014, 4), 0);
  assert.equal(estimatedRestoreHeight(2025, 0), 0);
  assert.ok(estimatedRestoreHeight(2025, 1) < estimatedRestoreHeight(2025, 2));
  assert.ok(estimatedRestoreHeight(2025, 1) < 1009827 + (Date.UTC(2025, 0, 1) / 1000 - 1458748658) / 120);
});
test('broadcast uncertainty never becomes retry or an insufficient-funds message', () => {
  assert.match(errorKey('An earlier broadcast has an uncertain outcome.'), /Do not send again/);
  assert.match(errorKey('Insufficient unlocked balance'), /Allow for the fee/);
  assert.match(errorKey('Invalid mainnet address.'), /wrong network/);
});
