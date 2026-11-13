import { Router, raw, type IRouter } from "express";
import { GetMoneroPriceQueryParams, GetMoneroPriceResponse, GetMoneroHistoryQueryParams, GetMoneroNodeQueryParams, GetMoneroNodeResponse, MoneroDaemonRequestParams, GetMoneroStatsQueryParams } from "@workspace/api-zod";
import { HISTORY_DAYS, parseMoneroHistory, type HistoryRange } from "../lib/monero-history";
import { parseMoneroStats } from "../lib/monero-stats";

const router: IRouter = Router();
const NODES = {
  stagenet: "http://node.monerodevs.org:38089",
  mainnet: "https://node.sethforprivacy.com",
} as const;
const ENDPOINTS = new Set([
  'gethashes.bin', 'getblocks.bin', 'getblocks_by_height.bin',
  'gettransactions', 'getheight', 'getinfo', 'getversion', 'sendrawtransaction',
  "json_rpc", "get_info", "get_height", "get_version",
  "get_blocks.bin", "get_blocks_by_height.bin", "get_hashes.bin", "get_o_indexes.bin",
  "get_outs.bin", "get_outs", "get_transactions", "get_transaction_pool_hashes.bin",
  "get_transaction_pool", "get_transaction_pool_stats", "is_key_image_spent",
  "send_raw_transaction", "get_output_distribution.bin", "get_limit",
]);
const RPC_METHODS = new Set([
  "get_info", "get_version", "get_block_count", "get_last_block_header",
  "get_block_header_by_height", "get_block_headers_range", "get_block_header_by_hash",
  "get_fee_estimate", "get_output_distribution", "get_output_histogram",
  "get_txpool_backlog", "hard_fork_info", "get_height", "get_block",
]);
// Limits are intentionally per process. No accounts, addresses or private wallet material
// are persisted on this service. A production edge should enforce global rate limits too.
const buckets = new Map<string, { since: number; count: number }>();
router.use("/monero", (req, res, next) => {
  const now = Date.now();
  if (buckets.size > 10000) {
    for (const [k, v] of buckets) if (now - v.since > 60000) buckets.delete(k);
  }
  const key = req.ip ?? "unknown";
  let b = buckets.get(key);
  if (!b || now - b.since > 60000) { b = { since: now, count: 0 }; buckets.set(key, b); }
  if (++b.count > 300) { res.status(429).json({ error: "Please wait before retrying." }); return; }
  res.setHeader("X-Content-Type-Options", "nosniff");
  next();
});

type Price = ReturnType<typeof GetMoneroPriceResponse.parse>;
const priceCache = new Map<string, { value: Price; at: number }>();
const pricePending = new Map<string, Promise<Price>>();
async function price(currency: string): Promise<Price> {
  const cached = priceCache.get(currency);
  if (cached && Date.now() - cached.at < 60000) return cached.value;
  const active = pricePending.get(currency);
  if (active) return active;
  const job = (async () => {
    try {
      const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=monero&vs_currencies=${currency}&include_24hr_change=true&include_last_updated_at=true`, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error("Price provider unavailable");
      const data = ((await response.json()) as { monero?: Record<string, number> }).monero;
      if (!data || !Number.isFinite(data[currency]) || data[currency] <= 0 || !Number.isFinite(data.last_updated_at)) throw new Error("Invalid price data");
      const value = GetMoneroPriceResponse.parse({
        currency, price: data[currency], change24h: data[`${currency}_24h_change`] ?? null,
        updatedAt: new Date(data.last_updated_at * 1000).toISOString(), source: "CoinGecko",
        stale: Date.now() - data.last_updated_at * 1000 > 300000,
      });
      priceCache.set(currency, { value, at: Date.now() });
      return value;
    } catch {
      if (cached && Date.now() - cached.at < 15 * 60000) return { ...cached.value, stale: true };
      throw new Error("Market price is unavailable. Try again later.");
    } finally { pricePending.delete(currency); }
  })();
  pricePending.set(currency, job);
  return job;
}
router.get("/monero/price", async (req, res): Promise<void> => {
  const parsed = GetMoneroPriceQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: "Unsupported currency" }); return; }
  try { res.json(await price(parsed.data.currency ?? "usd")); }
  catch { res.status(503).json({ error: "Market price temporarily unavailable" }); }
});

type History = ReturnType<typeof parseMoneroHistory>;
const historyCache = new Map<string, { value: History; at: number }>();
const historyPending = new Map<string, Promise<History>>();
async function history(currency: "usd" | "eur" | "gbp" | "inr" | "chf", range: HistoryRange): Promise<History> {
  const key = `${currency}:${range}`;
  const cached = historyCache.get(key);
  if (cached && Date.now() - cached.at < 60000) return cached.value;
  const pending = historyPending.get(key);
  if (pending) return pending;
  const job = (async () => {
    try {
      const response = await fetch(`https://api.coingecko.com/api/v3/coins/monero/market_chart?vs_currency=${currency}&days=${HISTORY_DAYS[range]}`, {
        signal: AbortSignal.timeout(10000), redirect: "error",
      });
      if (!response.ok) throw new Error("Market history provider unavailable");
      const value = parseMoneroHistory(await response.json(), currency, Date.now(), range);
      historyCache.set(key, { value, at: Date.now() });
      return value;
    } catch {
      // Preserve actual observations only, and always disclose cached delayed data.
      if (cached && Date.now() - cached.at < 15 * 60000) return { ...cached.value, stale: true };
      throw new Error("Market history unavailable");
    } finally { historyPending.delete(key); }
  })();
  historyPending.set(key, job);
  return job;
}
router.get("/monero/history", async (req, res): Promise<void> => {
  const parsed = GetMoneroHistoryQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: "Unsupported currency or period" }); return; }
  res.setHeader("Cache-Control", "no-store");
  try { res.json(await history(parsed.data.currency ?? "usd", parsed.data.range ?? "1d")); }
  catch { res.status(503).json({ error: "Market history temporarily unavailable" }); }
});

type Stats = ReturnType<typeof parseMoneroStats>;
const statsCache = new Map<string, { value: Stats; at: number }>();
const statsPending = new Map<string, Promise<Stats>>();
async function stats(currency: "usd" | "eur" | "gbp" | "inr" | "chf"): Promise<Stats> {
  const cached = statsCache.get(currency);
  if (cached && Date.now() - cached.at < 5 * 60000) return cached.value;
  const pending = statsPending.get(currency);
  if (pending) return pending;
  const job = (async () => {
    try {
      const response = await fetch("https://api.coingecko.com/api/v3/coins/monero?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false", {
        signal: AbortSignal.timeout(10000), redirect: "error",
      });
      if (!response.ok) throw new Error("Statistics provider unavailable");
      const value = parseMoneroStats(await response.json(), currency);
      statsCache.set(currency, { value, at: Date.now() });
      return value;
    } catch {
      if (cached && Date.now() - cached.at < 15 * 60000) return { ...cached.value, stale: true };
      throw new Error("Market statistics unavailable");
    } finally { statsPending.delete(currency); }
  })();
  statsPending.set(currency, job);
  return job;
}
router.get("/monero/stats", async (req, res): Promise<void> => {
  const parsed = GetMoneroStatsQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: "Unsupported currency" }); return; }
  res.setHeader("Cache-Control", "no-store");
  try { res.json(await stats(parsed.data.currency ?? "usd")); }
  catch { res.status(503).json({ error: "Market statistics temporarily unavailable" }); }
});

const nodeCache = new Map<string, { value: unknown; at: number }>();
router.get("/monero/node", async (req, res): Promise<void> => {
  const parsed = GetMoneroNodeQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: "Unsupported network" }); return; }
  const network = parsed.data.network ?? "stagenet";
  const cached = nodeCache.get(network);
  if (cached && Date.now() - cached.at < 15000) { res.json(cached.value); return; }
  let value;
  try {
    const response = await fetch(`${NODES[network]}/get_info`, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error("Node unavailable");
    const data = await response.json() as { height: number; target_height?: number; stagenet?: boolean };
    if (!Number.isSafeInteger(data.height) || data.height <= 0 || (network === "stagenet" && !data.stagenet)) throw new Error("Wrong network");
    value = { network, connected: true, height: data.height, targetHeight: data.target_height || data.height, checkedAt: new Date().toISOString(), error: null };
  } catch {
    value = { network, connected: false, height: null, targetHeight: null, checkedAt: new Date().toISOString(), error: "Node unavailable. Retry shortly." };
  }
  const validated = GetMoneroNodeResponse.parse(value);
  nodeCache.set(network, { value: validated, at: Date.now() });
  res.json(validated);
});

// Protocol data only, never arbitrary URLs and never monero-wallet-rpc.
// This router is mounted before the ordinary JSON body parser in app.ts.
router.post("/monero/daemon/:network/:endpoint", raw({ type: () => true, limit: "5mb" }), async (req, res): Promise<void> => {
  const params = MoneroDaemonRequestParams.safeParse(req.params);
  if (!params.success || !ENDPOINTS.has(params.data.endpoint)) { res.status(400).json({ error: "Endpoint not allowed" }); return; }
  if (params.data.network !== "stagenet") { res.status(403).json({ error: "Mainnet relay is not enabled in this test build" }); return; }
  const { endpoint } = params.data;
  const body: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
  const isBinary = endpoint.endsWith(".bin");
  if (!isBinary && body.length) {
    try {
      const data = JSON.parse(body.toString("utf8"));
      if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error();
      if (endpoint === "json_rpc" && !RPC_METHODS.has(data.method)) throw new Error();
      // No administrative methods, URLs, passwords or wallet keys accepted.
      if (/private.?key|spend.?key|view.?key|mnemonic|password|seed/i.test(body.toString("utf8"))) throw new Error();
    } catch { res.status(400).json({ error: "Request is not an allowed blockchain operation" }); return; }
  }
  try {
    const upstream = await fetch(`${NODES.stagenet}/${endpoint}`, {
      method: "POST", headers: { "Content-Type": isBinary ? "application/octet-stream" : "application/json" },
      body: new Uint8Array(body), signal: AbortSignal.timeout(60000), redirect: "error",
    });
    if (!upstream.ok || !upstream.body) throw new Error();
    const reader = upstream.body.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 64 * 1024 * 1024) { await reader.cancel(); throw new Error(); }
      chunks.push(value);
    }
    res.setHeader("Cache-Control", "no-store");
    res.type(isBinary ? "application/octet-stream" : "application/json").send(Buffer.concat(chunks));
  } catch { res.status(502).json({ error: "Blockchain node unavailable. Your wallet remains on this device." }); }
});
export default router;
