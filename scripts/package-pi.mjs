#!/usr/bin/env node
// Generate npm metadata only in build output. The repository root remains the
// Claude plugin, and skills/ remains the single source for every distribution.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, readJson } from './public-catalog.mjs';

// Everything the package is built from. The build copies working-tree bytes, so
// publishing requires these paths to match the checked-out commit exactly.
export const PACKAGE_INPUTS = ['skills', 'submission/pi', 'LICENSE', '.claude-plugin/plugin.json'];

export function buildPiPackage({ output = join(ROOT, 'dist/pi-package'), requireClean = true } = {}) {
  if (requireClean) {
    const dirty = dirtyPackageInputs();
    if (dirty.length > 0) {
      throw new Error(`Refusing to build: package inputs differ from the commit (${dirty.join(', ')}). Publish from a clean checkout.`);
    }
  }
  const manifest = {
    ...readJson('submission/pi/pi-package.template.json'),
    version: readJson('.claude-plugin/plugin.json').version,
  };

  rmSync(output, { recursive: true, force: true });
  mkdirSync(output, { recursive: true });
  // Copy only git-tracked skill files: a working tree can hold untracked or
  // ignored files (.env, node_modules, __pycache__) that must never be published.
  for (const path of trackedSkillFiles()) {
    mkdirSync(dirname(join(output, path)), { recursive: true });
    cpSync(join(ROOT, path), join(output, path));
  }
  cpSync(join(ROOT, 'submission/pi/README.md'), join(output, 'README.md'));
  cpSync(join(ROOT, 'LICENSE'), join(output, 'LICENSE'));
  writeFileSync(join(output, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  const parsed = JSON.parse(execFileSync(
    'npm', ['pack', '--dry-run', '--json', '--ignore-scripts'],
    { cwd: output, encoding: 'utf8', timeout: 60_000, maxBuffer: 4 * 1024 * 1024 },
  ));
  // npm prints an array today; a later npm may key the result by package name.
  const pack = Array.isArray(parsed) ? parsed[0] : parsed[manifest.name];
  if (!Array.isArray(pack?.files)) throw new Error('Unexpected npm pack --json output: no file list.');
  return { output, manifest, pack };
}

export function trackedSkillFiles() {
  const files = git(ROOT, ['ls-files', '-z', '--', 'skills']).split('\0').filter(Boolean);
  if (files.length === 0) throw new Error('No tracked files under skills/: run from a git checkout of aictrl-dev/skills.');
  return files;
}

// Staged or unstaged changes to tracked package inputs (untracked files are never copied).
export function dirtyPackageInputs(cwd = ROOT) {
  return git(cwd, ['status', '--porcelain', '-z', '--untracked-files=no', '--', ...PACKAGE_INPUTS])
    .split('\0').filter(Boolean).map((entry) => entry.slice(3));
}

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', timeout: 10_000, maxBuffer: 4 * 1024 * 1024 });
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const { output, manifest, pack } = buildPiPackage();
  console.log(`Staged ${manifest.name}@${manifest.version} at ${output}`);
  console.log('npm pack --dry-run file list:');
  for (const file of pack.files) console.log(`  ${file.path} (${file.size} bytes)`);
  console.log(`${pack.files.length} files; ${pack.size} bytes packed; ${pack.unpackedSize} bytes unpacked.`);
}
