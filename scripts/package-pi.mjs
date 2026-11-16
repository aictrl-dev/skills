#!/usr/bin/env node
// Generate npm metadata only in build output. The repository root remains the
// Claude plugin, and skills/ remains the single source for every distribution.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, readJson } from './public-catalog.mjs';

// Everything the package is built from. The build copies working-tree bytes, so
// publishing requires every one of these files to match the commit exactly.
const PACKAGE_INPUTS = ['skills', 'submission/pi', 'LICENSE', '.claude-plugin/plugin.json'];

// Stages dist/pi-package and packs it into a tarball beside it. The tarball is
// the artifact to publish, so what was checked is byte-for-byte what ships.
export function buildPiPackage({ output = join(ROOT, 'dist/pi-package'), requireClean = true } = {}) {
  if (requireClean) {
    const divergent = divergentPackageInputs();
    if (divergent.length > 0) {
      throw new Error(`Refusing to build: package inputs differ from the commit (${divergent.join(', ')}). Publish from a clean checkout.`);
    }
  }
  const manifest = {
    ...readJson('submission/pi/pi-package.template.json'),
    version: readJson('.claude-plugin/plugin.json').version,
  };

  rmSync(output, { recursive: true, force: true });
  mkdirSync(output, { recursive: true });
  // Copy only skill files in the commit: a working tree can hold untracked or
  // ignored files (.env, node_modules, __pycache__) that must never be published.
  for (const path of trackedSkillFiles()) {
    mkdirSync(dirname(join(output, path)), { recursive: true });
    cpSync(join(ROOT, path), join(output, path));
  }
  cpSync(join(ROOT, 'submission/pi/README.md'), join(output, 'README.md'));
  cpSync(join(ROOT, 'LICENSE'), join(output, 'LICENSE'));
  writeFileSync(join(output, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  const parsed = JSON.parse(execFileSync(
    'npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', dirname(output)],
    { cwd: output, encoding: 'utf8', timeout: 60_000, maxBuffer: 4 * 1024 * 1024 },
  ));
  // npm prints an array today; a later npm may key the result by package name.
  const pack = Array.isArray(parsed) ? parsed[0] : parsed[manifest.name];
  if (!Array.isArray(pack?.files) || !pack.filename) throw new Error('Unexpected npm pack --json output: no file list or tarball.');
  return { output, manifest, pack, tarball: join(dirname(output), basename(pack.filename)) };
}

export function trackedSkillFiles() {
  const files = [...headBlobs(ROOT, ['skills']).keys()];
  if (files.length === 0) throw new Error('No committed files under skills/: run from a git checkout of aictrl-dev/skills.');
  return files;
}

// Package inputs whose working-tree bytes differ from HEAD: modified, staged,
// deleted, or hidden by skip-worktree/assume-unchanged. Compares content
// hashes, so index flags cannot mask a change. Untracked files are never copied.
export function divergentPackageInputs(cwd = ROOT) {
  const blobs = headBlobs(cwd, PACKAGE_INPUTS);
  const present = [...blobs.keys()].filter((path) => existsSync(join(cwd, path)));
  const hashes = present.length === 0 ? [] : git(cwd, ['hash-object', '--no-filters', '--stdin-paths'], `${present.join('\n')}\n`)
    .trim().split('\n');
  const actual = new Map(present.map((path, i) => [path, hashes[i]]));
  return [...blobs].filter(([path, blob]) => actual.get(path) !== blob).map(([path]) => path);
}

// path -> blob id for every file under paths in HEAD.
function headBlobs(cwd, paths) {
  return new Map(git(cwd, ['ls-tree', '-r', '-z', '--full-tree', 'HEAD', '--', ...paths])
    .split('\0').filter(Boolean).map((record) => {
      const [meta, path] = record.split('\t');
      return [path, meta.split(' ')[2]];
    }));
}

function git(cwd, args, input) {
  return execFileSync('git', args, { cwd, input, encoding: 'utf8', timeout: 10_000, maxBuffer: 4 * 1024 * 1024 });
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const { output, manifest, pack, tarball } = buildPiPackage();
  console.log(`Staged ${manifest.name}@${manifest.version} at ${output}`);
  console.log('Packed file list:');
  for (const file of pack.files) console.log(`  ${file.path} (${file.size} bytes)`);
  console.log(`${pack.files.length} files; ${pack.size} bytes packed; ${pack.unpackedSize} bytes unpacked.`);
  console.log(`Publish this tarball: npm publish ${tarball} --access public`);
}
