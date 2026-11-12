import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@/lib/app-storage';
import { nativeEngine, type NativeAccount, type NativeSnapshot } from '@/lib/native-engine';
import { useLock } from '@/context/LockContext';
import { isAvatarId, validatedWalletName, type WalletState, type AvatarId } from '@/lib/wallet-model';
import type { Ctx } from './WalletContext';
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
  rateCents: null, needsCustomization: false,
});

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const { authorize } = useLock();
  const [accounts, setAccounts] = useState<NativeAccount[]>([]);
  const [snapshot, setSnapshot] = useState<NativeSnapshot | null>(null);
  const [prefs, setPrefs] = useState<Prefs>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const run = useCallback(<T,>(work: () => Promise<T>): Promise<T> => {
    const task = queue.current.then(work);
    queue.current = task.catch(() => undefined);
    return task;
  }, []);
  const publish = useCallback((s: NativeSnapshot) => { if (mounted.current) setSnapshot(s); }, []);
  const load = useCallback(() => {
    setLoading(true); setError(null);
    void run(async () => {
      const engine = nativeEngine();
      const list = await engine.list();
      if (!mounted.current) return;
      setAccounts(list);
      const raw = await AsyncStorage.getItem(PREFS);
      if (raw) setPrefs(JSON.parse(raw));
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
    mounted.current = true; load();
    return () => { mounted.current = false; void nativeEngine().close().catch(() => undefined); };
  }, [load]);
  useEffect(() => {
    if (!snapshot?.id) return;
    const timer = setInterval(() => {
      void run(async () => publish(await nativeEngine().snapshot())).catch(e => {
        if (mounted.current) setError(e instanceof Error ? e.message : 'Scanning failed.');
      });
    }, 3000);
    return () => clearInterval(timer);
  }, [snapshot?.id, run, publish]);
  const wallets = useMemo(() => accounts.map(a => accountState(a, snapshot, prefs)), [accounts, snapshot, prefs]);
  const state = wallets.find(w => w.id === snapshot?.id) ?? null;
  const value: Ctx = {
    state, wallets, selectedId: state?.id ?? null, nextWalletNumber: accounts.length + 1,
    loading, error, reload: load,
    available: BigInt(snapshot?.available ?? '0'),
    total: BigInt(snapshot?.total ?? '0'),
    locked: BigInt(snapshot?.total ?? '0') - BigInt(snapshot?.available ?? '0'),
    sync: {
      progress: snapshot?.target ? Math.min(1, snapshot.height / snapshot.target) : 0,
      complete: snapshot?.complete ?? false, remainingSeconds: 0,
    },
    selectWallet: async (id, secret, signal) => {
      const auth = await authorize(secret);
      if (!auth.ok) throw new Error(auth.message);
      await run(async () => {
        if (signal?.aborted) throw new Error('Switch cancelled.');
        const s = await nativeEngine().open(id);
        publish(s);
        try { await nativeEngine().connect(s.daemon); } catch { /* Offline: sending stays disabled. */ }
      });
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
    addFunds: async () => { throw new Error('Simulation credits are disabled in the native APK. Use a stagenet faucet.'); },
    advanceBlocks: async () => { throw new Error('Native confirmations come from the stagenet blockchain.'); },
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
