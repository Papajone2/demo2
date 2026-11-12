import importlib.util
from pathlib import Path
import tempfile
import unittest
import zipfile

spec = importlib.util.spec_from_file_location("apk", Path(__file__).parents[1] / "check-android-apk.py")
apk = importlib.util.module_from_spec(spec)
spec.loader.exec_module(apk)


class ApkValidationTests(unittest.TestCase):
    def test_javascript_export_is_not_an_apk(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "fake.apk"
            with zipfile.ZipFile(path, "w") as archive:
                archive.writestr("index.js", "export default {}")
            with self.assertRaisesRegex(ValueError, "AndroidManifest"):
                apk.verify(path)

    def test_both_native_engines_and_loaders_are_required(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "test.apk"
            with zipfile.ZipFile(path, "w") as archive:
                for name in ("AndroidManifest.xml", "classes.dex", "assets/index.android.bundle"):
                    archive.writestr(name, b"test")
                for abi in ("arm64-v8a", "x86_64"):
                    archive.writestr(f"lib/{abi}/libmonero_wallet2_api_c.so", b"\x7fELFtest")
                    archive.writestr(f"lib/{abi}/libjnidispatch.so", b"\x7fELFtest")
            self.assertEqual(64, len(apk.verify(path)))


if __name__ == "__main__":
    unittest.main()
