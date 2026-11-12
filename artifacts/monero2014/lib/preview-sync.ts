/** Visual-only timing for the native sandbox, never a network synchronization claim. */
export const PREVIEW_SYNC_MS = 20000;
export function previewSyncStatus(startedAt: number, now = Date.now()) {
  const elapsed = Math.max(0, now - startedAt);
  return {
    remainingSeconds: Math.ceil(Math.max(0, PREVIEW_SYNC_MS - elapsed) / 1000),
    progress: Math.min(1, elapsed / PREVIEW_SYNC_MS),
    complete: elapsed >= PREVIEW_SYNC_MS,
  };
}
