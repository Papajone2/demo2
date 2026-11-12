# monero2014 wallet

Android-first Monero wallet interface, with a separate browser stagenet wallet
and supporting market-data/public-daemon API.

## Current implementation

- `artifacts/monero2014`: the approved React Native/Expo interface. Its wallet
  balances, recovery entries, synchronization and payments are simulated.
- `artifacts/monero2014-web`: separate browser wallet using `monero-ts` on
  stagenet. It is not the native Android implementation.
- `artifacts/api-server`: market-data endpoints and an allowlisted public
  daemon relay. Never send recovery phrases or private wallet keys to it.
- `lib`: shared API contracts, clients and libraries.

## Verification

Use Node 24.22.1 and pnpm 10.26.1:

```sh
pnpm install --frozen-lockfile
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

## Native Android work still required

See [`NATIVE-WALLET.md`](artifacts/monero2014/NATIVE-WALLET.md).
An Android-compatible Monero engine, 16-word Polyseed integration, encrypted
wallet-file lifecycle, real chain scanning and local transaction signing still
need implementation and device verification in a native-capable build setup.
Preserve the existing interface while implementing them. Do not remove
simulation boundaries or describe this source as a production wallet.

No recovery phrases, wallet files, signing credentials or private keys belong
in source control or build logs.
