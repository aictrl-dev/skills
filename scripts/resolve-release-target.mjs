#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './public-catalog.mjs';

const tag = process.argv[2];
const metadata = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const expectedTag = `v${metadata.version}`;

if (tag !== expectedTag) {
  console.error(`Release tag ${tag || '(missing)'} does not match ${metadata.name}@${metadata.version}; expected ${expectedTag}`);
  process.exit(1);
}

process.stdout.write('package_spec=.\n');
process.stdout.write(`dist_tag=${metadata.publishConfig?.tag || 'latest'}\n`);
