// Tester client: node ux.cjs <session> <action> [args...]
// Actions: open · snapshot · click <name> · type [--field "<label>"] <text> [--enter] · select "<label>" <option>
//          · press <key> · wait <ms> · screenshot · errors (operator: page errors in this session)
// "open <scenario>" is for the test operator only (to start a tester mid-flow); testers run plain "open".
// Exits non-zero when the harness is unreachable or answers with an ERROR, so shell && chains stop.
const fs = require('fs');
const http = require('http');
const { tokenFile } = require('./common.cjs');

const port = Number(process.env.UX_PORT || 3917);
const [session, action, ...args] = process.argv.slice(2);

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

let token;
try {
  token = fs.readFileSync(tokenFile(port), 'utf8').trim();
} catch {
  fail(`ERROR: harness not running on port ${port} (no token file).`);
  process.exit();
}

// Operator-only: "open <scenario> --viewport 400x860" opens the session at a phone-sized viewport.
let viewport;
const vi = action === 'open' ? args.indexOf('--viewport') : -1;
if (!session || !action) {
  fail('Usage: node ux.cjs <session> <action> [args...]');
  process.exit();
}
if (vi !== -1) {
  const m = /^(\d+)x(\d+)$/.exec(args[vi + 1] || '');
  if (!m) {
    fail('ERROR: --viewport needs WIDTHxHEIGHT, e.g. 400x860.');
    process.exit();
  }
  viewport = { width: Number(m[1]), height: Number(m[2]) };
  args.splice(vi, 2);
}
if (action === 'open' && args.length > 1) {
  console.error(`warning: "open" takes one scenario; ignoring: ${args.slice(1).join(' ')}`);
}
const body = JSON.stringify(
  action === 'open' ? { session, action, scenario: args[0], viewport } : { session, action, args },
);
const req = http.request(
  { host: '127.0.0.1', port, method: 'POST', path: '/', headers: { 'x-ux-token': token } },
  (res) => {
    let d = '';
    res.on('data', (c) => (d += c));
    res.on('end', () => {
      if (d.startsWith('ERROR')) fail(d);
      else console.log(d);
    });
  },
);
req.on('error', (e) => fail('ERROR: harness not reachable: ' + e.message));
req.end(body);
