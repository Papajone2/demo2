import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@/lib/app-storage';
import { nativeEngine, type NativeAccount, type NativeSnapshot } from '@/lib/native-engine';
import { useLock } from '@/context/LockContext';
import { isAvatarId, validatedWalletName, type WalletState, type AvatarId } from '@/lib/wallet-model';
import type { Ctx } from './WalletContext';
import { useMarketHistory } from '@/hooks/useMarketData';
import { AppState } from 'react-native';
import { useLanguage } from '@/context/LanguageContext';
import { loadNetworkPolicy } from '@/lib/network-policy';
import { observeScan, SYNC_CALIBRATION_KEY, type ScanWindow } from '@/lib/sync-estimate';
import { requireUnlockedSession } from '@/lib/session-policy';
export { WALLET_STORAGE_KEY, REQUIRED_CONFIRMATIONS, balances } from '@/lib/wallet-model';
export type { Tx, TxKind, WalletState } from '@/lib/wallet-model';

const Context = createContext<Ctx | null>(null);
const PREFS = 'm2014.native.public-prefs.v1';
type Prefs = Record<string, Partial<Pick<WalletState, 'currency' | 'hideBalance'>>>;
const accountState = (a: NativeAccount, snapshot: NativeSnapshot | null, prefs: Prefs): WalletState => ({
  v: 1, id: a.id, name: a.name, iconId: isAvatarId(a.iconId) ? a.iconId : 'monero',
  receiveAddress: snapshot?.id === a.id ? snapshot.addresses.at(-1)! : '',
  addresses: snapshot?.id === a.id ? snapshot.addresses : [],
  txs: snapshot?.id === a.id ? snapshot.txs : [],
  currency: prefs[a.id]?.currency ?? 'USD', hideBalance: prefs[a.id]?.hideBalance ?? false,
  rateCents: null, needsCustomization: a.needsCustomization, network: a.network,
  broadcastWarning: snapshot?.id === a.id ? snapshot.broadcastWarning : '',
});

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const { authorize, status } = useLock();
  const sessionStatus = useRef(status);
  sessionStatus.current = status;
  const { language } = useLanguage();
  const languageRef = useRef(language);
  languageRef.current = language;
  const [accounts, setAccounts] = useState<NativeAccount[]>([]);
  const [snapshot, setSnapshot] = useState<NativeSnapshot | null>(null);
  const [prefs, setPrefs] = useState<Prefs>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const active = useRef(AppState.currentState === 'active');
  const scanSample = useRef<ScanWindow | null>(null);
  const savedCalibrationAt = useRef(0);
  const [estimate, setEstimate] = useState({ seconds: 0, low: 0, high: 0, state: 'measuring' as 'measuring' | 'tracking' | 'stalled' | 'complete' });
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const run = useCallback(<T,>(work: () => Promise<T>): Promise<T> => {
    const task = queue.current.then(work);
    queue.current = task.catch(() => undefined);
    return task;
  }, []);
  const publish = useCallback((s: NativeSnapshot) => {
    if (!mounted.current) return;
    const now = Date.now();
    const measured = observeScan(scanSample.current, `${s.id}|${s.daemon}`, s.height, s.target, s.complete, now);
    scanSample.current = measured.window;
    setEstimate(measured);
    if (measured.calibrated && now - savedCalibrationAt.current >= 60000) {
      savedCalibrationAt.current = now;
      void AsyncStorage.setItem(SYNC_CALIBRATION_KEY, JSON.stringify({ rate: measured.rate, at: now })).catch(() => {});
    }
    setSnapshot(s);
  }, []);
  const load = useCallback(() => {
    scanSample.current = null;
    setLoading(true); setError(null);
    void run(async () => {
      const engine = nativeEngine();
      await loadNetworkPolicy();
      const list = await engine.list();
      if (!mounted.current) return;
      setAccounts(list);
      const raw = await AsyncStorage.getItem(PREFS);
      // A language suggests an initial currency; an explicit preference wins.
      const existing: Prefs = raw ? JSON.parse(raw) : {};
      for (const a of list) if (!existing[a.id]?.currency) existing[a.id] = { ...existing[a.id], currency: languageRef.current === 'hi' ? 'INR' : 'USD' };
      await AsyncStorage.setItem(PREFS, JSON.stringify(existing)); setPrefs(existing);
      if (list.length) {
        const s = await engine.open(list[0].id);
        publish(s);
        // Failed connection must not fabricate sync progress or balances.
        try { await engine.connect(s.daemon); } catch {
          // Keep the encrypted wallet accessible offline. Sync stays incomplete;
          // the Real wallets screen lets the user configure/retry the daemon.
        }
        publish(await engine.snapshot());
      } else setSnapshot(null);
    }).catch(e => mounted.current && setError(e instanceof Error ? e.message : 'Native engine failed.'))
      .finally(() => mounted.current && setLoading(false));
  }, [run, publish]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', next => {
      active.current = next === 'active';
      if (active.current) load();
      else void run(() => nativeEngine().close()).catch(() => undefined);
    });
    return () => listener.remove();
  }, [load, run]);
  useEffect(() => {
    mounted.current = true; load();
    return () => { mounted.current = false; void nativeEngine().close().catch(() => undefined); };
  }, [load]);
  useEffect(() => {
    if (!snapshot?.id) return;
    const timer = setInterval(() => {
      if (!active.current) return;
      void run(async () => {
        publish(await nativeEngine().snapshot());
        if (sessionStatus.current === 'unlocked' && active.current) await nativeEngine().reportUsername();
      }).catch(e => {
        if (mounted.current) setError(e instanceof Error ? e.message : 'Scanning failed.');
      });
    }, 3000);
    return () => clearInterval(timer);
  }, [snapshot?.id, run, publish]);
  const currency = prefs[snapshot?.id ?? '']?.currency ?? 'USD';
  const supportedCurrency = ({ USD: 'usd', EUR: 'eur', GBP: 'gbp', INR: 'inr', CHF: 'chf' } as const)[currency as 'USD' | 'EUR' | 'GBP' | 'INR' | 'CHF'];
  const market = useMarketHistory({ currency: supportedCurrency ?? 'usd', range: '1d' }, {
    query: { enabled: Boolean(snapshot && supportedCurrency), staleTime: 60000, refetchInterval: 60000, retry: 1 },
  });
  const wallets = useMemo(() => accounts.map(a => {
    const wallet = accountState(a, snapshot, prefs);
    if (a.id === snapshot?.id && supportedCurrency && market.data) wallet.rateCents = String(Math.round(market.data.price * 100));
    return wallet;
  }), [accounts, snapshot, prefs, supportedCurrency, market.data]);
  const state = wallets.find(w => w.id === snapshot?.id) ?? null;
  const value: Ctx = {
    state, wallets, selectedId: state?.id ?? null, nextWalletNumber: accounts.length + 1,
    loading, error, reload: load,
    available: BigInt(snapshot?.available ?? '0'),
    total: BigInt(snapshot?.total ?? '0'),
    locked: BigInt(snapshot?.total ?? '0') - BigInt(snapshot?.available ?? '0'),
    sync: {
      progress: snapshot?.complete ? 1 : snapshot && snapshot.target > 0 ? Math.max(0, Math.min(1, snapshot.height / snapshot.target)) : 0,
      complete: snapshot?.complete ?? false, remainingSeconds: estimate.seconds, height: snapshot?.height, target: snapshot?.target,
      etaLow: estimate.low, etaHigh: estimate.high, etaState: estimate.state,
    },
    selectWallet: async (id, secret, signal) => {
      requireUnlockedSession(sessionStatus.current, active.current);
      setLoading(true);
      try {
        await run(async () => {
          if (signal?.aborted || !mounted.current) throw new Error('Switch cancelled.');
          requireUnlockedSession(sessionStatus.current, active.current);
          const s = await nativeEngine().open(id);
          publish(s);
          try { await nativeEngine().connect(s.daemon); } catch { /* Offline: sending stays disabled. */ }
          publish(await nativeEngine().snapshot());
        });
      } finally { if (mounted.current) setLoading(false); }
    },
    // Native account creation must pass through backup UI, never silently discard a seed.
    createWallet: async () => { throw new Error('Use Native engine → Add or restore wallet, and back up its recovery phrase.'); },
    updateWalletProfile: async (id, profile) => run(async () => {
      const a = accounts.find(a => a.id === id);
      if (!a) throw new Error('Account not found.');
      const name = validatedWalletName(profile.name ?? a.name);
      const icon: AvatarId = profile.iconId ?? (isAvatarId(a.iconId) ? a.iconId : 'monero');
      await nativeEngine().profile(id, name, icon);
      setAccounts(await nativeEngine().list());
    }),
    deleteWallet: async (id, secret, signal) => {
      const auth = await authorize(secret);
      if (!auth.ok) throw new Error(auth.message);
      await run(async () => {
        if (signal?.aborted) throw new Error('Deletion cancelled.');
        await nativeEngine().remove(id);
        const list = await nativeEngine().list();
        setAccounts(list);
        if (snapshot?.id === id) {
          if (list.length) {
            const s = await nativeEngine().open(list[0].id); publish(s);
            try { await nativeEngine().connect(s.daemon); } catch { /* Offline: sending stays disabled. */ }
          } else setSnapshot(null);
        }
      });
    },
    send: async () => { throw new Error('Native payments require an engine-prepared review token.'); },
    addFunds: async () => { throw new Error('Simulation credits are disabled in the native APK.'); },
    advanceBlocks: async () => { throw new Error('Confirmations come from the blockchain and cannot be advanced by the app.'); },
    resetSandbox: async () => { throw new Error('Native wallet reset is disabled. Back up before deleting an account.'); },
    updatePrefs: async p => {
      if (!state) throw new Error('Select a wallet.');
      if (p.name !== undefined) await value.updateWalletProfile(state.id, { name: p.name });
      const next = { ...prefs, [state.id]: { currency: p.currency ?? state.currency, hideBalance: p.hideBalance ?? state.hideBalance } };
      await AsyncStorage.setItem(PREFS, JSON.stringify(next)); setPrefs(next);
    },
    newReceiveAddress: () => run(async () => publish(await nativeEngine().subaddress())),
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useWallet(): Ctx {
  const context = useContext(Context);
  if (!context) throw new Error('useWallet must be used inside WalletProvider');
  return context;
}
