import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Language } from './data/i18n';
import { localize as text } from './utils/presentation';
import type { CarlsonTrophicStateIndexCategory, CarlsonTrophicStateIndexRecord, CarlsonTrophicStateIndexSummary, TrophicStateIndicatorCategory, WaterQualityTrendDirection } from './types/carlsonTrophicStateIndex';

const fmt = (value?: number, digits = 2) => value === undefined ? '-' : value.toLocaleString(undefined, { maximumFractionDigits: digits });
const signed = (value?: number) => value === undefined ? '-' : `${value > 0 ? '+' : ''}${fmt(value, 2)}`;

const indicatorLabel = (language: Language, value: TrophicStateIndicatorCategory) => ({
  oligotrophic: text(language, '貧養', 'Oligotrophic'),
  mesotrophic: text(language, '普養', 'Mesotrophic'),
  eutrophic: text(language, '優養', 'Eutrophic'),
  hypereutrophic: text(language, '超優養', 'Hypereutrophic'),
  unknown: text(language, '未知', 'Unknown'),
}[value]);
const categoryLabel = (language: Language, value: CarlsonTrophicStateIndexCategory) => ({
  under_30: '< 30',
  '30_to_40': '30-40',
  '40_to_50': '40-50',
  '50_to_60': '50-60',
  '60_to_70': '60-70',
  over_70: '>= 70',
  missing: text(language, '缺漏', 'Missing'),
  unknown: text(language, '未知', 'Unknown'),
}[value]);
const trendLabel = (language: Language, value: WaterQualityTrendDirection) => ({
  increase: text(language, '上升', 'Increase'),
  decrease: text(language, '下降', 'Decrease'),
  no_change: text(language, '持平', 'No change'),
  first_record: text(language, '首筆', 'First record'),
  unknown: text(language, '未知', 'Unknown'),
}[value]);

export default function CarlsonTrophicStateIndexPanel({ records, summary, language }: { records: CarlsonTrophicStateIndexRecord[]; summary: CarlsonTrophicStateIndexSummary; language: Language }) {
  const [indicator, setIndicator] = useState<TrophicStateIndicatorCategory | 'all'>('all');
  const [category, setCategory] = useState<CarlsonTrophicStateIndexCategory | 'all'>('all');
  const [trend, setTrend] = useState<WaterQualityTrendDirection | 'all'>('all');
  const [search, setSearch] = useState('');
  const filtered = records.filter((record) => {
    if (indicator !== 'all' && record.trophicStateIndicatorCategory !== indicator) return false;
    if (category !== 'all' && record.ctsiCategory !== category) return false;
    if (trend !== 'all' && record.trendDirection !== trend) return false;
    const haystack = `${record.year} ${record.rocYear} ${record.ctsiRaw} ${record.trophicStateIndicatorRaw} ${record.agencyName} ${record.agencyCode} 卡爾森 優養 指數 CTSI trophic oligotrophic mesotrophic`.toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  });
  const trendData = filtered.map((record) => ({ year: record.year, ctsi: record.ctsi, rolling3YearAverage: record.rolling3YearAverage }));
  const yoyData = filtered.filter((record) => record.yearOverYearChange !== undefined).map((record) => ({ year: record.year, change: record.yearOverYearChange }));
  const indicatorData = (Object.entries(summary.trophicStateIndicatorCounts) as Array<[TrophicStateIndicatorCategory, number]>).map(([key, count]) => ({ name: indicatorLabel(language, key), count }));
  const categoryData = (Object.entries(summary.ctsiCategoryCounts) as Array<[CarlsonTrophicStateIndexCategory, number]>).filter(([, count]) => count > 0).map(([key, count]) => ({ name: categoryLabel(language, key), count }));
  const latest = summary.latest;

  return <section className="river-module">
    <div className="section-heading"><div><h2>{text(language, '卡爾森優養指數', 'Carlson Trophic State Index')}</h2><p>{text(language, '整理翡翠水庫年度 CTSI 與優養指標，作為水庫水質、優養化與長期監測背景。', 'Explore annual Feitsui Reservoir CTSI and trophic-state indicators as reservoir water-quality, trophic-state, and long-term monitoring context.')}</p></div></div>
    <section className="filters river-filters">
      <label><span>{text(language, '優養指標', 'Trophic indicator')}</span><select value={indicator} onChange={(event) => setIndicator(event.target.value as TrophicStateIndicatorCategory | 'all')}><option value="all">{text(language, '全部', 'All')}</option>{(['oligotrophic', 'mesotrophic', 'eutrophic', 'hypereutrophic', 'unknown'] as const).map((item) => <option key={item} value={item}>{indicatorLabel(language, item)}</option>)}</select></label>
      <label><span>{text(language, 'CTSI 區間', 'CTSI band')}</span><select value={category} onChange={(event) => setCategory(event.target.value as CarlsonTrophicStateIndexCategory | 'all')}><option value="all">{text(language, '全部', 'All')}</option>{(['under_30', '30_to_40', '40_to_50', '50_to_60', '60_to_70', 'over_70', 'missing', 'unknown'] as const).map((item) => <option key={item} value={item}>{categoryLabel(language, item)}</option>)}</select></label>
      <label><span>{text(language, '年變化', 'Annual change')}</span><select value={trend} onChange={(event) => setTrend(event.target.value as WaterQualityTrendDirection | 'all')}><option value="all">{text(language, '全部', 'All')}</option>{(['increase', 'decrease', 'no_change', 'first_record', 'unknown'] as const).map((item) => <option key={item} value={item}>{trendLabel(language, item)}</option>)}</select></label>
      <label className="search-field"><span>{text(language, '搜尋', 'Search')}</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={text(language, '搜尋年份、優養指標或 CTSI', 'Search year, trophic indicator, or CTSI')} /></label>
    </section>
    <section className="cards">{[
      [text(language, '最新年度', 'Latest year'), `${latest?.year ?? '-'} / ${latest?.rocYear ? text(language, `民國 ${latest.rocYear}`, `ROC ${latest.rocYear}`) : '-'}`],
      ['CTSI', fmt(latest?.ctsi)],
      [text(language, '最新優養指標', 'Latest trophic indicator'), latest?.trophicStateIndicatorCategory ? indicatorLabel(language, latest.trophicStateIndicatorCategory) : '-'],
      [text(language, '資料筆數', 'Records'), fmt(summary.totalRecords, 0)],
      [text(language, '年度範圍', 'Year range'), `${summary.minYear ?? '-'}-${summary.maxYear ?? '-'}`],
      [text(language, '最低 CTSI', 'Minimum CTSI'), `${fmt(summary.minCtsi?.value)} (${summary.minCtsi?.year ?? '-'})`],
      [text(language, '最高 CTSI', 'Maximum CTSI'), `${fmt(summary.maxCtsi?.value)} (${summary.maxCtsi?.year ?? '-'})`],
      [text(language, '平均 CTSI', 'Average CTSI'), fmt(summary.averageCtsi)],
      [text(language, '中位數 CTSI', 'Median CTSI'), fmt(summary.medianCtsi)],
      [text(language, '期間總變化', 'Total change'), signed(summary.totalCtsiChange)],
      [text(language, '平均年變化', 'Average annual change'), signed(summary.averageAnnualCtsiChange)],
      [text(language, '貧養年度', 'Oligotrophic years'), fmt(summary.trophicStateIndicatorCounts.oligotrophic, 0)],
    ].map(([label, value]) => <article className="card" key={String(label)}><span>{label}</span><strong>{value}</strong></article>)}</section>
    <p className="notice-block">{text(language, '卡爾森優養指數資料為年度水庫優養化背景資料，來源欄位未提供座標、地址、測站或設施點位。本模組僅以指標卡、圖表與表格呈現，不顯示地圖點位或附近查詢。', 'Carlson trophic state index data is annual reservoir trophic-state context. The source fields do not provide coordinates, addresses, stations, or facility points, so this module uses cards, charts, and tables only, without map markers or nearby lookup.')}</p>
    <section className="charts">
      <article className="chart-card"><h3>{text(language, '年度 CTSI 趨勢', 'Annual CTSI trend')}</h3><ResponsiveContainer width="100%" height={260}><LineChart data={trendData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="year" /><YAxis domain={['dataMin - 1', 'dataMax + 1']} /><Tooltip /><Line type="monotone" dataKey="ctsi" stroke="#2563eb" strokeWidth={2} /><Line type="monotone" dataKey="rolling3YearAverage" stroke="#0f766e" strokeWidth={2} dot={false} connectNulls /></LineChart></ResponsiveContainer></article>
      <BarPanel title={text(language, '年變化量', 'Year-over-year change')} data={yoyData} xKey="year" bars={[['change', '#c2410c']]} />
      <BarPanel title={text(language, '優養指標分布', 'Trophic indicator distribution')} data={indicatorData} xKey="name" bars={[['count', '#0f766e']]} />
      <BarPanel title={text(language, 'CTSI 區間分布', 'CTSI band distribution')} data={categoryData} xKey="name" bars={[['count', '#2563eb']]} />
    </section>
    <section className="table-panel"><h3>{text(language, '年度資料表', 'Annual Data Table')}</h3><div className="table-wrap"><table><thead><tr>{[text(language, '西元年', 'Year'), text(language, '民國年', 'ROC year'), 'CTSI', text(language, '優養指標', 'Trophic indicator'), text(language, 'CTSI 區間', 'CTSI band'), text(language, '年變化', 'Annual change'), text(language, '3 年平均', '3-year average')].map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{filtered.map((record) => <tr key={record.id}><td>{record.year}</td><td>{record.rocYear}</td><td>{fmt(record.ctsi)}</td><td>{record.trophicStateIndicatorRaw ?? indicatorLabel(language, record.trophicStateIndicatorCategory)}</td><td>{categoryLabel(language, record.ctsiCategory)}</td><td>{signed(record.yearOverYearChange)}</td><td>{fmt(record.rolling3YearAverage)}</td></tr>)}</tbody></table></div></section>
    <section className="notice-block"><p>{text(language, '本資料為年度 CTSI 指標，非即時水質、飲用水安全保證、自來水水質、醫療建議、污染來源判定、完整水質檢驗結果、緊急警示或官方風險評分。', 'This annual CTSI dataset is not real-time water quality, a drinking-water safety guarantee, tap-water quality, medical advice, pollution-source determination, complete water-quality testing, an emergency warning, or official risk scoring.')}</p><p>{text(language, 'CTSI、水庫月報水質、水文氣象、操作運轉、河川水質、清水水質與北水業務資料的時間尺度與統計口徑不同，並列觀察時應保留來源與期間標示。', 'CTSI, reservoir monthly water quality, hydrometeorology, reservoir operation, river water quality, clear-water quality, and Taipei Water business data use different time scales and definitions. Keep source and period labels when comparing them side by side.')}</p></section>
  </section>;
}

function BarPanel({ title, data, xKey, bars }: { title: string; data: object[]; xKey: string; bars: Array<[string, string]> }) {
  return <article className="chart-card"><h3>{title}</h3><ResponsiveContainer width="100%" height={260}><BarChart data={data}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey={xKey} minTickGap={12} /><YAxis allowDecimals={false} /><Tooltip />{bars.map(([key, color]) => <Bar key={key} dataKey={key} fill={color} />)}</BarChart></ResponsiveContainer></article>;
}
