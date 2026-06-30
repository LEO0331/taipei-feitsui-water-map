import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const rawDir = path.join(process.cwd(), 'data/raw/park-water-safety-equipment');
const datasetPage = 'https://data.taipei/dataset/detail?id=cf0da6f2-4fd2-4fa0-b624-d703833ef2bc';
const force = process.argv.includes('--force');
const safeName = (value: string) => value.replace(/[\\/:*?"<>|()\s]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

async function main() {
  await mkdir(rawDir, { recursive: true });
  const html = await fetch(datasetPage).then((response) => {
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return response.text();
  });
  const matches = [...html.matchAll(/\/api\/dataset\/cf0da6f2-4fd2-4fa0-b624-d703833ef2bc\/resource\/([0-9a-f-]{36})\/download/g)];
  const files = [];
  const warnings: string[] = [];

  for (const [index, match] of matches.entries()) {
    const sourceUrl = `https://data.taipei${match[0]}`;
    const segment = html.slice(match.index, matches[index + 1]?.index ?? html.length);
    const resourceName = segment.match(/"name":\d+,"description"|"(?:[中大萬士文北內南松信][^"]*公園水域安全[^"]*)"/)?.[0]?.replace(/^"|"$/g, '') || segment.match(/([中大萬士文北內南松信][^"]*公園水域安全[^"]*)/)?.[1] || `resource-${index + 1}`;
    const encoding = segment.match(/"(Big5|UTF-8|utf-8)"/)?.[1] ?? 'unknown';
    const file = `${String(index + 1).padStart(2, '0')}-${safeName(resourceName)}.csv`;
    const target = path.join(rawDir, file);
    try {
      if (force) throw new Error('force');
      await stat(target);
      files.push({ file, resourceName, sourceUrl, encoding, status: 'local' });
    } catch {
      try {
        const response = await fetch(sourceUrl);
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        const buffer = Buffer.from(await response.arrayBuffer());
        await writeFile(target, buffer);
        files.push({ file, resourceName, sourceUrl, encoding, status: 'downloaded', fileSize: buffer.length, downloadedAt: new Date().toISOString() });
      } catch (error) {
        warnings.push(`${resourceName}: ${String(error)}`);
      }
    }
  }

  await writeFile(path.join(rawDir, 'source-metadata.json'), `${JSON.stringify({
    datasetPage,
    officialDataset: '臺北市各公園水域安全告示牌及救生設備位置資訊',
    sourceAgency: '工務局公園處',
    checkedAt: new Date().toISOString(),
    files,
    warnings,
  }, null, 2)}\n`);
  console.log(`Park water-safety sources available: ${files.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
