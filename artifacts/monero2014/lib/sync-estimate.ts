/** Time estimates are ranges, never a promise or a balance/confirmation signal. */
export const SYNC_CALIBRATION_KEY = 'm2014.scan-calibration.v1';
type Point = { at: number; height: number };
export type ScanWindow = { key: string; started: number; moved: number; height: number; points: Point[] };
export type ScanEstimate = {
  window: ScanWindow; state: 'measuring' | 'tracking' | 'stalled' | 'complete';
  seconds: number; low: number; high: number; rate: number; calibrated: boolean;
};
export function observeScan(previous: ScanWindow | null, key: string, height: number, target: number, complete: boolean, now: number): ScanEstimate {
  let window = previous;
  if (!window || window.key !== key || height < window.height || now <= window.points.at(-1)!.at) {
    window = { key, started: now, moved: now, height, points: [] };
  }
  const moved = height > window.height ? now : window.moved;
  let points = [...window.points.filter(p => now - p.at <= 120000), { at: now, height }];
  // Exclude initial restore-height fast-forwarding from measured scan speed.
  if (now - window.started < 20000) points = [{ at: now, height }];
  window = { ...window, height, moved, points };
  const result = { window, seconds: 0, low: 0, high: 0, rate: 0, calibrated: false };
  if (complete) return { ...result, state: 'complete' };
  if (now - moved >= 45000) return { ...result, state: 'stalled' };
  const elapsed = (now - points[0].at) / 1000, blocks = height - points[0].height;
  if (elapsed < 30 || blocks <= 0 || target <= height || target <= 0) return { ...result, state: 'measuring' };
  const rate = blocks / elapsed, seconds = Math.ceil((target - height) / rate);
  const uncertainty = elapsed < 60 ? 0.6 : 0.35;
  return { ...result, state: 'tracking', seconds, rate, low: Math.max(1, Math.floor(seconds * (1 - uncertainty))),
    high: Math.ceil(seconds * (1 + uncertainty)), calibrated: elapsed >= 60 && rate > 0 && rate < 100000 };
}
export function planningRange(blocks: number, measuredRate?: number) {
  const rate = measuredRate && Number.isFinite(measuredRate) && measuredRate > 0 && measuredRate < 100000 ? measuredRate : null;
  // Explicitly labelled broad, unmeasured planning assumptions for first use.
  const fast = rate ? rate * 2 : 400, slow = rate ? rate / 2 : 40;
  return { low: Math.max(60, Math.ceil(Math.max(0, blocks) / fast)), high: Math.max(60, Math.ceil(Math.max(0, blocks) / slow)), measured: !!rate };
}
export function durationRange(low: number, high: number, t: (key: string, values?: Record<string, string | number>) => string) {
  const format = (seconds: number) => seconds < 7200 ? t('{n} min', { n: Math.max(1, Math.ceil(seconds / 60)) }) : t('{n} h', { n: Math.ceil(seconds / 3600) });
  const a = format(low), b = format(high);
  return a === b ? a : `${a} – ${b}`;
}
