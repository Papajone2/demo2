import { useState } from 'react';
import { Link } from 'wouter';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDownLeft, ArrowUpRight, Check, ChevronDown, Eye, EyeOff, Plus, RefreshCw } from 'lucide-react';
import { walletEngine } from '@/lib/wallet-engine';
import { useNode, usePrice, useWallet } from '@/hooks/use-wallet';
import { prefsStore, usePrefs } from '@/lib/prefs';
import { Btn, Card, ErrorLine, Field, Modal, TextInput } from '@/components/kit';
import { MoneroLogo } from '@/components/monero-logo';
import { TxRow } from '@/components/tx-row';
import { errMsg, fmtFiat, fmtXmr, HIDDEN, xmrNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

function SyncCard() {
  const snap = useWallet();
  const node = useNode();
  const s = snap.sync;
  const pct = Math.round(Math.min(1, Math.max(0, s.progress)) * 100);
  if (s.state === 'synced' && !s.error) {
    return (
      <div className="flex items-center justify-between rounded-2xl border border-border px-4 py-3 text-[13px]" data-testid="status-sync">
        <span className="flex items-center gap-2 text-muted-foreground"><Check className="h-4 w-4 text-[hsl(var(--success))]" /> Synced to block <span className="font-mono text-foreground">{s.height.toLocaleString()}</span></span>
        <button onClick={() => void walletEngine.sync().catch(() => undefined)} className="text-muted-foreground hover:text-foreground" aria-label="Sync now" data-testid="button-sync"><RefreshCw className="h-4 w-4" /></button>
      </div>
    );
  }
  return (
    <Card className="p-4" >
      <div className="flex items-center justify-between gap-3 text-[13.5px]" data-testid="status-sync">
        <span className="font-medium">
          {s.state === 'syncing' ? 'Syncing your wallet' : s.state === 'error' ? 'Sync stopped' : 'Not synced yet'}
        </span>
        {s.state === 'syncing' ? (
          <span className="font-mono text-muted-foreground">{pct}%</span>
        ) : (
          <Btn size="sm" variant="soft" onClick={() => void walletEngine.sync().catch(() => undefined)} disabled={snap.busy} data-testid="button-sync">{s.state === 'error' ? 'Retry' : 'Sync now'}</Btn>
        )}
      </div>
      {s.state === 'syncing' && (
        <>
          <div className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
            <motion.div className="h-full origin-left rounded-full bg-primary" animate={{ scaleX: pct / 100 }} transition={{ duration: 0.6 }} />
            <div className="sweep absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
          </div>
          <p className="mt-2 font-mono text-[12px] text-muted-foreground">
            {s.height.toLocaleString()} / {(s.target || node.data?.height || 0).toLocaleString()}
            {s.etaSeconds != null && ` · about ${s.etaSeconds < 90 ? `${Math.max(1, Math.round(s.etaSeconds))}s` : `${Math.round(s.etaSeconds / 60)} min`} left`}
          </p>
        </>
      )}
      {s.state !== 'syncing' && <p className="mt-1.5 text-[12.5px] text-muted-foreground">Balance appears once the scan finishes. Only the first sync is slow.</p>}
      {s.error && <div className="mt-3"><ErrorLine msg={s.error} /></div>}
    </Card>
  );
}

export default function Home() {
  const snap = useWallet();
  const prefs = usePrefs();
  const price = usePrice();
  const [acctOpen, setAcctOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const account = snap.accounts.find((a) => a.index === snap.selectedAccount);
  const bal = xmrNumber(snap.balance);
  const p = price.data && !price.isError ? price.data.price : null;
  const fiat = p != null ? bal * p : null;
  const hide = prefs.hideBalance;
  const change = price.data?.change24h ?? null;
  const pending = xmrNumber(snap.balance) - xmrNumber(snap.unlocked);

  const addAccount = async () => {
    setAdding(true);
    setErr(null);
    try {
      await walletEngine.addAccount(label.trim() || `Account ${snap.accounts.length + 1}`);
      setAddOpen(false);
      setLabel('');
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-7">
      {snap.error && <ErrorLine msg={snap.error} />}
      <section className="relative pt-2 text-center md:text-left">
        <div className="glow-orb pointer-events-none absolute -top-24 left-1/2 h-[300px] w-[420px] -translate-x-1/2 md:left-40" />
        <div className="relative flex items-center justify-center gap-2 md:justify-start">
          <div className="relative">
            <button onClick={() => setAcctOpen((o) => !o)} className="flex items-center gap-1.5 rounded-full bg-secondary/70 px-3.5 py-1.5 text-[13.5px] font-medium hover:bg-secondary" data-testid="button-account-switch">
              {account?.label || `Account ${snap.selectedAccount}`} <ChevronDown className={cn('h-4 w-4 transition-transform', acctOpen && 'rotate-180')} />
            </button>
            <AnimatePresence>
              {acctOpen && (
                <motion.div initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6 }} className="absolute left-1/2 top-11 z-20 w-64 -translate-x-1/2 rounded-2xl border border-popover-border bg-popover p-1.5 text-left md:left-0 md:translate-x-0">
                  {snap.accounts.map((a) => (
                    <button key={a.index} onClick={() => { setAcctOpen(false); void walletEngine.selectAccount(a.index).catch(() => undefined); }} className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 hover:bg-secondary" data-testid={`button-account-${a.index}`}>
                      <span className="truncate text-sm">{a.label || `Account ${a.index}`}</span>
                      <span className="font-mono text-[12px] text-muted-foreground">{hide ? HIDDEN : fmtXmr(a.balance, 4)}</span>
                    </button>
                  ))}
                  <button onClick={() => { setAcctOpen(false); setAddOpen(true); }} className="mt-1 flex w-full items-center gap-2 rounded-xl border-t border-border px-3 py-2.5 text-sm text-primary hover:bg-secondary" data-testid="button-add-account">
                    <Plus className="h-4 w-4" /> Add account
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button onClick={() => prefsStore.set({ hideBalance: !hide })} className="rounded-full p-2 text-muted-foreground hover:text-foreground" aria-label="Toggle balance visibility" data-testid="button-toggle-hide">
            {hide ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        <motion.div key={`${hide}-${snap.selectedAccount}`} initial={{ opacity: 0, filter: 'blur(8px)' }} animate={{ opacity: 1, filter: 'blur(0px)' }} transition={{ duration: 0.5 }} className="relative mt-5">
          <p className="num text-[52px] font-semibold leading-none md:text-[64px]" data-testid="text-balance-fiat">
            {hide ? HIDDEN : price.isLoading ? <span className="inline-block h-14 w-56 animate-pulse rounded-xl bg-secondary align-middle" /> : fmtFiat(fiat, prefs.currency)}
          </p>
          <p className="mt-3 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-[15px] text-muted-foreground md:justify-start">
            <span className="num font-mono text-foreground" data-testid="text-balance-xmr">{hide ? HIDDEN : fmtXmr(snap.balance)} XMR</span>
            <span className="rounded-md border border-border px-1.5 py-px text-[10.5px] uppercase tracking-[0.12em]" title="Stagenet coins have no market value. Fiat is shown for reference only.">Reference value</span>
          </p>
          {!hide && pending > 0 && <p className="mt-1.5 text-[12.5px] text-muted-foreground">{fmtXmr(snap.unlocked)} XMR spendable now, the rest unlocks after 10 confirmations.</p>}
        </motion.div>

        <div className="relative mx-auto mt-7 grid max-w-[420px] grid-cols-2 gap-3 md:mx-0">
          <Link href="/receive" className="flex h-[52px] items-center justify-center gap-2 rounded-full bg-secondary font-semibold transition-transform hover:bg-[hsl(24_6%_16%)] active:scale-[0.97]" data-testid="link-receive"><ArrowDownLeft className="h-[18px] w-[18px]" /> Receive</Link>
          <Link href="/send" className="flex h-[52px] items-center justify-center gap-2 rounded-full bg-primary font-semibold text-primary-foreground transition-transform hover:bg-[hsl(22_100%_57%)] active:scale-[0.97]" data-testid="link-send"><ArrowUpRight className="h-[18px] w-[18px]" /> Send</Link>
        </div>
      </section>

      <SyncCard />

      <section>
        <h2 className="mb-3 text-[13px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Assets</h2>
        <Card className="flex items-center gap-4 p-4" >
          <MoneroLogo size={44} />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Monero</p>
            <p className="text-[13px] text-muted-foreground" data-testid="text-market-price">
              {p != null ? fmtFiat(p, prefs.currency) : '—'}
              {change != null && <span className={cn('ml-2 font-mono', change >= 0 ? 'text-[hsl(var(--success))]' : 'text-destructive')}>{change >= 0 ? '+' : ''}{change.toFixed(2)}%</span>}
              {price.data?.stale && <span className="ml-2">· delayed</span>}
            </p>
          </div>
          <div className="text-right">
            <p className="num font-mono font-medium">{hide ? HIDDEN : fmtFiat(fiat, prefs.currency)}</p>
            <p className="num font-mono text-[13px] text-muted-foreground">{hide ? HIDDEN : `${fmtXmr(snap.balance, 4)} XMR`}</p>
          </div>
        </Card>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[13px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Recent activity</h2>
          {snap.transactions.length > 0 && <Link href="/activity" className="text-[13px] text-muted-foreground hover:text-primary" data-testid="link-all-activity">See all</Link>}
        </div>
        <Card className="px-4">
          {snap.transactions.length === 0 ? (
            <div className="py-10 text-center">
              <p className="font-medium">No transactions yet</p>
              <p className="mt-1 text-[13px] text-muted-foreground">{snap.sync.state === 'synced' ? 'Share your address to receive stagenet XMR.' : 'They will appear here after syncing.'}</p>
            </div>
          ) : (
            snap.transactions.slice(0, 5).map((t) => <TxRow key={t.hash} tx={t} hide={hide} />)
          )}
        </Card>
      </section>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add account">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void addAccount(); }}>
          <p className="text-[13.5px] text-muted-foreground">Accounts split one wallet into separate balances, each with its own addresses. Same recovery phrase.</p>
          <Field label="Name"><TextInput autoFocus value={label} onChange={(e) => setLabel(e.target.value)} placeholder={`Account ${snap.accounts.length + 1}`} maxLength={32} data-testid="input-account-label" /></Field>
          <ErrorLine msg={err} />
          <Btn type="submit" className="w-full" loading={adding} data-testid="button-confirm-add-account">Add account</Btn>
        </form>
      </Modal>
    </div>
  );
}
