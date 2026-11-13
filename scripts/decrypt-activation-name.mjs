import { createDecipheriv, privateDecrypt, constants } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function decryptActivationName(envelope, privateKey) {
  if (envelope.v !== 1 || envelope.event !== 'wallet_activated' ||
      !/^[A-Za-z0-9_-]{1,64}$/.test(envelope.keyId) ||
      !/^[a-f0-9-]{36}$/.test(envelope.eventId)) throw new Error('Invalid report.');
  const key = privateDecrypt({ key: privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    Buffer.from(envelope.wrappedKey, 'base64'));
  try {
    const sealed = Buffer.from(envelope.ciphertext, 'base64');
    const cipher = createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64'));
    cipher.setAAD(Buffer.from(`monero-wallet/activation/v1|${envelope.keyId}|${envelope.eventId}`));
    cipher.setAuthTag(sealed.subarray(-16));
    return Buffer.concat([cipher.update(sealed.subarray(0, -16)), cipher.final()]).toString('utf8');
  } finally { key.fill(0); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const key = process.env.WALLET_ACTIVATION_PRIVATE_KEY_PEM;
    if (!key) throw new Error('Missing server-only private key.');
    let input = '';
    for await (const chunk of process.stdin) {
      input += chunk.toString();
      if (input.length > 8192) throw new Error('Report is too large.');
    }
    const envelope = JSON.parse(input);
    process.stdout.write(`${decryptActivationName(envelope, key)}\n`);
  } catch {
    process.stderr.write('Unable to decrypt report. Check the server key and envelope; no secret values were logged.\n');
    process.exitCode = 1;
  }
}
