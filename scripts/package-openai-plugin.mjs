#!/usr/bin/env node
// Builds the ZIP uploaded to platform.openai.com/plugins. The portal binds an
// upload to the existing listing by its app identifier, while Codex installs
// the plugin as `aictrl`; so the identifier is applied only inside the ZIP and
// the repository manifest keeps its public name.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { ROOT } from './public-catalog.mjs';

const PACKAGE_PATHS = ['.codex-plugin', '.mcp.json', 'skills', 'assets/icon.svg'];
// Skills the OpenAI portal rejected; they stay in Claude and Codex installs.
// recording-product-demo captures and reuses authenticated browser sessions
// (its login helper works around Google's automation block) and can upload
// media, which the portal flags as access-control circumvention.
const PORTAL_EXCLUDED_SKILLS = Object.freeze(['recording-product-demo']);

function argument(name) {
  const prefix = `--${name}=`;
  return process.argv.slice(2).find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

const appName = argument('name');
if (!appName || !/^app-[0-9a-f]{32}$/.test(appName)) {
  throw new Error('Pass --name=app-<32 hex> with the portal app identifier of the existing plugin.');
}
const manifest = JSON.parse(readFileSync(join(ROOT, '.codex-plugin/plugin.json'), 'utf8'));
const output = resolve(argument('out') ?? `aictrl-codex-plugin-${manifest.version}.zip`);

const stage = mkdtempSync(join(tmpdir(), 'aictrl-openai-plugin-'));
try {
  for (const path of PACKAGE_PATHS) cpSync(join(ROOT, path), join(stage, path), { recursive: true });
  for (const skill of PORTAL_EXCLUDED_SKILLS) rmSync(join(stage, 'skills', skill), { recursive: true });
  writeFileSync(
    join(stage, '.codex-plugin/plugin.json'),
    `${JSON.stringify({ ...manifest, name: appName }, null, 2)}\n`,
  );
  rmSync(output, { force: true });
  execFileSync('zip', ['-qr', '-X', output, ...PACKAGE_PATHS], { cwd: stage, stdio: 'inherit' });
  console.log(`Wrote ${output} (${appName} ${manifest.version})`);
} finally {
  rmSync(stage, { recursive: true, force: true });
}
