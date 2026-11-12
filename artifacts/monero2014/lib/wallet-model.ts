/** Local simulated-wallet records. Never contains recovery phrases or private keys. */
export const WALLET_STORAGE_KEY = 'm2014.sandbox.v1';
export const REQUIRED_CONFIRMATIONS = 10;
export const MAX_WALLET_NAME_LENGTH = 16;
export const walletNameLength = (name: string) => Array.from(name).length;
export function validatedWalletName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed || walletNameLength(trimmed) > MAX_WALLET_NAME_LENGTH) {
    throw new Error('Use 1–16 characters for the account name.');
  }
  return trimmed;
}
export const AVATAR_IDS = [
  'monero', 'cash', 'thumb', 'ice', 'clown', 'up', 'down', 'money', 'smile', 'alien',
  'rocket', 'diamond', 'fire', 'moon', 'planet', 'bolt', 'crown', 'ghost', 'robot', 'star',
  'sunglasses', 'party', 'cowboy', 'thinking', 'wink', 'hearts', 'rich', 'exploding',
  'nerd', 'angel', 'devil', 'skull', 'poop', 'cat', 'dog', 'fox', 'panda', 'frog',
  'lion', 'unicorn', 'butterfly', 'octopus', 'turtle', 'shark', 'whale', 'penguin',
  'avocado', 'trophy', 'lock', 'eye', 'clover',
] as const;
export type AvatarId = typeof AVATAR_IDS[number];
export type TxKind = 'in' | 'out';
export type Tx = {
  id: string; kind: TxKind; amount: string; fee: string; confirmations: number;
  address: string; note: string; createdAt: number;
};
export type WalletState = {
  v: 1; id: string; name: string; iconId: AvatarId; receiveAddress: string;
  addresses: string[]; currency: 'USD' | 'EUR' | 'GBP' | 'CHF';
  rateCents: string | null; hideBalance: boolean; txs: Tx[];
  needsCustomization: boolean;
};
export type WalletStore = {
  v: 2; selectedId: string | null; nextWalletNumber: number; wallets: WalletState[];
};

/** Incoming transfers remain separate from spendable funds until unlocked. */
export function balances(txs: Tx[]) {
  let available = BigInt(0);
  let locked = BigInt(0);
  for (const tx of txs) {
    const amount = BigInt(tx.amount);
    if (tx.kind === 'in') {
      if (tx.confirmations >= REQUIRED_CONFIRMATIONS) available += amount;
      else locked += amount;
    } else available -= amount + BigInt(tx.fee);
  }
  return { available, locked, total: available + locked };
}

export function isAvatarId(value: unknown): value is AvatarId {
  return AVATAR_IDS.includes(value as AvatarId);
}
function isTx(value: unknown): value is Tx {
  const t = value as Tx;
  return !!t && typeof t.id === 'string' && (t.kind === 'in' || t.kind === 'out') &&
    typeof t.amount === 'string' && /^\d{1,32}$/.test(t.amount) &&
    typeof t.fee === 'string' && /^\d{1,32}$/.test(t.fee) &&
    Number.isSafeInteger(t.confirmations) && t.confirmations >= 0 &&
    typeof t.address === 'string' && typeof t.note === 'string' &&
    Number.isFinite(t.createdAt);
}
function isWallet(value: unknown): value is WalletState {
  const w = value as WalletState;
  return !!w && w.v === 1 && typeof w.id === 'string' && w.id.length > 0 &&
    typeof w.name === 'string' && w.name.trim().length > 0 && w.name.length <= 32 &&
    isAvatarId(w.iconId) && typeof w.receiveAddress === 'string' &&
    Array.isArray(w.addresses) && w.addresses.length > 0 &&
    w.addresses.every(a => typeof a === 'string') && w.addresses.includes(w.receiveAddress) &&
    ['USD', 'EUR', 'GBP', 'CHF'].includes(w.currency) &&
    (w.rateCents === null || (typeof w.rateCents === 'string' && /^\d{1,32}$/.test(w.rateCents))) &&
    typeof w.hideBalance === 'boolean' && typeof w.needsCustomization === 'boolean' &&
    Array.isArray(w.txs) && w.txs.every(isTx);
}

/** Upgrade old single-wallet storage without discarding its transactions or preferences. */
export function parseWalletStore(value: unknown): WalletStore {
  const s = value as WalletStore;
  if (s?.v === 2 && Array.isArray(s.wallets) && s.wallets.every(isWallet) &&
      Number.isSafeInteger(s.nextWalletNumber) && s.nextWalletNumber >= 1 &&
      new Set(s.wallets.map(w => w.id)).size === s.wallets.length &&
      (s.selectedId === null ? s.wallets.length === 0 : s.wallets.some(w => w.id === s.selectedId))) {
    return s.selectedId ? selectWallet(s, s.selectedId) : s;
  }
  const legacy = value as Partial<WalletState>;
  if (legacy?.v === 1 && typeof legacy.name === 'string') {
    const migrated = {
      ...legacy, id: 'legacy-wallet', iconId: 'monero',
      name: legacy.name === 'Test wallet' ? 'Wallet 1' : legacy.name,
      addresses: [legacy.receiveAddress], needsCustomization: false,
    };
    if (isWallet(migrated)) return { v: 2, selectedId: migrated.id, nextWalletNumber: 2, wallets: [migrated] };
  }
  throw new Error('Saved wallet data could not be read. Nothing has been deleted.');
}

export function selectedWallet(store: WalletStore | null): WalletState | null {
  return store?.wallets.find(w => w.id === store.selectedId) ?? null;
}
export function selectWallet(store: WalletStore, id: string): WalletStore {
  const wallet = store.wallets.find(w => w.id === id);
  if (!wallet) throw new Error('Account not found.');
  return { ...store, selectedId: id, wallets: [wallet, ...store.wallets.filter(w => w.id !== id)] };
}
export function appendWallet(store: WalletStore, wallet: WalletState): WalletStore {
  validatedWalletName(wallet.name);
  if (!isWallet(wallet) || store.wallets.some(w => w.id === wallet.id)) throw new Error('Invalid account.');
  return { ...store, wallets: [wallet, ...store.wallets], selectedId: wallet.id, nextWalletNumber: store.nextWalletNumber + 1 };
}
export function removeWallet(store: WalletStore, id: string): WalletStore {
  if (!store.wallets.some(w => w.id === id)) throw new Error('Account not found.');
  const wallets = store.wallets.filter(w => w.id !== id);
  return { ...store, wallets, selectedId: store.selectedId === id ? wallets[0]?.id ?? null : store.selectedId };
}
export function updateWallet(store: WalletStore, id: string, change: (wallet: WalletState) => WalletState): WalletStore {
  const current = store.wallets.find(w => w.id === id);
  if (!current) throw new Error('Account not found.');
  const next = change(current);
  // Keep previously saved longer names readable; enforce the new limit on edits.
  if (next.name !== current.name) validatedWalletName(next.name);
  if (!isWallet(next) || next.id !== id) throw new Error('Invalid account update.');
  return { ...store, wallets: store.wallets.map(w => w.id === id ? next : w) };
}
