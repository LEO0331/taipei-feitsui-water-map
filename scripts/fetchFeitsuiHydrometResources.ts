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
const rawDir = path.join(root, 'data/raw/feitsui-hydromet');
const manualPath = path.join(rawDir, 'manual-resources.json');
const maxRawAgeMs = 24 * 60 * 60 * 1000;

async function readManualResources(): Promise<ManualResource[]> {
  const text = await readFile(manualPath, 'utf8');
  const parsed = JSON.parse(text) as { resources?: ManualResource[] };
  return parsed.resources ?? [];
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
  const resources = await readManualResources();
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
  console.log(`Fetched or reused ${index.length} hydromet resource(s) into ${rawDir}`);
  if (!index.length) throw new Error('No hydromet resources were available; see resource-index.json for errors.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
