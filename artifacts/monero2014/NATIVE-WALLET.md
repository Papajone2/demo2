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
