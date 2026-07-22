import type { Language } from '../data/i18n';

/** Select a localized inline string without coupling panels to translation keys. */
export const localize = (language: Language, zh: string, en: string) => language === 'zh' ? zh : en;
