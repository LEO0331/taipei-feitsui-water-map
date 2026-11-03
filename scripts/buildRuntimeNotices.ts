import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

type LockedPackage = { version?: string; dev?: boolean };

function noticeFiles(directory: string, prefix = ''): string[] {
  return readdirSync(join(directory, prefix), { withFileTypes: true }).flatMap(entry => {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory() && !['node_modules', '.git'].includes(entry.name)) return noticeFiles(directory, path);
    return entry.isFile() && /(?:^|[-_.])(licen[cs]e|copying|notice|copyright)(?:$|[-_.])/i.test(entry.name) ? [path] : [];
  }).sort();
}

/** Inventory installed non-development packages without interpreting license compatibility. */
export function buildRuntimeNotices(root: string) {
  const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8')) as { packages: Record<string, LockedPackage> };
  const ownLicense = readFileSync(join(root, 'LICENSE'), 'utf8');
  const sections = ['Runtime license and notice texts\n\nThis factual inventory includes installed non-development dependencies, including packages that may be removed by bundling. License identifiers are package metadata; the full accompanying texts apply. It is not a compatibility or legal-use certification.\n\nProject and copied Portfolio Explorer code — LeoChen\n\n' + ownLicense];
  const packages = [];
  for (const [path, locked] of Object.entries(lock.packages).sort(([a], [b]) => a.localeCompare(b))) {
    if (!path.includes('node_modules/') || locked.dev || !existsSync(join(root, path, 'package.json'))) continue;
    const directory = join(root, path);
    const metadata = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8')) as { name: string; version: string; license?: unknown };
    if (metadata.version !== locked.version) throw new Error(`Installed version differs from lockfile: ${path}`);
    const files = noticeFiles(directory);
    const texts = files.map(file => ({ file, path: `${path}/${file}`, sourceUrl: undefined as string | undefined, text: readFileSync(join(directory, file), 'utf8') }));
    if (metadata.name === 'victory-vendor') {
      if (metadata.version !== '37.3.6') throw new Error('Review the version-pinned Victory wrapper license before changing versions');
      const licensePath = 'licenses/victory-vendor-37.3.6-LICENSE.txt';
      texts.unshift({ file: 'LICENSE.txt (version-pinned upstream wrapper)', path: licensePath, sourceUrl: 'https://raw.githubusercontent.com/FormidableLabs/victory/v37.3.6/LICENSE.txt', text: readFileSync(join(root, licensePath), 'utf8') });
    }
    if (!texts.length) throw new Error(`Missing license/notice text: ${metadata.name}@${metadata.version}`);
    const license = typeof metadata.license === 'string' ? metadata.license : JSON.stringify(metadata.license ?? 'not declared');
    packages.push({ name: metadata.name, version: metadata.version, path, license, files: texts.map(({ file, path, sourceUrl, text }) => ({ file, path, sourceUrl, sha256: createHash('sha256').update(text).digest('hex') })) });
    sections.push(`${metadata.name}@${metadata.version}\nInstalled path: ${path}\nDeclared license: ${license}\n\n` + texts.map(({ file, sourceUrl, text }) => `--- ${file}${sourceUrl ? `; source: ${sourceUrl}` : ''} ---\n${text}`).join('\n\n'));
  }
  return { text: sections.join('\n\n' + '='.repeat(72) + '\n\n') + '\n', inventory: { source: 'installed packages selected from package-lock.json packages where dev is not true', packages } };
}
