import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

type ManualResource = {
  id: string;
  title?: string;
};

type ResourceIndexEntry = {
  id: string;
  title: string;
  apiUrl: string;
  fetchedAt: string;
  file: string;
  recordCount: number;
  status: 'fetched' | 'skipped';
};

type ResourceIndexError = {
  id: string;
  title: string;
  apiUrl: string;
  fetchedAt: string;
  status: 'failed';
  error: string;
};

const root = process.cwd();
const rawDir = path.join(root, 'data/raw/feitsui-operation');
const manualPath = path.join(rawDir, 'manual-resources.json');
const datasetPage = 'https://data.taipei/dataset/detail?id=e6189636-9972-4c65-8a8b-5607a867c6be';
const maxRawAgeMs = 24 * 60 * 60 * 1000;

async function readManualResources(): Promise<ManualResource[]> {
  try {
    const text = await readFile(manualPath, 'utf8');
    const parsed = JSON.parse(text) as { resources?: ManualResource[] };
    return parsed.resources ?? [];
  } catch {
    return [];
  }
}

async function discoverResources(): Promise<ManualResource[]> {
  try {
    const response = await fetch(datasetPage);
    if (!response.ok) throw new Error(`Failed ${response.status} ${response.statusText}: ${datasetPage}`);
    const html = await response.text();
    const resources = new Map<string, ManualResource>();
    const pattern = /"rid":\d+,"url":"[^"]+","url_type":[^}]+?"name":(\d+)[\s\S]*?"([0-9a-f-]{36})"/g;
    for (const match of html.matchAll(pattern)) {
      const id = match[2];
      if (!resources.has(id)) resources.set(id, { id });
    }
    for (const match of html.matchAll(/"([0-9a-f-]{36})"[\s\S]{0,220}?"([^"]*水庫運轉資料[^"]*)"/g)) {
      const [, id, title] = match;
      resources.set(id, { id, title });
    }
    return [...resources.values()];
  } catch {
    return [];
  }
}

async function isFresh(filePath: string): Promise<boolean> {
  try {
    return Date.now() - (await stat(filePath)).mtimeMs < maxRawAgeMs;
  } catch {
    return false;
  }
}

async function fetchAllPages(resource: ManualResource) {
  const allResults: Array<Record<string, unknown>> = [];
  let limit = 1000;
  let offset = 0;
  let lastEnvelope: unknown = null;

  while (true) {
    const apiUrl = `https://data.taipei/api/v1/dataset/${resource.id}?scope=resourceAquire&limit=${limit}&offset=${offset}`;
    const response = await fetch(apiUrl);
    if (!response.ok) throw new Error(`Failed ${response.status} ${response.statusText}: ${apiUrl}`);
    const json = await response.json() as {
      result?: {
        limit?: number;
        count?: number;
        results?: Array<Record<string, unknown>>;
      };
    };
    const page = json.result?.results ?? [];
    lastEnvelope = json;
    allResults.push(...page);
    limit = json.result?.limit ?? limit;
    offset += page.length;
    const count = json.result?.count ?? page.length;
    if (!page.length || offset >= count) break;
  }

  return {
    resource: {
      id: resource.id,
      title: resource.title ?? resource.id,
    },
    result: {
      limit,
      offset: 0,
      count: allResults.length,
      results: allResults,
    },
    sourceEnvelope: lastEnvelope,
  };
}

async function main() {
  await mkdir(rawDir, { recursive: true });
  const manualResources = await readManualResources();
  const discoveredResources = await discoverResources();
  const resourceMap = new Map<string, ManualResource>();
  for (const resource of [...discoveredResources, ...manualResources]) resourceMap.set(resource.id, resource);
  const resources = [...resourceMap.values()];
  const index: ResourceIndexEntry[] = [];
  const errors: ResourceIndexError[] = [];

  for (const resource of resources) {
    const apiUrl = `https://data.taipei/api/v1/dataset/${resource.id}?scope=resourceAquire`;
    const file = `${resource.id}.json`;
    const filePath = path.join(rawDir, file);
    try {
      if (await isFresh(filePath)) {
        const cached = JSON.parse(await readFile(filePath, 'utf8')) as { result?: { results?: unknown[] } };
        index.push({
          id: resource.id,
          title: resource.title ?? resource.id,
          apiUrl,
          fetchedAt: new Date().toISOString(),
          file,
          recordCount: cached.result?.results?.length ?? 0,
          status: 'skipped',
        });
        continue;
      }

      const fetched = await fetchAllPages(resource);
      await writeFile(filePath, `${JSON.stringify(fetched, null, 2)}\n`);
      index.push({
        id: resource.id,
        title: resource.title ?? resource.id,
        apiUrl,
        fetchedAt: new Date().toISOString(),
        file,
        recordCount: fetched.result.results.length,
        status: 'fetched',
      });
    } catch (error) {
      errors.push({
        id: resource.id,
        title: resource.title ?? resource.id,
        apiUrl,
        fetchedAt: new Date().toISOString(),
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  await writeFile(path.join(rawDir, 'resource-index.json'), `${JSON.stringify({ resources: index, errors }, null, 2)}\n`);
  console.log(`Fetched or reused ${index.length} operation resource(s) into ${rawDir}`);
  if (!index.length) throw new Error('No operation resources were available; see resource-index.json for errors.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
