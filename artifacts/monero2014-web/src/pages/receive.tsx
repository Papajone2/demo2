import { useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { motion } from 'framer-motion';
import { Check, Copy, Plus } from 'lucide-react';
import { walletEngine } from '@/lib/wallet-engine';
import { useWallet } from '@/hooks/use-wallet';
import { Btn, Card, ErrorLine, Field, Modal, PageHead, TextInput } from '@/components/kit';
import { errMsg, shortAddr } from '@/lib/format';
import { cn } from '@/lib/utils';

export default function Receive() {
  const snap = useWallet();
  const account = snap.accounts.find((a) => a.index === snap.selectedAccount);
  const all = useMemo(() => {
    const list = snap.addresses.length ? snap.addresses : account ? [{ index: 0, address: account.address, label: 'Primary' }] : [];
    return list;
  }, [snap.addresses, account]);
  const [sel, setSel] = useState(0);
  const addr = all.find((a) => a.index === sel) ?? all[0];
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const amountOk = amount === '' || /^\d+(\.\d{1,12})?$/.test(amount);
  const uri = useMemo(() => {
    if (!addr) return '';
    const q = new URLSearchParams();
    if (amount && amountOk && Number(amount) > 0) q.set('tx_amount', amount);
    if (note.trim()) q.set('tx_description', note.trim());
    const s = q.toString();
    return `monero:${addr.address}${s ? `?${s}` : ''}`;
  }, [addr, amount, note, amountOk]);

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setErr('Clipboard is not available. Select and copy the address manually.');
    }
  };

  const add = async () => {
    setAdding(true);
    setErr(null);
    try {
      await walletEngine.addAddress(label.trim() || `Address ${all.length}`);
      setNewOpen(false);
      setLabel('');
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setAdding(false);
    }
  };

  if (!addr) {
    return (
      <div>
        <PageHead title="Receive" />
        <Card className="p-6"><div className="mx-auto h-56 w-56 animate-pulse rounded-2xl bg-secondary" /><p className="mt-4 text-center text-sm text-muted-foreground">Loading address</p></Card>
      </div>
    );
  }

  return (
    <div>
      <PageHead title="Receive" sub={`Stagenet XMR into ${account?.label || `Account ${snap.selectedAccount}`}`} />
      <div className="grid gap-5 md:grid-cols-[1fr_1fr]">
        <Card className="flex flex-col items-center p-6">
          <motion.div key={uri} initial={{ opacity: 0.4, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }} className="rounded-[20px] bg-[hsl(30_20%_96%)] p-4" data-testid="img-qr">
            <QRCodeSVG value={uri} size={208} level="M" bgColor="transparent" fgColor="#16110d" />
          </motion.div>
          <p className="mt-5 text-[12px] uppercase tracking-[0.14em] text-muted-foreground">{addr.label || (addr.index === 0 ? 'Primary address' : `Address ${addr.index}`)}</p>
          <p className="mt-2 break-all text-center font-mono text-[12.5px] leading-relaxed" data-testid="text-address">{addr.address}</p>
          <div className="mt-5 flex w-full gap-2">
            <Btn className="flex-1" onClick={() => void copy(addr.address, 'addr')} data-testid="button-copy-address">
              {copied === 'addr' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied === 'addr' ? 'Copied' : 'Copy address'}
            </Btn>
            {uri !== `monero:${addr.address}` && (
              <Btn variant="soft" onClick={() => void copy(uri, 'uri')} data-testid="button-copy-uri">{copied === 'uri' ? 'Copied' : 'Copy link'}</Btn>
            )}
          </div>
        </Card>

        <div className="space-y-5">
          <Card className="space-y-4 p-5">
            <h2 className="font-semibold">Request an amount</h2>
            <Field label="Amount (XMR)" error={amountOk ? null : 'Use a number like 0.25'}>
              <TextInput inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(',', '.'))} placeholder="Optional" data-testid="input-request-amount" />
            </Field>
            <Field label="Note"><TextInput value={note} onChange={(e) => setNote(e.target.value)} maxLength={60} placeholder="Optional" data-testid="input-request-note" /></Field>
          </Card>

          <Card className="p-2">
            <div className="flex items-center justify-between px-3 pb-1 pt-2">
              <h2 className="font-semibold">Addresses</h2>
              <button onClick={() => setNewOpen(true)} className="flex items-center gap-1 text-[13px] text-primary" data-testid="button-new-address"><Plus className="h-4 w-4" /> New</button>
            </div>
            <p className="px-3 pb-2 text-[12.5px] text-muted-foreground">Use a fresh address per sender to keep payments unlinkable.</p>
            <div className="max-h-64 overflow-y-auto">
              {all.map((a) => (
                <button key={a.index} onClick={() => setSel(a.index)} className={cn('flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition-colors', a.index === addr.index ? 'bg-accent' : 'hover:bg-secondary/60')} data-testid={`button-address-${a.index}`}>
                  <span className="text-sm">{a.label || (a.index === 0 ? 'Primary' : `Address ${a.index}`)}</span>
                  <span className="font-mono text-[12px] text-muted-foreground">{shortAddr(a.address)}</span>
                </button>
              ))}
            </div>
          </Card>
          <ErrorLine msg={err} />
        </div>
      </div>

      <Modal open={newOpen} onClose={() => setNewOpen(false)} title="New address">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void add(); }}>
          <Field label="Label"><TextInput autoFocus value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. From Sam" maxLength={32} data-testid="input-address-label" /></Field>
          <Btn type="submit" className="w-full" loading={adding} data-testid="button-confirm-new-address">Generate address</Btn>
        </form>
      </Modal>
    </div>
  );
}
