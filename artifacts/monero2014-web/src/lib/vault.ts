import type { WalletMeta } from './wallet-types';

export type Envelope = WalletMeta & { version: 1; network: 'stagenet'; salt: string; iv: string; ciphertext: string; selectedAccount?: number };
export type WalletData = { enginePassword: string; keys: string; cache: string };
const DB_NAME = 'monero2014-encrypted-wallets';
let database: Promise<IDBDatabase> | undefined;
let temporary = false;
const temporaryVaults = new Map<string, Envelope>();
export function enableTemporaryVault() {
  temporaryVaults.clear();
  temporary = true;
}
function db() {
  if (!database) database = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('vaults', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { database = undefined; reject(new Error('Browser storage is blocked. Open this page in a normal browser tab to save your wallet.')); };
    request.onblocked = () => { database = undefined; reject(new Error('Close other wallet tabs and try again.')); };
  });
  return database;
}
async function store<T>(mode: IDBTransactionMode, action: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('vaults', mode);
    const request = action(tx.objectStore('vaults'));
    let result: T;
    request.onsuccess = () => { result = request.result; };
    request.onerror = () => reject(new Error('Unable to read or save wallet storage.'));
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(new Error('Wallet storage transaction failed. No success was recorded.'));
    tx.onabort = () => reject(new Error('Wallet save was interrupted. Please retry.'));
  });
}
export const vaultStore = {
  list: () => temporary ? Promise.resolve([...temporaryVaults.values()]) : store('readonly', s => s.getAll()) as Promise<Envelope[]>,
  read: (id: string) => temporary ? Promise.resolve(temporaryVaults.get(id)) : store('readonly', s => s.get(id)) as Promise<Envelope | undefined>,
  write: async (entry: Envelope) => { if (temporary) temporaryVaults.set(entry.id, entry); else await store('readwrite', s => s.put(entry)); },
  remove: async (id: string) => { if (temporary) temporaryVaults.delete(id); else await store('readwrite', s => s.delete(id)); },
};
export function b64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(s);
}
export function unb64(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(value), c => c.charCodeAt(0));
}
function cryptoAvailable() {
  if (!globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues) throw new Error('A secure HTTPS browser context is required. Open the wallet in a normal browser tab.');
}
export function randomSecret() {
  cryptoAvailable();
  return b64(crypto.getRandomValues(new Uint8Array(32)));
}
async function key(password: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  cryptoAvailable();
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 310000 }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export async function newEncryption(password: string) {
  if (password.length < 10) throw new Error('Use a password with at least 10 characters.');
  cryptoAvailable();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { key: await key(password, salt), salt: b64(salt) };
}
export async function seal(meta: WalletMeta, data: WalletData, encryption: { key: CryptoKey; salt: string }): Promise<Envelope> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(`monero2014:stagenet:${meta.id}`) }, encryption.key, new TextEncoder().encode(JSON.stringify(data)));
  return { ...meta, version: 1, network: 'stagenet', salt: encryption.salt, iv: b64(iv), ciphertext: b64(new Uint8Array(ciphertext)) };
}
export async function unseal(entry: Envelope, password: string): Promise<{ data: WalletData; key: CryptoKey }> {
  if (entry.version !== 1 || entry.network !== 'stagenet' || typeof entry.ciphertext !== 'string' || entry.ciphertext.length > 200000000) throw new Error('Unsupported or damaged wallet backup.');
  try {
    const derived = await key(password, unb64(entry.salt));
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(entry.iv), additionalData: new TextEncoder().encode(`monero2014:stagenet:${entry.id}`) }, derived, unb64(entry.ciphertext));
    const data = JSON.parse(new TextDecoder().decode(plain)) as WalletData;
    if (!data.enginePassword || !data.keys || typeof data.cache !== 'string') throw new Error();
    return { data, key: derived };
  } catch { throw new Error('Incorrect password or damaged wallet file.'); }
}
