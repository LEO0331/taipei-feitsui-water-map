import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const rawDir = path.join(root, 'data/raw/taipei-water-support-twc-monthly-statistics');
const datasetPage = 'https://data.taipei/dataset/detail?id=ab446f19-0f95-4e55-b593-0eea8e447c7d';
const force = process.argv.includes('--force');

async function main() {
  await mkdir(rawDir, { recursive: true });
  const html = await fetch(datasetPage).then((response) => {
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return response.text();
  });
  const matches = [...html.matchAll(/\/api\/dataset\/ab446f19-0f95-4e55-b593-0eea8e447c7d\/resource\/([0-9a-f-]{36})\/download/g)];
  const warnings: string[] = [];
  const files = [];

  for (const [index, match] of matches.entries()) {
    const url = match[0];
    const segment = html.slice(match.index, matches[index + 1]?.index ?? html.length);
    const name = segment.match(/(\d{3}年度支援台灣自來水公司清水量月報表)/)?.[1] ?? `resource-${index + 1}`;
    const year = name.match(/\d{3}/)?.[0] ?? String(index + 1);
    const file = `${year}年度支援台水月統計.csv`;
    const target = path.join(rawDir, file);
    try {
      if (force) throw new Error('force download');
      await stat(target);
      files.push({ file, sourceUrl: `https://data.taipei${url}`, resourceName: name, status: 'local' });
      continue;
    } catch {
      // download below
    }
    try {
      const response = await fetch(`https://data.taipei${url}`);
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      await writeFile(target, buffer);
      files.push({ file, sourceUrl: `https://data.taipei${url}`, resourceName: name, status: 'downloaded', fileSize: buffer.length, encoding: 'Big5' });
    } catch (error) {
      warnings.push(`${name} download failed: ${String(error)}`);
    }
  }

  await writeFile(path.join(rawDir, 'source-metadata.json'), `${JSON.stringify({
    datasetPage,
    officialDataset: '臺北自來水事業處支援台水月統計表',
    sourceAgency: '北水處',
    checkedAt: new Date().toISOString(),
    files,
    warnings,
  }, null, 2)}\n`);
  console.log(`Taipei Water support-to-TWC sources available: ${files.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
