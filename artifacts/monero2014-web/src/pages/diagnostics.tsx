import { Link } from 'wouter';
import { ArrowLeft } from 'lucide-react';
import { useNode, usePrice, useWallet } from '@/hooks/use-wallet';
import { useStorageState } from '@/lib/prefs';
import { Card, PageHead, StagenetBadge } from '@/components/kit';
import { cn } from '@/lib/utils';

function Item({ k, v, ok }: { k: string; v: string; ok?: boolean | null }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3 text-sm" data-testid={`diag-${k.toLowerCase().replace(/\W+/g, '-')}`}>
      <span className="text-muted-foreground">{k}</span>
      <span className={cn('text-right font-mono text-[12.5px]', ok === true && 'text-[hsl(var(--success))]', ok === false && 'text-destructive')}>{v}</span>
    </div>
  );
}

export default function Diagnostics() {
  const snap = useWallet();
  const node = useNode();
  const price = usePrice();
  const storage = useStorageState();
  const sab = typeof SharedArrayBuffer !== 'undefined';
  return (
    <div className="mx-auto min-h-[100dvh] max-w-[640px] px-5 py-8">
      <Link href="/" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground" data-testid="link-back-home"><ArrowLeft className="h-4 w-4" /> Back</Link>
      <PageHead title="Diagnostics" sub="Live checks from this browser. Nothing here is simulated." right={<StagenetBadge />} />
      <div className="space-y-5">
        <Card className="divide-y divide-border/60">
          <Item k="Secure context" v={String(window.isSecureContext)} ok={window.isSecureContext} />
          <Item k="Web Crypto" v={String(!!window.crypto?.subtle)} ok={!!window.crypto?.subtle} />
          <Item k="Cross-origin isolated" v={String(window.crossOriginIsolated)} ok={window.crossOriginIsolated ? true : null} />
          <Item k="SharedArrayBuffer" v={String(sab)} ok={sab ? true : null} />
          <Item k="WebAssembly" v={String(typeof WebAssembly !== 'undefined')} ok={typeof WebAssembly !== 'undefined'} />
          <Item k="Local storage" v={storage.storageOk ? 'available' : storage.temporarySession ? 'temporary session' : 'blocked'} ok={storage.storageOk} />
        </Card>
        <Card className="divide-y divide-border/60">
          <Item k="Engine ready" v={String(snap.ready)} ok={snap.ready} />
          <Item k="Engine error" v={snap.error ?? 'none'} ok={snap.error ? false : null} />
          <Item k="Stored wallets" v={String(snap.wallets.length)} />
          <Item k="Locked" v={String(snap.locked)} />
          <Item k="Busy" v={String(snap.busy)} />
          <Item k="Sync state" v={snap.sync.state} ok={snap.sync.state === 'error' ? false : snap.sync.state === 'synced' ? true : null} />
          <Item k="Wallet height" v={`${snap.sync.height} / ${snap.sync.target}`} />
          {snap.sync.error && <Item k="Sync error" v={snap.sync.error} ok={false} />}
        </Card>
        <Card className="divide-y divide-border/60">
          <Item k="Node connected" v={node.isLoading ? 'checking' : node.isError ? 'request failed' : String(node.data?.connected)} ok={node.data ? node.data.connected : node.isError ? false : null} />
          <Item k="Node network" v={node.data?.network ?? '—'} />
          <Item k="Node height" v={node.data?.height != null ? String(node.data.height) : '—'} />
          <Item k="Node target" v={node.data?.targetHeight != null ? String(node.data.targetHeight) : '—'} />
          {node.data?.error && <Item k="Node error" v={node.data.error} ok={false} />}
          <Item k="Price" v={price.data ? `${price.data.price} ${price.data.currency.toUpperCase()}${price.data.stale ? ' (stale)' : ''}` : price.isError ? 'unavailable' : '—'} ok={price.data ? !price.data.stale : price.isError ? false : null} />
          <Item k="Price source" v={price.data?.source ?? '—'} />
        </Card>
      </div>
    </div>
  );
}
