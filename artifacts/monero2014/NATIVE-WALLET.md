# Native Android wallet — experimental stagenet

The Android APK now uses an on-device Expo/Kotlin module calling
`MrCyjaneK/monero_c v0.18.4.6-RC2` through JNA. Android does **not** use the
simulated WalletContext: Metro selects `WalletContext.android.tsx`.
Missing native code fails closed, including in Expo Go. The browser preview
and the separate `monero2014-web` application remain separate.

## Download and install

1. In GitHub Actions open **Native Android APK**, on the native-engine branch
   or the pull request, and open its latest run.
2. Download **monero2014-stagenet-apk-N** under Artifacts and unzip it.
3. Verify `SHA256SUMS`, then install `monero2014-stagenet.apk` on Android 8+
   with ARM64 or x86_64. Allow installing from that source when Android asks.
   Alternatively: `adb install -r monero2014-stagenet.apk`.
4. No Expo Go, Metro server, EAS account or JavaScript export is required.
   The app includes native libraries and its bundled application.

Package: `com.monero2014.wallet.stagenet`. This is a standalone release-mode
build signed with the standard Android **development key**, not a production
signing identity. Do not publish it as a production wallet. Artifacts expire
after 14 days. A successful compile is not proof of funded-transfer behavior.

## Implemented native path

- Fresh 16-word Polyseed generation and native 16/25-word restoration with a
  restore height. Backup words stay in transient setup state, not clipboard,
  logs, AsyncStorage, server requests or build artifacts.
- Monero-encrypted wallet files in Android's no-backup directory, protected
  with random 256-bit passwords wrapped with a non-exportable AES-GCM Android
  Keystore key. Public account metadata is separate. App PIN is an additional
  UI authorization gate, not the wallet encryption password.
- Real stagenet addresses/subaddresses, native balances and unlocked balances,
  native transaction history, daemon connection and on-device blockchain scans.
  Simulation credits and fake block advancement are rejected on Android.
- Native transaction construction/signing and actual-fee review. Confirmation
  requires the existing app PIN/password; it commits the retained transaction,
  not a reconstructed payment. A one-use token prevents duplicate confirmation.
- Before broadcast, persist a public transaction hash. A timeout/error retains
  an uncertain-outcome warning and blocks subsequent sends; never automatically
  retry. Resolve uncertain outcomes manually against the node before further
  testing. There is deliberately no unsafe "clear and retry" button.
- HTTPS daemon configuration under **Real wallets**. New accounts and restores
  are added there with backup UI. Mainnet is disabled in the native module.
- Screenshots are blocked, OS backup is disabled, and wallets close when the
  app backgrounds. Rooted/compromised devices remain outside these protections.

## Build and verification

`Native Android APK` installs locked pnpm dependencies, runs typechecks and
existing regression tests, verifies a pinned native-engine archive SHA-256,
generates the Android project, and runs Gradle `:app:assembleRelease`.
It checks the APK for both native ABIs, JNA loaders, DEX, Android manifest and
bundled frontend, then verifies its APK signature before uploading it.

An Android emulator instrumentation step exercises the actual native engine
offline: Polyseed creation, encrypted file persistence, close/reopen,
restore-to-same-address, subaddresses, no-send-before-sync and HTTPS rejection.
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
corruption recovery need fault-injection testing. Recovery re-reveal and private
view-key export in the old account UI are not implemented by this bridge.

Complete the native license/notice inventory and supply-chain review described
in `modules/monero-engine/THIRD-PARTY.md`. Use a privately managed production
signing identity only through a secrets flow, never source control or chat.
Keep mainnet disabled until independent wallet-security review and device
acceptance criteria pass. Never use a funded recovery phrase in automated tests.
