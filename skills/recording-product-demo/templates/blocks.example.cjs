/* Example demo/blocks.cjs — the per-repo journey, one block per narration
 * segment. The framework (record-demo.cjs) provides the api; this file owns
 * WHAT is shown. Copy into the host repo's demo/ dir and rewrite the blocks
 * against the app's REAL on-screen strings (scrape-text.cjs dumps them).
 *
 * Rules that keep the take time-locked:
 * - Call setT0() exactly when narration should start (after the first page is
 *   visually settled). Everything before it is trimmed by assemble.cjs.
 * - EVERY block ends with `await until(B[i])` — the narration boundary.
 * - Wrap optional flourishes in glideTo(...) — it logs a WARN and moves on if
 *   the element is missing, costing ~2s, not a blown take.
 * - A take that logs "WARN: block overran" is garbage; tighten the block.
 */
module.exports = async function run(api) {
  const { page, config, B, until, sleep, glideTo, slowWheel, setT0 } = api;
  const BASE = config.app.baseUrl;

  // ---- Block 1: opening scene [t0 - B1] ----
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.getByText(new RegExp(config.app.readyText, 'i')).first()
    .waitFor({ timeout: 15000 }).catch(() => console.log('[blocks] WARN: ready text not found'));
  await sleep(800);
  setT0(); // narration starts here
  await sleep(2000);
  await slowWheel(300, 4000);
  await until(B[1]);

  // ---- Block 2: a feature page [B1 - B2] ----
  await page.goto(`${BASE}/features`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await sleep(800);
  await glideTo(page.getByRole('heading').first(), 1000);
  await sleep(1500);
  await slowWheel(400, 3000);
  await until(B[2]);

  // ---- closing hold: past narration end, for the fade ----
  await until(B[B.length - 1] + 1.2);
};
