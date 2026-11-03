import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { buildRuntimeNotices } from './scripts/buildRuntimeNotices';

export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? '/taipei-feitsui-water-map/' : '/',
  plugins: [react(), {
    name: 'precache-built-modules',
    apply: 'build',
    writeBundle(options, bundle) {
      // Cache deferred modules during PWA installation so previously unvisited
      // panels remain available offline. This does not eagerly execute them.
      const assets = Object.keys(bundle).filter(file => /\.(js|css)$/.test(file)).sort();
      const notices = buildRuntimeNotices(process.cwd());
      const inventory = JSON.stringify(notices.inventory, null, 2) + '\n';
      writeFileSync(resolve(options.dir ?? 'dist', 'THIRD_PARTY_NOTICES.txt'), notices.text);
      writeFileSync(resolve(options.dir ?? 'dist', 'runtime-license-inventory.json'), inventory);
      const version = createHash('sha256').update(assets.join('\n')).update(notices.text).update(inventory).digest('hex').slice(0, 16);
      const workerPath = resolve(options.dir ?? 'dist', 'sw.js');
      const worker = readFileSync(workerPath, 'utf8')
        .replace("const CACHE_NAME = 'feitsui-water-map-v9';", `const CACHE_NAME = 'feitsui-water-map-${version}';`)
        .replace('const STATIC_ASSETS = [', `const STATIC_ASSETS = [\n${assets.map(file => `  ${JSON.stringify(file)},`).join('\n')}`);
      writeFileSync(workerPath, worker);
    },
  }],
});
