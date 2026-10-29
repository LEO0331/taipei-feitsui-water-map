import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getNavigationCategories } from '../src/navigation';
import { filterExplorerGroups, getExplorerGroups } from '../src/explorerModel';

test('all five original categories retain every existing module target and bilingual label', () => {
  const expected = {
    overview: ['waterQuality', 'combinedDashboard', 'dataTable'],
    reservoir: ['hydromet', 'operation', 'reservoirSedimentationSurveys', 'carlsonTrophicStateIndex'],
    rivers: ['riverWaterQuality', 'riverWaterPolicy', 'riverEcology', 'amphibianEcology', 'butterflyEcology', 'dragonflyEcology'],
    urbanWater: ['preparednessDecision', 'pumpingStations', 'stormMachinery', 'sedimentationBasins', 'parkWaterSafety'],
    waterServices: ['twcSupport', 'clearWaterQuality', 'tapWaterBusiness'],
  };
  for (const language of ['zh', 'en'] as const) {
    const host = getNavigationCategories(language);
    const explorer = getExplorerGroups(language);
    assert.deepEqual(Object.fromEntries(host.map(group => [group.id, group.tabs.map(tab => tab.id)])), expected);
    assert.equal(new Set(explorer.flatMap(group => group.items.map(item => item.id))).size, 21);
    for (const [index, group] of explorer.entries()) {
      assert.equal(group.title, host[index].label);
      assert.deepEqual(group.items.map(({ id, label }) => ({ id, label })), host[index].tabs);
      assert.ok(group.title.length);
      for (const item of group.items) assert.ok(item.label.length);
    }
  }
});

test('Chinese and English search works for every module in either display language', () => {
  for (const language of ['zh', 'en'] as const) for (const searchLanguage of ['zh', 'en'] as const) {
    for (const category of getNavigationCategories(searchLanguage)) for (const tab of category.tabs) {
      const results = filterExplorerGroups(getExplorerGroups(language), null, `  ${tab.label.toUpperCase()}  `);
      assert.ok(results.flatMap(group => group.items).some(item => item.id === tab.id), `${language}/${tab.id}`);
    }
  }
});

test('selection scopes keyword search, preserves order and never mutates the host catalogue', () => {
  const groups = getExplorerGroups('zh');
  const before = JSON.stringify(groups);
  assert.equal(filterExplorerGroups(groups, null, '').flatMap(group => group.items).length, 21);
  assert.deepEqual(filterExplorerGroups(groups, 'rivers', '').map(group => group.id), ['rivers']);
  assert.equal(filterExplorerGroups(groups, 'rivers', 'Heavy-Rain').flatMap(group => group.items).length, 0);
  assert.equal(filterExplorerGroups(groups, null, 'Heavy-Rain').flatMap(group => group.items)[0].id, 'preparednessDecision');
  assert.equal(filterExplorerGroups(groups, null, '河川監測').flatMap(group => group.items)[0].id, 'riverWaterPolicy');
  assert.equal(filterExplorerGroups(groups, null, 'no-matching-module').flatMap(group => group.items).length, 0);
  assert.equal(JSON.stringify(groups), before);
});
