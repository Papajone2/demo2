# monero2014 wallet: test release boundaries

This website is a **stagenet development test**, not a mainnet wallet or a Play Store release. Stagenet coins have no monetary value; displayed fiat conversions are market reference values only.

## Data and behavior

- A browser WASM `monero-ts` engine creates and restores genuine standard 25-word stagenet wallets. It scans the chain, derives accounts/subaddresses, constructs transactions, and signs on the device.
- Keys, the internal wallet password, and scan caches are encrypted locally using AES-GCM-256, random nonces, and PBKDF2-SHA256 (310,000 iterations). Decryption keys are non-extractable Web Crypto keys. Wallet names and creation dates are unencrypted metadata.
- IndexedDB transaction completion is awaited before reporting saves. A user can explicitly choose a separate in-memory test session if browser storage is blocked; it disappears when the page closes.
- The server supplies public market prices and an allowlisted stagenet daemon relay. It is not a wallet RPC server and does not receive recovery phrases, wallet files, or spend/view keys.
- The relay node sees normal Monero daemon requests, including broadcast transactions and scanning metadata. It is not a trustless or anonymity guarantee. The configured public stagenet node is reached from the server over HTTP. The browser-to-website connection must use HTTPS.
- Market information comes from CoinGecko. Fonts and wallet worker files are self-hosted. There are no advertising, seed-collection, mining, or exchange/swap features in application code. Development-only Replit tooling is not part of the production Vite bundle.
- There is no cloud recovery. Recovery phrases must be backed up by the user. A forgotten password cannot be reset by an operator.
- Never enter a mainnet phrase. Monero phrases alone do not identify a network; the application cannot detect that a user has reused a real mainnet seed.

## Still required before Android/mainnet release

1. Integrate a supported Android wallet engine and verify real 16-word Polyseed generation/restoration. The Expo native application remains a local simulation.
2. Implement encrypted native vault storage backed by Android Keystore; choose a secure design for the requested short PIN unlock (not merely a PIN verifier around unencrypted keys).
3. Independently review wallet cryptography, supply-chain dependencies, transaction flow, backup restoration, interruption recovery, device loss, network failures, and privacy claims.
4. Verify funded stagenet incoming and outgoing transactions, fee accuracy, confirmation handling, repeated sends, insufficient unlocked funds, multiple wallet recovery, and long syncs on physical Android devices.
5. Build and sign a release AAB, configure the final Android target/API levels and signing custody, and complete applicable Play testing requirements.
6. Publish an accurate privacy policy on monero2014.com covering actual operator practices; finish Play Data safety, Financial features, app-content declarations and any applicable jurisdictional requirements.
   Google's current declaration includes an additional option for non-custodial software wallets; select it only if the final release qualifies. Do not assume every wallet needs an exchange license, or that this option replaces local legal requirements.
7. Verify all third-party licenses and retain required attribution, including monero-ts and its Monero engine dependencies.

Google Play approval cannot be promised or achieved by concealing cryptocurrency behavior. Reference policies:

- https://support.google.com/googleplay/android-developer/answer/16329703
- https://support.google.com/googleplay/android-developer/answer/13849271

Run local encryption and amount regression checks from the workspace root:

`node --experimental-strip-types --test scripts/src/wallet-security.test.mjs`
