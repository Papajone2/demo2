import type { MoneroWalletFull, MoneroTxWallet } from 'monero-ts';
import type { WalletEngine, WalletSnapshot, WalletMeta, Quote, SyncStatus } from './wallet-types';
import { vaultStore, newEncryption, randomSecret, seal, unseal, b64, unb64, type WalletData, type Envelope } from './vault';

const INITIAL_SYNC: SyncStatus = { state: 'idle', height: 0, target: 0, progress: 0, etaSeconds: null, elapsedSeconds: 0, error: null };
const BASE = import.meta.env.BASE_URL.replace(/\/?$/, '/');
// All signing is performed in a local worker. This relay handles public daemon
// protocol requests only, and never monero-wallet-rpc or private keys.
const DAEMON = new URL('/api/monero/daemon/stagenet', window.location.origin).href;
const AU = 1000000000000n;
export function parseAmount(value: string): bigint {
  if (!/^\d{1,8}(\.\d{1,12})?$/.test(value.trim())) throw new Error('Enter a valid XMR amount with up to 12 decimal places.');
  const [whole, fraction = ''] = value.trim().split('.');
  const amount = BigInt(whole) * AU + BigInt(fraction.padEnd(12, '0'));
  if (amount <= 0n || amount > 18400000n * AU) throw new Error('Amount must be greater than zero and within the Monero supply.');
  return amount;
}
export function formatAmount(value: string | bigint, decimals = 12): string {
  const n = BigInt(value);
  const abs = n < 0n ? -n : n;
  const fraction = (abs % AU).toString().padStart(12, '0').slice(0, decimals).replace(/0+$/, '');
  return `${n < 0n ? '-' : ''}${abs / AU}${fraction ? `.${fraction}` : ''}`;
}
let library: Promise<typeof import('monero-ts')> | undefined;
async function lib() {
  if (!library) library = import('monero-ts').then(m => {
    m.LibraryUtils.setWorkerDistPath(`${BASE}wallet-worker.js`);
    m.MoneroUtils.setProxyToWorker(true);
    return m;
  }).catch(e => { library = undefined; throw e; });
  return library;
}
function bytes(value: DataView | Uint8Array | ArrayBuffer) {
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
}
function message(e: unknown) {
  // Engine errors can contain input data. Do not log them or include them in URLs.
  const msg = e instanceof Error ? e.message : 'Wallet operation failed.';
  return msg.length < 350 ? msg : 'The wallet engine could not complete this operation. Try syncing again.';
}
class BrowserWalletEngine implements WalletEngine {
  private snapshot: WalletSnapshot = { ready: false, locked: true, busy: false, error: null, wallets: [], selectedId: null, accounts: [], selectedAccount: 0, addresses: [], transactions: [], balance: '0', unlocked: '0', sync: { ...INITIAL_SYNC } };
  private listeners = new Set<() => void>();
  private wallet: MoneroWalletFull | null = null;
  private envelope: Envelope | null = null;
  private encryption: { key: CryptoKey; salt: string } | null = null;
  private enginePassword = '';
  private prepared: { quote: Quote; tx: MoneroTxWallet; account: number; at: number } | null = null;
  private running: Promise<unknown> | null = null;
  private initialization: Promise<void> | null = null;
  private generation = 0;
  private lockPromise: Promise<void> | null = null;
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private patch(data: Partial<WalletSnapshot>) {
    this.snapshot = { ...this.snapshot, ...data };
    this.listeners.forEach(listener => listener());
  }
  initialize = async () => {
    if (this.initialization) return this.initialization;
    this.initialization = (async () => {
      try {
        const entries = await vaultStore.list();
        this.patch({ ready: true, wallets: entries.map(({ id, name, createdAt }) => ({ id, name, createdAt })), error: null });
      } catch (e) { this.patch({ ready: true, error: message(e) }); this.initialization = null; }
    })();
    return this.initialization;
  };
  private async operation<T>(fn: () => Promise<T>): Promise<T> {
    if (this.running || this.lockPromise) throw new Error('Wait for the current wallet operation to finish.');
    this.patch({ busy: true, error: null });
    const job = fn();
    this.running = job;
    try { return await job; }
    catch (e) { this.patch({ error: message(e) }); throw new Error(message(e)); }
    finally { this.running = null; this.patch({ busy: false }); }
  }
  private requireWallet() {
    if (!this.wallet || this.snapshot.locked) throw new Error('Unlock your wallet first.');
    return this.wallet;
  }
  private async persist() {
    if (!this.wallet || !this.envelope || !this.encryption) throw new Error('Wallet is not open.');
    const data = await this.wallet.getData();
    const payload: WalletData = { enginePassword: this.enginePassword, keys: b64(bytes(data[0])), cache: b64(bytes(data[1])) };
    const next = await seal(this.envelope, payload, this.encryption);
    await vaultStore.write(next);
    this.envelope = next;
  }
  private async refresh() {
    if (!this.wallet) return;
    const accountIndex = this.snapshot.selectedAccount;
    const accounts = await this.wallet.getAccounts(true);
    const selected = accounts.find(account => account.getIndex() === accountIndex);
    this.patch({
      accounts: accounts.map(account => ({
        index: account.getIndex(), label: account.getLabel() || `Account ${account.getIndex() + 1}`,
        address: account.getPrimaryAddress(), balance: (account.getBalance() ?? 0n).toString(), unlocked: (account.getUnlockedBalance() ?? 0n).toString(),
      })),
      addresses: (selected?.getSubaddresses() ?? []).map(address => ({ index: address.getIndex(), address: address.getAddress(), label: address.getLabel() || `Address ${address.getIndex() + 1}` })),
      balance: (selected?.getBalance() ?? 0n).toString(), unlocked: (selected?.getUnlockedBalance() ?? 0n).toString(),
    });
    const txs = await this.wallet.getTxs({ transferQuery: { accountIndex } }).catch(e => {
      this.patch({ error: `Accounts loaded. Transaction history is unavailable: ${message(e)}` });
      return null;
    });
    if (!txs) return;
    this.patch({
      transactions: txs.map(tx => ({
        hash: tx.getHash(), amount: ((tx.getIsIncoming() ? tx.getIncomingAmount() : tx.getOutgoingAmount()) ?? 0n).toString(),
        fee: (tx.getFee() ?? 0n).toString(), incoming: !!tx.getIsIncoming(), confirmed: !!tx.getIsConfirmed(),
        confirmations: tx.getNumConfirmations() ?? 0, timestamp: tx.getBlock()?.getTimestamp() ?? null,
      })).reverse(),
    });
  }
  create = async (name: string, password: string, restore?: { seed: string; height: number }) => this.operation(async () => {
    if (!name.trim() || name.trim().length > 60) throw new Error('Give your wallet a name of 1–60 characters.');
    if (this.wallet) throw new Error('Lock the current wallet before creating another.');
    if (restore) {
      if (restore.seed.trim().split(/\s+/).length !== 25) throw new Error('This engine supports 25-word Monero seeds. 16-word Polyseed support is not available yet.');
      if (!Number.isSafeInteger(restore.height) || restore.height < 0) throw new Error('Enter a valid restore block height.');
    }
    const epoch = this.generation;
    const encryption = await newEncryption(password);
    const m = await lib();
    let height = restore?.height;
    if (height === undefined) {
      // A fresh wallet cannot have funds before its creation. Use the observed
      // height, not a fabricated progress value or a hardcoded chain height.
      const daemon = await m.connectToDaemonRpc(DAEMON);
      height = Math.max(0, (await daemon.getHeight()) - 10);
    }
    const enginePassword = randomSecret();
    const wallet = await m.createWalletFull({
      password: enginePassword, networkType: m.MoneroNetworkType.STAGENET,
      server: DAEMON, isTrustedDaemon: false, proxyToWorker: true,
      ...(restore ? { seed: restore.seed.trim().replace(/\s+/g, ' '), restoreHeight: height } : {}),
    });
    // wallet2 prohibits restoreHeight in random-wallet creation config. Set the
    // observed birthday only after creating a new wallet, before its first scan.
    if (!restore) await wallet.setRestoreHeight(height);
    const seed = await wallet.getSeed();
    const meta: WalletMeta = { id: crypto.randomUUID(), name: name.trim(), createdAt: new Date().toISOString() };
    this.wallet = wallet;
    this.enginePassword = enginePassword;
    this.encryption = encryption;
    this.envelope = { ...meta, version: 1, network: 'stagenet', salt: encryption.salt, iv: '', ciphertext: '' };
    try {
      await this.persist();
      if (epoch !== this.generation) throw new Error('Wallet saved, but the app was locked during setup. Unlock it to continue.');
      this.patch({ selectedId: meta.id, selectedAccount: 0, locked: false, wallets: [...this.snapshot.wallets, meta], sync: { ...INITIAL_SYNC } });
      try { await this.refresh(); }
      catch (e) { this.patch({ error: `Wallet saved. Network data is unavailable: ${message(e)}` }); }
      return { seed, id: meta.id };
    } catch (e) {
      await wallet.close(false).catch(() => {});
      this.wallet = null; this.encryption = null; this.enginePassword = ''; this.envelope = null;
      this.patch({ locked: true });
      await this.initializeList();
      throw e;
    }
  });
  private async initializeList() {
    const entries = await vaultStore.list();
    this.patch({ wallets: entries.map(({ id, name, createdAt }) => ({ id, name, createdAt })) });
  }
  unlock = async (id: string, password: string) => this.operation(async () => {
    if (this.wallet) throw new Error('Lock the current wallet before switching.');
    const epoch = this.generation;
    const entry = await vaultStore.read(id);
    if (!entry) throw new Error('Wallet not found on this device.');
    const { data, key } = await unseal(entry, password);
    const m = await lib();
    const wallet = await m.openWalletFull({
      password: data.enginePassword, networkType: m.MoneroNetworkType.STAGENET,
      keysData: unb64(data.keys), cacheData: unb64(data.cache),
      // Wallet bytes come from our encrypted vault, never a Node filesystem.
      // Explicit null avoids monero-ts looking up fs.promises in the browser.
      fs: null,
      server: DAEMON, isTrustedDaemon: false, proxyToWorker: true,
    });
    if (epoch !== this.generation) { await wallet.close(false); throw new Error('App locked while opening. Try unlocking again.'); }
    this.wallet = wallet; this.envelope = entry; this.encryption = { key, salt: entry.salt }; this.enginePassword = data.enginePassword;
    const selectedAccount = Number.isSafeInteger(entry.selectedAccount) && entry.selectedAccount! >= 0 ? entry.selectedAccount! : 0;
    this.patch({ locked: false, selectedId: id, selectedAccount, sync: { ...INITIAL_SYNC } });
    try { await this.refresh(); }
    catch (e) { this.patch({ error: `Wallet unlocked. Network data is unavailable: ${message(e)}` }); }
  });
  lock = async () => {
    if (this.lockPromise) return this.lockPromise;
    this.generation++;
    this.patch({ locked: true, accounts: [], addresses: [], transactions: [], balance: '0', unlocked: '0' });
    this.lockPromise = (async () => {
      try {
        await this.running?.catch(() => {});
        if (this.wallet) { await this.persist(); await this.wallet.close(false); }
      } catch (e) { this.patch({ error: `Wallet locked. ${message(e)}` }); }
      finally { this.wallet = null; this.encryption = null; this.envelope = null; this.enginePassword = ''; this.prepared = null; this.lockPromise = null; this.patch({ locked: true, busy: false, sync: { ...INITIAL_SYNC } }); }
    })();
    return this.lockPromise;
  };
  selectAccount = async (index: number) => this.operation(async () => {
    this.requireWallet();
    if (!this.snapshot.accounts.some(a => a.index === index)) throw new Error('Account not found.');
    this.envelope = { ...this.envelope!, selectedAccount: index };
    await this.persist();
    this.prepared = null; this.patch({ selectedAccount: index, transactions: [] }); await this.refresh();
  });
  addAccount = async (label: string) => this.operation(async () => {
    const wallet = this.requireWallet();
    if (!label.trim() || label.length > 60) throw new Error('Enter an account name of 1–60 characters.');
    const account = await wallet.createAccount(label.trim());
    this.envelope = { ...this.envelope!, selectedAccount: account.getIndex() };
    await this.persist(); this.prepared = null; this.patch({ selectedAccount: account.getIndex() }); await this.refresh();
  });
  addAddress = async (label: string) => this.operation(async () => {
    const wallet = this.requireWallet();
    if (label.length > 60) throw new Error('Use a shorter address label.');
    await wallet.createSubaddress(this.snapshot.selectedAccount, label.trim());
    await this.persist(); await this.refresh();
  });
  renameWallet = async (id: string, name: string) => this.operation(async () => {
    if (!name.trim() || name.trim().length > 60) throw new Error('Enter a wallet name of 1–60 characters.');
    const entry = await vaultStore.read(id); if (!entry) throw new Error('Wallet not found.');
    const next = { ...entry, name: name.trim() };
    await vaultStore.write(next);
    if (this.envelope?.id === id) this.envelope = next;
    await this.initializeList();
  });
  removeWallet = async (id: string, password: string) => {
    if (this.running || this.lockPromise) throw new Error('Wait for the current operation.');
    const entry = await vaultStore.read(id); if (!entry) throw new Error('Wallet not found.');
    await unseal(entry, password);
    if (this.snapshot.selectedId === id) await this.lock();
    await vaultStore.remove(id); await this.initializeList();
    if (this.snapshot.selectedId === id) this.patch({ selectedId: null });
  };
  backupSeed = async (password: string) => this.operation(async () => {
    const wallet = this.requireWallet();
    const entry = await vaultStore.read(this.snapshot.selectedId!); if (!entry) throw new Error('Wallet not found.');
    await unseal(entry, password); return wallet.getSeed();
  });
  changePassword = async (oldPassword: string, newPassword: string) => this.operation(async () => {
    this.requireWallet();
    const entry = await vaultStore.read(this.snapshot.selectedId!); if (!entry) throw new Error('Wallet not found.');
    await unseal(entry, oldPassword);
    const nextEncryption = await newEncryption(newPassword);
    const previous = this.encryption;
    this.encryption = nextEncryption;
    try { await this.persist(); } catch (e) { this.encryption = previous; throw e; }
  });
  exportBackup = async (password: string) => this.operation(async () => {
    this.requireWallet(); await this.persist();
    const entry = await vaultStore.read(this.snapshot.selectedId!); if (!entry) throw new Error('Wallet not found.');
    await unseal(entry, password);
    return JSON.stringify({ format: 'monero2014-encrypted-vault', wallet: entry });
  });
  sync = async () => this.operation(async () => {
    const wallet = this.requireWallet();
    if (this.prepared) throw new Error('Finish or cancel your transaction review before syncing.');
    const m = await lib();
    const started = performance.now();
    let firstHeight: number | null = null;
    this.patch({ sync: { ...INITIAL_SYNC, state: 'syncing' } });
    const clock = window.setInterval(() => {
      if (this.snapshot.sync.state === 'syncing') {
        this.patch({ sync: { ...this.snapshot.sync, elapsedSeconds: (performance.now() - started) / 1000 } });
      }
    }, 1000);
    const engine = this;
    try {
      await wallet.sync(new class extends m.MoneroWalletListener {
        async onSyncProgress(height: number, startHeight: number, endHeight: number, percentDone: number) {
          if (firstHeight === null) firstHeight = height;
          const elapsedSeconds = (performance.now() - started) / 1000;
          const scanned = height - firstHeight;
          const speed = elapsedSeconds >= 5 && scanned > 0 ? scanned / elapsedSeconds : 0;
          engine.patch({ sync: { state: 'syncing', height, target: endHeight, progress: Math.max(0, Math.min(1, percentDone)), elapsedSeconds, etaSeconds: speed > 0 ? Math.ceil((endHeight - height) / speed) : null, error: null } });
        }
      }());
      const height = await wallet.getHeight();
      await this.persist(); await this.refresh();
      this.patch({ sync: { state: 'synced', height, target: height, progress: 1, etaSeconds: 0, elapsedSeconds: (performance.now() - started) / 1000, error: null } });
    } catch (e) {
      this.patch({ sync: { ...this.snapshot.sync, state: 'error', etaSeconds: null, error: message(e) } });
      throw e;
    } finally {
      window.clearInterval(clock);
    }
  });
  prepareSend = async (address: string, amount: string, priority: number) => this.operation(async () => {
    const wallet = this.requireWallet();
    if (this.snapshot.sync.state !== 'synced') throw new Error('Sync your wallet before sending.');
    if (this.prepared) throw new Error('Finish or cancel the existing transaction review.');
    if (![1, 2, 3, 4].includes(priority)) throw new Error('Unsupported transaction priority.');
    const value = parseAmount(amount);
    if (value > BigInt(this.snapshot.unlocked)) throw new Error('Insufficient unlocked balance.');
    const m = await lib();
    await m.MoneroUtils.validateAddress(address.trim(), m.MoneroNetworkType.STAGENET);
    if (this.snapshot.addresses.some(a => a.address === address.trim())) throw new Error('Choose a recipient outside this account.');
    const tx = await wallet.createTx({ accountIndex: this.snapshot.selectedAccount, address: address.trim(), amount: value, priority, relay: false });
    const fee = tx.getFee();
    if (value + fee > BigInt(this.snapshot.unlocked)) throw new Error('Insufficient balance including the network fee.');
    const quote: Quote = { id: crypto.randomUUID(), address: address.trim(), amount: value.toString(), fee: fee.toString(), total: (value + fee).toString() };
    this.prepared = { quote, tx, account: this.snapshot.selectedAccount, at: Date.now() };
    return quote;
  });
  confirmSend = async (id: string) => this.operation(async () => {
    const wallet = this.requireWallet();
    const prepared = this.prepared;
    if (!prepared || prepared.quote.id !== id || prepared.account !== this.snapshot.selectedAccount) throw new Error('Transaction review expired. Start again.');
    if (Date.now() - prepared.at > 5 * 60000) { this.prepared = null; throw new Error('Quote expired. Review a new network fee.'); }
    // Consume the quote BEFORE relay, so double clicks and uncertain network responses
    // never cause a new automatic send. Users must sync/check history before retry.
    this.prepared = null;
    let hash: string;
    try { hash = await wallet.relayTx(prepared.tx); }
    catch { throw new Error('Broadcast could not be confirmed. Sync and check transaction history before trying again.'); }
    try { await this.persist(); await this.refresh(); }
    catch { throw new Error(`Transaction broadcast (${hash}), but local save needs attention. Do not send again; sync first.`); }
    return hash;
  });
  cancelSend = async () => { this.prepared = null; };
}
export const walletEngine: WalletEngine = new BrowserWalletEngine();
