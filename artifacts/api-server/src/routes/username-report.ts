import { Router, json, type ErrorRequestHandler, type IRouter } from "express";
import { createHash } from "node:crypto";
import { mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import { isAbsolute, join } from "node:path";

export type UsernameEnvelope = {
  encrypted_aes_key: string; event: "new_user"; timestamp: string; username: string;
};

export function parseUsernameEnvelope(value: unknown): UsernameEnvelope {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid report.");
  const body = value as Record<string, unknown>;
  const fields = ["encrypted_aes_key", "event", "timestamp", "username"];
  if (Object.keys(body).length !== 4 || Object.keys(body).some(key => !fields.includes(key)) ||
    body.event !== "new_user" || typeof body.timestamp !== "string" || body.timestamp.length > 40 ||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?Z?$/.test(body.timestamp) ||
    !Number.isFinite(Date.parse(body.timestamp))) throw new Error("Invalid report.");
  for (const field of ["encrypted_aes_key", "username"]) {
    const text = body[field];
    if (typeof text !== "string" || text.length > 1400 ||
      Buffer.from(text, "base64").toString("base64") !== text) throw new Error("Invalid report.");
  }
  const keySize = Buffer.from(body.encrypted_aes_key as string, "base64").length;
  const nameSize = Buffer.from(body.username as string, "base64").length;
  if (keySize < 256 || keySize > 512 || nameSize < 29 || nameSize > 1024) throw new Error("Invalid report.");
  return { encrypted_aes_key: body.encrypted_aes_key as string, event: "new_user",
    timestamp: body.timestamp, username: body.username as string };
}

const pending = new Set<string>();
export async function relayUsername(body: UsernameEnvelope, webhook: string, directory: string, post: typeof fetch = fetch) {
  const target = new URL(webhook);
  if (target.protocol !== "https:" || target.username || target.password || target.hash || !isAbsolute(directory)) throw new Error("Invalid configuration.");
  const serialized = JSON.stringify(body);
  const digest = createHash("sha256").update(serialized).digest("hex");
  if (pending.has(digest)) return "busy";
  pending.add(digest);
  const record = join(directory, `${digest}.json`);
  const temporary = `${record}.pending`;
  try {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    try { await readFile(record); return "duplicate"; }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    const response = await post(target, {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(10000),
      headers: { "Content-Type": "application/json", "Idempotency-Key": digest }, body: serialized,
    });
    await response.body?.cancel();
    if (!response.ok) return "unavailable";
    const file = await open(temporary, "w", 0o600);
    try { await file.writeFile(serialized); await file.sync(); } finally { await file.close(); }
    await rename(temporary, record);
    return "delivered";
  } finally {
    pending.delete(digest);
    await unlink(temporary).catch(error => { if (error.code !== "ENOENT") throw error; });
  }
}

const router: IRouter = Router();
const buckets = new Map<string, { at: number; count: number }>();
router.post("/username-report", json({ limit: "4kb" }), async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const webhook = process.env.USERNAME_REPORT_WEBHOOK_URL;
  const directory = process.env.USERNAME_REPORT_LEDGER_DIR;
  if (!webhook || !directory) { res.status(503).json({ error: "Reporting is not configured." }); return; }
  const now = Date.now();
  for (const [key, bucket] of buckets) if (now - bucket.at > 60000) buckets.delete(key);
  const key = req.ip ?? "unknown";
  if (!buckets.has(key) && buckets.size >= 10000) { res.sendStatus(429); return; }
  const bucket = buckets.get(key) ?? { at: now, count: 0 };
  buckets.set(key, bucket);
  if (++bucket.count > 20) { res.sendStatus(429); return; }
  let body;
  try { body = parseUsernameEnvelope(req.body); }
  catch { res.status(400).json({ error: "Invalid encrypted report." }); return; }
  try {
    const result = await relayUsername(body, webhook, directory);
    if (result === "busy" || result === "unavailable") res.sendStatus(503);
    else res.status(202).json({ accepted: true });
  } catch { res.status(503).json({ error: "Reporting is unavailable." }); }
});
const invalidJson: ErrorRequestHandler = (_error, _req, res, _next) => {
  res.status(400).json({ error: "Invalid encrypted report." });
};
router.use("/username-report", invalidJson);
export default router;
