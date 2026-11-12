import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newEncryption, seal, unseal, b64, unb64 } from '../../artifacts/monero2014-web/src/lib/vault.ts';
import { fmtXmr, xmrNumber } from '../../artifacts/monero2014-web/src/lib/format.ts';

// Synthetic fixtures only: these are not wallet keys or a deployed password.
const meta = { id: 'synthetic-vault', name: 'Fixture', createdAt: new Date(0).toISOString() };
const data = { enginePassword: 'synthetic-internal-key', keys: 'Zml4dHVyZQ==', cache: '' };
const password = 'synthetic-test-password';
test('wallet ciphertext round-trips and uses a fresh nonce per save', async () => {
  const encryption = await newEncryption(password);
  const first = await seal(meta, data, encryption);
  const second = await seal(meta, data, encryption);
  assert.notEqual(first.iv, second.iv);
  assert.notEqual(first.ciphertext, second.ciphertext);
  assert.ok(!first.ciphertext.includes(data.enginePassword));
  assert.deepEqual((await unseal(first, password)).data, data);
});
test('wrong password, changed ciphertext and swapped wallet identity fail closed', async () => {
  const first = await seal(meta, data, await newEncryption(password));
  await assert.rejects(unseal(first, 'incorrect-password'));
  await assert.rejects(unseal({ ...first, id: 'different-wallet' }, password));
  const damaged = unb64(first.ciphertext); damaged[0] ^= 1;
  await assert.rejects(unseal({ ...first, ciphertext: b64(damaged) }, password));
});
test('short passwords and wrong-network backup files are rejected', async () => {
  await assert.rejects(newEncryption('1234'));
  const first = await seal(meta, data, await newEncryption(password));
  await assert.rejects(unseal({ ...first, network: 'mainnet' }, password));
});
test('atomic units are converted only for display without a trillion-fold error', () => {
  assert.equal(fmtXmr('1000000000000'), '1.00');
  assert.equal(fmtXmr('1234567890123', 12), '1.234567890123');
  assert.equal(fmtXmr('-2000000000000'), '-2.00');
  assert.equal(xmrNumber('2500000000000'), 2.5);
});
