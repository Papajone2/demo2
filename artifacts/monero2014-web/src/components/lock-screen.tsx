import { useState } from 'react';
import { motion } from 'framer-motion';
import { walletEngine } from '@/lib/wallet-engine';
import { useWallet } from '@/hooks/use-wallet';
import { flowStore } from '@/lib/flow';
import { Btn, ErrorLine, PasswordInput, StagenetBadge } from '@/components/kit';
import { MoneroLogo } from '@/components/monero-logo';
import { errMsg } from '@/lib/format';
import { cn } from '@/lib/utils';

export function LockScreen() {
  const snap = useWallet();
  const [id, setId] = useState<string>(snap.selectedId ?? snap.wallets[0]?.id ?? '');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);

  const submit = async () => {
    if (!id || !pw) return;
    setBusy(true);
    setErr(null);
    try {
      await walletEngine.unlock(id, pw);
      setPw('');
    } catch (e) {
      setErr(errMsg(e));
      setShake((s) => s + 1);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-[400px] flex-col px-6 py-8">
      <div className="flex justify-end"><StagenetBadge /></div>
      <div className="relative flex flex-1 flex-col items-center justify-center">
        <div className="glow-orb pointer-events-none absolute left-1/2 top-[30%] h-[320px] w-[320px] -translate-x-1/2 -translate-y-1/2" />
        <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}><MoneroLogo size={72} /></motion.div>
        <h1 className="mt-7 text-[26px] font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Enter your password to unlock.</p>

        {snap.wallets.length > 1 && (
          <div className="mt-7 flex w-full flex-wrap justify-center gap-2">
            {snap.wallets.map((w) => (
              <button key={w.id} onClick={() => setId(w.id)} data-testid={`button-pick-wallet-${w.id}`} className={cn('rounded-full border px-3.5 py-1.5 text-[13px] transition-colors', id === w.id ? 'border-primary/60 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground')}>
                {w.name}
              </button>
            ))}
          </div>
        )}

        <motion.form key={shake} animate={shake ? { x: [0, -10, 9, -6, 4, 0] } : undefined} transition={{ duration: 0.4 }} className="mt-7 w-full space-y-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <PasswordInput autoFocus value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password" data-testid="input-unlock-password" />
          <ErrorLine msg={err} />
          <Btn type="submit" size="lg" className="w-full" loading={busy} disabled={!pw} data-testid="button-unlock">Unlock</Btn>
        </motion.form>
      </div>
      <div className="flex justify-center gap-6 text-sm">
        <button className="text-muted-foreground hover:text-foreground" onClick={() => flowStore.set('create')} data-testid="button-lock-create">Create wallet</button>
        <button className="text-muted-foreground hover:text-foreground" onClick={() => flowStore.set('restore')} data-testid="button-lock-restore">Restore wallet</button>
      </div>
    </div>
  );
}
