const formulaPrefix = /^[\s\p{Cc}\p{Cf}]*[=+@＝＋＠−－-]/u;
const signedNumber = /^[+-](?:(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?(?: (?:m|m3|mm|℃|%|million m3|公尺|毫米|立方公尺|百萬立方公尺))?$/;

export function spreadsheetCsvCell(value: unknown): string {
  const text = String(value ?? '');
  const isPlainValue = text === '-' || text === '－' || signedNumber.test(text);
  // CSV quoting preserves the field boundary. A text prefix also prevents formula evaluation.
  const safe = /^[\t\r\n]/.test(text) || (!isPlainValue && formulaPrefix.test(text)) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}
