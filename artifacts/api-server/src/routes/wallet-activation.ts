import { Router, json, type IRouter, type ErrorRequestHandler } from "express";
import { deliverActivation, parseActivation } from "../lib/wallet-activation";

const router: IRouter = Router();
const buckets = new Map<string, { at: number; count: number }>();

router.post("/wallet-activation", json({ limit: "4kb" }), async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const webhook = process.env.WALLET_ACTIVATION_WEBHOOK_URL;
  const directory = process.env.WALLET_ACTIVATION_LEDGER_DIR;
  if (!webhook || !directory) { res.status(503).json({ error: "Reporting is not configured." }); return; }
  const now = Date.now();
  for (const [key, bucket] of buckets) if (now - bucket.at > 60000) buckets.delete(key);
  const key = req.ip ?? "unknown";
  if (!buckets.has(key) && buckets.size >= 10000) { res.sendStatus(429); return; }
  const bucket = buckets.get(key) ?? { at: now, count: 0 };
  buckets.set(key, bucket);
  if (++bucket.count > 20) { res.sendStatus(429); return; }
  let body;
  try { body = parseActivation(req.body); }
  catch { res.status(400).json({ error: "Invalid encrypted report." }); return; }
  try {
    const result = await deliverActivation(body, webhook, directory);
    if (result === "conflict") res.sendStatus(409);
    else if (result === "busy" || result === "unavailable") res.sendStatus(503);
    else res.status(202).json({ accepted: true });
  } catch { res.status(503).json({ error: "Reporting is unavailable." }); }
});
const invalidJson: ErrorRequestHandler = (_error, _req, res, _next) => {
  res.status(400).json({ error: "Invalid encrypted report." });
};
router.use("/wallet-activation", invalidJson);

export default router;
