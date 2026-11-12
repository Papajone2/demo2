# monero2014 wallet

Android-first Monero wallet interface, with a separate browser stagenet wallet
and supporting market-data/public-daemon API.

## Current implementation

- `artifacts/monero2014`: the existing React Native/Expo interface, now with an
  Android-only native Monero module and stagenet wallet provider. Browser
  previews still simulate wallet operations.
- `artifacts/monero2014-web`: separate browser wallet using `monero-ts` on
  stagenet. It is not the native Android implementation.
- `artifacts/api-server`: market-data endpoints and an allowlisted public
  daemon relay. Never send recovery phrases or private wallet keys to it.
- `lib`: shared API contracts, clients and libraries.

## Verification

Use Node 24.22.1 and pnpm 10.26.1:

```sh
pnpm install --frozen-lockfile
pnpm exec tsc --build lib/api-client-react
pnpm --filter @workspace/monero2014 run typecheck
node --experimental-strip-types --test artifacts/monero2014/lib/*.test.mjs
```

The **Android bundle checks** GitHub action runs those checks and exports
Android JavaScript. Its downloadable artifact is **not an installable APK**.
It does not demonstrate native-engine functionality or mainnet readiness.

The optional repository variable `API_DOMAIN` supplies the API hostname
(without `https://`) when exporting the bundle. It must point to an actual
deployed API before using remote market data. Never put secrets in an
`EXPO_PUBLIC_` variable.

## Native Android APK

See [`NATIVE-WALLET.md`](artifacts/monero2014/NATIVE-WALLET.md).
The separate **Native Android APK** workflow compiles a standalone, test-signed
APK with `monero_c`, encrypted wallet-file lifecycle, 16-word Polyseed,
25-word restoration, native scanning, subaddresses and transaction review/
signing/broadcast. Download its APK artifact, not the JavaScript-check artifact.
Mainnet remains disabled. Device/network acceptance testing and independent
security review remain required; this is not a production wallet.

No recovery phrases, wallet files, signing credentials or private keys belong
in source control or build logs.
