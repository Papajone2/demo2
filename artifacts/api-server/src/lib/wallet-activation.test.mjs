import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCipheriv, publicEncrypt, constants, generateKeyPairSync, randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseActivation, deliverActivation } from './wallet-activation.ts';
import { decryptActivationName } from '../../../../scripts/decrypt-activation-name.mjs';

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
function report() {
  const key = randomBytes(32), iv = randomBytes(12), eventId = randomUUID(), keyId = 'names-v1';
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(`monero-wallet/activation/v1|${keyId}|${eventId}`));
  const ciphertext = Buffer.concat([cipher.update('Fixture wallet'), cipher.final(), cipher.getAuthTag()]);
  const wrapped = publicEncrypt({ key: publicKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, key);
  key.fill(0);
  return { v: 1, event: 'wallet_activated', eventId, keyId, wrappedKey: wrapped.toString('base64'), iv: iv.toString('base64'), ciphertext: ciphertext.toString('base64') };
}

test('hybrid envelope decrypts and rejects ciphertext or metadata tampering', () => {
  const body = report();
  assert.equal(decryptActivationName(parseActivation(body), privateKey), 'Fixture wallet');
  assert.throws(() => decryptActivationName({ ...body, keyId: 'other-key' }, privateKey));
  const changed = Buffer.from(body.ciphertext, 'base64'); changed[0] ^= 1;
  assert.throws(() => decryptActivationName({ ...body, ciphertext: changed.toString('base64') }, privateKey));
  assert.notEqual(report().ciphertext, body.ciphertext);
});

test('relay schema rejects plaintext, extra private material and invalid binary lengths', () => {
  const body = report();
  for (const field of ['name', 'seed', 'privateKey', 'address', 'amount', 'txid', 'walletId']) {
    assert.throws(() => parseActivation({ ...body, [field]: 'forbidden' }));
  }
  assert.throws(() => parseActivation({ ...body, iv: 'abcd' }));
  assert.throws(() => parseActivation({ ...body, eventId: '../escape' }));
  assert.throws(() => parseActivation({ ...body, ciphertext: 'not base64' }));
});

test('relay forwards encrypted data once after acknowledgement and persists deduplication', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'activation-test-'));
  const body = parseActivation(report()); let calls = 0;
  const post = async (_url, init) => {
    calls++; assert.equal(init.redirect, 'error');
    assert.equal(init.headers['Idempotency-Key'], body.eventId);
    assert.equal(JSON.parse(init.body).ciphertext, body.ciphertext);
    assert.ok(!init.body.includes('Fixture wallet'));
    return new Response('', { status: 200 });
  };
  try {
    assert.equal(await deliverActivation(body, 'https://relay-fixture.invalid/hook', dir, post), 'delivered');
    assert.equal(await deliverActivation(body, 'https://relay-fixture.invalid/hook', dir, post), 'duplicate');
    assert.equal(await deliverActivation({ ...parseActivation(report()), eventId: body.eventId }, 'https://relay-fixture.invalid/hook', dir, post), 'conflict');
    assert.equal(calls, 1); assert.equal((await readdir(dir)).length, 1);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('failed delivery can retry, and redirects or insecure destinations are not accepted', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'activation-test-')); const body = parseActivation(report());
  try {
    assert.equal(await deliverActivation(body, 'https://relay-fixture.invalid/hook', dir, async () => new Response('', { status: 503 })), 'unavailable');
    assert.equal((await readdir(dir)).length, 0);
    assert.equal(await deliverActivation(body, 'https://relay-fixture.invalid/hook', dir, async () => new Response('', { status: 200 })), 'delivered');
    await assert.rejects(deliverActivation(parseActivation(report()), 'http://relay-fixture.invalid/hook', dir));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
