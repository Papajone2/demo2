import { useState, type ReactNode } from 'react';
import { Link } from 'wouter';
import { ChevronRight, ExternalLink } from 'lucide-react';
import { walletEngine } from '@/lib/wallet-engine';
import { useNode, useWallet } from '@/hooks/use-wallet';
import { prefsStore, usePrefs, useStorageState } from '@/lib/prefs';
import { Btn, Card, ErrorLine, Field, Modal, PageHead, PasswordInput, Toggle } from '@/components/kit';
import { downloadText, errMsg } from '@/lib/format';
import { cn } from '@/lib/utils';

function Row({ title, sub, children, onClick, testId }: { title: string; sub?: ReactNode; children?: ReactNode; onClick?: () => void; testId?: string }) {
  const inner = (
    <>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        {sub && <p className="mt-0.5 text-[12.5px] text-muted-foreground">{sub}</p>}
      </div>
      {children ?? (onClick && <ChevronRight className="h-4 w-4 text-muted-foreground" />)}
    </>
  );
  return onClick ? (
    <button onClick={onClick} data-testid={testId} className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-secondary/40">{inner}</button>
  ) : (
    <div className="flex items-center gap-4 px-5 py-4">{inner}</div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-[12px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{title}</h2>
      <Card className="divide-y divide-border/60 overflow-hidden">{children}</Card>
    </section>
  );
}

function Segmented<T extends string | number>({ value, options, onChange, testId }: { value: T; options: { v: T; l: string }[]; onChange: (v: T) => void; testId: string }) {
  return (
    <div className="flex rounded-full bg-secondary p-0.5">
      {options.map((o) => (
        <button key={String(o.v)} onClick={() => onChange(o.v)} data-testid={`${testId}-${o.v}`} className={cn('rounded-full px-2.5 py-1 text-[12.5px] transition-colors', value === o.v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
          {o.l}
        </button>
      ))}
    </div>
  );
}

type Dlg = null | 'password' | 'export' | 'seed';

export default function SettingsPage() {
  const prefs = usePrefs();
  const storage = useStorageState();
  const snap = useWallet();
  const node = useNode();
  const wallet = snap.wallets.find((w) => w.id === snap.selectedId);
  const [dlg, setDlg] = useState<Dlg>(null);
  const [cur, setCur] = useState('');
  const [nw, setNw] = useState('');
  const [nw2, setNw2] = useState('');
  const [seed, setSeed] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const close = () => {
    setDlg(null);
    setCur('');
    setNw('');
    setNw2('');
    setSeed(null);
    setErr(null);
    setOk(null);
  };

  const run = async (fn: () => Promise<void>) => {
    setWorking(true);
    setErr(null);
    try {
      await fn();
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="space-y-7">
      <PageHead title="Settings" />

      <Section title="Preferences">
        <Row title="Currency" sub="For the reference value.">
          <Segmented value={prefs.currency} testId="button-currency" options={[{ v: 'usd', l: 'USD' }, { v: 'eur', l: 'EUR' }, { v: 'gbp', l: 'GBP' }]} onChange={(v) => prefsStore.set({ currency: v })} />
        </Row>
        <Row title="Hide balances" sub="Mask amounts on screen."><Toggle checked={prefs.hideBalance} onChange={(v) => prefsStore.set({ hideBalance: v })} testId="toggle-hide-balance" /></Row>
        <Row title="Auto-sync" sub="Catch up with the network while unlocked."><Toggle checked={prefs.autoSync} onChange={(v) => prefsStore.set({ autoSync: v })} testId="toggle-auto-sync" /></Row>
        {!storage.storageOk && <Row title="Preferences are temporary" sub="This browser blocked storage. Settings reset when the tab closes." />}
      </Section>

      <Section title="Security">
        <Row title="Auto-lock" sub="After inactivity, or 30s after leaving the tab.">
          <Segmented value={prefs.autoLockMinutes} testId="button-autolock" options={[{ v: 1, l: '1m' }, { v: 5, l: '5m' }, { v: 15, l: '15m' }, { v: 0, l: 'Off' }]} onChange={(v) => prefsStore.set({ autoLockMinutes: v })} />
        </Row>
        <Row title="Change password" onClick={() => setDlg('password')} testId="button-change-password" />
        <Row title="Show recovery phrase" sub="Requires your password." onClick={() => setDlg('seed')} testId="button-reveal-seed" />
        <Row title="Export encrypted backup" sub="Downloads an encrypted file. Needs your password to restore." onClick={() => setDlg('export')} testId="button-export-backup" />
        <Row title="Lock now" onClick={() => void walletEngine.lock()} testId="button-lock-now" />
      </Section>

      <Section title="Wallet">
        <Row title={wallet?.name ?? 'Wallet'} sub={`${snap.accounts.length} account${snap.accounts.length === 1 ? '' : 's'}`} />
        <Link href="/wallets" className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-secondary/40" data-testid="link-manage-wallets">
          <span className="flex-1 font-medium">Manage wallets</span><ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      </Section>

      <Section title="Network">
        <Row title="Stagenet node" sub={node.data ? (node.data.connected ? `Height ${node.data.height?.toLocaleString() ?? '—'}` : node.data.error ?? 'Unreachable') : node.isError ? 'Status unavailable' : 'Checking'}>
          <span className={cn('h-2.5 w-2.5 rounded-full', node.data?.connected ? 'bg-[hsl(var(--success))]' : 'bg-destructive')} />
        </Row>
        <Row title="Wallet sync" sub={snap.sync.error ?? `${snap.sync.state} · block ${snap.sync.height.toLocaleString()}`}>
          <Btn size="sm" variant="soft" disabled={snap.sync.state === 'syncing' || snap.busy} onClick={() => void walletEngine.sync().catch(() => undefined)} data-testid="button-settings-sync">Sync</Btn>
        </Row>
        <Link href="/test" className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-secondary/40" data-testid="link-diagnostics">
          <span className="flex-1 font-medium">Diagnostics</span><ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      </Section>

      <Section title="Privacy & about">
        <div className="space-y-2 px-5 py-4 text-[13.5px] leading-relaxed text-muted-foreground">
          <p>Your keys are created and encrypted in this browser. The server only relays public blockchain data and prices; it never sees your keys, phrase or password.</p>
          <p>This is a stagenet test build. Use test coins only.</p>
          <a href="https://monero2014.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-primary" data-testid="link-website">monero2014.com <ExternalLink className="h-3.5 w-3.5" /></a>
        </div>
      </Section>

      <Modal open={dlg === 'password'} onClose={close} title="Change password">
        {ok ? (
          <div className="space-y-4"><p className="text-sm">{ok}</p><Btn className="w-full" onClick={close}>Done</Btn></div>
        ) : (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (nw.length >= 10 && nw === nw2) void run(async () => { await walletEngine.changePassword(cur, nw); setCur(''); setNw(''); setNw2(''); setOk('Password updated.'); }); }}>
            <Field label="Current password"><PasswordInput value={cur} onChange={(e) => setCur(e.target.value)} data-testid="input-current-password" /></Field>
            <Field label="New password" hint="At least 10 characters." error={nw && nw.length < 10 ? 'Use at least 10 characters.' : null}><PasswordInput value={nw} onChange={(e) => setNw(e.target.value)} autoComplete="new-password" data-testid="input-new-password" /></Field>
            <Field label="Confirm new password" error={nw2 && nw !== nw2 ? 'Passwords do not match.' : null}><PasswordInput value={nw2} onChange={(e) => setNw2(e.target.value)} autoComplete="new-password" data-testid="input-new-password-confirm" /></Field>
            <ErrorLine msg={err} />
            <Btn type="submit" className="w-full" loading={working} disabled={!cur || nw.length < 10 || nw !== nw2} data-testid="button-confirm-change-password">Update password</Btn>
          </form>
        )}
      </Modal>

      <Modal open={dlg === 'export'} onClose={close} title="Export encrypted backup">
        {ok ? (
          <div className="space-y-4"><p className="text-sm">{ok}</p><Btn className="w-full" onClick={close}>Done</Btn></div>
        ) : (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void run(async () => { const data = await walletEngine.exportBackup(cur); setCur(''); downloadText(`${(wallet?.name ?? 'wallet').replace(/[^\w-]+/g, '_')}-stagenet.m2014backup`, data); setOk('Backup downloaded. It is encrypted with your password.'); }); }}>
            <Field label="Password"><PasswordInput autoFocus value={cur} onChange={(e) => setCur(e.target.value)} data-testid="input-export-password" /></Field>
            <ErrorLine msg={err} />
            <Btn type="submit" className="w-full" loading={working} disabled={!cur} data-testid="button-confirm-export">Download backup</Btn>
          </form>
        )}
      </Modal>

      <Modal open={dlg === 'seed'} onClose={close} title="Recovery phrase">
        {seed ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-1.5" data-testid="grid-reveal-seed">
              {seed.split(/\s+/).map((w, i) => (
                <div key={i} className="flex items-baseline gap-1.5 rounded-lg bg-card px-2.5 py-2"><span className="w-4 text-right font-mono text-[10.5px] text-muted-foreground">{i + 1}</span><span className="font-mono text-[13px]">{w}</span></div>
              ))}
            </div>
            <p className="text-[12.5px] text-muted-foreground">Anyone with these words controls this wallet. Closing this hides them.</p>
            <Btn className="w-full" onClick={close} data-testid="button-hide-seed">Hide</Btn>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void run(async () => { const s = await walletEngine.backupSeed(cur); setCur(''); setSeed(s); }); }}>
            <Field label="Password"><PasswordInput autoFocus value={cur} onChange={(e) => setCur(e.target.value)} data-testid="input-seed-password" /></Field>
            <ErrorLine msg={err} />
            <Btn type="submit" className="w-full" loading={working} disabled={!cur} data-testid="button-confirm-reveal">Show phrase</Btn>
          </form>
        )}
      </Modal>
    </div>
  );
}
