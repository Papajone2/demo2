import type { MoneroHistory, MoneroStats, GetMoneroHistoryParams } from '@workspace/api-client-react';

const HOUR = 3600000;
export const RANGE_MS = { '1h': HOUR, '1d': 24 * HOUR, '1w': 7 * 24 * HOUR, '1m': 30 * 24 * HOUR, '1y': 365 * 24 * HOUR };
const DAYS = { '1h': 1, '1d': 1, '1w': 7, '1m': 30, '1y': 365 };
const INTERVAL = { '1h': 1, '1d': 5, '1w': 15, '1m': 60, '1y': 1440 };
export function observedHistory(rows: unknown, currency: MoneroHistory['currency'], range: keyof typeof RANGE_MS, source: string, now = Date.now()): MoneroHistory {
  if (!Array.isArray(rows) || rows.length < 2 || rows.length > 10000) throw new Error('Incomplete market observations.');
  let previous = 0;
  const points = rows.map(row => {
    if (!Array.isArray(row) || row.length < 2) throw new Error('Invalid price observation.');
    const [timestamp, price] = row;
    if (!Number.isSafeInteger(timestamp) || timestamp <= previous || timestamp > now + 60000 || typeof price !== 'number' || !Number.isFinite(price) || price <= 0) throw new Error('Invalid price observation.');
    previous = timestamp;
    return { timestamp: timestamp as number, price };
  }).filter(p => p.timestamp >= now - RANGE_MS[range]);
  if (points.length < 2) throw new Error('Not enough market history.');
  const first = points[0], last = points[points.length - 1];
  if (last.timestamp - first.timestamp < RANGE_MS[range] * 0.5 || now - last.timestamp > (range === '1y' ? 26 * HOUR : HOUR)) throw new Error('Market history is incomplete or out of date.');
  return { currency, points, price: last.price, changeAbsolute: last.price - first.price,
    changePercent: (last.price / first.price - 1) * 100, updatedAt: new Date(last.timestamp).toISOString(),
    source, stale: now - last.timestamp > 15 * 60000 };
}
async function json(url: string) {
  // Dynamic import keeps the pure history parser usable in Node regression tests.
  const { guardMarketRequest } = await import('./network-policy');
  const controller = new AbortController();
  const release = guardMarketRequest(controller);
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const r = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(`Market provider HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(timer); release(); }
}
export async function nativeMarketHistory(params: GetMoneroHistoryParams): Promise<MoneroHistory> {
  const currency = params.currency ?? 'usd', range = params.range ?? '1d';
  try {
    const data = await json(`https://api.coingecko.com/api/v3/coins/monero/market_chart?vs_currency=${currency}&days=${DAYS[range]}`);
    return observedHistory(data.prices, currency, range, 'CoinGecko');
  } catch {
    // Real exchange candles only; no fabricated/smoothed fallback data.
    const data = await json(`https://api.kraken.com/0/public/OHLC?pair=XMR${currency.toUpperCase()}&interval=${INTERVAL[range]}`);
    if (data.error?.length) throw new Error('Market providers unavailable.');
    const candles = Object.entries(data.result ?? {}).find(([key]) => key !== 'last')?.[1];
    if (!Array.isArray(candles)) throw new Error('Market providers unavailable.');
    return observedHistory(candles.map(r => [Number(r[0]) * 1000, Number(r[4])]), currency, range, 'Kraken · candle close prices');
  }
}
export async function nativeMarketStats(currency: MoneroHistory['currency']): Promise<MoneroStats> {
  const data = await json('https://api.coingecko.com/api/v3/coins/monero?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false');
  const m = data.market_data;
  const updated = Date.parse(m?.last_updated), now = Date.now();
  if (data.id !== 'monero' || !m || !Number.isFinite(updated) || updated > now + 60000 || now - updated > 24 * HOUR) throw new Error('Market statistics unavailable.');
  const nullable = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;
  return { createdYear: 2014, marketCap: nullable(m.market_cap?.[currency]), circulatingSupply: nullable(m.circulating_supply),
    totalSupply: nullable(m.total_supply), allTimeHigh: nullable(m.ath?.[currency]), updatedAt: m.last_updated,
    stale: Date.now() - Date.parse(m.last_updated) > 15 * 60000 };
}
