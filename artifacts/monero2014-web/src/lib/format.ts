export const HIDDEN = '••••••';

export function xmrNumber(s: string | null | undefined): number {
  // Engine monetary strings are integer piconero. This approximate conversion
  // is for market-value display only; transfers retain integer atomic units.
  const n = Number(s ?? 0) / 1e12;
  return Number.isFinite(n) ? n : 0;
}

export function fmtXmr(s: string | null | undefined, max = 6): string {
  const n = BigInt(s ?? '0');
  const abs = n < 0n ? -n : n;
  const whole = (abs / 1000000000000n).toLocaleString('en-US');
  const fraction = (abs % 1000000000000n).toString().padStart(12, '0').slice(0, max).replace(/0+$/, '').padEnd(2, '0');
  return `${n < 0n ? '-' : ''}${whole}.${fraction}`;
}

export function fmtFiat(n: number | null | undefined, currency: string): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase(), maximumFractionDigits: 2 }).format(n);
}

export function shortAddr(a: string, n = 6): string {
  if (!a) return '';
  return a.length <= n * 2 + 3 ? a : `${a.slice(0, n)}…${a.slice(-n)}`;
}

export function tsDate(ts: number | null): Date | null {
  if (ts == null) return null;
  return new Date(ts < 1e12 ? ts * 1000 : ts);
}

export function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  return 'Something went wrong';
}

export function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
