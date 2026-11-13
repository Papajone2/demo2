import dictionaries from './mnemonic-words.json';
const normalize = (word: string) => word.trim().normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
const words = {
  16: new Set(dictionaries['16'].map(normalize)),
  25: new Set(dictionaries['25'].map(normalize)),
};
/** Dictionary check only. The native engine still verifies the complete checksum. */
export function validMnemonicWord(word: string, count: 16 | 25) {
  const value = normalize(word);
  if (words[count].has(value)) return true;
  // Monero accepts unambiguous language-dependent word prefixes.
  return value.length >= 3 && [...words[count]].some(w => w.startsWith(value));
}
