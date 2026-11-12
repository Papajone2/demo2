import AsyncStorage, { enableTemporaryTestStorage } from '@/lib/app-storage';
import * as SecureStore from 'expo-secure-store';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { checkSecret, createVerifier, isVerifier, LockMethod, Verifier } from '@/lib/kdf';
import { WALLET_STORAGE_KEY } from '@/lib/wallet-model';
import { useLanguage } from '@/context/LanguageContext';
import { IS_NATIVE_ANDROID, nativeEngine } from '@/lib/native-engine';

const VERIFIER_KEY = 'm2014_lock_verifier';
const THROTTLE_KEY = 'm2014_lock_throttle';
const SETUP_KEY = 'm2014_setup_seen';

export const IS_WEB_DEMO = Platform.OS === 'web';

const store = {
  get: (k: string) => (IS_WEB_DEMO ? AsyncStorage.getItem(k) : SecureStore.getItemAsync(k)),
  set: (k: string, v: string) => (IS_WEB_DEMO ? AsyncStorage.setItem(k, v) : SecureStore.setItemAsync(k, v)),
  del: (k: string) => (IS_WEB_DEMO ? AsyncStorage.removeItem(k) : SecureStore.deleteItemAsync(k)),
};

export type LockStatus =
  | 'loading'
  | 'error'
  | 'needsSetup'
  | 'locked'
  | 'unlocked'
  | 'changeVerify'
  | 'changeSet';

type Throttle = { failures: number; until: number };
const FREE_ATTEMPTS = 5;

function lockoutMs(failures: number) {
  if (failures < FREE_ATTEMPTS) return 0;
  return Math.min(30000 * 2 ** (failures - FREE_ATTEMPTS), 15 * 60 * 1000);
}

type Ctx = {
  status: LockStatus;
  method: LockMethod | null;
  pinLength: 4 | 6;
  error: string | null;
  throttle: Throttle;
  retryLoad: () => void;
  startTemporarySession: () => void;
  setup: (method: LockMethod, secret: string) => Promise<void>;
  unlock: (secret: string) => Promise<{ ok: boolean; message?: string }>;
  authorize: (secret: string) => Promise<{ ok: boolean; message?: string }>;
  lock: () => void;
  startChange: () => void;
  cancelChange: () => void;
  eraseEverything: () => Promise<void>;
};

const LockContext = createContext<Ctx | null>(null);

export function LockProvider({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage();
  const [status, setStatus] = useState<LockStatus>('loading');
  const [verifier, setVerifier] = useState<Verifier | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [throttle, setThrottle] = useState<Throttle>({ failures: 0, until: 0 });
  const busy = useRef(false);
  const statusRef = useRef(status);
  const activeRef = useRef(true);
  statusRef.current = status;

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const raw = await store.get(VERIFIER_KEY);
      const th = await store.get(THROTTLE_KEY);
      if (th) {
        const p = JSON.parse(th) as Throttle;
        if (typeof p.failures === 'number' && typeof p.until === 'number') setThrottle(p);
      }
      if (!raw) {
        setVerifier(null);
        setStatus('needsSetup');
        return;
      }
      const parsed = JSON.parse(raw);
      if (!isVerifier(parsed)) throw new Error('Stored lock data is unreadable.');
      setVerifier(parsed);
      setStatus('locked');
    } catch (e) {
      // Fail closed: never unlock when the verifier cannot be read.
      setError(e instanceof Error ? e.message : 'Secure storage could not be read.');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      activeRef.current = s === 'active';
      if (s === 'background' && (statusRef.current === 'unlocked' || statusRef.current === 'changeSet')) {
        setStatus('locked');
      }
    });
    return () => sub.remove();
  }, []);

  const setup = useCallback(async (method: LockMethod, secret: string) => {
    if (busy.current) return;
    busy.current = true;
    try {
      const v = await createVerifier(method, secret);
      await store.set(VERIFIER_KEY, JSON.stringify(v));
      await store.set(THROTTLE_KEY, JSON.stringify({ failures: 0, until: 0 }));
      await AsyncStorage.setItem(SETUP_KEY, '1');
      setVerifier(v);
      setThrottle({ failures: 0, until: 0 });
      setStatus(activeRef.current ? 'unlocked' : 'locked');
    } finally {
      busy.current = false;
    }
  }, []);

  const verify = useCallback(
    async (secret: string) => {
      if (!verifier) return { ok: false, message: 'No lock configured.' };
      if (busy.current) return { ok: false, message: 'Already checking.' };
      if (Date.now() < throttle.until) return { ok: false, message: 'Too many attempts. Wait for the timer.' };
      busy.current = true;
      try {
        const ok = await checkSecret(verifier, secret);
        if (ok) {
          const reset = { failures: 0, until: 0 };
          await store.set(THROTTLE_KEY, JSON.stringify(reset));
          setThrottle(reset);
          return { ok: true };
        }
        const failures = throttle.failures + 1;
        const next = { failures, until: Date.now() + lockoutMs(failures) };
        await store.set(THROTTLE_KEY, JSON.stringify(next));
        setThrottle(next);
        const left = FREE_ATTEMPTS - failures;
        return {
          ok: false,
          message:
            left > 0
              ? t('Incorrect. {n} attempts before a timed lockout.', { n: left })
              : 'Incorrect. Input is paused before the next try.',
        };
      } catch {
        return { ok: false, message: 'Secure storage error. Still locked.' };
      } finally {
        busy.current = false;
      }
    },
    [verifier, throttle, t],
  );

  const unlock = useCallback(async (secret: string) => {
    const result = await verify(secret);
    if (result.ok) setStatus(s => !activeRef.current ? 'locked' : s === 'changeVerify' ? 'changeSet' : 'unlocked');
    return result;
  }, [verify]);

  const authorize = useCallback(async (secret: string) => {
    if (statusRef.current !== 'unlocked' || !activeRef.current) return { ok: false, message: 'Unlock the app first.' };
    const result = await verify(secret);
    if (statusRef.current !== 'unlocked' || !activeRef.current) return { ok: false, message: 'The app was locked. Try again after unlocking.' };
    return result;
  }, [verify]);

  const lock = useCallback(() => setStatus('locked'), []);
  const startChange = useCallback(() => setStatus('changeVerify'), []);
  const cancelChange = useCallback(() => setStatus('unlocked'), []);

  const eraseEverything = useCallback(async () => {
    if (IS_NATIVE_ANDROID) await nativeEngine().erase();
    await store.del(VERIFIER_KEY);
    await store.del(THROTTLE_KEY);
    await AsyncStorage.multiRemove([WALLET_STORAGE_KEY, SETUP_KEY]);
    setVerifier(null);
    setThrottle({ failures: 0, until: 0 });
    setStatus('needsSetup');
  }, []);

  const value = useMemo(
    () => ({
      status,
      method: verifier?.method ?? null,
      // Old installations keep accepting their existing six-digit PIN.
      pinLength: verifier?.pinLength ?? 6,
      error,
      throttle,
      retryLoad: load,
      startTemporarySession: () => {
        if (!IS_WEB_DEMO) return;
        enableTemporaryTestStorage();
        setVerifier(null);
        setError(null);
        setThrottle({ failures: 0, until: 0 });
        setStatus('needsSetup');
      },
      setup,
      unlock,
      authorize,
      lock,
      startChange,
      cancelChange,
      eraseEverything,
    }),
    [status, verifier, error, throttle, load, setup, unlock, authorize, lock, startChange, cancelChange, eraseEverything],
  );
  return <LockContext.Provider value={value}>{children}</LockContext.Provider>;
}

export function useLock() {
  const c = useContext(LockContext);
  if (!c) throw new Error('useLock must be used inside LockProvider');
  return c;
}
