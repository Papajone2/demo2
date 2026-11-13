// @ts-ignore Node regression tests need explicit TypeScript extensions.
import { ATOMIC_PER_XMR, parseRateCents, parseXmr } from './money.ts';
export function fiatToAtomic(input: string, rate: bigint | null): bigint | null {
  const cents = parseRateCents(input);
  return cents !== null && rate !== null && rate > 0n ? cents * ATOMIC_PER_XMR / rate : null;
}
export function readPaymentQr(input: string) {
  const text = input.trim();
  if (!text.toLowerCase().startsWith('monero:')) {
    if (!/^[1-9A-HJ-NP-Za-km-z]{95,106}$/.test(text)) throw new Error('Invalid address or wrong network. Check the recipient address.');
    return { address: text, amount: '' };
  }
  const [rawAddress, query = ''] = text.slice(7).split('?');
  if (!/^[1-9A-HJ-NP-Za-km-z]{95,106}$/.test(rawAddress)) throw new Error('Invalid address or wrong network. Check the recipient address.');
  const params = new URLSearchParams(query);
  if (params.has('tx_payment_id')) throw new Error('Separate payment IDs are not supported. Ask for an integrated address.');
  const amount = params.get('tx_amount') ?? '';
  if (amount && (parseXmr(amount) === null || parseXmr(amount)! <= 0n)) throw new Error('Invalid payment amount in QR code.');
  return { address: rawAddress, amount };
}
