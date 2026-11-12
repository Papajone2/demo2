#!/usr/bin/env python3
"""Fetch a pinned engine, verify bytes BEFORE extracting only the required ABIs."""
import hashlib
import os
from pathlib import Path
import urllib.request
import zipfile

TAG = "v0.18.4.6-RC2"
SHA256 = "94ae3d99f878d1e392b9c49d4c5431e4d0b7780c6177081df5369d05e68cea70"
URL = f"https://github.com/MrCyjaneK/monero_c/releases/download/{TAG}/release-bundle.zip"
ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "artifacts/monero2014/modules/monero-engine/android/src/main/jniLibs"
ARCHIVE = Path(os.environ.get("MONERO_ENGINE_ARCHIVE", ROOT / ".cache/monero-engine.zip"))


def main():
    if not ARCHIVE.exists():
        ARCHIVE.parent.mkdir(parents=True, exist_ok=True)
        temporary = ARCHIVE.with_suffix(".partial")
        urllib.request.urlretrieve(URL, temporary)
        temporary.replace(ARCHIVE)
    with ARCHIVE.open("rb") as stream:
        digest = hashlib.file_digest(stream, "sha256").hexdigest()
    if digest != SHA256:
        raise SystemExit("Native engine checksum mismatch; refusing to package.")
    with zipfile.ZipFile(ARCHIVE) as archive:
        for upstream, abi in (("aarch64-linux-android", "arm64-v8a"), ("x86_64-linux-android", "x86_64")):
            data = archive.read(f"{TAG}/{upstream}/libmonero_wallet2_api_c.so")
            if not data.startswith(b"\x7fELF"):
                raise SystemExit("Expected ELF shared library")
            target = DEST / abi / "libmonero_wallet2_api_c.so"
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
            print(f"Verified native Monero engine: {abi}, {len(data)} bytes")


if __name__ == "__main__":
    main()
