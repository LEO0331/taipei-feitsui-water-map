import { mkdir, readFile, writeFile } from 'node:fs/promises';
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
  status: 'fetched';
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
const rawDir = path.join(root, 'data/raw/feitsui-water');
const manualPath = path.join(rawDir, 'manual-resources.json');
const datasetDetailUrl = 'https://data.taipei/dataset/detail?id=dd7001c8-7a87-4294-a52a-e2c14bc49d88';

async function readManualResources(): Promise<ManualResource[]> {
  try {
    const text = await readFile(manualPath, 'utf8');
    const parsed = JSON.parse(text) as { resources?: ManualResource[] };
    return parsed.resources ?? [];
  } catch {
    return [];
  }
}

function discoverResourceIds(html: string): ManualResource[] {
  const resources = new Map<string, ManualResource>();
  for (const match of html.matchAll(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi)) {
    const id = match[0];
    if (id === 'dd7001c8-7a87-4294-a52a-e2c14bc49d88' || resources.has(id)) continue;
    const afterId = html.slice(match.index ?? 0, (match.index ?? 0) + 700);
    const title = afterId.match(/"(\d{2,3}\s*年\s*\d{1,2}\s*月[^"]*翡翠水庫水質月報表[^"]*)"/)?.[1]
      ?? afterId.match(/"(\d{2,3}\s*年\s*\d{1,2}\s*月[^"]*)"/)?.[1]
      ?? 'Discovered Taipei Open Data resource';
    resources.set(id, { id, title: title.trim() });
  }
  return [...resources.values()];
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
        offset?: number;
        count?: number;
        results?: Array<Record<string, unknown>>;
      };
    };
    lastEnvelope = json;
    const page = json.result?.results ?? [];
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
  const manual = await readManualResources();
  let discovered: ManualResource[] = [];

  try {
    const detail = await fetch(datasetDetailUrl);
    if (detail.ok) discovered = discoverResourceIds(await detail.text());
  } catch (error) {
    console.warn(`Dataset detail discovery failed; continuing with manual resources. ${String(error)}`);
  }

  const resources = new Map<string, ManualResource>();
  for (const resource of [...discovered, ...manual]) resources.set(resource.id, resource);

  const index: ResourceIndexEntry[] = [];
  const errors: ResourceIndexError[] = [];
  for (const resource of resources.values()) {
    const apiUrl = `https://data.taipei/api/v1/dataset/${resource.id}?scope=resourceAquire`;
    try {
      const fetched = await fetchAllPages(resource);
      const file = `${resource.id}.json`;
      await writeFile(path.join(rawDir, file), `${JSON.stringify(fetched, null, 2)}\n`);
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

  await writeFile(path.join(rawDir, 'resource-index.json'), `${JSON.stringify({ datasetDetailUrl, resources: index, errors }, null, 2)}\n`);
  console.log(`Fetched ${index.length} resource(s) into ${rawDir}`);
  if (errors.length) {
    console.warn(`Failed to fetch ${errors.length} resource(s); see resource-index.json errors.`);
  }
  if (!index.length) {
    throw new Error('No resources were fetched; see resource-index.json for failure details.');
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
