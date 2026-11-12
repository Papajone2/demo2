import { useCallback, useEffect, useRef, useState } from 'react';
import { previewSyncStatus } from '@/lib/preview-sync';

/** Shared across routes by WalletProvider; a fresh provider session restarts the preview. */
export function usePreviewSync(walletId?: string) {
  const starts = useRef(new Map<string, number>());
  const [now, setNow] = useState(Date.now);
  if (walletId && !starts.current.has(walletId)) starts.current.set(walletId, Date.now());
  const start = walletId ? starts.current.get(walletId) : undefined;
  const sync = previewSyncStatus(start ?? now, now);
  useEffect(() => {
    setNow(Date.now());
    if (start === undefined) return;
    const timer = setInterval(() => {
      const time = Date.now();
      setNow(time);
      if (previewSyncStatus(start, time).complete) clearInterval(timer);
    }, 250);
    return () => clearInterval(timer);
  }, [start]);
  const isComplete = useCallback(() => start !== undefined && previewSyncStatus(start).complete, [start]);
  return { sync, isComplete };
}
