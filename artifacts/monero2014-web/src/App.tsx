import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import Home from '@/pages/home';
import Activity from '@/pages/activity';
import Receive from '@/pages/receive';
import Send from '@/pages/send';
import SettingsPage from '@/pages/settings';
import Wallets from '@/pages/wallets';
import Diagnostics from '@/pages/diagnostics';
import { walletEngine } from '@/lib/wallet-engine';
import { useWallet } from '@/hooks/use-wallet';
import { flowStore, useFlow } from '@/lib/flow';
import { storageStore, useStorageState } from '@/lib/prefs';
import { errMsg } from '@/lib/format';
import { AppShell } from '@/components/shell';
import { LockScreen } from '@/components/lock-screen';
import { Onboarding } from '@/components/onboarding';
import { Btn, ErrorLine } from '@/components/kit';
import { MoneroLogo } from '@/components/monero-logo';

const queryClient = new QueryClient();

function Splash() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-6">
      <div className="animate-pulse"><MoneroLogo size={64} /></div>
      <div className="h-1 w-32 overflow-hidden rounded-full bg-secondary"><div className="sweep h-full w-1/3 bg-primary" /></div>
    </div>
  );
}

function EnvNotice({ initError, onRetry }: { initError: string | null; onRetry: () => void }) {
  const storage = useStorageState();
  const insecure = typeof window !== 'undefined' && !window.isSecureContext;
  const storageBlocked = !storage.storageOk || /storage|indexeddb/i.test(initError ?? '');
  if (!initError && !insecure && (storage.storageOk || storage.temporarySession)) return null;
  return (
    <div className="mx-auto w-full max-w-[420px] space-y-2 px-6 pt-4" data-testid="notice-env">
      {insecure && <ErrorLine msg="This page is not in a secure context, so browser encryption is unavailable. Open it over HTTPS." />}
      {initError && (
        <div className="space-y-2">
          <ErrorLine msg={`Wallet engine failed to start: ${initError}`} />
          <Btn size="sm" variant="soft" onClick={onRetry} data-testid="button-retry-init">Retry</Btn>
        </div>
      )}
      {storageBlocked && !storage.temporarySession && (
        <div className="rounded-xl border border-border p-3.5 text-[13px]">
          <p className="text-muted-foreground">This browser frame blocks storage, so a wallet can't be saved here.</p>
          <div className="mt-2.5 flex gap-2">
            <Btn size="sm" onClick={() => window.open(window.location.href, '_blank', 'noopener')} data-testid="button-open-standalone">Open in new tab</Btn>
            <Btn size="sm" variant="soft" onClick={() => { storageStore.useTemporary(); onRetry(); }} data-testid="button-temporary-session">Use temporary session</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

function Gate({ children }: { children: ReactNode }) {
  const snap = useWallet();
  const flow = useFlow();
  const storage = useStorageState();
  const [loc] = useLocation();
  const [initError, setInitError] = useState<string | null>(null);

  const init = useCallback(() => {
    setInitError(null);
    walletEngine.initialize().catch((e: unknown) => setInitError(errMsg(e)));
  }, []);
  useEffect(() => { init(); }, [init]);

  useEffect(() => {
    if (snap.ready && snap.wallets.length === 0 && flowStore.get() === null) flowStore.set('welcome');
  }, [snap.ready, snap.wallets.length]);

  if (loc === '/test' || loc === '/test/') return <Diagnostics />;
  if (!snap.ready && !initError) return <Splash />;

  if (flow || !snap.ready || snap.wallets.length === 0) {
    const mode = flow === 'create' || flow === 'restore' ? flow : undefined;
    return (
      <>
        <EnvNotice initError={initError ?? snap.error} onRetry={init} />
        <Onboarding
          key={flow ?? 'welcome'}
          initialMode={mode}
          onCancel={snap.wallets.length ? () => flowStore.set(null) : undefined}
          onDone={() => flowStore.set(null)}
        />
      </>
    );
  }
  if (snap.locked) return <LockScreen />;
  return <>
    {storage.temporarySession && <div className="border-b border-border bg-accent px-4 py-2 text-center text-xs">Temporary test session · closing this page clears the wallet.</div>}
    <AppShell>{children}</AppShell>
  </>;
}

function Router() {
  return (
    <Gate>
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/activity" component={Activity} />
          <Route path="/receive" component={Receive} />
          <Route path="/send" component={Send} />
          <Route path="/settings" component={SettingsPage} />
          <Route path="/wallets" component={Wallets} />
          <Route path="/test" component={Diagnostics} />
          <Route component={NotFound} />
        </Switch>
      </RoutedErrorBoundary>
    </Gate>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
