import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { useWallet } from '@/hooks/use-wallet';
import { usePrefs } from '@/lib/prefs';
import { Card, PageHead } from '@/components/kit';
import { TxRow } from '@/components/tx-row';
import { cn } from '@/lib/utils';

const FILTERS = ['All', 'Received', 'Sent', 'Pending'] as const;

export default function Activity() {
  const snap = useWallet();
  const { hideBalance } = usePrefs();
  const [f, setF] = useState<(typeof FILTERS)[number]>('All');
  const list = useMemo(
    () =>
      snap.transactions.filter((t) => (f === 'All' ? true : f === 'Received' ? t.incoming : f === 'Sent' ? !t.incoming : !t.confirmed)),
    [snap.transactions, f],
  );
  return (
    <div>
      <PageHead title="Activity" sub="Only this wallet can see these. Tap one for details." />
      <div className="mb-4 flex gap-1.5">
        {FILTERS.map((x) => (
          <button key={x} onClick={() => setF(x)} data-testid={`button-filter-${x.toLowerCase()}`} className={cn('rounded-full px-3.5 py-1.5 text-[13px] transition-colors', f === x ? 'bg-primary/12 text-primary' : 'text-muted-foreground hover:text-foreground')}>
            {x}
          </button>
        ))}
      </div>
      <Card className="px-4">
        {snap.sync.state === 'syncing' && snap.transactions.length === 0 ? (
          <div className="space-y-3 py-4">
            {[0, 1, 2].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-secondary/60" />)}
          </div>
        ) : list.length === 0 ? (
          <div className="py-14 text-center">
            <p className="font-medium">Nothing here</p>
            <p className="mt-1 text-[13px] text-muted-foreground">{snap.transactions.length ? 'No transactions match this filter.' : 'Receive some stagenet XMR to get started.'}</p>
            {!snap.transactions.length && <Link href="/receive" className="mt-4 inline-block text-sm text-primary" data-testid="link-empty-receive">Show my address</Link>}
          </div>
        ) : (
          list.map((t) => <TxRow key={t.hash} tx={t} hide={hideBalance} expandable />)
        )}
      </Card>
    </div>
  );
}
