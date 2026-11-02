import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? '/taipei-feitsui-water-map/' : '/',
  plugins: [react(), {
    name: 'precache-built-modules',
    apply: 'build',
    writeBundle(options, bundle) {
      // Cache deferred modules during PWA installation so previously unvisited
      // panels remain available offline. This does not eagerly execute them.
      const assets = Object.keys(bundle).filter(file => /\.(js|css)$/.test(file)).sort();
      const version = createHash('sha256').update(assets.join('\n')).digest('hex').slice(0, 16);
      const workerPath = resolve(options.dir ?? 'dist', 'sw.js');
      const worker = readFileSync(workerPath, 'utf8')
        .replace("const CACHE_NAME = 'feitsui-water-map-v9';", `const CACHE_NAME = 'feitsui-water-map-${version}';`)
        .replace('const STATIC_ASSETS = [', `const STATIC_ASSETS = [\n${assets.map(file => `  ${JSON.stringify(file)},`).join('\n')}`);
      writeFileSync(workerPath, worker);
    },
  }],
});
