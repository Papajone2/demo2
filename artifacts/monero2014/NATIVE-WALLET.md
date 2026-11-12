# Native Monero support

This Expo application is a local testing experience, not a production Monero wallet. Do not deposit real XMR or enter an existing recovery phrase.

The separate `monero2014-web` artifact at `/test/` uses a real browser `monero-ts` wallet engine on **stagenet**, local encrypted wallet files, and a public daemon relay. That is not a native Android integration or mainnet release. Its standard 25-word phrases are not 16-word Polyseed. Do not restore a real mainnet seed into it.

## Reference project

The requested reference, BestWalletTeam/BestMoneroWalletApp, is a C++/Qt6 desktop application using Monero's `wallet2` engine. Its desktop UI, bundled Linux Tor binary, and build configuration cannot run directly in Expo Go or on Android.

The mobile interface is an independent implementation inspired by the reference's wallet workflows. It does not claim to port its signing engine, networking, or security guarantees.

## Requirements before real funds

- Integrate an Android-compatible Monero wallet engine in a custom native application build.
- Implement and verify 16-word **Polyseed** creation and restoration through the engine. Polyseed is not a BIP39 wallet seed.
- Keep spend keys and seeds on-device, encrypted at rest. A local PIN/password screen by itself does not encrypt wallet data.
- Implement network selection, node connectivity, chain scanning, restore-height handling, subaddresses, fee estimation, transaction review, signing, broadcasting, and confirmation tracking.
- Separate the local `/test` simulation from actual Monero testnet/stagenet. Simulated test credits are not network coins.
- Integrate a genuine market-price source before describing fiat valuations as live.
- Exercise backup/restore, incorrect passwords, interruption during persistence, double-send prevention, locked balances, and network failures before release.
- Review dependency provenance, relevant license obligations, Android distribution configuration, and wallet security independently before accepting real funds.

Never route private keys or recovery phrases through a shared hosted wallet RPC service merely to make the preview functional.
