import { useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  groupLabels,
  hydrometParameterLabels,
  hydrometParameterUnits,
  parameterLabels,
  parameterUnits,
  translations,
  type Language,
} from './data/i18n';
import type { HydrometDailyRecord, HydrometMonthlySummary, HydrometParameterKey } from './types/hydromet';
import type {
  Filters,
  StationGroup,
  StationLocation,
  WaterQualityParameterKey,
  WaterQualityRecord,
  WaterQualitySummary,
  WaterQualityValue,
} from './types/waterQuality';
import {
  aggregateStationComparison,
  filterRecords,
  getLatestPeriod,
  parameterKeys,
  stationGroupOrder,
} from './utils/waterQuality';
import {
  averageWaterQualityParameter,
  hydrometParameterKeys,
  joinWaterQualityAndHydrometByPeriod,
} from './utils/hydromet';

type MonitoringTab = 'waterQuality' | 'hydromet' | 'combinedDashboard' | 'dataTable';
type TableMode = 'waterRecords' | 'hydrometDaily' | 'waterSummary' | 'hydrometSummary';
type DayTypeFilter = 'all' | 'weekday' | 'weekend';

const mapCenter: [number, number] = [24.91, 121.58];
const importantParameters: WaterQualityParameterKey[] = [
  'waterDepthM',
  'transparencyM',
  'waterTemperatureC',
  'turbidityNTU',
  'pH',
  'dissolvedOxygenMgL',
  'totalPhosphorusUgL',
  'chlorophyllAUgL',
  'algaeCellsPerML',
];

const markerIcon = L.divIcon({
  className: 'station-marker',
  html: '<span></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const dataUrl = (fileName: string) => `${import.meta.env.BASE_URL}data/${fileName}`;

type TrendPoint = {
  period: string;
  value: number;
};

type HydrometTrendPoint = {
  date: string;
  value: number | null;
  max?: number | null;
  min?: number | null;
};

function readSavedLanguage(): Language {
  try {
    const saved = localStorage.getItem('language');
    return saved === 'en' || saved === 'zh' ? saved : 'zh';
  } catch {
    return 'zh';
  }
}

function saveLanguage(language: Language) {
  try {
    localStorage.setItem('language', language);
  } catch {
    // Language persistence is optional; keep the UI usable when storage is blocked.
  }
}

function formatValue(value: WaterQualityValue, unit = '') {
  if (value.qualifier === 'not_detected') return 'ND';
  if (value.qualifier === 'missing') return '-';
  if (value.qualifier === 'less_than') return `<${value.value}${unit ? ` ${unit}` : ''}`;
  return value.value === null ? '-' : `${value.value}${unit ? ` ${unit}` : ''}`;
}

function formatNumber(value: number | null | undefined, unit = '', digits = 1) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  const formatted = value.toFixed(digits).replace(/\.?0+$/, '');
  return `${formatted}${unit ? ` ${unit}` : ''}`;
}

function buildMonthlyAverageSeries(
  records: WaterQualityRecord[],
  parameter: WaterQualityParameterKey,
): TrendPoint[] {
  const grouped = new Map<string, number[]>();
  for (const record of records) {
    const value = record.values[parameter].value;
    if (value === null) continue;
    if (!grouped.has(record.period)) grouped.set(record.period, []);
    grouped.get(record.period)!.push(value);
  }

  return [...grouped.entries()]
    .sort(([periodA], [periodB]) => periodA.localeCompare(periodB))
    .map(([period, values]) => ({
      period,
      value: values.reduce((sum, value) => sum + value, 0) / values.length,
    }));
}

function LanguageToggle({ language, setLanguage }: { language: Language; setLanguage: (language: Language) => void }) {
  return (
    <div className="segmented" aria-label="Language">
      <button className={language === 'zh' ? 'active' : ''} onClick={() => setLanguage('zh')}>中文</button>
      <button className={language === 'en' ? 'active' : ''} onClick={() => setLanguage('en')}>English</button>
    </div>
  );
}

function MonitoringTabs({
  activeTab,
  setActiveTab,
  language,
}: {
  activeTab: MonitoringTab;
  setActiveTab: (tab: MonitoringTab) => void;
  language: Language;
}) {
  const t = translations[language];
  const tabs: Array<{ id: MonitoringTab; label: string }> = [
    { id: 'waterQuality', label: t.waterQuality },
    { id: 'hydromet', label: t.hydromet },
    { id: 'combinedDashboard', label: t.combinedDashboard },
    { id: 'dataTable', label: t.dataTable },
  ];
  return (
    <nav className="tabs" aria-label="Monitoring sections">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={activeTab === tab.id ? 'active' : ''}
          onClick={() => setActiveTab(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

function FilterPanel({
  filters,
  setFilters,
  language,
  periods,
  stations,
}: {
  filters: Filters;
  setFilters: (filters: Filters) => void;
  language: Language;
  periods: string[];
  stations: string[];
}) {
  const t = translations[language];
  const update = <K extends keyof Filters>(key: K, value: Filters[K]) => setFilters({ ...filters, [key]: value });
  return (
    <section className="filters" aria-label="Filters">
      <label>
        <span>{t.period}</span>
        <select value={filters.period} onChange={(event) => update('period', event.target.value)}>
          {periods.map((period) => <option key={period} value={period}>{period}</option>)}
        </select>
      </label>
      <label>
        <span>{t.stationGroup}</span>
        <select value={filters.stationGroup} onChange={(event) => update('stationGroup', event.target.value as Filters['stationGroup'])}>
          {(['all', ...stationGroupOrder] as Array<StationGroup | 'all'>).map((group) => (
            <option key={group} value={group}>{groupLabels[language][group]}</option>
          ))}
        </select>
      </label>
      <label>
        <span>{t.station}</span>
        <select value={filters.stationName} onChange={(event) => update('stationName', event.target.value)}>
          <option value="all">{t.all}</option>
          {stations.map((station) => <option key={station} value={station}>{station}</option>)}
        </select>
      </label>
      <label>
        <span>{t.parameter}</span>
        <select value={filters.parameter} onChange={(event) => update('parameter', event.target.value as WaterQualityParameterKey)}>
          {parameterKeys.map((parameter) => <option key={parameter} value={parameter}>{parameterLabels[language][parameter]}</option>)}
        </select>
      </label>
      <label className="search-field">
        <span>{t.searchPlaceholder}</span>
        <input
          value={filters.search}
          onChange={(event) => update('search', event.target.value)}
          placeholder={t.searchPlaceholder}
        />
      </label>
    </section>
  );
}

function StationPopup({
  record,
  language,
  onSelect,
}: {
  record: WaterQualityRecord;
  language: Language;
  onSelect: (stationName: string) => void;
}) {
  const t = translations[language];
  return (
    <div className="popup">
      <strong>{record.stationName}</strong>
      <dl>
        <dt>{language === 'zh' ? '測站' : 'Station'}</dt><dd>{record.stationName}</dd>
        <dt>{language === 'zh' ? '站點類型' : 'Station type'}</dt><dd>{groupLabels[language][record.stationGroup]}</dd>
        <dt>{language === 'zh' ? '最新月份' : 'Latest month'}</dt><dd>{record.period}</dd>
        {importantParameters.map((parameter) => (
          <div key={parameter}>
            <dt>{parameterLabels[language][parameter]}</dt>
            <dd>{formatValue(record.values[parameter], parameterUnits[parameter])}</dd>
          </div>
        ))}
      </dl>
      <button onClick={() => onSelect(record.stationName)}>{t.viewTrend}</button>
    </div>
  );
}

function WaterQualityMap({
  records,
  stationLocations,
  language,
  setSelectedStation,
}: {
  records: WaterQualityRecord[];
  stationLocations: StationLocation[];
  language: Language;
  setSelectedStation: (station: string) => void;
}) {
  const t = translations[language];
  const locationByStation = new Map(stationLocations.map((location) => [location.stationName, location]));
  const markerRecords = records.filter((record) => {
    const location = locationByStation.get(record.stationName);
    return !record.isSummaryRow && location?.coordinateStatus === 'verified' && location.latitude && location.longitude;
  });

  return (
    <section className="map-panel" aria-label={t.map}>
      <div className="section-heading">
        <h2>{t.map}</h2>
        <p>{t.missingCoordinatesNotice}</p>
      </div>
      <MapContainer center={mapCenter} zoom={12} scrollWheelZoom={false} className="map">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {markerRecords.map((record) => {
          const location = locationByStation.get(record.stationName)!;
          return (
            <Marker key={record.id} position={[location.latitude!, location.longitude!]} icon={markerIcon}>
              <Popup>
                <StationPopup record={record} language={language} onSelect={setSelectedStation} />
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
      {!markerRecords.length && <p className="empty-map">{t.noVerifiedMarkers}</p>}
    </section>
  );
}

function UnmappedStationsList({
  records,
  stationLocations,
  language,
}: {
  records: WaterQualityRecord[];
  stationLocations: StationLocation[];
  language: Language;
}) {
  const t = translations[language];
  const locationByStation = new Map(stationLocations.map((location) => [location.stationName, location]));
  const stations = [...new Set(records.filter((record) => !record.isSummaryRow).map((record) => record.stationName))]
    .filter((station) => locationByStation.get(station)?.coordinateStatus !== 'verified');

  return (
    <section className="unmapped">
      <h2>{t.unmappedStations}</h2>
      <p>{t.missingCoordinatesNotice}</p>
      <ul>
        {stations.map((station) => {
          const location = locationByStation.get(station);
          return (
            <li key={station}>
              <span>{station}</span>
              <small>{groupLabels[language][location?.stationGroup ?? 'unknown']} · {location?.coordinateStatus ?? 'missing'}</small>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function MiniLineChart({ data, parameter, language }: { data: WaterQualityRecord[]; parameter: WaterQualityParameterKey; language: Language }) {
  const chartData = data.map((record) => ({
    period: record.period,
    value: record.values[parameter].value,
    stationName: record.stationName,
  }));
  if (new Set(chartData.map((point) => point.period)).size <= 1) {
    return <p className="notice">{translations[language].oneMonthTrendNotice}</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={190}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="period" />
        <YAxis />
        <Tooltip />
        <Line type="monotone" dataKey="value" stroke="#0f766e" strokeWidth={2} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}

function SelectedStationPanel({
  selectedStation,
  records,
  parameter,
  language,
}: {
  selectedStation: string;
  records: WaterQualityRecord[];
  parameter: WaterQualityParameterKey;
  language: Language;
}) {
  const t = translations[language];
  const stationRecords = records.filter((record) => record.stationName === selectedStation).sort((a, b) => a.period.localeCompare(b.period));
  const latest = stationRecords.at(-1);
  if (!latest) return null;
  return (
    <section className="selected-panel">
      <div className="section-heading">
        <h2>{selectedStation}</h2>
        <p>{t.latestValues} · {latest.period}</p>
      </div>
      <div className="value-grid">
        {importantParameters.map((item) => (
          <div key={item}>
            <span>{parameterLabels[language][item]}</span>
            <strong>{formatValue(latest.values[item], parameterUnits[item])}</strong>
          </div>
        ))}
      </div>
      <h3>{parameterLabels[language][parameter]}</h3>
      <MiniLineChart data={stationRecords} parameter={parameter} language={language} />
    </section>
  );
}

function SummaryCards({ summary, language }: { summary: WaterQualitySummary; language: Language }) {
  const cards = language === 'zh'
    ? [
        ['最新月份', summary.summaryCards.latestPeriod],
        ['最新月份測站數', summary.summaryCards.latestStationCount],
        ['水庫表水平均濁度', summary.summaryCards.surfaceAverageTurbidity],
        ['水庫表水平均酸鹼值', summary.summaryCards.surfaceAveragePH],
        ['水庫表水平均溶氧量', summary.summaryCards.surfaceAverageDissolvedOxygen],
        ['藻類數最高測站', summary.summaryCards.highestAlgaeStation],
        ['總磷最高測站', summary.summaryCards.highestTotalPhosphorusStation],
        ['透明度最低測站', summary.summaryCards.lowestTransparencyStation],
      ]
    : [
        ['Latest month', summary.summaryCards.latestPeriod],
        ['Stations in latest month', summary.summaryCards.latestStationCount],
        ['Reservoir surface avg. turbidity', summary.summaryCards.surfaceAverageTurbidity],
        ['Reservoir surface avg. pH', summary.summaryCards.surfaceAveragePH],
        ['Reservoir surface avg. dissolved oxygen', summary.summaryCards.surfaceAverageDissolvedOxygen],
        ['Highest algae count station', summary.summaryCards.highestAlgaeStation],
        ['Highest total phosphorus station', summary.summaryCards.highestTotalPhosphorusStation],
        ['Lowest transparency station', summary.summaryCards.lowestTransparencyStation],
      ];
  return (
    <div className="summary-grid">
      {cards.map(([label, value]) => (
        <div className="summary-card" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

function StationComparisonChart({
  records,
  period,
  parameter,
  language,
}: {
  records: WaterQualityRecord[];
  period: string;
  parameter: WaterQualityParameterKey;
  language: Language;
}) {
  const data = aggregateStationComparison(records, period, parameter).filter((point) => point.value !== null);
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="stationName" interval={0} angle={-35} textAnchor="end" height={72} />
        <YAxis />
        <Tooltip />
        <Bar dataKey="value" fill="#0f766e" name={parameterLabels[language][parameter]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function ParameterSeriesChart({
  records,
  parameter,
  language,
  title,
}: {
  records: WaterQualityRecord[];
  parameter: WaterQualityParameterKey;
  language: Language;
  title: string;
}) {
  const data = buildMonthlyAverageSeries(records, parameter);
  return (
    <section className="chart-block">
      <h3>{title}</h3>
      {data.length <= 1 ? (
        <p className="notice">{translations[language].oneMonthTrendNotice}</p>
      ) : (
        <ResponsiveContainer width="100%" height={230}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="period" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke="#0f766e" strokeWidth={2} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}

function DamDepthProfileChart({ records, period, language }: { records: WaterQualityRecord[]; period: string; language: Language }) {
  const data = ['大壩上', '大壩中', '大壩下'].map((stationName) => {
    const record = records.find((item) => item.period === period && item.stationName === stationName);
    return {
      stationName,
      depth: record?.values.waterDepthM.value ?? null,
      temperature: record?.values.waterTemperatureC.value ?? null,
      oxygen: record?.values.dissolvedOxygenMgL.value ?? null,
    };
  });
  return (
    <section className="chart-block">
      <h3>{language === 'zh' ? '大壩剖面' : 'Dam-depth profile'}</h3>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="stationName" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="depth" fill="#0f766e" name={parameterLabels[language].waterDepthM} />
          <Bar dataKey="temperature" fill="#f59e0b" name={parameterLabels[language].waterTemperatureC} />
          <Bar dataKey="oxygen" fill="#2563eb" name={parameterLabels[language].dissolvedOxygenMgL} />
        </BarChart>
      </ResponsiveContainer>
    </section>
  );
}

function Dashboard({
  records,
  summary,
  filters,
  language,
}: {
  records: WaterQualityRecord[];
  summary: WaterQualitySummary;
  filters: Filters;
  language: Language;
}) {
  const t = translations[language];
  const surfaceAverage = records.filter((record) => record.stationName === '表水平均值');
  const trendCharts: Array<{ parameter: WaterQualityParameterKey; title: string }> = [
    {
      parameter: filters.parameter,
      title: language === 'zh' ? '表水平均值趨勢' : 'Reservoir-surface average trend',
    },
    {
      parameter: 'algaeCellsPerML',
      title: language === 'zh' ? '藻類數趨勢' : 'Algae count trend',
    },
    {
      parameter: 'totalPhosphorusUgL',
      title: language === 'zh' ? '總磷趨勢' : 'Total phosphorus trend',
    },
    {
      parameter: 'dissolvedOxygenMgL',
      title: language === 'zh' ? '溶氧量趨勢' : 'Dissolved oxygen trend',
    },
    {
      parameter: 'pH',
      title: language === 'zh' ? '酸鹼值趨勢' : 'pH trend',
    },
  ];
  return (
    <section className="dashboard">
      <div className="section-heading">
        <h2>{t.dashboard}</h2>
        <p>{t.dataDisclaimer}</p>
      </div>
      <SummaryCards summary={summary} language={language} />
      <div className="charts">
        <section className="chart-block wide">
          <h3>{t.stationComparison} · {parameterLabels[language][filters.parameter]}</h3>
          <StationComparisonChart records={records} period={filters.period} parameter={filters.parameter} language={language} />
        </section>
        <DamDepthProfileChart records={records} period={filters.period} language={language} />
        {trendCharts.map((chart, index) => (
          <ParameterSeriesChart
            key={`${chart.parameter}-${chart.title}`}
            records={index === 0 ? surfaceAverage : records}
            parameter={chart.parameter}
            language={language}
            title={chart.title}
          />
        ))}
      </div>
    </section>
  );
}

function HydrometSummaryCards({
  summaries,
  language,
}: {
  summaries: HydrometMonthlySummary[];
  language: Language;
}) {
  const t = translations[language];
  const latest = summaries.at(-1);
  const cards = [
    [t.latestMonth, latest?.period ?? '-'],
    [t.avgTemperature, formatNumber(latest?.avgTemperatureC, '℃')],
    [t.relativeHumidity, formatNumber(latest?.avgRelativeHumidityPercent, '%')],
    [t.totalEvaporation, formatNumber(latest?.totalEvaporationMm, 'mm')],
    [t.totalSolarRadiation, formatNumber(latest?.totalSolarRadiationCalCm2, 'cal/cm2')],
    [t.dominantWindDirection, latest?.dominantWindDirection ?? '-'],
    [t.windSpeed, formatNumber(latest?.avgWindSpeedMS, 'm/s')],
    [t.airPressure, formatNumber(latest?.avgAirPressureMb, 'mb')],
  ];
  return (
    <div className="summary-grid">
      {cards.map(([label, value]) => (
        <div className="summary-card" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

function HydrometParameterChart({
  title,
  data,
  dataKey,
  color = '#0f766e',
}: {
  title: string;
  data: HydrometTrendPoint[];
  dataKey: keyof HydrometTrendPoint;
  color?: string;
}) {
  return (
    <section className="chart-block">
      <h3>{title}</h3>
      <ResponsiveContainer width="100%" height={230}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </section>
  );
}

function TemperatureBandChart({ records, language }: { records: HydrometDailyRecord[]; language: Language }) {
  const data = records.map((record) => ({
    date: record.date.slice(5),
    max: record.values.maxTemperatureC.value,
    min: record.values.minTemperatureC.value,
  }));
  return (
    <section className="chart-block">
      <h3>{translations[language].dailyTemperatureTrend}</h3>
      <ResponsiveContainer width="100%" height={230}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="max" stroke="#b7791f" strokeWidth={2} connectNulls />
          <Line type="monotone" dataKey="min" stroke="#2563eb" strokeWidth={2} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </section>
  );
}

function WindDirectionChart({ records, language }: { records: HydrometDailyRecord[]; language: Language }) {
  const counts = new Map<string, number>();
  for (const record of records) {
    if (record.windDirection) counts.set(record.windDirection, (counts.get(record.windDirection) ?? 0) + 1);
  }
  const data = [...counts.entries()].map(([direction, count]) => ({ direction, count }));
  return (
    <section className="chart-block">
      <h3>{translations[language].windDirectionDistribution}</h3>
      <ResponsiveContainer width="100%" height={230}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="direction" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" fill="#0f766e" />
        </BarChart>
      </ResponsiveContainer>
    </section>
  );
}

function MonthlyHydrometTrend({
  summaries,
  language,
  dataKey,
  title,
}: {
  summaries: HydrometMonthlySummary[];
  language: Language;
  dataKey: keyof HydrometMonthlySummary;
  title: string;
}) {
  if (summaries.length <= 1) return <p className="notice">{translations[language].oneMonthTrendNotice}</p>;
  return (
    <section className="chart-block">
      <h3>{title}</h3>
      <ResponsiveContainer width="100%" height={230}>
        <LineChart data={summaries}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="period" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey={dataKey} stroke="#0f766e" strokeWidth={2} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </section>
  );
}

function HydrometDashboard({
  records,
  summaries,
  period,
  language,
}: {
  records: HydrometDailyRecord[];
  summaries: HydrometMonthlySummary[];
  period: string;
  language: Language;
}) {
  const t = translations[language];
  const dailyRecords = records.filter((record) => record.period === period);
  const point = (record: HydrometDailyRecord, key: keyof HydrometDailyRecord['values']) => ({
    date: record.date.slice(5),
    value: record.values[key].value,
  });
  return (
    <section className="dashboard">
      <div className="section-heading">
        <h2>{t.hydromet}</h2>
        <p>{t.weatherStationCoordinateNotice}</p>
      </div>
      <HydrometSummaryCards summaries={summaries} language={language} />
      <div className="charts">
        <HydrometParameterChart title={t.avgTemperature} data={dailyRecords.map((record) => point(record, 'avgTemperatureC'))} dataKey="value" />
        <TemperatureBandChart records={dailyRecords} language={language} />
        <HydrometParameterChart title={t.dailyHumidityTrend} data={dailyRecords.map((record) => point(record, 'relativeHumidityPercent'))} dataKey="value" color="#2563eb" />
        <HydrometParameterChart title={t.dailyEvaporationTrend} data={dailyRecords.map((record) => point(record, 'evaporationMm'))} dataKey="value" color="#b7791f" />
        <HydrometParameterChart title={t.dailySolarRadiationTrend} data={dailyRecords.map((record) => point(record, 'solarRadiationCalCm2'))} dataKey="value" />
        <HydrometParameterChart title={t.dailyWindSpeedTrend} data={dailyRecords.map((record) => point(record, 'windSpeedMS'))} dataKey="value" color="#2563eb" />
        <WindDirectionChart records={dailyRecords} language={language} />
        <MonthlyHydrometTrend summaries={summaries} language={language} dataKey="avgTemperatureC" title={language === 'zh' ? '每月平均溫度趨勢' : 'Monthly average temperature trend'} />
        <MonthlyHydrometTrend summaries={summaries} language={language} dataKey="totalEvaporationMm" title={language === 'zh' ? '每月蒸發量趨勢' : 'Monthly evaporation trend'} />
        <MonthlyHydrometTrend summaries={summaries} language={language} dataKey="totalSolarRadiationCalCm2" title={language === 'zh' ? '每月日輻射量趨勢' : 'Monthly solar radiation trend'} />
      </div>
    </section>
  );
}

function WeatherWaterQualityComparisonChart({
  waterRecords,
  hydrometSummaries,
  language,
}: {
  waterRecords: WaterQualityRecord[];
  hydrometSummaries: HydrometMonthlySummary[];
  language: Language;
}) {
  const joined = joinWaterQualityAndHydrometByPeriod(waterRecords, hydrometSummaries).map((entry) => ({
    period: entry.period,
    airTemperature: entry.hydromet.avgTemperatureC,
    solarRadiation: entry.hydromet.totalSolarRadiationCalCm2,
    evaporation: entry.hydromet.totalEvaporationMm,
    waterTemperature: averageWaterQualityParameter(entry.waterRecords, 'waterTemperatureC'),
    chlorophyll: averageWaterQualityParameter(entry.waterRecords, 'chlorophyllAUgL'),
    algae: averageWaterQualityParameter(entry.waterRecords, 'algaeCellsPerML'),
    transparency: averageWaterQualityParameter(entry.waterRecords, 'transparencyM'),
    dissolvedOxygen: averageWaterQualityParameter(entry.waterRecords, 'dissolvedOxygenMgL'),
    pH: averageWaterQualityParameter(entry.waterRecords, 'pH'),
  }));
  const t = translations[language];
  return (
    <section className="dashboard">
      <div className="section-heading">
        <h2>{t.weatherWaterQualityComparison}</h2>
        <p>{t.exploratoryComparisonNotice}</p>
      </div>
      {!joined.length ? (
        <p className="notice">{t.oneMonthTrendNotice}</p>
      ) : (
      <div className="charts">
        {[
          ['airTemperature', 'waterTemperature', language === 'zh' ? '氣溫 vs 水溫' : 'Air temperature vs water temperature'],
          ['solarRadiation', 'chlorophyll', language === 'zh' ? '日輻射量 vs 葉綠素a' : 'Solar radiation vs chlorophyll-a'],
          ['airTemperature', 'algae', language === 'zh' ? '平均溫度 vs 藻類數' : 'Average temperature vs algae count'],
          ['evaporation', 'transparency', language === 'zh' ? '蒸發量 vs 透明度' : 'Evaporation vs transparency'],
          ['airTemperature', 'dissolvedOxygen', language === 'zh' ? '溶氧量與溫度對照' : 'Dissolved oxygen with temperature context'],
          ['airTemperature', 'pH', language === 'zh' ? '酸鹼值與溫度對照' : 'pH with temperature context'],
        ].map(([leftKey, rightKey, title]) => (
          <section className="chart-block" key={title}>
            <h3>{title}</h3>
            <ResponsiveContainer width="100%" height={230}>
              <LineChart data={joined}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey={leftKey} stroke="#b7791f" strokeWidth={2} connectNulls />
                <Line type="monotone" dataKey={rightKey} stroke="#0f766e" strokeWidth={2} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </section>
        ))}
      </div>
      )}
    </section>
  );
}

function csvEscape(value: unknown) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function downloadCsv(filename: string, rows: Array<Record<string, unknown>>) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(','), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function MonitoringDataTable({
  waterRecords,
  hydrometRecords,
  waterSummary,
  hydrometSummaries,
  waterParameter,
  hydrometParameter,
  language,
}: {
  waterRecords: WaterQualityRecord[];
  hydrometRecords: HydrometDailyRecord[];
  waterSummary: WaterQualitySummary;
  hydrometSummaries: HydrometMonthlySummary[];
  waterParameter: WaterQualityParameterKey;
  hydrometParameter: HydrometParameterKey;
  language: Language;
}) {
  const t = translations[language];
  const [mode, setMode] = useState<TableMode>('waterRecords');
  const rows = mode === 'waterRecords'
    ? waterRecords.map((record) => ({
        period: record.period,
        station: record.stationName,
        group: groupLabels[language][record.stationGroup],
        parameter: parameterLabels[language][waterParameter],
        value: formatValue(record.values[waterParameter], parameterUnits[waterParameter]),
        raw: record.values[waterParameter].raw,
      }))
    : mode === 'hydrometDaily'
      ? hydrometRecords.map((record) => ({
          date: record.date,
          period: record.period,
          dayType: record.weekday === 0 || record.weekday === 6 ? translations[language].weekends : translations[language].weekdays,
          parameter: hydrometParameterLabels[language][hydrometParameter],
          value: hydrometParameter === 'windDirection'
            ? record.windDirection ?? '-'
            : formatNumber(record.values[hydrometParameter].value, hydrometParameterUnits[hydrometParameter]),
          windDirection: record.windDirection ?? '-',
        }))
      : mode === 'waterSummary'
        ? waterSummary.periods.map((period) => ({ period, source: t.waterQuality }))
        : hydrometSummaries.map((summary) => ({
            period: summary.period,
            days: summary.dayCount,
            avgTemperature: formatNumber(summary.avgTemperatureC, '℃'),
            totalEvaporation: formatNumber(summary.totalEvaporationMm, 'mm'),
            dominantWindDirection: summary.dominantWindDirection ?? '-',
          }));
  return (
    <section className="table-section">
      <div className="section-heading">
        <h2>{t.dataTable}</h2>
        <button className="text-button" onClick={() => downloadCsv(`${mode}.csv`, rows)}>{t.exportCsv}</button>
      </div>
      <div className="segmented table-modes">
        {[
          ['waterRecords', t.waterQualityRecords],
          ['hydrometDaily', t.hydrometDailyRecords],
          ['waterSummary', t.waterQualityMonthlySummaries],
          ['hydrometSummary', t.hydrometMonthlySummaries],
        ].map(([id, label]) => (
          <button key={id} className={mode === id ? 'active' : ''} onClick={() => setMode(id as TableMode)}>{label}</button>
        ))}
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {Object.keys(rows[0] ?? {}).map((header) => <th key={header}>{header}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                {Object.values(row).map((value, valueIndex) => <td key={valueIndex}>{String(value)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DataQualityNotice({ language }: { language: Language }) {
  const t = translations[language];
  return (
    <section className="notice-block">
      <p>{t.ndNote}</p>
      <p>{t.dataDisclaimer}</p>
    </section>
  );
}

function Footer({ language }: { language: Language }) {
  return <footer>{translations[language].footer}</footer>;
}

export default function App() {
  const [language, setLanguageState] = useState<Language>(readSavedLanguage);
  const [records, setRecords] = useState<WaterQualityRecord[]>([]);
  const [summary, setSummary] = useState<WaterQualitySummary | null>(null);
  const [stationLocations, setStationLocations] = useState<StationLocation[]>([]);
  const [hydrometRecords, setHydrometRecords] = useState<HydrometDailyRecord[]>([]);
  const [hydrometSummaries, setHydrometSummaries] = useState<HydrometMonthlySummary[]>([]);
  const [loadError, setLoadError] = useState('');
  const [selectedStation, setSelectedStation] = useState('');
  const [activeTab, setActiveTab] = useState<MonitoringTab>('waterQuality');
  const [hydrometParameter, setHydrometParameter] = useState<HydrometParameterKey>('avgTemperatureC');
  const [hydrometDayType, setHydrometDayType] = useState<DayTypeFilter>('all');
  const [hydrometStartDate, setHydrometStartDate] = useState('');
  const [hydrometEndDate, setHydrometEndDate] = useState('');

  const latestPeriod = useMemo(() => getLatestPeriod(records), [records]);
  const periods = useMemo(() => [...new Set([
    ...records.map((record) => record.period),
    ...hydrometSummaries.map((record) => record.period),
  ])].sort(), [records, hydrometSummaries]);
  const stations = useMemo(() => [...new Set(records.map((record) => record.stationName))].sort((a, b) => a.localeCompare(b, 'zh-Hant')), [records]);
  const [filters, setFilters] = useState<Filters>({
    period: '',
    stationGroup: 'all',
    stationName: 'all',
    parameter: 'turbidityNTU',
    search: '',
  });

  useEffect(() => {
    const fetchJson = async <T,>(fileName: string): Promise<T> => {
      const response = await fetch(dataUrl(fileName));
      if (!response.ok) throw new Error(`Failed to load ${fileName}: ${response.status}`);
      return response.json() as Promise<T>;
    };

    Promise.all([
      fetchJson<WaterQualityRecord[]>('water-quality-records.json'),
      fetchJson<WaterQualitySummary>('water-quality-summary.json'),
      fetchJson<StationLocation[]>('station-locations.json'),
      fetchJson<HydrometDailyRecord[]>('hydromet-daily-records.json'),
      fetchJson<HydrometMonthlySummary[]>('hydromet-monthly-summary.json'),
    ]).then(([recordData, summaryData, locationData, hydrometDailyData, hydrometMonthlyData]) => {
      setRecords(recordData);
      setSummary(summaryData);
      setStationLocations(locationData);
      setHydrometRecords(hydrometDailyData);
      setHydrometSummaries(hydrometMonthlyData);
    }).catch((error: unknown) => {
      setLoadError(error instanceof Error ? error.message : 'Failed to load water-quality data.');
    });
  }, []);

  useEffect(() => {
    if (latestPeriod && !filters.period) setFilters((current) => ({ ...current, period: latestPeriod }));
    if (!selectedStation && stations.length) setSelectedStation(stations[0]);
  }, [latestPeriod, filters.period, selectedStation, stations]);

  function setLanguage(nextLanguage: Language) {
    saveLanguage(nextLanguage);
    setLanguageState(nextLanguage);
  }

  const filteredRecords = useMemo(() => filterRecords(records, filters), [records, filters]);
  const latestFilteredRecords = filteredRecords.filter((record) => record.period === filters.period);
  const selectedHydrometPeriod = hydrometRecords.some((record) => record.period === filters.period)
    ? filters.period
    : hydrometSummaries.at(-1)?.period ?? filters.period;
  const filteredHydrometRecords = hydrometRecords.filter((record) => {
    if (record.period !== selectedHydrometPeriod) return false;
    if (hydrometStartDate && record.date < hydrometStartDate) return false;
    if (hydrometEndDate && record.date > hydrometEndDate) return false;
    if (hydrometDayType === 'weekday') return record.weekday !== 0 && record.weekday !== 6;
    if (hydrometDayType === 'weekend') return record.weekday === 0 || record.weekday === 6;
    return true;
  });
  const t = translations[language];

  if (loadError) {
    return (
      <main className="loading" role="alert">
        <p>{loadError}</p>
      </main>
    );
  }

  if (!summary) {
    return <main className="loading">Loading</main>;
  }

  return (
    <main>
      <header className="app-header">
        <div>
          <p className="eyebrow">{t.latestMonth}: {summary.latestPeriod}</p>
          <h1>{t.appTitle}</h1>
          <p>{t.appSubtitle}</p>
        </div>
        <LanguageToggle language={language} setLanguage={setLanguage} />
      </header>

      <FilterPanel
        filters={filters}
        setFilters={setFilters}
        language={language}
        periods={periods}
        stations={stations}
      />

      <MonitoringTabs activeTab={activeTab} setActiveTab={setActiveTab} language={language} />

      {activeTab === 'waterQuality' && (
        <>
          <div className="workspace">
            <WaterQualityMap
              records={latestFilteredRecords}
              stationLocations={stationLocations}
              language={language}
              setSelectedStation={setSelectedStation}
            />
            <SelectedStationPanel
              selectedStation={selectedStation}
              records={records}
              parameter={filters.parameter}
              language={language}
            />
            <UnmappedStationsList records={latestFilteredRecords} stationLocations={stationLocations} language={language} />
          </div>
          <p className="notice-block">{t.weatherStationCoordinateNotice}</p>
          <Dashboard records={records} summary={summary} filters={filters} language={language} />
        </>
      )}

      {activeTab === 'hydromet' && (
        <>
          <section className="filters hydromet-filters">
            <label>
              <span>{t.weatherContext}</span>
              <select value={hydrometParameter} onChange={(event) => setHydrometParameter(event.target.value as HydrometParameterKey)}>
                {hydrometParameterKeys.map((parameter) => (
                  <option key={parameter} value={parameter}>{hydrometParameterLabels[language][parameter]}</option>
                ))}
              </select>
            </label>
            <label>
              <span>{t.dayType}</span>
              <select value={hydrometDayType} onChange={(event) => setHydrometDayType(event.target.value as DayTypeFilter)}>
                <option value="all">{t.allDays}</option>
                <option value="weekday">{t.weekdays}</option>
                <option value="weekend">{t.weekends}</option>
              </select>
            </label>
            <label>
              <span>{t.startDate}</span>
              <input
                value={hydrometStartDate}
                onChange={(event) => setHydrometStartDate(event.target.value)}
                inputMode="numeric"
                pattern="\\d{4}-\\d{2}-\\d{2}"
                placeholder="YYYY-MM-DD"
              />
            </label>
            <label>
              <span>{t.endDate}</span>
              <input
                value={hydrometEndDate}
                onChange={(event) => setHydrometEndDate(event.target.value)}
                inputMode="numeric"
                pattern="\\d{4}-\\d{2}-\\d{2}"
                placeholder="YYYY-MM-DD"
              />
            </label>
          </section>
          <HydrometDashboard
            records={filteredHydrometRecords}
            summaries={hydrometSummaries}
            period={selectedHydrometPeriod}
            language={language}
          />
        </>
      )}

      {activeTab === 'combinedDashboard' && (
        <WeatherWaterQualityComparisonChart
          waterRecords={records}
          hydrometSummaries={hydrometSummaries}
          language={language}
        />
      )}

      {activeTab === 'dataTable' && (
        <MonitoringDataTable
          waterRecords={filteredRecords}
          hydrometRecords={filteredHydrometRecords}
          waterSummary={summary}
          hydrometSummaries={hydrometSummaries}
          waterParameter={filters.parameter}
          hydrometParameter={hydrometParameter}
          language={language}
        />
      )}

      <DataQualityNotice language={language} />
      <Footer language={language} />
    </main>
  );
}
