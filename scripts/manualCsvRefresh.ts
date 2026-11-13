import { randomUUID } from 'node:crypto';
import { rename, rm, writeFile } from 'node:fs/promises';
import { preparednessCsv } from './buildPreparednessDecisionSnapshot';

const maxDownloadBytes = 8 * 1024 * 1024;
const requestTimeoutMs = 30_000;

async function download(url: string): Promise<Buffer> {
  const response = await fetch(url, { signal: AbortSignal.timeout(requestTimeoutMs) });
  if (!response.ok || response.status === 206 || !response.body) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error(`Taipei Open Data request failed (HTTP ${response.status})`);
  }

  if (Number(response.headers.get('content-length')) > maxDownloadBytes) {
    await response.body.cancel().catch(() => undefined);
    throw new Error('Taipei Open Data response exceeded the download limit');
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > maxDownloadBytes) throw new Error('Taipei Open Data response exceeded the download limit');
      chunks.push(chunk.value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  return Buffer.concat(chunks, size);
}

export async function findCsvResource(pageUrl: string): Promise<string | undefined> {
  const page = (await download(pageUrl)).toString('utf8');
  return page.match(/https:\/\/data\.taipei\/api\/v1\/dataset\/[^"'\s<>]+\?scope=resourceAquire/g)?.[0];
}

type CsvSchema = {
  columns: ReadonlyArray<string | RegExp>;
  hasUsableRow: (row: Record<string, string>) => boolean;
};

export async function downloadValidatedCsv(url: string, schema: CsvSchema): Promise<Buffer> {
  const bytes = await download(url);
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    text = new TextDecoder('big5', { fatal: true }).decode(bytes);
  }
  const rows = preparednessCsv(text);
  const headers = Object.keys(rows[0] ?? {});
  const matchesSchema = schema.columns.every(column =>
    typeof column === 'string' ? headers.includes(column) : headers.some(header => column.test(header))
  );
  if (!matchesSchema || !rows.some(schema.hasUsableRow)) {
    throw new Error('Taipei Open Data CSV is empty or does not match the expected dataset');
  }
  return bytes;
}

export async function replaceFile(target: string, contents: string | Buffer): Promise<void> {
  const temporary = `${target}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, contents, { flag: 'wx' });
    await rename(temporary, target);
  } finally {
    await rm(temporary, { force: true });
  }
}
