import type { LanguageCode } from '@/lib/languages';
import de from './de';
import es from './es';
import fr from './fr';
import hi from './hi';
import ja from './ja';
import ko from './ko';
import pt from './pt';
import ru from './ru';
import tr from './tr';
import zhHans from './zh-Hans';

/** English is the source language: keys are the English strings themselves. */
export const CATALOGS: Record<LanguageCode, Readonly<Record<string, string>> | null> = {
  en: null, es, de, fr, pt, ru, 'zh-Hans': zhHans, ja, ko, tr, hi,
};
