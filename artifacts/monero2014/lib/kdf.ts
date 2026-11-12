import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import { nativeEngine } from './native-engine';

export type LockMethod = 'pin' | 'password';
export type Verifier = {
  v: 1;
  method: LockMethod;
  salt: string; // hex
  hash: string; // hex
  iterations: number;
  kdf: 'pbkdf2-sha256';
  pinLength?: 4 | 6;
};

// Pure-JS PBKDF2 is slower on mobile JS engines; tuned to stay usable while being far
// slower than a plain hash. PINs are additionally protected by throttling.
export const ITERATIONS = 60000;

async function derive(secret: string, salt: Uint8Array, iterations: number) {
  if (Platform.OS === 'android') return nativeEngine().deriveSecret(secret.normalize('NFKC'), bytesToHex(salt), iterations);
  const out = await pbkdf2Async(sha256, utf8ToBytes(secret.normalize('NFKC')), salt, {
    c: iterations,
    dkLen: 32,
    asyncTick: 16,
  });
  return bytesToHex(out);
}

export async function createVerifier(method: LockMethod, secret: string, pinLength: 4 | 6 = 4): Promise<Verifier> {
  if (method === 'pin' && !new RegExp(`^\\d{${pinLength}}$`).test(secret)) throw new Error('Use the same PIN length as your unlock PIN.');
  if (method === 'password' && secret.length < 8) throw new Error('Use at least 8 characters.');
  const salt = Platform.OS === 'web'
    ? globalThis.crypto.getRandomValues(new Uint8Array(16))
    : Crypto.getRandomBytes(16);
  const hash = await derive(secret, salt, ITERATIONS);
  return { v: 1, method, salt: bytesToHex(salt), hash, iterations: ITERATIONS, kdf: 'pbkdf2-sha256', ...(method === 'pin' ? { pinLength } : {}) };
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function checkSecret(ver: Verifier, secret: string): Promise<boolean> {
  const hash = await derive(secret, hexToBytes(ver.salt), ver.iterations);
  return constantTimeEqual(hash, ver.hash);
}

export function isVerifier(x: unknown): x is Verifier {
  const o = x as Verifier;
  return (
    !!o &&
    o.v === 1 &&
    (o.method === 'pin' || o.method === 'password') &&
    typeof o.salt === 'string' &&
    /^[0-9a-f]{32}$/.test(o.salt) &&
    typeof o.hash === 'string' &&
    /^[0-9a-f]{64}$/.test(o.hash) &&
    o.kdf === 'pbkdf2-sha256' &&
    (o.pinLength === undefined || o.pinLength === 4 || o.pinLength === 6) &&
    Number.isSafeInteger(o.iterations) &&
    o.iterations >= ITERATIONS &&
    o.iterations <= 1000000
  );
}
