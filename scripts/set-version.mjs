import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const pkgPath = join(rootDir, 'package.json');

const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

const runGit = (args) => spawnSync('git', args, { cwd: rootDir, encoding: 'utf8' });
const hasRef = (ref) => runGit(['rev-parse', '--verify', ref]).status === 0;

const refCandidates = ['main', 'origin/main', 'HEAD'];
const ref = refCandidates.find(hasRef);
if (!ref) {
  console.error('Unable to determine git ref for versioning.');
  process.exit(1);
}

const countResult = runGit(['rev-list', '--count', ref]);
if (countResult.status !== 0) {
  console.error('Failed to read commit count:', countResult.stderr || countResult.stdout);
  process.exit(1);
}

const commitCount = Number(String(countResult.stdout).trim());
if (!Number.isFinite(commitCount) || commitCount <= 0) {
  console.error('Invalid commit count:', countResult.stdout);
  process.exit(1);
}

const explicitBase =
  process.env.VERSION_BASE ||
  pkg.versionBase ||
  pkg.version;

const match = String(explicitBase).match(/^(\d+)\.(\d+)/);
if (!match) {
  console.error('Invalid base version:', explicitBase);
  process.exit(1);
}

const major = Number(match[1]);
const minor = Number(match[2]);
if (!Number.isFinite(major) || !Number.isFinite(minor)) {
  console.error('Invalid base version:', explicitBase);
  process.exit(1);
}

const nextVersion = `${major}.${minor}.${commitCount}`;

if (pkg.version !== nextVersion) {
  pkg.version = nextVersion;
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
}

console.log(nextVersion);
