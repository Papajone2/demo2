export type Network = 'stagenet';
export type WalletMeta = { id: string; name: string; createdAt: string };
export type Account = { index: number; label: string; address: string; balance: string; unlocked: string };
export type Address = { index: number; address: string; label: string };
export type Transaction = { hash: string; amount: string; fee: string; incoming: boolean; confirmed: boolean; confirmations: number; timestamp: number | null };
export type SyncStatus = { state: 'idle' | 'syncing' | 'synced' | 'error'; height: number; target: number; progress: number; etaSeconds: number | null; elapsedSeconds: number; error: string | null };
export type WalletSnapshot = { ready: boolean; locked: boolean; busy: boolean; error: string | null; wallets: WalletMeta[]; selectedId: string | null; accounts: Account[]; selectedAccount: number; addresses: Address[]; transactions: Transaction[]; balance: string; unlocked: string; sync: SyncStatus };
export type Preferences = { currency: 'usd' | 'eur' | 'gbp'; hideBalance: boolean; autoLockMinutes: number; autoSync: boolean };
export type Quote = { id: string; address: string; amount: string; fee: string; total: string };

// Implemented by the parent agent in ./wallet-engine.ts. All methods operate locally;
// only public blockchain protocol requests go to the backend.
export interface WalletEngine {
  getSnapshot(): WalletSnapshot;
  subscribe(listener: () => void): () => void;
  initialize(): Promise<void>;
  create(name: string, password: string, restore?: { seed: string; height: number }): Promise<{ seed: string; id: string }>;
  unlock(id: string, password: string): Promise<void>;
  lock(): Promise<void>;
  selectAccount(index: number): Promise<void>;
  addAccount(label: string): Promise<void>;
  addAddress(label: string): Promise<void>;
  renameWallet(id: string, name: string): Promise<void>;
  removeWallet(id: string, password: string): Promise<void>;
  backupSeed(password: string): Promise<string>;
  changePassword(oldPassword: string, newPassword: string): Promise<void>;
  sync(): Promise<void>;
  prepareSend(address: string, amount: string, priority: number): Promise<Quote>;
  confirmSend(id: string): Promise<string>;
  cancelSend(): Promise<void>;
  exportBackup(password: string): Promise<string>;
}
