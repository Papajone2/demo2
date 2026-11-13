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
    notices = DEST.parent / "assets/native-licenses"
    notices.mkdir(parents=True, exist_ok=True)
    # Bundle the direct native-library notices inside the APK, not just in CI.
    sources = {
        "monero_c-LGPL3.txt": ("https://raw.githubusercontent.com/MrCyjaneK/monero_c/3bfb3856a838f2bf6b729501837bb0295dedf25d/LICENSE",
                              "e3a994d82e644b03a792a930f574002658412f62407f5fee083f2555c5f23118"),
        "monero-BSD3.txt": ("https://raw.githubusercontent.com/monero-project/monero/dbcc7d212c094bd1a45f7291dbb99a4b4627a96d/LICENSE",
                           "c2fe351163f4e0cee45d38e9481f2ea60f3cb77b24f818c4a2c740383f2f4cb2"),
        "GPL3.txt": ("https://www.gnu.org/licenses/gpl-3.0.txt",
                     "3972dc9744f6499f0f9b2dbf76696f2ae7ad8af9b23dde66d6af86c9dfb36986"),
        "JNA-LICENSE.txt": ("https://raw.githubusercontent.com/java-native-access/jna/5.18.1/LICENSE",
                            "07c938b23950ab7d47a24ef35f9f5da3a05ae164278dc959ad6994135ed59ff1"),
        "JNA-Apache2.txt": ("https://raw.githubusercontent.com/java-native-access/jna/5.18.1/AL2.0",
                           "0d542e0c8804e39aa7f37eb00da5a762149dc682d7829451287e11b938e94594"),
    }
    for name, (url, expected) in sources.items():
        with urllib.request.urlopen(url, timeout=60) as response:
            data = response.read()
        if hashlib.sha256(data).hexdigest() != expected:
            raise SystemExit(f"License checksum mismatch: {name}")
        (notices / name).write_bytes(data)
    (notices / "SOURCE.txt").write_text(
        "Native Monero source, revisions, patches and build recipes:\n"
        "https://github.com/MrCyjaneK/monero_c/tree/3bfb3856a838f2bf6b729501837bb0295dedf25d\n"
        "Source archive (initialize the submodules at the recorded revisions):\n"
        "https://github.com/MrCyjaneK/monero_c/archive/3bfb3856a838f2bf6b729501837bb0295dedf25d.tar.gz\n"
        "Shared libraries are dynamically packaged; this test APK uses the public Android debug signing identity.\n"
    )


if __name__ == "__main__":
    main()
