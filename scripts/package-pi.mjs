#!/usr/bin/env node
// Generate npm metadata only in build output. The repository root remains the
// Claude plugin, and skills/ remains the single source for every distribution.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, readJson } from './public-catalog.mjs';

export function buildPiPackage(output = join(ROOT, 'dist/pi-package')) {
  const manifest = {
    ...readJson('submission/pi/pi-package.template.json'),
    version: readJson('.claude-plugin/plugin.json').version,
  };

  rmSync(output, { recursive: true, force: true });
  mkdirSync(output, { recursive: true });
  for (const [source, destination] of [
    ['skills', 'skills'],
    ['submission/pi/README.md', 'README.md'],
    ['LICENSE', 'LICENSE'],
  ]) {
    cpSync(join(ROOT, source), join(output, destination), { recursive: true });
  }
  writeFileSync(join(output, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  const [pack] = JSON.parse(execFileSync(
    'npm', ['pack', '--dry-run', '--json', '--ignore-scripts'],
    { cwd: output, encoding: 'utf8', timeout: 60_000, maxBuffer: 4 * 1024 * 1024 },
  ));
  return { output, manifest, pack };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const { output, manifest, pack } = buildPiPackage();
  console.log(`Staged ${manifest.name}@${manifest.version} at ${output}`);
  console.log('npm pack --dry-run file list:');
  for (const file of pack.files) console.log(`  ${file.path} (${file.size} bytes)`);
  console.log(`${pack.files.length} files; ${pack.size} bytes packed; ${pack.unpackedSize} bytes unpacked.`);
}
