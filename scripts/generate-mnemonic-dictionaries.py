"""Vendor public mnemonic wordlists, never user phrases. Run only when updating data.
Monero BSD-3-Clause; Polyseed Apache-2.0/BIP39 MIT. Retain upstream notices below.
"""
import concurrent.futures
import json
import pathlib
import re
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1] / "artifacts/monero2014/lib"
MONERO = "dbcc7d212c094bd1a45f7291dbb99a4b4627a96d"
POLYSEED = "91b0a954c98f0dbc9cadfcdcb2088ccf83b8ecb8"
files = [(25, f"https://raw.githubusercontent.com/monero-project/monero/{MONERO}/src/mnemonics/{lang}.h")
         for lang in ["chinese_simplified", "dutch", "english", "english_old", "esperanto", "french", "german", "italian", "japanese", "lojban", "portuguese", "russian", "spanish"]]
files += [(16, f"https://raw.githubusercontent.com/tevador/polyseed/{POLYSEED}/src/lang_{lang}.c")
          for lang in ["cs", "en", "es", "fr", "it", "jp", "ko", "pt", "zh_s", "zh_t"]]

def read(item):
    count, url = item
    source = urllib.request.urlopen(url, timeout=30).read().decode()
    words = re.findall(r'^\s*(?:u8)?"([^"\\]+)"\s*,?\s*$', source, re.M)
    if len(words) not in (1626, 2048):
        raise ValueError(f"Unexpected dictionary length: {url}: {len(words)}")
    notice = source[:source.index("*/") + 2]
    return count, words, url, notice

if __name__ == "__main__":
    data = {"16": [], "25": []}
    notices = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        for count, words, url, notice in pool.map(read, files):
            data[str(count)].extend(words)
            notices.append(url + "\n" + notice)
    data = {key: sorted(set(value)) for key, value in data.items()}
    (ROOT / "mnemonic-words.json").write_text(json.dumps(data, ensure_ascii=False) + "\n")
    notice_url = f"https://raw.githubusercontent.com/tevador/polyseed/{POLYSEED}/NOTICE"
    notices.append(notice_url + "\n" + urllib.request.urlopen(notice_url, timeout=30).read().decode())
    (ROOT / "MNEMONIC-NOTICES.txt").write_text("\n\n".join(notices))
