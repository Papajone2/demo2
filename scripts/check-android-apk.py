#!/usr/bin/env python3
"""Fail if the output is a JS export, an incomplete APK, or lacks native ABIs."""
import hashlib
import json
from pathlib import Path
import sys
import zipfile


def verify(path):
    with zipfile.ZipFile(path) as apk:
        names = set(apk.namelist())
        for name in ("AndroidManifest.xml", "classes.dex", "assets/index.android.bundle",
                     "lib/arm64-v8a/libmonero_wallet2_api_c.so",
                     "lib/x86_64/libmonero_wallet2_api_c.so"):
            if name not in names:
                raise ValueError(f"Missing APK entry: {name}")
        for abi in ("arm64-v8a", "x86_64"):
            if not apk.read(f"lib/{abi}/libmonero_wallet2_api_c.so").startswith(b"\x7fELF"):
                raise ValueError("Invalid native engine")
            if f"lib/{abi}/libjnidispatch.so" not in names:
                raise ValueError(f"JNA native loader missing: {abi}")
    return hashlib.sha256(path.read_bytes()).hexdigest()


if __name__ == "__main__":
    path = Path(sys.argv[1])
    digest = verify(path)
    path.with_name("SHA256SUMS").write_text(f"{digest}  {path.name}\n")
    path.with_name("build-manifest.json").write_text(json.dumps({
        "commit": __import__("os").environ.get("GITHUB_SHA"),
        "engine": "MrCyjaneK/monero_c v0.18.4.6-RC2",
        "networks": ["mainnet", "stagenet"], "signing": "Android development key; not production",
        "abis": ["arm64-v8a", "x86_64"], "apkSha256": digest,
    }, indent=2) + "\n")
    print("APK verified: Android manifest, DEX, bundled app, native Monero engine and JNA loader.")
