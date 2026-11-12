/** Five tries per stage: 1 minute, 5 minutes, 1 hour, then repeat.
 * Persist the failure count; expiry/relaunch must not reset the next stage.
 */
export function lockoutMs(failures: number) {
  if (failures < 5 || failures % 5 !== 0) return 0;
  return [60_000, 300_000, 3_600_000][(Math.floor(failures / 5) - 1) % 3];
}
export const AUTO_LOCK_MS = 5 * 60_000;
