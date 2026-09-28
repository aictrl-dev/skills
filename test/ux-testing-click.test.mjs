import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import test, { after, before } from 'node:test';
import { ROOT } from '../scripts/public-catalog.mjs';

// resolveTarget() is what the harness's `click <visible name>` runs. It drives a real page, so it needs Playwright
// with Chromium, which this package does not depend on; point NODE_PATH at a node_modules that has it. Without it
// these tests skip instead of failing.
const require = createRequire(join(ROOT, 'package.json'));
const { ROLES, resolveTarget } = require(join(ROOT, 'skills/ux-testing/scripts/common.cjs'));

function loadChromium() {
  for (const name of ['playwright', 'playwright-core']) {
    try {
      const { chromium } = require(name);
      return existsSync(chromium.executablePath()) ? { chromium } : { skip: `${name} is installed but Chromium is not (npx playwright install chromium)` };
    } catch { /* try the next one */ }
  }
  return { skip: 'Playwright is not installed; set NODE_PATH to a node_modules with playwright and Chromium to run the ux-testing click tests' };
}
const { chromium, skip } = loadChromium();

let browser;
before(async () => { if (!skip) browser = await chromium.launch(); });
after(async () => { if (browser) await browser.close(); });

// An MUI-style settings row: the description is a paragraph, not a <label>, and the switch is named by aria-label.
const SETTINGS = `<!doctype html><main>
  <div class="row">
    <p>Set as default workflow</p>
    <input type="checkbox" role="switch" aria-label="Set as default workflow">
  </div>
  <div class="row">
    <span>Email notifications</span>
    <button type="button" role="switch" aria-checked="false" aria-label="Email notifications"
      onclick="this.setAttribute('aria-checked', this.getAttribute('aria-checked') === 'true' ? 'false' : 'true')">Off</button>
  </div>
</main>`;

async function withPage(fn) {
  const page = await browser.newPage();
  try {
    await page.setContent(SETTINGS);
    await fn(page);
  } finally {
    await page.close();
  }
}

const isSwitch = (loc) => loc.evaluate((el) => el.getAttribute('role') === 'switch');

test('ux-testing: switch is a clickable role', () => {
  assert.ok(ROLES.includes('switch'));
});

test('ux-testing: click by visible name hits an input role=switch, not the paragraph beside it', { skip }, () => withPage(async (page) => {
  const hit = await resolveTarget(page, 'Set as default workflow');
  assert.ok(hit && hit.loc, 'the name should resolve');
  assert.equal(await isSwitch(hit.loc), true, 'resolved to the description text instead of the switch');
  await hit.loc.click();
  assert.equal(await page.getByRole('switch', { name: 'Set as default workflow' }).isChecked(), true);
}));

test('ux-testing: the switch: prefix picks a switch', { skip }, () => withPage(async (page) => {
  const hit = await resolveTarget(page, 'switch:Set as default workflow');
  assert.ok(hit && hit.loc, 'switch:<name> should resolve, not be rejected as an unknown role');
  assert.equal(await isSwitch(hit.loc), true);
}));

test('ux-testing: a button role=switch toggles by name', { skip }, () => withPage(async (page) => {
  const hit = await resolveTarget(page, 'Email notifications');
  assert.ok(hit && hit.loc, 'the name should resolve');
  assert.equal(await isSwitch(hit.loc), true, 'resolved to the label text instead of the switch');
  await hit.loc.click();
  assert.equal(await hit.loc.getAttribute('aria-checked'), 'true');
}));
