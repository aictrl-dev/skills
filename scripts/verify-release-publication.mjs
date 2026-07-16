#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const defaultRegistry = 'https://registry.npmjs.org/';

export async function inspectReleasePublication(
  packageSpec,
  {
    fetchImpl = fetch,
    pack = packPackage,
    registry = process.env.NPM_CONFIG_REGISTRY || defaultRegistry,
  } = {},
) {
  const packageDirectory = resolve(root, packageSpec);
  const relativePackageDirectory = relative(root, packageDirectory);
  if (relativePackageDirectory.startsWith('..') || isAbsolute(relativePackageDirectory)) {
    throw new Error(`Package target must stay inside the repository: ${packageSpec}`);
  }

  const packageMetadata = JSON.parse(readFileSync(resolve(packageDirectory, 'package.json'), 'utf8'));
  const { name, version } = packageMetadata;
  if (typeof name !== 'string' || typeof version !== 'string') {
    throw new Error(`Package target is missing a valid name or version: ${packageSpec}`);
  }

  const registryBase = registry.endsWith('/') ? registry : `${registry}/`;
  const metadataUrl = `${registryBase}${encodeURIComponent(name)}/${encodeURIComponent(version)}`;
  const response = await fetchImpl(metadataUrl, { headers: { accept: 'application/json' } });

  if (response.status === 404) return { published: false, name, version };
  if (!response.ok) {
    throw new Error(`npm registry returned HTTP ${response.status} for ${name}@${version}`);
  }

  const publishedMetadata = await response.json();
  const publishedIntegrity = publishedMetadata?.dist?.integrity;
  if (typeof publishedIntegrity !== 'string' || publishedIntegrity.length === 0) {
    throw new Error(`Published ${name}@${version} has no registry integrity`);
  }

  const packed = await pack(packageSpec);
  if (packed.name !== name || packed.version !== version || typeof packed.integrity !== 'string') {
    throw new Error(`Local package metadata does not match ${name}@${version}`);
  }
  if (packed.integrity !== publishedIntegrity) {
    throw new Error(`Published ${name}@${version} does not match the local release package`);
  }

  return { published: true, name, version };
}

async function packPackage(packageSpec) {
  const output = execFileSync('npm', [
    'pack', packageSpec, '--dry-run', '--json', '--ignore-scripts',
  ], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  const result = JSON.parse(output)?.[0];
  if (!result) throw new Error(`npm pack returned no package for ${packageSpec}`);
  return result;
}

async function main() {
  const packageSpec = process.argv[2];
  if (!packageSpec) throw new Error('Usage: verify-release-publication.mjs <package-spec>');

  const result = await inspectReleasePublication(packageSpec);
  process.stdout.write(`published=${result.published}\n`);
  process.stderr.write(
    result.published
      ? `${result.name}@${result.version} is already published with matching integrity.\n`
      : `${result.name}@${result.version} is not yet published.\n`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
