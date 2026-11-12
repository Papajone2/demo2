export type TranslationValues = Record<string, string | number>;
export function interpolate(source: string, values?: TranslationValues) {
  return values ? source.replace(/\{(\w+)\}/g, (match, key: string) => key in values ? String(values[key]) : match) : source;
}
/** Normal UI copy must never be classified as an error based on its wording. */
export function translateText(catalog: Readonly<Record<string, string>> | null, source: string, values?: TranslationValues) {
  return interpolate(catalog?.[source] || source, values);
}
