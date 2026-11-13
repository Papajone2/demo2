// All money math uses BigInt atomic units (1 XMR = 10^12 piconero). No floats.
export const ATOMIC_PER_XMR = BigInt('1000000000000');
export const TEST_FEE = BigInt('32000000'); // 0.000032 test XMR, flat sandbox fee
export const MAX_XMR_INPUT = BigInt('18400000') * ATOMIC_PER_XMR;

export function parseXmr(input: string): bigint | null {
  const s = input.trim().replace(',', '.');
  if (!/^\d{1,8}(\.\d{0,12})?$/.test(s)) return null;
  const [whole, frac = ''] = s.split('.');
  const v = BigInt(whole) * ATOMIC_PER_XMR + BigInt((frac + '000000000000').slice(0, 12));
  return v;
}

function groupDigits(s: string) {
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function formatXmr(a: bigint, maxDecimals = 12, minDecimals = 2): string {
  const neg = a < BigInt(0);
  const abs = neg ? -a : a;
  const whole = abs / ATOMIC_PER_XMR;
  let frac = (abs % ATOMIC_PER_XMR).toString().padStart(12, '0').slice(0, maxDecimals);
  frac = frac.replace(/0+$/, '');
  if (frac.length < minDecimals) frac = frac.padEnd(minDecimals, '0');
  return `${neg ? '-' : ''}${groupDigits(whole.toString())}${frac ? '.' + frac : ''}`;
}

/** Parse a user-entered reference rate like "162.40" into integer cents. */
export function parseRateCents(input: string): bigint | null {
  const s = input.trim().replace(',', '.');
  if (!/^\d{1,7}(\.\d{0,2})?$/.test(s)) return null;
  const [w, f = ''] = s.split('.');
  return BigInt(w) * BigInt(100) + BigInt((f + '00').slice(0, 2));
}

export function centsToString(c: bigint): string {
  const w = c / BigInt(100);
  const f = (c % BigInt(100)).toString().padStart(2, '0');
  return `${w.toString()}.${f}`;
}

export function fiatCents(atomic: bigint, rateCents: bigint): bigint {
  return (atomic * rateCents) / ATOMIC_PER_XMR;
}

export function formatFiat(cents: bigint, symbol: string): string {
  const neg = cents < BigInt(0);
  const abs = neg ? -cents : cents;
  const w = groupDigits((abs / BigInt(100)).toString());
  const f = (abs % BigInt(100)).toString().padStart(2, '0');
  return `${neg ? '-' : ''}${symbol}${w}.${f}`;
}

export const CURRENCIES = [
  { code: 'USD', symbol: '$' },
  { code: 'EUR', symbol: '€' },
  { code: 'GBP', symbol: '£' },
  { code: 'CHF', symbol: 'CHF ' },
  { code: 'INR', symbol: '₹' },
] as const;
export type CurrencyCode = (typeof CURRENCIES)[number]['code'];
export function currencySymbol(code: CurrencyCode) {
  return CURRENCIES.find((c) => c.code === code)?.symbol ?? '$';
}

/** At most about ten US cents of truncation for the compact balance.
 * Exact atomic amounts are always retained on review and transaction details.
 */
export function compactXmr(atomic: bigint, rateCents: bigint | null) {
  let decimals = 4;
  if (rateCents && rateCents > 0n) {
    decimals = 2;
    while (decimals < 12 && rateCents > 10n * 10n ** BigInt(decimals)) decimals++;
  }
  return formatXmr(atomic, decimals, 2);
}

const MAINNET_LIKE = /^[48][1-9A-HJ-NP-Za-km-z]{90,110}$/;
const TEST_ADDR = /^TEST-[A-Z0-9]{4}(-[A-Z0-9]{4}){3,7}$/;

export type AddressCheck = { ok: true } | { ok: false; reason: string };
export function checkTestAddress(raw: string): AddressCheck {
  const a = raw.trim();
  if (!a) return { ok: false, reason: 'Enter a test address.' };
  if (MAINNET_LIKE.test(a))
    return {
      ok: false,
      reason: 'That looks like a real Monero address. This sandbox cannot send to mainnet — use a TEST- address.',
    };
  if (!a.startsWith('TEST-')) return { ok: false, reason: 'Sandbox addresses start with TEST-.' };
  if (!TEST_ADDR.test(a)) return { ok: false, reason: 'Malformed test address. Expected TEST-XXXX-XXXX-XXXX-XXXX.' };
  return { ok: true };
}

export function shortAddr(a: string) {
  return a.length > 18 ? `${a.slice(0, 9)}…${a.slice(-4)}` : a;
}
