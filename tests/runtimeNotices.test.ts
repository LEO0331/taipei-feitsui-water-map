import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildRuntimeNotices } from '../scripts/buildRuntimeNotices';

test('runtime distribution retains exact installed license texts including Hippocratic and copied MIT notices', () => {
  const root = process.cwd();
  const result = buildRuntimeNotices(root);
  assert.ok(result.inventory.packages.length > 0);
  assert.ok(result.text.includes(readFileSync(join(root, 'LICENSE'), 'utf8')));
  for (const pkg of result.inventory.packages) {
    const installed = JSON.parse(readFileSync(join(root, pkg.path, 'package.json'), 'utf8'));
    assert.equal(pkg.version, installed.version);
    for (const { file, path } of pkg.files) assert.ok(result.text.includes(readFileSync(join(root, path), 'utf8')), `${pkg.name}/${file}`);
  }
  for (const name of ['react-leaflet', '@react-leaflet/core']) {
    const pkg = result.inventory.packages.find(pkg => pkg.name === name);
    assert.ok(pkg, name);
    assert.ok(result.text.includes(readFileSync(join(root, pkg.path, 'LICENSE.md'), 'utf8')));
  }
  assert.match(result.text, /Hippocratic License Version Number: 2\.1/);
  assert.match(result.text, /Project and copied Portfolio Explorer code/);
  const victory = result.inventory.packages.find(pkg => pkg.name === 'victory-vendor')!;
  assert.equal(victory.files.filter(file => file.file.startsWith('lib-vendor/')).length, 13);
  assert.ok(victory.files.some(file => file.sourceUrl?.includes('/v37.3.6/LICENSE.txt')));
  assert.ok(result.inventory.packages.every(pkg => pkg.files.length > 0), 'every installed runtime package needs accompanying license text');
});
