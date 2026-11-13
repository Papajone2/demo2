import AsyncStorage, { enableTemporaryTestStorage } from '@/lib/app-storage';
import * as SecureStore from 'expo-secure-store';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform, View } from 'react-native';
import { AUTO_LOCK_MS, lockoutMs } from '@/lib/security-policy';
import { checkSecret, createVerifier, isVerifier, LockMethod, Verifier } from '@/lib/kdf';
import { WALLET_STORAGE_KEY } from '@/lib/wallet-model';
import { useLanguage } from '@/context/LanguageContext';
import { IS_NATIVE_ANDROID, nativeEngine } from '@/lib/native-engine';

const VERIFIER_KEY = 'm2014_lock_verifier';
const THROTTLE_KEY = 'm2014_lock_throttle';
const SETUP_KEY = 'm2014_setup_seen';
const AUTO_LOCK_KEY = 'm2014_auto_lock';
const DESTRUCTION_KEY = 'm2014_destruction_verifier';

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
  autoLock: boolean;
  setAutoLock: (enabled: boolean) => Promise<void>;
  destructionEnabled: boolean;
  setDestruction: (secret: string) => Promise<void>;
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
  const [autoLock, updateAutoLock] = useState(true);
  const [destruction, setDestructionVerifier] = useState<Verifier | null>(null);
  const lastActivity = useRef(Date.now());
  statusRef.current = status;

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const raw = await store.get(VERIFIER_KEY);
      const th = await store.get(THROTTLE_KEY);
      updateAutoLock((await store.get(AUTO_LOCK_KEY)) !== 'off');
      const wipeRaw = await store.get(DESTRUCTION_KEY);
      if (wipeRaw) {
        const wipe = JSON.parse(wipeRaw);
        if (!isVerifier(wipe)) throw new Error('Stored lock data is unreadable.');
        setDestructionVerifier(wipe);
      }
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
      if (autoLock && Date.now() - lastActivity.current >= AUTO_LOCK_MS && statusRef.current === 'unlocked') {
        setStatus('locked');
      }
    });
    return () => sub.remove();
  }, [autoLock]);
  useEffect(() => {
    if (!autoLock) return;
    const timer = setInterval(() => {
      if (statusRef.current === 'unlocked' && Date.now() - lastActivity.current >= AUTO_LOCK_MS) setStatus('locked');
    }, 1000);
    return () => clearInterval(timer);
  }, [autoLock]);

  const setup = useCallback(async (method: LockMethod, secret: string) => {
    if (busy.current) return;
    busy.current = true;
    try {
      const v = await createVerifier(method, secret);
      await store.set(VERIFIER_KEY, JSON.stringify(v));
      await store.set(THROTTLE_KEY, JSON.stringify({ failures: 0, until: 0 }));
      await AsyncStorage.setItem(SETUP_KEY, '1');
      setVerifier(v);
      // A changed unlock secret must not accidentally become a destruction secret.
      await store.del(DESTRUCTION_KEY);
      setDestructionVerifier(null);
      setThrottle({ failures: 0, until: 0 });
      lastActivity.current = Date.now();
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
        const left = 5 - failures % 5;
        return {
          ok: false,
          message:
            failures % 5 !== 0
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
    if (!busy.current && statusRef.current === 'locked' && Date.now() >= throttle.until && destruction) {
      busy.current = true;
      try {
        if (await checkSecret(destruction, secret)) {
          // Opt-in only. No recovery words are destroyed on-chain; this removes
          // local files and the local wrapped passwords.
          if (IS_NATIVE_ANDROID) await nativeEngine().erase();
          await store.del(VERIFIER_KEY); await store.del(DESTRUCTION_KEY); await store.del(THROTTLE_KEY);
          await AsyncStorage.multiRemove([WALLET_STORAGE_KEY, SETUP_KEY]);
          setVerifier(null); setDestructionVerifier(null); setThrottle({ failures: 0, until: 0 }); setStatus('needsSetup');
          return { ok: false, message: 'Wallet data removed from this device.' };
        }
      } finally { busy.current = false; }
    }
    const result = await verify(secret);
    if (result.ok) { lastActivity.current = Date.now(); setStatus(s => !activeRef.current ? 'locked' : s === 'changeVerify' ? 'changeSet' : 'unlocked'); }
    return result;
  }, [verify, destruction, throttle]);

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
    await store.del(DESTRUCTION_KEY);
    await AsyncStorage.multiRemove([WALLET_STORAGE_KEY, SETUP_KEY]);
    setVerifier(null);
    setDestructionVerifier(null);
    setThrottle({ failures: 0, until: 0 });
    setStatus('needsSetup');
  }, []);
  const setAutoLock = useCallback(async (enabled: boolean) => {
    await store.set(AUTO_LOCK_KEY, enabled ? 'on' : 'off');
    lastActivity.current = Date.now(); updateAutoLock(enabled);
  }, []);
  const setDestruction = useCallback(async (secret: string) => {
    if (statusRef.current !== 'unlocked' || !verifier) throw new Error('Unlock the app first.');
    if (!secret) { await store.del(DESTRUCTION_KEY); setDestructionVerifier(null); return; }
    if (await checkSecret(verifier, secret)) throw new Error('Choose a different secret from your unlock secret.');
    if (verifier.method === 'pin' && !new RegExp(`^\\d{${verifier.pinLength ?? 6}}$`).test(secret)) throw new Error('Use the same PIN length as your unlock PIN.');
    if (verifier.method === 'password' && secret.length < 8) throw new Error('Use at least 8 characters.');
    const next = await createVerifier(verifier.method, secret, verifier.pinLength ?? 6);
    await store.set(DESTRUCTION_KEY, JSON.stringify(next)); setDestructionVerifier(next);
  }, [verifier]);

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
      autoLock, setAutoLock, destructionEnabled: !!destruction, setDestruction,
    }),
    [status, verifier, error, throttle, load, setup, unlock, authorize, lock, startChange, cancelChange, eraseEverything, autoLock, setAutoLock, destruction, setDestruction],
  );
  return <LockContext.Provider value={value}><View style={{ flex: 1 }} onTouchStart={() => { if (activeRef.current) lastActivity.current = Date.now(); }} onPointerDown={() => { if (activeRef.current) lastActivity.current = Date.now(); }}>{children}</View></LockContext.Provider>;
}

export function useLock() {
  const c = useContext(LockContext);
  if (!c) throw new Error('useLock must be used inside LockProvider');
  return c;
}
