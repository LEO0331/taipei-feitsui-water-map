import { translations, type Language } from './data/i18n';

export type MonitoringTab = 'riverWaterPolicy' | 'preparednessDecision' | 'waterQuality' | 'riverWaterQuality' | 'riverEcology' | 'amphibianEcology' | 'butterflyEcology' | 'dragonflyEcology' | 'pumpingStations' | 'stormMachinery' | 'sedimentationBasins' | 'reservoirSedimentationSurveys' | 'parkWaterSafety' | 'clearWaterQuality' | 'tapWaterBusiness' | 'carlsonTrophicStateIndex' | 'twcSupport' | 'hydromet' | 'operation' | 'combinedDashboard' | 'dataTable';
export type NavigationCategory = 'overview' | 'reservoir' | 'rivers' | 'urbanWater' | 'waterServices';

const text = (language: Language, zh: string, en: string) => language === 'zh' ? zh : en;

/** Single catalogue used by the dashboard and optional Explorer. */
export function getNavigationCategories(language: Language) {
  const t = translations[language];
  const categories: Array<{ id: NavigationCategory; label: string; tabs: Array<{ id: MonitoringTab; label: string }> }> = [
    { id: 'overview', label: text(language, '總覽', 'Overview'), tabs: [{ id: 'waterQuality', label: t.waterQuality }, { id: 'combinedDashboard', label: t.combinedDashboard }, { id: 'dataTable', label: t.dataTable }] },
    { id: 'reservoir', label: text(language, '水庫', 'Reservoir'), tabs: [{ id: 'hydromet', label: t.hydromet }, { id: 'operation', label: t.operation }, { id: 'reservoirSedimentationSurveys', label: text(language, '翡翠水庫淤積調查', 'Sedimentation Surveys') }, { id: 'carlsonTrophicStateIndex', label: t.carlsonTrophicStateIndex }] },
    { id: 'rivers', label: text(language, '河川與生態', 'Rivers & Ecology'), tabs: [{ id: 'riverWaterQuality', label: t.riverWaterQuality }, { id: 'riverWaterPolicy', label: text(language, '河川監測證據查核', 'River Monitoring Evidence Review') }, { id: 'riverEcology', label: text(language, '底棲生物', 'Benthic Species') }, { id: 'amphibianEcology', label: text(language, '兩棲類調查', 'Amphibian Survey') }, { id: 'butterflyEcology', label: text(language, '蝴蝶分布', 'Butterfly Distribution') }, { id: 'dragonflyEcology', label: text(language, '蜻蜓分布', 'Dragonfly Distribution') }] },
    { id: 'urbanWater', label: text(language, '都市水務與防汛', 'Urban Water & Preparedness'), tabs: [{ id: 'preparednessDecision', label: text(language, '防汛整備決策分析', 'Heavy-Rain Preparedness Decision Support') }, { id: 'pumpingStations', label: t.pumpingStations }, { id: 'stormMachinery', label: text(language, '防汛外租機械', 'Storm Machinery') }, { id: 'sedimentationBasins', label: t.sedimentationBasins }, { id: 'parkWaterSafety', label: t.waterSafetyEquipment }] },
    { id: 'waterServices', label: text(language, '自來水服務', 'Water Services'), tabs: [{ id: 'twcSupport', label: t.twcSupport }, { id: 'clearWaterQuality', label: t.clearWaterQuality }, { id: 'tapWaterBusiness', label: t.waterBusinessKpis }] },
  ];
  return categories;
}
