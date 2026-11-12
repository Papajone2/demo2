# Native dependency provenance

This experimental APK packages `libmonero_wallet2_api_c.so` for ARM64 and
x86_64 from **MrCyjaneK/monero_c v0.18.4.6-RC2**, not from an unpinned
`latest` endpoint. `scripts/fetch-monero-engine.py` verifies the full release
archive's SHA-256 before extracting the two named libraries. No binary or
wallet file is committed to this repository.

- Source and wrapper license: https://github.com/MrCyjaneK/monero_c/tree/v0.18.4.6-RC2
- Release: https://github.com/MrCyjaneK/monero_c/releases/tag/v0.18.4.6-RC2
- Monero source, patches, submodule revisions and build recipes are recorded
  by that tagged source tree. This engine includes Polyseed support.
- JNA 5.18.1: https://github.com/java-native-access/jna/tree/5.18.1
  (Apache-2.0 / LGPL-2.1-or-later dual license; use Apache-2.0).

The wrapper is LGPL-3.0-licensed; Monero is BSD-3-Clause. Bundled transitive
native dependencies have their own licenses. This file records provenance,
not a claim that a complete legal distribution review or a security audit
has been performed. Before public distribution, inventory all bundled
dependencies, include their required notices, and independently review the
prebuilt supply chain. Keep this APK limited to development/stagenet.
