import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const testDir = join(__dirname, '..', 'tests');
const testFiles = readdirSync(testDir, { withFileTypes: true })
  .filter((ent) => ent.isFile() && ent.name.endsWith('.test.ts'))
  .map((ent) => join(testDir, ent.name));

if (testFiles.length === 0) {
  console.error('No test files found.');
  process.exit(1);
}

const [major, minor] = process.versions.node.split('.').map((n) => Number(n));
const useImport =
  major > 20 ||
  (major === 20 && minor >= 6) ||
  (major === 18 && minor >= 19);

const loaderFlag = useImport ? ['--import', 'tsx'] : ['--loader', 'tsx'];
const args = ['--test', ...loaderFlag, ...testFiles];

const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
process.exit(result.status ?? 1);

