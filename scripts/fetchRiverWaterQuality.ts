import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const rawDir = path.join(root, 'data/raw/river-water-quality');
const datasetPage = 'https://data.taipei/dataset/detail?id=759db528-77b5-4aa3-b6fa-2b857890214e';
const force = process.argv.includes('--force');

async function main() {
  await mkdir(rawDir, { recursive: true });
  const existing = (await Promise.all(
    ['112', '113', '114', '115'].map(async (year) => {
      const file = `${year}河川水質檢測結果(Big5編碼).csv`;
      try {
        const info = await stat(path.join(rawDir, file));
        return { file, size: info.size, status: 'local' };
      } catch {
        return null;
      }
    }),
  )).filter(Boolean);

  const notes: string[] = [];
  if (force || !existing.length) {
    try {
      const response = await fetch(datasetPage);
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const html = await response.text();
      const match = html.match(/\/api\/dataset\/759db528-77b5-4aa3-b6fa-2b857890214e\/resource\/([0-9a-f-]{36})\/download/);
      if (!match) throw new Error('No CSV resource link found on dataset page.');
      const sourceUrl = `https://data.taipei${match[0]}`;
      const csvResponse = await fetch(sourceUrl);
      if (!csvResponse.ok) throw new Error(`${csvResponse.status} ${csvResponse.statusText}`);
      const buffer = Buffer.from(await csvResponse.arrayBuffer());
      const file = `download-${match[1]}.csv`;
      await writeFile(path.join(rawDir, file), buffer);
      existing.push({ file, size: buffer.length, status: 'downloaded' });
    } catch (error) {
      notes.push(`Official download failed; local files remain usable: ${String(error)}`);
    }
  }

  await writeFile(path.join(rawDir, 'source-metadata.json'), `${JSON.stringify({
    datasetPage,
    checkedAt: new Date().toISOString(),
    encoding: 'Big5/CP950 with UTF-8-SIG fallback',
    files: existing,
    notes,
  }, null, 2)}\n`);
  console.log(`River water-quality sources available: ${existing.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
