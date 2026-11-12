import { useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Check, Copy, KeyRound, RefreshCw, ShieldCheck } from 'lucide-react';
import { walletEngine } from '@/lib/wallet-engine';
import { Btn, ErrorLine, Field, PasswordInput, StagenetBadge, TextInput } from '@/components/kit';
import { MoneroLogo } from '@/components/monero-logo';
import { errMsg } from '@/lib/format';
import { cn } from '@/lib/utils';

type Mode = 'create' | 'restore';
type Step = 'start' | 'explain' | 'seedin' | 'password' | 'working' | 'backup' | 'done';

const ease = [0.22, 1, 0.36, 1] as const;

function Stage({ k, children }: { k: string; children: ReactNode }) {
  return (
    <motion.div key={k} initial={{ opacity: 0, x: 28 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -28 }} transition={{ duration: 0.38, ease }} className="flex flex-1 flex-col">
      {children}
    </motion.div>
  );
}

export function Onboarding({ onCancel, initialMode, onDone }: { onCancel?: () => void; initialMode?: Mode; onDone?: () => void }) {
  const [mode, setMode] = useState<Mode>(initialMode ?? 'create');
  const [step, setStep] = useState<Step>(initialMode ? (initialMode === 'create' ? 'explain' : 'seedin') : 'start');
  const [name, setName] = useState('Main wallet');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [seedIn, setSeedIn] = useState('');
  const [height, setHeight] = useState('');
  const [seed, setSeed] = useState<string | null>(null);
  const [ack, setAck] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const words = seedIn.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const order: Step[] = mode === 'create' ? ['explain', 'password', 'backup', 'done'] : ['seedin', 'password', 'done'];
  const progress = Math.max(0, order.indexOf(step === 'working' ? 'password' : step));

  const pwErr = pw.length > 0 && pw.length < 10 ? 'Use at least 10 characters.' : pw2.length > 0 && pw !== pw2 ? 'Passwords do not match.' : null;
  const canSubmitPw = name.trim().length > 0 && pw.length >= 10 && pw === pw2;

  const back = () => {
    setError(null);
    if (step === 'explain' || step === 'seedin') return initialMode && onCancel ? onCancel() : setStep('start');
    if (step === 'password') return setStep(mode === 'create' ? 'explain' : 'seedin');
  };

  const submit = async () => {
    if (!canSubmitPw) return;
    setError(null);
    setStep('working');
    try {
      if (mode === 'create') {
        const res = await walletEngine.create(name.trim(), pw);
        setPw('');
        setPw2('');
        setSeed(res.seed);
        setStep('backup');
      } else {
        await walletEngine.create(name.trim(), pw, { seed: words.join(' '), height: Number(height) || 0 });
        setPw('');
        setPw2('');
        setSeedIn('');
        setStep('done');
      }
    } catch (e) {
      setError(errMsg(e));
      setStep('password');
    }
  };

  const finishBackup = () => {
    setSeed(null);
    setStep('done');
  };

  const copySeed = async () => {
    if (!seed) return;
    try {
      await navigator.clipboard.writeText(seed);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
      setTimeout(() => navigator.clipboard.writeText('').catch(() => undefined), 60000);
    } catch {
      setError('Clipboard is not available here. Write the words down instead.');
    }
  };

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-[420px] flex-col px-6 pb-8 pt-6">
      <div className="mb-6 flex h-9 items-center gap-4">
        {step !== 'start' && step !== 'working' && step !== 'backup' && step !== 'done' ? (
          <button onClick={back} className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" data-testid="button-back" aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </button>
        ) : (
          <span className="w-8" />
        )}
        {step !== 'start' && (
          <div className="flex flex-1 gap-1.5">
            {order.map((s, i) => (
              <div key={s} className="h-1 flex-1 overflow-hidden rounded-full bg-secondary">
                <motion.div className="h-full origin-left bg-primary" initial={false} animate={{ scaleX: i <= progress ? 1 : 0 }} transition={{ duration: 0.5, ease }} />
              </div>
            ))}
          </div>
        )}
        {step === 'start' && onCancel ? (
          <button onClick={onCancel} className="ml-auto text-sm text-muted-foreground hover:text-foreground" data-testid="button-cancel-onboarding">Cancel</button>
        ) : (
          <span className="w-8" />
        )}
      </div>

      <AnimatePresence mode="wait">
        {step === 'start' && (
          <Stage k="start">
            <div className="relative flex flex-1 flex-col items-center justify-center text-center">
              <div className="glow-orb pointer-events-none absolute left-1/2 top-[32%] h-[360px] w-[360px] -translate-x-1/2 -translate-y-1/2" />
              <motion.div initial={{ scale: 0.6, rotate: -40, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 160, damping: 16, delay: 0.1 }}>
                <MoneroLogo size={96} />
              </motion.div>
              <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.5, ease }} className="mt-9 text-[30px] font-semibold leading-tight tracking-tight">
                Welcome to monero<span className="text-primary">2014</span>
              </motion.h1>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }} className="mt-3 max-w-[300px] text-[15px] text-muted-foreground">
                A private Monero wallet. Your keys stay encrypted in this browser.
              </motion.p>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="mt-5">
                <StagenetBadge />
              </motion.div>
            </div>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55, duration: 0.5, ease }} className="space-y-2.5">
              <Btn size="lg" className="w-full" data-testid="button-create-wallet" onClick={() => { setMode('create'); setStep('explain'); }}>Create a new wallet</Btn>
              <Btn size="lg" variant="ghost" className="w-full" data-testid="button-restore-wallet" onClick={() => { setMode('restore'); setStep('seedin'); }}>Restore a wallet</Btn>
            </motion.div>
          </Stage>
        )}

        {step === 'explain' && (
          <Stage k="explain">
            <h1 className="text-[26px] font-semibold tracking-tight">Before you begin</h1>
            <p className="mt-2 text-[15px] text-muted-foreground">It takes about a minute.</p>
            <div className="mt-8 space-y-3">
              {[
                { icon: RefreshCw, t: 'It syncs once', d: 'Your browser scans the blockchain to find your coins. The first time takes a while. After that it only catches up.' },
                { icon: KeyRound, t: 'You get 25 words', d: 'They are the only way back into this wallet. Write them down on paper. Nobody can reset them for you.' },
                { icon: ShieldCheck, t: 'Locked with a password', d: 'Everything is encrypted on this device. Nothing secret leaves it.' },
              ].map((r, i) => (
                <motion.div key={r.t} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.08, ease }} className="flex gap-4 rounded-2xl bg-card p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground"><r.icon className="h-[18px] w-[18px]" /></div>
                  <div>
                    <p className="font-semibold">{r.t}</p>
                    <p className="mt-0.5 text-[13.5px] leading-relaxed text-muted-foreground">{r.d}</p>
                  </div>
                </motion.div>
              ))}
            </div>
            <div className="flex-1" />
            <Btn size="lg" className="mt-8 w-full" onClick={() => setStep('password')} data-testid="button-continue">Continue</Btn>
          </Stage>
        )}

        {step === 'seedin' && (
          <Stage k="seedin">
            <h1 className="text-[26px] font-semibold tracking-tight">Restore a wallet</h1>
            <p className="mt-2 text-[15px] text-muted-foreground">Enter your 25-word stagenet recovery phrase.</p>
            <div className="mt-6 space-y-4">
              <Field label="Recovery phrase" error={words.length > 25 ? 'That is more than 25 words.' : null} hint={<span className="font-mono">{words.length} / 25 words</span>}>
                <textarea
                  value={seedIn}
                  onChange={(e) => setSeedIn(e.target.value)}
                  rows={5}
                  spellCheck={false}
                  autoComplete="off"
                  autoCapitalize="off"
                  data-testid="input-seed"
                  className="w-full resize-none rounded-xl border border-input bg-[hsl(24_7%_7%)] p-4 font-mono text-[14px] leading-relaxed outline-none focus:border-primary/70"
                  placeholder="word1 word2 word3 …"
                />
              </Field>
              <Field label="Restore height (optional)" hint="Block height from around when the wallet was made. Speeds up the scan.">
                <TextInput inputMode="numeric" value={height} onChange={(e) => setHeight(e.target.value.replace(/\D/g, ''))} placeholder="0" data-testid="input-restore-height" />
              </Field>
              <p className="rounded-xl border border-border px-3.5 py-2.5 text-[12.5px] text-muted-foreground" data-testid="text-polyseed-note">
                16-word Polyseed phrases are not supported yet. Use a test wallet only, never a mainnet phrase.
              </p>
            </div>
            <div className="flex-1" />
            <Btn size="lg" className="mt-8 w-full" disabled={words.length !== 25} onClick={() => setStep('password')} data-testid="button-continue">Continue</Btn>
          </Stage>
        )}

        {(step === 'password' || step === 'working') && (
          <Stage k="password">
            <h1 className="text-[26px] font-semibold tracking-tight">Set a password</h1>
            <p className="mt-2 text-[15px] text-muted-foreground">Unlocks this wallet on this device.</p>
            <form className="mt-6 space-y-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
              <Field label="Wallet name">
                <TextInput value={name} onChange={(e) => setName(e.target.value)} maxLength={32} data-testid="input-wallet-name" />
              </Field>
              <Field label="Password" hint="At least 10 characters.">
                <PasswordInput value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" data-testid="input-password" />
              </Field>
              <Field label="Confirm password" error={pwErr}>
                <PasswordInput value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" data-testid="input-password-confirm" />
              </Field>
              <ErrorLine msg={error} />
              <button type="submit" hidden />
            </form>
            <div className="flex-1" />
            <Btn size="lg" className="mt-8 w-full" disabled={!canSubmitPw} loading={step === 'working'} onClick={() => void submit()} data-testid="button-submit-password">
              {step === 'working' ? (mode === 'create' ? 'Generating keys' : 'Restoring') : mode === 'create' ? 'Create wallet' : 'Restore wallet'}
            </Btn>
          </Stage>
        )}

        {step === 'backup' && seed && (
          <Stage k="backup">
            <h1 className="text-[26px] font-semibold tracking-tight">Your recovery phrase</h1>
            <p className="mt-2 text-[15px] text-muted-foreground">Write these 25 words down, in order. This is the only time they are shown without your password.</p>
            <div className="mt-6 grid grid-cols-3 gap-1.5" data-testid="grid-seed">
              {seed.split(/\s+/).map((w, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.02 * i }} className="flex items-baseline gap-1.5 rounded-lg bg-card px-2.5 py-2">
                  <span className="w-4 text-right font-mono text-[10.5px] text-muted-foreground">{i + 1}</span>
                  <span className="font-mono text-[13px]">{w}</span>
                </motion.div>
              ))}
            </div>
            <button onClick={copySeed} className="mx-auto mt-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground" data-testid="button-copy-seed">
              {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />} {copied ? 'Copied' : 'Copy to clipboard'}
            </button>
            <ErrorLine msg={error} />
            <div className="flex-1" />
            <button onClick={() => setAck((a) => !a)} className="mt-6 flex items-start gap-3 text-left" data-testid="checkbox-backup-ack">
              <span className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors', ack ? 'border-primary bg-primary text-primary-foreground' : 'border-input')}>
                {ack && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
              </span>
              <span className="text-[14px] text-muted-foreground">I wrote down my recovery phrase and stored it somewhere safe.</span>
            </button>
            <Btn size="lg" className="mt-4 w-full" disabled={!ack} onClick={finishBackup} data-testid="button-finish-backup">I saved it</Btn>
          </Stage>
        )}

        {step === 'done' && (
          <Stage k="done">
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 14 }} className="relative">
                {[0, 1, 2].map((i) => (
                  <motion.span key={i} className="absolute inset-0 rounded-full border border-primary" initial={{ scale: 1, opacity: 0.6 }} animate={{ scale: 2.4, opacity: 0 }} transition={{ duration: 1.8, delay: i * 0.35, repeat: Infinity, ease: 'easeOut' }} />
                ))}
                <MoneroLogo size={84} />
              </motion.div>
              <h1 className="mt-10 text-[28px] font-semibold tracking-tight">You're all set</h1>
              <p className="mt-2 max-w-[290px] text-[15px] text-muted-foreground">Your wallet will start its first sync. You can use the app while it runs.</p>
            </div>
            <Btn size="lg" className="w-full" onClick={() => onDone?.()} data-testid="button-get-started">Open wallet</Btn>
          </Stage>
        )}
      </AnimatePresence>
    </div>
  );
}
