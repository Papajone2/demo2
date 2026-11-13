# Encrypted wallet-name reporting

## Public configuration

Open `tools/activation-key-setup.html` in a browser for the public-key textbox.
It works locally, makes no network requests, accepts only SPKI PEM RSA public
keys (2048–4096 bits), and downloads `activation-reporting.json`.
Copy that file to **`artifacts/monero2014/config/activation-reporting.json`**.
That is the file to edit for the recipient public key, key identifier and public
relay URL. Rebuild the APK after changing it.

The checked-in default is **disabled**, with no recipient key or relay URL.
Never put a private key, a shared AES secret, a seed or a secret webhook URL in
that file. Do not put key values in tickets, build logs or screenshots.

## Server setup

Deploy `artifacts/api-server` behind HTTPS. Its route is
`POST /api/wallet-activation`. Supply:

- `WALLET_ACTIVATION_WEBHOOK_URL`: server-only secret, entered through Secrets.
- `WALLET_ACTIVATION_LEDGER_DIR`: absolute path on a persistent private volume,
  outside the repository and web root. Use one server worker with this file
  ledger; use a shared transactional store before scaling to multiple workers.

The uploaded webhook configuration is intentionally **not** committed or
embedded in the APK. No live webhook is called by tests.

Create and retain the RSA private key in your own server's secure key-management
system. Export only its public key into the setup tool. The app doesn't generate,
ask for or store an operator private key. Key management and deployment must be
completed before enabling reporting; the setup tool is not a deployment tool.

To decrypt an envelope on your own server, inject the matching
`WALLET_ACTIVATION_PRIVATE_KEY_PEM` secret and pipe the envelope to:

```
node scripts/decrypt-activation-name.mjs < report.json
```

This deliberately prints the recovered name to that server's stdout. Do not
use it in public build logs. Keep old keys for envelopes with older `keyId`
values; rotating the configuration does not re-encrypt already queued reports.

## Cryptography and payload

Local names use AES-256-GCM with a separate non-exportable Android Keystore key.
GCM authenticates the wallet ID. Existing names migrate in place in the catalog;
the native wallet/key files, wallet IDs and existing password-protection key are
not replaced. Migration is not a claim of forensic removal of old plaintext.

Each outbound name uses a **fresh random 256-bit AES key and a fresh GCM IV**.
Only the operator's RSA public key wraps that AES key using
RSA-OAEP/SHA-256 with MGF1/SHA-256. AAD is UTF-8:
`monero-wallet/activation/v1|KEY_ID|EVENT_ID`. Ciphertext includes its final
16-byte GCM tag. Fields are:
`v`, `event`, `eventId`, `keyId`, `wrappedKey`, `iv`, `ciphertext`.
The three binary fields use standard padded Base64.

The server private key can decrypt **names only**. Seed material and native
wallet passwords never enter this envelope and use separate device-local keys.
No configurable developer key wraps users' recovery phrases.

## Trigger, disclosure and delivery limits

- Only native mainnet wallets: positive incoming transaction, at least one
  on-chain confirmation, completed synchronization and completed customization.
  One confirmation is not the same as funds becoming spendable.
- The clear notice is below the name input. Saving the name while reporting
  is configured records the disclosure acknowledgement. Icon-only changes
  and upgrades do not silently enroll existing wallets.
- Restored wallets with historical receipts can qualify after the notice and
  completed scan. This measures activated wallet installations, not first-ever
  Monero users, verified unique people or proof of payment.
- Reporting pauses in the background, while locked, and whenever Tor is enabled.
  It does **not** bypass Tor with a direct analytics connection.
- The encrypted envelope and random event ID persist before sending. Retry no
  sooner than once per minute in the foreground, preserving the same event ID.
  Acknowledged events are not sent again for that local wallet.
- The relay validates a strict bounded envelope and retains encrypted delivery
  records for deduplication. It does not decrypt names. The receiving server
  decrypts with its own private key.
- Network ambiguity or a server crash can repeat a webhook delivery. The
  receiver **must deduplicate `eventId`** (also supplied as `Idempotency-Key`).
  Exactly-once delivery is not claimed.
- A public client can forge analytics events. Encryption doesn't prove funding.
  Add appropriate production abuse controls at the edge.
- Neither an address, amount, transaction ID, local wallet ID nor recovery
  phrase is included. Timing, ciphertext length and network metadata remain
  observable. There is no claim of anonymity.

Before public release, review consent requirements, privacy/Data Safety
declarations, retention and deletion procedures, and the key/relay design with
an independent security reviewer. This feature is not a wallet-security audit.
