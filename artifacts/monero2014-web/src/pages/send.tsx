import { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Check, Copy } from 'lucide-react';
import { walletEngine } from '@/lib/wallet-engine';
import type { Quote } from '@/lib/wallet-types';
import { usePrice, useWallet } from '@/hooks/use-wallet';
import { usePrefs } from '@/lib/prefs';
import { Btn, Card, ErrorLine, Field, PageHead, TextInput } from '@/components/kit';
import { errMsg, fmtFiat, fmtXmr, shortAddr, xmrNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

const PRIORITIES = [
  { v: 1, label: 'Normal', d: 'Usually within ~2 min' },
  { v: 2, label: 'Faster', d: 'Higher fee' },
  { v: 3, label: 'Fastest', d: 'Highest fee' },
];

export default function Send() {
  const snap = useWallet();
  const prefs = usePrefs();
  const price = usePrice();
  const [step, setStep] = useState<'form' | 'review' | 'sent'>('form');
  const [address, setAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [priority, setPriority] = useState(1);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [hash, setHash] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [copied, setCopied] = useState(false);
  const quoteRef = useRef<Quote | null>(null);
  quoteRef.current = quote;

  useEffect(() => () => { if (quoteRef.current) void walletEngine.cancelSend().catch(() => undefined); }, []);

  const p = price.data?.price ?? null;
  const addrOk = /^[57][1-9A-HJ-NP-Za-km-z]{94}([1-9A-HJ-NP-Za-km-z]{11})?$/.test(address.trim());
  const amt = Number(amount);
  const amountOk = /^\d+(\.\d{1,12})?$/.test(amount) && amt > 0;
  const tooMuch = amountOk && amt > xmrNumber(snap.unlocked);
  const notSynced = snap.sync.state !== 'synced';

  const prepare = async () => {
    setErr(null);
    setWorking(true);
    try {
      const q = await walletEngine.prepareSend(address.trim(), amount, priority);
      setQuote(q);
      setStep('review');
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setWorking(false);
    }
  };

  const confirm = async () => {
    if (!quote) return;
    setErr(null);
    setWorking(true);
    try {
      const h = await walletEngine.confirmSend(quote.id);
      setHash(h);
      setQuote(null);
      setStep('sent');
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setWorking(false);
    }
  };

  const back = async () => {
    setQuote(null);
    setStep('form');
    setErr(null);
    await walletEngine.cancelSend().catch(() => undefined);
  };

  const reset = () => {
    setAddress('');
    setAmount('');
    setHash('');
    setStep('form');
  };

  return (
    <div className="mx-auto max-w-[520px]">
      <AnimatePresence mode="wait">
        {step === 'form' && (
          <motion.div key="form" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <PageHead title="Send" sub={`${fmtXmr(snap.unlocked)} XMR available`} />
            <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); if (addrOk && amountOk && !tooMuch) void prepare(); }}>
              <Field label="To" error={address && !addrOk ? 'That does not look like a stagenet Monero address.' : null}>
                <textarea value={address} onChange={(e) => setAddress(e.target.value.trim())} rows={3} spellCheck={false} placeholder="Stagenet address (starts with 5 or 7)" data-testid="input-send-address" className="w-full resize-none rounded-xl border border-input bg-[hsl(24_7%_7%)] p-4 font-mono text-[13px] leading-relaxed outline-none focus:border-primary/70" />
              </Field>
              <Field label="Amount" error={amount && !amountOk ? 'Enter a valid amount.' : tooMuch ? 'More than your spendable balance.' : null} hint={p != null && amountOk ? `≈ ${fmtFiat(amt * p, prefs.currency)} reference value` : undefined}>
                <div className="relative">
                  <TextInput inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(',', '.'))} placeholder="0.00" className="num pr-16 text-xl font-semibold" data-testid="input-send-amount" />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">XMR</span>
                </div>
              </Field>
              <div>
                <p className="mb-1.5 text-[12px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Speed</p>
                <div className="grid grid-cols-3 gap-2">
                  {PRIORITIES.map((x) => (
                    <button type="button" key={x.v} onClick={() => setPriority(x.v)} data-testid={`button-priority-${x.v}`} className={cn('rounded-xl border p-3 text-left transition-colors', priority === x.v ? 'border-primary/60 bg-primary/8' : 'border-border hover:border-input')}>
                      <p className="text-sm font-medium">{x.label}</p>
                      <p className="text-[11.5px] text-muted-foreground">{x.d}</p>
                    </button>
                  ))}
                </div>
              </div>
              {notSynced && <p className="text-[12.5px] text-muted-foreground">Finish syncing before sending so your balance is accurate.</p>}
              <ErrorLine msg={err} />
              <Btn type="submit" size="lg" className="w-full" loading={working} disabled={!addrOk || !amountOk || tooMuch || notSynced} data-testid="button-review">
                {working ? 'Calculating fee' : 'Review'}
              </Btn>
            </form>
          </motion.div>
        )}

        {step === 'review' && quote && (
          <motion.div key="review" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
            <button onClick={() => void back()} className="mb-5 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground" data-testid="button-back-edit"><ArrowLeft className="h-4 w-4" /> Edit</button>
            <p className="text-center text-sm text-muted-foreground">You are sending</p>
            <p className="num mt-2 text-center text-[44px] font-semibold" data-testid="text-quote-amount">{fmtXmr(quote.amount, 12)} <span className="text-[22px] text-muted-foreground">XMR</span></p>
            <Card className="mt-7 divide-y divide-border/70 px-5">
              <div className="flex justify-between gap-4 py-3.5 text-sm"><span className="text-muted-foreground">To</span><span className="font-mono">{shortAddr(quote.address, 8)}</span></div>
              <div className="flex justify-between gap-4 py-3.5 text-sm"><span className="text-muted-foreground">Network fee</span><span className="font-mono" data-testid="text-quote-fee">{fmtXmr(quote.fee, 12)} XMR</span></div>
              <div className="flex justify-between gap-4 py-3.5 text-sm font-semibold"><span>Total</span><span className="font-mono" data-testid="text-quote-total">{fmtXmr(quote.total, 12)} XMR</span></div>
            </Card>
            <p className="mt-4 text-center text-[12.5px] text-muted-foreground">Monero transactions cannot be reversed.</p>
            <ErrorLine msg={err} />
            <div className="mt-6 grid grid-cols-2 gap-3">
              <Btn size="lg" variant="soft" onClick={() => void back()} disabled={working} data-testid="button-cancel-send">Cancel</Btn>
              <Btn size="lg" onClick={() => void confirm()} loading={working} data-testid="button-confirm-send">{working ? 'Sending' : 'Send'}</Btn>
            </div>
          </motion.div>
        )}

        {step === 'sent' && (
          <motion.div key="sent" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="pt-10 text-center">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 15 }} className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Check className="h-9 w-9" strokeWidth={2.5} />
            </motion.div>
            <h1 className="mt-7 text-[26px] font-semibold tracking-tight">Sent</h1>
            <p className="mt-2 text-sm text-muted-foreground">It will show as pending until it is in a block.</p>
            <button onClick={() => { void navigator.clipboard?.writeText(hash).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1400); }).catch(() => undefined); }} className="mx-auto mt-5 flex items-center gap-2 rounded-full bg-secondary px-4 py-2 font-mono text-[12.5px]" data-testid="button-copy-hash">
              {shortAddr(hash, 10)} {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
            <div className="mt-9 grid grid-cols-2 gap-3">
              <Btn size="lg" variant="soft" onClick={reset} data-testid="button-send-another">Send another</Btn>
              <Link href="/activity" className="flex h-[52px] items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground" data-testid="link-view-activity">View activity</Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
