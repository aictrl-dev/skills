import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import test, { after, before } from 'node:test';
import { ROOT } from '../scripts/public-catalog.mjs';

// namedFields() is what the harness's `type --field "<label>"` resolves against. It drives a real page, so it needs
// Playwright with Chromium, which this package does not depend on; point NODE_PATH at a node_modules that has it.
// Without it these tests skip instead of failing.
const require = createRequire(join(ROOT, 'package.json'));
const { namedFields } = require(join(ROOT, 'skills/ux-testing/scripts/common.cjs'));

function loadChromium() {
  for (const name of ['playwright', 'playwright-core']) {
    try {
      const { chromium } = require(name);
      return existsSync(chromium.executablePath()) ? { chromium } : { skip: `${name} is installed but Chromium is not (npx playwright install chromium)` };
    } catch { /* try the next one */ }
  }
  return { skip: 'Playwright is not installed; set NODE_PATH to a node_modules with playwright and Chromium to run the ux-testing type --field tests' };
}
const { chromium, skip } = loadChromium();

let browser;
before(async () => { if (!skip) browser = await chromium.launch(); });
after(async () => { if (browser) await browser.close(); });

// The three labelled text-entry controls a page can offer: a plain textbox, a search box (<input type="search">
// has role searchbox, not textbox) and an editable combobox (an autocomplete input with role combobox).
const FORM = `<!doctype html><main><form>
  <label for="title">Title</label><input type="text" id="title">
  <label for="find">Find a concept</label><input type="search" id="find">
  <label for="assignee">Assignee</label><input type="text" id="assignee" role="combobox" aria-expanded="false">
</form></main>`;

async function withPage(fn) {
  const page = await browser.newPage();
  try {
    await page.setContent(FORM);
    await fn(page);
  } finally {
    await page.close();
  }
}

async function typeIntoField(page, label, text) {
  const named = namedFields(page, label);
  const n = await named.count();
  if (!n) return 0;
  await named.first().fill(text);
  return n;
}

test('ux-testing: type --field reaches a textbox by label', { skip }, () => withPage(async (page) => {
  assert.equal(await typeIntoField(page, 'Title', 'New title'), 1);
  assert.equal(await page.locator('#title').inputValue(), 'New title');
}));

test('ux-testing: type --field reaches an input type=search by label', { skip }, () => withPage(async (page) => {
  assert.equal(await typeIntoField(page, 'Find a concept', 'checkout'), 1);
  assert.equal(await page.locator('#find').inputValue(), 'checkout');
}));

test('ux-testing: type --field reaches an editable combobox by label', { skip }, () => withPage(async (page) => {
  assert.equal(await typeIntoField(page, 'Assignee', 'Jordan'), 1);
  assert.equal(await page.locator('#assignee').inputValue(), 'Jordan');
}));

test('ux-testing: type --field still misses a label that is not on the page', { skip }, () => withPage(async (page) => {
  assert.equal(await namedFields(page, 'No such field').count(), 0);
}));
