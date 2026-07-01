import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Language } from './data/i18n';
import type { ClearWaterQualitySiteType, TreatmentPlantClearWaterQualityRecord, TreatmentPlantClearWaterQualitySummary, WaterQualityStandardComparison, WaterQualityTestItemCategory } from './types/clearWaterQuality';

const text = (language: Language, zh: string, en: string) => language === 'zh' ? zh : en;
const fmt = (value?: number, digits = 2) => value === undefined ? '-' : value.toLocaleString(undefined, { maximumFractionDigits: digits });
const categoryLabels: Record<Language, Record<WaterQualityTestItemCategory, string>> = {
  zh: { physical: '物理性質', chemical_general: '一般化學', disinfection: '消毒與副產物', microbiological: '微生物', organic: '有機物', metal: '金屬', volatile_organic_compound: '揮發性有機物', pesticide: '農藥相關', other: '其他', unknown: '未知' },
  en: { physical: 'Physical', chemical_general: 'General chemistry', disinfection: 'Disinfection', microbiological: 'Microbiological', organic: 'Organic', metal: 'Metal', volatile_organic_compound: 'Volatile organic compound', pesticide: 'Pesticide-related', other: 'Other', unknown: 'Unknown' },
};
const comparisonLabels: Record<Language, Record<WaterQualityStandardComparison, string>> = {
  zh: { within_standard: '符合來源標準', above_upper_limit: '高於來源上限', below_lower_limit: '低於來源下限', no_standard: '無來源標準', unparsed: '標準無法解析', unknown: '未知' },
  en: { within_standard: 'Within source standard', above_upper_limit: 'Above source upper limit', below_lower_limit: 'Below source lower limit', no_standard: 'No source standard', unparsed: 'Unparsed standard', unknown: 'Unknown' },
};
const siteTypeLabels: Record<Language, Record<ClearWaterQualitySiteType, string>> = {
  zh: { treatment_plant: '淨水場', water_source: '水源', clear_water_source: '清水水源', unknown: '未知' },
  en: { treatment_plant: 'Treatment plant', water_source: 'Water source', clear_water_source: 'Clear water source', unknown: 'Unknown' },
};

export default function ClearWaterQualityPanel({ records, summary, language }: { records: TreatmentPlantClearWaterQualityRecord[]; summary: TreatmentPlantClearWaterQualitySummary; language: Language }) {
  const [site, setSite] = useState('all'); const [siteType, setSiteType] = useState('all'); const [category, setCategory] = useState('all'); const [comparison, setComparison] = useState('all'); const [item, setItem] = useState('all'); const [search, setSearch] = useState('');
  const sites = useMemo(() => summary.bySite, [summary]);
  const items = useMemo(() => summary.byTestItem.map((row) => row.testItem).sort((a, b) => a.localeCompare(b, 'zh-Hant')), [summary]);
  const filtered = records.filter((record) => {
    if (site !== 'all' && record.siteKey !== site) return false;
    if (siteType !== 'all' && record.siteType !== siteType) return false;
    if (category !== 'all' && record.testItemCategory !== category) return false;
    if (comparison !== 'all' && record.comparisonToStandard !== comparison) return false;
    if (item !== 'all' && record.testItem !== item) return false;
    const haystack = `${record.sourcePeriodMonthKey} ${record.siteNameZh} ${record.siteNameEn} ${record.testItem} ${record.unit} ${record.testItemCategory} ${record.standardLimitRaw}`.toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  });
  const matrixItems = [...new Map(filtered.map((record) => [record.testItemKey, record])).values()].slice(0, 18);
  const selectedItem = item === 'all' ? '濁度' : item;
  const selectedItemRecords = filtered.filter((record) => record.testItem === selectedItem || (item === 'all' && record.testItemKey === 'turbidity'));
  const keyData = ['turbidity', 'ph', 'free_residual_chlorine', 'total_dissolved_solids', 'total_hardness', 'total_trihalomethanes'].flatMap((key) => (summary.keyIndicators[key] ?? []).map((point) => ({ item: key, site: records.find((record) => record.siteKey === point.siteKey)?.siteNameZh ?? point.siteKey, value: point.value })));
  return <section className="river-module">
    <div className="section-heading"><div><h2>{text(language, '各淨水場清水水質', 'Treatment Plant Clear Water Quality')}</h2><p>{text(language, '整理臺北自來水事業處各淨水場及水源清水水質資料，包含檢驗項目、單位、水質標準限值、方法偵測極限與檢測數值。', 'Explore Taipei Water Department clear-water quality data by treatment plant and water source, including test item, unit, standard limit, detection limit, and measured value.')}</p></div></div>
    <section className="filters river-filters">
      <label><span>{text(language, '淨水場或水源', 'Treatment plant / source')}</span><select value={site} onChange={(event) => setSite(event.target.value)}><option value="all">{text(language, '全部', 'All')}</option>{sites.map((row) => <option key={row.siteKey} value={row.siteKey}>{language === 'zh' ? row.siteNameZh : row.siteNameEn}</option>)}</select></label>
      <label><span>{text(language, '場站類型', 'Site type')}</span><select value={siteType} onChange={(event) => setSiteType(event.target.value)}><option value="all">{text(language, '全部', 'All')}</option>{Object.entries(siteTypeLabels[language]).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label><span>{text(language, '檢驗項目分類', 'Test item category')}</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">{text(language, '全部', 'All')}</option>{Object.entries(categoryLabels[language]).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label><span>{text(language, '檢驗項目', 'Test item')}</span><select value={item} onChange={(event) => setItem(event.target.value)}><option value="all">{text(language, '全部', 'All')}</option>{items.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label><span>{text(language, '標準比較', 'Standard comparison')}</span><select value={comparison} onChange={(event) => setComparison(event.target.value)}><option value="all">{text(language, '全部', 'All')}</option>{Object.entries(comparisonLabels[language]).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label className="search-field"><span>{text(language, '搜尋', 'Search')}</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={text(language, '搜尋檢驗項目、淨水場、水源、單位或分類', 'Search test item, treatment plant, water source, unit, or category')} /></label>
    </section>
    <section className="cards">{[
      [text(language, '資料月份', 'Data month'), summary.sourcePeriodMonthKey ?? '-'],
      [text(language, '資料收錄期間', 'Resource coverage'), `${summary.resourceCoverageStart ?? '-'} - ${summary.resourceCoverageEnd ?? '-'}`],
      [text(language, '淨水場與水源數', 'Treatment plant / source count'), summary.siteCount],
      [text(language, '檢驗項目數', 'Test item count'), summary.testItemCount],
      [text(language, '水質紀錄數', 'Water quality record count'), filtered.length],
      [text(language, '有檢測數值紀錄', 'Records with measured value'), filtered.filter((record) => record.measuredValue !== undefined).length],
      [text(language, '有標準限值紀錄', 'Records with standard limit'), filtered.filter((record) => record.hasStandardLimit).length],
      [text(language, '符合來源標準紀錄', 'Records within source standard'), filtered.filter((record) => record.comparisonToStandard === 'within_standard').length],
      [text(language, '高於上限紀錄', 'Records above upper limit'), filtered.filter((record) => record.comparisonToStandard === 'above_upper_limit').length],
      [text(language, '低於下限紀錄', 'Records below lower limit'), filtered.filter((record) => record.comparisonToStandard === 'below_lower_limit').length],
    ].map(([label, value]) => <article className="card" key={String(label)}><span>{label}</span><strong>{value}</strong></article>)}</section>
    <p className="notice-block">{text(language, '此資料為各淨水場清水水質表，未提供官方經緯度。預設以檢驗項目、淨水場或水源、標準限值與檢測數值的表格及圖表呈現，不顯示由本資料集產生的地圖點位。', 'This dataset is a treatment plant clear-water quality table and does not provide official coordinates. It is shown through tables and charts, with no map points generated from this dataset.')}</p>
    <section className="charts">
      <BarPanel title={text(language, '各場站標準比較', 'Standard comparison by site')} data={summary.bySite.map((row) => ({ name: language === 'zh' ? row.siteNameZh : row.siteNameEn, within: row.withinStandardCount, above: row.aboveUpperLimitCount, below: row.belowLowerLimitCount, noStandard: row.noStandardCount }))} bars={[['within', '#0f766e'], ['above', '#be123c'], ['below', '#c2410c'], ['noStandard', '#64748b']]} />
      <BarPanel title={text(language, '檢驗項目分類', 'Test item categories')} data={summary.byCategory.map((row) => ({ name: categoryLabels[language][row.testItemCategory], records: row.recordCount, detected: row.detectedCount }))} bars={[['records', '#2563eb'], ['detected', '#0f766e']]} />
      <BarPanel title={text(language, '重點指標', 'Key indicators')} data={keyData.filter((row) => row.value !== undefined)} bars={[['value', '#7c3aed']]} />
      <BarPanel title={`${text(language, '場站比較', 'Site comparison')} · ${selectedItem}`} data={selectedItemRecords.map((record) => ({ name: language === 'zh' ? record.siteNameZh : record.siteNameEn, value: record.measuredValue, ratio: record.standardRatio }))} bars={[['value', '#0891b2'], ['ratio', '#c2410c']]} />
    </section>
    <section className="table-panel"><h3>{text(language, '水質項目矩陣', 'Quality Matrix')}</h3><div className="table-wrap"><table><thead><tr><th>{text(language, '檢驗項目', 'Test item')}</th>{sites.map((siteRow) => <th key={siteRow.siteKey}>{language === 'zh' ? siteRow.siteNameZh : siteRow.siteNameEn}</th>)}</tr></thead><tbody>{matrixItems.map((sample) => <tr key={sample.testItemKey}><td>{sample.testItem}<br /><small>{sample.unit ?? '-'}</small></td>{sites.map((siteRow) => { const record = filtered.find((candidate) => candidate.testItemKey === sample.testItemKey && candidate.siteKey === siteRow.siteKey); return <td key={siteRow.siteKey}>{record ? <><strong>{record.measuredValueRaw ?? '-'}</strong><br /><small>{comparisonLabels[language][record.comparisonToStandard]}</small></> : '-'}</td>; })}</tr>)}</tbody></table></div></section>
    <section className="table-panel"><h3>{text(language, '資料表', 'Data Table')}</h3><div className="table-wrap"><table><thead><tr>{[text(language, '資料月份', 'Data month'), text(language, '淨水場或水源', 'Treatment plant / source'), text(language, '檢驗項目', 'Test item'), text(language, '單位', 'Unit'), text(language, '檢測數值', 'Measured value'), text(language, '水質標準限值', 'Water quality standard limit'), text(language, '方法偵測極限', 'Method detection limit'), text(language, '標準比較', 'Standard comparison')].map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{filtered.map((record) => <tr key={record.id}><td>{record.sourcePeriodMonthKey}</td><td>{language === 'zh' ? record.siteNameZh : record.siteNameEn}</td><td>{record.testItem}</td><td>{record.unit ?? '-'}</td><td title={record.isZeroReported ? text(language, '0為來源報告值，請勿過度解讀為精確無濃度。', '0 is a source-reported value and should not be over-interpreted as exact absence.') : undefined}>{record.measuredValueRaw ?? '-'}</td><td>{record.standardLimitDisplay ?? '-'}</td><td>{record.methodDetectionLimitRaw ?? '-'}</td><td>{comparisonLabels[language][record.comparisonToStandard]}</td></tr>)}</tbody></table></div></section>
    <section className="notice-block"><p>{text(language, '翡翠水庫、河川水質與清水水質資料性質不同；本模組反映淨水場或水源清水檢測結果，不應視為同一採樣點、同一處理階段、即時飲用安全、用戶端水龍頭水質、個人健康風險或法規裁罰結論。', 'Feitsui Reservoir, river water, and clear-water quality data have different meanings. This module reflects clear-water testing at treatment plants or water sources and should not be treated as the same sampling point, same treatment stage, real-time drinking-water safety, household tap-water quality, individual health risk, or regulatory penalty conclusion.')}</p></section>
  </section>;
}

function BarPanel({ title, data, bars }: { title: string; data: object[]; bars: Array<[string, string]> }) {
  return <article className="chart-card"><h3>{title}</h3><ResponsiveContainer width="100%" height={260}><BarChart data={data}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" interval={0} angle={-20} textAnchor="end" height={72} /><YAxis /><Tooltip />{bars.map(([key, color]) => <Bar key={key} dataKey={key} fill={color} />)}</BarChart></ResponsiveContainer></article>;
}
