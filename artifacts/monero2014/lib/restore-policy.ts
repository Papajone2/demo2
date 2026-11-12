/** Conservative date estimate, not a blockchain checkpoint or a guarantee.
 * Start 90 days before the chosen month, using Monero's v2 120-second target.
 * Before v2, use genesis to avoid skipping early history.
 */
export function estimatedRestoreHeight(year: number, month: number) {
  const timestamp = Date.UTC(year, month - 1, 1) / 1000;
  const v2Time = 1458748658; // 2016-03-23, fork height 1009827
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12 || timestamp < v2Time) return 0;
  return Math.max(0, 1009827 + Math.floor((timestamp - v2Time - 90 * 86400) / 120));
}
