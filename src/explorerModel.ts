import { getNavigationCategories, type MonitoringTab, type NavigationCategory } from './navigation';
import type { Language } from './data/i18n';

export type ExplorerGroup = {
  id: NavigationCategory;
  title: string;
  description: string;
  items: { id: MonitoringTab; label: string; keywords: string }[];
};

/** Labels, search terms and destinations come exclusively from host metadata. */
export function getExplorerGroups(language: Language): ExplorerGroup[] {
  const bilingual = [getNavigationCategories('zh'), getNavigationCategories('en')];
  return getNavigationCategories(language).map(group => ({
    id: group.id,
    title: group.label,
    description: '',
    items: group.tabs.map(tab => ({
      ...tab,
      keywords: bilingual.flatMap(groups => groups.filter(item => item.id === group.id)
        .flatMap(item => [item.label, ...item.tabs.filter(module => module.id === tab.id).map(module => module.label)]))
        .concat(tab.id).join(' '),
    })),
  }));
}

/** Adapted from the MIT Real Estate Explorer: selection scopes literal search. */
export function filterExplorerGroups(groups: ExplorerGroup[], selectedId: string | null, query: string): ExplorerGroup[] {
  const term = query.trim().toLocaleLowerCase();
  return groups.filter(group => !selectedId || group.id === selectedId).map(group => ({
    ...group,
    items: group.items.filter(item => `${group.title} ${item.label} ${item.keywords}`.toLocaleLowerCase().includes(term)),
  }));
}
