// Resolve from the installed skill using Node's module search: ancestor node_modules, NODE_PATH,
// and global folders. The target CWD is not an automatic lookup root. A skill vendored in an untrusted
// repo is not isolated from that repo's ancestor packages. Use a separate trusted skill install.
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
  throw new Error('Playwright was not found in Node module search paths (skill-directory ancestors, NODE_PATH, and global folders). Install it in a directory you trust (`npm i -D playwright && npx playwright install chromium`) and run with NODE_PATH=<that directory>/node_modules.');
}

module.exports = { loadPlaywright };
