import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateKeyPairSync, randomBytes, createCipheriv, createDecipheriv, publicEncrypt, privateDecrypt } from 'node:crypto';
import { parseUsernameEnvelope, relayUsername } from '../../api-server/src/routes/username-report.ts';

const source = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const fields = ['encrypted_aes_key', 'event', 'timestamp', 'username'];
function envelope() {
  const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const key = randomBytes(32), iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update('Name fixture'), cipher.final(), cipher.getAuthTag()]);
  const body = { encrypted_aes_key: publicEncrypt({ key: pair.publicKey, oaepHash: 'sha256' }, key).toString('base64'),
    event: 'new_user', timestamp: '2026-11-03T09:44:15Z', username: Buffer.concat([iv, ciphertext]).toString('base64') };
  key.fill(0);
  return { body, pair };
}

test('four-field envelope supports the documented RSA and AES packing', () => {
  const { body, pair } = envelope();
  assert.deepEqual(Object.keys(parseUsernameEnvelope(body)), fields);
  const key = privateDecrypt({ key: pair.privateKey, oaepHash: 'sha256' }, Buffer.from(body.encrypted_aes_key, 'base64'));
  try {
    const packed = Buffer.from(body.username, 'base64');
    const cipher = createDecipheriv('aes-256-gcm', key, packed.subarray(0, 12));
    cipher.setAuthTag(packed.subarray(-16));
    assert.equal(Buffer.concat([cipher.update(packed.subarray(12, -16)), cipher.final()]).toString(), 'Name fixture');
  } finally { key.fill(0); }
});

test('relay rejects extra identifying fields and malformed ciphertext', () => {
  const { body } = envelope();
  for (const field of ['seed', 'address', 'amount', 'txid', 'walletId', 'privateKey']) {
    assert.throws(() => parseUsernameEnvelope({ ...body, [field]: 'forbidden' }));
  }
  assert.throws(() => parseUsernameEnvelope({ ...body, username: 'plaintext' }));
  assert.throws(() => parseUsernameEnvelope({ ...body, timestamp: 'invalid' }));
});

test('relay preserves the four fields and deduplicates acknowledged reports', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'username-report-'));
  const body = parseUsernameEnvelope(envelope().body);
  let calls = 0;
  const post = async (_url, init) => {
    calls++;
    assert.deepEqual(Object.keys(JSON.parse(init.body)), fields);
    assert.equal(JSON.parse(init.body).username, body.username);
    assert.match(init.headers['Idempotency-Key'], /^[a-f0-9]{64}$/);
    assert.equal(init.redirect, 'error');
    return new Response('', { status: 200 });
  };
  try {
    assert.equal(await relayUsername(body, 'https://fixture.invalid/hook', directory, post), 'delivered');
    assert.equal(await relayUsername(body, 'https://fixture.invalid/hook', directory, post), 'duplicate');
    assert.equal(calls, 1);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('public config contains no secret and disclosure appears in one app location only', () => {
  const config = JSON.parse(source('../modules/monero-engine/android/src/main/assets/username-reporting.json'));
  assert.deepEqual(Object.keys(config), ['enabled', 'public_key_pem', 'receiver_url']);
  assert.equal(config.enabled, false);
  assert.equal(config.public_key_pem, '');
  assert.equal(config.receiver_url, '');
  const screens = source('../components/account-flows.tsx');
  assert.equal((screens.match(/testID="username-reporting-notice"/g) ?? []).length, 1);
  const engine = source('../modules/monero-engine/android/src/main/java/com/monero2014/engine/WalletEngine.kt');
  assert.match(engine, /if \(firstMainnetName\) runCatching/);
  const reporter = source('../modules/monero-engine/android/src/main/java/com/monero2014/engine/UsernameReporter.kt');
  assert.match(reporter, /if \(!configured\(\) \|\| !eligible \|\| !foreground \|\| tor/);
  assert.doesNotMatch(reporter, /MONERO_|recovery|seed|password\(/);
});

test('failed webhook delivery retries the same envelope without marking it delivered', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'username-report-'));
  const body = parseUsernameEnvelope(envelope().body);
  try {
    assert.equal(await relayUsername(body, 'https://fixture.invalid/hook', directory,
      async () => new Response('', { status: 503 })), 'unavailable');
    assert.equal(await relayUsername(body, 'https://fixture.invalid/hook', directory,
      async () => new Response('', { status: 200 })), 'delivered');
    await assert.rejects(relayUsername(body, 'http://fixture.invalid/hook', directory));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
