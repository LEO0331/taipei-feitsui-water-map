import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const urls = [
  'https://data.taipei/api/frontstage/tpeod/dataset/resource.download?rid=0f4541e5-9f7c-406f-bbd4-3c22e6255465',
  'https://data.taipei/api/frontstage/tpeod/dataset/resource.download?rid=dd0f5ff1-d688-40f4-9a53-c5faaeca05a2',
];
const rawDir = path.join(process.cwd(), 'data/raw/storm-rainfall-rented-machinery-sites');
await mkdir(rawDir, { recursive: true });
const files = await Promise.all(urls.map(async (url, index) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download machinery resource: ${response.status}`);
  const file = `official-${index + 1}.csv`;
  await writeFile(path.join(rawDir, file), Buffer.from(await response.arrayBuffer()));
  return { file, url };
}));
await writeFile(path.join(rawDir, 'source-metadata.json'), `${JSON.stringify({ datasetUrl: 'https://data.taipei/dataset/detail?id=cdbc2677-7f23-42e5-9b83-a57ab9bee39c', downloadedAt: new Date().toISOString(), files }, null, 2)}\n`);
console.log(`Fetched ${files.length} machinery resource(s).`);
