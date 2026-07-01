import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Language } from './data/i18n';
import type { TapWaterBusinessKeyMetricRecord, TapWaterBusinessKeyMetricSummary } from './types/tapWaterBusiness';

const text = (language: Language, zh: string, en: string) => language === 'zh' ? zh : en;
const fmt = (value?: number, digits = 0) => value === undefined ? '-' : value.toLocaleString(undefined, { maximumFractionDigits: digits });
const pct = (value?: number) => value === undefined ? '-' : `${fmt(value, 1)}%`;
const money = (language: Language, value?: number) => value === undefined ? '-' : `${fmt(value / 1000, 1)} ${text(language, '百萬元', 'million NTD')}`;

export default function TapWaterBusinessPanel({ records, summary, language }: { records: TapWaterBusinessKeyMetricRecord[]; summary: TapWaterBusinessKeyMetricSummary; language: Language }) {
  const [year, setYear] = useState('all'); const [month, setMonth] = useState('all'); const [quarter, setQuarter] = useState('all'); const [latestOnly, setLatestOnly] = useState(false); const [search, setSearch] = useState('');
  const years = useMemo(() => [...new Set(records.map((record) => record.year))].sort(), [records]);
  const filtered = records.filter((record) => {
    if (year !== 'all' && record.year !== Number(year)) return false;
    if (month !== 'all' && record.month !== Number(month)) return false;
    if (quarter !== 'all' && !record.quarter.endsWith(quarter)) return false;
    if (latestOnly && !record.isLatestMonth) return false;
    const haystack = `${record.periodRaw} ${record.monthKey} ${record.year} ${record.quarter} 配水量 計費水量 支援台水 用戶 員工 收入 支出 盈餘 資產 負債 equity revenue supply`.toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  });
  const latest = summary.latest;
  const lineData = filtered.map((record) => ({
    month: record.monthKey,
    distributed: record.distributedWaterVolumeMillionM3,
    billed: record.billedWaterVolumeMillionM3,
    support: record.taiwanWaterSupportVolumeMillionM3,
    excludingSupport: record.waterUseExcludingSupportMillionM3,
    pressure: record.averageWaterPressureKgCm2,
    pipeline: record.transmissionDistributionPipelineLengthKm,
    users: record.userCount,
    perCapita: record.perCapitaDailyWaterUseLiter,
    employees: record.employeeCount,
    staff: record.staffCount,
    workers: record.workerCount,
    usersPerEmployee: record.usersPerEmployee,
    revenue: record.monthlyRevenueMillionNtd,
    expense: record.monthlyExpenseMillionNtd,
    surplus: record.monthlySurplusMillionNtd,
    assets: record.assetsThousandNtd ? record.assetsThousandNtd / 1_000_000 : undefined,
    liabilities: record.liabilitiesThousandNtd ? record.liabilitiesThousandNtd / 1_000_000 : undefined,
    equity: record.equityThousandNtd ? record.equityThousandNtd / 1_000_000 : undefined,
    supportShare: record.supportShareOfDistributedWaterPercent,
    billedShare: record.billedShareOfDistributedWaterPercent,
    debtRatio: record.debtRatioPercent,
    equityRatio: record.equityRatioPercent,
  }));
  const annualData = summary.byYear.map((row) => ({ year: row.year, distributed: row.distributedWaterVolumeM3Sum ? row.distributedWaterVolumeM3Sum / 1_000_000 : undefined, billed: row.billedWaterVolumeM3Sum ? row.billedWaterVolumeM3Sum / 1_000_000 : undefined, support: row.taiwanWaterSupportVolumeM3Sum ? row.taiwanWaterSupportVolumeM3Sum / 1_000_000 : undefined, revenue: row.monthlyRevenueThousandNtdSum ? row.monthlyRevenueThousandNtdSum / 1000 : undefined, expense: row.monthlyExpenseThousandNtdSum ? row.monthlyExpenseThousandNtdSum / 1000 : undefined, surplus: row.monthlySurplusThousandNtdSum ? row.monthlySurplusThousandNtdSum / 1000 : undefined }));
  return <section className="river-module">
    <div className="section-heading"><div><h2>{text(language, '臺北自來水事業處業務關鍵數據', 'Taipei Water Business Key Metrics')}</h2><p>{text(language, '整理月度生產、供水、營業、人事與財務關鍵數據，作為自來水營運與供水服務背景。', 'Explore monthly production, supply, business, staffing, and financial key metrics as tap-water operations context.')}</p></div></div>
    <section className="filters river-filters">
      <label><span>{text(language, '年度', 'Year')}</span><select value={year} onChange={(event) => setYear(event.target.value)}><option value="all">{text(language, '全部', 'All')}</option>{years.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label><span>{text(language, '月份', 'Month')}</span><select value={month} onChange={(event) => setMonth(event.target.value)}><option value="all">{text(language, '全部', 'All')}</option>{Array.from({ length: 12 }, (_, index) => index + 1).map((item) => <option key={item}>{item}</option>)}</select></label>
      <label><span>{text(language, '季度', 'Quarter')}</span><select value={quarter} onChange={(event) => setQuarter(event.target.value)}><option value="all">{text(language, '全部', 'All')}</option>{['Q1', 'Q2', 'Q3', 'Q4'].map((item) => <option key={item}>{item}</option>)}</select></label>
      <label><span>{text(language, '最新月份', 'Latest month')}</span><select value={latestOnly ? 'latest' : 'all'} onChange={(event) => setLatestOnly(event.target.value === 'latest')}><option value="all">{text(language, '全部', 'All')}</option><option value="latest">{text(language, '僅最新月份', 'Latest only')}</option></select></label>
      <label className="search-field"><span>{text(language, '搜尋', 'Search')}</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={text(language, '搜尋年月、年度、季度或指標', 'Search month, year, quarter, or metric')} /></label>
    </section>
    <section className="cards">{[
      [text(language, '最新月份', 'Latest month'), summary.latestMonthKey ?? '-'],
      [text(language, '配水量', 'Distributed water volume'), `${fmt(latest?.distributedWaterVolumeMillionM3, 1)} ${text(language, '百萬立方公尺', 'million m3')}`],
      [text(language, '計費水量', 'Billed water volume'), `${fmt(latest?.billedWaterVolumeMillionM3, 1)} ${text(language, '百萬立方公尺', 'million m3')}`],
      [text(language, '支援台水水量', 'Taiwan Water support volume'), `${fmt(latest?.taiwanWaterSupportVolumeMillionM3, 1)} ${text(language, '百萬立方公尺', 'million m3')}`],
      [text(language, '供水普及率', 'Supply coverage rate'), pct(latest?.supplyCoverageRatePercent)],
      [text(language, '用戶數', 'User count'), fmt(latest?.userCount)],
      [text(language, '每人每日平均用水量', 'Per-capita daily water use'), `${fmt(latest?.perCapitaDailyWaterUseLiter)} L`],
      [text(language, '員工人數', 'Employee count'), fmt(latest?.employeeCount)],
      [text(language, '每員工平均服務用戶數', 'Users per employee'), fmt(latest?.usersPerEmployee)],
      [text(language, '本月收入', 'Monthly revenue'), money(language, latest?.monthlyRevenueThousandNtd)],
      [text(language, '本月支出', 'Monthly expense'), money(language, latest?.monthlyExpenseThousandNtd)],
      [text(language, '本月盈餘', 'Monthly surplus'), money(language, latest?.monthlySurplusThousandNtd)],
      [text(language, '資產', 'Assets'), money(language, latest?.assetsThousandNtd)],
      [text(language, '負債', 'Liabilities'), money(language, latest?.liabilitiesThousandNtd)],
      [text(language, '業主權益', 'Equity'), money(language, latest?.equityThousandNtd)],
    ].map(([label, value]) => <article className="card" key={String(label)}><span>{label}</span><strong>{value}</strong></article>)}</section>
    <p className="notice-block">{text(language, '臺北自來水事業處業務關鍵數據為月度營運與財務統計資料，未提供經緯度、地址、行政區或設施點位欄位。本模組以時間序列、指標卡、統計圖表與資料表呈現，不顯示地圖點位。', 'Taipei Water business key metrics are monthly operational and financial statistics and do not provide coordinates, addresses, districts, or facility point fields. This module is shown through time series, KPI cards, charts, and tables, not map points.')}</p>
    <section className="charts">
      <LinePanel title={text(language, '各月水量', 'Monthly water volumes')} data={lineData} lines={[['distributed', '#2563eb'], ['billed', '#0f766e'], ['support', '#c2410c'], ['excludingSupport', '#7c3aed']]} />
      <LinePanel title={text(language, '計費與支援台水占配水量比率', 'Billed and support share of distributed water')} data={lineData} lines={[['billedShare', '#0f766e'], ['supportShare', '#c2410c']]} />
      <LinePanel title={text(language, '服務與基礎設施', 'Service & infrastructure')} data={lineData} lines={[['pressure', '#0891b2'], ['pipeline', '#64748b']]} />
      <LinePanel title={text(language, '人口、用戶與用水', 'Population, users, and water use')} data={lineData} lines={[['users', '#2563eb'], ['perCapita', '#be123c']]} />
      <LinePanel title={text(language, '員工與服務用戶', 'Staffing and users served')} data={lineData} lines={[['employees', '#0f766e'], ['staff', '#2563eb'], ['workers', '#c2410c'], ['usersPerEmployee', '#7c3aed']]} />
      <LinePanel title={text(language, '收入、支出與盈餘', 'Revenue, expense, and surplus')} data={lineData} lines={[['revenue', '#0f766e'], ['expense', '#c2410c'], ['surplus', '#2563eb']]} />
      <LinePanel title={text(language, '資產、負債與業主權益', 'Assets, liabilities, and equity')} data={lineData} lines={[['assets', '#2563eb'], ['liabilities', '#c2410c'], ['equity', '#0f766e']]} />
      <LinePanel title={text(language, '負債與權益比率', 'Debt and equity ratios')} data={lineData} lines={[['debtRatio', '#c2410c'], ['equityRatio', '#0f766e']]} />
      <BarPanel title={text(language, '年度水量合計', 'Annual water volume totals')} data={annualData} bars={[['distributed', '#2563eb'], ['billed', '#0f766e'], ['support', '#c2410c']]} />
      <BarPanel title={text(language, '年度收入支出盈餘合計', 'Annual revenue, expense, and surplus')} data={annualData} bars={[['revenue', '#0f766e'], ['expense', '#c2410c'], ['surplus', '#2563eb']]} />
    </section>
    <section className="table-panel"><h3>{text(language, '資料表', 'Data Table')}</h3><div className="table-wrap"><table><thead><tr>{[text(language, '年月', 'Month'), text(language, '配水量', 'Distributed water volume'), text(language, '計費水量', 'Billed water volume'), text(language, '支援台水水量', 'Taiwan Water support volume'), text(language, '供水普及率', 'Supply coverage rate'), text(language, '用戶數', 'User count'), text(language, '每人每日平均用水量', 'Per-capita daily water use'), text(language, '本月收入', 'Monthly revenue'), text(language, '本月支出', 'Monthly expense'), text(language, '本月盈餘', 'Monthly surplus')].map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{filtered.map((record) => <tr key={record.id}><td>{record.monthKey}</td><td>{fmt(record.distributedWaterVolumeM3)}</td><td>{fmt(record.billedWaterVolumeM3)}</td><td>{fmt(record.taiwanWaterSupportVolumeM3)}</td><td>{pct(record.supplyCoverageRatePercent)}</td><td>{fmt(record.userCount)}</td><td>{fmt(record.perCapitaDailyWaterUseLiter)}</td><td>{fmt(record.monthlyRevenueThousandNtd)}</td><td>{fmt(record.monthlyExpenseThousandNtd)}</td><td>{fmt(record.monthlySurplusThousandNtd)}</td></tr>)}</tbody></table></div></section>
    <section className="notice-block"><p>{text(language, '本資料為月度業務關鍵數據，僅供營運背景分析，不代表即時供水狀態、停水資訊、用戶端用水紀錄、個別水費試算、飲用水安全判斷、財務建議、投資建議、營運績效排名或審計結論。衍生比率僅依來源欄位計算。', 'This data is monthly business key metrics for operational context only. It does not represent real-time water supply status, outage information, customer water-use records, bill estimation, drinking-water safety determination, financial advice, investment advice, operational performance ranking, or audit conclusions. Derived ratios are calculated only from source fields.')}</p><p>{text(language, '業務關鍵數據、支援台水月報、清水水質、河川水質與水庫資料的統計口徑不同，並列觀察時應標示來源與期間，不應直接視為同一標準。', 'Business key metrics, Taiwan Water support records, clear-water quality, river water quality, and reservoir data use different definitions and periods. When shown together, source and period should be labeled rather than treated as the same standard.')}</p></section>
  </section>;
}

function LinePanel({ title, data, lines }: { title: string; data: object[]; lines: Array<[string, string]> }) {
  return <article className="chart-card"><h3>{title}</h3><ResponsiveContainer width="100%" height={260}><LineChart data={data}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" minTickGap={24} /><YAxis /><Tooltip />{lines.map(([key, color]) => <Line key={key} type="monotone" dataKey={key} stroke={color} strokeWidth={2} dot={false} connectNulls />)}</LineChart></ResponsiveContainer></article>;
}

function BarPanel({ title, data, bars }: { title: string; data: object[]; bars: Array<[string, string]> }) {
  return <article className="chart-card"><h3>{title}</h3><ResponsiveContainer width="100%" height={260}><BarChart data={data}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="year" /><YAxis /><Tooltip />{bars.map(([key, color]) => <Bar key={key} dataKey={key} fill={color} />)}</BarChart></ResponsiveContainer></article>;
}
