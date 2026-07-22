import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { addSurveyWarnings, buildReservoirSedimentationSurveySummary, parseNumber, parseSurveyDateRange } from '../src/utils/reservoirSedimentationSurvey';
import type { ReservoirSedimentationSurveyRecord } from '../src/types/reservoirSedimentationSurvey';

// Official Feitsui Reservoir Administration table, checked 2026-07-22. Values are thousand m³ in the source.
const rows = `初期|---|||406000||||
1|73.07-78.03|4.75|4.75|400028|5972|5972|1257|1.47
2|78.04-78.12|0.75|5.5|399007|1021|6993|1271|1.72
3|79.01-79.12|1|6.5|398037|970|7963|1225|1.96
4|80.01-80.12|1|7.5|397056|981|8944|1193|2.20
5|81.01-81.12|1|8.5|396092|964|9908|1166|2.44
6|82.01-82.12|1|9.5|395686|406|10314|1086|2.54
7|83.01-83.12|1|10.5|394797|889|11203|1067|2.76
8|84.01-84.12|1|11.5|394311|486|11689|1016|2.88
9|85.01-85.12|1|12.5|390835|3476|15165|1213|3.74
10|86.01-86.12|1|13.5|390058|777|15942|1181|3.93
11|87.01-87.12|1|14.5|388680|1378|17320|1194|4.27
12|88.01-88.12|1|15.5|388196|484|17804|1149|4.39
13|89.01-89.12|1|16.5|387356|840|18644|1130|4.59
14|90.01-90.12|1|17.5|386003|1353|19997|1143|4.93
15|91.01-91.12|1|18.5|385535|468|20465|1106|5.04
16|92.01-92.12|1|19.5|385320|215|20680|1061|5.09
17|93.01-93.12|1|20.5|384947|373|21053|1027|5.19
18|94.01-94.12|1|21.5|384596|351|21404|996|5.27
19|95.01-95.12|1|22.5|383921|675|22079|981|5.44
20|96.01-96.12|1|23.5|383577|344|22423|954|5.52
21|97.01-97.12|1|24.5|383207|370|22793|930|5.61
22|98.01-98.12|1|25.5|382871|336|23129|907|5.70
23|99.01-99.12|1|26.5|382530|341|23470|886|5.78
24|100.01-100.12|1|27.5|382237|293|23763|864|5.85
25|101.01-101.12|1|28.5|381883|354|24117|846|5.94
26|102.01-102.12|1|29.5|381551|332|24449|829|6.02
27|103.01-103.12|1|30.5|381136|415|24864|815|6.12
28|104.01-104.12|1|31.5|380571|565|25429|807|6.26
29|105.01-105.12|1|32.5|380039|532|25961|799|6.39
30|106.01-106.12|1|33.5|379737|302|26263|784|6.47
31|107.01-107.12|1|34.5|379461|276|26539|769|6.54
32|108.01-108.12|1|35.5|379115|346|26885|757|6.62
33|109.01-109.12|1|36.5|378861|254|27139|744|6.68
34|110.01-110.12|1|37.5|378556|305|27444|732|6.76
35|111.01-111.12|1|38.5|378179|377|27821|723|6.85
36|112.01-112.12|1|39.5|377945|234|28055|710|6.91
37|113.01-113.12|1|40.5|377605|340|28395|701|6.99
38|114.01-114.12|1|41.5|377333|272|28667|691|7.06`;
const records = rows.split('\n').map((line): ReservoirSedimentationSurveyRecord => {
  const [period, range, interval, cumulative, capacity, sediment, cumulativeSediment, annual, rate] = line.split('|');
  const dates = parseSurveyDateRange(range);
  const sourceValues = { '期別': period, '起訖年月': range, '間隔(年)': interval, '累計間隔(年)': cumulative, '剩餘總蓄水容量(千立方公尺)': capacity, '淤積量(千立方公尺)': sediment, '歷年累計淤積量(千立方公尺)': cumulativeSediment, '歷年累計年平均淤積量(千立方公尺)': annual, '歷年累計淤積率(%)': rate };
  const record: ReservoirSedimentationSurveyRecord = { id: `${period}-${dates.endDate ?? range}-${capacity}`, surveyPeriodRaw: period, surveySequence: /^\d+$/.test(period) ? Number(period) : null, dateRangeRaw: range, ...dates, intervalYears: parseNumber(interval), cumulativeIntervalYears: parseNumber(cumulative), remainingStorageCapacityCubicMeters: parseNumber(capacity) === null ? null : parseNumber(capacity)! * 1000, sedimentationVolumeCubicMeters: parseNumber(sediment) === null ? null : parseNumber(sediment)! * 1000, cumulativeSedimentationVolumeCubicMeters: parseNumber(cumulativeSediment) === null ? null : parseNumber(cumulativeSediment)! * 1000, cumulativeAverageAnnualSedimentationCubicMeters: parseNumber(annual) === null ? null : parseNumber(annual)! * 1000, cumulativeSedimentationRatePercent: parseNumber(rate, true), sourceValues, warnings: [] };
  record.warnings = addSurveyWarnings(record);
  return record;
});
const output = path.join(process.cwd(), 'public/data/reservoir-sedimentation-surveys');
await mkdir(output, { recursive: true });
await writeFile(path.join(output, 'records.json'), `${JSON.stringify(records, null, 2)}\n`);
await writeFile(path.join(output, 'summary.json'), `${JSON.stringify(buildReservoirSedimentationSurveySummary(records), null, 2)}\n`);
await writeFile(path.join(output, 'conversion-report.json'), `${JSON.stringify({ officialDataset: '臺北翡翠水庫淤積調查報告', datasetUrl: 'https://data.taipei/dataset/detail?id=8c4511a5-ea23-4978-b448-8cc91cdfe842', checkedAt: '2026-07-22', sourceUnit: 'thousand cubic metres', recordCount: records.length, notes: ['Source values are preserved in sourceValues.', 'This survey dataset is separate from operational storage data and has no map markers.'] }, null, 2)}\n`);
console.log(`Converted ${records.length} reservoir sedimentation survey records.`);
