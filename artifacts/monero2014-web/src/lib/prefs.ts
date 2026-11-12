import { enableTemporaryVault } from './vault';
import { useSyncExternalStore } from 'react';
import type { Preferences } from '@/lib/wallet-types';

const KEY = 'monero2014.prefs.v1';
export const DEFAULT_PREFS: Preferences = { currency: 'usd', hideBalance: false, autoLockMinutes: 5, autoSync: true };

function probeStorage(): boolean {
  try {
    const k = '__m2014_probe';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

let storageOk = typeof window !== 'undefined' ? probeStorage() : false;
let temporarySession = false;
let prefs: Preferences = load();
const listeners = new Set<() => void>();

function load(): Preferences {
  if (!storageOk) return { ...DEFAULT_PREFS };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const p = JSON.parse(raw) as Partial<Preferences>;
    return {
      currency: p.currency === 'eur' || p.currency === 'gbp' ? p.currency : 'usd',
      hideBalance: !!p.hideBalance,
      autoLockMinutes: typeof p.autoLockMinutes === 'number' && p.autoLockMinutes >= 0 ? p.autoLockMinutes : 5,
      autoSync: p.autoSync !== false,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

function emit() {
  listeners.forEach((l) => l());
}

export const prefsStore = {
  get: () => prefs,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  set(patch: Partial<Preferences>) {
    prefs = { ...prefs, ...patch };
    if (storageOk) {
      try {
        window.localStorage.setItem(KEY, JSON.stringify(prefs));
      } catch {
        storageOk = false;
      }
    }
    emit();
  },
};

type StorageState = { storageOk: boolean; temporarySession: boolean };
let storageState: StorageState = { storageOk, temporarySession };
export const storageStore = {
  get: () => storageState,
  subscribe: prefsStore.subscribe,
  useTemporary() {
    enableTemporaryVault();
    temporarySession = true;
    storageState = { storageOk, temporarySession };
    emit();
  },
  recheck() {
    storageOk = probeStorage();
    storageState = { storageOk, temporarySession };
    emit();
  },
};

export function usePrefs() {
  return useSyncExternalStore(prefsStore.subscribe, prefsStore.get);
}
export function useStorageState() {
  return useSyncExternalStore(storageStore.subscribe, storageStore.get);
}
