import { useEffect, useId, useRef, useState } from 'react';
import type { Language } from './data/i18n';
import type { MonitoringTab } from './navigation';
import './CivicExplorer.css';
import { getExplorerGroups, filterExplorerGroups, type ExplorerGroup } from './explorerModel';

/** The host supplies the existing dashboard catalogue and its tab identifiers. */
export type CivicExplorerGroup = ExplorerGroup;

type Props = {
  language: Language;
  onNavigate: (id: MonitoringTab) => void;
  onBack: () => void;
};

/*
 * The hexagonal island geometry below is adapted from Portfolio v3.0.1,
 * src/components/explorer/HexIsland.tsx. Copyright (c) 2026 LeoChen.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
function Hub({ group, index, selected, select }: { group: CivicExplorerGroup; index: number; selected: boolean; select: () => void }) {
  return <button type="button" className={`explore-hub explore-hub-${index}`} data-explore-group={group.id} aria-pressed={selected} onClick={select}>
    <svg viewBox="0 0 220 180" aria-hidden="true" focusable="false">
      <ellipse cx="110" cy="155" rx="87" ry="20" className="explore-shadow" />
      <g className="explore-lift">
        <polygon points="24,105 110,147 110,166 24,124" className="explore-side-left" />
        <polygon points="110,147 196,105 196,124 110,166" className="explore-side-right" />
        <polygon points="110,23 196,64 196,105 110,147 24,105 24,64" className="explore-top" />
        <polygon points="110,33 185,69 185,100 110,136 35,100 35,69" className="explore-inset" />
        <path d="M65 86 110 64l45 22-45 22z M80 91v18l30 14 30-14V91 M110 108v15" className="explore-mark" />
      </g>
    </svg>
    <span>{group.title}</span>
  </button>;
}

export default function CivicExplorer({ language, onNavigate, onBack }: Props) {
  const groups = getExplorerGroups(language);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'scene' | 'list'>('scene');
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const pageHeading = useRef<HTMLHeadingElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLElement>(null);
  const headingId = useId();
  const zh = language === 'zh';
  const selected = groups.find(group => group.id === selectedId);
  const visibleGroups = filterExplorerGroups(groups, selectedId, query);
  const count = visibleGroups.reduce((sum, group) => sum + group.items.length, 0);
  useEffect(() => { pageHeading.current?.focus(); }, []);
  useEffect(() => {
    if (selectedId) detailHeading.current?.focus();
  }, [selectedId]);
  function clearGroup() {
    const previous = selectedId;
    setSelectedId(null);
    requestAnimationFrame(() => {
      if (view === 'scene' && previous) {
        const hubs = root.current?.querySelectorAll<HTMLButtonElement>('[data-explore-group]');
        const hub = Array.from(hubs ?? []).find(item => item.dataset.exploreGroup === previous);
        if (hub) { hub.focus(); return; }
      }
      detailHeading.current?.focus();
    });
  }
  function clearFilters() {
    setQuery('');
    setSelectedId(null);
    requestAnimationFrame(() => searchInput.current?.focus());
  }
  return <main className="data-explorer" ref={root} aria-labelledby={headingId} onKeyDown={event => {
    if (event.key === 'Escape' && selectedId) { event.stopPropagation(); clearGroup(); }
  }}>
    <header className="explore-header">
      <div><p className="explore-eyebrow">{zh ? '資料探索' : 'Civic Explorer'}</p><h1 id={headingId} ref={pageHeading} tabIndex={-1}>{zh ? '探索水環境主題' : 'Explore water topics'}</h1>
        <p>{zh ? '選擇主題或搜尋資料集，前往現有儀表板。圖形位置僅為導覽設計，不代表地理位置或資料間的關係。' : 'Choose a topic or search for a dataset to open the existing dashboard. The layout is for navigation only; it does not represent geography or relationships between datasets.'}</p></div>
      <button type="button" className="explore-back" onClick={onBack}>← {zh ? '返回儀表板' : 'Return to Dashboard'}</button>
    </header>
    <div className="explore-controls">
      <label><span>{zh ? '搜尋資料集' : 'Search datasets'}</span><input ref={searchInput} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={zh ? '搜尋名稱或關鍵字' : 'Search names or keywords'} /></label>
      <div className="explore-view" role="group" aria-label={zh ? '顯示方式' : 'Display mode'}>
        <button type="button" aria-pressed={view === 'scene'} onClick={() => setView('scene')}>{zh ? '主題圖' : 'Hubs'}</button>
        <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}>{zh ? '清單' : 'List'}</button>
      </div>
    </div>
    <div className="explore-status"><p role="status" aria-live="polite">{zh ? `找到 ${count} 個項目` : `${count} ${count === 1 ? 'item' : 'items'} found`}{selected ? ` · ${selected.title}` : ''}</p>
      {selected && <button type="button" onClick={clearGroup}>← {zh ? '所有主題' : 'All topics'}</button>}
    </div>
    <div className={`explore-body explore-body-${view}`}>
    {view === 'scene' && <div className="explore-hubs" role="group" aria-label={zh ? '主題' : 'Topics'}>
      {groups.map((group, index) => <Hub key={group.id} group={group} index={index} selected={selectedId === group.id} select={() => setSelectedId(group.id)} />)}
    </div>}
    <div className="explore-results" aria-label={zh ? '資料模組清單' : 'Module list'}>
      <h2 ref={detailHeading} tabIndex={-1}>{selected ? selected.title : (zh ? '資料集目錄' : 'Dataset catalogue')}</h2>
      {selected && <p>{selected.description}</p>}
      {count === 0 ? <div className="explore-empty"><p>{zh ? '找不到相符的資料集。' : 'No datasets match your search.'}</p><button type="button" onClick={clearFilters}>{zh ? '清除篩選' : 'Clear filters'}</button></div>
        : visibleGroups.filter(group => group.items.length).map(group => <section className="explore-result-group" key={group.id}>
          {!selected && <><h3>{group.title}</h3><p>{group.description}</p></>}
          <ul>{group.items.map(item => <li key={item.id}><button type="button" data-module={item.id} onClick={() => onNavigate(item.id)}>{item.label}<span aria-hidden="true"> ↗</span></button></li>)}</ul>
        </section>)}
    </div>
    </div>
    <p className="explore-source">{zh ? '主題圖僅供導覽，不代表地理位置或科學關係。歷史紀錄無法判定目前洪水風險、整備狀態、水質安全或生態狀況。各模組保留原有資料來源、日期與解讀限制。' : 'These islands are conceptual navigation, with no geographic or scientific meaning. Historical records do not determine current flood risk, readiness, water safety or ecological condition. Each module retains its source dates and interpretation limits.'}</p>
  </main>;
}
