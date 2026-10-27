import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { riverIndicatorLabels, type Language } from './data/i18n';
import { riverIndicatorKeys, type RiverIndicatorKey, type WaterValueQualifier } from './types/riverWaterQuality';
import type { PolicyPointer, PolicyRow, PolicySnapshot } from './types/riverWaterPolicy';
import { loadPolicySnapshot, validPolicyValue, observedPolicyRow } from './utils/riverWaterPolicy';
import { riverColumnMap } from './utils/riverWaterQuality';
import {
  DEFAULT_POLICY_CONFIG, buildPolicyCandidates, runPolicyScenario, comparePolicyScenarios,
  makePolicyBriefing, policyBriefingCsv, policyBriefingJson,
  type PolicyCapacity, type PolicyConfig, type PolicyStrategy,
} from './utils/riverWaterPolicyScenarios';
import './riverWaterPolicy.css';

const pageSize = 12;
function download(content: string, extension: 'json' | 'csv') {
  const url = URL.createObjectURL(new Blob([content], { type: extension === 'json' ? 'application/json' : 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = `river-monitoring-evidence-review.${extension}`; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function EvidenceTable({ caption, headings, children }: { caption: string; headings: string[]; children: ReactNode }) {
  return <div className="table-wrap" tabIndex={0} role="region" aria-label={caption}><table><caption>{caption}</caption><thead><tr>{headings.map(heading => <th scope="col" key={heading}>{heading}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;
}

export default function RiverWaterPolicyDashboard({ language }: { language: Language }) {
  const t = (zh: string, en: string) => language === 'zh' ? zh : en;
  const [loaded, setLoaded] = useState<{ snapshot: PolicySnapshot; pointer: PolicyPointer } | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [year, setYear] = useState('all');
  const [source, setSource] = useState('all');
  const [river, setRiver] = useState('all');
  const [station, setStation] = useState('all');
  const [indicator, setIndicator] = useState<'all' | RiverIndicatorKey>('all');
  const [mode, setMode] = useState<PolicyConfig['mode']>('A');
  const [evidence, setEvidence] = useState<PolicyConfig['evidence']>('strict');
  const [capacity, setCapacity] = useState<PolicyCapacity>(5);
  const [strategy, setStrategy] = useState<PolicyStrategy>('gaps');
  const [rowPage, setRowPage] = useState(0);
  const [candidatePage, setCandidatePage] = useState(0);
  const [chartStation, setChartStation] = useState('');
  const [exportError, setExportError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setError(''); setLoaded(null);
    loadPolicySnapshot(import.meta.env.BASE_URL, controller.signal)
      .then(result => { if (!controller.signal.aborted) setLoaded(result); })
      .catch((reason: unknown) => { if (!controller.signal.aborted) setError(String(reason)); });
    return () => controller.abort();
  }, [attempt]);
  const snapshot = loaded?.snapshot;
  const config = useMemo<PolicyConfig>(() => ({ ...DEFAULT_POLICY_CONFIG, mode, evidence, years: year === 'all' ? [] : [Number(year)], rivers: river === 'all' ? [] : [river], stations: station === 'all' ? [] : [station], sourceIds: source === 'all' ? [] : [source], indicator }), [mode, evidence, year, river, station, source, indicator]);
  const candidates = useMemo(() => snapshot ? buildPolicyCandidates(snapshot, config) : [], [snapshot, config]);
  const result = useMemo(() => runPolicyScenario(candidates, strategy, capacity), [candidates, strategy, capacity]);
  const alternate = useMemo(() => runPolicyScenario(candidates, strategy === 'gaps' ? 'balanced' : 'gaps', capacity), [candidates, strategy, capacity]);
  const strategyComparison = useMemo(() => comparePolicyScenarios(result, alternate), [result, alternate]);
  const capacityComparison = useMemo(() => comparePolicyScenarios(result, runPolicyScenario(candidates, strategy, capacity === 5 ? 10 : 5)), [result, candidates, strategy, capacity]);
  const evidenceComparison = useMemo(() => comparePolicyScenarios(result, runPolicyScenario(snapshot ? buildPolicyCandidates(snapshot, { ...config, evidence: evidence === 'strict' ? 'limited' : 'strict' }) : [], strategy, capacity)), [snapshot, config, result, evidence, strategy, capacity]);
  const rows = useMemo(() => snapshot?.rows.filter(row => (year === 'all' || row.year === Number(year)) && (source === 'all' || row.sourceId === source) && (river === 'all' || row.riverName === river) && (station === 'all' || row.stationId === station)) ?? [], [snapshot, year, source, river, station]);
  const stations = useMemo(() => snapshot?.stations.filter(item => river === 'all' || item.riverName === river) ?? [], [snapshot, river]);
  const chartIndicator = indicator === 'all' ? 'dissolvedOxygenMgL' : indicator;
  const effectiveChartStation = station !== 'all' ? station : stations.some(item => item.stationId === chartStation) ? chartStation : stations[0]?.stationId;
  const chartRows = useMemo(() => {
    const byPeriod = new Map<string, PolicyRow[]>();
    for (const row of rows.filter(item => item.stationId === effectiveChartStation)) byPeriod.set(row.period, [...(byPeriod.get(row.period) ?? []), row]);
    return (snapshot?.coverage.find(item => item.stationId === effectiveChartStation)?.periods ?? []).filter(item => (year === 'all' || item.period.startsWith(`${year}-`)) && (source === 'all' || snapshot?.sources.find(s => s.sourceId === source)?.year === Number(item.period.slice(0, 4)))).map(item => {
      const values = byPeriod.get(item.period) ?? [];
      const row = values.length === 1 ? values[0] : undefined;
      const cell = row?.values[chartIndicator];
      return { period: item.period, value: row && observedPolicyRow(row) && cell && validPolicyValue(cell, chartIndicator) ? cell.value : null, status: row?.status ?? 'absent', raw: cell?.raw ?? '—' };
    });
  }, [snapshot, rows, effectiveChartStation, chartIndicator, year, source]);
  const quality = useMemo(() => riverIndicatorKeys.map(key => {
    const counts: Record<WaterValueQualifier, number> = { measured: 0, not_detected_below: 0, not_measured: 0, missing: 0, unparsed: 0 };
    let exact = 0;
    for (const row of rows) { counts[row.values[key].qualifier] += 1; if (observedPolicyRow(row) && validPolicyValue(row.values[key], key)) exact += 1; }
    return { key, counts, exact };
  }), [rows]);
  const selectedIds = new Set(result.selectedIds);
  const sortedCandidates = useMemo(() => [...result.selected, ...candidates.filter(item => !result.selectedIds.includes(item.id))], [candidates, result]);
  useEffect(() => { setRowPage(0); setCandidatePage(0); }, [config, capacity, strategy]);
  const reset = () => { setYear('all'); setSource('all'); setRiver('all'); setStation('all'); setIndicator('all'); setMode('A'); setEvidence('strict'); setCapacity(5); setStrategy('gaps'); };
  const statusLabel = (value: string) => ({ valid_observed: t('有效量測列', 'Valid observed row'), partially_observed: t('部分量測列', 'Partially observed row'), present_no_indicators: t('已公布、無量測', 'Published, no measurements'), future_placeholder: t('未來預留列', 'Future placeholder'), historical_missing: t('歷史缺測列', 'Historical missing observation'), unparseable: t('無法解析的來源列', 'Unparseable source row'), duplicate: t('重複站期', 'Duplicate station-period'), absent: t('無公布列', 'Absent published row') })[value] ?? value;
  const qualifierLabel = (value: string) => ({ measured: t('數值量測', 'Measured'), not_detected_below: t('低於偵測限', 'Censored below limit'), not_measured: t('未量測（---）', 'Not measured (---)'), missing: t('空白／缺值', 'Missing / blank'), unparsed: t('未解析', 'Unparsed') })[value] ?? value;
  const issueLabel = (code: string) => ({ duplicate_period: t('重複站期需核實', 'Verify duplicate station-period'), invalid_period: t('年月無效', 'Invalid year/month'), identity_ambiguous: t('監測站身分不明確', 'Ambiguous station identity'), identity_unmatched: t('站名未對應官方名單', 'Station label unmatched'), contradictory_river: t('河川歸屬矛盾', 'Conflicting river assignment'), unparseable_essential: t('關鍵欄位未解析', 'Unparsed essential field'), incompatible_schema: t('來源欄位不相容', 'Incompatible source schema'), future_measurement: t('未來期間出現量測，需核實', 'Verify measurement in future period'), unparsed_value: t('數值未解析', 'Unparsed value'), invalid_value: t('數值有效性疑問', 'Value validity question'), historical_missing: t('歷史期間無有效量測', 'No valid historical measurement'), partial_measurement: t('部分指標未量測', 'Some indicators unmeasured'), missing_rpi_inputs: t('RPI 四項輸入不完整', 'Incomplete four-indicator RPI inputs'), censored_value: t('偵測限限制精確比較', 'Censoring limits exact comparison'), identity_unverified: t('歷史實體站點連續性未核實', 'Historical physical continuity unverified'), historical_location_unverified: t('歷史實體站點連續性未核實', 'Historical physical continuity unverified'), current_period_pending: t('本月尚未完結，等待公布量測', 'Current month is open; measurements pending'), incomplete_matched_year: t('同月跨年配對涵蓋不完整', 'Incomplete matched-month year coverage'), no_exact_pairs: t('沒有合格精確配對', 'No eligible exact pairs'), comparison_year_outside_scope: t('配對年份超出範圍', 'Paired year outside scope'), comparison_source_outside_scope: t('配對來源超出範圍', 'Paired source outside scope'), missing_source_lineage: t('配對來源鏈不完整', 'Incomplete paired source lineage'), physical_continuity_unverified: t('歷史實體站點連續性未核實', 'Historical physical continuity unverified'), sampling_method_unknown: t('採樣方法連續性未知', 'Sampling-method continuity unknown'), future_placeholder_not_due: t('未來預留，尚未到期', 'Future placeholder, not due'), strict_comparison_evidence_insufficient: t('嚴格比較證據不足', 'Insufficient strict comparison evidence'), insufficient_pairs: t('配對量測不足', 'Insufficient paired measurements') } as Record<string, string>)[code] ?? t('需依技術代碼查核來源證據', 'Review source evidence using the technical issue code');
  if (error) return <section className="notice-block" role="alert"><h2>{t('監測證據載入失敗', 'Monitoring evidence could not load')}</h2><p>{t('快照未通過載入或完整性驗證。', 'The snapshot could not be loaded or verified.')}</p><details><summary>{t('技術資訊', 'Technical details')}</summary><p>{error}</p></details><button onClick={() => setAttempt(value => value + 1)}>{t('重試', 'Retry')}</button></section>;
  if (!loaded || !snapshot) return <p role="status">{t('正在載入並驗證監測證據快照…', 'Loading and verifying the monitoring evidence snapshot…')}</p>;
  const exportBriefing = (extension: 'json' | 'csv') => {
    try { setExportError(''); const briefing = makePolicyBriefing(snapshot, config, result, loaded.pointer); download(extension === 'json' ? policyBriefingJson(briefing) : policyBriefingCsv(briefing), extension); }
    catch { setExportError(t('摘要超過大小限制或無法建立，請縮小範圍後重試。', 'The briefing could not be created or exceeded the size limit. Narrow the scope and retry.')); }
  };
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const candidatePageCount = Math.max(1, Math.ceil(sortedCandidates.length / pageSize));
  const rowCounts = { published: rows.length, observed: rows.filter(observedPolicyRow).length, future: rows.filter(row => row.status === 'future_placeholder').length, partial: rows.filter(row => row.status === 'partially_observed').length };
  const comparisonRows = snapshot.comparisons.filter(item => (river === 'all' || item.riverName === river) && (station === 'all' || item.stationId === station) && (indicator === 'all' || item.indicator === indicator) && (year === 'all' || item.fromYear === Number(year) || item.toYear === Number(year)) && (source === 'all' || [item.fromYear, item.toYear].includes(snapshot.sources.find(s => s.sourceId === source)?.year ?? 0)));
  return <section className="river-policy" aria-label={t('河川水質監測證據查核', 'River monitoring evidence review')}>
    <section className="notice-block policy-intro">
      <p className="eyebrow">{t('政策問題 → 查核方法 → 已驗證發現 → 證據限制', 'Policy question → Review method → Verified findings → Evidence limits')}</p>
      <h2>{t('臺北市河川水質監測與長期趨勢證據查核決策支援', 'Taipei River Water Quality Monitoring & Longitudinal Evidence Review')}</h2>
      <p>{t('監測資料查核名額有限，哪些站點、月份與指標應優先核實資料品質及可比性？', 'With limited review capacity, which stations, months and indicators warrant data-quality and comparability investigation?')}</p>
      <p><strong>{t('查核級別代表文件證據問題，不是污染嚴重度。月資料不能單獨證明污染原因、法規符合性或飲用／游泳安全。', 'Review tiers describe documentary evidence questions. Monthly records alone cannot establish pollution causes, regulatory compliance, or drinking and swimming suitability.')}</strong></p>
      <small>{t('固定分析日', 'Fixed analysis date')}: {snapshot.analysisDate} · {t('靜態官方來源年版', 'Static official source editions')}: {snapshot.sources.map(item => item.year).join(' / ')}</small>
    </section>

    <section className="notice-block">
      <h3>{t('官方來源年版與可行性', 'Official source editions & feasibility')}</h3>
      <p>{t('離線解析已准入的官方 CSV 原始位元組；資料發布時間、列數與實際採樣量不同。舊河川探索器資料另行保留。', 'Offline analysis uses admitted original official CSV bytes. Publication time, row count and actual sampling differ. Historical river-explorer data remains separate.')}</p>
      <EvidenceTable caption={t('112–115 年監測來源', 'ROC 112–115 monitoring sources')} headings={[t('年版', 'Edition'), t('官方更新', 'Official update'), t('公布列', 'Published rows'), t('量測列', 'Observed rows'), t('預留列', 'Placeholders'), t('來源證據', 'Source evidence')]}>
        {snapshot.sources.map(item => <tr key={item.sourceId}><td>{item.yearRoc} / {item.year}</td><td>{item.updatedAt}</td><td>{snapshot.rows.filter(row => row.sourceId === item.sourceId).length}</td><td>{snapshot.rows.filter(row => row.sourceId === item.sourceId && observedPolicyRow(row)).length}</td><td>{snapshot.rows.filter(row => row.sourceId === item.sourceId && row.status === 'future_placeholder').length}</td><td><a href={item.catalogueUrl} target="_blank" rel="noreferrer">{t('官方目錄', 'Official catalogue')}</a><details><summary>{t('版本與原始雜湊', 'Edition & original hash')}</summary><p>{t('資源 ID', 'Resource ID')}: {item.resourceId}</p><p>{item.publisher} · {item.encoding} · {item.byteLength.toLocaleString()} bytes</p><p>{t('擷取', 'Retrieved')}: {item.retrievedAt}</p><code>SHA-256: {item.sha256}</code><p><a href={item.downloadUrl} target="_blank" rel="noreferrer">{t('官方下載', 'Official download')}</a></p></details></td></tr>)}
      </EvidenceTable>
    </section>

    <section className="river-policy-controls" aria-label={t('監測查核範圍與假設', 'Monitoring review scope & assumptions')}>
      <label>{t('來源年版', 'Source edition')}<select value={source} onChange={event => setSource(event.target.value)}><option value="all">{t('全部已准入來源', 'All admitted sources')}</option>{snapshot.sources.map(item => <option key={item.sourceId} value={item.sourceId}>{item.yearRoc} / {item.year}</option>)}</select></label>
      <label>{t('觀測年份', 'Observation year')}<select value={year} onChange={event => setYear(event.target.value)}><option value="all">{t('全部年份', 'All years')}</option>{snapshot.sources.map(item => <option key={item.year}>{item.year}</option>)}</select></label>
      <label>{t('河川', 'River')}<select value={river} onChange={event => { setRiver(event.target.value); setStation('all'); }}><option value="all">{t('全部河川', 'All rivers')}</option>{[...new Set(snapshot.stations.map(item => item.riverName))].sort().map(name => <option key={name}>{name}</option>)}</select></label>
      <label>{t('監測站', 'Monitoring station')}<select value={station} onChange={event => setStation(event.target.value)}><option value="all">{t('全部監測站', 'All stations')}</option>{stations.map(item => <option key={item.stationId} value={item.stationId}>{item.riverName} · {item.stationName}</option>)}</select></label>
      <label>{t('指標', 'Indicator')}<select value={indicator} onChange={event => setIndicator(event.target.value as typeof indicator)}><option value="all">{t('全部 27 項指標', 'All 27 indicators')}</option>{riverIndicatorKeys.map(key => <option key={key} value={key}>{riverIndicatorLabels[language][key]}</option>)}</select></label>
      <label>{t('查核模式', 'Review mode')}<select value={mode} onChange={event => setMode(event.target.value as typeof mode)}><option value="A">{t('A 監測證據整備', 'A Monitoring evidence readiness')}</option><option value="B">{t('B 可比性與 RPI 證據', 'B Comparability & RPI evidence')}</option><option value="C">{t('C 因果／法規判定（不可用）', 'C Causal / regulatory conclusions (unavailable)')}</option></select></label>
      <label>{t('比較證據要求', 'Comparison evidence')}<select value={evidence} onChange={event => setEvidence(event.target.value as typeof evidence)}><option value="strict">{t('嚴格：核實實體站點連續性', 'Strict: verified physical continuity')}</option><option value="limited">{t('有限：僅同名標籤描述配對', 'Limited: same-label descriptive pairs')}</option></select></label>
      <label>{t('文件查核名額', 'Documentary review slots')}<select value={String(capacity)} onChange={event => setCapacity(event.target.value === 'all' ? 'all' : Number(event.target.value) as 5 | 10)}><option value="5">5</option><option value="10">10</option><option value="all">{t('全部合格候選', 'All eligible')}</option></select></label>
      <label>{t('查核策略', 'Review strategy')}<select value={strategy} onChange={event => setStrategy(event.target.value as PolicyStrategy)}><option value="gaps">{t('證據缺口優先', 'Evidence gaps first')}</option><option value="balanced">{t('河川與站點均衡查核', 'Balanced monitoring review')}</option></select></label>
      <button onClick={reset}>{t('重設查核範圍', 'Reset review scope')}</button>
    </section>
    <section className="cards" aria-live="polite">{[[t('範圍內公布列', 'Scoped published rows'), rowCounts.published], [t('實際量測列', 'Observed measurement rows'), rowCounts.observed], [t('未來預留列', 'Future placeholders'), rowCounts.future], [t('部分量測列', 'Partially observed rows'), rowCounts.partial], [t('合格查核候選', 'Eligible review candidates'), result.eligiblePopulation], [t('已選查核候選', 'Selected review candidates'), result.selectedCount]].map(([label, value]) => <article className="card" key={label}><span>{label}</span><strong>{value}</strong></article>)}</section>

    <section className="notice-block">
      <h3>{t('監測完整性與站點身分', 'Monitoring coverage & station identity')}</h3>
      <p>{t('下表為固定分析日的完整站點期間。每月一次的公布計畫不等於每月都有可用量測；設站與停站日期未知，因此預期分母是假設該標籤在已准入年份內每月持續監測。當月未完結與未來期間不當作逾期。', 'The table covers each station’s full admitted period at the fixed cutoff. A monthly publication schedule does not prove usable monthly measurements. Commissioning and discontinuation dates are unknown; denominators assume monthly label continuity during admitted years. The open current month and future periods are not overdue.')}</p>
      <EvidenceTable caption={t('站點涵蓋與身分查核（完整期間）', 'Station coverage & identity audit (full period)')} headings={[t('河川／站點', 'River / station'), t('起訖月份', 'First / last period'), t('預期／公布／量測', 'Expected / published / observed'), t('未有量測（含當月）／預留／部分', 'Without observations (incl. current month) / future / partial'), t('四項輸入完整', 'Complete four inputs'), t('身分與地理證據', 'Identity & geography')]}>
        {snapshot.coverage.filter(item => (river === 'all' || item.riverName === river) && (station === 'all' || item.stationId === station)).map(item => { const identity = snapshot.stations.find(s => s.stationId === item.stationId); return <tr key={item.stationId}><td>{item.riverName} · {item.stationName}</td><td>{item.firstPeriod} – {item.lastPeriod}</td><td>{item.expectedStationMonthCount} / {item.publishedRowCount} / {item.observedRowCount}</td><td>{item.missingStationMonthCount} / {item.placeholderCount} / {item.partiallyMeasuredRowCount}</td><td>{item.completeFourIndicatorCount}</td><td>{identity?.identityStatus === 'label_verified' ? t('目前官方站名已對應', 'Current official label matched') : t('站名需核實', 'Station label needs review')}<br />{t('歷史實體位置連續性未核實；不建立地圖圖釘。', 'Historical physical continuity unverified; no map pins admitted.')}<details><summary>{t('來源與標籤', 'Evidence & labels')}</summary><p>{identity?.rawLabels?.join(' / ') ?? item.stationName}</p>{identity?.evidenceUrls.map(url => <p key={url}><a href={url} target="_blank" rel="noreferrer">{t('官方身分脈絡', 'Official identity context')}</a></p>)}</details></td></tr>; })}
      </EvidenceTable>
    </section>

    <section className="notice-block">
      <h3>{t('實際量測、缺測與預留列', 'Observed measurements, missingness & placeholders')}</h3>
      <p>{t('公布 CSV 列不是一次已完成採樣。空白未來列保留為預留機會，不列為已量測或逾期；無法解析及重複站期另行標示。', 'A published CSV row is not a completed sample. Empty future rows remain opportunities, excluded from observed and overdue counts. Unparseable and duplicate station-periods have separate states.')}</p>
      <EvidenceTable caption={t('範圍內原始列與指標證據', 'Scoped source rows & indicator evidence')} headings={[t('月份', 'Period'), t('河川／站點', 'River / station'), t('觀測狀態', 'Observation state'), t('指標原始值', 'Raw indicator value'), t('查核證據', 'Review evidence')]}>
        {rows.slice(rowPage * pageSize, (rowPage + 1) * pageSize).map(row => <tr key={row.id}><td>{row.period}</td><td>{row.riverName} · {row.stationName}</td><td>{statusLabel(row.status)}</td><td>{riverIndicatorLabels[language][chartIndicator]}: {row.values[chartIndicator].raw ?? '—'} {row.values[chartIndicator].unit}<br /><small>{qualifierLabel(row.values[chartIndicator].qualifier)}</small></td><td><details><summary>{t('27 項指標與原始列 ID', '27 indicators & original row ID')}</summary><code>{row.id}</code><p>{t('來源列', 'Source row')}: {row.rowNumber} · {row.sourceId}</p>{riverIndicatorKeys.map(key => <p key={key}>{riverIndicatorLabels[language][key]}: {row.values[key].raw ?? '—'} {row.values[key].unit} · {qualifierLabel(row.values[key].qualifier)}{row.values[key].detectionLimit !== undefined && <> · {t('偵測限', 'Detection limit')}: {row.values[key].detectionLimit}</>}</p>)}</details></td></tr>)}
        {!rows.length && <tr><td colSpan={5}>{t('此範圍沒有公布列。', 'No published rows in this scope.')}</td></tr>}
      </EvidenceTable>
      <div className="policy-actions"><button disabled={rowPage === 0} onClick={() => setRowPage(value => value - 1)}>{t('上一頁量測', 'Previous measurements')}</button><span>{rowPage + 1} / {pageCount}</span><button disabled={rowPage + 1 >= pageCount} onClick={() => setRowPage(value => value + 1)}>{t('下一頁量測', 'Next measurements')}</button></div>
    </section>

    <section className="notice-block">
      <h3>{t('指標品質與偵測限', 'Indicator quality & detection limits')}</h3>
      <p>{t('ND<0.02 與 <10 為設限觀測，不是零或精確量測；--- 是未量測，空白是缺值。下表保留各類別，精確比較另排除無效值與不合格觀測列。不以零、半偵測限或平均值補值。', 'ND<0.02 and <10 are censored observations, not zero or exact measurements. --- means not measured; blank means missing. Categories remain separate; exact comparison also excludes invalid values and ineligible rows. No zero, half-limit or mean imputation is used.')}</p>
      <EvidenceTable caption={t('範圍內指標儲存格分布', 'Scoped indicator-cell distributions')} headings={[t('指標／單位', 'Indicator / unit'), t('公布格數', 'Published cells'), t('數值', 'Measured'), t('設限', 'Censored'), t('未量測', 'Not measured'), t('缺值', 'Missing'), t('未解析', 'Unparsed'), t('可精確比較', 'Exact-eligible')]}>
        {quality.filter(item => indicator === 'all' || item.key === indicator).map(item => <tr key={item.key}><td>{riverIndicatorLabels[language][item.key]}<br /><small>{riverColumnMap[item.key].unit ?? t('無因次', 'Dimensionless')}</small></td><td>{rows.length}</td><td>{item.counts.measured}</td><td>{item.counts.not_detected_below}</td><td>{item.counts.not_measured}</td><td>{item.counts.missing}</td><td>{item.counts.unparsed}</td><td>{item.exact}</td></tr>)}
      </EvidenceTable>
    </section>

    <section className="notice-block">
      <h3>{t('月量測圖與可比性', 'Monthly measurements & comparability')}</h3>
      {station === 'all' && <label>{t('圖表監測站', 'Chart monitoring station')}<select value={effectiveChartStation ?? ''} onChange={event => setChartStation(event.target.value)}>{stations.map(item => <option key={item.stationId} value={item.stationId}>{item.riverName} · {item.stationName}</option>)}</select></label>}
      <p>{riverIndicatorLabels[language][chartIndicator]} · {riverColumnMap[chartIndicator].unit ?? t('無因次', 'Dimensionless')}</p>
      {chartRows.some(item => item.value !== null) ? <div className="policy-chart" role="img" aria-label={t('同一站點每月精確量測圖，缺值處斷線；下方表格提供相同資料。', 'Exact monthly values for one station, with gaps for unavailable values; the table below provides the same data.')}><ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 280, height: 270 }}><LineChart data={chartRows} margin={{ top: 10, right: 14, left: 0, bottom: 20 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="period" minTickGap={45} /><YAxis width={48} /><Tooltip /><Line name={riverIndicatorLabels[language][chartIndicator]} type="linear" dataKey="value" connectNulls={false} stroke="#0f766e" strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} /></LineChart></ResponsiveContainer></div> : <p role="status">{t('此站點與範圍沒有可繪製的精確量測；請檢視缺值或偵測限狀態。', 'No exact measurements can be plotted in this station and scope. Inspect the missingness or censoring states.')}</p>}
      <p className="policy-legend">{t('僅顯示同站精確量測，缺值與設限值為空白斷點。連線只是相鄰月資料的視覺輔助，不是連續日訊號或顯著長期趨勢。', 'Only exact measurements from one station are plotted. Missing and censored values create gaps. Lines connect monthly records as a visual aid; they are not a continuous daily signal or a statistically significant long-term trend.')}</p>
      <details><summary>{t('圖表月份與資料狀態', 'Chart periods & data states')}</summary><EvidenceTable caption={t('無障礙圖表資料', 'Accessible chart data')} headings={[t('月份', 'Period'), t('原始值', 'Raw value'), t('觀測狀態', 'Observation state')]}>{chartRows.map(item => <tr key={item.period}><td>{item.period}</td><td>{item.raw}</td><td>{statusLabel(item.status)}</td></tr>)}</EvidenceTable></details>
      <p><strong>{t('嚴格可比性必須另外核實跨年的實體站點、採樣方法與單位。官方目前站名相同，不能回溯證明站點從未遷移。', 'Strict comparability additionally requires verified cross-year physical identity, sampling methods and units. Matching current official labels cannot retroactively prove an unchanged physical station.')}</strong></p>
    </section>

    <section className="notice-block">
      <h3>{t('RPI 官方方法與准入', 'Official RPI method & eligibility')}</h3>
      <p>{t('官方 RPI 使用 DO、BOD₅、SS、NH₃-N 四項 mg/L 指標，依級距給予 1、3、6、10 點，再取四項平均。', 'Official RPI assigns 1, 3, 6 or 10 points to DO, BOD₅, SS and NH₃-N in mg/L, then averages the four point values.')}</p>
      <p><a href={snapshot.rpi.officialMethodUrl} target="_blank" rel="noreferrer">{t('環境部官方 RPI 定義', 'Ministry of Environment RPI definition')}</a></p>
      <p><strong>{t('研究重製 RPI：不可用。', 'Research-reproduced RPI: unavailable.')}</strong> {t('四項完整數值組', 'Complete numeric four-input sets')}: {snapshot.rpi.completeInputCount} · {t('符合全部研究准入條件', 'Fully eligible research observations')}: {snapshot.rpi.eligibleCount} · {t('排除', 'Excluded')}: {snapshot.rpi.excludedCount}</p>
      <ul><li>{t('官方表格的十進位級距有空隙；任意小數的適用位數與四捨五入規則尚未獨立准入。', 'Official decimal category intervals contain gaps; the applicable significant-digit and rounding rules for arbitrary decimals have not been independently admitted.')}</li><li>{t('同一站月列不等於已核實同次採樣；尚未配對官方公布 RPI。', 'One station-month row does not independently verify a common sampling event; no official published RPI has been matched.')}</li><li>{t('不替代偵測限、不補缺值，也不以不完整輸入計算。', 'No detection-limit substitution, missing-value imputation or incomplete-input computation is permitted.')}</li></ul>
      <details><summary>{t('原始方法阻礙紀錄（英文）', 'Original method-blocker record')}</summary><ul>{snapshot.rpi.blockers.map(note => <li key={note}>{note}</li>)}</ul></details>
    </section>

    <section className="notice-block">
      <h3>{t('A 文件查核、B 可比證據與 C 證據閘門', 'A Documentary review, B comparison evidence & C evidence gate')}</h3>
      <p>{t('A 的統計單位為站點 × 來源月份；A 級處理來源或身分疑問，B 級處理完整性或可比性疑問，C 級為例行文件複核。未來預留列另行排除。', 'Mode A uses station × source month. Tier A covers primary-source or identity questions, Tier B completeness or comparability questions, and Tier C routine documentary review. Future placeholders are excluded separately.')}</p>
      <p>{t('B 的單位為站點 × 指標 × 配對年份。嚴格比較只接受實體連續性已核實的站點；有限模式只描述來源同名標籤的同月精確數值，不產生趨勢方向、因果或顯著性判定。', 'Mode B uses station × indicator × paired-year window. Strict comparison requires verified physical continuity. Limited mode describes same-month exact values under a source label and generates no trend direction, causal or significance finding.')}</p>
      <p role="status">{mode === 'C' ? t('模式 C 不可用：缺少獨立因果識別、適用水體與許可資料、官方法規判定及公共衛生適用性證據。', 'Mode C unavailable: independent causal identification, applicable waterbody and permit evidence, official compliance determinations and public-health suitability evidence are missing.') : mode === 'B' && !result.eligiblePopulation ? t('模式 B：此範圍證據不足；未產生可比趨勢或 RPI 結論。', 'Mode B: insufficient evidence in this scope; no comparable trend or RPI conclusion is produced.') : t('目前顯示實際來源候選及其查核理由。', 'Actual source candidates and review reasons are shown below.')}</p>
      <EvidenceTable caption={t('查核候選、選取狀態與理由', 'Review candidates, selection & reasons')} headings={[t('候選', 'Candidate'), t('級別', 'Tier'), t('公布／量測／配對', 'Published / observed / paired'), t('選取狀態', 'Selection'), t('理由與來源', 'Reasons & lineage')]}>
        {sortedCandidates.slice(candidatePage * pageSize, (candidatePage + 1) * pageSize).map(item => <tr key={item.id} className={selectedIds.has(item.id) ? 'policy-selected' : ''}><td>{item.riverName} · {item.stationName}<br />{item.period}{item.indicator !== 'all' && <><br />{riverIndicatorLabels[language][item.indicator]}</>}</td><td>{item.tier}</td><td>{item.publishedRowCount} / {item.observedRowCount} / {item.matchedCount}</td><td>{selectedIds.has(item.id) ? t('已選取', 'Selected') : item.eligible ? t('合格，超出名額', 'Eligible, outside capacity') : t('證據未准入', 'Evidence excluded')}</td><td><details><summary>{t('檢視查核證據', 'Inspect review evidence')}</summary><code>{item.id}</code><ul>{[...new Set([...item.issueCodes, ...item.exclusionReasons])].map(code => <li key={code}>{issueLabel(code)} <code>({code})</code></li>)}</ul><p>{t('來源年版', 'Source editions')}: {item.sourceIds.join(' / ')}</p><p>{t('原始來源列', 'Original source rows')}:</p><div className="policy-ids">{item.rowIds.map(id => <p key={id}><code>{id}</code></p>)}</div></details></td></tr>)}
        {!sortedCandidates.length && <tr><td colSpan={5}>{t('沒有候選；空結果不代表零污染或符合標準。', 'No candidates. An empty result does not mean zero pollution or compliance.')}</td></tr>}
      </EvidenceTable>
      <div className="policy-actions"><button disabled={candidatePage === 0} onClick={() => setCandidatePage(value => value - 1)}>{t('上一頁候選', 'Previous candidates')}</button><span>{candidatePage + 1} / {candidatePageCount}</span><button disabled={candidatePage + 1 >= candidatePageCount} onClick={() => setCandidatePage(value => value + 1)}>{t('下一頁候選', 'Next candidates')}</button></div>
      <details><summary>{t('B 配對觀測與排除數', 'B Paired observations & exclusions')}</summary><p>{t('下列為目前範圍涉及的描述配對視窗；年份或來源單選時未必包含完整兩端，因此不能作為合格比較。實際准入以模式 B 候選表為準。', 'These descriptive windows involve the current scope. A single year or source may omit one endpoint and cannot establish an eligible comparison; Mode B candidate eligibility controls admission.')}</p><EvidenceTable caption={t('同月配對證據視窗', 'Same-month paired evidence windows')} headings={[t('河川／站點', 'River / station'), t('指標', 'Indicator'), t('年份', 'Years'), t('配對／排除', 'Matched / excluded'), t('精確數值證據', 'Exact paired values')]}>{comparisonRows.slice(0, 24).map(item => <tr key={item.id}><td>{item.riverName} · {item.stationName}</td><td>{riverIndicatorLabels[language][item.indicator]}</td><td>{item.fromYear} / {item.toYear}</td><td>{item.matchedCount} / {item.excludedCount}</td><td><details><summary>{t('同月原始值差異（非趨勢推論）', 'Same-month differences (no trend inference)')}</summary>{item.pairs.map(pair => <p key={pair.month}>{pair.month}: {pair.fromValue} → {pair.toValue} ({t('差值', 'difference')}: {Number(pair.change.toPrecision(6))})</p>)}</details></td></tr>)}</EvidenceTable><p>{t('最多預覽 24 個視窗；完整候選可由模式 B 篩選與匯出取得。', 'Preview shows up to 24 windows; filter and export Mode B for complete candidates.')}</p></details>
    </section>

    <section className="notice-block">
      <h3>{t('查核名額、策略比較與敏感度', 'Review capacity, strategy comparison & sensitivity')}</h3>
      <p>{t('兩策略使用相同合格候選。先依 A／B／C 及問題代碼優先順序，再以固定 ID 排序；均衡策略在相同優先級內輪替河川與站點。名額是文件複核機會，不是採樣或執法預算。', 'Both strategies use the same eligible population. Tiers A/B/C and issue-code precedence come first, followed by stable IDs. Balanced review rotates rivers and stations within equal priority. Slots are documentary review opportunities, not sampling or enforcement budgets.')}</p>
      <p>{t('候選總數／合格／排除', 'Population / eligible / excluded')}: {result.population} / {result.eligiblePopulation} / {result.excludedPopulation} · {t('已選／未用名額', 'Selected / unused slots')}: {result.selectedCount} / {result.unusedCapacity} · {t('已選級別 A／B／C', 'Selected tiers A/B/C')}: {result.tierCounts.A} / {result.tierCounts.B} / {result.tierCounts.C}</p>
      <p>{t('涵蓋河川／站點', 'Rivers / stations represented')}: {result.rivers.length} / {result.stations.length} · {result.rivers.join('、') || '—'}</p>
      <EvidenceTable caption={t('實際選取 ID 的比較', 'Comparison of actual selected IDs')} headings={[t('改變條件', 'Changed assumption'), t('共同／新增／移除', 'Shared / added / removed'), t('合格母體變化', 'Eligible population change'), t('河川／站點變化', 'River / station change'), t('實際 ID', 'Actual IDs')]}>
        {[[t('另一查核策略（相同母體）', 'Alternate strategy (same population)'), strategyComparison], [t(`名額 ${capacity === 'all' ? '全部' : capacity} → ${capacity === 5 ? 10 : 5}`, `Slots ${capacity === 'all' ? 'all eligible' : capacity} → ${capacity === 5 ? 10 : 5}`), capacityComparison], [t('切換嚴格／有限證據', 'Switch strict/limited evidence'), evidenceComparison]].map(([label, comparison]) => { const item = comparison as typeof strategyComparison; return <tr key={String(label)}><td>{String(label)}</td><td>{item.sharedIds.length} / {item.addedIds.length} / {item.removedIds.length}</td><td>{item.eligiblePopulationChange}</td><td>{item.riverCoverageChange} / {item.stationCoverageChange}</td><td><details><summary>{t('檢視集合差異', 'Inspect set differences')}</summary>{[[t('共同', 'Shared'), item.sharedIds], [t('新增', 'Added'), item.addedIds], [t('移除', 'Removed'), item.removedIds]].map(([name, ids]) => <div key={String(name)}><strong>{String(name)}</strong><div className="policy-ids">{(ids as string[]).map(id => <p key={id}><code>{id}</code></p>)}</div></div>)}</details></td></tr>; })}
      </EvidenceTable>
      <p>{t('嚴格／有限模式會改變准入母體，不能將差異全歸因於策略；上述數字是查核涵蓋變化，不是環境趨勢變化。', 'Strict/limited rules can change eligibility populations, so differences cannot all be attributed to strategy. Counts describe review coverage changes, not environmental trend changes.')}</p>
      <details><summary>{t('本情境已選候選 ID', 'Selected candidate IDs in this scenario')}</summary><div className="policy-ids">{result.selectedIds.map(id => <p key={id}><code>{id}</code></p>)}</div></details>
    </section>

    <section className="notice-block">
      <h3>{t('技術來源、證據限制與研究摘要', 'Technical provenance, evidence limits & research briefing')}</h3>
      <p>{t('河川、站名、監測機會、公布列、指標量測、配對觀測及 RPI 是不同統計單位。即使同名站月數值完整，也不能單獨代表全河川或目前水況。', 'River, station label, monitoring opportunity, published row, indicator measurement, paired observation and RPI are distinct statistical units. Complete monthly values under a label cannot independently represent an entire river or current conditions.')}</p>
      <ul><li>{t('現有證據不足以核實跨年實體位置與採樣方法連續性。', 'Available evidence does not verify cross-year physical location or sampling-method continuity.')}</li><li>{t('資料只提供年月，不推測精確採樣日。', 'Source periods provide year and month; exact sampling days are not inferred.')}</li><li>{t('地理座標未通過本政策准入，不新增地圖點位或上下游因果推論。', 'Coordinates are not admitted for this policy; no station pins or upstream/downstream causal inference are added.')}</li><li>{t('公布排程與有效量測涵蓋分開計算；設限數值不納入一般平均。', 'Published schedule coverage and usable measurement coverage are separate; censored values are excluded from ordinary arithmetic means.')}</li></ul>
      <details><summary>{t('不可變快照與完整方法限制', 'Immutable snapshot & complete method limitations')}</summary><p>{t('快照 ID', 'Snapshot ID')}: <code>{loaded.pointer.snapshotId}</code></p><p>SHA-256: <code>{loaded.pointer.sha256}</code></p><p>{loaded.pointer.byteLength.toLocaleString()} bytes · {snapshot.methodId}</p><p>{t('瀏覽器驗證精確檔案雜湊與來源結構；相同已准入位元組及設定可重現相同快照。', 'The browser validates the exact-file hash and source structure. Identical admitted bytes and configuration reproduce the same snapshot.')}</p><ul>{snapshot.limitations.map(note => <li key={note}>{note}</li>)}</ul></details>
      <div className="policy-actions"><button onClick={() => exportBriefing('json')}>{t('匯出研究摘要 JSON', 'Export research briefing JSON')}</button><button onClick={() => exportBriefing('csv')}>{t('匯出研究摘要 CSV', 'Export research briefing CSV')}</button></div>
      {exportError && <p role="alert">{exportError}</p>}
      <p>{t('摘要保留來源年版、已驗證快照雜湊、假設、選取 ID、排除理由與限制，CSV 已防護公式注入。此為河川水質監測證據查核摘要，不是官方法規符合性報告。', 'Briefings retain source editions, verified snapshot hash, assumptions, selected IDs, exclusion reasons and limitations. CSV cells are protected against formula injection. This is a River Monitoring Evidence Review Briefing, not an official regulatory compliance report.')}</p>
    </section>
  </section>;
}
