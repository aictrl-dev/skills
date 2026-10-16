// Load executable dependencies from the skill's location or explicitly trusted NODE_PATH only.
// The target CWD must never select code to run. A skill vendored in an untrusted repo is not isolated
// from that repo: Node also searches node_modules above this file. Use a separate trusted skill install.
function loadPlaywright() {
  for (const name of ['playwright', 'playwright-core']) {
    let resolved;
    try {
      resolved = require.resolve(name);
    } catch (error) {
      // Only an absent package permits fallback; invalid exports/main or other resolution errors fail.
      if (error.code === 'MODULE_NOT_FOUND' && error.message.startsWith(`Cannot find module '${name}'`)) continue;
      throw error;
    }
    // Initialization happens outside the catch: missing internal dependencies and thrown errors must
    // retain their original diagnostics, even if another installation is available.
    return require(resolved);
  }
  throw new Error('Playwright was not found next to the skill or on NODE_PATH. Install it in a directory you trust (`npm i -D playwright && npx playwright install chromium`) and run with NODE_PATH=<that directory>/node_modules.');
}

module.exports = { loadPlaywright };
