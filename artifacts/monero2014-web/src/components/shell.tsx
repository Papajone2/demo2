import { useEffect, useRef, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { ArrowDownLeft, ArrowUpRight, History, Lock, Settings, Wallet } from 'lucide-react';
import { walletEngine } from '@/lib/wallet-engine';
import { useNode, useWallet } from '@/hooks/use-wallet';
import { usePrefs } from '@/lib/prefs';
import { Wordmark } from '@/components/monero-logo';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/', label: 'Wallet', icon: Wallet },
  { href: '/send', label: 'Send', icon: ArrowUpRight },
  { href: '/receive', label: 'Receive', icon: ArrowDownLeft },
  { href: '/activity', label: 'Activity', icon: History },
  { href: '/settings', label: 'Settings', icon: Settings },
];

function useAutoLockAndSync() {
  const prefs = usePrefs();
  const snap = useWallet();
  const lockedRef = useRef(snap.locked);
  lockedRef.current = snap.locked;

  // idle + visibility auto-lock; defers while an operation is in flight
  useEffect(() => {
    const mins = prefs.autoLockMinutes;
    if (!mins || snap.locked) return;
    let timer: number | undefined;
    const tryLock = () => {
      if (lockedRef.current) return;
      // lock() hides the UI immediately, then saves/closes after the active
      // scan completes. A long first sync must not disable the privacy lock.
      void walletEngine.lock().catch(() => undefined);
    };
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(tryLock, mins * 60000);
    };
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        window.clearTimeout(timer);
        timer = window.setTimeout(tryLock, 30000);
      } else reset();
    };
    const evs = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    evs.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    document.addEventListener('visibilitychange', onVis);
    reset();
    return () => {
      window.clearTimeout(timer);
      evs.forEach((e) => window.removeEventListener(e, reset));
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [prefs.autoLockMinutes, snap.locked]);

  // auto-sync on unlock and every 2 minutes while unlocked
  useEffect(() => {
    if (!prefs.autoSync || snap.locked || !snap.selectedId) return;
    const kick = () => {
      const s = walletEngine.getSnapshot();
      if (s.locked || s.busy || s.sync.state === 'syncing') return;
      void walletEngine.sync().catch(() => undefined);
    };
    kick();
    const t = window.setInterval(kick, 120000);
    return () => window.clearInterval(t);
  }, [prefs.autoSync, snap.locked, snap.selectedId]);
}

export function NodeDot() {
  const { data, isError } = useNode();
  const ok = !!data?.connected && !isError;
  return (
    <span className="flex items-center gap-2 text-[12.5px] text-muted-foreground" data-testid="status-node">
      <span className={cn('h-2 w-2 rounded-full', ok ? 'bg-[hsl(var(--success))]' : data || isError ? 'bg-destructive' : 'bg-muted-foreground/50')} />
      {ok ? 'Connected' : data || isError ? 'Node offline' : 'Checking'}
    </span>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  useAutoLockAndSync();
  const [loc] = useLocation();
  const snap = useWallet();
  const wallet = snap.wallets.find((w) => w.id === snap.selectedId);

  return (
    <div className="min-h-[100dvh] md:grid md:grid-cols-[232px_1fr]">
      <aside className="sticky top-0 hidden h-[100dvh] flex-col border-r border-sidebar-border bg-sidebar px-4 py-6 md:flex">
        <div className="px-2"><Wordmark /></div>
        <nav className="mt-10 space-y-1">
          {NAV.map((n) => {
            const active = n.href === '/' ? loc === '/' : loc.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href} data-testid={`link-nav-${n.label.toLowerCase()}`} className={cn('relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14.5px] transition-colors', active ? 'text-sidebar-accent-foreground' : 'text-sidebar-foreground/70 hover:text-foreground')}>
                {active && <motion.span layoutId="navpill" className="absolute inset-0 rounded-xl bg-sidebar-accent" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
                {active && <motion.span layoutId="navbar" className="absolute -left-4 top-2 bottom-2 w-[3px] rounded-r bg-primary" />}
                <n.icon className="relative h-[18px] w-[18px]" />
                <span className="relative font-medium">{n.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="flex-1" />
        <Link href="/wallets" className="rounded-xl border border-sidebar-border p-3 transition-colors hover:bg-secondary/50" data-testid="link-wallets">
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Wallet</p>
          <p className="mt-0.5 truncate font-medium">{wallet?.name ?? '—'}</p>
        </Link>
        <button onClick={() => void walletEngine.lock()} className="mt-2 flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-muted-foreground hover:bg-secondary/50 hover:text-foreground" data-testid="button-lock">
          <Lock className="h-4 w-4" /> Lock
        </button>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border/60 bg-background/80 px-5 py-3 backdrop-blur-xl md:px-10">
          <div className="md:hidden"><Wordmark /></div>
          <div className="flex-1" />
          <span className="hidden sm:block"><NodeDot /></span>
          <button onClick={() => void walletEngine.lock()} className="rounded-full p-2 text-muted-foreground hover:bg-secondary md:hidden" aria-label="Lock" data-testid="button-lock-mobile">
            <Lock className="h-4 w-4" />
          </button>
        </header>
        <motion.main key={loc} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }} className="mx-auto w-full max-w-[880px] px-5 pb-28 pt-7 md:px-10 md:pb-16">
          {children}
        </motion.main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-[hsl(24_8%_6%/0.92)] px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 backdrop-blur-xl md:hidden">
        {NAV.map((n) => {
          const active = n.href === '/' ? loc === '/' : loc.startsWith(n.href);
          return (
            <Link key={n.href} href={n.href} className={cn('flex flex-1 flex-col items-center gap-1 py-1 text-[10.5px] font-medium', active ? 'text-primary' : 'text-muted-foreground')} data-testid={`link-tab-${n.label.toLowerCase()}`}>
              <n.icon className="h-5 w-5" />
              {n.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
