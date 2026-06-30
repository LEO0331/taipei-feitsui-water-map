import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Language } from './data/i18n';
import type { TaipeiWaterSupportTwcMonthlyRecord, TaipeiWaterSupportTwcSummary } from './types/twcSupport';

const text = (language: Language, zh: string, en: string) => language === 'zh' ? zh : en;
const fmt = (value?: number, digits = 0) => value === undefined ? '-' : value.toLocaleString(undefined, { maximumFractionDigits: digits });
const pct = (value?: number) => value === undefined ? '-' : `${fmt(value, 1)}%`;

export default function TwcSupportPanel({ records, summary, language }: { records: TaipeiWaterSupportTwcMonthlyRecord[]; summary: TaipeiWaterSupportTwcSummary; language: Language }) {
  const [year, setYear] = useState('all');
  const [month, setMonth] = useState('all');
  const [quarter, setQuarter] = useState('all');
  const [search, setSearch] = useState('');
  const years = useMemo(() => [...new Set(records.map((record) => record.year).filter(Boolean))].sort(), [records]);
  const filtered = records.filter((record) => {
    if (year !== 'all' && record.year !== Number(year)) return false;
    if (month !== 'all' && record.month !== Number(month)) return false;
    if (quarter !== 'all' && !record.quarter?.endsWith(quarter)) return false;
    const haystack = `${record.year} ${record.month} ${record.monthKey} 第一區處 第十二區處 First District Office Twelfth District Office`.toLowerCase();
    return haystack.includes(search.toLowerCase());
  });
  const highestAnnual = [...summary.byYear].sort((a, b) => (b.totalSupportVolume ?? 0) - (a.totalSupportVolume ?? 0))[0];
  const chartData = filtered.map((record) => ({
    month: record.monthKey,
    total: record.totalSupportVolume,
    first: record.firstDistrictOfficeSupportVolume,
    twelfth: record.twelfthDistrictOfficeSupportVolume,
    firstShare: record.firstDistrictOfficeSharePercent,
    mom: record.monthOverMonthTotalChange,
    yoy: record.yearOverYearTotalChange,
    rolling12: record.rolling12MonthTotalSupportVolume,
  }));
  const annualData = summary.byYear.map((record) => ({ year: record.year, total: record.totalSupportVolume, first: record.firstDistrictOfficeSupportVolume, twelfth: record.twelfthDistrictOfficeSupportVolume }));

  return <section className="river-module">
    <div className="section-heading"><div><h2>{text(language, '北水處支援台水月統計', 'Taipei Water Support to Taiwan Water Monthly Statistics')}</h2><p>{text(language, '整理臺北自來水事業處支援台灣自來水公司清水量月報表，依月份、年度與區處分布觀察供水支援趨勢。', 'Explore monthly clean-water support statistics from Taipei Water Department to Taiwan Water Corporation by month, year, and district-office distribution.')}</p></div></div>
    <section className="filters river-filters">
      <label><span>{text(language, '年度', 'Year')}</span><select value={year} onChange={(event) => setYear(event.target.value)}><option value="all">{text(language, '全部', 'All')}</option>{years.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      <label><span>{text(language, '月份', 'Month')}</span><select value={month} onChange={(event) => setMonth(event.target.value)}><option value="all">{text(language, '全部', 'All')}</option>{Array.from({ length: 12 }, (_, index) => index + 1).map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      <label><span>{text(language, '季度', 'Quarter')}</span><select value={quarter} onChange={(event) => setQuarter(event.target.value)}><option value="all">{text(language, '全部', 'All')}</option>{['Q1', 'Q2', 'Q3', 'Q4'].map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      <label><span>{text(language, '搜尋年度、月份或區處', 'Search year, month, or district office')}</span><input value={search} onChange={(event) => setSearch(event.target.value)} /></label>
    </section>
    <section className="cards">
      {[
        [text(language, '最新月份', 'Latest month'), summary.latestMonth],
        [text(language, '紀錄數', 'Record count'), summary.totalRecords],
        [text(language, '資料日期範圍', 'Data date range'), `${summary.minDate ?? '-'} - ${summary.maxDate ?? '-'}`],
        [text(language, '合計支援水量', 'Total support volume'), fmt(summary.totalSupportVolume)],
        [text(language, '最新月份合計水量', 'Latest monthly total support volume'), fmt(summary.latestRecord?.totalSupportVolume)],
        [text(language, '最新月份支援第一區處水量', 'Latest First District Office support volume'), fmt(summary.latestRecord?.firstDistrictOfficeSupportVolume)],
        [text(language, '最新月份支援第十二區處水量', 'Latest Twelfth District Office support volume'), fmt(summary.latestRecord?.twelfthDistrictOfficeSupportVolume)],
        [text(language, '第一區處累計占比', 'First District Office cumulative share'), pct(summary.destinationBreakdown[0]?.sharePercent)],
        [text(language, '第十二區處累計占比', 'Twelfth District Office cumulative share'), pct(summary.destinationBreakdown[1]?.sharePercent)],
        [text(language, '最高月份支援水量', 'Highest monthly support volume'), `${summary.highestMonthlySupportVolume?.monthKey ?? '-'} ${fmt(summary.highestMonthlySupportVolume?.totalSupportVolume)}`],
        [text(language, '最高年度支援水量', 'Highest annual support volume'), `${highestAnnual?.year ?? '-'} ${fmt(highestAnnual?.totalSupportVolume)}`],
      ].map(([label, value]) => <article className="card" key={String(label)}><span>{label}</span><strong>{value}</strong></article>)}
    </section>
    <p className="notice-block">{text(language, '支援台水月統計表為月統計資料，未提供供水路線、管線位置、支援點位或經緯度。本模組以趨勢圖與資料表呈現，不顯示地圖點位。', 'The support-to-Taiwan-Water monthly statistics table is a monthly statistical dataset and does not provide supply routes, pipeline locations, support points, or coordinates. This module is presented through trend charts and tables, not map markers.')}</p>
    <section className="charts">
      <LinePanel title={text(language, '每月合計支援水量', 'Monthly total support volume')} data={chartData} x="month" lines={[['total', '#0f766e']]} />
      <LinePanel title={text(language, '每月各區處支援水量', 'Monthly support volume by destination')} data={chartData} x="month" lines={[['first', '#2563eb'], ['twelfth', '#c2410c']]} />
      <BarPanel title={text(language, '各年度合計支援水量', 'Annual total support volume')} data={annualData} x="year" bars={[['total', '#0f766e']]} />
      <BarPanel title={text(language, '各年度區處分布', 'Annual destination breakdown')} data={annualData} x="year" bars={[['first', '#2563eb'], ['twelfth', '#c2410c']]} />
      <LinePanel title={text(language, '第一區處占比變化', 'First District Office share over time')} data={chartData} x="month" lines={[['firstShare', '#7c3aed']]} />
      <LinePanel title={text(language, '合計水量月變動', 'Month-over-month total support change')} data={chartData} x="month" lines={[['mom', '#0891b2']]} />
      <LinePanel title={text(language, '合計水量年變動', 'Year-over-year total support change')} data={chartData} x="month" lines={[['yoy', '#4d7c0f']]} />
      <LinePanel title={text(language, '12個月累計支援水量', 'Rolling 12-month total support volume')} data={chartData} x="month" lines={[['rolling12', '#be123c']]} />
      <BarPanel title={text(language, '月份季節分布', 'Monthly seasonal distribution')} data={summary.byMonth.map((item) => ({ month: item.month, total: item.monthlyAverageTotalSupportVolume }))} x="month" bars={[['total', '#0f766e']]} />
    </section>
    <section className="table-panel"><h3>{text(language, '資料表', 'Data Table')}</h3><div className="table-wrap"><table><thead><tr>{[text(language, '日期', 'Date'), text(language, '合計水量', 'Total support volume'), text(language, '支援第一區處水量', 'First District Office support volume'), text(language, '支援第十二區處水量', 'Twelfth District Office support volume'), text(language, '第一區處占比', 'First District Office share'), text(language, '第十二區處占比', 'Twelfth District Office share')].map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{filtered.map((record) => <tr key={record.id}><td>{record.monthKey}</td><td>{fmt(record.totalSupportVolume)}</td><td>{fmt(record.firstDistrictOfficeSupportVolume)}</td><td>{fmt(record.twelfthDistrictOfficeSupportVolume)}</td><td>{pct(record.firstDistrictOfficeSharePercent)}</td><td>{pct(record.twelfthDistrictOfficeSharePercent)}</td></tr>)}</tbody></table></div></section>
    <p className="notice-block">{text(language, '北水處支援台水月統計資料為臺北市公開資料中的歷史月統計，僅供觀察臺北自來水事業處支援台灣自來水公司清水量之月變化、年度比較與區處分布，不代表即時供水調度、水情警戒、限水公告、水質狀態、未來供水預測或緊急應變指令。', 'Taipei Water support-to-Taiwan-Water monthly statistics are historical monthly public-data records for observing monthly changes, annual comparisons, and district-office distribution of clean-water support volumes. They do not represent real-time water dispatch, water-condition alerts, water-rationing announcements, water-quality status, future supply forecasts, or emergency-response instructions.')}</p>
  </section>;
}

function LinePanel({ title, data, x, lines }: { title: string; data: object[]; x: string; lines: Array<[string, string]> }) {
  return <article className="chart-card"><h3>{title}</h3><ResponsiveContainer width="100%" height={260}><LineChart data={data}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey={x} minTickGap={24} /><YAxis /><Tooltip />{lines.map(([key, color]) => <Line key={key} type="monotone" dataKey={key} stroke={color} strokeWidth={2} dot={false} connectNulls />)}</LineChart></ResponsiveContainer></article>;
}

function BarPanel({ title, data, x, bars }: { title: string; data: object[]; x: string; bars: Array<[string, string]> }) {
  return <article className="chart-card"><h3>{title}</h3><ResponsiveContainer width="100%" height={260}><BarChart data={data}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey={x} /><YAxis /><Tooltip />{bars.map(([key, color]) => <Bar key={key} dataKey={key} fill={color} />)}</BarChart></ResponsiveContainer></article>;
}
