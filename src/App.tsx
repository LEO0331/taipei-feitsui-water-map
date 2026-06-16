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
import { groupLabels, parameterLabels, parameterUnits, translations, type Language } from './data/i18n';
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

function WaterQualityTable({ records, parameter, language }: { records: WaterQualityRecord[]; parameter: WaterQualityParameterKey; language: Language }) {
  const t = translations[language];
  return (
    <section className="table-section">
      <div className="section-heading">
        <h2>{t.dataTable}</h2>
        <p>{t.ndNote}</p>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{t.period}</th>
              <th>{t.station}</th>
              <th>{t.stationGroup}</th>
              <th>{parameterLabels[language][parameter]}</th>
              <th>{language === 'zh' ? '原始值' : 'Raw value'}</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id}>
                <td>{record.period}</td>
                <td>{record.stationName}</td>
                <td>{groupLabels[language][record.stationGroup]}</td>
                <td>{formatValue(record.values[parameter], parameterUnits[parameter])}</td>
                <td>{record.values[parameter].raw || '-'}</td>
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
  const [loadError, setLoadError] = useState('');
  const [selectedStation, setSelectedStation] = useState('');

  const latestPeriod = useMemo(() => getLatestPeriod(records), [records]);
  const periods = useMemo(() => [...new Set(records.map((record) => record.period))].sort(), [records]);
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
    ]).then(([recordData, summaryData, locationData]) => {
      setRecords(recordData);
      setSummary(summaryData);
      setStationLocations(locationData);
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

      <Dashboard records={records} summary={summary} filters={filters} language={language} />
      <WaterQualityTable records={filteredRecords} parameter={filters.parameter} language={language} />
      <DataQualityNotice language={language} />
      <Footer language={language} />
    </main>
  );
}
