import AsyncStorage from '@/lib/app-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ATOMIC_PER_XMR, checkTestAddress, TEST_FEE } from '@/lib/money';
import { newTestAddress, randomId } from '@/lib/random';
import {
  appendWallet, balances, isAvatarId, parseWalletStore, removeWallet, selectedWallet, validatedWalletName,
  selectWallet as selectRecord, updateWallet, WALLET_STORAGE_KEY, REQUIRED_CONFIRMATIONS,
  type AvatarId, type Tx, type WalletState, type WalletStore,
} from '@/lib/wallet-model';
import { useLock } from '@/context/LockContext';
import { requireUnlockedSession } from '@/lib/session-policy';
import { usePreviewSync } from '@/hooks/usePreviewSync';
export { WALLET_STORAGE_KEY, REQUIRED_CONFIRMATIONS };
export { balances } from '@/lib/wallet-model';
export type { Tx, TxKind, WalletState } from '@/lib/wallet-model';

const xmr = (whole: number, frac = '') => (BigInt(whole) * ATOMIC_PER_XMR + BigInt((frac + '000000000000').slice(0, 12))).toString();
function newWallet(name: string, iconId: AvatarId, demo = false): WalletState {
  const now = Date.now();
  const address = newTestAddress();
  return {
    v: 1, id: randomId(), name, iconId, receiveAddress: address, addresses: [address],
    currency: 'USD', rateCents: '16240', hideBalance: false, needsCustomization: demo,
    txs: demo ? [
      { id: randomId(), kind: 'in', amount: xmr(1, '25'), fee: '0', confirmations: 3, address: newTestAddress(), note: 'Demo incoming (pending)', createdAt: now - 360000 },
      { id: randomId(), kind: 'out', amount: xmr(0, '84'), fee: TEST_FEE.toString(), confirmations: 412, address: newTestAddress(), note: 'Demo payment to a friend', createdAt: now - 93600000 },
      { id: randomId(), kind: 'in', amount: xmr(12, '5'), fee: '0', confirmations: 2310, address: newTestAddress(), note: 'Demo starting funds', createdAt: now - 777600000 },
    ] : [],
  };
}
export type Ctx = {
  state: WalletState | null; wallets: WalletState[]; selectedId: string | null; nextWalletNumber: number;
  loading: boolean; error: string | null; reload: () => void;
  available: bigint; locked: bigint; total: bigint;
  selectWallet: (id: string, secret?: string, signal?: AbortSignal) => Promise<void>;
  sync: { remainingSeconds: number; progress: number; complete: boolean; height?: number; target?: number; etaLow?: number; etaHigh?: number; etaState?: 'measuring' | 'tracking' | 'stalled' | 'complete' };
  createWallet: (name?: string, iconId?: AvatarId) => Promise<string>;
  updateWalletProfile: (id: string, profile: { name?: string; iconId?: AvatarId }) => Promise<void>;
  deleteWallet: (id: string, secret: string, signal?: AbortSignal) => Promise<void>;
  send: (address: string, amount: bigint, note: string) => Promise<Tx>;
  addFunds: (amount: bigint, pending: boolean, note?: string) => Promise<void>;
  advanceBlocks: (n: number) => Promise<void>;
  updatePrefs: (p: Partial<Pick<WalletState, 'name' | 'currency' | 'rateCents' | 'hideBalance'>>) => Promise<void>;
  newReceiveAddress: () => Promise<void>; resetSandbox: () => Promise<void>;
};
const WalletContext = createContext<Ctx | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [store, setStore] = useState<WalletStore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<WalletStore | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const mounted = useRef(true);
  const { authorize, status } = useLock();
  const sessionStatus = useRef(status);
  sessionStatus.current = status;
  const load = useCallback(() => {
    setLoading(true); setError(null);
    const run = queue.current.then(async () => {
      try {
        const raw = await AsyncStorage.getItem(WALLET_STORAGE_KEY);
        let next: WalletStore;
        if (raw !== null) next = parseWalletStore(JSON.parse(raw));
        else {
          const first = newWallet('Wallet 1', 'monero', true);
          next = { v: 2, selectedId: first.id, nextWalletNumber: 2, wallets: [first] };
        }
        if (!mounted.current) return;
        await AsyncStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(next));
        ref.current = next;
        if (mounted.current) setStore(next);
      } catch (e) {
        if (mounted.current) setError(e instanceof Error ? e.message : 'Could not read local storage.');
      } finally { if (mounted.current) setLoading(false); }
    });
    queue.current = run.catch(() => undefined);
  }, []);
  useEffect(() => { mounted.current = true; load(); return () => { mounted.current = false; }; }, [load]);

  // Persist first, publish second; all changes, switches and deletions share one queue.
  const mutate = useCallback(<T,>(change: (current: WalletStore) => { next: WalletStore; result: T }): Promise<T> => {
    const run = queue.current.then(async () => {
      if (!mounted.current) throw new Error('Wallet was closed.');
      const current = ref.current;
      if (!current) throw new Error('Wallets not loaded.');
      const { next, result } = change(current);
      await AsyncStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(next));
      ref.current = next;
      if (mounted.current) setStore(next);
      return result;
    });
    queue.current = run.catch(() => undefined);
    return run;
  }, []);
  // Capture the target at invocation so a queued transfer never targets a later selection.
  const mutateSelected = useCallback(<T,>(change: (wallet: WalletState) => { next: WalletState; result: T }) => {
    const id = ref.current?.selectedId;
    return mutate(current => {
      if (!id) throw new Error('Choose an account first.');
      let result!: T;
      const next = updateWallet(current, id, wallet => {
        const changed = change(wallet); result = changed.result; return changed.next;
      });
      return { next, result };
    });
  }, [mutate]);
  const selectWallet = useCallback<Ctx['selectWallet']>(async (id, secret, signal) => {
    if (signal?.aborted) throw new Error('Switch cancelled.');
    if (!ref.current?.wallets.some(w => w.id === id)) throw new Error('Account not found.');
    requireUnlockedSession(sessionStatus.current);
    await mutate(s => {
      if (signal?.aborted) throw new Error('Switch cancelled.');
      requireUnlockedSession(sessionStatus.current);
      return { next: selectRecord(s, id), result: undefined };
    });
  }, [mutate]);
  const createWallet = useCallback((name?: string, iconId: AvatarId = 'monero') => mutate(s => {
    const label = validatedWalletName(name?.trim() || `Wallet ${s.nextWalletNumber}`);
    if (!isAvatarId(iconId)) throw new Error('Choose a valid name and icon.');
    const wallet = newWallet(label, iconId);
    return { next: appendWallet(s, wallet), result: wallet.id };
  }), [mutate]);
  const updateWalletProfile = useCallback<Ctx['updateWalletProfile']>((id, profile) => mutate(s => {
    const next = updateWallet(s, id, wallet => ({
      ...wallet, ...profile, name: profile.name === undefined ? wallet.name : profile.name.trim(), needsCustomization: false,
    }));
    return { next, result: undefined };
  }), [mutate]);
  const deleteWallet = useCallback(async (id: string, secret: string, signal?: AbortSignal) => {
    if (signal?.aborted) throw new Error('Deletion cancelled.');
    if (!ref.current?.wallets.some(w => w.id === id)) throw new Error('Account not found.');
    const auth = await authorize(secret);
    if (!auth.ok) throw new Error(auth.message ?? 'Incorrect PIN or password.');
    await mutate(s => {
      if (signal?.aborted) throw new Error('Deletion cancelled.');
      return { next: removeWallet(s, id), result: undefined };
    });
  }, [authorize, mutate]);

  const state = useMemo(() => selectedWallet(store), [store]);
  const { sync, isComplete } = usePreviewSync(state?.needsCustomization ? undefined : state?.id);
  const send = useCallback<Ctx['send']>((address, amount, note) => mutateSelected(s => {
    if (!isComplete()) throw new Error('Wallet must finish preview synchronization before sending.');
    const chk = checkTestAddress(address);
    if (!chk.ok) throw new Error(chk.reason);
    if (amount <= BigInt(0)) throw new Error('Amount must be greater than zero.');
    if (s.addresses.includes(address.trim())) throw new Error('That is this account’s own test address.');
    if (amount + TEST_FEE > balances(s.txs).available) throw new Error('Insufficient unlocked test balance.');
    const tx: Tx = { id: randomId(), kind: 'out', amount: amount.toString(), fee: TEST_FEE.toString(),
      confirmations: 0, address: address.trim(), note: note.trim().slice(0, 80), createdAt: Date.now() };
    return { next: { ...s, txs: [tx, ...s.txs] }, result: tx };
  }), [mutateSelected, isComplete]);
  const addFunds = useCallback<Ctx['addFunds']>((amount, pending, note) => mutateSelected(s => {
    if (amount <= BigInt(0)) throw new Error('Amount must be greater than zero.');
    const tx: Tx = { id: randomId(), kind: 'in', amount: amount.toString(), fee: '0',
      confirmations: pending ? 0 : REQUIRED_CONFIRMATIONS, address: newTestAddress(),
      note: note ?? (pending ? 'Simulated incoming transfer' : 'Test funds added'), createdAt: Date.now() };
    return { next: { ...s, txs: [tx, ...s.txs] }, result: undefined };
  }), [mutateSelected]);
  const advanceBlocks = useCallback<Ctx['advanceBlocks']>(n => mutateSelected(s => {
    if (!Number.isSafeInteger(n) || n < 1 || n > 1000000) throw new Error('Invalid block count.');
    return { next: { ...s, txs: s.txs.map(tx => tx.confirmations >= REQUIRED_CONFIRMATIONS ? tx : { ...tx, confirmations: Math.min(REQUIRED_CONFIRMATIONS, tx.confirmations + n) }) }, result: undefined };
  }), [mutateSelected]);
  const updatePrefs = useCallback<Ctx['updatePrefs']>(p => mutateSelected(s => ({ next: { ...s, ...p }, result: undefined })), [mutateSelected]);
  const newReceiveAddress = useCallback(() => mutateSelected(s => {
    const address = newTestAddress();
    return { next: { ...s, receiveAddress: address, addresses: [...s.addresses, address] }, result: undefined };
  }), [mutateSelected]);
  const resetSandbox = useCallback(() => mutateSelected(s => {
    const seeded = newWallet(s.name, s.iconId, true);
    return { next: { ...seeded, id: s.id, needsCustomization: false }, result: undefined };
  }), [mutateSelected]);
  const b = useMemo(() => balances(state?.txs ?? []), [state]);
  const value = useMemo<Ctx>(() => ({
    state, wallets: store?.wallets ?? [], selectedId: store?.selectedId ?? null, nextWalletNumber: store?.nextWalletNumber ?? 1,
    loading, error, reload: load, ...b, sync, selectWallet, createWallet, updateWalletProfile, deleteWallet,
    send, addFunds, advanceBlocks, updatePrefs, newReceiveAddress, resetSandbox,
  }), [state, store, loading, error, load, b, sync, selectWallet, createWallet, updateWalletProfile, deleteWallet, send, addFunds, advanceBlocks, updatePrefs, newReceiveAddress, resetSandbox]);
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}
export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used inside WalletProvider');
  return ctx;
}
