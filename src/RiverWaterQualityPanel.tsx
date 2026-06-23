import { useMemo, useState } from 'react';
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
import { riverIndicatorLabels, translations, type Language } from './data/i18n';
import {
  riverIndicatorKeys,
  type RiverIndicatorKey,
  type RiverWaterQualityRecord,
  type RiverWaterQualitySummary,
  type RiverWaterQualityValue,
  type RiverStationLocation,
  type WaterValueQualifier,
} from './types/riverWaterQuality';
import { averageMeasured } from './utils/riverWaterQuality';

type Props = {
  records: RiverWaterQualityRecord[];
  summary: RiverWaterQualitySummary;
  locations: RiverStationLocation[];
  language: Language;
};

const tableIndicators: RiverIndicatorKey[] = [
  'waterTemperatureC',
  'airTemperatureC',
  'ph',
  'dissolvedOxygenMgL',
  'biochemicalOxygenDemandMgL',
  'ammoniaNitrogenMgL',
  'suspendedSolidsMgL',
  'chemicalOxygenDemandMgL',
  'turbidityNtu',
  'coliformCfuPer100Ml',
  'totalPhosphorusMgL',
  'totalNitrogenMgL',
];

function formatNumber(value: number | undefined, unit = '') {
  if (value === undefined) return '-';
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ''}`;
}

function formatValue(value: RiverWaterQualityValue, language: Language) {
  if (value.qualifier === 'not_measured') return translations[language].notMeasured;
  if (value.qualifier === 'missing') return '-';
  return value.raw ?? (value.value === undefined ? '-' : String(value.value));
}

const riverMarkerIcon = L.divIcon({
  className: 'station-marker',
  html: '<span></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

export default function RiverWaterQualityPanel({ records, summary, locations, language }: Props) {
  const t = translations[language];
  const [year, setYear] = useState('all');
  const [month, setMonth] = useState('all');
  const [river, setRiver] = useState('all');
  const [station, setStation] = useState('all');
  const [indicator, setIndicator] = useState<RiverIndicatorKey>('dissolvedOxygenMgL');
  const [qualifier, setQualifier] = useState<WaterValueQualifier | 'all'>('all');
  const [measuredOnly, setMeasuredOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'date' | 'river' | 'station'>('date');

  const years = useMemo(() => [...new Set(records.flatMap((record) => record.year ? [record.year] : []))].sort(), [records]);
  const rivers = useMemo(() => [...new Set(records.map((record) => record.riverName))].sort((a, b) => a.localeCompare(b, 'zh-Hant')), [records]);
  const stations = useMemo(() => [...new Set(records.filter((record) => river === 'all' || record.riverName === river).map((record) => record.stationName))].sort((a, b) => a.localeCompare(b, 'zh-Hant')), [records, river]);

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    const indicatorMatches = riverIndicatorLabels[language][indicator].toLocaleLowerCase().includes(term);
    return records.filter((record) => {
      const value = record[indicator];
      if (year !== 'all' && record.year !== Number(year)) return false;
      if (month !== 'all' && record.month !== Number(month)) return false;
      if (river !== 'all' && record.riverName !== river) return false;
      if (station !== 'all' && record.stationName !== station) return false;
      if (qualifier !== 'all' && value.qualifier !== qualifier) return false;
      if (measuredOnly && value.qualifier !== 'measured') return false;
      if (term && !indicatorMatches && !`${record.riverName} ${record.stationName}`.toLocaleLowerCase().includes(term)) return false;
      return true;
    }).sort((a, b) => {
      if (sort === 'river') return `${a.riverName}-${a.stationName}-${a.year}-${a.month}`.localeCompare(`${b.riverName}-${b.stationName}-${b.year}-${b.month}`, 'zh-Hant');
      if (sort === 'station') return `${a.stationName}-${a.year}-${a.month}`.localeCompare(`${b.stationName}-${b.year}-${b.month}`, 'zh-Hant');
      return `${a.year}-${String(a.month).padStart(2, '0')}-${a.sequenceNumber}`.localeCompare(`${b.year}-${String(b.month).padStart(2, '0')}-${b.sequenceNumber}`);
    });
  }, [indicator, language, measuredOnly, month, qualifier, records, river, search, sort, station, year]);

  const grouped = (keyOf: (record: RiverWaterQualityRecord) => string) => {
    const groups = new Map<string, RiverWaterQualityRecord[]>();
    for (const record of filtered) {
      const key = keyOf(record);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(record);
    }
    return groups;
  };

  const recordsByRiver = [...grouped((record) => record.riverName)].map(([name, items]) => ({ name, value: items.length }));
  const stationsByRiver = [...grouped((record) => record.riverName)].map(([name, items]) => ({ name, value: new Set(items.map((record) => record.stationName)).size }));
  const monthlyTrend = [...grouped((record) => `${record.year}-${String(record.month).padStart(2, '0')}`)]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, items]) => ({ name, value: averageMeasured(items, indicator) }));
  const byRiver = [...grouped((record) => record.riverName)].map(([name, items]) => ({ name, value: averageMeasured(items, indicator) }));
  const byStation = [...grouped((record) => record.stationName)].map(([name, items]) => ({ name, value: averageMeasured(items, indicator) }));
  const qualifierLabels: Record<WaterValueQualifier, string> = {
    measured: t.measured,
    not_detected_below: t.notDetectedBelow,
    not_measured: t.notMeasured,
    missing: t.missing,
    unparsed: t.unparsed,
  };
  const qualifierData = (['measured', 'not_detected_below', 'not_measured', 'missing', 'unparsed'] as WaterValueQualifier[]).map((key) => ({
    name: qualifierLabels[key],
    value: filtered.filter((record) => record[indicator].qualifier === key).length,
  }));

  const cards = [
    [t.totalMonitoringRecords, filtered.length],
    [t.riverCount, new Set(filtered.map((record) => record.riverName)).size],
    [t.stationCount, new Set(filtered.map((record) => `${record.riverName}-${record.stationName}`)).size],
    [t.monthCount, new Set(filtered.map((record) => `${record.year}-${record.month}`)).size],
    [t.year, summary.years.join(', ')],
    [t.averageDissolvedOxygen, formatNumber(averageMeasured(filtered, 'dissolvedOxygenMgL'), 'mg/L')],
    [t.averageBod, formatNumber(averageMeasured(filtered, 'biochemicalOxygenDemandMgL'), 'mg/L')],
    [t.averageAmmoniaNitrogen, formatNumber(averageMeasured(filtered, 'ammoniaNitrogenMgL'), 'mg/L')],
    [t.averageCod, formatNumber(averageMeasured(filtered, 'chemicalOxygenDemandMgL'), 'mg/L')],
    [t.averageTurbidity, formatNumber(averageMeasured(filtered, 'turbidityNtu'), 'NTU')],
    [t.averageColiform, formatNumber(averageMeasured(filtered, 'coliformCfuPer100Ml'), 'CFU/100mL')],
    [t.notDetectedBelow, summary.valueQuality.notDetectedValueCount],
    [t.notMeasured, summary.valueQuality.notMeasuredValueCount],
  ];
  const locationRecords = locations.flatMap((location) => {
    const matches = filtered.filter((record) => record.riverName === location.riverName && record.stationName === location.stationName);
    const record = matches.at(-1);
    return record ? [{ location, record }] : [];
  });
  const mapCenter: [number, number] = locations.length
    ? [
        locations.reduce((sum, location) => sum + location.latitude, 0) / locations.length,
        locations.reduce((sum, location) => sum + location.longitude, 0) / locations.length,
      ]
    : [25.04, 121.56];

  const chart = (title: string, data: Array<{ name: string; value?: number }>, kind: 'bar' | 'line' = 'bar') => (
    <section className="chart-block">
      <h3>{title}</h3>
      <ResponsiveContainer width="100%" height={240}>
        {kind === 'line' ? (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke="#0f766e" strokeWidth={2} connectNulls />
          </LineChart>
        ) : (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" interval={0} angle={-25} textAnchor="end" height={72} />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" fill="#0f766e" />
          </BarChart>
        )}
      </ResponsiveContainer>
    </section>
  );

  return (
    <section className="river-module">
      <div className="section-heading">
        <div>
          <h2>{t.riverWaterQualityFull}</h2>
          <p>{t.riverWaterQualitySubtitle}</p>
        </div>
      </div>

      <section className="filters river-filters" aria-label={t.riverWaterQuality}>
        <label><span>{t.year}</span><select value={year} onChange={(event) => setYear(event.target.value)}><option value="all">{t.all}</option>{years.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label><span>{t.month}</span><select value={month} onChange={(event) => setMonth(event.target.value)}><option value="all">{t.all}</option>{Array.from({ length: 12 }, (_, index) => index + 1).map((item) => <option key={item}>{item}</option>)}</select></label>
        <label><span>{t.riverName}</span><select value={river} onChange={(event) => { setRiver(event.target.value); setStation('all'); }}><option value="all">{t.all}</option>{rivers.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label><span>{t.stationName}</span><select value={station} onChange={(event) => setStation(event.target.value)}><option value="all">{t.all}</option>{stations.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label><span>{t.parameter}</span><select value={indicator} onChange={(event) => setIndicator(event.target.value as RiverIndicatorKey)}>{riverIndicatorKeys.map((key) => <option key={key} value={key}>{riverIndicatorLabels[language][key]}</option>)}</select></label>
        <label><span>{t.valueQualifierDistribution}</span><select value={qualifier} onChange={(event) => setQualifier(event.target.value as WaterValueQualifier | 'all')}><option value="all">{t.allQualifiers}</option><option value="measured">{t.measured}</option><option value="not_detected_below">{t.notDetectedBelow}</option><option value="not_measured">{t.notMeasured}</option><option value="missing">{t.missing}</option><option value="unparsed">{t.unparsed}</option></select></label>
        <label><span>{t.monitoringRecords}</span><select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}><option value="date">{t.sortByDate}</option><option value="river">{t.sortByRiver}</option><option value="station">{t.sortByStation}</option></select></label>
        <label><span>{t.riverWaterSearchPlaceholder}</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t.riverWaterSearchPlaceholder} /></label>
        <label className="check-field"><input type="checkbox" checked={measuredOnly} onChange={(event) => setMeasuredOnly(event.target.checked)} /><span>{t.measuredOnly}</span></label>
      </section>

      <section className="dashboard">
        <div className="section-heading"><h2>{t.riverOverview}</h2><p>{t.riverStationNoCoordinateNotice}</p></div>
        <div className="summary-grid">{cards.map(([label, value]) => <div className="summary-card" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
        {locations.length > 0 && (
          <div className="river-map-wrap">
            <MapContainer center={mapCenter} zoom={11} scrollWheelZoom={false} className="map">
              <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {locationRecords.map(({ location, record }) => (
                <Marker key={`${location.riverName}-${location.stationName}`} position={[location.latitude, location.longitude]} icon={riverMarkerIcon}>
                  <Popup>
                    <strong>{record.riverName} · {record.stationName}</strong>
                    <p>{record.year}-{String(record.month).padStart(2, '0')}</p>
                    <p>pH: {formatValue(record.ph, language)}</p>
                    <p>{riverIndicatorLabels[language].dissolvedOxygenMgL}: {formatValue(record.dissolvedOxygenMgL, language)}</p>
                    <p>{riverIndicatorLabels[language].biochemicalOxygenDemandMgL}: {formatValue(record.biochemicalOxygenDemandMgL, language)}</p>
                    <a href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`} target="_blank" rel="noreferrer">Google Maps</a>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        )}
        <div className="charts">
          {chart(t.recordsByRiver, recordsByRiver)}
          {chart(t.stationsByRiver, stationsByRiver)}
          {chart(`${t.monthlyTrends} · ${riverIndicatorLabels[language][indicator]}`, monthlyTrend, 'line')}
          {chart(`${t.indicatorComparisonByRiver} · ${riverIndicatorLabels[language][indicator]}`, byRiver)}
          {chart(`${t.indicatorComparisonByStation} · ${riverIndicatorLabels[language][indicator]}`, byStation)}
          {chart(t.valueQualifierDistribution, qualifierData)}
        </div>
      </section>

      <section className="table-section">
        <div className="section-heading"><h2>{t.monitoringRecords}</h2><p>{filtered.length}</p></div>
        <div className="table-wrap river-table">
          <table>
            <thead><tr><th>{t.year}</th><th>{t.month}</th><th>{t.riverName}</th><th>{t.stationName}</th>{tableIndicators.map((key) => <th key={key}>{riverIndicatorLabels[language][key]}</th>)}<th>{language === 'zh' ? '數值註記' : 'Value notes'}</th></tr></thead>
            <tbody>{filtered.map((record) => (
              <tr key={record.id}>
                <td>{record.year ?? '-'}</td><td>{record.month}</td><td>{record.riverName}</td><td>{record.stationName}</td>
                {tableIndicators.map((key) => <td key={key} title={record[key].qualifier === 'not_detected_below' ? t.belowDetectionLimit : undefined}>{formatValue(record[key], language)}</td>)}
                <td>{record[indicator].qualifier !== 'measured' ? formatValue(record[indicator], language) : '-'}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>

      <section className="notice-block">
        <p>{t.notDetectedNote}</p>
        <p>{t.riverWaterQualityDataNote}</p>
        <p>{t.waterSourceScopeNote}</p>
        <p>{t.waterDataDisclaimer}</p>
      </section>
    </section>
  );
}
