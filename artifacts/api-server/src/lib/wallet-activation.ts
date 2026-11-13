import { createHash } from "node:crypto";
import { mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import { join, isAbsolute } from "node:path";

export type ActivationEnvelope = {
  v: 1; event: "wallet_activated"; eventId: string; keyId: string;
  wrappedKey: string; iv: string; ciphertext: string;
};

export function parseActivation(body: unknown): ActivationEnvelope {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid report.");
  const b = body as Record<string, unknown>;
  const fields = ["v", "event", "eventId", "keyId", "wrappedKey", "iv", "ciphertext"];
  if (Object.keys(b).length !== fields.length || Object.keys(b).some(k => !fields.includes(k))) throw new Error("Invalid report.");
  if (b.v !== 1 || b.event !== "wallet_activated" ||
    typeof b.eventId !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(b.eventId) ||
    typeof b.keyId !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(b.keyId)) throw new Error("Invalid report.");
  for (const field of ["wrappedKey", "iv", "ciphertext"]) {
    const text = b[field];
    if (typeof text !== "string" || text.length > 700 || Buffer.from(text, "base64").toString("base64") !== text) throw new Error("Invalid report.");
  }
  const size = (key: string) => Buffer.from(b[key] as string, "base64").length;
  if (size("wrappedKey") < 256 || size("wrappedKey") > 512 || size("iv") !== 12 || size("ciphertext") < 17 || size("ciphertext") > 80) throw new Error("Invalid report.");
  return { v: 1, event: "wallet_activated", eventId: b.eventId, keyId: b.keyId,
    wrappedKey: b.wrappedKey as string, iv: b.iv as string, ciphertext: b.ciphertext as string };
}

const inFlight = new Set<string>();

export async function deliverActivation(body: ActivationEnvelope, webhook: string, directory: string, post: typeof fetch = fetch) {
  const url = new URL(webhook);
  if (url.protocol !== "https:" || url.username || url.password || url.hash || !isAbsolute(directory)) throw new Error("Invalid server configuration.");
  const serialized = JSON.stringify(body);
  const digest = createHash("sha256").update(serialized).digest("hex");
  const record = join(directory, `${body.eventId}.json`);
  if (inFlight.has(body.eventId)) return "busy";
  inFlight.add(body.eventId);
  const temporary = `${record}.pending`;
  try {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    try {
      const existing = JSON.parse(await readFile(record, "utf8"));
      return existing.digest === digest ? "duplicate" : "conflict";
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    const response = await post(url, {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(10000),
      headers: { "Content-Type": "application/json", "Idempotency-Key": body.eventId },
      body: serialized,
    });
    await response.body?.cancel();
    if (!response.ok) return "unavailable";
    const file = await open(temporary, "w", 0o600);
    try { await file.writeFile(JSON.stringify({ digest, envelope: body })); await file.sync(); }
    finally { await file.close(); }
    await rename(temporary, record);
    return "delivered";
  } finally {
    inFlight.delete(body.eventId);
    await unlink(temporary).catch(error => { if (error.code !== "ENOENT") throw error; });
  }
}
