import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function randomId(len = 12): string {
  const bytes = Platform.OS === 'web'
    ? globalThis.crypto.getRandomValues(new Uint8Array(len))
    : Crypto.getRandomBytes(len);
  let s = '';
  for (let i = 0; i < len; i++) s += ALPH[bytes[i] % ALPH.length];
  return s;
}

/** Visibly invalid sandbox identifier. Never a valid Monero address. */
export function newTestAddress(): string {
  const r = randomId(16);
  return `TEST-${r.slice(0, 4)}-${r.slice(4, 8)}-${r.slice(8, 12)}-${r.slice(12, 16)}`;
}
