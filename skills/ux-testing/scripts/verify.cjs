// Operator-only: evaluate a success check in each tester's page and print the result.
// Usage: UX_VERIFY_TOKEN=<token> node verify.cjs <check.js> <session> [session...]
//   check.js holds one JavaScript expression evaluated in the page. It must return a value, e.g. over a
//   read-only state hook:   (() => ({ success: window.__state.orders.some((o) => o.status === 'paid') }))()
//   or over the DOM:        (() => ({ success: !!document.querySelector('[data-order-status="paid"]') }))()
// For an app with a backend, you can also check the API or database from your own shell instead.
// Exits non-zero if any session could not be checked.
const fs = require('fs');
const http = require('http');
const { tokenFile } = require('./common.cjs');

const port = Number(process.env.UX_PORT || 3917);
const [checkFile, ...sessions] = process.argv.slice(2);
if (!checkFile || sessions.length === 0) {
  console.error('Usage: UX_VERIFY_TOKEN=<token> node verify.cjs <check.js> <session> [session...]');
  process.exit(1);
}
const expr = fs.readFileSync(checkFile, 'utf8');
let token;
let verifyToken;
try {
  token = fs.readFileSync(tokenFile(port), 'utf8').trim();
} catch {
  console.error(`ERROR: harness not running on port ${port} (no token file).`);
  process.exit(1);
}
// The verify token is never on disk: copy it from the server's startup output.
verifyToken = process.env.UX_VERIFY_TOKEN;
if (!verifyToken) {
  console.error('ERROR: set UX_VERIFY_TOKEN to the verify token the harness printed when it started.');
  process.exit(1);
}

function evalIn(session) {
  return new Promise((resolve) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        method: 'POST',
        path: '/',
        headers: { 'x-ux-token': token, 'x-ux-verify-token': verifyToken },
      },
      (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => resolve(d));
      },
    );
    req.on('error', (e) => resolve('ERROR: ' + e.message));
    req.end(JSON.stringify({ session, action: 'eval', expr }));
  });
}

(async () => {
  for (const s of sessions) {
    const result = await evalIn(s);
    if (result.startsWith('ERROR')) process.exitCode = 1;
    console.log(s, result);
  }
})();
