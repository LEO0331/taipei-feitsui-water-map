import assert from 'node:assert/strict';
import test from 'node:test';
import { spreadsheetCsvCell } from '../src/utils/csvExport';

test('spreadsheet export preserves signed measurements and raw qualifiers', () => {
  for (const cell of [-12.5, '-1,045,000', '-0.5E+1', '+2', '-3 立方公尺', '-1 ℃', 'ND', '<10', '-', '－', '']) {
    assert.equal(spreadsheetCsvCell(cell), `"${cell}"`);
  }
  assert.equal(spreadsheetCsvCell(null), '""');
});

test('spreadsheet export forces formula-like strings to text and escapes cell boundaries', () => {
  for (const cell of ['=1', ' +A1', '-2+3', '@A1', '\uFEFF＝1', '＋A1', '－A1', '＠A1', '\tplain', '\rplain', '\nplain']) {
    assert.equal(spreadsheetCsvCell(cell), `"'${cell}"`);
  }
  assert.equal(spreadsheetCsvCell('臺北,"水質"\r\n站'), '"臺北,""水質""\r\n站"');
});
