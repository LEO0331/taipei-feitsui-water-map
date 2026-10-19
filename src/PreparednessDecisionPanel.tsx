import { useEffect, useMemo, useState } from 'react';
import { CircleMarker, GeoJSON, MapContainer, Popup, TileLayer } from 'react-leaflet';
import type { Language } from './data/i18n';
import type { PreparednessSnapshot } from './types/preparedness';
import { DEFAULT_CONFIG, buildCandidates, runScenario, compareScenarios, makeBriefing, briefingCsv, validateDecisionSnapshot, type Scenario } from './utils/preparednessDecision';
import './preparedness.css';

const districtNames = ['中正區', '大同區', '中山區', '松山區', '大安區', '萬華區', '信義區', '士林區', '北投區', '內湖區', '南港區', '文山區'];
const colors = { pumping: '#0f766e', machinery: '#2563eb', basin: '#b7791f' };

function download(content: string, extension: string) {
  const url = URL.createObjectURL(new Blob([content], { type: extension === 'json' ? 'application/json' : 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url; link.download = `preparedness-review.${extension}`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function PreparednessDecisionPanel({ language }: { language: Language }) {
  const t = (zh: string, en: string) => language === 'zh' ? zh : en;
  const [snapshot, setSnapshot] = useState<PreparednessSnapshot | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [district, setDistrict] = useState('all');
  const [asset, setAsset] = useState<'all' | 'pumping' | 'machinery' | 'basin'>('all');
  const [mode, setMode] = useState<'evidence' | 'flood'>('evidence');
  const [strict, setStrict] = useState(true);
  const [includeStale, setIncludeStale] = useState(true);
  const [capacityPreset, setCapacityPreset] = useState('5');
  const [customCapacity, setCustomCapacity] = useState('7');
  const [scenario, setScenario] = useState<Scenario>('gaps');
  const [tiles, setTiles] = useState(false);
  const [inspect, setInspect] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setError(''); setSnapshot(null);
    fetch(`${import.meta.env.BASE_URL}data/preparedness-decision/snapshot.json`, { signal: controller.signal, cache: 'no-cache' })
      .then(async response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const value = await response.json() as PreparednessSnapshot;
        if (!validateDecisionSnapshot(value)) throw new Error('Unsupported snapshot');
        return value;
      }).then(value => { if (!controller.signal.aborted) setSnapshot(value); })
      .catch((reason: unknown) => { if (!controller.signal.aborted) setError(String(reason)); });
    return () => controller.abort();
  }, [attempt]);
  const config = useMemo(() => ({ ...DEFAULT_CONFIG, mode, districts: district === 'all' ? [] : [district], assetTypes: asset === 'all' ? [] : [asset], evidenceRequirement: strict ? 'strict' as const : 'permissive' as const, includeStaleSources: includeStale }), [mode, district, asset, strict, includeStale]);
  const capacityText = capacityPreset === 'custom' ? customCapacity : capacityPreset;
  const capacityValid = capacityText === 'unlimited' || (/^[1-9]\d*$/.test(capacityText) && Number.isSafeInteger(Number(capacityText)));
  const capacity = capacityText === 'unlimited' ? 'unlimited' as const : capacityValid ? Number(capacityText) : 5;
  const candidates = useMemo(() => snapshot ? buildCandidates(snapshot, config) : [], [snapshot, config]);
  const result = useMemo(() => runScenario(candidates, scenario, capacity), [candidates, scenario, capacity]);
  const alternate = useMemo(() => runScenario(candidates, scenario === 'balanced' ? 'gaps' : 'balanced', capacity), [candidates, scenario, capacity]);
  const comparison = useMemo(() => compareScenarios(result, alternate), [result, alternate]);
  const larger = useMemo(() => runScenario(candidates, scenario, 10), [candidates, scenario]);
  const selectedIds = new Set(result.selected.map(candidate => candidate.id));
  const visibleInventory = snapshot?.inventory.filter(record => candidates.some(candidate => candidate.district === record.district && candidate.assetType === record.assetType && candidate.sourceIds.includes(record.sourceId)) && (district === 'all' || record.district === district) && (asset === 'all' || record.assetType === asset)) ?? [];
  const visibleAreas = snapshot?.reviewAreas.filter(area => candidates.some(candidate => candidate.sourceIds.includes(area.sourceId)) && (district === 'all' || area.district === district)) ?? [];
  const assetLabel = (value: string) => ({ pumping: t('抽水站', 'Pumping stations'), machinery: t('外租機械據點', 'Machinery sites'), basin: t('沉砂池', 'Sedimentation basins') })[value] ?? value;
  const sourceLabel = (value: string) => value === 'flood-prone' ? t('官方易積水地區', 'Official flood-prone areas') : value === 'historical-inundation' ? t('歷史淹水紀錄', 'Historical inundation') : assetLabel(value);
  const tierLabel = (value: string) => ({ A: t('A 優先核實', 'A Verify first'), B: t('B 查核', 'B Review'), C: t('C 例行盤點', 'C Routine inventory'), insufficient: t('證據不足', 'Insufficient evidence') })[value] ?? value;
  const scenarioLabel = (value: string) => ({ gaps: t('資料缺口優先', 'Evidence gaps first'), balanced: t('地理均衡查核', 'Balanced geographic review'), flood: t('官方積水脈絡優先', 'Official flood context first') })[value] ?? value;
  const reset = () => { setDistrict('all'); setAsset('all'); setMode('evidence'); setStrict(true); setIncludeStale(true); setCapacityPreset('5'); setCustomCapacity('7'); setScenario('gaps'); setInspect(''); };
  if (error) return <section className="notice-block" role="alert"><h2>{t('決策資料載入失敗', 'Decision data could not load')}</h2><p>{error}</p><button onClick={() => setAttempt(value => value + 1)}>{t('重試', 'Retry')}</button></section>;
  if (!snapshot) return <p role="status">{t('正在載入查核快照…', 'Loading review snapshot…')}</p>;
  const briefing = makeBriefing(snapshot, config, scenario, capacity);
  const inspected = candidates.find(candidate => candidate.id === inspect);
  const tableCandidates = [...result.ranked, ...result.excluded.filter(candidate => !result.ranked.some(ranked => ranked.id === candidate.id))];
  const gapLabel = (code: string, fallback: string) => language === 'en' ? fallback : ({source_failure:'確認來源識別、年版、可用性與採用資格；此來源失敗僅算一項問題。',inventory_coverage:'確認清冊涵蓋範圍；無設施紀錄不代表無保護。',identity_geography:'核實設施識別及座標；同一來源完整性問題合併計算。',temporal_version:'確認資料期間及年版；發布或建置日期不代表設備目前狀況。',operational_evidence:'向主管機關索取目前檢查與可用性證據；未知不代表設備失效。',service_relationship:'確認官方排水服務關係；鄰近不代表有服務或保護。'} as Record<string,string>)[code] ?? fallback;
  return <section className="preparedness" aria-label={t('防汛整備決策分析', 'Heavy-Rain Preparedness Decision Support')}>
    <section className="notice-block preparedness-intro">
      <p className="eyebrow">{t('觀察 → 驗證 → 比較 → 排序 → 模擬 → 複核 → 匯出', 'Observe → Validate → Compare → Prioritize → Simulate → Review → Export')}</p>
      <h2>{t('防汛整備決策分析', 'Heavy-Rain Preparedness Decision Support')}</h2>
      <p>{t('豪雨季前，有限的文件／現地查核名額，應先投入哪些行政區及設施資料？', 'Before heavy-rain season, which district and infrastructure records should receive limited documentary or field-review slots?')}</p>
      <p><strong>{t('獨立工程 POC；查核順序不是淹水風險、預報、派遣建議或官方整備認證。', 'Independent engineering POC. Review order is not flood risk, a forecast, dispatch advice or official readiness certification.')}</strong></p>
      <small>{t('快照', 'Snapshot')}: {snapshot.snapshotVersion} · {snapshot.processedAt.slice(0, 10)} · heavy-rain-preparedness-review-v1</small>
    </section>
    <section className="notice-block">
      <h3>{t('政策範圍與來源狀態', 'Policy scope & source health')}</h3>
      <p>{t('查核單位：行政區 × 設施類別。官方區域涵蓋不完整，未採用可核實的集水區服務關係，因此不劃設更細緻的風險區。', 'Review unit: district × infrastructure category. Incomplete reference-area coverage and unadopted catchment service relationships require district-level review.')}</p>
      <div className="table-wrap"><table><thead><tr>{[t('來源', 'Source'), t('發布／更新日期', 'Publication / update'), t('採用紀錄', 'Accepted records'), t('排除', 'Rejected'), t('狀態', 'Status')].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{snapshot.sources.map(source => <tr key={source.sourceId}>
        <td><a href={source.sourceUrl} target="_blank" rel="noreferrer">{sourceLabel(source.sourceId)}</a><details><summary>{t('版本、雜湊與限制', 'Version, hash & limitations')}</summary><small>{source.version}<br />{source.resourceId ?? t('資源 ID 未核實', 'Resource ID unverified')}<br />SHA256: {source.sourceSha256}<br />{t('擷取', 'Retrieved')}: {source.retrievedAt ?? '—'}</small><ul>{source.limitations.map(note => <li key={note}>{note}</li>)}</ul></details></td>
        <td>{source.publicationDate ?? t('未知；不是設施建置日', 'Unknown; not facility establishment date')}{source.temporalCoverage?.start && <><br /><small>{t('實際觀測', 'Observed')}: {source.temporalCoverage.start} – {source.temporalCoverage.end}</small></>}</td><td>{source.recordCount}</td><td>{source.rejectedCount}</td><td>{source.status === 'verified' ? t('已驗證來源', 'Validated source') : source.status === 'limited' ? t('有限證據', 'Limited evidence') : t('不可用', 'Unavailable')}</td>
      </tr>)}</tbody></table></div>
      <p>{t('來源發布日、觀測期間與設備目前狀況不同。年版更新不代表即時可用。詳細來源原文與異常保留於上方限制。', 'Publication date, observation period and current equipment condition differ. An annual edition does not establish live availability. Original source limitations and anomalies are retained above.')}</p>
      <p>{t('預設嚴格證據要求不採用「有限證據」歷史彙整；切換寬鬆要求可納入通過個別驗證的觀測列。表格的「未採用」表示證據未納入，不代表零筆事件。', 'Strict evidence requirements exclude limited historical aggregates by default. Permissive requirements admit individually validated observations. “Not used” means excluded evidence, not zero events.')}</p>
    </section>
    <section className="preparedness-controls" aria-label={t('查核假設', 'Review assumptions')}>
      <label>{t('行政區', 'District')}<select value={district} onChange={event => setDistrict(event.target.value)}><option value="all">{t('全部行政區', 'All districts')}</option>{districtNames.map(name => <option key={name}>{name}</option>)}</select></label>
      <label>{t('設施類別', 'Infrastructure category')}<select value={asset} onChange={event => setAsset(event.target.value as typeof asset)}><option value="all">{t('全部類別', 'All categories')}</option>{Object.keys(colors).map(value => <option key={value} value={value}>{assetLabel(value)}</option>)}</select></label>
      <label>{t('分析模式', 'Review mode')}<select value={mode} onChange={event => setMode(event.target.value as typeof mode)}><option value="evidence">{t('A 整備證據查核', 'A Preparedness evidence')}</option><option value="flood" disabled={!snapshot.floodContextAvailable}>{t('B 官方積水脈絡', 'B Official flood context')}</option></select></label>
      <label>{t('文件／現地查核名額', 'Documentary / field-review slots')}<select value={capacityPreset} onChange={event => setCapacityPreset(event.target.value)}><option value="5">5</option><option value="10">10</option><option value="unlimited">{t('不限', 'Unlimited')}</option><option value="custom">{t('自訂正整數', 'Custom positive integer')}</option></select></label>
      {capacityPreset === 'custom' && <label>{t('自訂名額', 'Custom slots')}<input type="number" min="1" step="1" value={customCapacity} aria-invalid={!capacityValid} onChange={event => setCustomCapacity(event.target.value)} /></label>}
      <label>{t('查核策略', 'Review strategy')}<select value={scenario} onChange={event => setScenario(event.target.value as Scenario)}><option value="gaps">{scenarioLabel('gaps')}</option><option value="balanced">{scenarioLabel('balanced')}</option><option value="flood" disabled={!snapshot.floodContextAvailable}>{scenarioLabel('flood')}</option></select></label>
      <label>{t('證據要求', 'Evidence requirement')}<select value={strict ? 'strict' : 'permissive'} onChange={event => setStrict(event.target.value === 'strict')}><option value="permissive">{t('寬鬆：保留有限來源', 'Permissive: retain limited sources')}</option><option value="strict">{t('嚴格：只採完整驗證來源', 'Strict: verified sources only')}</option></select></label>
      <label>{t('日期未知或過期來源', 'Unknown-date or stale sources')}<select value={includeStale ? 'include' : 'exclude'} onChange={event => setIncludeStale(event.target.value === 'include')}><option value="include">{t('保留並標示缺口', 'Include with gaps')}</option><option value="exclude">{t('排除（改變證據範圍）', 'Exclude (changes evidence scope)')}</option></select></label>
      <button onClick={reset}>{t('重設預設假設', 'Reset assumptions')}</button>
    </section>
    {!capacityValid && <p role="alert">{t('請輸入有效正整數；目前預覽以 5 個名額顯示，匯出暫停。', 'Enter a positive integer. Preview uses 5 slots; export is disabled.')}</p>}
    {!snapshot.floodContextAvailable && <p role="status">{t('模式 B 不可用：官方積水／歷史地理證據未通過驗證；詳見來源限制。模式 A 仍可使用。', 'Mode B unavailable: official flood or historical geography did not pass validation; see source limitations. Mode A remains available.')}</p>}
    <section className="cards" aria-live="polite">{[[t('範圍內設施紀錄', 'Scoped inventory records'), visibleInventory.length], [t('合格查核候選', 'Eligible candidates'), candidates.filter(item => item.eligible).length], [t('已選查核候選', 'Selected candidates'), result.selected.length], [t('已選獨立查核問題', 'Selected review questions'), result.gapCount], [t('涵蓋行政區', 'Districts selected'), result.districtCount]].map(([label, value]) => <article className="card" key={label}><span>{label}</span><strong>{value}</strong></article>)}</section>
    <section className="map-panel">
      <div className="section-heading"><h3>{t('官方地理脈絡與設施盤點', 'Official geographic context & inventory')}</h3><label className="preparedness-check"><input type="checkbox" checked={tiles} onChange={event => setTiles(event.target.checked)} />{t('顯示底圖', 'Show base map')}</label></div>
      <p>{t('紫色外框＝通過幾何驗證的官方參考區；圓點＝來源核實座標（抽水站綠／機械藍／沉砂池金）。白色外圈＝本次選取候選中的設施。行政區候選不另造中心點；點位與鄰近區域不代表服務或保護關係。', 'Purple outlines: validated official reference areas. Points: verified source coordinates (pumping green / machinery blue / basins gold). White rings: facilities in selected candidates. District candidates have no invented centroids; proximity proves no service or protection relationship.')}</p>
      <MapContainer center={[25.06, 121.56]} zoom={11} scrollWheelZoom={false} className="map">
        {tiles && <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />}
        {visibleAreas.map(area => <GeoJSON key={area.id} data={area.geometry} style={{ color: '#7c3aed', fillOpacity: 0.07, weight: 2 }}><Popup>{t('官方參考區', 'Official reference area')}: {area.id}<br />{area.district ?? t('行政區未知', 'District unknown')}<br />{t('不是目前淹水預測。', 'Not a current flood prediction.')}</Popup></GeoJSON>)}
        {visibleInventory.filter(record => record.coordinateStatus === 'verified' && Number.isFinite(record.latitude) && Number.isFinite(record.longitude)).map(record => <CircleMarker key={record.id} center={[record.latitude!, record.longitude!]} radius={5} pathOptions={{ color: selectedIds.has(`${record.district}:${record.assetType}`) ? '#fff' : colors[record.assetType], fillColor: colors[record.assetType], fillOpacity: 0.85, weight: 2 }}><Popup><strong>{record.name}</strong><br />{record.district} · {assetLabel(record.assetType)}<br />{t('來源紀錄，現況未知；不代表設備可用。', 'Source record. Current condition unknown; availability unverified.')}</Popup></CircleMarker>)}
      </MapContainer>
      <small>{visibleAreas.length} {t('參考區', 'reference areas')} · {visibleInventory.filter(record => record.coordinateStatus === 'verified').length} {t('核實座標；底圖失效仍可使用下方表格。', 'verified points; table remains usable without tiles.')}</small>
    </section>
    <section className="notice-block">
      <h3>{t('查核優先順序與資料缺口', 'Review priorities & evidence gaps')}</h3>
      <p>{t('A＝官方參考區且至少兩種獨立缺口；B＝歷史／官方脈絡或實質資料疑問；C＝例行盤點；核心來源或地理證據缺失＝證據不足。同一來源失敗不重複累計。排序依級別、問題數、來源類別數、版本疑問／來源年齡、固定 ID。', 'A: official reference area plus at least two independent gaps. B: historical/official context or material data questions. C: routine inventory. Missing essential source or geography: insufficient. One source failure is not counted as several gaps. Rank by tier, question count, source types, version uncertainty/source age, then stable ID.')}</p>
      {result.unavailableReason && <p role="status">{result.unavailableReason}</p>}
      <div className="table-wrap"><table><thead><tr>{[t('查核候選', 'Candidate'), t('級別', 'Tier'), t('設施紀錄', 'Records'), t('獨立問題', 'Questions'), t('歷史觀測列', 'Historical observations'), t('選取狀態', 'Selection')].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{tableCandidates.map(candidate => <tr key={candidate.id} className={selectedIds.has(candidate.id) ? 'preparedness-selected' : ''}><td><button className="preparedness-link" onClick={() => setInspect(candidate.id)}>{candidate.district} · {assetLabel(candidate.assetType)}</button></td><td>{tierLabel(candidate.tier)}</td><td>{candidate.sourceIds.includes(candidate.assetType) ? candidate.recordCount : '—'}</td><td>{candidate.gaps.length}</td><td>{candidate.sourceIds.includes('historical-inundation') ? candidate.historicalObservations : t('未採用', 'Not used')}</td><td>{selectedIds.has(candidate.id) ? t('選取：符合策略與名額', 'Selected: strategy & slots') : candidate.eligible ? scenario === 'flood' && !candidate.officialContext ? t('未選：不在官方脈絡策略範圍', 'Excluded: outside official-context focus') : t('未選：名額限制', 'Excluded: slot limit') : t('未選：證據或範圍不符', 'Excluded: evidence or scope')}</td></tr>)}</tbody></table></div>
      {!tableCandidates.length && <p>{t('目前條件沒有候選；這不代表沒有查核需求或沒有淹水風險。', 'No candidates for these settings. This does not establish no review need or no flood risk.')}</p>}
      {inspected && <article className="preparedness-detail" aria-live="polite"><h4>{inspected.district} · {assetLabel(inspected.assetType)} · {tierLabel(inspected.tier)}</h4><p>{t('證據來源與複核問題', 'Sources & verification questions')}: {inspected.sourceIds.join(', ')}</p><p>{inspected.eligible ? t('符合已選來源及查核規則；按目前策略與名額排序。', 'Meets selected evidence and review rules; ordered by strategy and slots.') : t('核心來源或所需官方脈絡不足，不列入本次清單。', 'Essential source or required official context is insufficient; excluded from this shortlist.')}</p><ul>{inspected.gaps.map(gap => <li key={gap.code}>{gapLabel(gap.code, gap.question)}</li>)}</ul><p>{t('請主管機關確認目前操作狀態、資料年版與集水區服務關係。缺值僅代表待查證，不能判定失效。', 'Ask responsible agencies to confirm operational condition, source edition and drainage service relationships. Missing evidence does not establish failure.')}</p></article>}
    </section>
    <section className="notice-block">
      <h3>{t('查核情境與敏感度', 'Scenarios & sensitivity')}</h3>
      <p>{t('容量是假設查核名額，不是設備部署或市府實際人力。比較固定同一快照、地理單位與證據母體。變更證據篩選會改變範圍，不能解讀為政策效果。', 'Capacity means hypothetical review slots, not equipment deployment or municipal staffing. Strategy comparison fixes snapshot, geography and evidence population. Evidence filters change scope and cannot be interpreted as policy effects.')}</p>
      <div className="table-wrap"><table><thead><tr><th>{t('策略', 'Strategy')}</th><th>{t('選取', 'Selected')}</th><th>{t('行政區', 'Districts')}</th><th>{t('待核實問題', 'Questions')}</th></tr></thead><tbody>{[result, alternate].map(item => <tr key={item.scenario}><td>{scenarioLabel(item.scenario)}</td><td>{item.selected.length}</td><td>{item.districtCount}</td><td>{item.gapCount}</td></tr>)}</tbody></table></div>
      <p>{t('固定母體重疊候選', 'Stable candidates on fixed population')}: {comparison.stableIds.length} · {t('替代策略新增', 'Added by alternative')}: {comparison.addedIds.join(', ') || '—'} · {t('移出', 'Removed')}: {comparison.removedIds.join(', ') || '—'}</p>
      <p>{t('相同假設改為 10 名額', 'Same assumptions at 10 slots')}: {larger.selected.length} {t('候選，', 'candidates, ')}{larger.districtCount} {t('行政區。來源年齡以快照日期計算；預設 730 天。', 'districts. Source age is measured at snapshot time; default threshold 730 days.')}</p>
    </section>
    <section className="notice-block">
      <h3>{t('豪雨防汛整備查核建議摘要', 'Heavy-Rain Preparedness Review Briefing')}</h3>
      <p>{t('匯出包含決策問題、完整假設、來源版本與日期、已選與排除候選、解釋、情境差異與主管機關複核問題；不含姓名、電話、廠商聯絡資料或住戶位置。', 'Exports include the decision question, assumptions, source versions and dates, selected/excluded candidates, explanations, scenario differences and agency verification questions. No personal names, phones, contractor contacts or household locations.')}</p>
      <div className="preparedness-actions"><button disabled={!capacityValid} onClick={() => download(JSON.stringify(briefing, null, 2), 'json')}>{t('下載摘要 JSON', 'Download briefing JSON')}</button><button disabled={!capacityValid} onClick={() => download(briefingCsv(briefing), 'csv')}>{t('下載摘要 CSV', 'Download briefing CSV')}</button></div>
      <details><summary>{t('檢視可重現摘要', 'Inspect reproducible briefing')}</summary><pre>{JSON.stringify(briefing, null, 2)}</pre></details>
    </section>
    <section className="notice-block"><h3>{t('限制與不適用情境', 'Limitations & non-operational use')}</h3><p>{t('水庫集水區降雨不等於臺北各行政區降雨；水位不直接判斷都市淹水。抽水站數量不是排水能力，沉砂池集水面積不是滯洪容量，外租機械紀錄不是即時可用設備。歷史觀測列不是獨立災害事件數，也不是目前易淹水證明；無設施紀錄不表示無保護。', 'Reservoir catchment rain is not district rainfall; reservoir levels do not determine urban flooding. Station counts are not drainage capacity, basin catchment area is not detention volume and contracted sites do not establish availability. Observation rows are not distinct disasters or proof of present susceptibility. Missing facility records do not mean an area is unprotected.')}</p><details><summary>{t('完整來源與分析限制（原文）', 'Full source & analytical limitations')}</summary><ul>{snapshot.limitations.map(note => <li key={note}>{note}</li>)}</ul><p>{snapshot.geographyReason}</p></details></section>
  </section>;
}
