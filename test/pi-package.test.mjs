import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import test, { after } from 'node:test';
import { runInNewContext } from 'node:vm';
import { buildPiPackage } from '../scripts/package-pi.mjs';
import { EXPECTED_PUBLIC_MCP_TOOLS, ROOT, listSkillNames, readJson } from '../scripts/public-catalog.mjs';

const scratch = mkdtempSync(join(tmpdir(), 'aictrl-pi-package-test-'));
after(() => rmSync(scratch, { recursive: true, force: true }));
const { output, manifest, pack } = buildPiPackage(join(scratch, 'package'));
const packedPaths = new Set(pack.files.map(({ path }) => path));

test('Pi npm metadata uses the gallery keyword and shared release version', () => {
  assert.equal(manifest.name, '@aictrl/skills');
  assert.equal(manifest.keywords[0], 'pi-package');
  assert.equal(manifest.version, readJson('.claude-plugin/plugin.json').version);
  assert.equal(manifest.license, 'MIT');
  assert.equal(manifest.homepage, 'https://aictrl.dev');
  assert.equal(manifest.repository.url, 'https://github.com/aictrl-dev/skills.git');
  assert.deepEqual(readJson('package.json', output), manifest);
});

test('every canonical skill and supporting file ships unchanged in the npm pack', () => {
  const skills = listSkillNames();
  assert.deepEqual(listSkillNames(output), skills);
  for (const path of filesUnder(join(ROOT, 'skills'), 'skills')) {
    assert.ok(packedPaths.has(path), `Not packed: ${path}`);
    assert.deepEqual(readFileSync(join(output, path)), readFileSync(join(ROOT, path)), path);
  }
  for (const skill of skills) {
    assert.ok(packedPaths.has(`skills/${skill}/SKILL.md`));
  }
});

test('manifest resources exist and the tarball contains only public package files', () => {
  for (const path of manifest.pi.skills) {
    assert.ok(statSync(join(output, path)).isDirectory(), path);
  }
  for (const path of manifest.pi.extensions) {
    assert.ok(statSync(join(output, path)).isFile(), path);
    assert.ok(packedPaths.has(path.replace(/^\.\//, '')), path);
  }
  assert.equal(new URL(manifest.pi.image).protocol, 'https:');
  assert.equal(manifest.pi.image, 'https://raw.githubusercontent.com/aictrl-dev/skills/main/assets/github-social-preview.png');
  for (const path of ['README.md', 'LICENSE', 'package.json']) assert.ok(packedPaths.has(path));
  for (const path of packedPaths) {
    assert.match(path, /^(?:skills\/|extensions\/|README\.md$|LICENSE$|package\.json$)/);
  }
  assert.deepEqual(readFileSync(join(output, 'README.md')), readFileSync(join(ROOT, 'submission/pi/README.md')));
  assert.deepEqual(readFileSync(join(output, 'LICENSE')), readFileSync(join(ROOT, 'LICENSE')));
});

test('gallery README covers every skill and attributes all aictrl.dev links to Pi', () => {
  const readme = readFileSync(join(output, 'README.md'), 'utf8');
  for (const skill of listSkillNames()) assert.ok(readme.includes(`\`${skill}\``), skill);
  assert.match(readme, /pi install npm:@aictrl\/skills/);
  assert.match(readme, /\/mcp login aictrl/);
  assert.match(readme, /execute-workflow` requires an authenticated aictrl connection/);
  const links = [...readme.matchAll(/https:\/\/aictrl\.dev[^\s)]+/g)].map(([url]) => new URL(url));
  assert.ok(links.length >= 2);
  assert.ok(links.some((url) => url.pathname === '/glm-coding-plan'));
  for (const url of links) {
    assert.equal(url.hostname, 'aictrl.dev');
    for (const [name, value] of Object.entries({
      utm_source: 'pi.dev', utm_medium: 'package', utm_campaign: 'pi-package',
      utm_listing: 'pi-package', utm_platform: 'pi',
    })) assert.equal(url.searchParams.get(name), value, `${url}: ${name}`);
  }
});

test('extension registers a quiet opt-in server with a bounded tool catalog', () => {
  const source = readFileSync(join(output, 'extensions/aictrl-mcp.ts'), 'utf8');
  // Erase the type-only import and parameter annotation; no TS runtime is needed
  // to exercise this registration on the repository's supported Node versions.
  const executable = source.replace(/^import type .*;\s*/m, '')
    .replace('export default ', '').replace('pi: ExtensionAPI', 'pi');
  const registrations = [];
  const register = runInNewContext(`(${executable})`, {});
  register({ registerMcpServer: (name, config) => registrations.push({ name, config }) });
  assert.equal(registrations.length, 1);
  const [{ name, config }] = registrations;
  assert.equal(name, 'aictrl');
  assert.equal(config.url, 'https://aictrl.dev/mcp');
  assert.equal(config.enabled, false);
  assert.equal(config.exposure, 'hidden');
  assert.ok(config.description.length > 20);
  assert.deepEqual(Object.keys(config.toolExposure).sort(), EXPECTED_PUBLIC_MCP_TOOLS
    .filter((tool) => !['get_started', 'list_workflow_runs'].includes(tool)).sort());
  assert.ok(Object.values(config.toolExposure).every((exposure) => exposure === 'deferred'));
});

test('repository contains no new npm manifests or lockfiles outside allowed locations', () => {
  // Include untracked source too, but respect ignored build output and installed
  // dependencies: generated dist/pi-package/package.json is intentionally local.
  const paths = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { cwd: ROOT, encoding: 'utf8', timeout: 10_000 }).split('\0').filter(Boolean);
  const manifests = paths.filter((path) => basename(path) === 'package.json');
  assert.deepEqual([...new Set(manifests)].sort(), [
    'submission/codex/fixture-template/repository/package.json', 'tooling/package.json',
  ]);
  const lockfiles = paths.filter((path) => /^(?:package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?)$/.test(basename(path)));
  assert.deepEqual([...new Set(lockfiles)], ['tooling/package-lock.json']);
  execFileSync('git', ['check-ignore', 'dist/pi-package/package.json'], { cwd: ROOT, timeout: 10_000 });
});

function filesUnder(directory, prefix) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = `${prefix}/${entry.name}`;
    return entry.isDirectory() ? filesUnder(join(directory, entry.name), path) : [path];
  });
}
