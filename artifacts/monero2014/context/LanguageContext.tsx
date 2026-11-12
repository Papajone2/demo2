import * as Localization from 'expo-localization';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import AppStorage from '@/lib/app-storage';
import { isLanguageCode, LANGUAGE_STORAGE_KEY, type LanguageCode, resolveDeviceLanguage, SUPPORTED_LANGUAGES } from '@/lib/languages';
import { CATALOGS } from '@/locales';

type Values = Record<string, string | number>;
/** Marks a string literal as translatable source copy (translated later with t()). */
export const msg = (s: string) => s;

export function interpolate(s: string, v?: Values) {
  return v ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in v ? String(v[k]) : m)) : s;
}

type Ctx = {
  language: LanguageCode;
  languageName: string;
  /** Applies immediately; rejects only if persisting the choice failed. */
  setLanguage: (code: LanguageCode) => Promise<void>;
  t: (source: string, values?: Values) => string;
};

const translate = (lang: LanguageCode) => (source: string, values?: Values) => {
  const cat = CATALOGS[lang];
  return interpolate((cat && cat[source]) || source, values);
};

const LanguageContext = createContext<Ctx>({
  language: 'en', languageName: 'English', setLanguage: async () => {}, t: translate('en'),
});

function deviceLanguage(): LanguageCode {
  try {
    const tags = Localization.getLocales().map((l) => l.languageTag).filter((x): x is string => !!x);
    return resolveDeviceLanguage(tags);
  } catch {
    return 'en';
  }
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLang] = useState<LanguageCode | null>(null);
  useEffect(() => {
    let live = true;
    (async () => {
      let stored: string | null = null;
      try { stored = await AppStorage.getItem(LANGUAGE_STORAGE_KEY); } catch { stored = null; }
      if (live) setLang(isLanguageCode(stored) ? stored : deviceLanguage());
    })();
    return () => { live = false; };
  }, []);

  const setLanguage = useCallback(async (code: LanguageCode) => {
    setLang(code);
    await AppStorage.setItem(LANGUAGE_STORAGE_KEY, code);
  }, []);

  const value = useMemo<Ctx | null>(() => language ? {
    language,
    languageName: SUPPORTED_LANGUAGES.find((l) => l.code === language)?.name ?? 'English',
    setLanguage,
    t: translate(language),
  } : null, [language, setLanguage]);

  if (!value) return <View style={{ flex: 1, backgroundColor: '#0B0B0B' }} />;
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}
