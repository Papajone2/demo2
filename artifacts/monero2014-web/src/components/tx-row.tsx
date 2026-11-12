import { useState } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { ArrowDownLeft, ArrowUpRight, Check, Copy } from 'lucide-react';
import type { Transaction } from '@/lib/wallet-types';
import { fmtXmr, HIDDEN, shortAddr, tsDate } from '@/lib/format';
import { cn } from '@/lib/utils';

export function TxRow({ tx, hide, expandable }: { tx: Transaction; hide: boolean; expandable?: boolean }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const d = tsDate(tx.timestamp);
  return (
    <div className="border-b border-border/60 last:border-0" data-testid={`row-tx-${tx.hash}`}>
      <button onClick={() => expandable && setOpen((o) => !o)} className={cn('flex w-full items-center gap-3.5 py-3.5 text-left', expandable && 'cursor-pointer')}>
        <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', tx.incoming ? 'bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success))]' : 'bg-primary/12 text-primary')}>
          {tx.incoming ? <ArrowDownLeft className="h-[18px] w-[18px]" /> : <ArrowUpRight className="h-[18px] w-[18px]" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{tx.incoming ? 'Received' : 'Sent'}</span>
          <span className="block text-[12.5px] text-muted-foreground">
            {!tx.confirmed ? 'Pending' : tx.confirmations < 10 ? `${tx.confirmations} confirmations` : d ? formatDistanceToNow(d, { addSuffix: true }) : 'Confirmed'}
          </span>
        </span>
        <span className={cn('num font-mono text-[14px]', tx.incoming && 'text-[hsl(var(--success))]')}>
          {hide ? HIDDEN : `${tx.incoming ? '+' : '−'}${fmtXmr(tx.amount)}`} <span className="text-muted-foreground">XMR</span>
        </span>
      </button>
      {open && (
        <div className="mb-3 space-y-1.5 rounded-xl bg-secondary/50 p-3.5 text-[12.5px]">
          <div className="flex justify-between gap-3"><span className="text-muted-foreground">Date</span><span>{d ? format(d, 'PPp') : 'Not yet in a block'}</span></div>
          {!tx.incoming && <div className="flex justify-between gap-3"><span className="text-muted-foreground">Network fee</span><span className="font-mono">{fmtXmr(tx.fee, 8)} XMR</span></div>}
          <div className="flex justify-between gap-3"><span className="text-muted-foreground">Confirmations</span><span className="font-mono">{tx.confirmations}</span></div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Transaction ID</span>
            <button className="flex items-center gap-1.5 font-mono hover:text-primary" onClick={() => { void navigator.clipboard?.writeText(tx.hash).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1400); }).catch(() => undefined); }} data-testid={`button-copy-tx-${tx.hash}`}>
              {shortAddr(tx.hash, 8)} {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
