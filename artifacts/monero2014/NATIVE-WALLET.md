# Native Android wallet — experimental mainnet and stagenet

The Android APK now uses an on-device Expo/Kotlin module calling
`MrCyjaneK/monero_c v0.18.4.6-RC2` through JNA. Android does **not** use the
simulated WalletContext: Metro selects `WalletContext.android.tsx`.
Missing native code fails closed, including in Expo Go. The browser preview
and the separate `monero2014-web` application remain separate.

## Download and install

1. In GitHub Actions open **Native Android APK**, on the native-engine branch
   or the pull request, and open its latest run.
2. Download **monero2014-wallet-apk-N** under Artifacts and unzip it.
3. Verify `SHA256SUMS`, then install `monero2014-wallet.apk` on Android 8+
   with ARM64 or x86_64. Allow installing from that source when Android asks.
   Alternatively: `adb install -r monero2014-wallet.apk`.
4. No Expo Go, Metro server, EAS account or JavaScript export is required.
   The app includes native libraries and its bundled application.

Package: `com.monero2014.wallet.stagenet` (retained for in-place upgrades).
Install over the previous build; **do not uninstall** without an offline backup.
This is a standalone release-mode
build signed with the standard Android **development key**, not a production
signing identity. Do not publish it as a production wallet. Artifacts expire
after 14 days. A successful compile is not proof of funded-transfer behavior.

## Implemented native path

- Fresh 16-word Polyseed generation and native 16/25-word restoration with a
  restore height. A year/month helper provides a conservative estimated starting
  height, or scan from genesis if unsure. Word dictionaries flag unknown entries
  on blur; the native engine performs final phrase/checksum validation.
  Backup words stay in transient setup state, never logs, AsyncStorage, server
  requests or build artifacts. Explicit Copy is available with a clipboard risk
  notice and a best-effort 60-second conditional clear while the process survives.
- Monero-encrypted wallet files in Android's no-backup directory, protected
  with random 256-bit passwords wrapped with a non-exportable AES-GCM Android
  Keystore key. Public account metadata is separate. App PIN is an additional
  UI authorization gate, not the wallet encryption password.
- New UI-created wallets use mainnet without repetitive network labels.
  Network is stored per wallet; old wallets default to stagenet and are never
  silently converted. Existing test wallets retain a "not for real deposits"
  marker; it would be unsafe to relabel them as real wallets.
- Real addresses/subaddresses, native balances and unlocked balances,
  native transaction history, daemon connection and on-device blockchain scans.
  Simulation credits and fake block advancement are rejected on Android.
- Native transaction construction/signing and actual-fee review. Confirmation
  does not ask for an extra PIN in an already unlocked session; it commits the retained transaction,
  not a reconstructed payment. A one-use token prevents duplicate confirmation.
- Before broadcast, persist a public transaction hash. A timeout/error retains
  an uncertain-outcome warning and blocks subsequent sends; never automatically
  retry. Chain inclusion (at least one real confirmation) can clear that warning.
  There is deliberately no unsafe "clear and retry" button.
- Node configuration under **Security & Privacy → Nodes & Tor**. Original onboarding,
  recovery-word grid and icon/name customization use real native wallet data.
- PIN/password checks use Android PBKDF2-SHA256, preserving the existing
  verifier format, NFKC normalization, salt and 60,000-iteration work factor.
- Recovery re-reveal and private-view-key display require PIN/password approval;
  recovery copy is explicit, warned, and conditionally cleared; private view keys
  are not copied by the app. Neither is exported to servers.
- Native charts request validated public CoinGecko observations directly,
  with real Kraken candle observations as a fallback. No hosted API configuration
  is required for Android. Missing prices are not invented. Display currencies
  include USD/EUR/GBP/CHF/INR; Hindi suggests INR for a new wallet, but language
  and currency can be changed independently.
- Tor mode requires separately installed Orbot, SOCKS5 on 127.0.0.1:9050 and a
  user-supplied v3 onion daemon. Native wallet connections use that proxy only,
  reject public nodes and never silently fall back. Price requests are aborted
  and disabled in Tor mode (no direct market DNS or HTTP fallback). This is NOT
  an embedded Tor service or a device-wide VPN. A successful onion session has
  not yet been exercised end to end; instrumentation checks fail-closed behavior.
- Auto-lock defaults to five minutes of inactivity, including background time.
  Disable it to keep the session until process death. Five incorrect attempts
  trigger 1 minute, then 5 minutes, then 1 hour, cycling; correct unlock resets.
- An optional destruction secret is off by default, requires current-secret
  approval and a backup warning to configure. Entering it on the lock screen
  deletes ALL local wallets/keys. It cannot erase the blockchain, external copies
  or guarantee secure flash erasure. Do not test it on funded accounts.
- QR payment scanning is permission-gated. Max fills an actual engine-quoted
  amount after fee; fiat entry converts with integer atomic arithmetic. The
  final review always shows exact XMR amounts and fees.
- Main balances stay Pending until scans finish, pending incoming funds appear
  separately, history is newest-first, and confirmation counts come from the
  native wallet. Time-to-confirm is an estimate based on two-minute blocks,
  never a promise. The app cannot accelerate Monero's confirmation rules.
- Screenshots are blocked, OS backup is disabled, and wallets close when the
  app backgrounds. Native networking is blocked until foreground resume, even
  if stale JavaScript work remains queued. No background mining or foreground
  service is added. Rooted/compromised devices remain outside these protections.

## Build and verification

`Native Android APK` installs locked pnpm dependencies, runs typechecks and
existing regression tests, verifies a pinned native-engine archive SHA-256,
generates the Android project, and runs Gradle `:app:assembleRelease`.
It checks the APK for both native ABIs, JNA loaders, DEX, Android manifest and
bundled frontend, then verifies its APK signature before uploading it.

An Android emulator instrumentation step exercises the actual native engine
offline: Polyseed creation, encrypted file persistence, close/reopen,
restore-to-same-address, subaddresses, mainnet/stagenet isolation, secret display,
native PIN compatibility/timing, no-send-before-sync and HTTPS rejection.
That does not replace real device/network testing.

Local reproduction, using Node 24.22.1, pnpm 10.26.1, JDK 17 and Android SDK:

```sh
pnpm install --frozen-lockfile
pnpm exec tsc --build lib/api-client-react
pnpm --filter @workspace/monero2014 run typecheck
python3 scripts/fetch-monero-engine.py
cd artifacts/monero2014
pnpm exec expo prebuild --platform android --clean --no-install
cd android
./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a,x86_64 -Pandroid.enableMinifyInReleaseBuilds=false
```

## Before any mainnet release

### Username-only reporting (1.3.2)

Three app files: `UsernameReporter.kt` in the engine's Java package, plus
`username-reporting.json` and `username-public.pem` in
`modules/monero-engine/android/src/main/assets/`.
Edit the PEM directly in GitHub to change the username-reporting public key:
it is an SPKI PEM RSA public key (2048–4096 bits). The supplied 3072-bit public
key is bundled; no private key is present. In the JSON, `public_key_file` selects
that asset, while `receiver_url` is your public HTTPS relay endpoint ending in
`/api/username-report`, without credentials/query parameters. Set `enabled`
only after setup. It remains false and the receiver URL is empty.
Rebuild the APK after editing. No operator page or seed-key setting is added.
Never put your private key, AES key or private webhook URL in either public
file. The regression checks allow
valid custom public keys/relay URLs and reject an incomplete enabled setup.

The existing API server's single new `src/routes/username-report.ts` relay keeps
`USERNAME_REPORT_WEBHOOK_URL` in server Secrets, not GitHub or the APK. Set
`USERNAME_REPORT_LEDGER_DIR` to an absolute private persistent directory outside
the web root. Use one worker with this file ledger; multiple workers need a
shared transactional store. No live webhook is configured or called by tests.

After a new mainnet wallet is named on the one disclosure screen, an encrypted
report copy is saved privately in `noBackupFilesDir/username-reports/ID.json`.
Original wallet catalog/name storage and seed protection are unchanged. Renames
do not recreate it, and upgrades don't backfill reports for existing accounts.
Deleting a wallet deletes its queued report. Restored wallets with historical
receipts can qualify: this is an activated-wallet-installation count, not unique
people or independently verified proof of funding.

Exactly four JSON fields: `encrypted_aes_key`, `event` (`new_user`), `timestamp`
(UTC record-creation time in the sample's `yyyy-MM-dd'T'HH:mm:ss` format, without
a suffix), `username`. Each report uses a fresh random 32-byte
AES key, AES-256-GCM with no AAD, and a random 12-byte IV. `username` is padded
Base64 of **IV (12 bytes) || ciphertext || GCM tag (16 bytes)**.
`encrypted_aes_key` is padded Base64 RSA-OAEP/SHA-256 with MGF1/SHA-256 over the
AES key. The server's private key never enters the app. Field names alone do not
establish compatibility with an existing decoder; its AES/RSA/packing settings
must match. The user's existing offline decoder has not been inspected/tested.
No recovery phrase, address, amount or transaction ID is included.

The first positive confirmed incoming mainnet transaction qualifies only after
full scanning. Sending requires foreground/unlocked operation and pauses with
Tor enabled (no direct fallback). After acknowledgement, the local wallet is
marked reported; otherwise its same saved JSON retries with a one-minute
per-process cooldown (restarts can retry sooner). A short-lived worker handles
HTTP so analytics cannot block the native wallet queue. Requests already
dispatched may finish when the app locks/backgrounds.
Receiver-side deduplication is still needed after network ambiguity: the relay
sends SHA-256 of canonical four-field JSON as the `Idempotency-Key` header,
without adding a JSON field. Keep old private keys for existing encrypted files
when rotating your public key. Timing, size and connection metadata remain
observable. A fully offline decryptor needs records transferred from an online
receiver. Review consent, retention, abuse controls and store declarations before
enabling this in a public release.

No audit or production readiness is claimed. Test funded **stagenet** receipt,
unlocking, fee review, successful broadcast and confirmation, loss of network,
backgrounding, interruption during writes, wrong PINs, full uninstall/restore,
and repeated create/delete cycles on physical devices. The upstream C API does
not expose transaction disposal; repeated draft creation needs memory profiling
and upstream cleanup support before production. Native file-write atomicity and
corruption recovery need fault-injection testing. This build enables experimental
mainnet at the user's request; a successful build and offline tests are **not**
evidence of funded mainnet receipt, send, confirmation or production readiness.

Complete the native license/notice inventory and supply-chain review described
in `modules/monero-engine/THIRD-PARTY.md`. Use a privately managed production
signing identity only through a secrets flow, never source control or chat.
Do not treat this as a production wallet before independent wallet-security
review and device acceptance criteria pass. Never use a funded recovery phrase
in automated tests.

## Version 1.3 usability and node update

Mainnet now defaults to `https://xmr-node.cakewallet.com:18081`, with
`https://node.monerodevs.org:18089` and `https://node.sethforprivacy.com`
as explicit alternatives. These operators are present in Feather's published
node list at commit `f43b8de3d59d2c31592903140172e224b358130e`
(`src/assets/nodes.json`). HTTPS endpoints were independently checked for valid
TLS, synchronized mainnet status and matching heights on 2026-11-13. The
Seth HTTPS endpoint uses port 443 rather than the self-signed endpoint on 18089.
Availability and list inclusion do not establish operator trust. The engine
continues to treat public daemons as untrusted. No Feather source algorithm was
copied and no automatic multi-operator probing, quorum or failover is claimed.

The old built-in Nodely mainnet URL is migrated once. Other custom endpoints and
onion configurations are retained, as are wallet network and installation data.
Later explicit custom choices are not repeatedly overridden. Plowsof and
Rucknium onion presets also come from Feather's list; live onion connectivity
has not been verified. Orbot remains required, and Tor never falls back direct.

Restore planning uses a broad assumed 40–400 blocks/second range until an actual
device scan has been measured. This is an explicitly labelled planning
assumption, not a benchmark, per-year promise or guaranteed upper bound.
Previously measured rates are used only for seven days and retain a wide
uncertainty range. Live estimates exclude initial height fast-forwarding, need
30 seconds of measured progress after warm-up, use a rolling two-minute window,
reset between wallets/nodes/resumes, and show waiting after 45 seconds without
progress. Completed scans clear their ETA. Block density, networking and Tor
can put a real scan outside any preliminary range.

Wallet switching reuses the unlocked session and checks it again at execution;
it does not bypass the app lock. Deletion, secret export and security changes
retain their separate authorization. Recent Activity opens full history.

The exchange guide links to SimpleSwap and ChangeNOW without affiliate codes,
wallet addresses, embedded trading, or transmission of secrets. Monero's
Merchants & Exchanges page lists both, but explicitly disclaims endorsement.
The guide says so, warns about fees, country/verification requirements and
recovery phrases, and confirms before opening an external browser. Wallet Tor
settings do not apply to that browser. Tutorial step three opens this guide
and persists the resume point so returning continues to step four. Store
declarations and regional rules must accurately reflect these external links.
