/** Switching within an unlocked session is allowed; deletion/export still authenticate separately. */
export function requireUnlockedSession(status: string, foreground = true) {
  if (status !== 'unlocked' || !foreground) throw new Error('Unlock your wallet first.');
}
