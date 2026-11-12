import { useState } from 'react';
import { format } from 'date-fns';
import { Check, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { walletEngine } from '@/lib/wallet-engine';
import type { WalletMeta } from '@/lib/wallet-types';
import { useWallet } from '@/hooks/use-wallet';
import { flowStore } from '@/lib/flow';
import { Btn, Card, ErrorLine, Field, Modal, PageHead, PasswordInput, TextInput } from '@/components/kit';
import { MoneroLogo } from '@/components/monero-logo';
import { errMsg } from '@/lib/format';
import { cn } from '@/lib/utils';

type Dlg = { kind: 'switch' | 'rename' | 'delete'; w: WalletMeta } | null;

export default function Wallets() {
  const snap = useWallet();
  const [dlg, setDlg] = useState<Dlg>(null);
  const [pw, setPw] = useState('');
  const [name, setName] = useState('');
  const [ack, setAck] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const open = (kind: 'switch' | 'rename' | 'delete', w: WalletMeta) => {
    setDlg({ kind, w });
    setPw('');
    setName(w.name);
    setAck(false);
    setErr(null);
  };
  const close = () => { setDlg(null); setPw(''); };

  const run = async (fn: () => Promise<void>) => {
    setWorking(true);
    setErr(null);
    try {
      await fn();
      close();
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setWorking(false);
    }
  };

  return (
    <div>
      <PageHead title="Wallets" sub="Each wallet has its own phrase and password." />
      <div className="space-y-2.5">
        {snap.wallets.map((w) => {
          const active = w.id === snap.selectedId;
          return (
            <Card key={w.id} className={cn('flex items-center gap-4 p-4', active && 'border-primary/40')}>
              <MoneroLogo size={38} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold" data-testid={`text-wallet-name-${w.id}`}>{w.name}</p>
                <p className="text-[12.5px] text-muted-foreground">Created {format(new Date(w.createdAt), 'MMM d, yyyy')}</p>
              </div>
              {active ? (
                <span className="flex items-center gap-1 text-[12.5px] text-primary"><Check className="h-4 w-4" /> Open</span>
              ) : (
                <Btn size="sm" variant="soft" onClick={() => open('switch', w)} data-testid={`button-switch-${w.id}`}>Switch</Btn>
              )}
              <button onClick={() => open('rename', w)} className="rounded-full p-2 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Rename" data-testid={`button-rename-${w.id}`}><Pencil className="h-4 w-4" /></button>
              <button onClick={() => open('delete', w)} className="rounded-full p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label="Delete" data-testid={`button-delete-${w.id}`}><Trash2 className="h-4 w-4" /></button>
            </Card>
          );
        })}
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Btn size="lg" variant="soft" onClick={() => flowStore.set('create')} data-testid="button-add-wallet"><Plus className="h-4 w-4" /> Create wallet</Btn>
        <Btn size="lg" variant="soft" onClick={() => flowStore.set('restore')} data-testid="button-restore-another"><RotateCcw className="h-4 w-4" /> Restore wallet</Btn>
      </div>

      <Modal open={dlg?.kind === 'switch'} onClose={close} title={`Open ${dlg?.w.name ?? ''}`}>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (dlg) void run(() => walletEngine.unlock(dlg.w.id, pw)); }}>
          <Field label="Password for this wallet"><PasswordInput autoFocus value={pw} onChange={(e) => setPw(e.target.value)} data-testid="input-switch-password" /></Field>
          <ErrorLine msg={err} />
          <Btn type="submit" className="w-full" loading={working} disabled={!pw || snap.busy} data-testid="button-confirm-switch">Unlock and switch</Btn>
        </form>
      </Modal>

      <Modal open={dlg?.kind === 'rename'} onClose={close} title="Rename wallet">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (dlg && name.trim()) void run(() => walletEngine.renameWallet(dlg.w.id, name.trim())); }}>
          <Field label="Name"><TextInput autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={32} data-testid="input-rename" /></Field>
          <ErrorLine msg={err} />
          <Btn type="submit" className="w-full" loading={working} disabled={!name.trim()} data-testid="button-confirm-rename">Save</Btn>
        </form>
      </Modal>

      <Modal open={dlg?.kind === 'delete'} onClose={close} title="Remove wallet">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (dlg && ack) void run(() => walletEngine.removeWallet(dlg.w.id, pw)); }}>
          <p className="text-[13.5px] text-muted-foreground">This erases <span className="text-foreground">{dlg?.w.name}</span> from this browser. Without your recovery phrase or an encrypted backup, its funds cannot be recovered.</p>
          <button type="button" onClick={() => setAck((a) => !a)} className="flex items-start gap-3 text-left" data-testid="checkbox-delete-ack">
            <span className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border', ack ? 'border-destructive bg-destructive text-destructive-foreground' : 'border-input')}>{ack && <Check className="h-3.5 w-3.5" strokeWidth={3} />}</span>
            <span className="text-[13.5px]">I have my recovery phrase backed up.</span>
          </button>
          <Field label="Password"><PasswordInput value={pw} onChange={(e) => setPw(e.target.value)} data-testid="input-delete-password" /></Field>
          <ErrorLine msg={err} />
          <Btn type="submit" variant="danger" className="w-full" loading={working} disabled={!ack || !pw} data-testid="button-confirm-delete">Remove wallet</Btn>
        </form>
      </Modal>
    </div>
  );
}
