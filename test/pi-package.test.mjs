import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import test, { after } from 'node:test';
import { buildPiPackage, divergentPackageInputs, trackedSkillFiles } from '../scripts/package-pi.mjs';
import { ROOT, listSkillNames, readJson } from '../scripts/public-catalog.mjs';

const scratch = mkdtempSync(join(tmpdir(), 'aictrl-pi-package-test-'));
after(() => rmSync(scratch, { recursive: true, force: true }));
// Tests run in working checkouts; the publish path (the CLI) keeps the clean-tree guard.
const { output, manifest, pack, tarball } = buildPiPackage({ output: join(scratch, 'package'), requireClean: false });
const packedPaths = new Set(pack.files.map(({ path }) => path));

test('Pi npm metadata uses the gallery keyword and shared release version', () => {
  assert.equal(manifest.name, '@aictrl/skills');
  assert.equal(manifest.keywords[0], 'pi-package');
  assert.equal(manifest.version, readJson('.claude-plugin/plugin.json').version);
  assert.equal(manifest.license, 'MIT');
  assert.equal(manifest.homepage, 'https://aictrl.dev');
  assert.equal(manifest.repository.url, 'https://github.com/aictrl-dev/skills.git');
  assert.deepEqual(readJson('package.json', output), manifest);
  // Fixed key set: no scripts or bin, so installing the package never runs code.
  assert.deepEqual(Object.keys(manifest).sort(), [
    'description', 'files', 'homepage', 'keywords', 'license', 'name', 'pi', 'repository', 'type', 'version',
  ]);
});

test('the publish build refuses package inputs that differ from the commit', () => {
  const repo = join(scratch, 'dirty-repo');
  const run = (...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', ...args], { cwd: repo, timeout: 10_000 });
  mkdirSync(join(repo, 'skills/a'), { recursive: true });
  mkdirSync(join(repo, 'submission/pi'), { recursive: true });
  for (const name of ['SKILL.md', 'hidden.md', 'gone.md', 'old.md']) writeFileSync(join(repo, 'skills/a', name), `${name}\n`);
  writeFileSync(join(repo, 'submission/pi/README.md'), 'readme\n');
  writeFileSync(join(repo, 'LICENSE'), 'MIT\n');
  writeFileSync(join(repo, 'notes.md'), 'not a package input\n');
  run('init', '-q');
  run('add', '.');
  run('commit', '-qm', 'init');
  assert.deepEqual(divergentPackageInputs(repo), []);
  // Outside the inputs, or untracked: never copied, so allowed.
  writeFileSync(join(repo, 'notes.md'), 'changed\n');
  writeFileSync(join(repo, 'skills/a/untracked.md'), 'never copied\n');
  assert.deepEqual(divergentPackageInputs(repo), []);
  writeFileSync(join(repo, 'skills/a/SKILL.md'), 'edited\n');
  writeFileSync(join(repo, 'LICENSE'), 'staged\n');
  run('add', 'LICENSE');
  run('update-index', '--skip-worktree', 'skills/a/hidden.md');
  writeFileSync(join(repo, 'skills/a/hidden.md'), 'masked from git status\n');
  rmSync(join(repo, 'skills/a/gone.md'));
  run('mv', 'skills/a/old.md', 'skills/a/new.md');
  assert.deepEqual(divergentPackageInputs(repo).sort(), [
    'LICENSE', 'skills/a/SKILL.md', 'skills/a/gone.md', 'skills/a/hidden.md', 'skills/a/old.md',
  ]);
});

test('the build packs a tarball with exactly the verified file list', () => {
  assert.equal(basename(tarball), `aictrl-skills-${manifest.version}.tgz`);
  const entries = execFileSync('tar', ['-tzf', tarball], { encoding: 'utf8', timeout: 10_000 })
    .split('\n').filter((entry) => entry && !entry.endsWith('/'));
  assert.deepEqual(entries.map((entry) => entry.replace(/^package\//, '')).sort(), [...packedPaths].sort());
});

test('every canonical skill and supporting file ships unchanged in the npm pack', () => {
  const skills = listSkillNames();
  assert.deepEqual(listSkillNames(output), skills);
  const tracked = trackedSkillFiles();
  for (const path of tracked) {
    assert.ok(packedPaths.has(path), `Not packed: ${path}`);
    assert.deepEqual(readFileSync(join(output, path)), readFileSync(join(ROOT, path)), path);
  }
  // Exactly the tracked files: nothing untracked or ignored from the working tree.
  assert.deepEqual([...packedPaths].filter((path) => path.startsWith('skills/')).sort(), [...tracked].sort());
  for (const skill of skills) {
    assert.ok(packedPaths.has(`skills/${skill}/SKILL.md`));
  }
});

test('manifest resources exist and the tarball contains only public package files', () => {
  for (const path of manifest.pi.skills) {
    assert.ok(statSync(join(output, path)).isDirectory(), path);
  }
  assert.equal(manifest.pi.extensions, undefined);
  assert.equal(new URL(manifest.pi.image).protocol, 'https:');
  assert.equal(manifest.pi.image, 'https://raw.githubusercontent.com/aictrl-dev/skills/main/assets/github-social-preview.png');
  for (const path of ['README.md', 'LICENSE', 'package.json']) assert.ok(packedPaths.has(path));
  for (const path of packedPaths) {
    assert.match(path, /^(?:skills\/|README\.md$|LICENSE$|package\.json$)/);
    for (const segment of path.split('/')) {
      assert.ok(!segment.startsWith('.') && segment !== 'node_modules' && segment !== '__pycache__', `Must not ship: ${path}`);
    }
  }
  // The gallery preview hotlinks this asset on main; it must exist in the repo.
  assert.ok(statSync(join(ROOT, 'assets/github-social-preview.png')).isFile());
  assert.deepEqual(readFileSync(join(output, 'README.md')), readFileSync(join(ROOT, 'submission/pi/README.md')));
  assert.deepEqual(readFileSync(join(output, 'LICENSE')), readFileSync(join(ROOT, 'LICENSE')));
});

test('gallery README covers every skill and attributes all aictrl.dev links to Pi', () => {
  const readme = readFileSync(join(output, 'README.md'), 'utf8');
  const skills = listSkillNames();
  for (const skill of skills) assert.ok(readme.includes(`\`${skill}\``), skill);
  // The skill counts and the standalone/connected split must stay true as skills change.
  const connected = ['create-workflow', 'implement-code-change', 'execute-workflow'];
  const standalone = skills.filter((skill) => !connected.includes(skill));
  assert.ok(readme.startsWith(`# aictrl skills for Pi\n\n${skills.length} MIT-licensed`));
  assert.ok(manifest.description.startsWith(`${skills.length} MIT`));
  const standaloneParagraph = readme.split(`These ${standalone.length} work on their own`)[1]?.split('\n\n')[1];
  assert.ok(standaloneParagraph, `README must say "These ${standalone.length} work on their own"`);
  assert.deepEqual([...standaloneParagraph.matchAll(/`([a-z-]+)`/g)].map(([, name]) => name), standalone);
  for (const skill of connected) assert.match(readme, new RegExp(`^- \`${skill}\``, 'm'));
  // Public copy rules: no vendor support claims, no Kimi, lowercase brand.
  assert.doesNotMatch(readme, /kimi|moonshot|z\.ai|zhipu|official|partner|approved/i);
  assert.doesNotMatch(readme, /AICtrl|\[ai\]ctrl|Aictrl/);
  assert.match(readme, /pi install npm:@aictrl\/skills/);
  assert.match(readme, /pi mcp add aictrl --url https:\/\/aictrl\.dev\/mcp/);
  assert.match(readme, /pi mcp login aictrl/);
  assert.match(readme, /`execute-workflow` needs the connection/);
  // The MCP endpoint in the connect command is not a tracked web link.
  const links = [...readme.matchAll(/https:\/\/aictrl\.dev[^\s)]+/g)].map(([url]) => new URL(url))
    .filter((url) => url.pathname !== '/mcp');
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

