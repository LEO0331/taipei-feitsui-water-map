import type { Language } from '../data/i18n';

/** Select a localized inline string without coupling panels to translation keys. */
export const localize = (language: Language, zh: string, en: string) => language === 'zh' ? zh : en;

export function formatNumber(value: number | null | undefined, unit = '', digits = 1) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  const fixed = value.toFixed(digits);
  const formatted = fixed.includes('.') ? fixed.replace(/0+$/, '').replace(/\.$/, '') : fixed;
  return `${formatted}${unit ? ` ${unit}` : ''}`;
}
