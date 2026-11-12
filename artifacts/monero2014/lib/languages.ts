/** Device-local language selection; no network or location lookup is involved. */
export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'de', name: 'Deutsch' },
  { code: 'fr', name: 'Français' },
  { code: 'pt', name: 'Português' },
  { code: 'ru', name: 'Русский' },
  { code: 'zh-Hans', name: '简体中文' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
  { code: 'tr', name: 'Türkçe' },
  { code: 'hi', name: 'हिन्दी' },
] as const;

export type LanguageCode = typeof SUPPORTED_LANGUAGES[number]['code'];
export const LANGUAGE_STORAGE_KEY = 'm2014.language.v1';

export function isLanguageCode(value: unknown): value is LanguageCode {
  return SUPPORTED_LANGUAGES.some(language => language.code === value);
}

/** Use the user's first preferred locale, falling back to English if unsupported. */
export function resolveDeviceLanguage(tags: readonly string[]): LanguageCode {
  const tag = (tags[0] ?? '').trim().replace(/_/g, '-').toLowerCase();
  const [language, ...subtags] = tag.split('-');
  if (language === 'zh') {
    if (subtags.includes('hant')) return 'en';
    if (subtags.includes('hans')) return 'zh-Hans';
    // Do not silently present simplified Chinese to traditional-Chinese users.
    if (subtags.some(part => ['tw', 'hk', 'mo'].includes(part))) return 'en';
    return 'zh-Hans';
  }
  return isLanguageCode(language) ? language : 'en';
}
